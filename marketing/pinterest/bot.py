#!/usr/bin/env python3
"""Daily Telegram-approval daemon for the Sundera Pinterest pipeline.

Runs forever. Once a day (SCHEDULE_TIME, in a fixed UTC+SCHEDULE_UTC_OFFSET
timezone) it starts a batch of BATCH_SIZE (default 3) pins, in two stages,
strictly one item at a time:

  Stage 1 — candidates: send an unused "before" photo, wait for Approve/
  Reject (inline button or typed "approve"/"reject"). Approve moves to the
  next candidate; reject swaps in a different photo for the same slot.
  Repeat until BATCH_SIZE candidates are approved.

  Stage 2 — generation: for each approved candidate in order, pick a random
  DesignStyle, call OpenRouter, build the before/after collage, send it for
  approval. Approve uploads before/after/collage to R2 (see storage_r2.py)
  and replies with a link. Reject re-generates the same candidate with a
  different style and sends again.

After BATCH_SIZE approved collages, sleeps until the next scheduled run.
Send /run or /run_generation to start a batch immediately instead of
waiting for SCHEDULE_TIME (no-op with a warning if one is already in
progress); /run_parse starts a pool refill immediately instead of waiting
for REFILL_CHECK_TIME, skipping the yes/no prompt (independent of the
other schedule — can run alongside an in-progress batch); /status reports
stage/slot/next-run-time plus the clean-pool count and refill_stage.

Candidates are drawn from photos/clean/ on disk (see kufar_collect.py,
classify_photos.py, refill_pool.py — the Kufar-scrape pipeline that
replaced Pexels as the "before" photo source, 2026-09-25). A photo is
deleted the moment it's "used": a rejected candidate is gone for good, and
an approved generated result's source photo is removed once it's archived
to R2 under pinterest/ (see upload_and_reply) — the local copy is then
redundant. Separately, once a day at REFILL_CHECK_TIME (default 21:30),
refill_scheduler_loop checks whether photos/clean/ has fewer than
REFILL_THRESHOLD (default 20) photos left and, if so, asks in Telegram
whether to run a fresh scrape->classify->clean cycle (refill_pool.py) —
only starts on explicit yes, runs in a background thread (it's a multi-hour
job), and the bot stays fully responsive to Telegram throughout.

This process runs locally on this Mac, not deployed to Railway — the
classification (Ollama) and watermark-cleanup (rapid-mlx/FLUX) steps in
refill_pool.py only exist locally, a Railway container can't reach them.
The Dockerfile/Railway deploy docs below are stale as of that same date,
kept only in case of a future revert to a Pexels-only, Railway-deployed setup.

All progress is persisted to SQLite (state.py) after every step, so a
restart resumes mid-batch instead of losing progress or re-spending an
OpenRouter call on an already-generated image.

Config: marketing/pinterest/.env — TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
required; OPENROUTER_*/R2_* per pipeline.py/storage_r2.py; SCHEDULE_TIME
(default "11:00"), SCHEDULE_UTC_OFFSET (default "3"), BATCH_SIZE
(default "3"), REFILL_THRESHOLD (default "20"), REFILL_CHECK_TIME
(default "21:30") optional. See .env.example.

Run: ./.venv/bin/python bot.py
"""
import asyncio
import base64
import io
import logging
import os
import random
import sys
from datetime import datetime, timedelta, timezone

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

import pipeline
import refill_pool
import state
import storage_r2

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("pinterest-bot")


