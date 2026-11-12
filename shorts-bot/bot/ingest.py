"""Step 1-2: find new videos (channel RSS feeds or a local inbox folder) and download them."""
from __future__ import annotations

import hashlib
import logging
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

log = logging.getLogger(__name__)

NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
VIDEO_EXT = {".mp4", ".mkv", ".mov", ".webm", ".avi"}


def feed_entries(channel_id: str) -> list[dict]:
    """Latest ~15 uploads of a channel. Free, no API key, no quota."""
    url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    with urllib.request.urlopen(url, timeout=30) as r:
        root = ET.fromstring(r.read())
    out = []
    for e in root.findall("a:entry", NS):
        out.append({
            "id": e.findtext("yt:videoId", namespaces=NS),
            "title": e.findtext("a:title", namespaces=NS) or "",
            "channel": e.findtext("a:author/a:name", namespaces=NS) or "",
            "published": datetime.fromisoformat(e.findtext("a:published", namespaces=NS)),
            "url": e.find("a:link", NS).attrib["href"],
        })
    return out


def new_feed_videos(cfg: dict, db) -> list[dict]:
    src = cfg["sources"]
    keywords = [k.lower() for k in src["title_keywords"]]
    cutoff = datetime.now(timezone.utc) - timedelta(days=src["max_video_age_days"])
    found = []
    for ch in src["channels"]:
        try:
            entries = feed_entries(ch)
        except Exception as e:  # one bad channel shouldn't stop the rest
            log.warning("feed %s failed: %s", ch, e)
            continue
        for v in entries:
            if db.seen(v["id"]) or v["published"] < cutoff or "/shorts/" in v["url"]:
                continue
            if keywords and not any(k in v["title"].lower() for k in keywords):
                continue
            found.append(v)
    return found


def download(url: str, out_dir: Path, max_minutes: int) -> dict:
    import yt_dlp

    opts = {
        "format": "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b",
        "merge_output_format": "mp4",
        "outtmpl": str(out_dir / "%(id)s.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "match_filter": yt_dlp.utils.match_filter_func(f"duration <= {max_minutes * 60}"),
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if info is None:
            raise RuntimeError("video skipped (too long or unavailable)")
        path = Path(ydl.prepare_filename(info)).with_suffix(".mp4")
    if not path.exists():
        raise RuntimeError(f"download finished but {path} is missing")
    return {
        "id": info["id"],
        "title": info.get("title", ""),
        "channel": info.get("channel") or info.get("uploader") or "",
        "path": path,
        "url": url,
    }


def local_video(path: Path) -> dict:
    h = hashlib.sha1(f"{path.resolve()}:{path.stat().st_size}".encode()).hexdigest()[:12]
    title = re.sub(r"[_\-]+", " ", path.stem).strip()
    return {"id": f"local-{h}", "title": title, "channel": "", "path": path, "url": str(path)}


def inbox_videos(cfg: dict, db) -> list[dict]:
    out = []
    for p in sorted(cfg["paths"]["inbox"].iterdir()):
        if p.suffix.lower() in VIDEO_EXT:
            v = local_video(p)
            if not db.seen(v["id"]):
                out.append(v)
    return out
