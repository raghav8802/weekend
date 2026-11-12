"""Step 4b: Whisper, run only on the candidate windows (not the whole video)."""
from __future__ import annotations

import subprocess
import tempfile
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def _model(name: str, device: str, compute_type: str):
    from faster_whisper import WhisperModel

    return WhisperModel(name, device=device, compute_type=compute_type)


def transcribe_window(path, start: float, end: float, tcfg: dict) -> dict:
    """Returns {"segments": [{start,end,text}], "words": [{start,end,word}]} in video time."""
    model = _model(tcfg["model"], tcfg["device"], tcfg["compute_type"])
    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / "w.wav"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-t", f"{end - start:.2f}",
             "-i", str(path), "-vn", "-ac", "1", "-ar", "16000", str(wav)],
            check=True,
        )
        segs, _info = model.transcribe(
            str(wav), word_timestamps=True, vad_filter=True, language=tcfg.get("language"),
        )
        segments, words = [], []
        for s in segs:
            segments.append({"start": s.start + start, "end": s.end + start, "text": s.text.strip()})
            for w in s.words or []:
                words.append({"start": w.start + start, "end": w.end + start, "word": w.word.strip()})
    return {"segments": segments, "words": words}


def merge_windows(cands: list[dict]) -> list[tuple[float, float]]:
    """Overlapping candidate windows are transcribed once."""
    spans = sorted((c["start"], c["end"]) for c in cands)
    merged: list[list[float]] = []
    for s, e in spans:
        if merged and s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    return [(s, e) for s, e in merged]


def transcribe_candidates(path, cands: list[dict], tcfg: dict) -> dict:
    segments, words = [], []
    for s, e in merge_windows(cands):
        r = transcribe_window(path, s, e, tcfg)
        segments += r["segments"]
        words += r["words"]
    return {"segments": segments, "words": words}
