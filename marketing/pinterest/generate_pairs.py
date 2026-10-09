#!/usr/bin/env python3
"""Manual one-shot batch generator for the Sundera Pinterest pipeline.

Generates N before/after pairs immediately, no Telegram approval — useful
for local testing/preview. For the real daily flow with Telegram approval,
see bot.py. Shared logic lives in pipeline.py.

Requires: marketing/pinterest/.venv (Pillow + requests + boto3) — see CLAUDE.md.
Config: copy .env.example to .env and fill in OpenRouter + R2 credentials.
    ./.venv/bin/python generate_pairs.py --count 5

Storage: writes to output/<batch_id>/ (gitignored, local scratch copy) AND
uploads before/after/collage to the prod R2 bucket under pinterest/<batch_id>/
(see storage_r2.py) so a batch can be reviewed without SSHing into whatever
box this ran on. batch.json records both the local paths and R2 object keys
+ presigned URLs (valid ~6 days; re-presign with --presign <batch_id> after
that).
"""
import argparse
import json
import os
import random
import sys
from datetime import datetime, timezone

import pipeline
import storage_r2


def presign_batch(batch_id):
    r2_env = storage_r2.load_env()
    s3 = storage_r2.client(r2_env)
    keys = storage_r2.list_batch_keys(s3, r2_env, batch_id)
    if not keys:
        sys.exit(f"No objects found under pinterest/{batch_id}/ in R2")
    for key in sorted(keys):
        print(f"{key}\n  {storage_r2.presigned_url(s3, r2_env, key)}\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=5)
    ap.add_argument("--seed", type=int, default=None, help="random seed, for reproducible picks")
    ap.add_argument("--presign", metavar="BATCH_ID", help="re-print fresh presigned URLs for an existing batch and exit")
    ap.add_argument("--source", metavar="SUBDIR", help="restrict to photos/<SUBDIR>/ (e.g. clean) instead of every kept photo")
    args = ap.parse_args()
    if args.presign:
        presign_batch(args.presign)
        return
    if args.seed is not None:
        random.seed(args.seed)

    env = pipeline.load_api_env()
    r2_env = storage_r2.load_env()
    s3 = storage_r2.client(r2_env)
    manifest = pipeline.load_manifest(source_dir=args.source)
    used_ids = pipeline.load_used()
    picked = pipeline.pick_photos(manifest, used_ids, args.count)
    if len(picked) < args.count:
        print(f"Warning: only {len(picked)}/{args.count} unused photos available", file=sys.stderr)

    batch_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    batch_dir = os.path.join(pipeline.OUTPUT_DIR, batch_id)
    os.makedirs(batch_dir, exist_ok=True)

    results = []
    for idx, photo in enumerate(picked, start=1):
        room_label = pipeline.room_label(photo["room_type"])
        style = random.choice(list(pipeline.DESIGN_STYLE_LABELS.keys()))
        style_label = pipeline.DESIGN_STYLE_LABELS[style]
        prompt = pipeline.build_prompt(room_label, style_label)

        before_path = os.path.join(pipeline.PHOTOS_DIR, photo["file"])
        with open(before_path, "rb") as f:
            before_bytes = f.read()
        mime_type = pipeline.guess_mime(before_path)

        stem = f"{idx:02d}_{pipeline.slugify(room_label)}_{pipeline.slugify(style_label)}"
        print(f"[{idx}/{len(picked)}] {photo['file']} -> {style_label} ...")
        try:
            after_bytes, after_mime = pipeline.edit_image(env, before_bytes, mime_type, prompt)
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)
            continue

        after_ext = pipeline.guess_ext(after_mime)
        before_out = os.path.join(batch_dir, f"{stem}_before.jpg")
        after_out = os.path.join(batch_dir, f"{stem}_after.{after_ext}")
        collage_out = os.path.join(batch_dir, f"{stem}_collage.jpg")

        with open(before_out, "wb") as f:
            f.write(before_bytes)
        with open(after_out, "wb") as f:
            f.write(after_bytes)
        pipeline.make_collage(before_path, after_bytes, collage_out)
        with open(collage_out, "rb") as f:
            collage_bytes = f.read()

        r2_keys = {}
        r2_urls = {}
        for label, body, mime, out_path in (
            ("before", before_bytes, mime_type, before_out),
            ("after", after_bytes, after_mime, after_out),
            ("collage", collage_bytes, "image/jpeg", collage_out),
        ):
            ext = os.path.splitext(out_path)[1].lstrip(".")
            r2_key = storage_r2.upload(s3, r2_env, f"{batch_id}/{stem}_{label}.{ext}", body, mime)
            r2_keys[label] = r2_key
            r2_urls[label] = storage_r2.presigned_url(s3, r2_env, r2_key)

        used_ids.add(photo["id"])
        results.append({
            "photo_id": photo["id"],
            "room_type": photo["room_type"],
            "style": style,
            "prompt": prompt,
            "before": os.path.relpath(before_out, pipeline.HERE),
            "after": os.path.relpath(after_out, pipeline.HERE),
            "collage": os.path.relpath(collage_out, pipeline.HERE),
            "r2_keys": r2_keys,
            "r2_urls": r2_urls,
            "photographer": photo.get("photographer"),
            "pexels_url": photo.get("pexels_url"),
        })
        print(f"  saved {os.path.relpath(collage_out, pipeline.HERE)}")
        print(f"  {r2_urls['collage']}")

    with open(os.path.join(batch_dir, "batch.json"), "w") as f:
        json.dump({"batch_id": batch_id, "results": results}, f, indent=2, ensure_ascii=False)
    pipeline.save_used(used_ids)

    print(f"\nDone: {len(results)}/{len(picked)} pairs -> {os.path.relpath(batch_dir, pipeline.HERE)}")


if __name__ == "__main__":
    main()
