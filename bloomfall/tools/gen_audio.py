"""Renders Bloomfall's music loop and sound effects to WAV, then encodes them
to OGG (Vorbis) and MP3 with ffmpeg.

Usage: python3 gen_audio.py <output_dir>

These are placeholder sounds rendered offline. Replace any file in
game/audio/ with a recorded or licensed sound of the same name (both .ogg and
.mp3) and the game will pick it up without code changes.
"""
import os
import subprocess
import sys
import wave

import numpy as np

SR = 44100
RNG = np.random.default_rng(7)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def env_ad(n, attack, decay):
    t = np.arange(n) / SR
    e = np.exp(-t / max(decay, 1e-4))
    a = int(attack * SR)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a)
    return e


def mix(*parts):
    """Sum signals of different lengths, padding the shorter ones."""
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def lowpass_fast(x, cutoff):
    # FFT brick-ish low-pass with a soft roll-off, much faster than the loop.
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, n)


def highpass_fast(x, cutoff):
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X *= 1 - 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, n)


def marimba(freq, dur=1.2, vel=1.0):
    t = t_axis(dur)
    n = len(t)
    out = np.zeros(n)
    # Wooden bar modes: fundamental, ~4x and ~9.9x with fast decays.
    for ratio, amp, dec in ((1.0, 1.0, 0.45), (3.93, 0.32, 0.09), (9.9, 0.10, 0.03)):
        out += amp * np.sin(2 * np.pi * freq * ratio * t) * env_ad(n, 0.002, dec * (440 / max(freq, 110)) ** 0.3)
    # Mallet click
    click = RNG.standard_normal(n) * env_ad(n, 0.0005, 0.004)
    out += 0.08 * lowpass_fast(click, 3000)
    return out * vel


def bell(freq, dur=2.2, vel=1.0):
    t = t_axis(dur)
    n = len(t)
    out = np.zeros(n)
    for ratio, amp, dec in ((1.0, 1.0, 1.1), (2.0, 0.5, 0.7), (2.76, 0.35, 0.5), (5.4, 0.18, 0.25), (8.93, 0.08, 0.15)):
        out += amp * np.sin(2 * np.pi * freq * ratio * t + ratio) * env_ad(n, 0.001, dec)
    return out * vel * 0.6


def pluck(freq, dur=1.0, vel=1.0, bright=0.5):
    """Karplus-Strong plucked string."""
    n = int(dur * SR)
    period = int(SR / freq)
    buf = RNG.uniform(-1, 1, period)
    buf = lowpass_fast(np.tile(buf, 4), 800 + 6000 * bright)[:period]
    out = np.zeros(n)
    idx = 0
    damp = 0.996
    for i in range(n):
        v = buf[idx]
        nxt = buf[(idx + 1) % period]
        buf[idx] = damp * 0.5 * (v + nxt)
        out[i] = v
        idx = (idx + 1) % period
    out *= env_ad(n, 0.001, dur * 0.6)
    return out * vel


def pad(freqs, dur, vel=1.0):
    t = t_axis(dur)
    n = len(t)
    out = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.13):
            ff = f * 2 ** (det / 12)
            # Soft triangle-ish tone: sine plus a little 3rd harmonic.
            out += np.sin(2 * np.pi * ff * t) + 0.12 * np.sin(2 * np.pi * 3 * ff * t + 0.3)
    att = int(min(0.6, dur / 3) * SR)
    rel = int(min(0.9, dur / 3) * SR)
    e = np.ones(n)
    e[:att] = np.linspace(0, 1, att) ** 2
    e[-rel:] = np.linspace(1, 0, rel) ** 2
    trem = 1 + 0.06 * np.sin(2 * np.pi * 0.35 * t)
    return out * e * trem * vel / (len(freqs) * 3)


def shaker(dur=0.09, vel=1.0):
    n = int(dur * SR)
    x = highpass_fast(RNG.standard_normal(n), 6000)
    return x * env_ad(n, 0.004, 0.025) * vel * 0.25


