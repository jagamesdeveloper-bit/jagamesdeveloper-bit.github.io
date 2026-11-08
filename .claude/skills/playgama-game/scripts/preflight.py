#!/usr/bin/env python3
"""Preflight for a Playgama web build folder (plain JS first, Unity WebGL tolerated); optionally zips it.

Usage: python3 -I preflight.py <build_dir> [--zip <out.zip>]

Static checks only. Gameplay, layout, audio and stability (req 1.6, 1.7, 3.x) still need qa-matrix.js, the QA Tool
and your eyes. Every message names the requirement number. Exit 1 on any FAIL; no zip is written then.
"""
import json
import os
import re
import sys
import zipfile

MAX_BYTES = 300 * 1024 * 1024
TEXT_EXT = {".html", ".js", ".css", ".json", ".mjs"}
AUDIO_EXT = {".ogg", ".mp3", ".m4a", ".opus"}
BAD_ANALYTICS = ("google-analytics.com", "googletagmanager.com", "gtag(", "ga('create'")
URL_RE = re.compile(r"https?://[^\s\"'<>)\\]+")
URL_OK = ("w3.org", "playgama.com", "schemas.", "github.com/", "mozilla.org", "unity3d.com", "unity.com", "example.com", "localhost", "wiki.playgama")
STORAGE_RE = re.compile(r"\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b")
EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF⭐✅❌❤⚡✨]")
ESC_RE = re.compile(r"""['"]Escape['"]|\bkeyCode\s*={2,3}\s*27\b|\bwhich\s*={2,3}\s*27\b""")
SYNTH_RE = re.compile(r"\bcreateOscillator\b|\bOscillatorNode\b")
IGNORE_DIRS = {"__MACOSX", ".git", "node_modules"}

# Required-step API evidence expected somewhere in the shipped JS/HTML of a plain-JS game.
API_EVIDENCE = [
    ("SDK step 3 / 3.4.2", "platform.language", "language read from platform.language"),
    ("SDK step 4 / 3.2.1", "storage.get", "progress loaded via bridge.storage.get"),
    ("SDK step 4 / 3.2.1", "storage.set", "progress saved via bridge.storage.set"),
    ("SDK step 5 / 3.3.4", "isAudioEnabled", "platform.isAudioEnabled checked at start"),
    ("SDK step 5 / 3.3.4", "AUDIO_STATE_CHANGED", "audio state event handled"),
    ("SDK step 5 / 2.1.6", "PAUSE_STATE_CHANGED", "pause state event handled"),
    ("SDK step 6", "game_ready", "platform.sendMessage('game_ready')"),
    ("SDK step 7 / 2.1.2", "showInterstitial", "interstitial ads at natural pauses"),
]

fails, warns, infos = [], [], []


def rel(path, root):
    return os.path.relpath(path, root).replace(os.sep, "/")


