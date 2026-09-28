"""Shared generation pipeline for the Sundera Pinterest content pipeline.

Used by both generate_pairs.py (manual one-shot batch CLI, no Telegram) and
bot.py (the daily Telegram-approval daemon). Talks to OpenRouter directly
(same prompt/model contract as apps/api's OpenRouterImageGenerationProvider
— see CLAUDE.md) rather than going through the Nest app, since there is no
DB-backed Generation/RoomPhoto record for these photos.
"""
import base64
import io
import json
import mimetypes
import os
import random
import re
import sys
import time

import requests
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS_DIR = os.path.join(HERE, "photos")
MANIFEST_PATH = os.path.join(PHOTOS_DIR, "manifest.json")
OUTPUT_DIR = os.path.join(HERE, "output")
USED_PATH = os.path.join(OUTPUT_DIR, "used_photos.json")
API_ENV_PATH = os.path.join(HERE, "..", "..", "apps", "api", ".env")
LOCAL_ENV_PATH = os.path.join(HERE, ".env")

# Friendly labels for the Pexels room_type buckets used in this folder's
# manifest.json (marketing/pinterest/pexels_collect.py ROOMS) — these are
# broader than packages/shared RoomType (no OFFICE-only bucket, has
# dining_room/entryway), so kept separate rather than force-mapped.
ROOM_LABELS = {
    "living_room": "living room",
    "bedroom": "bedroom",
    "kitchen": "kitchen",
    "bathroom": "bathroom",
    "dining_room": "dining room",
    "home_office": "home office",
    "kids_room": "kids room",
    "entryway": "entryway",
}


def room_label(room_type):
    """room_type is null for the Kufar pack (see kufar_collect.py) — unlike Pexels'
    per-query room type, Kufar listings mix every room of an apartment in one gallery with
    no per-photo label, classified later by hand/classify_photos.py instead."""
    if not room_type:
        return "room"
    return ROOM_LABELS.get(room_type, room_type.replace("_", " "))


# Mirrors packages/shared/src/enums/design-style.enum.ts DESIGN_STYLE_LABELS.
# Keep in sync if a style is added/renamed there.
DESIGN_STYLE_LABELS = {
    "MODERN": "Modern",
    "SCANDINAVIAN": "Scandinavian",
    "MINIMALISM": "Minimalism",
    "LOFT_INDUSTRIAL": "Loft / Industrial",
    "BOHO": "Boho",
    "JAPANESE": "Japanese",
    "CLASSIC": "Classic",
    "PROVENCE": "Provence",
    "ART_DECO": "Art Deco",
    "MID_CENTURY": "Mid-Century",
    "COASTAL": "Coastal",
    "FARMHOUSE": "Farmhouse",
    "MEDITERRANEAN": "Mediterranean",
    "ECLECTIC": "Eclectic",
}


def read_env_file(path):
    env = {}
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                env[key.strip()] = value.strip()
    return env


def load_api_env():
    """OPENROUTER_* — checks marketing/pinterest/.env first, then apps/api/.env, then the environment."""
    env = read_env_file(API_ENV_PATH)
    env.update({k: v for k, v in read_env_file(LOCAL_ENV_PATH).items() if v})
    for key in ("OPENROUTER_API_KEY", "OPENROUTER_MODEL", "OPENROUTER_BASE_URL"):
        env[key] = os.environ.get(key, env.get(key, ""))
    missing = [k for k in ("OPENROUTER_API_KEY", "OPENROUTER_MODEL", "OPENROUTER_BASE_URL") if not env[k]]
    if missing:
        sys.exit(
            f"Missing {', '.join(missing)} (checked marketing/pinterest/.env, apps/api/.env, and the environment)"
        )
    return env


def build_prompt(room_label, style_label):
    # Mirrors buildPrompt() in apps/api/src/generations/generation-worker.service.ts
    return (
        f"Redesign this {room_label} in {style_label.lower()} style. "
        "Preserve the existing walls, windows, doors, and camera perspective exactly; "
        "only change furniture, decor, materials, and color palette."
    )


def edit_image(env, image_bytes, mime_type, prompt, retries=3):
    data_url = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode()}"
    body = {
        "model": env["OPENROUTER_MODEL"],
        "prompt": prompt,
        "n": 1,
        "input_references": [{"type": "image_url", "image_url": {"url": data_url}}],
    }
    for attempt in range(retries):
        resp = requests.post(
            f"{env['OPENROUTER_BASE_URL']}/images",
            headers={
                "Authorization": f"Bearer {env['OPENROUTER_API_KEY']}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=90,
        )
        if resp.status_code == 429 and attempt < retries - 1:
            wait = 20 * (attempt + 1)
            print(f"  rate limited, sleeping {wait}s", file=sys.stderr)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        payload = resp.json()
        variant = payload["data"][0]
        media_type = variant.get("media_type", "image/png")
        return base64.b64decode(variant["b64_json"]), media_type
    raise RuntimeError("OpenRouter request failed after retries")


def load_manifest(source_dir=None):
    """source_dir restricts to manifest entries whose file lives in that photos/ subfolder
    (e.g. "clean" for classify_photos.py's vetted-room/no-watermark bucket) — None (default)
    returns every kept photo regardless of subfolder, root-level Pexels/unclassified included."""
    if not os.path.exists(MANIFEST_PATH):
        sys.exit(f"No manifest at {MANIFEST_PATH} — run pexels_collect.py first")
    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)
    manifest = [m for m in manifest if m.get("status") == "kept" and os.path.exists(os.path.join(PHOTOS_DIR, m["file"]))]
    if source_dir:
        manifest = [m for m in manifest if m["file"].startswith(f"{source_dir}/")]
    return manifest