def soft_kick(dur=0.35, vel=1.0):
    t = t_axis(dur)
    f = 50 + 70 * np.exp(-t / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env_ad(len(t), 0.002, 0.12) * vel


def reverb(x, seconds=1.8, decay=0.55, mix=0.25, cutoff=5000):
    n = int(seconds * SR)
    ir = RNG.standard_normal(n) * np.exp(-np.arange(n) / SR / decay)
    ir = lowpass_fast(ir, cutoff)
    ir /= np.sqrt(np.sum(ir ** 2))
    size = len(x) + n
    nfft = 1 << (size - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:size]
    dry = np.concatenate([x, np.zeros(n)])
    return dry * (1 - mix) + wet * mix * 1.4


def place(buf, sig, start_sec):
    s = int(start_sec * SR)
    e = min(len(buf), s + len(sig))
    if e > s:
        buf[s:e] += sig[: e - s]


def note(name):
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
             "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    p, o = name[:-1], int(name[-1])
    midi = 12 * (o + 1) + names[p]
    return 440 * 2 ** ((midi - 69) / 12)


def normalize(x, peak=0.89):
    m = np.max(np.abs(x))
    return x / m * peak if m > 0 else x


def soft_clip(x):
    return np.tanh(x * 1.2) / np.tanh(1.2)


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    data = (x * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


# ---------------------------------------------------------------- music
BPM = 88
BEAT = 60 / BPM
BAR = 4 * BEAT

CHORDS = [  # two bars each
    ("F3", ["F3", "A3", "C4", "E4"], ["F4", "A4", "C5", "E5", "C5", "A4", "G4", "A4"]),
    ("D3", ["D3", "F3", "A3", "C4"], ["D4", "F4", "A4", "C5", "A4", "F4", "E4", "F4"]),
    ("Bb2", ["Bb2", "D3", "F3", "A3"], ["Bb3", "D4", "F4", "A4", "F4", "D4", "C4", "D4"]),
    ("C3", ["C3", "E3", "G3", "Bb3"], ["C4", "E4", "G4", "Bb4", "G4", "E4", "D4", "E4"]),
]

MELODY_A = [  # (beat offset within 8-beat chord, note, beats)
    [(0, "C5", 1.5), (1.5, "A4", 0.5), (2, "G4", 1), (3, "A4", 1), (4, "C5", 2), (6, "F5", 2)],
    [(0, "D5", 1.5), (1.5, "C5", 0.5), (2, "A4", 2), (4, "F4", 1), (5, "G4", 1), (6, "A4", 2)],
    [(0, "F4", 1), (1, "G4", 1), (2, "A4", 1), (3, "C5", 1), (4, "D5", 3)],
    [(0, "E5", 1.5), (1.5, "D5", 0.5), (2, "C5", 2), (4, "G4", 2), (6, "Bb4", 2)],
]
MELODY_B = [
    [(0, "A5", 1), (1, "G5", 1), (2, "F5", 1), (3, "C5", 1), (4, "A4", 2), (6, "C5", 2)],
    [(0, "F5", 1.5), (1.5, "E5", 0.5), (2, "D5", 1), (3, "C5", 1), (4, "A4", 3)],
    [(0, "D5", 1), (1, "F5", 1), (2, "A5", 2), (4, "G5", 1), (5, "F5", 1), (6, "D5", 2)],
    [(0, "C5", 2), (2, "E5", 2), (4, "G5", 2), (6, "C5", 2)],
]


def render_music():
    bars = 16
    length = bars * BAR
    tail = 2.5
    buf = np.zeros(int((length + tail) * SR))
    for section in range(2):
        melody = MELODY_A if section == 0 else MELODY_B
        for ci, (root, chord, arp) in enumerate(CHORDS):
            start = (section * 8 + ci * 2) * BAR
            # pad
            place(buf, pad([note(n) for n in chord], 2 * BAR + 0.4, 0.16), start)
            # bass pluck on beats 1 and 3 (+ pickup)
            for b in (0, 2, 4, 6):
                place(buf, pluck(note(root), 1.2, 0.34 if b % 4 == 0 else 0.22, 0.25), start + b * BEAT)
            place(buf, pluck(note(root) * 1.5, 0.6, 0.12, 0.3), start + 7.5 * BEAT)
            # marimba arpeggio in eighths
            for i in range(16):
                n = arp[i % 8]
                vel = 0.20 if i % 2 == 0 else 0.13
                if section == 1 and i % 4 == 3:
                    vel *= 1.2
                place(buf, marimba(note(n), 0.9, vel), start + i * BEAT / 2)
            # melody bells
            for off, n, beats in melody[ci]:
                place(buf, bell(note(n), max(1.2, beats * BEAT + 0.8), 0.20), start + off * BEAT)
            # percussion: soft kick + offbeat shaker
            for b in range(8):
                if b % 4 == 0:
                    place(buf, soft_kick(0.35, 0.30), start + b * BEAT)
                place(buf, shaker(0.08, 0.5), start + (b + 0.5) * BEAT)
                if section == 1:
                    place(buf, shaker(0.05, 0.25), start + (b + 0.75) * BEAT)
    wet = reverb(buf, 2.0, 0.6, 0.28)
    out = wet[: int(length * SR)].copy()
    over = wet[int(length * SR):]
    out[: len(over)] += over  # wrap the tail so the loop is seamless
    return soft_clip(normalize(out, 0.8)) * 0.85, length


# ---------------------------------------------------------------- sfx
def sfx_move():
    return mix(marimba(note("E6"), 0.08, 0.5), 0.3 * shaker(0.04, 1))


def sfx_rotate():
    return mix(marimba(note("A5"), 0.18, 0.7), marimba(note("E6"), 0.12, 0.25))


def sfx_lock():
    t = t_axis(0.22)
    f = 90 + 80 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), 0.001, 0.06)
    knock = lowpass_fast(RNG.standard_normal(len(t)), 1800) * env_ad(len(t), 0.0005, 0.015)
    return mix(body * 0.9 + knock * 0.6, marimba(note("C4"), 0.22, 0.25))


