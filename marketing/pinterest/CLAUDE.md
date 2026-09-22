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
  `after` / a labeled vertical before-after `collage` per pair — before on top / after on bottom (1000×1500,
  2:3, the photo area), each cover-cropped to fill its half (see `pipeline.py`'s `cover_crop`); badges match
  the app's `BeforeAfterSlider` styling (see `draw_badge`). An opaque accent-colored CTA band ("Redesign your
  room" + a drawn downward chevron — no unicode arrow glyph, since the Docker fallback font may lack it) is
  appended below the after panel rather than overlaid on it, growing the canvas to 1000×1630 — still well
  inside Pinterest's supported aspect range (up to ~1:2.1) so it won't get cropped in feed. Bottom placement
  is deliberate: Pinterest's save/"···" UI occupies the top-right corner on both grid and closeup view, and
  the arrow doubles as a pointer toward the title/description Pinterest renders directly below the pin image.
  See `draw_cta_band`/`CTA_BAND_HEIGHT` in `pipeline.py`. Tracks used photo ids in `output/used_photos.json`
  so reruns don't repeat a before photo.
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
     builds the collage, sends it for approval. Title/description are **not** generated at this stage — only
     after Approve, so a Reject never pays for a text-generation call that just gets discarded (see
     "Title/description generation" below). Approve uploads before/after/collage to R2, then generates the
     copy and replies with the link plus title/description. Reject regenerates the same candidate with a
     different style.
  **The chat is kept clean of everything except approved collages**: a stage-1 candidate photo is deleted
  the moment it's approved or rejected (it's throwaway either way — the real result is the stage-2 collage),
  and a rejected stage-2 collage is deleted right before its regenerated replacement is sent. An approved
  collage is left in place (buttons stripped) as the permanent record — see `delete_message()` and
  `handle_decision()` in `bot.py`. Deletion only works within Telegram's 48h window, a non-issue since
  decisions happen live, and it's not retroactive (candidate photos sent before this was added stay in
  history).
  Sleeps until the next scheduled run once `BATCH_SIZE` pins are saved. State persists to SQLite
  (`bot_state.db`, gitignored, one JSON blob — see `state.py`) after every step, including in-flight
  OpenRouter results (base64 in the blob), so a restart (Railway redeploy, crash) resumes mid-batch instead
  of losing progress or re-paying for a generation that already succeeded — see `post_init()` in `bot.py`.
  Config: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` in `.env` (steps to get them are in `.env.example`); the
  bot ignores any chat other than `TELEGRAM_CHAT_ID`. **Fully tested end-to-end locally** (real Telegram bot,
  real R2 bucket): candidate approve, candidate reject-and-replace, collage approve, collage reject-and-
  regenerate, and a full 3-pin batch completion all verified working in one live run.
  Chat commands: `/status` (stage/slot/next-run-time), `/run` (start a batch immediately, ignoring the
  schedule — replies with a warning instead of double-starting if one's already in progress), `/prefs`
  (see below).
- **Self-learning candidate picking.** Every stage-1 candidate approve/reject is logged to a `decisions`
  table in `bot_state.db` (`state.log_decision`/`load_decisions`) with the photo's Pexels search query and
  alt text — the only two content-descriptive fields Pexels gives us (no "full room shot" tag exists), so
  they're the proxy for whatever Anton is actually reacting to (e.g. full-room real-estate-style shots vs.
  tighter/simpler lifestyle crops). `pipeline.build_preference_model()` turns the log into Laplace-smoothed
  approval rates per query and per alt-text word; `score_photo`/`weighted_choice` sample future candidates
  proportional to `exp(score)` instead of uniformly (`pipeline.pick_one`'s `model=` param) — a soft bias, not
  a filter: a clamp (`PREF_SCORE_CLAMP`) keeps even historically-rejected-leaning photos pickable sometimes,
  so the pool never fully starves and a bad early signal isn't permanent. `/prefs` in Telegram shows the
  current approval rate and the top/bottom queries and alt-text words by evidence. No history yet -> `model`
  is `None` -> falls back to the original uniform `random.choice`. Only stage-1 (which before-photo)
  learns this way; stage-2 (which `DesignStyle`) is still uniform random — not asked for, and style
  preference is a separate signal from photo/framing preference.
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
- **Title/description generation is done** (`pipeline.generate_copy`, called from `bot.py`'s
  `upload_and_reply()`, only after Anton approves a collage) — alt-text generation and the Pinterest
  publisher/landing pages below are still not built.

## Title/description generation

- `pipeline.generate_copy(env, room_label, style_label, link)` calls a separate, cheap OpenRouter **text**
  model (`OPENROUTER_TEXT_MODEL`, default `pipeline.DEFAULT_TEXT_MODEL` = `google/gemini-2.5-flash-lite` —
  chosen for cost: a few thousandths of a cent per pin at this volume — not `OPENROUTER_MODEL`, which is the
  image-editing model) via `/chat/completions`, prompted for a title (<=100 chars) and a description
  (300-500 chars) structured as: opening CTA sentence -> 1-2 sentences describing the specific
  before/after -> closing CTA sentence. The model is told to end the closing CTA with a literal `{LINK}`
  token rather than writing a URL itself; `generate_copy` swaps that token for the real link afterwards, so
  the UTM URL is always exactly right regardless of what the model does with text. Response is parsed with a
  `TITLE: ...\nDESCRIPTION: ...` regex (not JSON — more robust across models); both fields are hard-clipped
  to their length limits as a safety net.
- `pipeline.utm_link(date, slot_num)` builds the link: `https://sundera.app/?utm_source=pinterest&utm_medium=social&utm_content=<date>-<slot_num>`
  (date = the batch's `YYYY-MM-DD`, slot_num = 1-based position in the batch) — built in code, never by the model.
- In `bot.py`, copy is generated **only after Anton approves the collage**, inside `upload_and_reply()` —
  not alongside the collage in `generate_and_send()`. Reasoning: a rejected collage never had copy generated
  for it, so rejects (which swap in a different style and regenerate the image anyway) don't also burn a
  wasted text-generation call. The title/description are sent as part of the final "Saved" confirmation
  message (which already includes the R2 link) rather than as a separate message before the decision —
  there's no longer a "review copy alongside the image before deciding" step, by design.
- Not yet done: alt-text generation (Pinterest API field, separate from title/description).

## Suggested next steps (posting automation — later, not now)

1. ~~Pipeline script: choose photo + style, call generation, save results.~~ done (`generate_pairs.py`).
2. ~~Collage builder.~~ done (Pillow, in `generate_pairs.py`).
3. ~~Telegram bot with approve/reject.~~ done (`bot.py`, SQLite state) — **note: this is review-approval only,
   it doesn't publish to Pinterest.**
4. ~~Title/description generation.~~ done (`pipeline.generate_copy`, see above). Alt-text generation still
   not built.
5. Pin queue and scheduler for spreading publishes over the day (today's `bot.py` already spreads
   *generation* over the day via the approval flow, but nothing publishes to Pinterest yet).
6. Pinterest OAuth + publisher (start with Trial/sandbox, then apply for Standard) — publish will need
   alt-text too, and should reuse the title/description already generated per pin rather than regenerating.
7. Landing pages per style with UTM tracking (UTM params are already generated per pin via `pipeline.utm_link`,
   pointing at `sundera.app/` — swap in real per-style landing page paths here once they exist).

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
