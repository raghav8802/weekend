"""Step 4a: cheap, local "excitement" detection from audio loudness + scene-change rate.

No AI here: this ranks every second of the video so only the best ~12 windows are
sent on to Whisper and Claude. That is what keeps the bot cheap on a small machine.
"""
from __future__ import annotations

import re
import subprocess

import numpy as np

SR = 8000  # audio sample rate for analysis; loudness doesn't need more


def duration(path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out)


def audio_loudness(path) -> np.ndarray:
    """Loudness in dB for each second of the video."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        capture_output=True, check=True,
    ).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    n = len(x) // SR
    if n == 0:
        return np.zeros(1)
    rms = np.sqrt(np.mean(x[: n * SR].reshape(n, SR) ** 2, axis=1) + 1e-10)
    return 20 * np.log10(rms + 1e-10)


def scene_changes(path, seconds: int) -> np.ndarray:
    """Sum of scene-change scores for each second (fast cuts, explosions, chaos)."""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-an",
         "-vf", "fps=4,scale=320:-2,scdet=threshold=6", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    out = np.zeros(max(seconds, 1))
    for score, t in re.findall(r"lavfi\.scd\.score: ([\d.]+), lavfi\.scd\.time: ([\d.]+)", proc.stderr):
        i = int(float(t))
        if i < len(out):
            out[i] += float(score)
    return out


def _z(a: np.ndarray) -> np.ndarray:
    sd = a.std()
    return (a - a.mean()) / sd if sd > 1e-6 else np.zeros_like(a)


def _smooth(a: np.ndarray, k: int) -> np.ndarray:
    if len(a) < k:
        return a
    return np.convolve(a, np.ones(k) / k, mode="same")


def excitement(path, audio_weight=0.7, scene_weight=0.3) -> np.ndarray:
    loud = audio_loudness(path)
    secs = len(loud)
    # A spike matters more than steady noise: compare each second to the 30 s around it.
    background = _smooth(loud, 30)
    spikes = np.maximum(loud - background, 0)
    audio = 0.5 * _z(_smooth(loud, 3)) + 0.5 * _z(_smooth(spikes, 3))
    scene = _z(_smooth(scene_changes(path, secs)[:secs], 5))
    return _smooth(audio_weight * audio + scene_weight * scene, 5)


def candidates(score: np.ndarray, total: float, n: int, before: int, after: int, min_gap: int) -> list[dict]:
    """Pick the top-n peaks at least min_gap apart and turn each into a context window."""
    order = np.argsort(score)[::-1]
    peaks: list[int] = []
    for i in order:
        if all(abs(int(i) - p) >= min_gap for p in peaks):
            peaks.append(int(i))
        if len(peaks) >= n:
            break
    out = []
    for rank, p in enumerate(sorted(peaks)):
        start = max(0.0, p - before)
        end = min(total, p + after)
        out.append({
            "id": rank,
            "peak": float(p),
            "start": float(start),
            "end": float(end),
            "signal": round(float(score[p]), 2),
        })
    return out
