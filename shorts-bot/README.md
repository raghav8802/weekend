# Shorts Bot: gameplay to YouTube Shorts and Instagram Reels on autopilot

It takes long gameplay videos, finds the best moments, edits them into vertical clips
with a hook and word-by-word captions, writes the title, caption and hashtags, and posts on a schedule.

```
find video → download → detect moments (local, free) → transcribe only those moments (local, free)
          → Claude picks the best clips + writes the copy (~$0.10–0.20 per video)
          → render 9:16 with hook + captions → queue → post to YouTube Shorts + Instagram Reels
```

## ⚠️ Copyright first
Reposting other creators' gameplay without permission gets copyright strikes, and three strikes
delete a channel. It is also flagged as "reused content", which can't earn money. Use
**your own recordings** (drop them in `inbox/`), or channels that **gave you permission**.
`credit_source: true` adds "Gameplay: <channel>" to descriptions, but credit is not permission.

## 1. Install (once)
You need Python 3.10+ and ffmpeg (`sudo apt install ffmpeg`, `brew install ffmpeg`, or ffmpeg.org on Windows).

```bash
cd shorts-bot
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp config.example.yaml config.yaml
cp .env.example .env
```

Put your Anthropic API key (console.anthropic.com) in `.env`.

## 2. Try it (no posting yet)
```bash
python -m bot process path/to/my_gameplay.mp4          # or a YouTube URL you have rights to
python -m bot process my_gameplay.mp4 --no-ai          # free test: skips Claude, generic text
python -m bot queue
```
Clips land in `data/clips/`. Watch a few and adjust `config.yaml` (clip length, zoom, font, language).
The first run downloads the Whisper model (~500 MB for `small`).

## 3. Connect YouTube
1. In console.cloud.google.com, create a project, then enable **YouTube Data API v3**.
2. Go to **APIs & Services → OAuth consent screen**: choose External and add yourself as a test user.
3. Go to **Credentials → Create OAuth client ID → Desktop app**, download the JSON and save it as `shorts-bot/client_secret.json`.
4. Run `python -m bot auth-youtube` on a computer with a browser and log in with the channel's account.
   This saves `data/youtube_token.json`. If the bot runs on a server, copy that file there.

The default quota allows about **6 uploads a day**. Google raises it for free on request.
Uploads from an unverified Google app may be locked to **private** until the app passes Google's API audit.
Start with `privacy: private` and apply for the audit early.

## 4. Connect Instagram
1. Switch your Instagram to a **Business or Creator** account and link it to a Facebook Page.
2. At developers.facebook.com, create an app and add the **Instagram Graph API** product.
3. In the Graph API Explorer, get a token with `instagram_basic`, `instagram_content_publish` and `pages_show_list`,
   then exchange it for a **long-lived token** (lasts ~60 days, so renew it before it expires).
4. Find your IG user ID with `GET /me/accounts?fields=instagram_business_account`.
5. Put `IG_USER_ID` and `IG_ACCESS_TOKEN` in `.env`.

Disable a platform with `enabled: false` in `config.yaml`.

## 5. Run it on autopilot
```bash
python -m bot daemon
```
It checks your channels and `inbox/` every hour, and posts the best clip in the queue at each
time in `publish.schedule.times`. Keep it running with `tmux`, `systemd` or Task Scheduler. Or use cron instead:
```
0 * * * *    cd /path/to/shorts-bot && .venv/bin/python -m bot watch
0 11,16,20 * * * cd /path/to/shorts-bot && .venv/bin/python -m bot post-next
```

## Commands
| command | what it does |
|---|---|
| `process <url or file> [--no-ai]` | make clips from one video |
| `watch [--no-ai]` | check channels + inbox once |
| `post-next` | post the best queued clip now |
| `queue` | list clips and their status |
| `auth-youtube` | one-time YouTube login |
| `daemon` | run forever |

## Costs
- Claude: ~$0.10–0.20 per source video (one request: candidate transcripts plus 3 small frames each). Set `vision_frames: 0` to cut cost by about a third.
- Everything else is free: Whisper and ffmpeg run on your machine, and the YouTube and Instagram APIs cost nothing.
- Only ~12 short windows are transcribed instead of the whole video, so a cheap CPU-only machine works.

## Growth tips
- Post consistently: 2–3 a day beats 10 one day and nothing the next.
- Check YouTube Studio after a week. If retention drops in the first 3 seconds, make hooks stronger
  (edit `SYSTEM` in `bot/brain.py`) or shorten `max_clip_seconds`.
- Your own commentary or reactions make clips both better and copyright-safe.

## Files
`bot/ingest.py` find and download · `bot/signals.py` loudness and scene-change detection ·
`bot/transcribe.py` Whisper on candidate windows · `bot/brain.py` Claude picks clips and writes copy ·
`bot/render.py` 9:16 edit, hook and captions · `bot/publish/` YouTube and Instagram · `bot/pipeline.py` glue ·
`bot/db.py` SQLite queue.
