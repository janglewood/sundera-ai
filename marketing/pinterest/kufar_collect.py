#!/usr/bin/env python3
"""Collect real room photos scraped from Kufar (re.kufar.by) real-estate listings, as an
alternative "BEFORE" photo source to pexels_collect.py — Pexels photos read as too
staged/professional for a real before/after redesign story; real listing photos don't.

Writes to the same photos/manifest.json shape pexels_collect.py uses, so generate_pairs.py
and bot.py need no changes to consume either source. room_type is intentionally left null
on every entry here — unlike Pexels (queried by room type), Kufar listings mix all rooms of
an apartment in one photo gallery with no per-photo room label, so classification is a
manual pass done later (same "review by hand, delete bad ones" workflow already used for
the Pexels pack).

Deliberate, informed choice (do not revisit without asking): re.kufar.by's robots.txt
disallows any URL containing a query string for all bots ("Disallow: *?*"), which covers
the cursor= pagination this script needs to collect more than one page of listings. The
first page (a clean, query-string-free URL) is robots.txt-compliant on its own; paginating
past it is not. Confirmed with the user this is a small-scale personal prototype and they
want to proceed anyway — see the "Photo source" note in CLAUDE.md.

How it works (reverse-engineered by hand, no public API docs): a Kufar search results page
is Next.js SSR and embeds a <script id="__NEXT_DATA__"> JSON blob containing
props.initialState.listing.ads — the full list of listings on that page, each with every
photo's storage path already included (no need to visit individual listing pages). Each
photo's full URL is https://rms.kufar.by/v1/gallery/{path}. Pagination tokens live in
props.initialState.listing.pagination as {label: "next"/"", token}; the next page is
{clean_url}?cursor={token}.

Kufar stamps every photo with the same translucent "kufar" logo in the same relative
bottom-right corner regardless of content (confirmed on multiple unrelated photos) — so
watermark removal here is a single fixed-box cv2.inpaint per photo, not per-image detection.
Best-effort: it cannot recover whatever was truly behind the translucent logo, it just makes
the corner look plausible instead of showing the logo.

Usage (Python 3.8+; needs requests, Pillow, opencv-python-headless, numpy — see
CLAUDE.md's .venv note, not added to requirements.txt/Dockerfile since bot.py doesn't use
this script):
    ./.venv/bin/python kufar_collect.py --total 100
    ./.venv/bin/python kufar_collect.py --url "<a different kufar search URL>" --total 30

--total counts listings ("posts"), not photos — every photo from every collected listing is
kept (no per-listing cap), so the actual photo count will be several times --total.
"""
import argparse
import io
import json
import os
import re
import sys
import time
import urllib.parse

import numpy as np
import requests
from PIL import Image

try:
    import cv2
except ImportError:
    sys.exit("Missing opencv-python-headless — pip install opencv-python-headless numpy")

HERE = os.path.dirname(os.path.abspath(__file__))

DEFAULT_URL = "https://re.kufar.by/l/minsk/kupit/kvartiru/2k/deshevo"
GALLERY_BASE = "https://rms.kufar.by/v1/gallery/"
UA = "sundera-collector-kufar/1.0 (personal prototype; contact: karatkevich.ant@gmail.com)"

NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S
)

# Fixed relative bottom-right box covering Kufar's watermark logo, as a fraction of
# (width, height) — same on every photo regardless of content, see module docstring.
WATERMARK_BOX = (0.72, 0.85, 1.0, 1.0)  # (x0, y0, x1, y1)


def fetch_page(url, retries=4):
    for attempt in range(retries):
        resp = requests.get(url, headers={"User-Agent": UA}, timeout=30)
        if resp.status_code == 429 and attempt < retries - 1:
            wait = 20 * (attempt + 1)
            print(f"  rate limited, sleeping {wait}s", file=sys.stderr)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.text
    raise RuntimeError("Kufar page request failed after retries: " + url)


def parse_next_data(html):
    m = NEXT_DATA_RE.search(html)
    if not m:
        raise RuntimeError("__NEXT_DATA__ not found on page — Kufar's markup may have changed")
    data = json.loads(m.group(1))
    listing = data["props"]["initialState"]["listing"]
    return listing.get("ads", []), listing.get("pagination", [])


def next_cursor_token(pagination):
    for entry in pagination:
        if entry.get("label") == "next" and entry.get("token"):
            return entry["token"]
    return None


def download_bytes(url, retries=4):
    for attempt in range(retries):
        resp = requests.get(url, headers={"User-Agent": UA}, timeout=60)
        if resp.status_code == 429 and attempt < retries - 1:
            wait = 20 * (attempt + 1)
            print(f"  rate limited, sleeping {wait}s", file=sys.stderr)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.content
    raise RuntimeError("Kufar image download failed after retries: " + url)