def load_bot_env():
    env = pipeline.read_env_file(pipeline.LOCAL_ENV_PATH)
    for key in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"):
        env[key] = os.environ.get(key, env.get(key, ""))
    missing = [k for k in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID") if not env[k]]
    if missing:
        sys.exit(f"Missing {', '.join(missing)} in marketing/pinterest/.env — see .env.example")
    env["SCHEDULE_TIME"] = os.environ.get("SCHEDULE_TIME", env.get("SCHEDULE_TIME") or "11:00")
    env["SCHEDULE_UTC_OFFSET"] = os.environ.get("SCHEDULE_UTC_OFFSET", env.get("SCHEDULE_UTC_OFFSET") or "3")
    env["BATCH_SIZE"] = os.environ.get("BATCH_SIZE", env.get("BATCH_SIZE") or "3")
    env["REFILL_THRESHOLD"] = os.environ.get("REFILL_THRESHOLD", env.get("REFILL_THRESHOLD") or "20")
    env["REFILL_CHECK_TIME"] = os.environ.get("REFILL_CHECK_TIME", env.get("REFILL_CHECK_TIME") or "21:30")
    return env


ENV = load_bot_env()
CHAT_ID = int(ENV["TELEGRAM_CHAT_ID"])
BATCH_SIZE = int(ENV["BATCH_SIZE"])
REFILL_THRESHOLD = int(ENV["REFILL_THRESHOLD"])
TZ = timezone(timedelta(hours=float(ENV["SCHEDULE_UTC_OFFSET"])))
SCHEDULE_HOUR, SCHEDULE_MINUTE = (int(x) for x in ENV["SCHEDULE_TIME"].split(":"))
REFILL_CHECK_HOUR, REFILL_CHECK_MINUTE = (int(x) for x in ENV["REFILL_CHECK_TIME"].split(":"))


def next_run_after(now):
    candidate = now.astimezone(TZ).replace(
        hour=SCHEDULE_HOUR, minute=SCHEDULE_MINUTE, second=0, microsecond=0
    )
    if candidate <= now.astimezone(TZ):
        candidate += timedelta(days=1)
    return candidate


def decision_keyboard():
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Approve", callback_data="approve"),
        InlineKeyboardButton("❌ Reject", callback_data="reject"),
    ]])


def refill_keyboard():
    # Distinct callback_data from decision_keyboard()'s "approve"/"reject" — refill
    # confirmation and candidate/generation decisions are routed separately in on_callback.
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Yes, refill", callback_data="refill_yes"),
        InlineKeyboardButton("❌ Not now", callback_data="refill_no"),
    ]])


def pick_next_candidate(st):
    manifest = pipeline.load_manifest(source_dir="clean")
    used = pipeline.load_used()
    excluded = used | set(st["excluded_ids"])
    room_types_in_batch = {s["room_type"] for s in st["approved_slots"]}
    return pipeline.pick_one(manifest, excluded, avoid_room_types=room_types_in_batch)


async def out_of_photos(app, st):
    await app.bot.send_message(
        CHAT_ID,
        "Ran out of unused before-photos in photos/clean/ — the nightly 21:30 check should "
        "catch this and offer a refill, or send /run again after one. Pausing until "
        "tomorrow's scheduled run.",
    )
    st["stage"] = "idle"
    st["current"] = None
    st["next_run_at"] = next_run_after(datetime.now(TZ) + timedelta(days=1)).isoformat()
    state.save(st)


async def send_candidate(app, current):
    path = os.path.join(pipeline.PHOTOS_DIR, current["photo_file"])
    room_label = pipeline.room_label(current["room_type"])
    st = state.load()
    slot_num = st["slot_index"] + 1
    with open(path, "rb") as f:
        msg = await app.bot.send_photo(
            CHAT_ID,
            f,
            caption=(
                f"Candidate {slot_num}/{BATCH_SIZE} — {room_label}\n"
                "Approve to generate a redesign, or reject for a different photo."
            ),
            reply_markup=decision_keyboard(),
        )
    st = state.load()
    st["current"]["message_id"] = msg.message_id
    state.save(st)


