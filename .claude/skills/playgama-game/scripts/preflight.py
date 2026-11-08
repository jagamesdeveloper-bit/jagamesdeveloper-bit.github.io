#!/usr/bin/env python3
"""Preflight for a Playgama WebGL build folder; optionally zips it.

Usage: python3 -I preflight.py <build_dir> [--zip <out.zip>]

Checks what can be checked statically. Gameplay, layout, audio and stability
(requirements 1.6, 1.7, 3.x) still need a human or the QA tool.
Exit code 1 when any FAIL is found; no zip is written then.
"""
import json
import os
import re
import sys
import zipfile

MAX_BYTES = 300 * 1024 * 1024
TEXT_EXT = {".html", ".js", ".css", ".json", ".mjs"}
BAD_ANALYTICS = ("google-analytics.com", "googletagmanager.com", "gtag(", "ga('create'")
URL_RE = re.compile(r"https?://[^\s\"'<>)\\]+")
URL_OK = ("w3.org", "playgama.com", "schemas.", "github.com/", "mozilla.org", "unity3d.com", "unity.com", "example.com", "localhost")
STORAGE_RE = re.compile(r"\b(localStorage|sessionStorage|document\.cookie)\b")

fails, warns, infos = [], [], []


def rel(path, root):
    return os.path.relpath(path, root).replace(os.sep, "/")


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

    files = []
    for d, _, names in os.walk(root):
        for n in names:
            files.append(os.path.join(d, n))

    total = sum(os.path.getsize(f) for f in files)
    infos.append(f"{len(files)} files, {total / 1048576:.1f} MB uncompressed")

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
            with open(cfg, encoding="utf-8") as fh:
                json.load(fh)
        except Exception as e:
            fails.append(f"SDK step 1: playgama-bridge-config.json is not valid JSON ({e})")

    # SDK required step 2: Bridge script first in <head>, not async/defer
    if os.path.isfile(index):
        html = open(index, encoding="utf-8", errors="replace").read()
        head = re.search(r"<head[^>]*>(.*?)</head>", html, re.S | re.I)
        scripts = re.findall(r"<script\b[^>]*>", head.group(1) if head else html, re.I)
        if not scripts:
            fails.append("SDK step 2: no <script> in <head> (Bridge must be the first one)")
        else:
            first = scripts[0].lower()
            if "bridge" not in first:
                fails.append(f"SDK step 2: first <script> in <head> is not the Bridge: {scripts[0][:120]}")
            if re.search(r"\b(async|defer)\b", first):
                fails.append("SDK step 2: Bridge script must not be async/defer")
        if "game_ready" not in html:
            infos.append("game_ready not found in index.html (Unity/engine code normally sends it; confirm via QA tool or get_archive_status)")

    # 1.3.1 size
    if total > MAX_BYTES:
        warns.append(f"1.3.1 uncompressed size {total / 1048576:.0f} MB > 300 MB; the zip must be <= 300 MB (checked after zipping)")

    # text scan: external URLs, analytics, storage
    ext_urls, analytics_hits, storage_hits = {}, [], []
    for f in files:
        ext = os.path.splitext(f)[1].lower()
        if ext not in TEXT_EXT or os.path.getsize(f) > 40 * 1024 * 1024:
            continue
        text = open(f, encoding="utf-8", errors="replace").read()
        r = rel(f, root)
        for hit in BAD_ANALYTICS:
            if hit in text:
                analytics_hits.append(f"{r} ({hit})")
        for u in URL_RE.findall(text):
            if not any(ok in u for ok in URL_OK):
                ext_urls.setdefault(u[:100], r)
        if STORAGE_RE.search(text) and not r.endswith((".framework.js", ".loader.js", ".wasm.js")) and "bridge" not in r.lower():
            storage_hits.append(r)
    for h in analytics_hits:
        fails.append(f"1.2.4 external analytics: {h}")
    for u, r in list(ext_urls.items())[:15]:
        warns.append(f"1.2.5 external URL (must not be loaded at runtime): {u}  in {r}")
    for r in storage_hits[:10]:
        warns.append(f"3.2.1 localStorage/sessionStorage/cookie use outside engine/Bridge files: {r}")
    infos.append("Unity: PlayerPrefs lives in compiled wasm - grep the C# source for PlayerPrefs (3.2.1); Decompression Fallback is verified server-side (get_archive_status.archiveData.decompressionFallback).")

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
        print(f"SIZE {size} bytes ({size / 1048576:.1f} MB)  <- pass this exact number as contentSize")
        if size > MAX_BYTES:
            print("FAIL 1.3.1 zip exceeds 300 MB")
            return 1
    print("\nPASS (static checks only; go through the numbered checklist for the rest)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
