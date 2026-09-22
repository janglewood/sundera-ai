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
import math
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


def load_manifest():
    if not os.path.exists(MANIFEST_PATH):
        sys.exit(f"No manifest at {MANIFEST_PATH} — run pexels_collect.py first")
    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)
    return [m for m in manifest if m.get("status") == "kept" and os.path.exists(os.path.join(PHOTOS_DIR, m["file"]))]


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


def pick_one(manifest, excluded_ids, avoid_room_types=None, model=None):
    """Single-photo pick for bot.py's stage-1 candidate/replacement flow.

    avoid_room_types, if given, is steered away from (e.g. to avoid duplicating
    a room type already in today's batch) — used only if it doesn't empty the pool.

    model, if given (see build_preference_model), biases the pick toward photos
    whose query/alt-text resemble ones Anton has approved before, via weighted
    random sampling rather than a hard filter — see weighted_choice.
    """
    available = [m for m in manifest if m["id"] not in excluded_ids]
    if not available:
        return None
    if avoid_room_types:
        preferred = [m for m in available if m["room_type"] not in avoid_room_types]
        if preferred:
            available = preferred
    return weighted_choice(available, model)


# --- Self-learning candidate picking -----------------------------------------
#
# bot.py logs every stage-1 candidate approve/reject to state.py's `decisions`
# table (photo_id, room_type, query, alt, approved). build_preference_model()
# turns that log into per-query and per-alt-text-token approval rates; score_photo
# scores a manifest entry against it; weighted_choice samples candidates
# proportional to exp(score) instead of uniformly, so picks drift toward what's
# historically been approved (e.g. "full room" real-estate-style shots vs tight
# lifestyle crops) without ever fully excluding the rest of the pool — there's
# no explicit "full room" label in Pexels metadata, so the search query and alt
# text are the only proxies available for what a photo actually looks like.

PREF_ALPHA = 2.0  # additive smoothing: keeps low-evidence buckets close to neutral
PREF_MIN_TOKEN_EVIDENCE = 3  # ignore alt-text words seen fewer than this many times total
PREF_TOKEN_WEIGHT = 0.3  # alt-text tokens count for less than the query bucket (noisier signal)
PREF_SCORE_CLAMP = 4.0  # bounds exp(score) to ~[0.02x, 55x] so no bucket fully starves the pool

_PREF_STOPWORDS = {"a", "an", "the", "with", "and", "in", "of", "for", "on", "at", "to"}


def _pref_tokens(text):
    return [t for t in re.findall(r"[a-z]+", (text or "").lower()) if len(t) > 2 and t not in _PREF_STOPWORDS]


def _pref_rate(approved, rejected, prior):
    """Laplace-smoothed approval rate, pulled toward the global approval rate
    (prior) when a bucket has little or no evidence yet."""
    return (approved + PREF_ALPHA * prior) / (approved + rejected + PREF_ALPHA)


def build_preference_model(decisions):
    """decisions: list of dicts from state.load_decisions(). Returns None if there's
    no history yet (pick_one/weighted_choice then fall back to uniform random)."""
    if not decisions:
        return None
    global_rate = sum(d["approved"] for d in decisions) / len(decisions)

    query_counts = {}
    token_counts = {}
    for d in decisions:
        qa, qr = query_counts.get(d["query"], (0, 0))
        query_counts[d["query"]] = (qa + d["approved"], qr + (not d["approved"]))
        for tok in _pref_tokens(d["alt"]):
            ta, tr = token_counts.get(tok, (0, 0))
            token_counts[tok] = (ta + d["approved"], tr + (not d["approved"]))

    return {"global_rate": global_rate, "query": query_counts, "token": token_counts}


def score_photo(photo, model):
    """Log-odds-style score: >0 leans toward historically-approved features, <0
    toward historically-rejected ones, 0 when there's no signal either way."""
    if not model:
        return 0.0
    global_rate = model["global_rate"]

    def log_odds(rate):
        return math.log(rate / (1 - rate + 1e-9) + 1e-9)

    score = 0.0
    qa, qr = model["query"].get(photo.get("query"), (0, 0))
    if qa + qr > 0:
        score += log_odds(_pref_rate(qa, qr, global_rate))

    for tok in _pref_tokens(photo.get("alt")):
        ta, tr = model["token"].get(tok, (0, 0))
        if ta + tr >= PREF_MIN_TOKEN_EVIDENCE:
            score += log_odds(_pref_rate(ta, tr, global_rate)) * PREF_TOKEN_WEIGHT

    return score


def weighted_choice(candidates, model):
    """random.choice, but sampled proportional to exp(score_photo(...)) once a
    preference model exists — falls back to plain uniform choice otherwise."""
    if not candidates:
        return None
    if not model or len(candidates) == 1:
        return random.choice(candidates)
    weights = [math.exp(max(min(score_photo(c, model), PREF_SCORE_CLAMP), -PREF_SCORE_CLAMP)) for c in candidates]
    return random.choices(candidates, weights=weights, k=1)[0]


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


COLLAGE_WIDTH = 1000
COLLAGE_HEIGHT = 1500  # 2:3, e.g. for Pinterest pins


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

    canvas = Image.new("RGB", (COLLAGE_WIDTH, COLLAGE_HEIGHT), "white")
    canvas.paste(before, (0, 0))
    canvas.paste(after, (0, panel_h))

    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    font = load_font(26)
    draw_badge(odraw, font, canvas.width, "BEFORE", align="left", top=BADGE_MARGIN)
    draw_badge(odraw, font, canvas.width, "AFTER", align="left", dot=True, top=panel_h + BADGE_MARGIN)

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
