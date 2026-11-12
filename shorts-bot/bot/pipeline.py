"""Glues the steps together: video -> candidates -> transcript -> Claude -> rendered clips -> queue -> post."""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from . import brain, ingest, render, signals, transcribe
from .db import DB

log = logging.getLogger(__name__)


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "clip"


def fallback_clips(cfg, cands, transcript) -> list[dict]:
    """--no-ai mode: use the loudest windows as-is with a generic hook. Free, for testing."""
    b = cfg["brain"]
    best = sorted(cands, key=lambda c: -c["signal"])
    raw = [{
        "candidate_id": c["id"],
        "start": max(c["start"], c["peak"] - 12),
        "end": min(c["end"], c["peak"] + 14),
        "hook": "Wait for it",
        "title": "GTA 6 moment you have to see",
        "yt_description": "Would you have survived this?",
        "ig_caption": "Would you have survived this? 👀 Follow for daily GTA 6 clips",
        "hashtags": ["#GTA6Gameplay", "#GTAOnline", "#ViceCity", "#GamingClips"],
        "score": c["signal"],
        "reason": "highest local signal",
    } for c in best]
    return brain.validate(raw, cands, transcript, cfg)


def process_video(cfg: dict, db: DB, video: dict, use_ai: bool = True) -> list[int]:
    path = video["path"]
    d = cfg["detect"]
    log.info("analysing %s", video["title"] or path)
    total = signals.duration(path)
    score = signals.excitement(path, d["audio_weight"], d["scene_weight"])
    cands = signals.candidates(score, total, d["candidates"], d["window_before"], d["window_after"], d["min_gap"])
    log.info("%d candidate moments; transcribing only those windows", len(cands))
    transcript = transcribe.transcribe_candidates(path, cands, cfg["transcribe"])

    clips = (brain.pick_clips(cfg, path, video["title"], cands, transcript) if use_ai
             else fallback_clips(cfg, cands, transcript))
    log.info("%d clips chosen", len(clips))

    ids = []
    for i, c in enumerate(clips):
        out = cfg["paths"]["clips"] / f"{_slug(video['id'])}-{i + 1}-{_slug(c['title'])}.mp4"
        render.render_clip(path, c["start"], c["end"], c["hook"], transcript["words"], out,
                           cfg["render"], cfg["paths"]["work"])
        ids.append(db.add_clip(video["id"], c, out))
        log.info("rendered %s (score %.1f): %s", out.name, c["score"], c["title"])
    return ids


def ingest_and_process(cfg, db, video: dict, use_ai=True):
    db.add_video(video["id"], video["url"], video["title"], video["channel"], video["path"])
    try:
        ids = process_video(cfg, db, video, use_ai)
        db.set_video_status(video["id"], "done")
        return ids
    except Exception as e:
        db.set_video_status(video["id"], "failed", str(e))
        raise


def process_source(cfg, db, source: str, use_ai=True):
    from pathlib import Path

    p = Path(source)
    if p.exists():
        video = ingest.local_video(p)
    else:
        video = ingest.download(source, cfg["paths"]["downloads"], cfg["sources"]["max_video_minutes"])
    return ingest_and_process(cfg, db, video, use_ai)


def watch(cfg, db, use_ai=True) -> int:
    """Check channel feeds and the inbox folder; process anything new."""
    made = 0
    todo = ingest.inbox_videos(cfg, db)
    for v in ingest.new_feed_videos(cfg, db):
        try:
            todo.append(ingest.download(v["url"], cfg["paths"]["downloads"], cfg["sources"]["max_video_minutes"]))
        except Exception as e:
            log.warning("download %s failed: %s", v["url"], e)
            db.add_video(v["id"], v["url"], v["title"], v["channel"], "")
            db.set_video_status(v["id"], "failed", str(e))
    for v in todo:
        try:
            made += len(ingest_and_process(cfg, db, v, use_ai))
        except Exception as e:
            log.exception("processing %s failed: %s", v["id"], e)
    return made


# ---------- posting ----------

def post_clip(cfg, db, clip) -> bool:
    from .publish import instagram, youtube

    pub = cfg["publish"]
    video = db.conn.execute("SELECT * FROM videos WHERE id=?", (clip["video_id"],)).fetchone()
    credit = ""
    if cfg["brain"]["credit_source"] and video and video["channel"]:
        credit = f"Gameplay: {video['channel']}"
    all_ok = True
    platforms = []
    if pub["youtube"]["enabled"]:
        platforms.append(("youtube", lambda: youtube.upload(clip, pub["youtube"], cfg["paths"]["yt_token"], credit)))
    if pub["instagram"]["enabled"]:
        platforms.append(("instagram", lambda: instagram.upload(
            clip, pub["instagram"], cfg["secrets"]["ig_user_id"], cfg["secrets"]["ig_access_token"])))
    for name, fn in platforms:
        if db.posted(clip["id"], name):
            continue
        try:
            rid = fn()
            db.record_post(clip["id"], name, rid, "ok")
            log.info("posted clip %s to %s: %s", clip["id"], name, rid)
        except Exception as e:
            all_ok = False
            db.record_post(clip["id"], name, None, "failed", str(e))
            log.error("posting clip %s to %s failed: %s", clip["id"], name, e)
    if all_ok:
        db.set_clip_status(clip["id"], "posted")
    else:
        fails = int(db.get(f"fails:{clip['id']}", 0)) + 1
        db.put(f"fails:{clip['id']}", fails)
        if fails >= 3:
            db.set_clip_status(clip["id"], "failed")
    return all_ok


def post_next(cfg, db) -> bool:
    clip = db.next_clip()
    if not clip:
        log.info("queue is empty")
        return False
    return post_clip(cfg, db, clip)


def due_slot(cfg, db, now: datetime | None = None) -> str | None:
    """Return the key of a posting slot that has arrived and hasn't been used yet."""
    sch = cfg["publish"]["schedule"]
    tz = ZoneInfo(sch["timezone"])
    now = now or datetime.now(tz)
    for hhmm in sorted(sch["times"], reverse=True):
        h, m = map(int, hhmm.split(":"))
        slot = now.replace(hour=h, minute=m, second=0, microsecond=0)
        if slot <= now:
            key = slot.strftime("%Y-%m-%d %H:%M")
            # only catch up on a slot within 2 hours; otherwise wait for the next one
            if db.get("last_slot") != key and now - slot < timedelta(hours=2):
                return key
            return None
    return None