def remove_photo(photo_id):
    """Delete a photo's file (if present) and flip its manifest entry to status "removed" —
    used by bot.py the moment a photo is "used" (candidate rejected, or a generated result
    approved and archived to R2), so it's never shown again. Consistent with the hand-delete
    convention every collect/classify script's own load_manifest already respects."""
    if not os.path.exists(MANIFEST_PATH):
        return
    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)
    for m in manifest:
        if m["id"] == photo_id:
            path = os.path.join(PHOTOS_DIR, m["file"])
            if os.path.exists(path):
                os.remove(path)
            m["status"] = "removed"
            break
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


def load_used():
    if os.path.exists(USED_PATH):
        with open(USED_PATH) as f:
            return set(json.load(f))
    return set()


def save_used(used_ids):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(USED_PATH, "w") as f:
        json.dump(sorted(used_ids), f, indent=2)


def pick_photos(manifest, used_ids, count):
    """Batch pick, spread across room types — used by the manual generate_pairs.py CLI."""
    by_room = {}
    for m in manifest:
        if m["id"] in used_ids:
            continue
        by_room.setdefault(m["room_type"], []).append(m)
    for photos in by_room.values():
        random.shuffle(photos)

    rooms = list(by_room.keys())
    random.shuffle(rooms)
    picked = []
    i = 0
    while len(picked) < count and rooms:
        room = rooms[i % len(rooms)]
        bucket = by_room[room]
        if bucket:
            picked.append(bucket.pop())
        if not bucket:
            rooms.remove(room)
            if not rooms:
                break
            i = i % len(rooms) if rooms else 0
        else:
            i += 1
    return picked


def pick_one(manifest, excluded_ids, avoid_room_types=None):
    """Single-photo pick for bot.py's stage-1 candidate/replacement flow.

    avoid_room_types, if given, is steered away from (e.g. to avoid duplicating
    a room type already in today's batch) — used only if it doesn't empty the pool.
    """
    available = [m for m in manifest if m["id"] not in excluded_ids]
    if not available:
        return None
    if avoid_room_types:
        preferred = [m for m in available if m["room_type"] not in avoid_room_types]
        if preferred:
            available = preferred
    return random.choice(available)


FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # present if a Linux box has it installed
]


def load_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    # Docker/Railway: no system fonts installed (and installing one via apt
    # hit an unrelated environment issue) — Pillow >=10.1's load_default()
    # takes a size and returns an actual scalable font, not the old tiny
    # fixed bitmap one, so this still looks fine, just a different typeface.
    return ImageFont.load_default(size=size)


# Matches the in-app before/after badges: apps/web/src/components/generation/BeforeAfterSlider.tsx
# (rounded bg-black/50 pill, uppercase white semibold text; "After" gets a small accent dot).
BADGE_FILL = (0, 0, 0, 128)
BADGE_TEXT = (255, 255, 255, 255)
ACCENT = (217, 119, 6, 255)  # --color-accent, apps/web/src/app/globals.css
BADGE_PAD_X = 16
BADGE_PAD_Y = 10
BADGE_MARGIN = 16


def draw_badge(draw, font, canvas_width, text, *, align, dot=False):
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_w = text_bbox[2] - text_bbox[0]
    text_h = text_bbox[3] - text_bbox[1]
    dot_r = 4
    dot_gap = 8 if dot else 0
    content_w = text_w + (2 * dot_r + dot_gap if dot else 0)

    badge_w = content_w + 2 * BADGE_PAD_X
    badge_h = text_h + 2 * BADGE_PAD_Y
    x0 = BADGE_MARGIN if align == "left" else canvas_width - BADGE_MARGIN - badge_w
    y0 = BADGE_MARGIN
    draw.rounded_rectangle([x0, y0, x0 + badge_w, y0 + badge_h], radius=badge_h / 2, fill=BADGE_FILL)

    cx = x0 + BADGE_PAD_X
    cy = y0 + badge_h / 2
    if dot:
        draw.ellipse([cx, cy - dot_r, cx + 2 * dot_r, cy + dot_r], fill=ACCENT)
        cx += 2 * dot_r + dot_gap
    draw.text((cx, cy - text_h / 2 - text_bbox[1]), text, fill=BADGE_TEXT, font=font)


def make_collage_bytes(before_bytes, after_bytes):
    before = Image.open(io.BytesIO(before_bytes)).convert("RGB")
    after = Image.open(io.BytesIO(after_bytes)).convert("RGB")

    panel_h = 800
    gap = 6
    before = before.resize((round(panel_h * before.width / before.height), panel_h))
    after = after.resize((round(panel_h * after.width / after.height), panel_h))

    canvas = Image.new("RGB", (before.width + gap + after.width, panel_h), "white")
    canvas.paste(before, (0, 0))
    canvas.paste(after, (before.width + gap, 0))

    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    font = load_font(26)
    draw_badge(odraw, font, canvas.width, "BEFORE", align="left")
    draw_badge(odraw, font, canvas.width, "AFTER", align="right", dot=True)

    canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")
    out = io.BytesIO()
    canvas.save(out, format="JPEG", quality=92)
    return out.getvalue()


def make_collage(before_path, after_bytes, out_path):
    with open(before_path, "rb") as f:
        before_bytes = f.read()
    collage_bytes = make_collage_bytes(before_bytes, after_bytes)
    with open(out_path, "wb") as f:
        f.write(collage_bytes)


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def guess_mime(path):
    return mimetypes.guess_type(path)[0] or "image/jpeg"


def guess_ext(mime_type):
    return (mimetypes.guess_extension(mime_type) or ".png").lstrip(".")
