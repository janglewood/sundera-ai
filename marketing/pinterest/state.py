"""Persisted state for bot.py's daily approval cycle — a single JSON blob in
SQLite (not a normalized schema: there's exactly one daemon, one chat, one
cycle in flight at a time, so a single-row store is the simplest thing that
survives a Railway restart without losing progress mid-day).
"""
import json
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("BOT_STATE_DB", os.path.join(HERE, "bot_state.db"))

DEFAULT_STATE = {
    "date": None,  # "YYYY-MM-DD" (schedule timezone) the current/last cycle belongs to
    "stage": "idle",  # idle | candidates | generating | done
    "slot_index": 0,
    "excluded_ids": [],  # photo ids already shown today (approved or rejected) — no repeats within a day
    "approved_slots": [],  # {"room_type"} of slots completed (uploaded) so far today — steers
                           # pick_next_candidate's avoid_room_types toward variety within a batch
    "current": None,  # dict describing the single pending item, or None
    "next_run_at": None,  # ISO datetime string; when stage is idle/done, when to start the next cycle
    "refill_stage": "idle",  # idle | awaiting_confirmation | running — see refill_pool.py / bot.py's refill_scheduler_loop
    "last_refill_check_date": None,  # "YYYY-MM-DD" — the REFILL_CHECK_TIME check only fires once/day
}


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
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
