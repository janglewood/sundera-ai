"""Thin client for apps/api's /blog-posts endpoints — the only way this bot writes
anything, no direct DB access (keeps the write path validated/centralized behind
apps/api, same boundary philosophy as the rest of this project)."""
import requests


def get_used_source_keys(env):
    resp = requests.get(
        f"{env['SUNDERA_API_BASE_URL']}/blog-posts/source-keys",
        headers={"X-Blog-Bot-Secret": env["BLOG_BOT_API_SECRET"]},
        timeout=15,
    )
    resp.raise_for_status()
    return set(resp.json())


def create_blog_post(env, payload):
    """Returns the created {slug, scheduledFor} dict, or None if apps/api already has a
    post for this sourceImageKey (409 — a dedup race with another approval, not an error)."""
    resp = requests.post(
        f"{env['SUNDERA_API_BASE_URL']}/blog-posts",
        headers={
            "X-Blog-Bot-Secret": env["BLOG_BOT_API_SECRET"],
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if resp.status_code == 409:
        return None
    resp.raise_for_status()
    return resp.json()