def sfx_drop():
    n = int(0.16 * SR)
    sweep = highpass_fast(RNG.standard_normal(n), 2500) * np.linspace(0.1, 1, n) ** 2 * 0.2
    out = np.zeros(int(0.45 * SR))
    out[:n] += sweep
    place(out, sfx_lock() * 1.2, 0.14)
    return out


def sfx_clear(rows):
    seq = {1: ["C5", "F5"], 2: ["C5", "F5", "A5"], 3: ["C5", "F5", "A5", "C6"], 4: ["F4", "A4", "C5", "F5", "A5", "C6", "F6"]}[rows]
    out = np.zeros(int(2.0 * SR))
    for i, n in enumerate(seq):
        place(out, marimba(note(n), 0.9, 0.7), i * 0.055)
    place(out, bell(note(seq[-1]), 1.6, 0.6 if rows < 4 else 0.9), len(seq) * 0.055)
    if rows == 4:
        n = int(0.8 * SR)
        shimmer = highpass_fast(RNG.standard_normal(n), 7000) * env_ad(n, 0.05, 0.25) * 0.15
        place(out, shimmer, 0.2)
    return reverb(out, 1.4, 0.45, 0.3)


def sfx_bloom():
    out = np.zeros(int(1.8 * SR))
    for i, n in enumerate(["A5", "C6", "F6"]):
        place(out, bell(note(n), 1.4, 0.55 - i * 0.1), i * 0.07)
    n = int(0.6 * SR)
    place(out, highpass_fast(RNG.standard_normal(n), 8000) * env_ad(n, 0.02, 0.15) * 0.12, 0.05)
    return reverb(out, 1.4, 0.5, 0.35)