async def generate_and_send(app, slot, exclude_style=None, attempt=0):
    styles = list(pipeline.DESIGN_STYLE_LABELS.keys())
    if exclude_style and len(styles) > 1:
        styles = [s for s in styles if s != exclude_style]
    style = random.choice(styles)
    style_label = pipeline.DESIGN_STYLE_LABELS[style]
    room_label = pipeline.room_label(slot["room_type"])
    prompt = pipeline.build_prompt(room_label, style_label)

    before_path = os.path.join(pipeline.PHOTOS_DIR, slot["photo_file"])
    with open(before_path, "rb") as f:
        before_bytes = f.read()
    mime_type = pipeline.guess_mime(before_path)

    # Mark generation-in-progress before the (slow, crash-able) OpenRouter call so a
    # restart mid-call resumes by re-generating this slot instead of getting stuck
    # with current=None and stage="generating" forever (see post_init).
    st = state.load()
    st["current"] = {**slot, "pending_generation": True}
    state.save(st)

    status_msg = await app.bot.send_message(CHAT_ID, f"Generating {room_label} in {style_label}…")
    try:
        env = pipeline.load_api_env()
        after_bytes, after_mime = await asyncio.to_thread(
            pipeline.edit_image, env, before_bytes, mime_type, prompt
        )
        collage_bytes = pipeline.make_collage_bytes(before_bytes, after_bytes)
    except Exception:
        logger.exception("Generation failed (attempt %d)", attempt + 1)
        wait = min(30 * 2 ** attempt, 300)
        await status_msg.edit_text(
            f"Generation failed for {room_label} in {style_label} — retrying in {wait}s."
        )
        await asyncio.sleep(wait)
        await generate_and_send(app, slot, exclude_style=style, attempt=attempt + 1)
        return

    st = state.load()
    slot_num = st["slot_index"] + 1
    msg = await app.bot.send_photo(
        CHAT_ID,
        io.BytesIO(collage_bytes),
        caption=(
            f"Result {slot_num}/{BATCH_SIZE} — {room_label}, {style_label}\n"
            "Approve to save to R2, or reject to regenerate with a different style."
        ),
        reply_markup=decision_keyboard(),
    )
    await status_msg.delete()

    st = state.load()
    st["current"] = {
        **slot,
        "style": style,
        "style_label": style_label,
        "message_id": msg.message_id,
        "after_b64": base64.b64encode(after_bytes).decode(),
        "after_mime": after_mime,
        "collage_b64": base64.b64encode(collage_bytes).decode(),
    }
    state.save(st)


async def upload_and_reply(app, current, date, idx):
    r2_env = storage_r2.load_env()
    s3 = storage_r2.client(r2_env)
    before_path = os.path.join(pipeline.PHOTOS_DIR, current["photo_file"])
    with open(before_path, "rb") as f:
        before_bytes = f.read()
    mime_type = pipeline.guess_mime(before_path)
    after_bytes = base64.b64decode(current["after_b64"])
    collage_bytes = base64.b64decode(current["collage_b64"])

    room_label = pipeline.room_label(current["room_type"])
    stem = f"{idx:02d}_{pipeline.slugify(room_label)}_{pipeline.slugify(current['style_label'])}"
    urls = {}
    items = (
        ("before", before_bytes, mime_type, os.path.splitext(before_path)[1].lstrip(".")),
        ("after", after_bytes, current["after_mime"], pipeline.guess_ext(current["after_mime"])),
        ("collage", collage_bytes, "image/jpeg", "jpg"),
    )
    for label, body, mime, ext in items:
        key = storage_r2.upload(s3, r2_env, f"{date}/{stem}_{label}.{ext}", body, mime)
        urls[label] = storage_r2.presigned_url(s3, r2_env, key)

    used_ids = pipeline.load_used()
    used_ids.add(current["photo_id"])
    pipeline.save_used(used_ids)

    # The before-photo is now safely archived above (R2, pinterest/<date>/..._before.*) —
    # the local photos/clean/ copy is redundant, remove it (see pipeline.remove_photo).
    pipeline.remove_photo(current["photo_id"])

    await app.bot.send_message(
        CHAT_ID,
        f"Saved {idx}/{BATCH_SIZE}: {room_label} — {current['style_label']}\n{urls['collage']}",
    )


