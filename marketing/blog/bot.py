#!/usr/bin/env python3
"""Daily Telegram-approval daemon for the Sundera blog pipeline.

Turns before/after collages already approved for Pinterest (marketing/pinterest/, read
directly from R2 under the pinterest/ prefix — never touches that bot's local
bot_state.db, fully decoupled from it) into blog articles: crops off the Pinterest-only
CTA band, asks an OpenRouter text model for structured article copy
(title/dek/problems/palette/materials/lighting/priceTable/faq), uploads the cropped image
to a separate public R2 bucket, and sends Anton an approve/reject prompt in Telegram
(same one-candidate-at-a-time UX as the Pinterest bot). On approve, POSTs the article to
apps/api's /blog-posts (X-Blog-Bot-Secret header) — apps/api itself decides *when* the
post goes live (BlogPostsService.create picks a randomized slot,
BlogPostsPublishWorkerService flips it live when due); this bot's only job is "is this
content good".

Stateless by design — no SQLite, no local photo pool, no Railway volume. Dedup against
turning the same Pinterest collage into two articles is done by asking apps/api which
sourceImageKey values already exist (BlogPost.sourceImageKey is unique on that side too,
as a backstop against a race between two approvals). The only state this process holds is
"which candidate is currently awaiting Anton's response", in memory — lost on a restart,
the same class of accepted edge case already documented for the Pinterest bot's own gaps.

Runs on Railway — unlike the Pinterest bot, this has no local-only dependency (no Ollama,
no rapid-mlx, no browser automation), so cloud hosting is a clean fit. See CLAUDE.md.

Config: marketing/blog/.env — see .env.example. Chat commands: /run (check for a new
candidate now), /status (today's progress).

Run: python bot.py
"""
import asyncio
import io
import logging
import os
import random
import sys
from datetime import datetime, timedelta, timezone

from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    Update,
)
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
)

import api_client
import pipeline
import storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("blog-bot")
# See marketing/pinterest/bot.py's identical line / CLAUDE.md Housekeeping — httpx (python-
# telegram-bot's HTTP client) logs every request at INFO with the bot token embedded in the
# URL. Raised to WARNING so it's never written to logs in the first place.
logging.getLogger("httpx").setLevel(logging.WARNING)


def load_env():
    env = pipeline.read_env_file(pipeline.LOCAL_ENV_PATH)
    required = (
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
        "R2_ENDPOINT",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_SOURCE_BUCKET",
        "R2_PUBLIC_BUCKET",
        "R2_PUBLIC_BASE_URL",
        "OPENROUTER_API_KEY",
        "OPENROUTER_BASE_URL",
        "SUNDERA_API_BASE_URL",
        "BLOG_BOT_API_SECRET",
    )
    for key in required:
        env[key] = os.environ.get(key, env.get(key, ""))
    missing = [k for k in required if not env[k]]
    if missing:
        sys.exit(f"Missing {', '.join(missing)} in marketing/blog/.env — see .env.example")
    env["OPENROUTER_TEXT_MODEL"] = os.environ.get(
        "OPENROUTER_TEXT_MODEL", env.get("OPENROUTER_TEXT_MODEL") or pipeline.DEFAULT_TEXT_MODEL
    )
    env["CHECK_TIME"] = os.environ.get("CHECK_TIME", env.get("CHECK_TIME") or "10:00")
    env["CHECK_UTC_OFFSET"] = os.environ.get("CHECK_UTC_OFFSET", env.get("CHECK_UTC_OFFSET") or "3")
    env["DAILY_PROPOSAL_COUNT"] = os.environ.get(
        "DAILY_PROPOSAL_COUNT", env.get("DAILY_PROPOSAL_COUNT") or "3"
    )
    return env


ENV = load_env()
CHAT_ID = int(ENV["TELEGRAM_CHAT_ID"])
DAILY_PROPOSAL_COUNT = int(ENV["DAILY_PROPOSAL_COUNT"])
TZ = timezone(timedelta(hours=float(ENV["CHECK_UTC_OFFSET"])))
CHECK_HOUR, CHECK_MINUTE = (int(x) for x in ENV["CHECK_TIME"].split(":"))

