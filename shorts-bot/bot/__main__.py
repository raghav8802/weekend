"""Command line: python -m bot <command>"""
from __future__ import annotations

import argparse
import logging
import os
import time
from pathlib import Path

from . import config, pipeline
from .db import DB

log = logging.getLogger("bot")


def load_env(path: Path):
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def main():
    ap = argparse.ArgumentParser(prog="python -m bot", description="Gameplay -> Shorts/Reels autopilot")
    ap.add_argument("--config", default="config.yaml")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("process", help="make clips from one YouTube URL or local video file")
    p.add_argument("source")
    p.add_argument("--no-ai", action="store_true", help="skip Claude (free test run, generic text)")
    w = sub.add_parser("watch", help="check channels + inbox once and process new videos")
    w.add_argument("--no-ai", action="store_true")
    sub.add_parser("post-next", help="post the best clip in the queue right now")
    sub.add_parser("queue", help="show clips and their status")
    sub.add_parser("auth-youtube", help="one-time YouTube login (needs a browser)")
    d = sub.add_parser("daemon", help="run forever: watch every hour, post at scheduled times")
    d.add_argument("--watch-every", type=int, default=60, help="minutes between channel checks")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    cfg_path = Path(args.config)
    load_env(cfg_path.resolve().parent / ".env")
    cfg = config.load(cfg_path)
    db = DB(cfg["paths"]["db"])

    if args.cmd == "process":
        ids = pipeline.process_source(cfg, db, args.source, use_ai=not args.no_ai)
        print(f"{len(ids)} clips ready in {cfg['paths']['clips']}")
    elif args.cmd == "watch":
        print(f"{pipeline.watch(cfg, db, use_ai=not args.no_ai)} new clips")
    elif args.cmd == "post-next":
        pipeline.post_next(cfg, db)
    elif args.cmd == "queue":
        for r in db.queue():
            print(f"#{r['id']:<4} {r['status']:<7} score {r['score']:>4.1f}  {r['title']}")
    elif args.cmd == "auth-youtube":
        from .publish import youtube

        youtube.authorize(cfg["root"] / cfg["publish"]["youtube"]["client_secrets"], cfg["paths"]["yt_token"])
        print("YouTube authorised; token saved to", cfg["paths"]["yt_token"])
    elif args.cmd == "daemon":
        last_watch = 0.0
        while True:
            try:
                if time.time() - last_watch >= args.watch_every * 60:
                    last_watch = time.time()
                    pipeline.watch(cfg, db)
                slot = pipeline.due_slot(cfg, db)
                if slot:
                    db.put("last_slot", slot)
                    pipeline.post_next(cfg, db)
            except Exception:
                log.exception("daemon loop error")
            time.sleep(60)


if __name__ == "__main__":
    main()
