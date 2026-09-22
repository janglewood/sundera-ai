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
  DesignStyle, call OpenRouter, build the before/after collage, and generate
  a title/description (pipeline.generate_copy, a separate cheap text model —
  see OPENROUTER_TEXT_MODEL) with a CTA at the start and end of the
  description and a UTM-tagged link (pipeline.utm_link) swapped in after
  generation, never written by the model itself. Sends the collage (with
  Approve/Reject buttons) followed by the title/description as a second
  message, for approval together. Approve uploads before/after/collage to R2
  (see storage_r2.py) and replies with the link plus the title/description
  for manual posting. Reject re-generates the same candidate with a
  different style (and new copy to match) and sends again.

After BATCH_SIZE approved collages, sleeps until the next scheduled run.
Send /run in the chat to start a batch immediately instead of waiting for
the schedule (no-op with a warning if one is already in progress); /status
reports the current stage/slot/next-run-time.

Every stage-1 candidate approve/reject is logged (state.log_decision) with
the photo's search query and Pexels alt text, and future candidate picks are
weighted (not filtered) toward whatever's historically been approved — see
pipeline.build_preference_model/score_photo/weighted_choice. /prefs shows
what's been learned so far.

All progress is persisted to SQLite (state.py) after every step, so a
restart (e.g. a Railway redeploy) resumes mid-batch instead of losing
progress or re-spending an OpenRouter call on an already-generated image.
That said, this runs fine on a fully ephemeral filesystem (no volume
required): photos/ is intentionally not baked into the Docker image or
persisted — see refresh_photo_pool() — and a lost state.db just looks like
a fresh boot (idle, next run scheduled normally). The one thing that isn't
fully graceful is a restart mid-batch where the in-progress photo no longer
exists after a fresh Pexels fetch; see the existence check in post_init().

Config: marketing/pinterest/.env — TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
PEXELS_API_KEY required; OPENROUTER_*/R2_* per pipeline.py/storage_r2.py;
SCHEDULE_TIME (default "11:00"), SCHEDULE_UTC_OFFSET (default "3"),
BATCH_SIZE (default "3"), PHOTO_POOL_SIZE (default "100") optional. See
.env.example.

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

import pexels_collect
import pipeline
import state
import storage_r2

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("pinterest-bot")


def load_bot_env():
    env = pipeline.read_env_file(pipeline.LOCAL_ENV_PATH)
    for key in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "PEXELS_API_KEY"):
        env[key] = os.environ.get(key, env.get(key, ""))
    missing = [k for k in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "PEXELS_API_KEY") if not env[k]]
    if missing:
        sys.exit(f"Missing {', '.join(missing)} in marketing/pinterest/.env — see .env.example")
    env["SCHEDULE_TIME"] = os.environ.get("SCHEDULE_TIME", env.get("SCHEDULE_TIME") or "11:00")
    env["SCHEDULE_UTC_OFFSET"] = os.environ.get("SCHEDULE_UTC_OFFSET", env.get("SCHEDULE_UTC_OFFSET") or "3")
    env["BATCH_SIZE"] = os.environ.get("BATCH_SIZE", env.get("BATCH_SIZE") or "3")
    env["PHOTO_POOL_SIZE"] = os.environ.get("PHOTO_POOL_SIZE", env.get("PHOTO_POOL_SIZE") or "100")
    return env


ENV = load_bot_env()
CHAT_ID = int(ENV["TELEGRAM_CHAT_ID"])
BATCH_SIZE = int(ENV["BATCH_SIZE"])
PHOTO_POOL_SIZE = int(ENV["PHOTO_POOL_SIZE"])
TZ = timezone(timedelta(hours=float(ENV["SCHEDULE_UTC_OFFSET"])))
SCHEDULE_HOUR, SCHEDULE_MINUTE = (int(x) for x in ENV["SCHEDULE_TIME"].split(":"))


async def refresh_photo_pool(app):
    """Top up photos/ to PHOTO_POOL_SIZE via Pexels — see module docstring:
    photos are fetched at runtime rather than baked into the image/git."""
    await app.bot.send_message(CHAT_ID, f"Topping up before-photos from Pexels (target: {PHOTO_POOL_SIZE})…")
    try:
        await asyncio.to_thread(
            pexels_collect.collect, ENV["PEXELS_API_KEY"], pipeline.PHOTOS_DIR, PHOTO_POOL_SIZE, 500
        )
    except Exception:
        logger.exception("pexels_collect failed")
        await app.bot.send_message(CHAT_ID, "Pexels photo refill failed — continuing with whatever's on disk.")


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


def pick_next_candidate(st):
    manifest = pipeline.load_manifest()
    used = pipeline.load_used()
    excluded = used | set(st["excluded_ids"])
    room_types_in_batch = {s["room_type"] for s in st["approved_slots"]}
    model = pipeline.build_preference_model(state.load_decisions())
    return pipeline.pick_one(manifest, excluded, avoid_room_types=room_types_in_batch, model=model)


