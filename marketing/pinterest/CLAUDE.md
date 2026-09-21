# Sundera: Pinterest content pipeline (marketing/pinterest)

Parent project context: see the repo root `CLAUDE.md` and `docs/` (Sundera = AI interior redesign app).

## Goal

Autonomous system that produces a batch of Pinterest pins per day (`BATCH_SIZE` in `.env`, currently 3)
promoting Sundera, with Anton approving each one in Telegram:

1. Pick an unused "before" room photo from `photos/` (see `manifest.json`).
2. Generate a redesign (random design style) with the existing OpenRouter-based generation service
   (reuse `ImageGenerationProvider` in `apps/api/src/image-generation/`, do not add a second provider).
3. Build a before/after collage (vertical 2:3, e.g. 1000x1500, style label + small logo).
4. Generate title, description and alt text with an LLM (SEO keywords for Pinterest search).
5. Telegram bot sends Anton: before photo, after photo, collage + inline buttons "Publish" / "Reject".
   (Buttons cannot be attached to a media group: send the collage as its own message with the keyboard.)
6. On approve: queue the pin and publish it spread over the day via Pinterest API v5 `POST /v5/pins`
   (board_id, link, title, description, media_source). Link goes to a Sundera landing page for that style with UTM params.

## Decisions already made (do not revisit without asking)

- **Publish only via the official Pinterest API.** No Playwright / computer-use / browser automation:
  Pinterest ToS forbids automated access without permission and bans risk losing the brand account.
- **API access:** Trial access creates pins visible only to the creator. Public pins need **Standard access**:
  demo video of the OAuth flow plus a real API call, accessible privacy policy, review takes days to ~4 weeks.
  Start that application early; it is the longest lead time.
