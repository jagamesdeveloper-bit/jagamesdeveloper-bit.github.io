/* Illustrated drawing for ONE MORE THING: the giant's room, loot and the little burglar. All vector, no images. */
(function () {
  'use strict';
  const W = 2500, H = 1000, FLOOR = 900;
  const OUT = '#1d1226';
  const TAU = Math.PI * 2;

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function fillStroke(c, fill, lw) {
    c.fillStyle = fill; c.fill();
    c.lineWidth = lw || 2.5; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke();
  }
  function lin(c, x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function vis(v, x0, y0, x1, y1) { return !(x1 < v.x0 || x0 > v.x1 || y1 < v.y0 || y0 > v.y1); }

  /* ---------------------------------------------------------------- room */
  function wall(c, v, t, awake) {
    c.fillStyle = lin(c, 0, 0, 0, FLOOR, [[0, '#33223f'], [0.6, '#4f3149'], [1, '#63394f']]);
    c.fillRect(-20, -20, W + 40, FLOOR + 20);
    // wallpaper stripes + little diamonds
    c.fillStyle = 'rgba(255,220,240,0.045)';
    for (let x = 0; x < W; x += 96) { if (x + 36 < v.x0 || x > v.x1) continue; c.fillRect(x, 0, 36, 660); }
    c.fillStyle = 'rgba(255,200,120,0.07)';
    for (let x = 48; x < W; x += 96) {
      if (x < v.x0 - 20 || x > v.x1 + 20) continue;
      for (let y = 60; y < 640; y += 120) { c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + 7, y); c.lineTo(x, y + 8); c.lineTo(x - 7, y); c.closePath(); c.fill(); }
    }
    // crown moulding
    c.fillStyle = '#2a1a33'; c.fillRect(-20, 0, W + 40, 26);
    c.fillStyle = '#4b3158'; c.fillRect(-20, 26, W + 40, 6);
    // wainscot
    c.fillStyle = '#47293a'; c.fillRect(-20, 650, W + 40, FLOOR - 650);
    c.fillStyle = '#6e4259'; c.fillRect(-20, 646, W + 40, 12);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-20, 658, W + 40, 5);
    c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 3;
    for (let x = 20; x < W; x += 170) { if (x + 150 < v.x0 || x > v.x1) continue; c.strokeRect(x, 690, 150, 160); }
    // baseboard
    c.fillStyle = '#2e1c26'; c.fillRect(-20, 876, W + 40, 24);
    c.fillStyle = '#4c2f3d'; c.fillRect(-20, 876, W + 40, 4);
  }

  function windowArt(c, t) {
    const x = 540, y = 110, w = 260, h = 330;
    // moon beam shape drawn in lighting pass; here the glass
    rr(c, x - 14, y - 14, w + 28, h + 28, 10); fillStroke(c, '#7d5334', 3);
    c.beginPath(); c.rect(x, y, w, h);
    c.fillStyle = lin(c, 0, y, 0, y + h, [[0, '#0b1238'], [0.7, '#233478'], [1, '#3b4f9a']]); c.fill();
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    const r = rng(7);
    for (let i = 0; i < 26; i++) {
      const sx = x + r() * w, sy = y + r() * h * 0.7, tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
      c.fillStyle = `rgba(255,255,230,${0.35 + tw * 0.6})`; c.fillRect(sx, sy, 2 + (i % 3 === 0 ? 1 : 0), 2 + (i % 3 === 0 ? 1 : 0));
    }
    // moon
    const g = c.createRadialGradient(x + 170, y + 100, 10, x + 170, y + 100, 90);
    g.addColorStop(0, 'rgba(255,250,220,0.55)'); g.addColorStop(1, 'rgba(255,250,220,0)');
    c.fillStyle = g; c.fillRect(x, y, w, h);
    c.beginPath(); c.arc(x + 170, y + 100, 36, 0, TAU); c.fillStyle = '#fff6d6'; c.fill();
    c.beginPath(); c.arc(x + 158, y + 92, 7, 0, TAU); c.fillStyle = 'rgba(200,190,150,0.5)'; c.fill();
    c.beginPath(); c.arc(x + 182, y + 112, 5, 0, TAU); c.fill();
    // far rooftops
    c.fillStyle = '#0a0f2b';
    c.beginPath(); c.moveTo(x, y + h);
    const pts = [[0, 290], [30, 250], [60, 250], [60, 270], [110, 270], [140, 230], [170, 270], [220, 262], [260, 300], [260, 330]];
    pts.forEach(p => c.lineTo(x + p[0], y + p[1])); c.closePath(); c.fill();
    c.restore();
    // glazing bars
    c.fillStyle = '#7d5334'; c.fillRect(x + w / 2 - 5, y, 10, h); c.fillRect(x, y + h * 0.45, w, 10);
    c.strokeStyle = OUT; c.lineWidth = 2; c.strokeRect(x, y, w, h);
    // sill
    rr(c, x - 28, y + h + 12, w + 56, 16, 5); fillStroke(c, '#8f6039', 3);
    // curtains
    const sway = Math.sin(t * 0.7) * 2;
    for (const side of [-1, 1]) {
      const cx = side < 0 ? x - 30 : x + w + 30;
      c.beginPath();
      c.moveTo(cx - side * 4, y - 30);
      c.lineTo(cx + side * 62 + sway, y - 30);
      c.quadraticCurveTo(cx + side * 40 + sway, y + h * 0.5, cx + side * 56 + sway, y + h + 4);
      c.lineTo(cx - side * 18, y + h + 4);
      c.quadraticCurveTo(cx - side * 28, y + h * 0.4, cx - side * 4, y - 30);
      fillStroke(c, lin(c, cx - 20, 0, cx + 60, 0, [[0, '#7a2a56'], [0.5, '#a23c72'], [1, '#6c2149']]), 3);
      c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 3;
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(cx + side * i * 14, y - 28); c.quadraticCurveTo(cx + side * (i * 12 + 6), y + h * 0.5, cx + side * (i * 13 + 4), y + h); c.stroke(); }
    }
    rr(c, x - 60, y - 44, w + 120, 18, 8); fillStroke(c, '#9a6a3c', 3);
    for (const k of [x - 60, x + w + 44]) { c.beginPath(); c.arc(k + 8, y - 35, 10, 0, TAU); fillStroke(c, '#d7a24a', 2.5); }
  }

  function decor(c, v, t, awake) {
    // framed painting of a cat looking hungry
    if (vis(v, 1380, 290, 1500, 440)) {
      rr(c, 1388, 296, 104, 134, 6); fillStroke(c, '#d1a03e', 4);
      rr(c, 1398, 306, 84, 114, 3); fillStroke(c, '#2f4f6a', 2);
      c.fillStyle = '#e48a3e'; c.beginPath(); c.arc(1440, 372, 26, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(1418, 358); c.lineTo(1414, 332); c.lineTo(1434, 349); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(1462, 358); c.lineTo(1466, 332); c.lineTo(1446, 349); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(1431, 368, 5, 6, 0, 0, TAU); c.ellipse(1449, 368, 5, 6, 0, 0, TAU); c.fill();
      c.fillStyle = OUT; c.beginPath(); c.ellipse(1431, 369, 1.6, 5, 0, 0, TAU); c.ellipse(1449, 369, 1.6, 5, 0, 0, TAU); c.fill();
      c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath(); c.moveTo(1432, 382); c.quadraticCurveTo(1440, 388, 1448, 382); c.stroke();
      c.fillStyle = '#f3d97a'; c.font = '700 11px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('MR. WHISKERS', 1440, 414);
    }
    // wall clock
    if (vis(v, 1730, 180, 1830, 280)) {
      c.beginPath(); c.arc(1780, 230, 44, 0, TAU); fillStroke(c, '#7d4f2e', 4);
      c.beginPath(); c.arc(1780, 230, 36, 0, TAU); fillStroke(c, '#f3ead2', 2);
      c.fillStyle = OUT;
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.fillRect(1780 + Math.sin(a) * 30 - 1.5, 230 - Math.cos(a) * 30 - 1.5, 3, 3); }
      const m = t * 0.02, h = t * 0.0017;
      c.lineCap = 'round'; c.lineWidth = 3.5; c.strokeStyle = OUT;
      c.beginPath(); c.moveTo(1780, 230); c.lineTo(1780 + Math.sin(h) * 18, 230 - Math.cos(h) * 18); c.stroke();
      c.lineWidth = 2.5; c.beginPath(); c.moveTo(1780, 230); c.lineTo(1780 + Math.sin(m) * 28, 230 - Math.cos(m) * 28); c.stroke();
      c.lineCap = 'butt';
    }
    // hanging lamp
    c.strokeStyle = '#1d1226'; c.lineWidth = 3; c.beginPath(); c.moveTo(1250, 26); c.lineTo(1250, 108); c.stroke();
    c.beginPath(); c.moveTo(1218, 150); c.quadraticCurveTo(1250, 100, 1282, 150); c.closePath(); fillStroke(c, awake ? '#ffe9a6' : '#e9b457', 3);
    c.beginPath(); c.arc(1250, 152, 8, 0, TAU); c.fillStyle = awake ? '#fff' : '#ffeaa0'; c.fill();
  }

  function floor(c, v, t, state) {
    c.fillStyle = lin(c, 0, FLOOR, 0, H, [[0, '#7c4a2c'], [1, '#432517']]);
    c.fillRect(-20, FLOOR, W + 40, H - FLOOR + 400);
    c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-20, 950); c.lineTo(W + 20, 950); c.stroke();
    for (let x = 0; x < W; x += 150) {
      if (x < v.x0 - 150 || x > v.x1) continue;
      c.beginPath(); c.moveTo(x + 40, FLOOR); c.lineTo(x + 40, 950); c.stroke();
      c.beginPath(); c.moveTo(x + 115, 950); c.lineTo(x + 115, H); c.stroke();
    }
    c.fillStyle = 'rgba(255,220,170,0.06)'; c.fillRect(-20, FLOOR, W + 40, 4);
    // rug
    c.beginPath(); c.ellipse(1000, 944, 560, 38, 0, 0, TAU); fillStroke(c, '#7d2a3f', 3);
    c.beginPath(); c.ellipse(1000, 944, 520, 30, 0, 0, TAU); c.strokeStyle = '#e1b155'; c.lineWidth = 3; c.setLineDash([14, 10]); c.stroke(); c.setLineDash([]);
  }

  function shadow(c, x, w) { c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(x, FLOOR + 4, w / 2, 7, 0, 0, TAU); c.fill(); }

  function furniture(c, v, t, state) {
    // --- stool
    if (vis(v, 370, 830, 490, 905)) {
      shadow(c, 430, 110);
      c.strokeStyle = OUT; c.lineWidth = 3; c.fillStyle = '#7a4a2e';
      for (const [x0, x1] of [[396, 384], [464, 476], [430, 430]]) { c.beginPath(); c.moveTo(x0 - 5, 856); c.lineTo(x1 - 5, FLOOR); c.lineTo(x1 + 5, FLOOR); c.lineTo(x0 + 5, 856); c.closePath(); c.fill(); c.stroke(); }
      rr(c, 380, 838, 100, 22, 10); fillStroke(c, '#b8466f', 3);
      c.fillStyle = 'rgba(255,255,255,0.18)'; rr(c, 390, 842, 80, 5, 3); c.fill();
      c.fillStyle = '#e9b457'; for (const bx of [392, 430, 468]) { c.beginPath(); c.arc(bx, 852, 2.2, 0, TAU); c.fill(); }
    }
    // --- coffee table
    if (vis(v, 550, 760, 890, 905)) {
      shadow(c, 720, 340);
      for (const lx of [586, 826]) {
        c.beginPath(); c.moveTo(lx - 12, 806); c.lineTo(lx + 12, 806); c.lineTo(lx + 6, 840); c.lineTo(lx + 11, 860); c.lineTo(lx + 5, FLOOR); c.lineTo(lx - 5, FLOOR); c.lineTo(lx - 11, 860); c.lineTo(lx - 6, 840); c.closePath(); fillStroke(c, '#8d5a35', 3);
      }
      rr(c, 566, 790, 308, 16, 4); fillStroke(c, '#7d4f2e', 3);
      rr(c, 560, 770, 320, 22, 6); fillStroke(c, '#b57a45', 3);
      c.fillStyle = 'rgba(255,255,255,0.2)'; rr(c, 570, 774, 300, 4, 2); c.fill();
      c.fillStyle = 'rgba(255,248,235,0.85)'; c.beginPath(); c.ellipse(700, 772, 66, 5, 0, 0, TAU); c.fill();
    }
    // --- sofa
    if (vis(v, 910, 680, 1350, 905)) {
      shadow(c, 1130, 440);
      rr(c, 930, 690, 400, 112, 22); fillStroke(c, '#2c7870', 3.5);
      c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 3;
      for (const bx of [1063, 1197]) { c.beginPath(); c.moveTo(bx, 702); c.lineTo(bx, 796); c.stroke(); }
      c.fillStyle = '#e9b457'; for (const bx of [1063, 1197]) for (const by of [722, 760]) { c.beginPath(); c.arc(bx, by, 3.5, 0, TAU); c.fill(); }
      rr(c, 996, 792, 270, 70, 14); fillStroke(c, '#3b9188', 3.5);
      c.strokeStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.moveTo(1131, 800); c.lineTo(1131, 856); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.14)'; rr(c, 1006, 797, 250, 6, 3); c.fill();
      rr(c, 920, 744, 82, 140, 22); fillStroke(c, '#276b64', 3.5);
      rr(c, 1258, 744, 82, 140, 22); fillStroke(c, '#276b64', 3.5);
      c.fillStyle = 'rgba(255,255,255,0.14)'; rr(c, 930, 750, 62, 6, 3); c.fill(); rr(c, 1268, 750, 62, 6, 3); c.fill();
      rr(c, 928, 866, 404, 20, 6); fillStroke(c, '#3a2230', 3);
      for (const lx of [940, 1300]) { rr(c, lx, 884, 22, 16, 4); fillStroke(c, '#7d4f2e', 2.5); }
      // a lumpy cushion
      c.save(); c.translate(1230, 783); c.rotate(-0.25);
      rr(c, -28, -18, 56, 36, 12); fillStroke(c, '#e0725a', 3); c.restore();
    }
    // --- wall shelf
    if (vis(v, 1000, 460, 1300, 530)) {
      for (const bx of [1040, 1252]) { c.beginPath(); c.moveTo(bx - 8, 486); c.lineTo(bx + 14, 486); c.lineTo(bx - 8, 522); c.closePath(); fillStroke(c, '#5d3a22', 2.5); }
      rr(c, 1010, 470, 280, 16, 4); fillStroke(c, '#9a6136', 3);
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(1016, 473, 268, 3);
    }
    // --- TV cabinet + lamp
    if (vis(v, 1470, 600, 1810, 905)) {
      shadow(c, 1640, 340);
      rr(c, 1486, 724, 308, 166, 6); fillStroke(c, '#6f4229', 3.5);
      for (const dx of [1498, 1646]) { rr(c, dx, 738, 140, 138, 6); fillStroke(c, '#85512f', 2.5); c.beginPath(); c.arc(dx + (dx < 1600 ? 122 : 18), 806, 5, 0, TAU); fillStroke(c, '#e0b04e', 2); }
      for (const lx of [1500, 1772]) { rr(c, lx, 888, 22, 14, 3); fillStroke(c, '#3a2230', 2.5); }
      rr(c, 1480, 700, 320, 24, 6); fillStroke(c, '#a56b3b', 3.5);
      c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(1488, 704, 304, 4);
      // table lamp
      c.beginPath(); c.ellipse(1520, 698, 18, 6, 0, 0, TAU); fillStroke(c, '#c28a52', 2.5);
      rr(c, 1514, 650, 12, 48, 4); fillStroke(c, '#c28a52', 2.5);
      const flick = state === 'stir' ? (Math.sin(t * 40) > 0.6 ? 0.55 : 1) : 1;
      c.beginPath(); c.moveTo(1494, 658); c.lineTo(1546, 658); c.lineTo(1536, 620); c.lineTo(1504, 620); c.closePath();
      fillStroke(c, state === 'awake' ? '#fff3c4' : `rgba(247,200,106,${flick})`, 3);
    }
    // --- bookshelf
    if (vis(v, 1940, 190, 2400, 905)) {
      shadow(c, 2170, 450);
      c.fillStyle = '#26151f'; c.fillRect(1984, 215, 372, 685);
      // cabinet doors at the bottom
      rr(c, 1992, 780, 176, 112, 4); fillStroke(c, '#5d3920', 2.5); rr(c, 2172, 780, 176, 112, 4); fillStroke(c, '#5d3920', 2.5);
      c.beginPath(); c.arc(2156, 836, 5, 0, TAU); fillStroke(c, '#e0b04e', 2); c.beginPath(); c.arc(2184, 836, 5, 0, TAU); fillStroke(c, '#e0b04e', 2);
      const palette = ['#c4412f', '#e8b13a', '#3a7ca5', '#5b8c5a', '#8e4a9e', '#d9733b', '#2d5a6b', '#b83a63', '#e9dcc0'];
      const shelves = [760, 610, 460, 310];
      shelves.forEach((sy, si) => {
        const r = rng(100 + si);
        let x = 1992;
        const gapFrom = si === 2 ? 2150 : 99999, gapTo = si === 2 ? 2270 : 99999;
        while (x < 2348) {
          if (x >= gapFrom && x < gapTo) { x = gapTo; continue; }
          const bw = 13 + Math.floor(r() * 14), bh = 70 + Math.floor(r() * 56), col = palette[Math.floor(r() * palette.length)];
          if (x + bw > 2350) break;
          const lean = r() < 0.07;
          c.save(); if (lean) { c.translate(x + bw, sy); c.rotate(-0.22); c.translate(-(x + bw), -sy); }
          c.beginPath(); c.rect(x, sy - bh, bw, bh); fillStroke(c, col, 2);
          c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(x + 2, sy - bh + 8, bw - 4, 3); c.fillRect(x + 2, sy - 20, bw - 4, 3);
          c.restore();
          x += bw + (lean ? 18 : 1);
        }
      });
      for (const sy of shelves) { rr(c, 1984, sy, 372, 14, 3); fillStroke(c, '#7d4f2e', 3); }
      rr(c, 1960, 215, 24, 685, 4); fillStroke(c, '#6b4228', 3.5);
      rr(c, 2356, 215, 24, 685, 4); fillStroke(c, '#6b4228', 3.5);
      rr(c, 1950, 200, 440, 16, 5); fillStroke(c, '#946033', 3.5);
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(1956, 203, 428, 3);
    }
  }

  function mouseHole(c, t, haul, state) {
    c.save();
    c.beginPath(); c.moveTo(-4, FLOOR); c.lineTo(-4, 836); c.quadraticCurveTo(26, 790, 60, 836); c.lineTo(66, FLOOR); c.closePath();
    c.fillStyle = '#0b0610'; c.fill();
    c.clip();
    const g = c.createRadialGradient(10, 880, 4, 10, 880, 70);
    g.addColorStop(0, `rgba(255,190,90,${0.75 + Math.sin(t * 3) * 0.08})`); g.addColorStop(1, 'rgba(255,150,60,0)');
    c.fillStyle = g; c.fillRect(-10, 800, 90, 100);
    // tiny cheese stash + bed
    c.fillStyle = '#f3c43a'; c.beginPath(); c.moveTo(6, 899); c.lineTo(34, 899); c.lineTo(34, 884); c.closePath(); c.fill();
    c.fillStyle = '#c4412f'; c.fillRect(-4, 890, 20, 9);
    c.restore();
    c.beginPath(); c.moveTo(-4, FLOOR); c.lineTo(-4, 836); c.quadraticCurveTo(26, 790, 60, 836); c.lineTo(66, FLOOR);
    c.lineWidth = 7; c.strokeStyle = '#c28a52'; c.stroke(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    // little sign
    c.save(); c.translate(32, 786); c.rotate(Math.sin(t * 1.3) * 0.04);
    rr(c, -26, -2, 52, 16, 4); fillStroke(c, '#f3d97a', 2);
    c.fillStyle = OUT; c.font = '800 10px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('HOME', 0, 10);
    c.restore();
  }

  function pad(c, t, haul, state, G) {
    const x = 70, w = 270;
    // light column
    const a = 0.10 + 0.04 * Math.sin(t * 2.4) + (haul > 0 ? 0.06 : 0);
    c.fillStyle = lin(c, 0, 790, 0, FLOOR, [[0, 'rgba(255,230,140,0)'], [1, `rgba(255,230,140,${a})`]]);
    c.fillRect(x, 790, w, 110);
    // doormat on the floor
    c.beginPath(); c.moveTo(x + 6, FLOOR + 1); c.lineTo(x + w - 6, FLOOR + 1); c.lineTo(x + w + 10, FLOOR + 30); c.lineTo(x - 4, FLOOR + 30); c.closePath();
    fillStroke(c, '#d65f86', 3);
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2; c.setLineDash([10, 8]);
    c.beginPath(); c.moveTo(x + 14, FLOOR + 7); c.lineTo(x + w - 14, FLOOR + 7); c.lineTo(x + w + 2, FLOOR + 24); c.lineTo(x + 2, FLOOR + 24); c.closePath(); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#fff6d6'; c.font = '800 14px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('DROP LOOT HERE', x + w / 2, FLOOR + 21);
    // sign post
    const bob = Math.sin(t * 3) * 3;
    c.save(); c.translate(x + w / 2, 800 + bob);
    rr(c, -52, -22, 104, 30, 8); fillStroke(c, '#fff0b0', 3);
    c.fillStyle = OUT; c.font = '800 15px system-ui, sans-serif'; c.fillText(haul > 0 ? 'BANK IT!' : 'SAFE ZONE', 0, -2);
    c.beginPath(); c.moveTo(-9, 12); c.lineTo(9, 12); c.lineTo(0, 24); c.closePath(); fillStroke(c, '#fff0b0', 2.5);
    c.restore();
  }

  /* ---------------------------------------------------------------- loot */
  function chainLoop(c, rx, ry, cy) {
    c.save(); c.strokeStyle = '#e9b83c'; c.lineWidth = 2.6; c.setLineDash([3.2, 2.2]);
    c.beginPath(); c.ellipse(0, cy, rx, ry, 0, 0, TAU); c.stroke(); c.setLineDash([]); c.restore();
  }
  function sparkle(c, x, y, s, a) {
    c.save(); c.translate(x, y); c.globalAlpha = a; c.fillStyle = '#fffbe0';
    c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(s * 0.12, -s * 0.12, s, 0); c.quadraticCurveTo(s * 0.12, s * 0.12, 0, s); c.quadraticCurveTo(-s * 0.12, s * 0.12, -s, 0); c.quadraticCurveTo(-s * 0.12, -s * 0.12, 0, -s); c.fill();
    c.restore();
  }

  const LOOT = {
    necklace(c, it, t) {
      chainLoop(c, 14, 17, -15);
      c.beginPath(); c.moveTo(0, -7); c.lineTo(9, 0); c.lineTo(0, 9); c.lineTo(-9, 0); c.closePath(); fillStroke(c, '#d6264f', 2.5);
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.moveTo(-2, -4); c.lineTo(3, -1); c.lineTo(-2, 0); c.closePath(); c.fill();
      sparkle(c, 6, -6, 5 + Math.sin(t * 5 + it.seed) * 2, 0.6 + 0.4 * Math.sin(t * 4 + it.seed));
    },
    watch(c, it, t) {
      chainLoop(c, 8, 14, -16);
      c.beginPath(); c.arc(0, 0, 10.5, 0, TAU); fillStroke(c, '#e9b83c', 2.5);
      c.beginPath(); c.arc(0, 0, 7.4, 0, TAU); c.fillStyle = '#fffbe9'; c.fill();
      c.lineWidth = 1.6; c.strokeStyle = OUT; c.lineCap = 'round';
      const a = t * 0.9 + it.seed;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(a) * 6, -Math.cos(a) * 6); c.stroke();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(a / 12) * 4, -Math.cos(a / 12) * 4); c.stroke();
      c.fillStyle = '#e9b83c'; c.fillRect(-2, -14, 4, 4);
    },
    ball(c, it, t) {
      c.save(); c.beginPath(); c.arc(0, 0, 19, 0, TAU); c.clip();
      const cols = ['#e04b4b', '#fff', '#3d8bd8', '#fff', '#f2c94c', '#fff'];
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 24, i * TAU / 6, (i + 1) * TAU / 6); c.closePath(); c.fillStyle = cols[i]; c.fill(); }
      c.restore();
      c.beginPath(); c.arc(0, 0, 19, 0, TAU); c.lineWidth = 2.6; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.arc(0, 0, 3, 0, TAU); c.fillStyle = OUT; c.fill();
    },
    teapot(c, it, t) {
      // handle + spout
      c.lineWidth = 6; c.strokeStyle = OUT; c.beginPath(); c.arc(-23, 0, 11, -1.9, 1.9, true); c.stroke();
      c.lineWidth = 3; c.strokeStyle = '#efe3cb'; c.beginPath(); c.arc(-23, 0, 11, -1.9, 1.9, true); c.stroke();
      c.beginPath(); c.moveTo(18, 2); c.quadraticCurveTo(34, 6, 36, -14); c.lineTo(31, -16); c.quadraticCurveTo(28, -2, 14, -6); c.closePath(); fillStroke(c, '#efe3cb', 2.5);
      c.beginPath(); c.ellipse(0, 1, 24, 17, 0, 0, TAU); fillStroke(c, '#efe3cb', 3);
      c.save(); c.beginPath(); c.ellipse(0, 1, 24, 17, 0, 0, TAU); c.clip();
      c.fillStyle = '#4a7cc0'; c.fillRect(-26, -2, 52, 6);
      c.fillStyle = '#d6577d'; for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * 9, 1, 2.4, 0, TAU); c.fill(); }
      c.restore();
      c.beginPath(); c.ellipse(0, -15, 12, 5, 0, 0, TAU); fillStroke(c, '#efe3cb', 2.5);
      c.beginPath(); c.arc(0, -21, 4, 0, TAU); fillStroke(c, '#d6577d', 2);
    },
    candle(c, it, t) {
      c.beginPath(); c.ellipse(0, 25, 14, 5, 0, 0, TAU); fillStroke(c, '#d19a33', 2.5);
      c.beginPath(); c.moveTo(-3, 22); c.lineTo(3, 22); c.lineTo(4, 0); c.lineTo(-4, 0); c.closePath(); fillStroke(c, '#e2ad43', 2.5);
      c.beginPath(); c.ellipse(0, 10, 7, 3, 0, 0, TAU); fillStroke(c, '#e2ad43', 2);
      c.beginPath(); c.moveTo(-9, -8); c.lineTo(9, -8); c.lineTo(5, 3); c.lineTo(-5, 3); c.closePath(); fillStroke(c, '#e2ad43', 2.5);
      rr(c, -4.5, -26, 9, 18, 2); fillStroke(c, '#f4ecd6', 2);
      const f = 1 + Math.sin(t * 13 + it.seed) * 0.14;
      c.save(); c.translate(0, -29); c.scale(f * 0.9, f);
      c.beginPath(); c.moveTo(0, -9); c.quadraticCurveTo(6, -1, 0, 3); c.quadraticCurveTo(-6, -1, 0, -9); c.fillStyle = '#ffb02e'; c.fill();
      c.beginPath(); c.moveTo(0, -4); c.quadraticCurveTo(3, 0, 0, 2); c.quadraticCurveTo(-3, 0, 0, -4); c.fillStyle = '#fff2a8'; c.fill();
      c.restore();
    },
    pan(c, it, t) {
      // handle
      rr(c, 20, -4.5, 44, 9, 4); fillStroke(c, '#5b3a24', 2.5);
      c.beginPath(); c.arc(58, 0, 2.4, 0, TAU); c.fillStyle = '#1d1226'; c.fill();
      // pan
      c.beginPath(); c.arc(0, 0, 25, 0, TAU); fillStroke(c, '#34343e', 3);
      c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.fillStyle = '#23232b'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, 22.5, 3.6, 4.7); c.stroke();
      // fried egg
      c.beginPath(); c.moveTo(-12, -4); c.quadraticCurveTo(-14, -14, -2, -13); c.quadraticCurveTo(10, -16, 13, -5); c.quadraticCurveTo(18, 6, 6, 11); c.quadraticCurveTo(-8, 15, -13, 5); c.closePath(); c.fillStyle = '#fffaf0'; c.fill();
      c.beginPath(); c.arc(0, -1, 6, 0, TAU); c.fillStyle = '#ffb81f'; c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(-2, -3, 1.8, 0, TAU); c.fill();
    },
    tv(c, it, t) {
      // antenna
      c.strokeStyle = '#9a9aa6'; c.lineWidth = 2.5; c.lineCap = 'round';
      const wob = Math.sin(t * 6 + it.seed) * (it.hauled ? 4 : 0.5);
      c.beginPath(); c.moveTo(-6, -40); c.lineTo(-28 + wob, -74); c.moveTo(6, -40); c.lineTo(26 + wob, -70); c.stroke();
      c.fillStyle = '#ddd'; c.beginPath(); c.arc(-28 + wob, -74, 3, 0, TAU); c.arc(26 + wob, -70, 3, 0, TAU); c.fill(); c.lineCap = 'butt';
      rr(c, -59, -40, 118, 80, 12); fillStroke(c, '#7a4e3a', 3);
      rr(c, -50, -31, 74, 62, 10); fillStroke(c, '#10151c', 2.5);
      // screen
      c.save(); rr(c, -47, -28, 68, 56, 8); c.clip();
      const k = Math.floor(t * 12 + it.seed);
      const r = rng(k);
      c.fillStyle = '#79d9d0'; c.fillRect(-50, -31, 74, 62);
      for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '20,60,70'},${0.25 + r() * 0.45})`; c.fillRect(-50 + r() * 70, -31 + r() * 58, 8 + r() * 36, 3 + r() * 6); }
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.moveTo(-44, -26); c.lineTo(-10, -26); c.lineTo(-44, 0); c.closePath(); c.fill();
      c.restore();
      // dials
      for (const dy of [-14, 8]) { c.beginPath(); c.arc(41, dy, 8, 0, TAU); fillStroke(c, '#d8c9a0', 2.2); c.fillStyle = OUT; c.fillRect(40, dy - 7, 2, 7); }
      c.fillStyle = '#10151c'; for (let i = 0; i < 4; i++) c.fillRect(35, 22 + i * 3, 12, 1.4);
    },
    vacuum(c, it, t) {
      const on = it.vac && it.vac.on;
      const sh = on ? Math.sin(t * 60) * 1.6 : 0;
      c.save(); c.translate(0, sh);
      // hose
      c.lineWidth = 9; c.strokeStyle = OUT; c.lineCap = 'round';
      c.beginPath(); c.moveTo(42, -8); c.bezierCurveTo(88, -34, 86, 14, 70, 22); c.stroke();
      c.lineWidth = 5.5; c.strokeStyle = '#8b8d99'; c.beginPath(); c.moveTo(42, -8); c.bezierCurveTo(88, -34, 86, 14, 70, 22); c.stroke();
      rr(c, 60, 20, 34, 9, 3); fillStroke(c, '#555764', 2.5);
      c.lineCap = 'butt';
      // body
      rr(c, -46, -24, 92, 48, 20); fillStroke(c, '#c9402f', 3);
      c.fillStyle = 'rgba(255,255,255,0.22)'; rr(c, -38, -19, 76, 6, 3); c.fill();
      c.fillStyle = '#d7d9e2'; c.fillRect(-46, 4, 92, 5);
      for (const wx of [-28, 28]) { c.beginPath(); c.arc(wx, 23, 9, 0, TAU); fillStroke(c, '#2b2b36', 2.5); c.beginPath(); c.arc(wx, 23, 3, 0, TAU); c.fillStyle = '#8b8d99'; c.fill(); }
      rr(c, -14, -33, 28, 10, 5); fillStroke(c, '#7c7e8c', 2.5);
      // googly eyes
      for (const ex of [-17, 3]) {
        c.beginPath(); c.arc(ex, -7, 8, 0, TAU); fillStroke(c, '#fff', 2);
        const px = on ? Math.sin(t * 20) * 2.5 : Math.sin(t * 1.3 + it.seed) * 1.6;
        c.beginPath(); c.arc(ex + px, -6, 3.6, 0, TAU); c.fillStyle = OUT; c.fill();
        if (on) { c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(ex - 8, -17); c.lineTo(ex + 8, -12); c.stroke(); }
      }
      c.restore();
    },
    trophy(c, it, t) {
      c.save();
      c.lineWidth = 4; c.strokeStyle = OUT;
      for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 19, -14, 8, s < 0 ? 1.5 : -1.6, s < 0 ? 4.7 : 1.6, s < 0); c.stroke(); }
      c.lineWidth = 2; c.strokeStyle = '#f3c43a';
      for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 19, -14, 8, s < 0 ? 1.5 : -1.6, s < 0 ? 4.7 : 1.6, s < 0); c.stroke(); }
      c.beginPath(); c.moveTo(-19, -23); c.lineTo(19, -23); c.quadraticCurveTo(18, 6, 4, 8); c.lineTo(-4, 8); c.quadraticCurveTo(-18, 6, -19, -23); c.closePath();
      fillStroke(c, lin(c, -19, 0, 19, 0, [[0, '#f6d561'], [0.5, '#fff0a0'], [1, '#d6a128']]), 3);
      rr(c, -3.5, 6, 7, 8, 2); fillStroke(c, '#e2b43a', 2);
      rr(c, -15, 12, 30, 12, 3); fillStroke(c, '#5d3a22', 2.5);
      c.fillStyle = '#f3c43a'; c.fillRect(-9, 16, 18, 4);
      c.fillStyle = '#c4412f'; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.4 : 7.5; c.lineTo(Math.cos(a) * r, -9 + Math.sin(a) * r); }
      c.closePath(); c.fill();
      c.restore();
      sparkle(c, -10, -18, 5 + Math.sin(t * 3 + it.seed) * 2, 0.5 + 0.5 * Math.sin(t * 3 + it.seed));
    },
    ring(c, it, t) {
      c.beginPath(); c.arc(0, 3, 8.2, 0, TAU); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke();
      c.lineWidth = 3; c.strokeStyle = '#f3c43a'; c.stroke();
      c.beginPath(); c.moveTo(0, -12); c.lineTo(6.5, -6); c.lineTo(0, 0); c.lineTo(-6.5, -6); c.closePath(); fillStroke(c, '#bff3ff', 2);
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.moveTo(-3, -8); c.lineTo(0, -10); c.lineTo(1, -6); c.closePath(); c.fill();
      const tw = 0.5 + 0.5 * Math.sin(t * 4 + it.seed);
      sparkle(c, 5, -11, 9 + tw * 5, 0.5 + tw * 0.5);
      sparkle(c, -9, -3, 5 + (1 - tw) * 3, 0.3 + (1 - tw) * 0.6);
    }
  };

  /* ---------------------------------------------------------------- creature */
  function creature(c, p) {
    const r = p.r;
    c.save(); c.translate(p.x, p.y);
    // feet
    const step = Math.sin(p.walk) * (p.moving ? 5 : 0);
    c.fillStyle = '#3a2370'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    for (const s of [-1, 1]) {
      const lift = p.grounded ? Math.max(0, Math.sin(p.walk + (s > 0 ? Math.PI : 0))) * (p.moving ? 4 : 0) : -3;
      c.beginPath(); c.ellipse(s * 9 + (p.grounded ? s * step * 0.2 : 0), r - 2 - lift, 8, 5, 0, 0, TAU); c.fill(); c.stroke();
    }
    // body
    c.save(); c.rotate(p.sa); c.scale(1 + p.sq, 1 - p.sq * 0.85);
    c.beginPath(); c.arc(0, 0, r, 0, TAU);
    c.fillStyle = lin(c, 0, -r, 0, r, [[0, '#a874ee'], [0.55, '#7c4cd0'], [1, '#5a33a6']]); c.fill();
    c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.ellipse(0, r * 0.35, r * 0.62, r * 0.5, 0, 0, TAU); c.fillStyle = 'rgba(214,190,255,0.55)'; c.fill();
    c.restore();
    // beanie
    c.save(); c.rotate(p.sa * 0.5);
    c.beginPath(); c.arc(0, -r * 0.18, r * 0.98, Math.PI * 1.06, Math.PI * 1.94); c.closePath();
    fillStroke(c, '#26233f', 3);
    c.save(); c.clip(); c.fillStyle = '#e9e3d0'; c.fillRect(-r, -r * 0.9, r * 2, 4.5); c.fillRect(-r, -r * 0.62, r * 2, 4.5); c.restore();
    c.beginPath(); c.arc(0 + Math.sin(p.walk * 0.7) * 1.5, -r * 1.2, 4.6, 0, TAU); fillStroke(c, '#d6577d', 2);
    c.restore();
    // mask
    const lx = p.lookX * 2.6, ly = p.lookY * 2.2;
    c.save(); c.translate(lx * 0.6, ly * 0.5 - 1);
    rr(c, -r * 0.92, -r * 0.5, r * 1.84, r * 0.62, r * 0.3); fillStroke(c, '#17121f', 2.5);
    // eyes
    const open = p.blink > 0 ? 0.12 : 1;
    for (const s of [-1, 1]) {
      c.save(); c.translate(s * r * 0.38, -r * 0.19);
      c.beginPath(); c.ellipse(0, 0, 5.8, 6.4 * open + 0.6, 0, 0, TAU); c.fillStyle = '#fffdf2'; c.fill();
      if (open > 0.5) {
        const px = p.lookX * 2.2, py = p.lookY * 2.4;
        if (p.greedy) {
          c.fillStyle = '#f3c43a'; c.beginPath(); c.arc(px, py, 3.6, 0, TAU); c.fill();
          c.fillStyle = OUT; c.font = '800 6px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('$', px, py + 2.2);
        } else {
          c.fillStyle = OUT; c.beginPath(); c.arc(px, py, 3.1 + (p.scared ? -0.6 : 0), 0, TAU); c.fill();
          c.fillStyle = '#fff'; c.beginPath(); c.arc(px - 1, py - 1.2, 1, 0, TAU); c.fill();
        }
      }
      // brows
      c.strokeStyle = '#17121f'; c.lineWidth = 2.4; c.lineCap = 'round';
      const worry = p.strain > 0.35 || p.scared ? 1 : 0, sly = p.greedy ? 1 : 0;
      c.beginPath();
      if (worry) { c.moveTo(-s * 6, -10.5); c.lineTo(s * 6 * -0.1 + s * 5.5, -7.8 - 2.5); }
      else if (sly) { c.moveTo(-s * 5, -8.5 - 2); c.lineTo(s * 5, -9.4 + 1); }
      else { c.moveTo(-5, -9.2); c.lineTo(5, -9.2 - s * 0.6); }
      c.stroke(); c.lineCap = 'butt';
      c.restore();
    }
    c.restore();
    // mouth
    c.save(); c.translate(lx * 0.4, ly * 0.3 + r * 0.42);
    c.strokeStyle = OUT; c.lineWidth = 2.4; c.lineCap = 'round';
    if (p.mouth === 'o') { c.beginPath(); c.ellipse(0, 0, 3.4, 4.2, 0, 0, TAU); c.fillStyle = '#3a1030'; c.fill(); c.stroke(); }
    else if (p.mouth === 'grin') {
      c.beginPath(); c.moveTo(-8, -2); c.quadraticCurveTo(0, 9, 8, -2); c.closePath(); c.fillStyle = '#3a1030'; c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.fillRect(-5, -2, 10, 3);
    } else if (p.mouth === 'strain') {
      c.beginPath(); c.moveTo(-7, 1); for (let i = 1; i <= 4; i++) c.lineTo(-7 + i * 3.5, 1 + (i % 2 ? 2 : -2)); c.stroke();
    } else if (p.mouth === 'gulp') { c.beginPath(); c.moveTo(-5, 1); c.quadraticCurveTo(0, -2, 5, 1); c.stroke(); }
    else { c.beginPath(); c.moveTo(-6, 0); c.quadraticCurveTo(0, 5, 7, -2); c.stroke(); }
    c.lineCap = 'butt'; c.restore();
    // sweat
    if (p.strain > 0.4 || p.scared) {
      const k = (p.t * 1.6) % 1;
      c.fillStyle = 'rgba(160,220,255,0.95)'; c.strokeStyle = OUT; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(r * 0.8, -r * 0.8 + k * 10); c.quadraticCurveTo(r * 0.8 + 5, -r * 0.8 + 7 + k * 10, r * 0.8, -r * 0.8 + 10 + k * 10); c.quadraticCurveTo(r * 0.8 - 5, -r * 0.8 + 7 + k * 10, r * 0.8, -r * 0.8 + k * 10); c.fill(); c.stroke();
    }
    c.restore();
  }

  window.Art = { rr, fillStroke, lin, wall, windowArt, decor, floor, furniture, mouseHole, pad, LOOT, creature, sparkle, OUT, vis };
})();
