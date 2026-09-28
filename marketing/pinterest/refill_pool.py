#!/usr/bin/env python3
"""Orchestrates the full pool-refill pipeline: scrape more Kufar listings, classify every
unclassified photo (room? which room? still watermarked?), and clean up whatever's left in
photos/watermark/ with the local FLUX model (see flux_clean.py) — leaving photos/clean/ as
the finished pool bot.py's daily Telegram flow draws from.

Runnable standalone:
    ./.venv/bin/python refill_pool.py

Or imported and called by bot.py's nightly low-pool-confirm flow: run(notify=...), where
notify is a plain sync callable(str) -> None for progress messages at phase boundaries —
scrape done, classify done, FLUX cleanup done. Not per-photo: classifying 1,000+ photos would
flood Telegram with a message every ~15s. Deliberately fully synchronous (no asyncio here) —
bot.py runs this via asyncio.to_thread and bridges notify() back to the event loop itself.

kufar_collect.collect()'s `total` argument means "distinct listings ever collected," tracked
via the manifest, not "how many new ones to fetch this run" — calling it with a fixed 100
would do nothing once 100 listings are already scraped. This script always computes
`current_distinct_listings + SCRAPE_INCREMENT` as the target instead.
"""
import os

import classify_photos
import flux_clean
import kufar_collect
import pipeline

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS_DIR = os.path.join(HERE, "photos")
SCRAPE_INCREMENT = 100


def _say(notify, msg):
    print(msg)
    if notify:
        notify(msg)


def run(notify=None):
    manifest = kufar_collect.load_manifest(PHOTOS_DIR)
    current_listings = len({m["listing_id"] for m in manifest if m.get("listing_id") is not None})
    target = current_listings + SCRAPE_INCREMENT
    _say(notify, f"Refill: scraping up to {target} total listings (currently {current_listings})…")
    kufar_collect.collect(kufar_collect.DEFAULT_URL, PHOTOS_DIR, target, max_pages=25, max_photos=5000)

    _say(notify, "Refill: classifying all unclassified photos (room? which room? watermarked?) — this is the slow part…")
    counts = classify_photos.classify_batch(limit=None)
    _say(notify, f"Refill: classification done — {counts}")

    watermark_dir = os.path.join(PHOTOS_DIR, "watermark")
    files = sorted(os.listdir(watermark_dir)) if os.path.isdir(watermark_dir) else []
    if files:
        _say(notify, f"Refill: cleaning {len(files)} still-watermarked photos with local FLUX (~110s each)…")
        proc = flux_clean.ensure_server()
        try:
            manifest_raw = kufar_collect.load_manifest(PHOTOS_DIR)
            by_file = {m["file"]: m for m in manifest_raw}
            clean_dir = os.path.join(PHOTOS_DIR, "clean")
            os.makedirs(clean_dir, exist_ok=True)
            cleaned, failed = 0, 0
            for i, fname in enumerate(files, 1):
                src = os.path.join(watermark_dir, fname)
                try:
                    cleaned_bytes = flux_clean.clean_watermark(src)
                except Exception as e:
                    print(f"  [{i}/{len(files)}] {fname}: FLUX FAILED: {e}")
                    failed += 1
                    continue
                dest = os.path.join(clean_dir, fname)
                with open(dest, "wb") as f:
                    f.write(cleaned_bytes)
                os.remove(src)
                entry = by_file.get(f"watermark/{fname}")
                if entry:
                    entry["file"] = f"clean/{fname}"
                    entry["has_watermark"] = False
                cleaned += 1
                print(f"  [{i}/{len(files)}] {fname}: cleaned")
            kufar_collect.save_manifest(PHOTOS_DIR, manifest_raw)
            _say(notify, f"Refill: FLUX cleanup done — {cleaned} cleaned, {failed} failed (left in watermark/)")
        finally:
            flux_clean.stop_server(proc)
    else:
        _say(notify, "Refill: nothing left in photos/watermark/ to clean.")

    final_pool = len(pipeline.load_manifest(source_dir="clean"))
    _say(notify, f"Refill done — photos/clean/ now has {final_pool} photos.")


if __name__ == "__main__":
    run()
