#!/usr/bin/env python3
"""Collect real, ordinary room photos from Pexels as "BEFORE" shots for the Sundera Pinterest pipeline —
any real room, any condition/style (not staged as derelict/soviet — see CLAUDE.md, this was reversed from an
earlier "unrenovated/damaged only" bias), as long as most of the room is visible in frame (not a tight
crop of one corner or a single piece of furniture).

Pexels has no framing/composition filter, so "full room visible" is approximated by favoring queries that
tend to return wide interior/real-estate-style photography, plus an alt-text filter that drops photos
showing people, illustrations/renders, or explicit close-up/detail shots.

Usage (Python 3.8+, stdlib only):
    export PEXELS_API_KEY="..."
    python3 pexels_collect.py                # tops up to --total photos

Other options: --total 100, --out <dir>, --max-scan 500 (cap on newly downloaded photos per run).

Deleting a photo by hand is respected: it is treated as removed and will not be downloaded again, and the
run fills the gap with another photo. Manifest: <out>/manifest.json (photographer credit, Pexels URL, query).
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.pexels.com/v1/search"
HERE = os.path.dirname(os.path.abspath(__file__))

ROOMS = {  # room_type -> (share of total, search nouns)
    "living_room": (25, ["living room"]),
    "bedroom": (20, ["bedroom"]),
    "kitchen": (15, ["kitchen"]),
    "dining_room": (10, ["dining room"]),
    "home_office": (10, ["study room", "home office"]),
    "bathroom": (10, ["bathroom"]),
    "kids_room": (5, ["children room", "kids bedroom"]),
    "entryway": (5, ["hallway", "entryway"]),
}

# Aimed at ordinary, real, whole-room photography (real-estate-style listings tend to be wide/full-room
# shots) — no condition/style bias, any real room is fine.
TEMPLATES = [
    "{r} interior",
    "{r} real estate",
    "{r} home",
    "{r} apartment",
]

# Alt-text words that mean "people / illustration / partial crop" -> skip without downloading. No longer
# filters on style/condition words (modern, luxury, renovated, etc.) — any real room is fine, see docstring.
BAD_WORDS = re.compile(
    r"\b(man|men|woman|women|people|person|girl|boy|couple|family|baby|toddler|model|lady|guy|teen|"
    r"portrait|selfie|hand|hands|drawing|illustration|render|sketch|"
    r"close[\s-]?up|closeup|detail)\b",
    re.I,
)


def api_get(url, key, retries=4):
    req = urllib.request.Request(url, headers={"Authorization": key, "User-Agent": "sundera-collector/3.0"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 30 * (attempt + 1)
                print(f"  Pexels rate limit, sleeping {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
            raise
        except urllib.error.URLError:
            time.sleep(3 * (attempt + 1))
    raise RuntimeError("Pexels request failed after retries: " + url)


def download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": "sundera-collector/3.0"})
    with urllib.request.urlopen(req, timeout=60) as r, open(path + ".part", "wb") as f:
        f.write(r.read())
    os.replace(path + ".part", path)


def load_manifest(out_dir):
    path = os.path.join(out_dir, "manifest.json")
    manifest = []
    if os.path.exists(path):
        with open(path) as f:
            manifest = json.load(f)
    for m in manifest:
        # entries written by older versions may carry statuses like accepted/rejected/unchecked
        if m.get("status") == "rejected":
            continue
        if not os.path.exists(os.path.join(out_dir, m["file"])):
            m["status"] = "removed"  # deleted by hand -> never download again, doesn't count to the quota
        else:
            m["status"] = "kept"
    return manifest


def save_manifest(out_dir, manifest):
    with open(os.path.join(out_dir, "manifest.json"), "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


def collect(key, out_dir, total, max_scan):
    os.makedirs(out_dir, exist_ok=True)
    manifest = load_manifest(out_dir)
    seen = {m["id"] for m in manifest}
    scale = total / sum(n for n, _ in ROOMS.values())
    downloaded = 0

    for room, (share, nouns) in ROOMS.items():
        quota = max(1, round(share * scale))
        have = sum(1 for m in manifest if m["room_type"] == room and m["status"] == "kept")
        queries = [t.format(r=n) for t in TEMPLATES for n in nouns]
        print(f"[{room}] have {have}/{quota}")
        page = {q: 1 for q in queries}
        stalled = 0
        while have < quota and stalled < len(queries) * 2 and downloaded < max_scan:
            for q in queries:
                if have >= quota or downloaded >= max_scan:
                    break
                if page[q] > 4:
                    stalled += 1
                    continue
                params = {"query": q, "per_page": 40, "page": page[q], "size": "large"}
                page[q] += 1
                photos = api_get(f"{API}?{urllib.parse.urlencode(params)}", key).get("photos", [])
                added = 0
                for p in photos:
                    if have >= quota or downloaded >= max_scan:
                        break
                    alt = p.get("alt") or ""
                    if p["id"] in seen or BAD_WORDS.search(alt):
                        continue
                    if min(p["width"], p["height"]) < 1200:
                        continue
                    fname = f"{room}_{p['id']}.jpg"
                    download(p["src"]["large2x"], os.path.join(out_dir, fname))
                    downloaded += 1
                    seen.add(p["id"])
                    manifest.append({
                        "id": p["id"], "file": fname, "room_type": room, "query": q,
                        "width": p["width"], "height": p["height"], "alt": alt,
                        "photographer": p["photographer"], "photographer_url": p["photographer_url"],
                        "pexels_url": p["url"], "status": "kept",
                    })
                    have += 1
                    added += 1
                    print(f"  {fname} <- '{q}'")
                    time.sleep(0.15)
                stalled = 0 if added else stalled + 1
                time.sleep(0.4)
            save_manifest(out_dir, manifest)
        save_manifest(out_dir, manifest)
        print(f"[{room}] done: {have}/{quota}")
    kept = sum(1 for m in manifest if m["status"] == "kept")
    print(f"Photos kept: {kept}, downloaded this run: {downloaded} -> {out_dir}")
    if downloaded >= max_scan:
        print("Download cap reached; raise --max-scan and re-run to fill the remaining quota.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "photos"))
    ap.add_argument("--total", type=int, default=100)
    ap.add_argument("--max-scan", type=int, default=500)
    args = ap.parse_args()
    k = os.environ.get("PEXELS_API_KEY")
    if not k:
        sys.exit("Set PEXELS_API_KEY first")
    collect(k, args.out, args.total, args.max_scan)
