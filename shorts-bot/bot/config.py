"""Loads config.yaml, fills in defaults, and reads secrets from the environment."""
from __future__ import annotations

import copy
import os
from pathlib import Path

import yaml

DEFAULTS: dict = {
    "data_dir": "data",
    "sources": {
        # YouTube channel IDs (UC...) to watch through their free RSS feed.
        # Only list channels you own or have permission to clip.
        "channels": [],
        # Only process uploads whose title contains one of these (case-insensitive). Empty = all.
        "title_keywords": ["gta 6", "gta vi", "gta6"],
        "max_video_age_days": 3,
        "max_video_minutes": 180,
        # Drop your own recordings here; each new file gets processed.
        "inbox_dir": "inbox",
    },
    "detect": {
        "candidates": 12,          # windows sent to Whisper + Claude
        "window_before": 35,       # seconds of context before a peak
        "window_after": 25,        # seconds of context after a peak
        "min_gap": 45,             # seconds between candidate peaks
        "audio_weight": 0.7,
        "scene_weight": 0.3,
    },
    "transcribe": {
        "model": "small",          # tiny / base / small / medium / large-v3
        "device": "auto",          # cpu / cuda / auto
        "compute_type": "int8",
        "language": None,          # e.g. "en", "hi"; None = auto-detect
    },
    "brain": {
        "model": "claude-opus-5-5",
        "effort": "medium",
        "clips_per_video": 4,
        "min_clip_seconds": 15,
        "max_clip_seconds": 55,
        "vision_frames": 3,        # small frames per candidate so Claude can "see" the action
        "niche": "GTA 6 gameplay",
        "base_hashtags": ["#GTA6", "#GTAVI", "#GTA", "#Gaming"],
        "language": "English",
        "credit_source": True,     # adds "Gameplay: <channel>" to descriptions
    },
    "render": {
        "width": 1080,
        "height": 1920,
        "fg_zoom": 1.25,           # >1 crops the sides of 16:9 footage so the action is bigger
        "font": "Arial",
        "hook_seconds": 2.8,
        "caption_words": 3,        # max words on screen at once
        "crf": 20,
        "preset": "medium",
        "loudness": -14,
    },
    "publish": {
        "youtube": {
            "enabled": True,
            "privacy": "public",   # public / unlisted / private
            "category_id": "20",   # Gaming
            "client_secrets": "client_secret.json",
        },
        "instagram": {
            "enabled": True,
            "graph_version": "v23.0",
            "share_to_feed": True,
        },
        "schedule": {
            "timezone": "Asia/Kolkata",
            "times": ["11:00", "16:00", "20:30"],
        },
    },
}


def _merge(base: dict, override: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def load(path: str | os.PathLike = "config.yaml") -> dict:
    p = Path(path)
    user = yaml.safe_load(p.read_text()) if p.exists() else {}
    cfg = _merge(DEFAULTS, user or {})
    root = p.resolve().parent
    cfg["root"] = root
    data = (root / cfg["data_dir"]).resolve()
    cfg["paths"] = {
        "data": data,
        "downloads": data / "downloads",
        "work": data / "work",
        "clips": data / "clips",
        "db": data / "bot.sqlite3",
        "yt_token": data / "youtube_token.json",
        "inbox": (root / cfg["sources"]["inbox_dir"]).resolve(),
    }
    for key in ("downloads", "work", "clips", "inbox"):
        cfg["paths"][key].mkdir(parents=True, exist_ok=True)
    cfg["secrets"] = {
        "ig_user_id": os.environ.get("IG_USER_ID", ""),
        "ig_access_token": os.environ.get("IG_ACCESS_TOKEN", ""),
    }
    return cfg
