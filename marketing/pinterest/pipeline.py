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


DEFAULT_TEXT_MODEL = "google/gemini-2.5-flash-lite"  # cheap + reliable for short pin copy — see CLAUDE.md


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
    # Separate (cheaper) model for text copy, not the image-editing model above. Optional —
    # falls back to DEFAULT_TEXT_MODEL rather than failing, so existing deployments don't
    # need an .env change to pick this up.
    env["OPENROUTER_TEXT_MODEL"] = os.environ.get(
        "OPENROUTER_TEXT_MODEL", env.get("OPENROUTER_TEXT_MODEL") or DEFAULT_TEXT_MODEL
    )
    return env


def build_prompt(room_label, style_label):
    # Mirrors buildPrompt() in apps/api/src/generations/generation-worker.service.ts
    return (
        f"Redesign this {room_label} in {style_label.lower()} style. "
        "Keep the room's exact shape, geometry, and camera perspective; "
        "do not add, remove, resize, or move any doors, windows, or other openings — "
        "you may restyle existing ones but not create new ones. "
        "Wall, floor, and ceiling colors and materials can change, along with "
        "furniture, decor, and color palette."
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


def utm_link(date, slot_num):
    """date: 'YYYY-MM-DD' (schedule timezone), slot_num: 1-based slot in the batch.
    Format: https://sundera.app/?utm_source=pinterest&utm_medium=social&utm_content=2026-09-21-1"""
    return f"https://sundera.app/?utm_source=pinterest&utm_medium=social&utm_content={date}-{slot_num}"


_COPY_RE = re.compile(r"TITLE:\s*(.+?)\s*\n+\s*DESCRIPTION:\s*(.+)", re.IGNORECASE | re.DOTALL)


def _clip(text, limit):
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(".,;:")


# Ported from feat/marketing-automatio-tool (commit 7b0f336, "FEAT: copy generation") — see
# the collage/CTA porting note above draw_badge; this is the copy-generation half of that
# same unmerged branch, hand-ported the same way.
def generate_copy(env, room_label, style_label, link, retries=3):
    """Title + description for a Pinterest pin, via a cheap OpenRouter text model
    (OPENROUTER_TEXT_MODEL, see load_api_env). The model writes a {LINK} placeholder
    rather than a literal URL — swapped in here — so the UTM link (built by utm_link,
    not the model) can never be mistyped or hallucinated."""
    system_prompt = (
        "You write short, SEO-friendly Pinterest pin copy for Sundera, an AI interior redesign app: "
        "upload a photo of your room, get back a photorealistic redesign in seconds. Audience is "
        "home-decor Pinterest users searching for room inspiration."
    )
    user_prompt = (
        f"This pin shows a real 'before' photo of a {room_label} next to an AI-generated 'after' "
        f"redesign of the same room in {style_label} style.\n\n"
        "Write:\n"
        "1. TITLE — max 100 characters. SEO keywords (room type + style). No hashtags, no emoji, no quotes.\n"
        "2. DESCRIPTION — 300-500 characters, three parts in order: "
        "(a) one short CTA sentence inviting the reader to try Sundera on their own room; "
        "(b) 1-2 sentences describing this specific transformation with concrete details "
        "(colors, materials, furniture) as if describing a real before/after; "
        "(c) one closing CTA sentence that ends with exactly the literal text {LINK} — "
        "do not write a URL yourself, do not alter or explain that token, just place it at the end.\n\n"
        "Respond in exactly this format and nothing else:\n"
        "TITLE: <title>\n"
        "DESCRIPTION: <description>"
    )
    body = {
        "model": env["OPENROUTER_TEXT_MODEL"],
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.8,
    }
    for attempt in range(retries):
        resp = requests.post(
            f"{env['OPENROUTER_BASE_URL']}/chat/completions",
            headers={
                "Authorization": f"Bearer {env['OPENROUTER_API_KEY']}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=30,
        )
        if resp.status_code == 429 and attempt < retries - 1:
            time.sleep(10 * (attempt + 1))
            continue
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"]
        match = _COPY_RE.search(text)
        if not match:
            if attempt < retries - 1:
                continue
            raise RuntimeError(f"Could not parse title/description from model output: {text!r}")
        title = match.group(1).strip().strip('"').strip("*").strip()
        description = match.group(2).strip().strip('"').strip()
        description = description.replace("{LINK}", link)
        return _clip(title, 100), _clip(description, 500)
    raise RuntimeError("OpenRouter text request failed after retries")


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


def draw_badge(draw, font, canvas_width, text, *, align, dot=False, top=BADGE_MARGIN):
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_w = text_bbox[2] - text_bbox[0]
    text_h = text_bbox[3] - text_bbox[1]
    dot_r = 4
    dot_gap = 8 if dot else 0
    content_w = text_w + (2 * dot_r + dot_gap if dot else 0)

    badge_w = content_w + 2 * BADGE_PAD_X
    badge_h = text_h + 2 * BADGE_PAD_Y
    x0 = BADGE_MARGIN if align == "left" else canvas_width - BADGE_MARGIN - badge_w
    y0 = top
    draw.rounded_rectangle([x0, y0, x0 + badge_w, y0 + badge_h], radius=badge_h / 2, fill=BADGE_FILL)

    cx = x0 + BADGE_PAD_X
    cy = y0 + badge_h / 2
    if dot:
        draw.ellipse([cx, cy - dot_r, cx + 2 * dot_r, cy + dot_r], fill=ACCENT)
        cx += 2 * dot_r + dot_gap
    draw.text((cx, cy - text_h / 2 - text_bbox[1]), text, fill=BADGE_TEXT, font=font)


# Ported from feat/marketing-automatio-tool (commit e4d19b9, "FEAT: cta lable for collage")
# — that branch diverged from this one before this session's Kufar-pipeline work and was
# never merged; this is a hand-port of just the collage/CTA pieces, not the rest of that
# branch (copy generation, self-learning candidate picking, etc. — out of scope, see CLAUDE.md).
COLLAGE_WIDTH = 1000
COLLAGE_HEIGHT = 1500  # before+after photo area, 2:3 on its own

# CTA band appended below the before/after photo area (not overlaid on top of a photo, so
# neither image gets covered). Final canvas is COLLAGE_WIDTH x (COLLAGE_HEIGHT +
# CTA_BAND_HEIGHT), ~1:1.63, still well inside Pinterest's supported aspect range (up to
# ~1:2.1) so it won't get cropped in feed. Slightly translucent accent band (blends with the
# white canvas behind it) so it reads as part of the design, not a hard sticker.
CTA_BAND_HEIGHT = 130
CTA_TEXT = "Redesign your room"
CTA_BG = ACCENT[:3] + (225,)
CTA_TEXT_COLOR = (255, 255, 255, 255)


def draw_down_arrow(draw, cx, cy, size, color):
    """Bold filled arrow — shaft + barbed/flared head, like the ➜ dingbat rotated 90° to
    point down — rather than a thin outline stem+chevron."""
    h = size
    w = size * 0.85
    top = cy - h / 2
    bottom = cy + h / 2
    head_top_y = top + h * 0.42

    shaft_l = cx - w * 0.17
    shaft_r = cx + w * 0.17
    head_l = cx - w / 2
    head_r = cx + w / 2

    draw.polygon(
        [
            (shaft_l, top),
            (shaft_r, top),
            (shaft_r, head_top_y),
            (head_r, head_top_y),
            (cx, bottom),
            (head_l, head_top_y),
            (shaft_l, head_top_y),
        ],
        fill=color,
    )


def draw_cta_band(draw, font, canvas_width, canvas_height, band_height):
    top = canvas_height - band_height
    draw.rectangle([0, top, canvas_width, canvas_height], fill=CTA_BG)

    text_bbox = draw.textbbox((0, 0), CTA_TEXT, font=font)
    text_w = text_bbox[2] - text_bbox[0]
    text_h = text_bbox[3] - text_bbox[1]

    arrow_size = text_h * 1.3
    arrow_gap = 16
    content_w = text_w + arrow_gap + arrow_size

    text_x = (canvas_width - content_w) / 2
    center_y = top + band_height / 2
    draw.text((text_x, center_y - text_h / 2 - text_bbox[1]), CTA_TEXT, fill=CTA_TEXT_COLOR, font=font)

    arrow_cx = text_x + text_w + arrow_gap + arrow_size / 2
    draw_down_arrow(draw, arrow_cx, center_y, arrow_size, CTA_TEXT_COLOR)


def cover_crop(img, target_w, target_h):
    """Resize to fully cover target_w x target_h, then center-crop the excess."""
    scale = max(target_w / img.width, target_h / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)))
    left = (img.width - target_w) // 2
    top = (img.height - target_h) // 2
    return img.crop((left, top, left + target_w, top + target_h))


def make_collage_bytes(before_bytes, after_bytes):
    before = Image.open(io.BytesIO(before_bytes)).convert("RGB")
    after = Image.open(io.BytesIO(after_bytes)).convert("RGB")

    panel_h = COLLAGE_HEIGHT // 2
    before = cover_crop(before, COLLAGE_WIDTH, panel_h)
    after = cover_crop(after, COLLAGE_WIDTH, panel_h)

    canvas_height = COLLAGE_HEIGHT + CTA_BAND_HEIGHT
    canvas = Image.new("RGB", (COLLAGE_WIDTH, canvas_height), "white")
    canvas.paste(before, (0, 0))
    canvas.paste(after, (0, panel_h))

    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    font = load_font(26)
    draw_badge(odraw, font, canvas.width, "BEFORE", align="left", top=BADGE_MARGIN)
    draw_badge(odraw, font, canvas.width, "AFTER", align="left", dot=True, top=panel_h + BADGE_MARGIN)
    draw_cta_band(odraw, load_font(38), canvas.width, canvas_height, CTA_BAND_HEIGHT)

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
