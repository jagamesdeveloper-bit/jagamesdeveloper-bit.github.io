#!/usr/bin/env python3
"""Scaffold a Bridge-ready plain-JS game from templates/js-game.

Usage: python3 -I new-game.py <target_dir> "<Game Title>"

The title must be English (Latin letters, digits, spaces, punctuation): it is shown in the game and must equal
the title in the publication form (req 3.5.1). The target dir must be new or empty.
"""
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "..", "templates", "js-game")


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    target, title = os.path.abspath(sys.argv[1]), sys.argv[2].strip()
    if not title or not re.fullmatch(r"(?=.*[A-Za-z])[\x20-\x7E]{1,120}", title):
        print("FAIL title must be 1-120 chars of Latin letters/digits/spaces/punctuation (no emoji, no non-Latin)")
        return 1
    if os.path.exists(target) and os.listdir(target):
        print(f"FAIL {target} is not empty")
        return 1
    shutil.copytree(TEMPLATE, target, dirs_exist_ok=True)
    safe_title = title.replace("\\", "\\\\").replace("'", "\\'").replace("<", "&lt;")
    for d, _, names in os.walk(target):
        for n in names:
            if n.endswith((".html", ".js", ".css", ".json", ".txt")):
                p = os.path.join(d, n)
                s = open(p, encoding="utf-8").read()
                s2 = s.replace("__TITLE__", safe_title if n.endswith(".js") else title.replace("<", "&lt;"))
                if s2 != s:
                    open(p, "w", encoding="utf-8").write(s2)
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    print(f"OK   scaffolded '{title}' in {target}")
    print(f"     slug for archive names: {slug}   (release: {slug}-<CONFIG.version>.zip)")
    print("NEXT 1. add real audio to assets/audio (see README.txt there) - preflight fails without it")
    print("     2. replace src/game.js with the real game; keep main.js / platform.js lifecycle")
    print("     3. add every UI string to all languages in src/i18n.js")
    print("     4. node scripts/qa-matrix.js <dir> <out>   then   python3 -I scripts/preflight.py <dir> --zip ...")
    return 0


if __name__ == "__main__":
    sys.exit(main())
