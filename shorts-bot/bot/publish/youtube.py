"""Upload a clip as a YouTube Short through the official YouTube Data API v3."""
from __future__ import annotations

import logging
from pathlib import Path

log = logging.getLogger(__name__)
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def authorize(client_secrets: Path, token_path: Path):
    """One-time login in a browser. Run `python -m bot auth-youtube` on a machine with a browser."""
    from google_auth_oauthlib.flow import InstalledAppFlow

    flow = InstalledAppFlow.from_client_secrets_file(str(client_secrets), SCOPES)
    creds = flow.run_local_server(port=0)
    token_path.write_text(creds.to_json())
    return creds


def _creds(token_path: Path):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    if not token_path.exists():
        raise RuntimeError("YouTube not authorised yet: run `python -m bot auth-youtube`")
    creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
    if not creds.valid:
        creds.refresh(Request())
        token_path.write_text(creds.to_json())
    return creds


def upload(clip, ycfg: dict, token_path: Path, extra_description: str = "") -> str:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    import json

    tags = json.loads(clip["hashtags"])
    title = clip["title"][:90].strip()
    if "#shorts" not in title.lower():
        title = f"{title} #Shorts"
    description = "\n\n".join(x for x in [clip["yt_description"], extra_description, " ".join(tags)] if x)
    body = {
        "snippet": {
            "title": title[:100],
            "description": description[:4900],
            "tags": [t.lstrip("#") for t in tags][:15],
            "categoryId": ycfg["category_id"],
        },
        "status": {"privacyStatus": ycfg["privacy"], "selfDeclaredMadeForKids": False},
    }
    yt = build("youtube", "v3", credentials=_creds(token_path), cache_discovery=False)
    media = MediaFileUpload(clip["path"], mimetype="video/mp4", chunksize=8 * 1024 * 1024, resumable=True)
    req = yt.videos().insert(part="snippet,status", body=body, media_body=media)
    resp = None
    while resp is None:
        status, resp = req.next_chunk()
        if status:
            log.info("youtube upload %d%%", int(status.progress() * 100))
    return resp["id"]