def sfx_hold():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    f = 500 + 900 * (t / t[-1])
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / t[-1]) * 0.25
    air = highpass_fast(RNG.standard_normal(n), 3000) * np.sin(np.pi * t / t[-1]) * 0.12
    return tone + air


def sfx_win():
    out = np.zeros(int(3.0 * SR))
    seq = [("F4", 0), ("A4", 0.12), ("C5", 0.24), ("F5", 0.36), ("A5", 0.6), ("C6", 0.72)]
    for n, s in seq:
        place(out, marimba(note(n), 1.0, 0.7), s)
    place(out, pad([note("F4"), note("A4"), note("C5"), note("E5")], 1.6, 0.6), 0.55)
    place(out, bell(note("F6"), 2.0, 0.7), 0.84)
    return reverb(out, 1.8, 0.6, 0.3)


def sfx_lose():
    out = np.zeros(int(2.6 * SR))
    for i, n in enumerate(["A4", "F4", "D4", "A3"]):
        place(out, pluck(note(n), 1.2, 0.6, 0.35), i * 0.22)
        place(out, marimba(note(n), 0.8, 0.3), i * 0.22)
    place(out, pad([note("D3"), note("F3"), note("A3")], 1.6, 0.5), 0.7)
    return reverb(out, 1.6, 0.55, 0.3)


def sfx_click():
    return mix(marimba(note("C6"), 0.12, 0.6), marimba(note("G6"), 0.08, 0.2))


def sfx_rise():
    t = t_axis(0.5)
    n = len(t)
    rumble = lowpass_fast(RNG.standard_normal(n), 220) * np.sin(np.pi * t / t[-1]) * 1.4
    creak = np.sin(2 * np.pi * np.cumsum(70 + 40 * t) / SR) * env_ad(n, 0.05, 0.2) * 0.4
    return mix(rumble + creak, pluck(note("D3"), 0.5, 0.3, 0.2))


def sfx_levelup():
    out = np.zeros(int(1.6 * SR))
    for i, n in enumerate(["C5", "E5", "G5", "C6"]):
        place(out, bell(note(n), 1.0, 0.5), i * 0.08)
    return reverb(out, 1.2, 0.45, 0.3)


SFX = {
    "move": sfx_move,
    "rotate": sfx_rotate,
    "lock": sfx_lock,
    "drop": sfx_drop,
    "clear1": lambda: sfx_clear(1),
    "clear2": lambda: sfx_clear(2),
    "clear3": lambda: sfx_clear(3),
    "clear4": lambda: sfx_clear(4),
    "bloom": sfx_bloom,
    "hold": sfx_hold,
    "win": sfx_win,
    "lose": sfx_lose,
    "click": sfx_click,
    "rise": sfx_rise,
    "levelup": sfx_levelup,
}


def trim_silence(x, thresh=0.0008):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    end = min(len(x), idx[-1] + int(0.02 * SR))
    out = x[:end].copy()
    fade = min(len(out), int(0.01 * SR))
    out[-fade:] *= np.linspace(1, 0, fade)
    return out


def encode(wav, base, music=False):
    q = ["-q:a", "4"] if music else ["-q:a", "3"]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", *q, base + ".ogg"], check=True)
    br = "112k" if music else "80k"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", br, base + ".mp3"], check=True)


def main():
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)
    tmp = os.path.join(out_dir, "_wav")
    os.makedirs(tmp, exist_ok=True)
    music, length = render_music()
    p = os.path.join(tmp, "music.wav")
    write_wav(p, music)
    encode(p, os.path.join(out_dir, "music"), music=True)
    print(f"music {length:.3f}s")
    for name, fn in SFX.items():
        x = trim_silence(normalize(fn(), 0.85))
        p = os.path.join(tmp, name + ".wav")
        write_wav(p, x)
        encode(p, os.path.join(out_dir, name))
        print(name, f"{len(x) / SR:.2f}s")
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)


if __name__ == "__main__":
    main()
