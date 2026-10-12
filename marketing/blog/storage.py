"""R2 (S3-compatible) storage for the blog pipeline.

Two distinct buckets, deliberately never the same one:
  - R2_SOURCE_BUCKET: the Pinterest pack's bucket (marketing/pinterest/storage_r2.py),
    read-only here, under its existing "pinterest/" prefix. Never written to.
  - R2_PUBLIC_BUCKET: a separate, public-read bucket for blog images. Must never be the
    same bucket as above or as apps/api's S3_BUCKET — both of those also hold private
    user room photos and generation results, which must never become public.
"""
import boto3
from botocore.config import Config

SOURCE_PREFIX = "pinterest/"


def client(endpoint, access_key, secret_key):
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name="auto",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
    )


def list_source_collages(s3, bucket):
    """Yields every "*_collage.*" key under the Pinterest pack's prefix — one per
    Anton-approved pin (see marketing/pinterest/bot.py's upload_and_reply)."""
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=SOURCE_PREFIX):
        for obj in page.get("Contents", []):
            if "_collage." in obj["Key"]:
                yield obj["Key"]


def download(s3, bucket, key):
    return s3.get_object(Bucket=bucket, Key=key)["Body"].read()


def upload_public(s3, bucket, base_url, key, body, content_type):
    s3.put_object(Bucket=bucket, Key=key, Body=body, ContentType=content_type)
    return f"{base_url.rstrip('/')}/{key}"