async def handle_decision(app, approved):
    st = state.load()
    if st["stage"] not in ("candidates", "generating") or not st["current"]:
        return "Nothing pending right now."
    current = st["current"]

    if st["stage"] == "candidates":
        if approved:
            st["approved_slots"].append({
                "photo_id": current["photo_id"],
                "photo_file": current["photo_file"],
                "room_type": current["room_type"],
            })
            st["slot_index"] += 1
            if st["slot_index"] >= BATCH_SIZE:
                st["stage"] = "generating"
                slot_index = 0
                st["slot_index"] = slot_index
                st["current"] = None
                state.save(st)
                await generate_and_send(app, st["approved_slots"][slot_index])
                return None
        else:
            # Rejected candidates are never shown again — remove immediately (see
            # pipeline.remove_photo and the module docstring's delete-on-use policy).
            pipeline.remove_photo(current["photo_id"])
        photo = pick_next_candidate(st)
        if photo is None:
            await out_of_photos(app, st)
            return None
        st["excluded_ids"].append(photo["id"])
        st["current"] = {"photo_id": photo["id"], "photo_file": photo["file"], "room_type": photo["room_type"]}
        state.save(st)
        await send_candidate(app, st["current"])
        return None

    # stage == "generating"
    if approved:
        await upload_and_reply(app, current, st["date"], st["slot_index"] + 1)
        st = state.load()
        st["slot_index"] += 1
        if st["slot_index"] >= BATCH_SIZE:
            st["stage"] = "done"
            st["current"] = None
            st["next_run_at"] = next_run_after(datetime.now(TZ)).isoformat()
            state.save(st)
            await app.bot.send_message(
                CHAT_ID,
                f"All {BATCH_SIZE} done for today. Next batch: {st['next_run_at']}.",
            )
        else:
            st["current"] = None
            state.save(st)
            await generate_and_send(app, st["approved_slots"][st["slot_index"]])
    else:
        base_slot = {
            "photo_id": current["photo_id"],
            "photo_file": current["photo_file"],
            "room_type": current["room_type"],
        }
        st["current"] = None
        state.save(st)
        await generate_and_send(app, base_slot, exclude_style=current.get("style"))
    return None


async def start_new_cycle(app):
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    prev = state.load()
    st = dict(state.DEFAULT_STATE)
    # refill_stage/last_refill_check_date track an independent daily schedule (21:30) —
    # a fresh candidate/generation cycle must not clobber them.
    st["refill_stage"] = prev["refill_stage"]
    st["last_refill_check_date"] = prev["last_refill_check_date"]
    st["date"] = today
    st["stage"] = "candidates"
    manifest = pipeline.load_manifest(source_dir="clean")
    used = pipeline.load_used()
    photo = pipeline.pick_one(manifest, used)
    if photo is None:
        await out_of_photos(app, st)
        return
    st["excluded_ids"] = [photo["id"]]
    st["current"] = {"photo_id": photo["id"], "photo_file": photo["file"], "room_type": photo["room_type"]}
    state.save(st)
    await send_candidate(app, st["current"])


async def scheduler_loop(app):
    while True:
        st = state.load()
        if st["stage"] in ("candidates", "generating"):
            await asyncio.sleep(30)
            continue
        now = datetime.now(TZ)
        next_run_at = st.get("next_run_at")
        if not next_run_at:
            next_run_at = next_run_after(now).isoformat()
            st["next_run_at"] = next_run_at
            state.save(st)
        next_run = datetime.fromisoformat(next_run_at)
        if now >= next_run:
            await start_new_cycle(app)
        else:
            await asyncio.sleep(min((next_run - now).total_seconds(), 300))


