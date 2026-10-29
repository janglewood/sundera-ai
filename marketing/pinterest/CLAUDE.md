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

- **2026-10-08: reversed — publishing is now via Playwright browser automation, not the official
  API.** The original decision (quoted below, kept for history) was dropped because Standard API
  access has a days-to-weeks review lead time and Anton wants this working now, not after that
  review lands. Confirmed explicitly: Anton's own personal account, capped at a few posts/day
  (PUBLISH_TIMES_PER_DAY, default 3) at randomized times within a window — not mass automation, not
  someone else's account. Ban risk to the account is accepted, not eliminated — see
  `pinterest_publish.py`. The original API-based reasoning, kept for context on why this was the
  starting position:
  > Publish only via the official Pinterest API. No Playwright / computer-use / browser automation:
  > Pinterest ToS forbids automated access without permission and bans risk losing the brand account.
  > API access: Trial access creates pins visible only to the creator. Public pins need Standard
  > access: demo video of the OAuth flow plus a real API call, accessible privacy policy, review
  > takes days to ~4 weeks.
- **Phase 0 (until Standard access, if ever revisited):** the bot delivers ready-to-post pins and
  Anton posts them manually (Pinterest's own scheduler is fine). This is now superseded by the
  Playwright flow below for the default path, but still works as a fallback — nothing was removed
  from the approval flow, publishing was only added on top of it.
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
  **2026-10-08: `pinterest_publish.py` briefly auto-enabled the create-pin page's own "mark as
  AI-modified" disclosure toggle, reading this bullet as an instruction to self-disclose — reversed
  same day on explicit request. This bullet is about Pinterest's own automatic "Gen AI" labeling of
  content it detects, not an instruction to proactively flip that toggle; don't re-add it without
  asking.**

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
  **2026-09-30 fix:** `fetch_page`/`download_bytes` only retried on HTTP 429 — a bare `requests.get()`
  network exception (SSL handshake failure, DNS, connection reset) had no retry at all and killed the whole
  `collect()` call outright. Confirmed in production: a single `SSLEOFError` while fetching a listing page —
  right after this Mac woke from sleep mid-`/run_parse`, when the network stack was still settling — aborted
  a scrape that had already hit its target. Both functions now also retry (short backoff, same `retries`
  budget) on `requests.exceptions.RequestException` generally, not just 429.
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
  `apps/api/src/generations/generation-worker.service.ts` — kept in sync, both reworded 2026-09-28, see that
  file's comment) with a random `DesignStyle`, and writes `before` / `after` / a labeled before-after
  `collage` per pair — **vertical, Pinterest format**: `COLLAGE_WIDTH`x`COLLAGE_HEIGHT` (1000x1500, 2:3)
  photo area, before on top / after on bottom, each `cover_crop`-ped to fill its half, BEFORE/AFTER badges
  matching the app's `BeforeAfterSlider` (see `draw_badge`), plus an opaque orange `CTA_BAND_HEIGHT`-tall
  ("Redesign your room" + arrow) band appended below — final canvas 1000x1630, see `draw_cta_band`/
  `make_collage_bytes` in `pipeline.py`. Tracks used photo ids in `output/used_photos.json` so reruns don't
  repeat a before photo.
  **2026-09-28: this vertical/CTA collage was restored after being found missing** — it turned out to exist
  already, just on an unmerged branch (`feat/marketing-automatio-tool`, 6 commits touching
  `pipeline.py`/`bot.py`/`state.py`, diverged from this branch before this session's Kufar-pipeline work and
  never merged). Only the collage/CTA pieces were hand-ported at the time (confirmed with Anton — a full
  merge was explicitly declined for now).
  **2026-09-29: title/description copy generation hand-ported too** (commit `7b0f336`,
  "FEAT: copy generation") — `pipeline.generate_copy(env, room_label, style_label)` calls a separate,
  cheap OpenRouter **text** model (`OPENROUTER_TEXT_MODEL`, default `pipeline.DEFAULT_TEXT_MODEL` =
  `google/gemini-2.5-flash-lite`, not `OPENROUTER_MODEL` which is the image-editing model) via
  `/chat/completions`, prompted for a title (<=100 chars) and a description (300-500 chars) structured as:
  opening CTA sentence -> 1-2 sentences describing the specific before/after. `pipeline.utm_link(date,
  slot_num)` builds the UTM link: `https://sundera.app/?utm_source=pinterest&utm_medium=social&utm_content=
  <date>-<slot_num>`.
  **2026-10-09: removed the link from the description copy entirely** — it used to end with a closing CTA
  sentence containing a literal `{LINK}` token that `generate_copy` swapped for the real URL, so the link
  appeared both in the description text and in the pin's separate link field. Anton asked for the link to
  live only in the link field, not duplicated in the description. The model is no longer asked for that
  closing CTA/token at all; `generate_copy` no longer takes a `link` argument since it no longer needs one
  (the link field itself is still built by `utm_link` and set separately, unchanged, in `bot.py`'s
  `upload_and_reply()`/`publish_queue` item and by `pinterest_publish.py`'s `#WebsiteField`).
  **2026-10-07: moved to post-approval only** — `generate_and_send()` used to call this right after building
  the collage (before Anton had even seen it), wasting a text-model call whenever the collage got rejected.
  It now runs inside `upload_and_reply()`, triggered only from `handle_decision()`'s approved branch — so
  copy is generated once, right before the "Saved ..." message that reports it, and never for a rejected
  collage. There is no longer a separate pre-approval "Title: ...\n\n..." Telegram message, and
  `post_init`'s restart-resume path for stage `"generating"` no longer re-sends one either (nothing to
  resume — copy isn't generated until approval, which hasn't happened yet for a pending item).
  **Still not ported from that branch**: a self-learning candidate-picking model
  (`build_preference_model`/`score_photo`/`weighted_choice`, needs a `decisions` log in `state.py` this
  branch doesn't have) and an image-resolution fix. Check `git log feat/marketing-automatio-tool --
  marketing/pinterest/` before assuming either still needs building from scratch.
  **2026-10-07: Telegram message cleanup done (built fresh, not ported)** — `delete_message()` is a
  best-effort `bot.delete_message` wrapper called from `handle_style_choice`/`handle_reject_photo` (deletes
  the candidate photo once a style is picked or swapped) and `handle_decision` (deletes the collage-review
  message on both approve and reject-to-regenerate). The chat now only accumulates each slot's final
  "Saved ..." message (before/after/collage R2 links + title/description) — every intermediate
  candidate-photo, "Generating…" status, and collage-review message is removed once acted on, instead of
  piling up. Known gap: on a mid-batch restart, `post_init`'s resend path doesn't delete whatever message was
  left over from before the crash (it just sends a fresh one) — a rare, cosmetic edge case, not fixed here.
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
  1. **`SCHEDULE_TIME`/`SCHEDULE_UTC_OFFSET` (`.env`, default 11:00 UTC+3)**: strictly-one-slot-at-a-time
     approval flow for `BATCH_SIZE` (default 3) pins, drawing candidates from `photos/clean/`
     (`pipeline.load_manifest(source_dir="clean")`) instead of Pexels:
     - **Candidate**: sends an unused before-photo with an inline button per `DesignStyle` (`style_keyboard()`,
       callback_data `style:<KEY>`) plus a "🔁 Different photo" button (callback_data `reject_photo`).
       **2026-10-07: style is now picked by Anton, not randomly** — tapping a style button
       (`handle_style_choice`) immediately starts generation with that exact style; the old flow collected all
       `BATCH_SIZE` candidate approvals first and only then generated each with a random style. "Different
       photo" (`handle_reject_photo`) **deletes the photo immediately** (`pipeline.remove_photo` — never shown
       again, see below) and swaps in a different candidate for the same slot — typed "reject"/"no" still
       works for this; typed "approve" no longer does anything at this stage (a style must be tapped).
     - **Generation**: calls OpenRouter with the chosen style, builds the collage, sends it for Approve/Reject
       (`handle_decision`, inline button or typed "approve"/"reject", unchanged). Approve uploads
       before/after/collage to R2 under `pinterest/` and **then also deletes the local source photo** (now
       redundant, archived above), replies with the link, and shows the next slot's candidate. Reject
       regenerates the *same* candidate with a different **randomly chosen** style (source photo not deleted) —
       this one path still picks randomly, deliberately not re-prompting for a style on every regenerate.
       A style chosen (by tap or random-regenerate) is locked into `state.current["style"]` and survives a
       mid-generation restart (`post_init`'s `pending_generation` resume path reuses it instead of re-rolling).
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
  batch; warns instead of double-starting if a refill is already `awaiting_confirmation`/`running`);
  **`/run_classify`** (2026-09-30 — `classify_photos.classify_batch(limit=None)` on its own, skipping the
  scrape and FLUX-clean phases of a full `/run_parse` — e.g. after a manual scrape or a `photos/` root full
  of unclassified leftovers you just want sorted into `clean/`/`watermark/` without also re-scraping or
  FLUX-cleaning. No per-photo progress message (`classify_batch` has no `notify` hook, unlike
  `refill_pool.run`/`clean_watermark_backlog` — it's the slow, no-phase-boundary part), just a "starting" and
  a final counts message.); **`/run_clean`** (2026-09-29 — `refill_pool.clean_watermark_backlog()`, the
  FLUX-clean-and-move-to-`clean/` phase of `run()` pulled out standalone so it's runnable without a full
  scrape+classify pass, e.g. after manually clearing stale unclassified files out of `photos/` root and just
  wanting to drain whatever's already sitting in `photos/watermark/`). All three admin commands
  (`/run_parse`/`/run_classify`/`/run_clean`) share the same `refill_stage` gate — they touch the same
  `photos/`/`manifest.json` and (for parse/clean) the same FLUX server, so only one runs at a time.
  `/start` re-sends the persistent button menu, see below.
  **All commands are also available as persistent chat buttons**, not just typed slash commands —
  `main_menu_keyboard()` sends a `ReplyKeyboardMarkup` (button text is the literal command, e.g. `/status`,
  so tapping it is routed by the same `CommandHandler`s as typing it) on `/start` and attached to every
  `/status` reply; `post_init` also registers all commands via `set_my_commands` for the client's own "/"
  menu. Both are independent, client-side UI — surviving bot restarts without any bot-side state.
- **This process runs locally on this Mac now, not deployed to Railway** — `refill_pool.py`'s classification
  (Ollama) and watermark-cleanup (rapid-mlx/FLUX) steps only exist locally; a Railway container can't reach
  `localhost:11434`/`localhost:8123` here. `photos/` is a persistent local directory now, not an ephemeral
  per-boot fetch — the old "fetched from Pexels at runtime, container filesystem can be fully ephemeral"
  design no longer applies. The "Deploying (Docker + Railway)" section below is stale as of 2026-09-25, kept
  only in case of a future revert to a Pexels-only, Railway-deployed setup.
  **2026-10-09: a VPS-cloud split (and separately, a local Docker container) were explored and dropped** —
  Pinterest publishing has to stay on a trusted IP (Anton's home network, matching `pinterest_session.json`'s
  origin; a VPS's datacenter IP is a red flag to Pinterest's anti-fraud systems, and a proxy was considered
  and rejected), which meant the Mac would still need to wake up regularly for publishing anyway — so moving
  only the Telegram/approval flow to a VPS wasn't buying much. Docker was dropped too: this machine's Docker
  Desktop is 20.10.8, the same version already blamed below for a failed local `apt-get`-based build, and
  `playwright install --with-deps chromium` needs another one. **Decision: everything stays on this Mac,
  supervised by `launchd` instead of a manually-run terminal** — see "Running via launchd" below, which
  replaces manually running `./.venv/bin/python bot.py`.
  **Same session: fixed a backlog-dump bug in `pick_publish_times`** — restarting the bot partway through the
  day (e.g. after being down since before today's publish schedule was computed) used to still scatter
  `PUBLISH_TIMES_PER_DAY` times across the *full* configured window, including times already in the past;
  those were immediately "due" the moment `publish_scheduler_loop` next checked, firing several queued pins
  within the same ~120s tick right at startup instead of spread through the day. Now clamped to
  `max(configured start, now)` — a fresh day still gets the full window, a restart only schedules what's left
  of today's window (or nothing further today if the window's already fully elapsed, resuming normally
  tomorrow).
- **Title/description generation is done** (`pipeline.generate_copy`, called from `bot.py`'s
  `upload_and_reply()` only after Anton approves the collage — see the 2026-10-07 note above) — alt-text
  generation and landing pages are still not built, see "Suggested next steps" below.
- **2026-10-08: Pinterest publishing is done — `pinterest_publish.py`, Playwright browser automation
  (see the decision reversal above for why not the API).** Entry points:
  - `login_interactive()` (`./.venv/bin/python pinterest_publish.py login`) — **must be run by hand once**
    before anything can actually publish. Opens a real, visible Chromium window; Anton logs into
    Pinterest himself, then the session (cookies) is saved to `pinterest_session.json` (gitignored —
    it's equivalent to a login credential, never commit it). `bot.py` never sees or handles Pinterest
    credentials — this step is deliberately kept outside the bot process.
    **Doesn't work if the Pinterest account only has "Continue with Google"** (which `sundera1ai`
    does) — confirmed 2026-10-08: Google outright refuses sign-in from a Playwright/CDP-controlled
    Chromium ("This browser or app may not be secure"), a deliberate anti-automation measure on
    Google's side, headed or not, not something to try to route around.
  - **`import_cookies()`** (`pinterest_publish.py import-cookies --file <export.json>`) — the
    workaround for the Google-OAuth case above. Anton logs into Pinterest normally in a real,
    non-automated browser (Chrome + the Cookie-Editor extension), exports that tab's cookies as
    JSON, and this converts Cookie-Editor's export schema into the same `storage_state.json` shape
    `login_interactive()` would have produced — filters to `pinterest.com`-domain cookies only (in
    case the export was "all cookies" rather than scoped to the tab), maps `sameSite` values
    (`no_restriction`/`unspecified`/`lax`/`strict` → Playwright's `None`/`Lax`/`Lax`/`Strict`), and
    treat session cookies (or any missing `expirationDate`) as `expires: -1`. Then does the same
    logged-in sanity check as `login_interactive()` (navigate to the home feed, warn if redirected to
    `/login`) unless `--no-verify`. The raw cookie-export JSON file itself is as sensitive as the
    session it produces — delete it after converting, same handling as any other credential per
    Housekeeping below.
  - A `pinterest_publish.py test --image ... --title ... --description ... --link ... --board ...
    --headed` CLI exists for manually verifying/fixing selectors against the live site before
    trusting the scheduled path (see the next bullet on selector risk) — works the same regardless of
    which of the two methods above produced the session.
  - `publish_pin(image_path, title, description, link, board_name=None, headless=True)` — loads the
    saved session, opens the Pinterest create-pin page, uploads the image via a raw `input[type=file]`
    (works even hidden, more stable across redesigns than clicking a visible dropzone), fills
    title/description/link, clicks Publish. **`board_name` is optional — the `sundera1ai` account has no boards set up (confirmed 2026-10-08,
    screenshot showed only "Created"/"Saved" tabs, no Boards tab), so by default the board-picker step
    is skipped entirely and the pin lands directly on the profile.** If a board is ever created, pass
    its exact visible name and the picker step runs (click `[data-test-id="board-dropdown-select-button"]`
    → click matching text).
    **Field selectors were originally placeholder-text regexes and were wrong — fixed and verified live
    2026-10-08.** The account's Pinterest UI renders in Russian (account language setting), so
    English-text placeholder matching failed outright (`fill_title` timed out — see the debug
    screenshot/HTML dump that caught it). The actual DOM was inspected via `_debug_dump`'s HTML dump
    (added that session) and it turned out `pin-creation-tool/` lands on Pinterest's "storyboard"
    creation surface, whose `id`/`data-test-id` attributes stay in English regardless of display
    language — switched to those instead of visible text, which is the durable fix (don't go back to
    placeholder-text matching for this page):
    - title: `#storyboard-selector-title`
    - description: `[data-test-id="storyboard-description-field-container"] [contenteditable="true"]`
      (a Draft.js rich-text editor, not a plain textarea — `.fill()` works on it via Playwright's
      contenteditable handling)
    - link: `#WebsiteField`
      (an "AI-disclosure toggle" step, `[data-test-id="ai-disclosure-switch"] input[type="checkbox"]`,
      was briefly added here then removed same day on explicit request — see the "Gen AI" bullet above)
    - board picker trigger: `[data-test-id="board-dropdown-select-button"]`
    - publish button: `[data-test-id="storyboard-creation-nav-done"] button`
    On any step failure `publish_pin` raises `PublishError` and `_debug_dump` saves both a full-page
    screenshot **and the page's HTML** to `output/pinterest_debug/` (gitignored, covered by the
    existing `marketing/pinterest/output` ignore) — the HTML dump is what made finding the real
    selectors above possible; keep it if debugging a future break.
    **2026-10-08, second bug found after the one above: the Publish button stays disabled while the
    last-filled field (`#WebsiteField`) still has focus.** Chased several wrong hypotheses first
    (headless vs. headed, near-duplicate drafts triggering spam detection, an account-wide Pinterest
    bot-restriction after the first successful publish — ruled all three out by testing fresh content
    headed/headless and by Anton confirming the same draft was publishable from his own normal,
    non-automated browser) before Anton noticed directly: click outside the input and the button lights
    up immediately. Fixed with a `blur_last_field` step — `page.locator("#WebsiteField").press("Tab")`
    — right after `fill_link` and before `click_publish`. This, not any of the discarded hypotheses, was
    the actual root cause of every post-first-pin failure that day.
    **Mistake made while debugging this, for the record: an agent-written cleanup script meant to
    delete duplicate test drafts had a matching bug and deleted ALL drafts, including "Modern Kitchen
    Redesign" — a real pre-existing draft of Anton's, not agent-created.** Should have asked before
    running any bulk-delete against the live account; didn't. Confirmed acceptable to Anton after the
    fact (unpublished draft, no public content lost) but noted here as a standing reminder: get explicit
    confirmation before any destructive/bulk action against the real Pinterest account, even ones that
    look obviously safe (e.g. "obviously this is just test junk").
    **Verified end-to-end 2026-10-08**: a real `test --headed` run against live Pinterest published
    an actual pin to `sundera1ai` (title "Minimalist Living Room Redesign Inspiration", confirmed
    visible on the profile). That specific queue item was manually removed from `publish_queue`
    afterward since the `test` CLI publishes directly and doesn't touch the queue — leaving it in
    would have caused the scheduler to publish it a second time (duplicate-pin spam risk, see the
    existing decision above). **A run that fails after `upload_image` but before `click_publish`
    leaves an empty/partial draft sitting in Pinterest's own Drafts sidebar** (Pinterest autosaves
    as you type) — cosmetic, doesn't affect the public profile, but worth an occasional manual
    cleanup in Pinterest's UI since nothing here deletes those.
    **2026-10-29: root cause found for repeated "Uh oh! Access Denied" failures on
    `upload_image`** — `do_publish` in `bot.py` called `publish_pin()` without a `headless`
    arg, defaulting to `headless=True`. Confirmed by direct A/B on this machine, same
    session/network: 3/3 headless runs hit Pinterest's Access Denied block page, 2/2 headed
    (`test --headed`) runs published cleanly. A VPN/residential-proxy theory was chased first
    (a prior day's failure really was VPN-related) but turned out to be a red herring for
    *this* failure — fixing the VPN route and retrying through the bot still failed, because
    the bot always runs headless regardless of network path. Pinterest is almost certainly
    fingerprinting headless Chromium (`navigator.webdriver` etc.), not blocking by IP, for
    this specific symptom. **Fix: `do_publish` now calls `publish_pin(..., headless=False)`**
    — every real publish pops a visible Chromium window on this Mac. Accepted tradeoff for a
    background daemon (confirmed with Anton) since headless is simply blocked outright; if
    this machine is ever left headless/no-GUI-session, publishing will need a different
    workaround (e.g. a virtual display) since `headless=False` requires a real display.
  - **Wired into `bot.py`:** `upload_and_reply()` now writes the already-generated collage to
    `output/to_publish/<stem>_<date>.jpg` and appends `{id, image_path, title, description, link, board,
    added_at}` to `state.py`'s `publish_queue` instead of publishing immediately (unchanged: the
    "Saved ..." Telegram message with R2 links still happens the same as before — publishing happens on
    top of that, not instead of it). A third independent scheduler, `publish_scheduler_loop` (same
    pattern as `scheduler_loop`/`refill_scheduler_loop` — runs regardless of the other two's state),
    picks `PUBLISH_TIMES_PER_DAY` (default 3) **randomized** times/day within
    `[PUBLISH_WINDOW_START, PUBLISH_WINDOW_END)` (default 09:00-21:00, bot's configured timezone) —
    randomized rather than evenly spaced so posting doesn't look mechanically regular.
    **2026-10-08: added a second, mandatory approval gate before any real Pinterest publish — explicit
    request, "publish only after I clicked approve."** At each due slot (or on `/run_publish`, or on a
    bot restart that finds one pending), the scheduler no longer calls `publish_pin` directly — it pops
    the queue head and calls `send_publish_approval`, which sends the image + title/description to
    Telegram with its own Publish/Discard buttons (`publish_decision_keyboard`, distinct `callback_data`
    from the collage-review `approve`/`reject` so the two can't collide) and stores the item +
    `message_id` in `state.py`'s `pending_publish`. **`do_publish` (the function that actually calls
    `pinterest_publish.publish_pin` via `asyncio.to_thread`) is now only ever invoked from
    `handle_publish_decision`'s approved branch — no code path calls it unattended.** Discard deletes the
    local image file and drops the item for good (no requeue — "no" means no, not "ask me again later");
    on success/failure `do_publish`'s existing behavior is unchanged (delete local file + Telegram
    confirmation on success; requeue to the front + alert on failure, so a failed publish gets a *fresh*
    approval prompt at the next due slot rather than silently retrying). Only one `pending_publish` is
    in flight at a time — `publish_scheduler_loop` waits for it to resolve before prompting about the
    next queued item, same "one thing at a time" pattern as the main candidate/generation flow. Typed
    "approve"/"reject" deliberately does **not** route to a pending publish decision (buttons only) —
    that shortcut is already overloaded for refill-confirmation and collage-review, and a real Pinterest
    publish is the one decision in this bot that shouldn't be fat-fingerable via a stray "yes". Also
    fixed while adding this: the restart-resume branch for a dropped/stale candidate batch used to reset
    to `dict(state.DEFAULT_STATE)` preserving only `refill_stage`/`last_refill_check_date` — would have
    silently wiped `publish_queue`/`pending_publish` too; now preserves every publish-related field.
    `/run_publish` (chat command + persistent button) now asks for approval on the queue head
    immediately, ignoring the schedule — it does **not** publish by itself either, same gate.
    `/status` reports queue length, today's used/total publish slots, configured board name (or "none
    (posts straight to profile)" if `PINTEREST_BOARD_NAME` is empty), and now also whether a publish
    decision is currently awaiting Anton's response.
  - **Not yet tested through the actual queue/scheduler path** (only via the standalone `test` CLI, see
    above) — `/run_publish` or the first scheduled `publish_scheduler_loop` slot is still the first real
    test of that path specifically (do_publish's success/failure handling, Telegram alerting, etc.).
  - **`requirements.txt` now includes `playwright`** (needed at `bot.py` import time, not just for a
    side script) — this makes the already-stale "Deploying (Docker + Railway)" section below even less
    applicable than before: a minimal container also needs `playwright install chromium` plus system
    libraries (libnss3, libatk-bridge2.0, etc.) that a bare Dockerfile won't have. Not addressed here
    since that deploy path is unused (`bot.py` runs locally only, per the existing 2026-09-25 note).

## Suggested next steps

1. ~~Pipeline script: choose photo + style, call generation, save results.~~ done (`generate_pairs.py`).
2. ~~Collage builder.~~ done (Pillow, in `generate_pairs.py`).
3. ~~Telegram bot with approve/reject.~~ done (`bot.py`, SQLite state).
4. ~~Title/description generation.~~ done (`pipeline.generate_copy`, see above). Alt-text generation still
   not built (Pinterest's alt-text field isn't filled by `pinterest_publish.py` yet).
5. ~~Pin queue and scheduler for spreading publishes over the day.~~ done (`publish_queue` in `state.py`,
   `publish_scheduler_loop` in `bot.py`).
6. ~~Pinterest publisher.~~ done via Playwright (`pinterest_publish.py`), not the API — see the 2026-10-08
   decision reversal above. **Needs the one-time manual `login` step + a live `test --headed` run before
   it's actually proven working, not just wired up.**
7. Landing pages per style with UTM tracking (UTM params are already generated per pin via `pipeline.utm_link`,
   pointing at `sundera.app/` — swap in real per-style landing page paths here once they exist).

## Running via launchd (2026-10-09 — current, replaces manually running `bot.py`)

`bot.py` is supervised by a macOS `launchd` agent instead of being started by hand in a
terminal, so it survives both a crash and a reboot without Anton needing to remember to
restart it. Source of truth for the agent definition lives in-repo at
`marketing/pinterest/launchd/com.sundera.pinterest-bot.plist` (hardcodes this machine's
absolute paths — personal deploy config, not portable, not meant to be).

- **Install/start**: symlink it into `~/Library/LaunchAgents/` and load it:
  ```
  ln -sf "$(pwd)/marketing/pinterest/launchd/com.sundera.pinterest-bot.plist" \
      ~/Library/LaunchAgents/com.sundera.pinterest-bot.plist
  launchctl load ~/Library/LaunchAgents/com.sundera.pinterest-bot.plist
  ```
  (Symlink, not a copy — editing the plist in-repo and reloading picks up the change without
  re-copying.)
- **Stop/uninstall**: `launchctl unload ~/Library/LaunchAgents/com.sundera.pinterest-bot.plist`
  (stops it and prevents the reboot/`RunAtLoad` auto-start; delete the symlink too to fully
  remove it).
- **Restart after an edit to `bot.py`/`.env`**: unload then load again (there's no "restart"
  verb in older `launchctl`) — or `launchctl kickstart -k gui/$(id -u)/com.sundera.pinterest-bot`
  on newer macOS.
- **Logs**: `marketing/pinterest/output/launchd/bot.out.log` /`bot.err.log` (stdout/stderr,
  gitignored — same `output/` ignore as everything else there). `launchctl list | grep sundera`
  shows whether it's currently loaded and its last exit code.
- **Why `launchd` and not Docker**: same crash/reboot-restart guarantee (`KeepAlive` +
  `RunAtLoad`), but zero build risk (this machine's Docker Desktop is a version already known
  to fail `apt-get`-based builds, which `playwright install --with-deps chromium` would need)
  and zero bind-mount bookkeeping — it's exactly today's `./.venv/bin/python bot.py`, just
  supervised. `KeepAlive=true` restarts `bot.py` on *any* exit (crash, unhandled exception, a
  Telegram `getUpdates` conflict from two instances briefly overlapping, etc.), not just a
  non-zero exit code; `ThrottleInterval` (30s) keeps a persistent failure (e.g. a broken `.env`)
  from spinning in a tight restart loop.
- **Only one `bot.py` should ever run at a time** — Telegram's long-polling (`getUpdates`)
  doesn't tolerate two pollers on the same bot token, and two processes would also race on
  `bot_state.db`. Before loading the `launchd` agent, make sure no manually-started
  `./.venv/bin/python bot.py` is still running (`ps aux | grep bot.py`).

## Deploying (Docker + Railway) — STALE as of 2026-09-25, not currently used, superseded by
## the VPS exploration above (also dropped) and now by launchd

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
  **2026-10-09: the Telegram bot token leaked into an agent chat too** — an agent tailed
  `output/launchd/bot.out.log`/`bot.err.log` while verifying the new `launchd` setup started cleanly,
  and `python-telegram-bot`'s own HTTP request logging includes the full bot token in every logged URL
  (`POST https://api.telegram.org/bot<TOKEN>/getMe`, etc.) — not something pasted carelessly, just a
  consequence of those log files containing the token by default. Rotate via @BotFather if not already
  done since; when checking these logs in the future, grep for a specific line/event rather than
  tailing/catting the whole file, or redact the token from the output before it's displayed.
- `marketing/pinterest/photos/`, `.env`, `.venv/`, `output/`, `bot_state.db` are all gitignored (see root
  `.gitignore`) — done, not just "consider."
