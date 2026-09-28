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
- **Photo source: Kufar (`re.kufar.by`), not Pexels — `bot.py`'s daily flow draws from
  `photos/clean/` on disk.** Originally Pexels-only (license allows modification/commercial
  use; Unsplash forbids compiling photos for a competing service, a grey area for a redesign
  app) — reversed 2026-09-25: Pexels photos read as too staged/professional for a real
  before/after story. `pexels_collect.py` still works standalone (manual, no longer wired
  into `bot.py`) if ever needed again. See "Current state" below for the full
  scrape → classify → clean pipeline (`kufar_collect.py` / `classify_photos.py` /
  `flux_clean.py` / `refill_pool.py`) that replaced it.
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
- **`kufar_collect.py` works — Kufar photo pack, manual-only, alternative to Pexels** (see the "Photo source"
  note above): `./.venv/bin/python kufar_collect.py --total 100` scrapes real apartment-listing photos from
  `re.kufar.by` (Belarusian classifieds) into the same `photos/manifest.json`, so `generate_pairs.py` needs no
  changes to use either source. `--total` counts listings ("posts"), not photos — every photo from every
  scraped listing is kept (no per-listing cap, confirmed with Anton), averaging ~12 photos/listing (range
  1–27), so `--total 100` yields ~1,000+ raw photos. `room_type` is always `null` — Kufar listings mix every
  room of an apartment in one gallery with no per-photo label, unlike Pexels' per-query room type, so
  classification is a separate pass, see `classify_photos.py` below (reuses `pexels_collect.py`'s exact
  `load_manifest`/`save_manifest` "hand-deleted file → never re-downloaded" logic either way). Expect a lot of
  non-room junk in the raw pull (building facades, floor plans, scanned documents). Every photo also gets
  Kufar's watermark (small translucent logo, fixed bottom-right
  corner on every photo regardless of content) removed via a **fixed-box `cv2.inpaint`, best-effort, free/
  local** — not a per-image detector and not a paid model call; it cannot recover what was truly behind the
  translucent logo, it just makes the corner look plausible instead of showing the logo. Needs
  `opencv-python-headless` + `numpy` in the venv (not in `requirements.txt`/`Dockerfile` — those back `bot.py`'s
  deployed container, which doesn't use this script, so it's kept out to avoid bloating/risking that image).
  **Known, deliberate caveat — do not revisit without asking:** `re.kufar.by/robots.txt` disallows any URL
  with a query string for all bots (`Disallow: *?*`), which covers the `cursor=` pagination this script uses
  to get past the first ~30 listings. Confirmed with Anton this is accepted for this small-scale personal
  prototype; see the script's own docstring for the full reasoning.
