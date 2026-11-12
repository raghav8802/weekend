"""Step 5: cut the clip, make it 9:16, burn in the hook and word-by-word captions, normalise loudness."""
from __future__ import annotations

import subprocess
from pathlib import Path


def _ts(t: float) -> str:
    t = max(t, 0)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def _esc(text: str) -> str:
    return text.replace("\\", "/").replace("{", "(").replace("}", ")").replace("\n", " ")


def build_ass(hook: str, words: list[dict], clip_len: float, r: dict) -> str:
    """Words are already relative to the clip start."""
    W, H, font = r["width"], r["height"], r["font"]
    # Colours are &HAABBGGRR. White text, black outline; current word in yellow.
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hook,{font},92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,1,0,0,0,100,100,0,0,3,6,0,8,70,70,{int(H * 0.14)},1
Style: Cap,{font},84,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,7,3,2,80,80,{int(H * 0.24)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    hook_end = min(r["hook_seconds"], clip_len)
    # Hook: box style, pops in with a quick scale-up.
    ev.append(f"Dialogue: 1,{_ts(0)},{_ts(hook_end)},Hook,,0,0,0,,"
              r"{\fscx80\fscy80\t(0,150,\fscx100\fscy100)}" + _esc(hook.upper()))

    # Captions: groups of up to N words; the word being spoken is highlighted.
    n = max(1, int(r["caption_words"]))
    groups, cur = [], []
    for w in words:
        if not w["word"]:
            continue
        gap = cur and w["start"] - cur[-1]["end"] > 0.6
        if len(cur) >= n or gap or (cur and cur[-1]["word"][-1:] in ".?!"):
            groups.append(cur)
            cur = []
        cur.append(w)
    if cur:
        groups.append(cur)

    for gi, g in enumerate(groups):
        g_end = groups[gi + 1][0]["start"] if gi + 1 < len(groups) else g[-1]["end"] + 0.4
        g_end = min(g_end, g[-1]["end"] + 0.8, clip_len)
        for wi, w in enumerate(g):
            s = w["start"]
            e = g[wi + 1]["start"] if wi + 1 < len(g) else g_end
            if e <= s:
                continue
            parts = []
            for k, x in enumerate(g):
                t = _esc(x["word"].upper())
                parts.append(r"{\c&H0000E5FF&\fscx108\fscy108}" + t + r"{\r}" if k == wi else t)
            ev.append(f"Dialogue: 0,{_ts(s)},{_ts(e)},Cap,,0,0,0,,{' '.join(parts)}")
    return header + "\n".join(ev) + "\n"


def render_clip(src, start: float, end: float, hook: str, words: list[dict], out: Path, r: dict,
                work: Path) -> Path:
    length = end - start
    rel = [{"start": w["start"] - start, "end": w["end"] - start, "word": w["word"]}
           for w in words if w["start"] >= start and w["end"] <= end]
    ass = work / (out.stem + ".ass")
    ass.write_text(build_ass(hook, rel, length, r), encoding="utf-8")

    W, H, z = r["width"], r["height"], float(r["fg_zoom"])
    fg_w = int(W * z) // 2 * 2
    ass_path = str(ass).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")
    vf = (
        f"[0:v]split=2[a][b];"
        f"[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
        f"boxblur=25:3,eq=brightness=-0.12[bg];"
        f"[b]scale={fg_w}:-2,crop=min({W}\\,iw):ih[fg];"
        f"[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=30,ass='{ass_path}',format=yuv420p[v]"
    )
    cmd = [
        "ffmpeg", "-v", "error", "-y",
        "-ss", f"{start:.2f}", "-t", f"{length:.2f}", "-i", str(src),
        "-filter_complex", vf, "-map", "[v]", "-map", "0:a?",
        "-af", f"loudnorm=I={r['loudness']}:TP=-1.5:LRA=11",
        "-c:v", "libx264", "-preset", r["preset"], "-crf", str(r["crf"]),
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
        "-movflags", "+faststart", str(out),
    ]
    subprocess.run(cmd, check=True)
    return out
