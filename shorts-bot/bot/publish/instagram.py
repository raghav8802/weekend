"""Publish a clip as an Instagram Reel through the official Instagram Graph API.

Needs an Instagram Business/Creator account linked to a Facebook Page, plus
IG_USER_ID and a long-lived IG_ACCESS_TOKEN (instagram_content_publish permission).
Uses resumable upload, so the video does not need to be hosted anywhere public.
"""
from __future__ import annotations

import json
import logging
import os
import time

import requests

log = logging.getLogger(__name__)


def upload(clip, icfg: dict, ig_user_id: str, token: str) -> str:
    if not (ig_user_id and token):
        raise RuntimeError("set IG_USER_ID and IG_ACCESS_TOKEN in your .env")
    base = f"https://graph.facebook.com/{icfg['graph_version']}"
    tags = " ".join(json.loads(clip["hashtags"]))
    caption = f"{clip['ig_caption']}\n\n{tags}"[:2200]

    # 1. create a Reels container
    r = requests.post(f"{base}/{ig_user_id}/media", data={
        "media_type": "REELS",
        "upload_type": "resumable",
        "caption": caption,
        "share_to_feed": "true" if icfg["share_to_feed"] else "false",
        "access_token": token,
    }, timeout=60)
    r.raise_for_status()
    container = r.json()["id"]

    # 2. upload the file bytes
    size = os.path.getsize(clip["path"])
    upload_url = f"https://rupload.facebook.com/ig-api-upload/{icfg['graph_version']}/{container}"
    with open(clip["path"], "rb") as f:
        r = requests.post(upload_url, data=f, timeout=600, headers={
            "Authorization": f"OAuth {token}",
            "offset": "0",
            "file_size": str(size),
        })
    r.raise_for_status()

    # 3. wait for Instagram to process it
    for _ in range(60):
        s = requests.get(f"{base}/{container}", params={
            "fields": "status_code,status", "access_token": token}, timeout=30).json()
        code = s.get("status_code")
        if code == "FINISHED":
            break
        if code in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"instagram processing failed: {s}")
        time.sleep(10)
    else:
        raise RuntimeError("instagram processing timed out")

    # 4. publish
    r = requests.post(f"{base}/{ig_user_id}/media_publish",
                      data={"creation_id": container, "access_token": token}, timeout=60)
    r.raise_for_status()
    return r.json()["id"]