async def run_refill(app):
    """Kicks off refill_pool.run() in a background thread (it's a synchronous, multi-hour
    job — scrape, classify ~1,000+ photos via Ollama, FLUX-clean the watermarked subset) so
    the bot stays fully responsive to Telegram throughout. notify() bridges progress messages
    from that worker thread back onto this event loop via run_coroutine_threadsafe."""
    st = state.load()
    st["refill_stage"] = "running"
    state.save(st)
    await app.bot.send_message(
        CHAT_ID,
        "Starting pool refill (scrape -> classify -> clean) — this can take several hours, "
        "I'll message you when it's done.",
    )
    loop = asyncio.get_running_loop()

    def notify(msg):
        asyncio.run_coroutine_threadsafe(app.bot.send_message(CHAT_ID, msg), loop)

    try:
        await asyncio.to_thread(refill_pool.run, notify)
    except Exception:
        logger.exception("refill_pool.run failed")
        await app.bot.send_message(
            CHAT_ID,
            "Refill failed — see logs. Will ask again at tomorrow's 21:30 check if the pool is still low.",
        )
    finally:
        st = state.load()
        st["refill_stage"] = "idle"
        state.save(st)


async def handle_refill_decision(app, confirmed):
    st = state.load()
    if st["refill_stage"] != "awaiting_confirmation":
        return
    if confirmed:
        asyncio.create_task(run_refill(app))
    else:
        st["refill_stage"] = "idle"
        state.save(st)
        await app.bot.send_message(
            CHAT_ID, "OK, not refilling now — I'll ask again at tomorrow's 21:30 check if the pool is still low."
        )


async def refill_scheduler_loop(app):
    """Independent of scheduler_loop's candidate/generation stage — checks once a day at
    REFILL_CHECK_TIME (default 21:30) whether photos/clean/ is running low, regardless of
    whether today's SCHEDULE_TIME batch is idle, in progress, or done."""
    while True:
        await asyncio.sleep(300)
        st = state.load()
        if st["refill_stage"] != "idle":
            continue
        now = datetime.now(TZ)
        today = now.strftime("%Y-%m-%d")
        if st["last_refill_check_date"] == today:
            continue
        if (now.hour, now.minute) < (REFILL_CHECK_HOUR, REFILL_CHECK_MINUTE):
            continue
        count = len(pipeline.load_manifest(source_dir="clean"))
        st["last_refill_check_date"] = today
        if count < REFILL_THRESHOLD:
            st["refill_stage"] = "awaiting_confirmation"
            state.save(st)
            await app.bot.send_message(
                CHAT_ID,
                f"photos/clean/ has {count} photos left (< {REFILL_THRESHOLD}). Run a fresh "
                "scrape -> classify -> clean cycle? This can take several hours.",
                reply_markup=refill_keyboard(),
            )
        else:
            state.save(st)


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if update.effective_chat.id != CHAT_ID:
        return
    try:
        await query.edit_message_reply_markup(reply_markup=None)
    except Exception:
        pass
    if query.data in ("refill_yes", "refill_no"):
        await handle_refill_decision(context.application, query.data == "refill_yes")
        return
    note = await handle_decision(context.application, query.data == "approve")
    if note:
        await context.application.bot.send_message(CHAT_ID, note)


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_chat.id != CHAT_ID or not update.message or not update.message.text:
        return
    text = update.message.text.strip().lower()
    if text in ("approve", "yes", "y"):
        approved = True
    elif text in ("reject", "no", "n"):
        approved = False
    else:
        return
    st = state.load()
    if st["refill_stage"] == "awaiting_confirmation":
        await handle_refill_decision(context.application, approved)
        return
    note = await handle_decision(context.application, approved)
    if note:
        await update.message.reply_text(note)


async def on_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_chat.id != CHAT_ID:
        return
    st = state.load()
    lines = [f"stage: {st['stage']}", f"date: {st['date']}", f"slot: {st['slot_index'] + 1}/{BATCH_SIZE}"]
    if st.get("next_run_at"):
        lines.append(f"next run: {st['next_run_at']}")
    lines.append(f"clean pool: {len(pipeline.load_manifest(source_dir='clean'))} photos")
    lines.append(f"refill: {st['refill_stage']} (last checked: {st['last_refill_check_date']})")
    await update.message.reply_text("\n".join(lines))