def remove_watermark(im):
    """Best-effort: inpaint the fixed bottom-right box every Kufar photo has the logo in."""
    w, h = im.size
    x0, y0, x1, y1 = WATERMARK_BOX
    box = (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
    arr = np.array(im.convert("RGB"))[:, :, ::-1].copy()  # RGB -> BGR for cv2
    mask = np.zeros((h, w), dtype=np.uint8)
    mask[box[1]:box[3], box[0]:box[2]] = 255
    inpainted = cv2.inpaint(arr, mask, inpaintRadius=5, flags=cv2.INPAINT_TELEA)
    return Image.fromarray(inpainted[:, :, ::-1])  # BGR -> RGB


def load_manifest(out_dir):
    """Same shape/behavior as pexels_collect.load_manifest: a file missing from disk (hand
    deleted) is marked "removed" and never re-downloaded; everything else present is "kept"."""
    path = os.path.join(out_dir, "manifest.json")
    manifest = []
    if os.path.exists(path):
        with open(path) as f:
            manifest = json.load(f)
    for m in manifest:
        if m.get("status") == "rejected":
            continue
        if not os.path.exists(os.path.join(out_dir, m["file"])):
            m["status"] = "removed"
        else:
            m["status"] = "kept"
    return manifest


def save_manifest(out_dir, manifest):
    with open(os.path.join(out_dir, "manifest.json"), "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


def collect(url, out_dir, total, max_pages, max_photos):
    os.makedirs(out_dir, exist_ok=True)
    manifest = load_manifest(out_dir)
    seen_photo_ids = {m["id"] for m in manifest}
    seen_ad_ids = {m["listing_id"] for m in manifest if m.get("listing_id") is not None}

    save_manifest(out_dir, manifest)  # persist any status flips from load_manifest even if
                                       # the loop below never runs (target already met)

    clean_url = url.split("?", 1)[0]
    page_url = clean_url
    downloaded = 0
    pages = 0

    while len(seen_ad_ids) < total and pages < max_pages and downloaded < max_photos:
        pages += 1
        print(f"[page {pages}] {page_url}")
        html = fetch_page(page_url)
        ads, pagination = parse_next_data(html)
        if not ads:
            print("  no ads on this page, stopping")
            break

        for ad in ads:
            if len(seen_ad_ids) >= total or downloaded >= max_photos:
                break
            ad_id = ad.get("ad_id")
            if ad_id in seen_ad_ids:
                continue
            images = ad.get("images") or []
            ad_link = ad.get("ad_link", f"https://re.kufar.by/vi/{ad_id}")
            added = 0
            for idx, img in enumerate(images):
                if downloaded >= max_photos:
                    break
                photo_id = f"{ad_id}_{idx}"
                if photo_id in seen_photo_ids:
                    continue
                path = img.get("path")
                if not path:
                    continue
                fname = f"kufar_{ad_id}_{idx}.jpg"
                try:
                    raw = download_bytes(GALLERY_BASE + path)
                    im = Image.open(io.BytesIO(raw))
                    im = remove_watermark(im)
                    im.save(os.path.join(out_dir, fname), "JPEG", quality=92)
                except Exception as e:
                    print(f"  skip {fname}: {e}", file=sys.stderr)
                    continue
                seen_photo_ids.add(photo_id)
                manifest.append({
                    "id": photo_id, "file": fname, "room_type": None,
                    "width": im.width, "height": im.height,
                    "listing_id": ad_id, "listing_url": ad_link, "status": "kept",
                })
                downloaded += 1
                added += 1
                time.sleep(0.4)
            seen_ad_ids.add(ad_id)
            print(f"  listing {ad_id}: +{added} photos ({len(seen_ad_ids)}/{total} listings)")

        save_manifest(out_dir, manifest)

        if len(seen_ad_ids) >= total or downloaded >= max_photos:
            break
        token = next_cursor_token(pagination)
        if not token:
            print("  no next page token, stopping")
            break
        page_url = f"{clean_url}?cursor={urllib.parse.quote(token)}"
        time.sleep(2.0)

    kept = sum(1 for m in manifest if m["status"] == "kept")
    print(f"Listings collected: {len(seen_ad_ids)}, photos kept: {kept}, "
          f"downloaded this run: {downloaded} -> {out_dir}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=DEFAULT_URL, help="Kufar search results URL")
    ap.add_argument("--out", default=os.path.join(HERE, "photos"))
    ap.add_argument("--total", type=int, default=100, help="target number of listings (posts)")
    ap.add_argument("--max-pages", type=int, default=25)
    ap.add_argument("--max-photos", type=int, default=5000)
    args = ap.parse_args()
    collect(args.url, args.out, args.total, args.max_pages, args.max_photos)
