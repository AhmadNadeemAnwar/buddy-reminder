#!/usr/bin/env python3
"""Synthesizes Buddy's three reminder tones from scratch — sine waves only,
stdlib-only (wave + struct), no external audio, no licensing question to
ever ask. Kept short and gentle on purpose: a notification tone that fires
during your day shouldn't be jarring.

Run: python synth.py
Writes chime.wav / bell.wav / pop.wav alongside this script — these ARE the
committed source (like icons/), not build output. scripts/build-www.mjs
copies this whole folder into the disposable www/sounds/ on every build,
the same way it copies icons/.
"""

import math
import struct
import wave
from pathlib import Path

RATE = 44100
OUT_DIR = Path(__file__).parent


def envelope(i, n, attack, release):
    """0..1 amplitude multiplier: linear attack, linear release, flat between."""
    if i < attack:
        return i / attack
    if i > n - release:
        return max(0.0, (n - i) / release)
    return 1.0


def note(freq, duration, amplitude=0.32, attack_ms=8, release_ms=60, harmonics=None):
    """One sine tone (optionally with quieter overtones) as a list of samples in [-1, 1]."""
    n = int(RATE * duration)
    attack = max(1, int(RATE * attack_ms / 1000))
    release = max(1, int(RATE * release_ms / 1000))
    harmonics = harmonics or []
    out = []
    for i in range(n):
        t = i / RATE
        s = math.sin(2 * math.pi * freq * t)
        for mult, amp in harmonics:
            s += amp * math.sin(2 * math.pi * freq * mult * t)
        s *= envelope(i, n, attack, release)
        out.append(s * amplitude)
    return out


def write_wav(path, samples):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        frames = b"".join(struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples)
        f.writeframes(frames)


def mix(*tracks):
    """Concatenate/overlay-free sequence — tracks already placed back to back by caller."""
    out = []
    for t in tracks:
        out.extend(t)
    return out


# --- Chime: a soft two-note rise (C6 -> E6), the classic "got it" sound ---
chime = mix(
    note(1046.50, 0.16, amplitude=0.30, attack_ms=6, release_ms=90),
    note(0, 0.02, amplitude=0),  # tiny breath between notes
    note(1318.51, 0.28, amplitude=0.30, attack_ms=6, release_ms=180),
)
write_wav(OUT_DIR / "chime.wav", chime)

# --- Bell: one fundamental plus two quiet overtones and a natural decay ---
bell = note(
    880.00,
    0.85,
    amplitude=0.30,
    attack_ms=4,
    release_ms=650,
    harmonics=[(2.0, 0.22), (3.0, 0.10)],
)
write_wav(OUT_DIR / "bell.wav", bell)

# --- Pop: a very short, bright blip ---
pop = note(1200.0, 0.14, amplitude=0.34, attack_ms=3, release_ms=100, harmonics=[(1.5, 0.15)])
write_wav(OUT_DIR / "pop.wav", pop)

print(f"Wrote chime.wav, bell.wav, pop.wav to {OUT_DIR}")