async def out_of_photos(app, st):
    await app.bot.send_message(
        CHAT_ID,
        "Ran out of unused before-photos in the manifest — top up with "
        "`pexels_collect.py`. Pausing until tomorrow's scheduled run.",
    )
    st["stage"] = "idle"
    st["current"] = None
    st["next_run_at"] = next_run_after(datetime.now(TZ) + timedelta(days=1)).isoformat()
    state.save(st)


async def send_candidate(app, current):
    path = os.path.join(pipeline.PHOTOS_DIR, current["photo_file"])
    room_label = pipeline.ROOM_LABELS.get(current["room_type"], current["room_type"])
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
    room_label = pipeline.ROOM_LABELS.get(slot["room_type"], slot["room_type"])
    prompt = pipeline.build_prompt(room_label, style_label)

    before_path = os.path.join(pipeline.PHOTOS_DIR, slot["photo_file"])
    with open(before_path, "rb") as f:
        before_bytes = f.read()
    mime_type = pipeline.guess_mime(before_path)

    # Mark generation-in-progress before the (slow, crash-able) OpenRouter call so a
    # restart mid-call resumes by re-generating this slot instead of getting stuck
    # with current=None and stage="generating" forever (see post_init).
    st = state.load()
    slot_num = st["slot_index"] + 1
    date = st["date"]
    st["current"] = {**slot, "pending_generation": True}
    state.save(st)

    status_msg = await app.bot.send_message(CHAT_ID, f"Generating {room_label} in {style_label}…")
    try:
        env = pipeline.load_api_env()
        after_bytes, after_mime = await asyncio.to_thread(
            pipeline.edit_image, env, before_bytes, mime_type, prompt
        )
        collage_bytes = pipeline.make_collage_bytes(before_bytes, after_bytes)
        link = pipeline.utm_link(date, slot_num)
        title, description = await asyncio.to_thread(
            pipeline.generate_copy, env, room_label, style_label, link
        )
    except Exception:
        logger.exception("Generation failed (attempt %d)", attempt + 1)
        wait = min(30 * 2 ** attempt, 300)
        await status_msg.edit_text(
            f"Generation failed for {room_label} in {style_label} — retrying in {wait}s."
        )
        await asyncio.sleep(wait)
        await generate_and_send(app, slot, exclude_style=style, attempt=attempt + 1)
        return

    msg = await app.bot.send_photo(
        CHAT_ID,
        io.BytesIO(collage_bytes),
        caption=(
            f"Result {slot_num}/{BATCH_SIZE} — {room_label}, {style_label}\n"
            "Approve to save to R2, or reject to regenerate with a different style."
        ),
        reply_markup=decision_keyboard(),
    )
    copy_msg = await app.bot.send_message(CHAT_ID, f"Title: {title}\n\n{description}")
    await status_msg.delete()

    st = state.load()
    st["current"] = {
        **slot,
        "style": style,
        "style_label": style_label,
        "message_id": msg.message_id,
        "copy_message_id": copy_msg.message_id,
        "after_b64": base64.b64encode(after_bytes).decode(),
        "after_mime": after_mime,
        "collage_b64": base64.b64encode(collage_bytes).decode(),
        "title": title,
        "description": description,
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

    stem = f"{idx:02d}_{current['room_type']}_{pipeline.slugify(current['style_label'])}"
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

    room_label = pipeline.ROOM_LABELS.get(current["room_type"], current["room_type"])
    await app.bot.send_message(
        CHAT_ID,
        f"Saved {idx}/{BATCH_SIZE}: {room_label} — {current['style_label']}\n{urls['collage']}\n\n"
        f"Title: {current['title']}\n\n{current['description']}",
    )


async def delete_message(app, message_id):
    if not message_id:
        return
    try:
        await app.bot.delete_message(CHAT_ID, message_id)
    except Exception:
        pass


async def handle_decision(app, approved):
    st = state.load()
    if st["stage"] not in ("candidates", "generating") or not st["current"]:
        return "Nothing pending right now."
    current = st["current"]

    if st["stage"] == "candidates":
        # Candidate photos are throwaway once decided — only approved collages
        # should remain visible in the chat, per Anton's request.
        await delete_message(app, current.get("message_id"))
        state.log_decision(
            current["photo_id"], current["room_type"], current.get("query"), current.get("alt"), approved
        )
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
        photo = pick_next_candidate(st)
        if photo is None:
            await out_of_photos(app, st)
            return None
        st["excluded_ids"].append(photo["id"])
        st["current"] = {
            "photo_id": photo["id"],
            "photo_file": photo["file"],
            "room_type": photo["room_type"],
            "query": photo.get("query"),
            "alt": photo.get("alt"),
        }
        state.save(st)
        await send_candidate(app, st["current"])
        return None

    # stage == "generating"
    if approved:
        # Keep the approved collage visible; just drop its Approve/Reject buttons
        # (redundant here since on_callback already does this, but on_text — a typed
        # "approve" — doesn't, so this covers both paths).
        try:
            await app.bot.edit_message_reply_markup(CHAT_ID, current.get("message_id"), reply_markup=None)
        except Exception:
            pass
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
        await delete_message(app, current.get("message_id"))
        await delete_message(app, current.get("copy_message_id"))
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
    await refresh_photo_pool(app)
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    st = dict(state.DEFAULT_STATE)
    st["date"] = today
    st["stage"] = "candidates"
    manifest = pipeline.load_manifest()
    used = pipeline.load_used()
    model = pipeline.build_preference_model(state.load_decisions())
    photo = pipeline.pick_one(manifest, used, model=model)
    if photo is None:
        await out_of_photos(app, st)
        return
    st["excluded_ids"] = [photo["id"]]
    st["current"] = {
        "photo_id": photo["id"],
        "photo_file": photo["file"],
        "room_type": photo["room_type"],
        "query": photo.get("query"),
        "alt": photo.get("alt"),
    }
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


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if update.effective_chat.id != CHAT_ID:
        return
    try:
        await query.edit_message_reply_markup(reply_markup=None)
    except Exception:
        pass
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
    await update.message.reply_text("\n".join(lines))


def _pref_lines(counts, min_evidence, label, n=4):
    scored = [(key, a, r, a / (a + r)) for key, (a, r) in counts.items() if key and a + r >= min_evidence]
    if not scored:
        return []
    scored.sort(key=lambda x: x[3], reverse=True)
    lines = [f"{label} — leans approved:"]
    lines += [f"  {key!r}: {a}/{a + r} approved ({rate:.0%})" for key, a, r, rate in scored[:n]]
    lines.append(f"{label} — leans rejected:")
    lines += [f"  {key!r}: {a}/{a + r} approved ({rate:.0%})" for key, a, r, rate in scored[-n:][::-1]]
    return lines


async def on_prefs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_chat.id != CHAT_ID:
        return
    decisions = state.load_decisions()
    if not decisions:
        await update.message.reply_text("No candidate decisions logged yet — picks are still uniform random.")
        return
    model = pipeline.build_preference_model(decisions)
    approved = sum(d["approved"] for d in decisions)
    lines = [
        f"{len(decisions)} candidate decisions logged, {approved} approved ({model['global_rate']:.0%}).",
        "Picks are weighted toward these, not filtered to them — the rest of the pool still shows up sometimes.",
        "",
    ]
    lines += _pref_lines(model["query"], 2, "Search query")
    lines.append("")
    lines += _pref_lines(model["token"], pipeline.PREF_MIN_TOKEN_EVIDENCE, "Alt-text word")
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


async def post_init(app: Application):
    # Note: refresh_photo_pool() is NOT called here — it takes ~1-2 minutes to top up
    # PHOTO_POOL_SIZE, and post_init blocks run_polling() from starting until it
    # returns, which made the bot fully unresponsive to Telegram at every boot. It
    # runs inside start_new_cycle() instead, so only starting a batch waits on it,
    # not the bot's ability to answer /status, /run, or resume a pending decision.
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
                else "its before-photo is gone after a fresh Pexels fetch"
            )
            await app.bot.send_message(
                CHAT_ID,
                f"Restarted and {reason} — dropping the incomplete batch, "
                "starting fresh at the next scheduled time.",
            )
            st = dict(state.DEFAULT_STATE)
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
                room_label = pipeline.ROOM_LABELS.get(current["room_type"], current["room_type"])
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
                copy_msg = await app.bot.send_message(
                    CHAT_ID, f"Title: {current['title']}\n\n{current['description']}"
                )
                st = state.load()
                st["current"]["message_id"] = msg.message_id
                st["current"]["copy_message_id"] = copy_msg.message_id
                state.save(st)
    asyncio.create_task(scheduler_loop(app))


def main():
    # Python 3.14 dropped asyncio.get_event_loop()'s implicit loop creation on the
    # main thread, which python-telegram-bot 21.x's run_polling() still relies on.
    try:
        asyncio.get_event_loop()
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())

    app = Application.builder().token(ENV["TELEGRAM_BOT_TOKEN"]).post_init(post_init).build()
    app.add_handler(CommandHandler("status", on_status))
    app.add_handler(CommandHandler("run", on_run))
    app.add_handler(CommandHandler("prefs", on_prefs))
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))
    logger.info(
        "Starting bot: batch_size=%s schedule=%02d:%02d UTC%+g",
        BATCH_SIZE, SCHEDULE_HOUR, SCHEDULE_MINUTE, float(ENV["SCHEDULE_UTC_OFFSET"]),
    )
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
