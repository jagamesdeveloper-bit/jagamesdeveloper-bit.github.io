#!/usr/bin/env python3
# contact sheet: sheet.py out.png file1 file2 ... (scales each to height 420)
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
H = 420; ims = [im.resize((max(1, int(im.width * H / im.height)), H)) for im in ims]
W = sum(im.width for im in ims) + 6 * (len(ims) - 1)
rows = []; cur = []; cw = 0; maxw = 1800
for im in ims:
    if cur and cw + im.width > maxw: rows.append(cur); cur = []; cw = 0
    cur.append(im); cw += im.width + 6
rows.append(cur)
sheet = Image.new('RGB', (min(maxw, max(sum(i.width + 6 for i in r) for r in rows)), H * len(rows) + 6 * (len(rows) - 1)), (40, 40, 40))
y = 0
for r in rows:
    x = 0
    for im in r: sheet.paste(im, (x, y)); x += im.width + 6
    y += H + 6
sheet.save(out); print(out, sheet.size)