S3 = storage.client(ENV["R2_ENDPOINT"], ENV["R2_ACCESS_KEY_ID"], ENV["R2_SECRET_ACCESS_KEY"])

# In-memory only — see module docstring on why a lost "pending" on restart is an accepted
# gap, not a bug.
STATE = {
    "running": False,
    "approved_today": 0,
    "day": None,
    "pending": None,
}


def decision_keyboard():
    return InlineKeyboardMarkup(
        [[
            InlineKeyboardButton("✅ Publish", callback_data="approve"),
            InlineKeyboardButton("❌ Skip", callback_data="reject"),
        ]]
    )


def main_menu_keyboard():
    return ReplyKeyboardMarkup([["/status"], ["/run"]], resize_keyboard=True)


def _require_chat(update):
    return update.effective_chat and update.effective_chat.id == CHAT_ID


async def find_next_candidate(used_keys):
    """Scans R2 for an unused, supported-room-type Pinterest collage. Returns
    (source_key, (room_type, style, date_str, idx_str)) or None if nothing's left."""
    keys = await asyncio.to_thread(
        lambda: list(storage.list_source_collages(S3, ENV["R2_SOURCE_BUCKET"]))
    )
    random.shuffle(keys)
    for key in keys:
        if key in used_keys:
            continue
        parsed = pipeline.parse_source_key(key)
        if parsed is None:
            continue  # unparseable, or an unsupported room (dining room / entryway)
        return key, parsed
    return None


async def propose_next(app):
    """Picks a candidate, generates its article + cropped image, sends the approval
    prompt. No-ops (with a status message) if nothing unused is left."""
    used_keys = await asyncio.to_thread(api_client.get_used_source_keys, ENV)
    found = await find_next_candidate(used_keys)
    if found is None:
        await app.bot.send_message(
            CHAT_ID, "No unused Pinterest collages left to turn into articles."
        )
        STATE["running"] = False
        return

    source_key, (room_type, style, date_str, idx_str) = found
    room_label = pipeline.ROOM_TYPE_LABELS[room_type]
    style_label = pipeline.DESIGN_STYLE_LABELS[style]

    await app.bot.send_message(CHAT_ID, f"Generating article: {room_label} — {style_label}…")
    raw_bytes = await asyncio.to_thread(storage.download, S3, ENV["R2_SOURCE_BUCKET"], source_key)
    cropped = await asyncio.to_thread(pipeline.crop_collage, raw_bytes)
    article = await asyncio.to_thread(pipeline.generate_article, ENV, room_label, style_label)

    STATE["pending"] = {
        "source_key": source_key,
        "room_type": room_type,
        "style": style,
        "date_str": date_str,
        "idx_str": idx_str,
        "article": article,
        "image_bytes": cropped,
    }

    caption = f"{article['title']}\n\n{article['dek']}\n\nRoom: {room_label} · Style: {style_label}"
    await app.bot.send_photo(
        CHAT_ID, photo=io.BytesIO(cropped), caption=caption, reply_markup=decision_keyboard()
    )


async def handle_decision(app, approve):
    pending = STATE["pending"]
    STATE["pending"] = None
    if pending is None:
        return

    if approve:
        article = pending["article"]
        slug = pipeline.build_slug(article["title"], pending["date_str"], pending["idx_str"])
        image_key = f"{pending['date_str']}/{slug}.jpg"
        image_url = await asyncio.to_thread(
            storage.upload_public,
            S3,
            ENV["R2_PUBLIC_BUCKET"],
            ENV["R2_PUBLIC_BASE_URL"],
            image_key,
            pending["image_bytes"],
            "image/jpeg",
        )
        room_label = pipeline.ROOM_TYPE_LABELS[pending["room_type"]]
        style_label = pipeline.DESIGN_STYLE_LABELS[pending["style"]]
        payload = {
            "slug": slug,
            "title": article["title"],
            "dek": article["dek"],
            "roomType": pending["room_type"],
            "style": pending["style"],
            "imageUrl": image_url,
            "imageAlt": f"Before and after AI redesign, {room_label} in {style_label} style",
            "problems": article["problems"],
            "palette": article["palette"],
            "materials": article["materials"],
            "lighting": article["lighting"],
            "priceTable": article["priceTable"],
            "faq": article["faq"],
            "sourceImageKey": pending["source_key"],
        }
        result = await asyncio.to_thread(api_client.create_blog_post, ENV, payload)
        if result is None:
            await app.bot.send_message(CHAT_ID, "Already used (dedup race) — skipped.")
        else:
            STATE["approved_today"] += 1
            await app.bot.send_message(
                CHAT_ID,
                f"Scheduled: {payload['title']}\nGoes live: {result['scheduledFor']}",
            )
    else:
        await app.bot.send_message(CHAT_ID, "Skipped.")

    await maybe_propose_next(app)