async def on_run(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_chat.id != CHAT_ID:
        return
    st = state.load()
    if st["stage"] in ("candidates", "generating"):
        await update.message.reply_text(
            f"A batch is already in progress (stage: {st['stage']}, "
            f"slot {st['slot_index'] + 1}/{BATCH_SIZE}) — nothing to start."
        )
        return
    await update.message.reply_text("Starting a batch now, ignoring the schedule…")
    await start_new_cycle(context.application)


async def on_run_parse(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/run_parse — start refill_pool.run() (scrape -> classify -> clean) immediately,
    ignoring REFILL_CHECK_TIME/REFILL_THRESHOLD and skipping the yes/no prompt (typing the
    command is the confirmation). Independent of the candidate/generation stage — can run
    alongside an in-progress batch."""
    if update.effective_chat.id != CHAT_ID:
        return
    st = state.load()
    if st["refill_stage"] != "idle":
        await update.message.reply_text(f"Refill already {st['refill_stage']} — nothing to start.")
        return
    await update.message.reply_text("Starting pool refill now, ignoring the 21:30 schedule…")
    asyncio.create_task(run_refill(context.application))


async def post_init(app: Application):
    st = state.load()
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    if st["stage"] in ("candidates", "generating") and st["current"]:
        current = st["current"]
        photo_path = os.path.join(pipeline.PHOTOS_DIR, current["photo_file"])
        day_rolled_over = st["date"] != today
        photo_missing = not os.path.exists(photo_path)
        if day_rolled_over or photo_missing:
            reason = (
                "the day rolled over mid-batch"
                if day_rolled_over
                else "its before-photo is missing from photos/clean/"
            )
            await app.bot.send_message(
                CHAT_ID,
                f"Restarted and {reason} — dropping the incomplete batch, "
                "starting fresh at the next scheduled time.",
            )
            refill_stage, last_refill_check_date = st["refill_stage"], st["last_refill_check_date"]
            st = dict(state.DEFAULT_STATE)
            st["refill_stage"] = refill_stage
            st["last_refill_check_date"] = last_refill_check_date
            st["next_run_at"] = next_run_after(datetime.now(TZ)).isoformat()
            state.save(st)
        else:
            await app.bot.send_message(CHAT_ID, "Resuming after a restart — re-sending the pending item.")
            if st["stage"] == "candidates":
                await send_candidate(app, current)
            elif current.get("pending_generation"):
                # Crashed mid-OpenRouter-call before any result existed — nothing to
                # re-send, just re-run generation for this slot from scratch.
                base_slot = {
                    "photo_id": current["photo_id"],
                    "photo_file": current["photo_file"],
                    "room_type": current["room_type"],
                }
                await generate_and_send(app, base_slot)
            else:
                room_label = pipeline.room_label(current["room_type"])
                collage_bytes = base64.b64decode(current["collage_b64"])
                msg = await app.bot.send_photo(
                    CHAT_ID,
                    io.BytesIO(collage_bytes),
                    caption=(
                        f"Result {st['slot_index'] + 1}/{BATCH_SIZE} — {room_label}, {current['style_label']}\n"
                        "Approve to save to R2, or reject to regenerate with a different style."
                    ),
                    reply_markup=decision_keyboard(),
                )
                st = state.load()
                st["current"]["message_id"] = msg.message_id
                state.save(st)
    asyncio.create_task(scheduler_loop(app))
    asyncio.create_task(refill_scheduler_loop(app))


def main():
    # Python 3.14 dropped asyncio.get_event_loop()'s implicit loop creation on the
    # main thread, which python-telegram-bot 21.x's run_polling() still relies on.
    try:
        asyncio.get_event_loop()
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())

    app = Application.builder().token(ENV["TELEGRAM_BOT_TOKEN"]).post_init(post_init).build()
    app.add_handler(CommandHandler("status", on_status))
    app.add_handler(CommandHandler(["run", "run_generation"], on_run))
    app.add_handler(CommandHandler("run_parse", on_run_parse))
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))
    logger.info(
        "Starting bot: batch_size=%s schedule=%02d:%02d UTC%+g",
        BATCH_SIZE, SCHEDULE_HOUR, SCHEDULE_MINUTE, float(ENV["SCHEDULE_UTC_OFFSET"]),
    )
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
