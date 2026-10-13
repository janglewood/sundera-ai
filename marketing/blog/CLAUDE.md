# Sundera: blog content pipeline (marketing/blog)

Parent project context: see the repo root `CLAUDE.md` and `docs/` (Sundera = AI interior
redesign app). Sibling pipeline: `marketing/pinterest/` — this one reuses that pipeline's
output rather than duplicating generation.

## Goal

Turn before/after collages already produced (and Anton-approved) for the Pinterest
pipeline into blog articles on sundera.app/blog, at roughly 2-3/day, with Anton approving
each one in Telegram — same generate → approve → publish shape as the Pinterest bot, but
simpler: no photo scraping, no browser automation, no local-only dependencies.

1. Scan R2 for Pinterest collages (`pinterest/` prefix, read-only) not yet turned into an
   article (dedup checked against `apps/api`'s `BlogPost.sourceImageKey`, via
   `GET /blog-posts/source-keys`).
2. Crop off the Pinterest-only CTA band (the blog article has its own CTA).
3. Ask an OpenRouter text model for structured article copy (title, dek, problems,
   palette, materials, lighting, price table, FAQ) — see `pipeline.generate_article`.
4. Send Anton the cropped image + title/dek in Telegram with Publish/Skip buttons.
5. On approve: upload the image to a public R2 bucket, `POST /blog-posts` to `apps/api`.
   `apps/api` decides *when* the post actually goes live (a randomized slot, see
   `BlogPostsService.create` / `BlogPostsPublishWorkerService` in that codebase) — this
   bot's only job is content approval, not scheduling.

## Decisions already made (do not revisit without asking)

- **Fully decoupled from `marketing/pinterest/`'s own process and state.** This bot never
  reads `marketing/pinterest/bot_state.db` (local SQLite, only exists on Anton's Mac,
  unreachable from a Railway container) — it discovers candidates by listing R2 directly
  (`storage.list_source_collages`) and asks `apps/api` what's already used. The two bots
  can run independently, on different machines, without talking to each other.
- **Content lives in `apps/api`'s Postgres (`BlogPost` table), not a file in this repo.**
  Unlike the Pinterest pipeline (which publishes to Pinterest's own site, external to
  sundera.app), blog articles are rendered by `apps/web` itself — they have to be
  queryable at runtime, not baked into a build.
- **Two separate R2 buckets, never one.** `R2_SOURCE_BUCKET` (the Pinterest pack's
  bucket, read-only here) and `R2_PUBLIC_BUCKET` (a new bucket, public-read, dedicated to
  blog images) must never be the same bucket, and neither may ever be `apps/api`'s
  `S3_BUCKET` — those all hold private user room photos and generation results that must
  never become publicly readable. See `.env.example`.
- **Scheduling (when a post goes live) lives in `apps/api`, not here.** This bot only
  decides content is good; `apps/api`'s cron worker decides timing. This means the publish
  schedule survives this bot being offline/redeployed.
- **Stateless — no SQLite, no Railway volume.** The only state is "which candidate is
  currently awaiting Anton's Telegram response", kept in memory and lost on a restart —
  an accepted gap (same class as a few documented in the Pinterest pack), not a bug to fix
  with persistence. A restart just means re-proposing a candidate on the next `/run` or
  scheduled check.
- **Room-type filter.** Pinterest photos are bucketed by
  `marketing/pinterest/pipeline.py`'s `ROOM_LABELS`, which includes `dining_room` and
  `entryway` — rooms `@sundera/shared`'s `RoomType` doesn't have. `pipeline.parse_source_key`
  silently skips those; a "how to do this in Sundera" article can't send someone to pick a
  room type that doesn't exist in the product.
- **Text model: `anthropic/claude-haiku-4.5` via OpenRouter, not Gemini.** Chosen
  2026-10-13 after a real head-to-head (same prompt, real OpenRouter calls) against
  `google/gemini-2.5-flash-lite` (the Pinterest pack's default) and
  `google/gemini-2.5-flash`: noticeably more specific, less generic-filler prose —
  directly relevant since GEO/AI-answer-engine citability (the actual goal of this blog)
  depends on content being distinctive, not formulaic. Cost difference is irrelevant at
  this volume (~$0.004/article on Haiku vs ~$0.0003-0.0017 on the Gemini options — a few
  cents/month either way at 2-3 articles/day). **Known quirk, already handled, not a
  reason to revisit:** Haiku wraps its JSON in markdown fences despite
  `response_format: json_object` being set — `pipeline._strip_code_fence` strips it before
  `json.loads`, verified working against the real API.
- **Runs on Railway, not locally.** Unlike the Pinterest bot (local-only: depends on
  Ollama + rapid-mlx for photo classification/watermark cleanup), this bot has no such
  dependency — plain Python, no browser automation, no local models. Cloud hosting is a
  clean fit; confirmed `apps/web`'s own `Dockerfile` already has Railway-specific build
  comments, so the main app is already on Railway and this becomes a third service in the
  same project.

## Current state

- `storage.py`, `pipeline.py`, `api_client.py`, `bot.py` — all written and smoke-tested
  locally: `parse_source_key`/`build_slug`/`crop_collage` verified against a real
  Pinterest-pipeline collage file; `pipeline.generate_article` verified against the real
  OpenRouter API (real JSON response, matched the expected schema); a full simulated
  approve round-trip (generate → build payload → `POST /blog-posts`) verified against a
  locally running `apps/api` — real `201`, real scheduled time, real dedup `409` on a
  repeat `sourceImageKey`. **Not yet verified: an actual Telegram approval round-trip**
  (needs the real bot token + chat id from the manual setup step below), and **not yet
  deployed to Railway**.

## Manual setup still needed before this can run for real

1. **Cloudflare**: create the public R2 bucket (`R2_PUBLIC_BUCKET` above) and get its
   public URL (dev `.r2.dev` URL or a custom domain). Set
   `NEXT_PUBLIC_BLOG_IMAGE_HOST` (hostname only) in `apps/web`'s env to the same host —
   `next/image` throws on an unconfigured external host.
2. **Telegram**: new bot via `@BotFather`, same steps as
   `marketing/pinterest/CLAUDE.md` documents for that bot.
3. **apps/api**: set `BLOG_BOT_API_SECRET` (shared with this bot's `.env`),
   `BLOG_POSTS_PER_DAY`/`BLOG_PUBLISH_WINDOW_START`/`BLOG_PUBLISH_WINDOW_END` if the
   defaults (3/day, 09:00-21:00 UTC) aren't right, and run the `add_blog_post` migration.
4. **Railway**: new service in the existing project. Root directory `marketing/blog`
   (Railway finds `Dockerfile` automatically). Env vars from `.env.example`. Background
   worker — long-polls Telegram, no HTTP port to expose, no Health Check Path needed, no
   volume needed (stateless, see above).

## Housekeeping

- Secrets (Telegram, R2, OpenRouter, the blog-bot shared secret) only in env files, never
  committed, never pasted into chat — same rule as `marketing/pinterest/CLAUDE.md`'s
  Housekeeping section, which has already seen two real leaks (a Pexels key, and the
  Telegram bot token via `httpx`'s request logging — see that file). This bot's own
  `httpx` logger is pre-emptively raised to WARNING in `bot.py` for the same reason.
- `marketing/blog/.env` and `.venv/` are gitignored.
