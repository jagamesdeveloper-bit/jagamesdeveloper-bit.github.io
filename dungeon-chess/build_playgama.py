#!/usr/bin/env python3
"""Build the Playgama package: SDK tag added, debug hooks stripped, zipped with index.html at the root.

Usage:  python3 build_playgama.py
Output: dist/playgama/ (the files) and dist/in-pieces-playgama.zip (upload this)
"""
import re, shutil, zipfile
from pathlib import Path

here = Path(__file__).parent
out = here / "dist" / "playgama"
shutil.rmtree(out, ignore_errors=True)
out.mkdir(parents=True)

html = (here / "index.html").read_text(encoding="utf-8")

SDK = '<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>'
assert "<!--PLAYGAMA_SDK-->" in html, "SDK marker missing from index.html"
html = html.replace("<!--PLAYGAMA_SDK-->", SDK)

# remove the cheat/debug hooks used for testing
html, n = re.subn(r"window\.__cc=\{.*?die:\(\)=>die\(\)\};", "", html, flags=re.S)
assert n == 1, "debug hook block not found"

(out / "index.html").write_text(html, encoding="utf-8")
shutil.copy(here / "three.min.js", out / "three.min.js")
shutil.copy(here / "sfx.js", out / "sfx.js")
shutil.copytree(here / "music", out / "music")
shutil.copy(here / "CREDITS.md", out / "CREDITS.md")
(out / "playgama-bridge-config.json").write_text("{}\n", encoding="utf-8")

VERSION = "1.0.21"
zpath = here / "dist" / f"in-pieces-{VERSION}.zip"
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for f in sorted(out.rglob("*")):
        if f.is_file():
            z.write(f, f.relative_to(out).as_posix())
print("built", zpath, f"{zpath.stat().st_size/1024:.0f} KB")
print([i.filename for i in zipfile.ZipFile(zpath).infolist()])
