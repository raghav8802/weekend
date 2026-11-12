"""Tiny SQLite store: which videos were processed, which clips exist, what got posted."""
from __future__ import annotations

import json
import sqlite3
import time

SCHEMA = """
CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    source TEXT,
    title TEXT,
    channel TEXT,
    path TEXT,
    status TEXT,            -- new / done / failed
    error TEXT,
    created REAL
);
CREATE TABLE IF NOT EXISTS clips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT,
    start REAL,
    end REAL,
    path TEXT,
    hook TEXT,
    title TEXT,
    yt_description TEXT,
    ig_caption TEXT,
    hashtags TEXT,          -- JSON list
    score REAL,
    reason TEXT,
    status TEXT,            -- ready / posted / failed
    created REAL
);
CREATE TABLE IF NOT EXISTS posts (
    clip_id INTEGER,
    platform TEXT,
    remote_id TEXT,
    status TEXT,            -- ok / failed
    error TEXT,
    posted_at REAL,
    UNIQUE (clip_id, platform)
);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
"""


class DB:
    def __init__(self, path):
        self.conn = sqlite3.connect(str(path))
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)

    # videos
    def seen(self, video_id: str) -> bool:
        return self.conn.execute("SELECT 1 FROM videos WHERE id=?", (video_id,)).fetchone() is not None

    def add_video(self, video_id, source, title, channel, path):
        self.conn.execute(
            "INSERT OR REPLACE INTO videos VALUES (?,?,?,?,?,?,?,?)",
            (video_id, source, title, channel, str(path), "new", None, time.time()),
        )
        self.conn.commit()

    def set_video_status(self, video_id, status, error=None):
        self.conn.execute("UPDATE videos SET status=?, error=? WHERE id=?", (status, error, video_id))
        self.conn.commit()

    # clips
    def add_clip(self, video_id, c: dict, path) -> int:
        cur = self.conn.execute(
            "INSERT INTO clips (video_id,start,end,path,hook,title,yt_description,ig_caption,"
            "hashtags,score,reason,status,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (video_id, c["start"], c["end"], str(path), c["hook"], c["title"], c["yt_description"],
             c["ig_caption"], json.dumps(c["hashtags"]), c["score"], c["reason"], "ready", time.time()),
        )
        self.conn.commit()
        return cur.lastrowid

    def next_clip(self):
        # Best-scoring ready clip; ties go to the oldest so the queue keeps moving.
        return self.conn.execute(
            "SELECT * FROM clips WHERE status='ready' ORDER BY score DESC, created ASC LIMIT 1"
        ).fetchone()

    def queue(self):
        return self.conn.execute(
            "SELECT id, score, status, title, path FROM clips ORDER BY status, score DESC"
        ).fetchall()

    def set_clip_status(self, clip_id, status):
        self.conn.execute("UPDATE clips SET status=? WHERE id=?", (status, clip_id))
        self.conn.commit()

    # posts
    def posted(self, clip_id, platform) -> bool:
        return self.conn.execute(
            "SELECT 1 FROM posts WHERE clip_id=? AND platform=? AND status='ok'", (clip_id, platform)
        ).fetchone() is not None

    def record_post(self, clip_id, platform, remote_id, status, error=None):
        self.conn.execute(
            "INSERT OR REPLACE INTO posts VALUES (?,?,?,?,?,?)",
            (clip_id, platform, remote_id, status, error, time.time()),
        )
        self.conn.commit()

    # key/value
    def get(self, k, default=None):
        row = self.conn.execute("SELECT v FROM kv WHERE k=?", (k,)).fetchone()
        return row["v"] if row else default

    def put(self, k, v):
        self.conn.execute("INSERT OR REPLACE INTO kv VALUES (?,?)", (k, str(v)))
        self.conn.commit()