def collect(root):
    files = []
    for d, dirs, names in os.walk(root):
        dirs[:] = [x for x in dirs if x not in IGNORE_DIRS]
        for n in names:
            if n in (".DS_Store", "Thumbs.db"):
                continue
            files.append(os.path.join(d, n))
    return files


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2
    root = args[0]
    out_zip = args[args.index("--zip") + 1] if "--zip" in args else None
    if not os.path.isdir(root):
        print(f"FAIL not a directory: {root}")
        return 1

    files = collect(root)
    total = sum(os.path.getsize(f) for f in files)
    infos.append(f"{len(files)} files, {total / 1048576:.1f} MB uncompressed")
    is_unity = any(f.endswith(".loader.js") and "/Build/" in f.replace(os.sep, "/") for f in files)
    if is_unity:
        infos.append("Unity WebGL build detected: JS game-API checks skipped (Decompression Fallback is verified server-side, req 5.1.1)")

    # 1.3.2 index.html at root, Latin-only names
    index = os.path.join(root, "index.html")
    if not os.path.isfile(index):
        fails.append("1.3.2 index.html missing at the build root (zip the folder's contents, not the folder)")
    for f in files:
        r = rel(f, root)
        if not all(ord(c) < 128 for c in r):
            fails.append(f"1.3.2 non-Latin file/folder name: {r}")

    # SDK required step 1: config
    cfg = os.path.join(root, "playgama-bridge-config.json")
    if not os.path.isfile(cfg):
        fails.append("SDK step 1: playgama-bridge-config.json missing next to index.html")
    else:
        try:
            json.load(open(cfg, encoding="utf-8"))
        except Exception as e:
            fails.append(f"SDK step 1: playgama-bridge-config.json is not valid JSON ({e})")

    # SDK required step 2 + 1.6.3 / 1.4.5 page setup
    html = ""
    if os.path.isfile(index):
        html = open(index, encoding="utf-8", errors="replace").read()
        head = re.search(r"<head[^>]*>(.*?)</head>", html, re.S | re.I)
        scripts = re.findall(r"<script\b[^>]*>", head.group(1) if head else html, re.I)
        if not scripts:
            fails.append("SDK step 2: no <script> in <head> (the Bridge must be the first one)")
        else:
            first = scripts[0].lower()
            if "bridge" not in first:
                fails.append(f"SDK step 2: first <script> in <head> is not the Bridge: {scripts[0][:120]}")
            if re.search(r"\b(async|defer)\b", first):
                fails.append("SDK step 2: Bridge script must not be async/defer")
        if not is_unity and not re.search(r'name=["\']viewport["\']', html, re.I):
            warns.append("1.6.1 no viewport meta tag in index.html")

    # text scan
    texts = {}
    for f in files:
        if os.path.splitext(f)[1].lower() in TEXT_EXT and os.path.getsize(f) <= 40 * 1024 * 1024:
            texts[rel(f, root)] = open(f, encoding="utf-8", errors="replace").read()

    def strip_comments(s):
        s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
        s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
        return re.sub(r"(?<!:)//[^\n]*", "", s)

    own = {r: strip_comments(s) for r, s in texts.items()
           if "bridge" not in r.lower() and not r.endswith((".framework.js", ".loader.js"))}

    ext_urls, storage_hits, emoji_hits, esc_hits, synth_hits = {}, [], [], [], []
    for r, s in texts.items():
        for hit in BAD_ANALYTICS:
            if hit in s:
                fails.append(f"1.2.4 external analytics in {r} ({hit})")
        for u in URL_RE.findall(s):
            if not any(ok in u for ok in URL_OK):
                ext_urls.setdefault(u[:100], r)
    for r, s in own.items():
        if STORAGE_RE.search(s):
            storage_hits.append(r)
        if EMOJI_RE.search(s):
            emoji_hits.append(r)
        if ESC_RE.search(s):
            esc_hits.append(r)
        if SYNTH_RE.search(s):
            synth_hits.append(r)
    for u, r in list(ext_urls.items())[:15]:
        warns.append(f"1.2.5 external URL (nothing may load from outside the archive): {u}  in {r}")
    for r in storage_hits[:10]:
        warns.append(f"3.2.1 localStorage/sessionStorage/IndexedDB/cookie use in game code: {r} (saves must go through bridge.storage)")
    for r in emoji_hits[:10]:
        warns.append(f"4.3.2 emoji in {r} (use real icons/SVG; emoji-as-icons reads as a generated template)")
    for r in esc_hits[:10]:
        warns.append(f"1.5.2 Esc key handled in {r} (the browser reserves Esc for leaving full screen)")
    for r in synth_hits[:10]:
        fails.append(f"3.3.2 sound synthesized in code (Web Audio oscillator) in {r}: use recorded audio files")

    if not is_unity:
        # audio files (3.3.1 / 3.3.2)
        audio = [f for f in files if os.path.splitext(f)[1].lower() in AUDIO_EXT]
        wavs = [f for f in files if f.lower().endswith(".wav")]
        if not audio:
            fails.append("3.3.1/3.3.2 no audio files (ogg/mp3) in the build: the game must ship real music and effects")
        else:
            infos.append(f"{len(audio)} audio files, {sum(os.path.getsize(a) for a in audio) / 1048576:.1f} MB")
            if not any(a.lower().endswith(".mp3") for a in audio):
                warns.append("audio: no .mp3 found; the template loads CONFIG.audioExt (mp3) - a missing file logs a 404 error (1.7.1)")
        for w in wavs[:5]:
            warns.append(f"perf: .wav shipped ({rel(w, root)}); use ogg/mp3 (guide: Sound)")

        # required API evidence (SDK steps 3-7)
        blob = "\n".join(own.values()) + "\n" + html
        for ref, needle, what in API_EVIDENCE:
            if needle not in blob:
                fails.append(f"{ref}: not found in game code - {what}")
        if "showRewarded" in blob and "isRewardedSupported" not in blob:
            fails.append("SDK step 8 / 2.2: showRewarded used without checking isRewardedSupported")
        if re.search(r"\bpayments\b", blob) and "isSupported" not in blob:
            warns.append("SDK step 8 / 2.4: payments used without checking payments.isSupported")

        # page must not scroll
        css_blob = "\n".join(s for r, s in texts.items() if r.endswith(".css")) + html
        if not re.search(r"overflow\s*:\s*hidden", css_blob):
            warns.append("1.6.3 no `overflow: hidden` on html/body found (page must never scroll)")

        # version in config vs archive name
        m = re.search(r"version\s*:\s*['\"](\d+\.\d+\.\d+)['\"]", texts.get("src/config.js", ""))
        if m and out_zip and m.group(1) not in os.path.basename(out_zip):
            warns.append(f"version: src/config.js says {m.group(1)} but the archive name is {os.path.basename(out_zip)} (bump both together)")

    if total > MAX_BYTES:
        warns.append(f"1.3.1 uncompressed size {total / 1048576:.0f} MB; the zip must be <= 300 MB")

    print("== Playgama preflight ==")
    for m in infos:
        print("INFO ", m)
    for m in warns:
        print("WARN ", m)
    for m in fails:
        print("FAIL ", m)

    if fails:
        print(f"\n{len(fails)} FAIL - fix before upload. No zip written.")
        return 1

    if out_zip:
        out_zip = os.path.abspath(out_zip)
        os.makedirs(os.path.dirname(out_zip), exist_ok=True)
        with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as z:
            for f in sorted(files):
                z.write(f, rel(f, root))
        size = os.path.getsize(out_zip)
        print(f"\nZIP  {out_zip}")
        print(f"SIZE {size} bytes ({size / 1048576:.2f} MB)  <- pass this exact number as contentSize")
        if size > MAX_BYTES:
            print("FAIL 1.3.1 zip exceeds 300 MB")
            return 1
        if size > 5 * 1024 * 1024:
            print("WARN initial download guideline is ~5 MB (guide: Loading and first session); consider lazy-loading music/levels")
    print("\nPASS (static checks only; run qa-matrix.js and go through the numbered checklist for the rest)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