async def maybe_propose_next(app):
    today = datetime.now(TZ).date()
    if STATE["day"] != today:
        STATE["day"] = today
        STATE["approved_today"] = 0
    if STATE["approved_today"] >= DAILY_PROPOSAL_COUNT:
        await app.bot.send_message(
            CHAT_ID, f"Reached today's target ({DAILY_PROPOSAL_COUNT}). Done for today."
        )
        STATE["running"] = False
        return
    await propose_next(app)


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _require_chat(update):
        return
    query = update.callback_query
    await query.answer()
    if query.data == "approve":
        await handle_decision(context.application, approve=True)
    elif query.data == "reject":
        await handle_decision(context.application, approve=False)


async def on_run(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _require_chat(update):
        return
    if STATE["running"]:
        await update.message.reply_text("Already running.")
        return
    STATE["running"] = True
    await update.message.reply_text("Starting…")
    await maybe_propose_next(context.application)


async def on_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _require_chat(update):
        return
    pending = "yes" if STATE["pending"] else "no"
    await update.message.reply_text(
        f"Approved today: {STATE['approved_today']}/{DAILY_PROPOSAL_COUNT}\n"
        f"Awaiting a decision: {pending}\n"
        f"Running: {STATE['running']}",
        reply_markup=main_menu_keyboard(),
    )


async def on_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _require_chat(update):
        return
    await update.message.reply_text(
        "Sundera blog bot. /run checks for a new article now, /status shows progress.",
        reply_markup=main_menu_keyboard(),
    )


def next_check_after(now):
    candidate = now.astimezone(TZ).replace(
        hour=CHECK_HOUR, minute=CHECK_MINUTE, second=0, microsecond=0
    )
    if candidate <= now.astimezone(TZ):
        candidate += timedelta(days=1)
    return candidate


async def scheduler_loop(app):
    next_run = next_check_after(datetime.now(TZ))
    while True:
        now = datetime.now(TZ)
        if STATE["running"]:
            await asyncio.sleep(30)
            continue
        if now >= next_run:
            STATE["running"] = True
            await maybe_propose_next(app)
            next_run = next_check_after(now)
        else:
            await asyncio.sleep(min((next_run - now).total_seconds(), 300))


async def post_init(app):
    asyncio.create_task(scheduler_loop(app))


def main():
    # Python 3.14 dropped asyncio.get_event_loop()'s implicit loop creation on the main
    # thread — same guard as marketing/pinterest/bot.py, which python-telegram-bot 21.x's
    # run_polling() still relies on.
    try:
        asyncio.get_event_loop()
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())

    app = Application.builder().token(ENV["TELEGRAM_BOT_TOKEN"]).post_init(post_init).build()
    app.add_handler(CommandHandler("start", on_start))
    app.add_handler(CommandHandler("status", on_status))
    app.add_handler(CommandHandler("run", on_run))
    app.add_handler(CallbackQueryHandler(on_callback))
    logger.info(
        "Starting blog bot: daily_proposal_count=%s check_time=%02d:%02d UTC%+g",
        DAILY_PROPOSAL_COUNT, CHECK_HOUR, CHECK_MINUTE, float(ENV["CHECK_UTC_OFFSET"]),
    )
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
