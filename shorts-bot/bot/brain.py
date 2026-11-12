"""Step 4c + 6: one Claude call per video picks the best clips and writes the hook, title, captions and hashtags."""
from __future__ import annotations

import base64
import json
import logging
import subprocess

import anthropic

log = logging.getLogger(__name__)

SCHEMA = {
    "type": "object",
    "properties": {
        "clips": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "candidate_id": {"type": "integer"},
                    "start": {"type": "number"},
                    "end": {"type": "number"},
                    "hook": {"type": "string"},
                    "title": {"type": "string"},
                    "yt_description": {"type": "string"},
                    "ig_caption": {"type": "string"},
                    "hashtags": {"type": "array", "items": {"type": "string"}},
                    "score": {"type": "number"},
                    "reason": {"type": "string"},
                },
                "required": ["candidate_id", "start", "end", "hook", "title", "yt_description",
                             "ig_caption", "hashtags", "score", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["clips"],
    "additionalProperties": False,
}

SYSTEM = """You are the editor of a fast-growing short-form channel about {niche}.
You get candidate moments from one long video. A local detector found them from loudness spikes \
and fast scene changes; each comes with its signal score, the speech in it (if any) and a few frames.

Pick the {n} moments most likely to stop someone scrolling, and turn each into a vertical short.

Choosing and trimming:
- Prefer payoff moments: chaos, crashes, explosions, police chases, funny fails, clutch escapes, \
big reactions, surprising game details. Skip menus, loading screens, cutscene filler and quiet driving.
- start/end are absolute seconds in the source video and must stay inside the candidate's window.
- Length {min_s}-{max_s} s. Start 1-3 s before the action so it lands immediately; end right after \
the payoff or reaction. Never cut mid-sentence when someone is talking.
- If nothing in a candidate is good, leave it out. Fewer great clips beat more weak ones.

Writing (language: {language}):
- hook: 3-7 words burned on screen for the first 3 seconds. Curiosity or stakes, not a summary. \
Plain text only, no emoji, no hashtags. Example styles: "He did NOT see this coming", \
"GTA 6 police are insane", "Wait for the ending".
- title: under 70 characters, punchy, includes "GTA 6" naturally. No hashtags in the title.
- yt_description: 1-2 short lines plus a question that invites comments.
- ig_caption: 1-2 lines with 1-2 emoji and a call to comment or follow.
- hashtags: 5-8 relevant tags starting with #, mixing broad and specific. Don't repeat these, \
they are added automatically: {base_tags}
- score: 1-10, your honest estimate of viral potential. reason: one short line on why.
Never invent things that aren't in the footage or speech."""


def _frames(path, times: list[float], width=480) -> list[str]:
    out = []
    for t in times:
        jpg = subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", f"{max(t, 0):.2f}", "-i", str(path), "-frames:v", "1",
             "-vf", f"scale={width}:-2", "-q:v", "6", "-f", "image2pipe", "-vcodec", "mjpeg", "-"],
            capture_output=True,
        ).stdout
        if jpg:
            out.append(base64.b64encode(jpg).decode())
    return out


def _fmt(t: float) -> str:
    return f"{t:.1f}"


def build_content(path, video_title: str, cands: list[dict], transcript: dict, n_frames: int) -> list:
    content: list = [{"type": "text", "text": f"Source video title: {video_title}\n"
                                              f"{len(cands)} candidate moments follow."}]
    for c in cands:
        lines = [f"[{_fmt(s['start'])}-{_fmt(s['end'])}] {s['text']}"
                 for s in transcript["segments"] if s["end"] > c["start"] and s["start"] < c["end"]]
        speech = "\n".join(lines) if lines else "(no speech - judge from the frames and the signal)"
        content.append({"type": "text", "text":
                        f"\n### Candidate {c['id']}\nwindow: {_fmt(c['start'])}-{_fmt(c['end'])} s, "
                        f"loudest/busiest at {_fmt(c['peak'])} s, signal score {c['signal']}\n"
                        f"speech:\n{speech}"})
        if n_frames:
            span = c["end"] - c["start"]
            times = [c["start"] + span * (k + 1) / (n_frames + 1) for k in range(n_frames)]
            for t, b64 in zip(times, _frames(path, times)):
                content.append({"type": "text", "text": f"frame at {_fmt(t)} s:"})
                content.append({"type": "image",
                                "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}})
    return content


def pick_clips(cfg: dict, path, video_title: str, cands: list[dict], transcript: dict) -> list[dict]:
    b = cfg["brain"]
    system = SYSTEM.format(
        niche=b["niche"], n=b["clips_per_video"], min_s=b["min_clip_seconds"],
        max_s=b["max_clip_seconds"], language=b["language"], base_tags=" ".join(b["base_hashtags"]),
    )
    client = anthropic.Anthropic()
    with client.beta.messages.stream(
        model=b["model"],
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",  # if the model declines, the API retries on a fallback model
        thinking={"type": "adaptive"},
        output_config={"effort": b["effort"], "format": {"type": "json_schema", "schema": SCHEMA}},
        system=system,
        messages=[{"role": "user", "content": build_content(path, video_title, cands, transcript,
                                                            b["vision_frames"])}],
    ) as stream:
        msg = stream.get_final_message()

    if msg.stop_reason == "refusal":
        raise RuntimeError(f"Claude declined: {msg.stop_details}")
    if msg.stop_reason == "max_tokens":
        raise RuntimeError("Claude ran out of output tokens")
    u = msg.usage
    log.info("claude usage: in=%s out=%s", u.input_tokens, u.output_tokens)
    text = next(blk.text for blk in msg.content if blk.type == "text")
    return validate(json.loads(text)["clips"], cands, transcript, cfg)


def validate(clips: list[dict], cands: list[dict], transcript: dict, cfg: dict) -> list[dict]:
    """Keep clips inside their windows, within length limits, not overlapping, not cutting a word."""
    b = cfg["brain"]
    by_id = {c["id"]: c for c in cands}
    base = [t.lower() for t in b["base_hashtags"]]
    out: list[dict] = []
    for c in sorted(clips, key=lambda x: -x["score"]):
        w = by_id.get(c["candidate_id"])
        if not w:
            continue
        start = max(w["start"], float(c["start"]))
        end = min(w["end"], float(c["end"]))
        # don't end in the middle of a word
        for word in transcript["words"]:
            if word["start"] < end < word["end"]:
                end = min(word["end"] + 0.3, w["end"])
        if end - start > b["max_clip_seconds"]:
            end = start + b["max_clip_seconds"]
        if end - start < b["min_clip_seconds"]:
            continue
        if any(start < o["end"] and end > o["start"] for o in out):
            continue
        tags = ["#" + t.lstrip("#").replace(" ", "") for t in c["hashtags"]]
        tags = [t for t in dict.fromkeys(tags) if t.lower() not in base]
        out.append({**c, "start": round(start, 2), "end": round(end, 2),
                    "hashtags": list(b["base_hashtags"]) + tags})
        if len(out) >= b["clips_per_video"]:
            break
    return out