- **`classify_photos.py` works — local/free vision QA for the Kufar pack**, via Ollama
  (`ollama pull qwen3-vl:8b`, must be running locally: `ollama serve`, or just have the
  Ollama.app menu-bar app running — that's what keeps it up on this machine). For each
  unclassified `kept` manifest entry, one Ollama call asks: is this actually a room; if so
  which room (same categories as `pipeline.ROOM_LABELS` — fills in `room_type`, previously
  always `null` for this pack since Kufar listings mix every room in one untagged gallery,
  unlike Pexels' per-query room type); does it still have a visible watermark. Not a room →
  **delete immediately** (confirmed with Anton, no reversible "rejected/" staging — matches
  the original hand-review workflow's behavior, just automated). A room → moved to
  `photos/clean/` or `photos/watermark/` (manifest `file` gains the subfolder prefix,
  `pipeline.py` needs no changes since it just does `os.path.join(PHOTOS_DIR, m["file"])`).
  The `watermark/` bucket also catches sellers'/agencies' own logo banners, not just Kufar's
  platform watermark (confirmed in testing: `kufar_collect.py`'s inpainting only targets
  Kufar's own fixed-position logo, not arbitrary third-party ones) — see `flux_clean.py`
  below for how those get cleaned up. Each entry gets `"classified": true` once processed, so
  reruns only pick up what's left. `classify_batch(limit=100)` is the programmatic entry
  point (`refill_pool.py` calls it with `limit=None` to process everything unclassified in
  one go); `main()`/`--limit`/`--dry-run` is a thin CLI wrapper around it for manual runs.
  **Slow: ~9-25s/photo on this machine** (Apple M4, confirmed 100% GPU via `ollama ps`) —
  dominated by a fixed ~8-9s vision-encoding cost that doesn't shrink with a smaller input
  image; a full ~1,400-photo pack is several hours serially. `--dry-run` prints decisions
  without touching files/manifest. Tested at 100-photo scale (2026-09-25, before the
  room_type addition): 61 deleted, 21 clean, 18 watermark, 0 errors, spot-checked accurate on
  the retained buckets.
- **`flux_clean.py` — local/free watermark cleanup via `rapid-mlx` serving `flux2-klein-4b`**
  (`pip install 'rapid-mlx[image]'`, already in `.venv`; https://github.com/raullenchai/Rapid-MLX,
  legitimate, 3.8k stars — verified before installing). Confirmed this session, side-by-side,
  that its `/v1/images/edits` endpoint removes Kufar's watermark (and third-party agency
  logos) noticeably more cleanly than `kufar_collect.py`'s `cv2.inpaint` fixed-box approach —
  no visible blur smudge, the reconstructed area looks plausible. Cost: **~110s/photo** on
  this machine vs `cv2.inpaint`'s <1s, and it resizes the image slightly (e.g. 920x690 ->
  912x688, not exact passthrough) — too slow to replace `cv2.inpaint` as the first pass over
  every photo, so it's used as a second pass only on whatever `classify_photos.py` still
  flags as watermarked. `ensure_server()`/`stop_server()` manage the `rapid-mlx serve`
  subprocess lifecycle (auto-started if not already running, stopped after use to free the
  ~6GB resident model). **Do not suggest FLUX for the actual redesign generation step**
  (`pipeline.edit_image`, OpenRouter/Nano Banana) — tested head-to-head this session and
  Nano Banana won clearly (faster, preserved window/structural details more faithfully;
  FLUX took ~3.4 min/image and altered some structural details it shouldn't have).
- **`refill_pool.py` — orchestrates the full refill**: scrape more Kufar listings →
  `classify_photos.classify_batch(limit=None)` → `flux_clean` whatever's left in
  `photos/watermark/` → `photos/clean/` is the finished pool. Runnable standalone
  (`./.venv/bin/python refill_pool.py`) or called by `bot.py`'s nightly confirm flow (see
  below). **Gotcha this script works around:** `kufar_collect.collect()`'s `total` argument
  means "distinct listings ever collected" (tracked via the manifest), not "how many new ones
  to fetch this run" — calling it with a fixed 100 does nothing once 100 are already scraped.
  `refill_pool.py` always computes `current_distinct_listings + 100` as the target.
- `generate_pairs.py` works: `./.venv/bin/python generate_pairs.py --count 5` (venv has Pillow + requests +
  boto3 + opencv-python-headless + numpy; `.venv/bin/pip install Pillow requests boto3 opencv-python-headless
  numpy` if recreating it). Config: copy `.env.example` to
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
  process (not a cron job) with **two independent daily schedules**:
  1. **`SCHEDULE_TIME`/`SCHEDULE_UTC_OFFSET` (`.env`, default 11:00 UTC+3)**: the original two-stage,
     strictly-one-at-a-time approval flow for `BATCH_SIZE` (default 3) pins, now drawing candidates from
     `photos/clean/` (`pipeline.load_manifest(source_dir="clean")`) instead of Pexels:
     - **Candidates**: sends an unused before-photo; Approve/Reject (inline button or typed "approve"/"reject").
       Reject **deletes the photo immediately** (`pipeline.remove_photo` — never shown again, see below) and
       swaps in a different photo for the same slot. Repeats until `BATCH_SIZE` are approved.
     - **Generation**: for each approved candidate in order, picks a random `DesignStyle`, calls OpenRouter,
       builds the collage, sends it for approval. Approve uploads before/after/collage to R2 under `pinterest/`
       and **then also deletes the local source photo** (now redundant, archived above) and replies with the
       link. Reject regenerates the *same* candidate with a different style (source photo not deleted).
  2. **`REFILL_CHECK_TIME` (`.env`, default 21:30)**: a separate check, independent of stage 1's progress —
     if `photos/clean/` has fewer than `REFILL_THRESHOLD` (default 20) photos left, asks in Telegram
     (`refill_yes`/`refill_no` — deliberately distinct callback data from the candidate/generation
     `approve`/`reject` buttons, so `on_callback`/`on_text` can route unambiguously) whether to run
     `refill_pool.run()`. Only starts on explicit yes; runs via `asyncio.to_thread` (it's synchronous and can
     take several hours — scrape is fast, but classifying ~1,000+ photos via Ollama and FLUX-cleaning the
     watermarked subset both take hours even at 100-post scale) so the bot stays responsive to Telegram
     throughout; progress messages bridge back via `asyncio.run_coroutine_threadsafe`. `state.py`'s
     `refill_stage`/`last_refill_check_date` track this — deliberately preserved across the `dict(DEFAULT_STATE)`
     resets in `start_new_cycle()`/`post_init()`'s day-rollover branch (those are for stage-1 state only).
  State persists to SQLite (`bot_state.db`, gitignored, one JSON blob — see `state.py`) after every step,
  including in-flight OpenRouter results (base64 in the blob), so a restart resumes mid-batch instead of
  losing progress or re-paying for a generation that already succeeded — see `post_init()` in `bot.py`.
  Config: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` in `.env` (steps to get them are in `.env.example`); the
  bot ignores any chat other than `TELEGRAM_CHAT_ID`. **Stage 1 fully tested end-to-end locally** (real
  Telegram bot, real R2 bucket) before this session's photo-source change: candidate approve, candidate
  reject-and-replace, collage approve, collage reject-and-regenerate, and a full 3-pin batch completion all
  verified working in one live run — **re-verify after the `photos/clean/` switch and delete-on-use logic**,
  not yet re-tested end-to-end as of 2026-09-25.
  Chat commands: `/status` (stage/slot/next-run-time, plus `photos/clean/` count and `refill_stage`); `/run` or
  `/run_generation` (aliases — start a candidate/generation batch immediately, ignoring `SCHEDULE_TIME`;
  warns instead of double-starting if one's already in progress); `/run_parse` (start `refill_pool.run()`
  immediately, ignoring `REFILL_CHECK_TIME`/`REFILL_THRESHOLD` and skipping the yes/no prompt — typing the
  command is the confirmation; independent of the other schedule, so it can run alongside an in-progress
  batch; warns instead of double-starting if a refill is already `awaiting_confirmation`/`running`).
- **This process runs locally on this Mac now, not deployed to Railway** — `refill_pool.py`'s classification
  (Ollama) and watermark-cleanup (rapid-mlx/FLUX) steps only exist locally; a Railway container can't reach
  `localhost:11434`/`localhost:8123` here. `photos/` is a persistent local directory now, not an ephemeral
  per-boot fetch — the old "fetched from Pexels at runtime, container filesystem can be fully ephemeral"
  design no longer applies. The "Deploying (Docker + Railway)" section below is stale as of 2026-09-25, kept
  only in case of a future revert to a Pexels-only, Railway-deployed setup.
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

## Deploying (Docker + Railway) — STALE as of 2026-09-25, not currently used

`bot.py` now runs locally on this Mac only (see "Current state" above — it depends on local
Ollama + rapid-mlx, which Railway can't reach). Kept below only in case of a future revert to
a Pexels-only, Railway-deployed setup; don't follow this to deploy the current Kufar-based
`bot.py` as-is, it would fail (no local Ollama/rapid-mlx there, and it doesn't need
`PEXELS_API_KEY`/`PHOTO_POOL_SIZE` anymore — see the updated `.env.example`).

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
