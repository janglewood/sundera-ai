#!/usr/bin/env python3
"""Classify scraped photos (currently: the Kufar pack, see kufar_collect.py) with a local
Ollama vision model — replaces the "review by hand, delete bad ones" step with an automated
pass: not a room -> delete; a room -> sort into photos/clean/ or photos/watermark/ depending
on whether Kufar's logo is still visible after kufar_collect.py's inpainting attempt, and
tagged with which room it is (same categories pipeline.ROOM_LABELS/generate_pairs.py/bot.py
already use — Pexels filled this via per-query search terms; Kufar listings mix every room in
one untagged gallery, so this is where it gets filled in instead).

Local/free by design (Ollama, no API cost) — matches the project's "free where possible"
approach to this pipeline (see kufar_collect.py, watermark inpainting).

Per-photo cost on this machine (Apple M4, qwen3-vl:8b, confirmed 100% GPU via `ollama ps`):
~15s, dominated by a ~8-9s fixed vision-encoding cost that doesn't shrink with a smaller
input image or a "no thinking" request — that's just the GPU cost of running an 8B vision
model here. At that rate 1,421 photos would take ~6 hours serially, so this is meant to be
run in bounded batches via --limit, resumable across runs (see "classified" marker below).

Usage:
    ./.venv/bin/python classify_photos.py --limit 100        # process the next 100 unclassified
    ./.venv/bin/python classify_photos.py --limit 100 --dry-run   # print decisions, change nothing

Idempotent/resumable: each manifest entry gets "classified": true once processed, so reruns
only pick up entries that haven't been classified yet — safe to run in repeated --limit
batches instead of one multi-hour run. `classify_batch(limit=None)` is the programmatic entry
point (refill_pool.py imports this directly rather than shelling out); `main()` is a thin CLI
wrapper around it.
"""
import argparse
import base64
import json
import os
import re
import sys
import time

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS_DIR = os.path.join(HERE, "photos")
MANIFEST_PATH = os.path.join(PHOTOS_DIR, "manifest.json")
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen3-vl:8b"

# Mirrors pipeline.ROOM_LABELS' keys — keep in sync if a room type is added/renamed there.
ROOM_TYPES = (
    "living_room", "bedroom", "kitchen", "bathroom",
    "dining_room", "home_office", "kids_room", "entryway",
)

PROMPT = (
    'Is this photo taken inside a home room (kitchen/bedroom/living room/bathroom/hallway/'
    'entryway/dining room/home office)? Answer false for floor plans, scanned documents/'
    'contracts, building exteriors, yards/gardens, staircases-only, or photos of people. '
    'If it is a room, which one is it — pick exactly one of: '
    + ", ".join(ROOM_TYPES) + '. '
    'Does the photo have a visible small logo/text watermark overlay anywhere on it '
    '(e.g. a site logo or icon stamped in a corner)? '
    'Answer with ONLY JSON, no other text: '
    '{"is_room": true/false, "room_type": "<one of the categories above, or null if not a room>", '
    '"has_watermark": true/false}'
)

JSON_RE = re.compile(r"\{.*\}", re.S)


def load_manifest():
    if not os.path.exists(MANIFEST_PATH):
        sys.exit(f"No manifest at {MANIFEST_PATH}")
    with open(MANIFEST_PATH) as f:
        return json.load(f)


def save_manifest(manifest):
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


def classify(path):
    with open(path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    resp = requests.post(OLLAMA_URL, json={
        "model": MODEL,
        "messages": [{"role": "user", "content": PROMPT, "images": [img_b64]}],
        "stream": False,
    }, timeout=120)
    resp.raise_for_status()
    content = resp.json()["message"]["content"]
    m = JSON_RE.search(content)
    if not m:
        raise ValueError(f"no JSON in model response: {content!r}")
    result = json.loads(m.group(0))
    if "is_room" not in result or "has_watermark" not in result:
        raise ValueError(f"missing keys in model response: {result!r}")
    room_type = result.get("room_type")
    if room_type not in ROOM_TYPES:
        room_type = None  # model declined/hallucinated a category — soft signal, don't fail the whole photo
    return bool(result["is_room"]), room_type, bool(result["has_watermark"])


def classify_batch(limit=100, dry_run=False):
    """Programmatic entry point — refill_pool.py calls this directly (limit=None processes
    every unclassified kept photo in one go) instead of shelling out to this CLI."""
    manifest = load_manifest()
    candidates = [
        m for m in manifest
        if m.get("status") == "kept"
        and not m.get("classified")
        and os.path.exists(os.path.join(PHOTOS_DIR, m["file"]))
    ]
    batch = candidates if limit is None else candidates[:limit]
    print(f"{len(candidates)} unclassified kept photos, processing {len(batch)}")

    counts = {"not_room": 0, "clean": 0, "watermark": 0, "error": 0}
    for i, entry in enumerate(batch, 1):
        rel_path = entry["file"]
        abs_path = os.path.join(PHOTOS_DIR, rel_path)
        t0 = time.time()
        try:
            is_room, room_type, has_watermark = classify(abs_path)
        except Exception as e:
            print(f"[{i}/{len(batch)}] {rel_path}: ERROR {e}", file=sys.stderr)
            counts["error"] += 1
            continue
        elapsed = time.time() - t0

        if not is_room:
            action = "not_room -> delete"
            counts["not_room"] += 1
            if not dry_run:
                os.remove(abs_path)
                entry["status"] = "removed"
                entry["classified"] = True
        else:
            subdir = "watermark" if has_watermark else "clean"
            action = f"room ({room_type}) -> {subdir}"
            counts[subdir] += 1
            if not dry_run:
                dest_dir = os.path.join(PHOTOS_DIR, subdir)
                os.makedirs(dest_dir, exist_ok=True)
                new_rel = f"{subdir}/{os.path.basename(rel_path)}"
                os.rename(abs_path, os.path.join(PHOTOS_DIR, new_rel))
                entry["file"] = new_rel
                entry["room_type"] = room_type
                entry["has_watermark"] = has_watermark
                entry["classified"] = True

        print(f"[{i}/{len(batch)}] {rel_path}: {action} ({elapsed:.1f}s)")
        if not dry_run and i % 10 == 0:
            save_manifest(manifest)

    if not dry_run:
        save_manifest(manifest)
    print(f"Done: {counts}, {len(candidates) - len(batch)} still unclassified")
    return counts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=100)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    classify_batch(limit=args.limit, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
