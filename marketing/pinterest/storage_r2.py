"""Cloudflare R2 (S3-compatible) storage for marketing pipeline output.

Same account/bucket the app uses in prod (see apps/api/src/storage/storage.service.ts
and the S3_* env vars in .env.example), under a "pinterest/" prefix — kept private
(no public bucket policy), accessed via presigned GET URLs, same pattern as the app.

Config comes from marketing/pinterest/.env (gitignored) — see .env.example in this
folder for the required keys.
"""
import os

import boto3
from botocore.config import Config

import pipeline

REQUIRED_KEYS = (
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
)

# R2 presigned URLs are SigV4, capped at 7 days (604800s) regardless of who signs them.
PRESIGN_EXPIRES_SECONDS = 6 * 24 * 3600
PREFIX = "pinterest"


def load_env():
    env = pipeline.read_env_file(pipeline.LOCAL_ENV_PATH)
    for key in REQUIRED_KEYS:
        env[key] = os.environ.get(key, env.get(key, ""))
    missing = [k for k in REQUIRED_KEYS if not env[k]]
    if missing:
        raise SystemExit(
            f"Missing {', '.join(missing)} for R2 storage "
            f"(checked {pipeline.LOCAL_ENV_PATH} and the environment — see .env.example)"
        )
    return env


def client(env):
    return boto3.client(
        "s3",
        endpoint_url=env["R2_ENDPOINT"],
        region_name="auto",
        aws_access_key_id=env["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
    )


def upload(s3, env, key, body, content_type):
    full_key = f"{PREFIX}/{key}"
    s3.put_object(Bucket=env["R2_BUCKET"], Key=full_key, Body=body, ContentType=content_type)
    return full_key


def presigned_url(s3, env, full_key, expires_in=PRESIGN_EXPIRES_SECONDS):
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": env["R2_BUCKET"], "Key": full_key},
        ExpiresIn=expires_in,
    )


def list_batch_keys(s3, env, batch_id):
    resp = s3.list_objects_v2(Bucket=env["R2_BUCKET"], Prefix=f"{PREFIX}/{batch_id}/")
    return [obj["Key"] for obj in resp.get("Contents", [])]