- **Phase 0 (until Standard access):** the bot delivers ready-to-post pins and Anton posts them manually
  (Pinterest's own scheduler is fine). Automatic publishing is added when access is granted.
- **Photo source: Pexels only** (license allows modification/commercial use; Unsplash forbids compiling photos for a
  competing service, which is a grey area for a redesign app). Keep photographer credit from `manifest.json`
  (e.g. "Photo: <name> / Pexels" in the description). Avoid photos with identifiable people.
- **"Before" photos are any real, ordinary room — any condition/style, no "soviet/damaged/unrenovated" bias.**
  (Reversed 2026-09-21 from an earlier "unrenovated/very old rooms only" decision that was here — that bias
  is gone across all room types, not just living room; a magazine-nice room is a perfectly fine "before" now.)
  The only real requirement is that most of the room is visible in frame, not a tight crop of one corner or a
  single piece of furniture — approximated via query wording + an alt-text filter for close-up/detail shots,
  since Pexels has no framing/composition filter. Selection = queries + alt-text filter in `pexels_collect.py`;
  Anton reviews the photos by hand and deletes bad ones (the script never re-downloads a deleted photo).
- Pinterest labels AI content ("Gen AI"); keep the real "before" in the collage, vary titles/descriptions/boards,
  do not post near-duplicate pins (spam risk).

## Current state

- `pexels_collect.py` works: `export PEXELS_API_KEY=...; python3 pexels_collect.py --total 300`.
  `--total` is the target number of kept photos in the folder, not the number of new ones.
- `photos/` + `photos/manifest.json`: downloaded room photos (room_type, photographer, pexels_url, status).
- `generate_pairs.py` works: `./.venv/bin/python generate_pairs.py --count 5` (venv has Pillow + requests +
  boto3, `.venv/bin/pip install Pillow requests boto3` if recreating it). Config: copy `.env.example` to
  `.env` and fill in `OPENROUTER_*` (falls back to `apps/api/.env` if unset) and `R2_*`. Picks unused
  before-photos spread across room types, calls OpenRouter directly (same prompt shape as `buildPrompt()` in
  `apps/api/src/generations/generation-worker.service.ts`) with a random `DesignStyle`, and writes `before` /
  `after` / a labeled horizontal before-after `collage` per pair (labels match the app's `BeforeAfterSlider`
  exactly — see `generate_pairs.py`'s `draw_badge`). Tracks used photo ids in `output/used_photos.json` so
  reruns don't repeat a before photo.
- **Storage: Cloudflare R2** (`storage_r2.py`), same bucket the app uses in prod, under a `pinterest/` prefix
  — private, presigned GET URLs (~6 day expiry; `generate_pairs.py --presign <batch_id>` re-mints fresh ones
  for an older batch). Chosen over local-disk-only so a batch is reviewable without SSHing into wherever this
  runs (a VPS, eventually). Files are also kept in `output/<batch_id>/` (gitignored) as a local scratch copy
  — not the source of truth. `batch.json` per batch records local paths, R2 keys, and the presigned URLs from
  generation time.
- `pipeline.py` holds logic shared between `generate_pairs.py` (manual one-shot CLI) and `bot.py` (the daily
  daemon): env loading, manifest/photo picking, `build_prompt`/`edit_image` (OpenRouter), collage building.
- **`bot.py` — the daily Telegram approval daemon — works**, run with `./.venv/bin/python bot.py`. Long-running
  process (not a cron job): once a day at `SCHEDULE_TIME`/`SCHEDULE_UTC_OFFSET` (`.env`, default 11:00 UTC+3)
  it runs a two-stage, strictly-one-at-a-time approval flow for `BATCH_SIZE` (default 3) pins:
  1. **Candidates**: sends an unused before-photo; Approve/Reject (inline button or typed "approve"/"reject").
     Reject swaps in a different photo for the same slot (never fewer than `BATCH_SIZE` — keeps pulling
     replacements). Repeats until `BATCH_SIZE` are approved.
  2. **Generation**: for each approved candidate in order, picks a random `DesignStyle`, calls OpenRouter,
     builds the collage, sends it for approval. Approve uploads before/after/collage to R2 and replies with
     the link. Reject regenerates the same candidate with a different style.
  Sleeps until the next scheduled run once `BATCH_SIZE` pins are saved. State persists to SQLite
  (`bot_state.db`, gitignored, one JSON blob — see `state.py`) after every step, including in-flight
  OpenRouter results (base64 in the blob), so a restart (Railway redeploy, crash) resumes mid-batch instead
  of losing progress or re-paying for a generation that already succeeded — see `post_init()` in `bot.py`.
  Config: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` in `.env` (steps to get them are in `.env.example`); the
  bot ignores any chat other than `TELEGRAM_CHAT_ID`. **Fully tested end-to-end locally** (real Telegram bot,
  real R2 bucket): candidate approve, candidate reject-and-replace, collage approve, collage reject-and-
  regenerate, and a full 3-pin batch completion all verified working in one live run.
  Chat commands: `/status` (stage/slot/next-run-time), `/run` (start a batch immediately, ignoring the
  schedule — replies with a warning instead of double-starting if one's already in progress).
- **`photos/` is fetched from Pexels at runtime, not committed or baked into the Docker image.**
  `bot.py`'s `refresh_photo_pool()` calls `pexels_collect.collect()` to top `photos/` up to `PHOTO_POOL_SIZE`
  (default 100) — requires `PEXELS_API_KEY` in `.env`. Runs at the start of `start_new_cycle()` (once per
  batch, whether triggered by the schedule or `/run`), **not** in `post_init()` — it takes ~1-2 minutes, and
  awaiting it in `post_init()` blocked `run_polling()` from starting, i.e. made the bot fully unresponsive to
  Telegram (no `/status`, no resuming a pending decision) for that whole time on every single boot. Caught by
  testing `/run` locally: nothing happened for ~90s, then all three queued responses fired at once. This
  sidesteps `photos/` being gitignored (hundreds of MB) mattering at all for deployment: nothing
  needs it to be in git or in the image. Consequence: the container's filesystem can be fully ephemeral —
  a lost `bot_state.db` or `photos/` on redeploy just looks like a fresh boot (self-healing; see `post_init()`
  and the module docstring in `bot.py` for the one edge case — a mid-batch restart where the in-progress
  photo no longer exists after a fresh fetch — and how it degrades gracefully instead of crashing). **No
  Railway Volume is required.**
- Title/description/alt-text generation, Pinterest OAuth + publish, and landing pages are still not built —
  see "Suggested next steps" below.

## Suggested next steps (posting automation — later, not now)

1. ~~Pipeline script: choose photo + style, call generation, save results.~~ done (`generate_pairs.py`).
2. ~~Collage builder.~~ done (Pillow, in `generate_pairs.py`).
3. ~~Telegram bot with approve/reject.~~ done (`bot.py`, SQLite state) — **note: this is review-approval only,
   it doesn't publish to Pinterest.**
4. Title/description/alt-text generation.
5. Pin queue and scheduler for spreading publishes over the day (today's `bot.py` already spreads
   *generation* over the day via the approval flow, but nothing publishes to Pinterest yet).
6. Pinterest OAuth + publisher (start with Trial/sandbox, then apply for Standard).
7. Landing pages per style with UTM tracking.

## Deploying (Docker + Railway)

`Dockerfile` builds `bot.py` as a standalone image — build context is `marketing/pinterest/` itself, not the
repo root (no pnpm workspace dependency, unlike `apps/api/Dockerfile`). No system font package or other
`apt` install (see the "no font install" comment in `Dockerfile` — Pillow's own scalable `load_default(size=)`
covers the collage badges instead; an `apt-get install fonts-dejavu-core` was tried first and dropped after
it kept hitting unrelated environment failures — memory-allocation errors during `dpkg` decompression, thread-
creation errors during `pip install` — on this machine's Docker Desktop, which is a very outdated version
(20.10.8) that likely doesn't fully support this host's macOS/virtualization stack. Local `docker build` was
never actually validated end-to-end here for that reason — **build via Railway's own infra**, not locally:

1. Push this code to GitHub (`marketing/` + `.gitignore`) — Railway builds from the connected repo.
2. Railway dashboard → New Project → Deploy from GitHub repo → select `janglewood/sundera-ai`.
3. Service settings → set **root directory** to `marketing/pinterest` (Railway then finds `Dockerfile`
   relative to that automatically).
4. Add environment variables in the Railway dashboard (never commit real values — same set as
   `marketing/pinterest/.env.example`): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `PEXELS_API_KEY`,
   `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and optionally `SCHEDULE_TIME`/`SCHEDULE_UTC_OFFSET`/`BATCH_SIZE`/
   `PHOTO_POOL_SIZE` if the defaults aren't right.
5. This is a background worker (long-polls Telegram, no HTTP server) — don't set a Health Check Path, and
   there's no port to expose.
6. No volume needed (see "Current state" above on why the ephemeral filesystem is fine here).
7. Deploy. Railway auto-redeploys on every push to the connected branch by default — check that's the
   intended behavior (or pin the branch/disable auto-deploy) once this is past first-test.

## Housekeeping

- Secrets (Pexels, OpenRouter, Telegram, Pinterest, R2) only in env files, never committed, never pasted into
  chat — even when asking an agent to add one to `.env`, put it in the file yourself rather than pasting the
  value. The Pexels key has been pasted into a chat/agent session at least twice now (most recently
  2026-09-21); rotate it if that hasn't happened since the last paste.
- `marketing/pinterest/photos/`, `.env`, `.venv/`, `output/`, `bot_state.db` are all gitignored (see root
  `.gitignore`) — done, not just "consider."
