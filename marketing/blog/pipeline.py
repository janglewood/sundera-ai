"""Shared helpers for the Sundera blog pipeline (bot.py).

Turns a Pinterest before/after collage (marketing/pinterest/) into a blog article: parses
the room/style out of its R2 key, crops off the Pinterest-only CTA band, and asks an
OpenRouter text model for structured article copy.
"""
import io
import json
import os
import re
import sys
import time

import requests
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL_ENV_PATH = os.path.join(HERE, ".env")

# Mirrors packages/shared/src/enums/room-type.enum.ts ROOM_TYPE_LABELS — keep in sync.
ROOM_TYPE_LABELS = {
    "LIVING_ROOM": "Living Room",
    "BEDROOM": "Bedroom",
    "KITCHEN": "Kitchen",
    "BATHROOM": "Bathroom",
    "OFFICE": "Office",
    "KIDS_ROOM": "Kids Room",
}

# Mirrors packages/shared/src/enums/design-style.enum.ts DESIGN_STYLE_LABELS — keep in
# sync (same dict marketing/pinterest/pipeline.py keeps, independently, for the same reason).
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


def slugify(text):
    # Same transform as marketing/pinterest/pipeline.py's slugify — the Pinterest bot's R2
    # key filenames are built with that function, so this one has to match it exactly for
    # parse_source_key's round-trip (slug -> enum key) below to work.
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


# Pinterest's photos are bucketed by marketing/pinterest/pipeline.py's ROOM_LABELS, which is
# broader than @sundera/shared's RoomType (also has dining_room/entryway). Only the rooms
# Sundera's product actually supports are listed — a pin for an unlisted room is skipped by
# parse_source_key below, since a "how to do this in Sundera" article can't send someone to
# pick a room type that doesn't exist in the product.
ROOM_SLUG_TO_TYPE = {
    "living-room": "LIVING_ROOM",
    "bedroom": "BEDROOM",
    "kitchen": "KITCHEN",
    "bathroom": "BATHROOM",
    "home-office": "OFFICE",
    "kids-room": "KIDS_ROOM",
}

STYLE_SLUG_TO_KEY = {slugify(label): key for key, label in DESIGN_STYLE_LABELS.items()}


def parse_source_key(key):
    """R2 key shape (see marketing/pinterest/bot.py's upload_and_reply /
    storage_r2.py's PREFIX): "pinterest/{date}/{idx}_{room-slug}_{style-slug}_collage.{ext}".
    slugify() only ever produces hyphens, never underscores, so splitting the filename on
    "_" is unambiguous: exactly 4 parts regardless of how many hyphens are inside the room
    or style slug. Returns (room_type, style, date_str, idx_str) or None if the key doesn't
    parse or names an unsupported room (dining room / entryway)."""
    segments = key.split("/")
    if len(segments) < 2:
        return None
    date_str, filename = segments[-2], segments[-1]
    stem = filename.rsplit(".", 1)[0]
    parts = stem.split("_")
    if len(parts) != 4:
        return None
    idx_str, room_slug, style_slug, label = parts
    if label != "collage":
        return None
    room_type = ROOM_SLUG_TO_TYPE.get(room_slug)
    style = STYLE_SLUG_TO_KEY.get(style_slug)
    if room_type is None or style is None:
        return None
    return room_type, style, date_str, idx_str


def build_slug(title, date_str, idx_str):
    base = slugify(title)[:80].rstrip("-")
    return f"{base}-{date_str}-{idx_str}"


# The source collage is COLLAGE_WIDTH x (COLLAGE_HEIGHT + CTA_BAND_HEIGHT) — see
# marketing/pinterest/pipeline.py's make_collage_bytes/draw_cta_band. Keeping just the top
# COLLAGE_HEIGHT px drops the "Redesign your room" CTA band, which would be redundant next
# to the blog article's own CTA.
COLLAGE_HEIGHT = 1500


def crop_collage(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    cropped = img.crop((0, 0, img.width, min(COLLAGE_HEIGHT, img.height)))
    out = io.BytesIO()
    cropped.save(out, format="JPEG", quality=90)
    return out.getvalue()


DEFAULT_TEXT_MODEL = "google/gemini-2.5-flash-lite"  # same default as the Pinterest pack's copy generation

ARTICLE_SYSTEM_PROMPT = (
    "You write SEO blog articles for Sundera, an AI interior redesign app: upload a photo "
    "of your room, pick a style, get a photorealistic redesign in seconds. Audience is "
    "homeowners and renters researching redesign ideas, searching things like "
    "'<room> <style> ideas' or '<room> makeover before after'."
)

REQUIRED_ARTICLE_KEYS = (
    "title", "dek", "problems", "palette", "materials", "lighting", "priceTable", "faq",
)


def _strip_code_fence(text):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"```$", "", text).strip()
    return text


def _validate_article(data):
    if not all(key in data for key in REQUIRED_ARTICLE_KEYS):
        raise ValueError("missing required key(s)")
    if not isinstance(data["problems"], list) or not data["problems"]:
        raise ValueError("problems must be a non-empty list")
    if not isinstance(data["priceTable"], list) or not data["priceTable"]:
        raise ValueError("priceTable must be a non-empty list")
    if not isinstance(data["faq"], list) or not data["faq"]:
        raise ValueError("faq must be a non-empty list")


def generate_article(env, room_label, style_label, retries=3):
    """Returns a dict with title/dek/problems/palette/materials/lighting/priceTable/faq —
    matches @sundera/shared's BlogPostDetail content fields, validated by apps/api's
    CreateBlogPostDto on the way in (this is just enough local validation to make the retry
    loop useful, not a full schema check)."""
    user_prompt = (
        f"Write structured content for a blog article about an AI-generated before/after "
        f"redesign of a {room_label.lower()} in {style_label} style. Respond with ONLY a "
        "JSON object (no markdown fences, no commentary) with exactly these keys:\n"
        '  "title": string, <= 150 chars, SEO-friendly, no quotes or emoji\n'
        '  "dek": string, <= 300 chars, one sentence summarizing the transformation\n'
        '  "problems": array of 2-3 short strings — plausible issues with the "before" room\n'
        '  "palette": string, <= 400 chars — 2-3 colors, each with a hex code\n'
        '  "materials": string, <= 400 chars — materials/finishes used in the redesign\n'
        '  "lighting": string, <= 400 chars — lighting and accent details\n'
        '  "priceTable": array of 3-4 objects {"item", "budget", "mid"} — rough USD ranges '
        "for redoing each item in real life (e.g. \"$100 – 200\")\n"
        '  "faq": array of 3 objects {"question", "answer"} answering common reader '
        "questions about this room/style combination\n"
        "Be specific and concrete (plausible colors, materials, prices) as if describing a "
        "real transformation — avoid generic filler."
    )
    body = {
        "model": env["OPENROUTER_TEXT_MODEL"],
        "messages": [
            {"role": "system", "content": ARTICLE_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.8,
        "response_format": {"type": "json_object"},
    }
    last_error = None
    for attempt in range(retries):
        resp = requests.post(
            f"{env['OPENROUTER_BASE_URL']}/chat/completions",
            headers={
                "Authorization": f"Bearer {env['OPENROUTER_API_KEY']}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=60,
        )
        if resp.status_code == 429 and attempt < retries - 1:
            time.sleep(10 * (attempt + 1))
            continue
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"]
        try:
            data = json.loads(_strip_code_fence(text))
            _validate_article(data)
            return data
        except (json.JSONDecodeError, ValueError) as exc:
            last_error = exc
            continue
    raise RuntimeError(f"Could not get a valid article JSON after {retries} attempts: {last_error}")


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
