"""Persisted state for bot.py's daily approval cycle — a single JSON blob in
SQLite (not a normalized schema: there's exactly one daemon, one chat, one
cycle in flight at a time, so a single-row store is the simplest thing that
survives a Railway restart without losing progress mid-day).

Also holds an append-only `decisions` table logging every candidate
approve/reject (see log_decision/load_decisions) — the input to
pipeline.build_preference_model(), which biases future candidate photo
picks toward what Anton tends to approve (see CLAUDE.md "self-learning
candidate picking").
"""
import json
import os
import sqlite3
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("BOT_STATE_DB", os.path.join(HERE, "bot_state.db"))

DEFAULT_STATE = {
    "date": None,  # "YYYY-MM-DD" (schedule timezone) the current/last cycle belongs to
    "stage": "idle",  # idle | candidates | generating | done
    "slot_index": 0,
    "excluded_ids": [],  # photo ids already shown today (approved or rejected) — no repeats within a day
    "approved_slots": [],  # finished candidate info for stage 1 -> feeds stage 2, in order
    "current": None,  # dict describing the single pending item, or None
    "next_run_at": None,  # ISO datetime string; when stage is idle/done, when to start the next cycle
}


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    conn.execute(
        "CREATE TABLE IF NOT EXISTS decisions ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, photo_id INTEGER NOT NULL, room_type TEXT NOT NULL, "
        "query TEXT, alt TEXT, approved INTEGER NOT NULL, ts TEXT NOT NULL)"
    )
    return conn


def load():
    conn = _connect()
    try:
        row = conn.execute("SELECT value FROM kv WHERE key = 'state'").fetchone()
        if row:
            state = dict(DEFAULT_STATE)
            state.update(json.loads(row[0]))
            return state
        return dict(DEFAULT_STATE)
    finally:
        conn.close()


def save(state):
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO kv (key, value) VALUES ('state', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (json.dumps(state),),
        )
        conn.commit()
    finally:
        conn.close()


def log_decision(photo_id, room_type, query, alt, approved):
    """Record a stage-1 candidate approve/reject. photo_id/room_type/query/alt come
    straight from the manifest.json entry (see pexels_collect.py) for that photo."""
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO decisions (photo_id, room_type, query, alt, approved, ts) VALUES (?, ?, ?, ?, ?, ?)",
            (photo_id, room_type, query, alt, int(approved), datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
    finally:
        conn.close()


def load_decisions():
    conn = _connect()
    try:
        rows = conn.execute("SELECT photo_id, room_type, query, alt, approved FROM decisions").fetchall()
        return [
            {"photo_id": r[0], "room_type": r[1], "query": r[2], "alt": r[3], "approved": bool(r[4])}
            for r in rows
        ]
    finally:
        conn.close()
