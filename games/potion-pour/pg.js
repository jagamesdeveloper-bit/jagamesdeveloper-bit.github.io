/* PG - shared Playgama platform layer + tiny canvas toolkit.
   Bridge init, storage, ads, pause/audio, telemetry, input, UI, audio synth. */
(function () {
  'use strict';
  var PG = (window.PG = {});
  var B = null; // bridge instance (or null)
  var dpr = 1;
  var errCount = 0, rejCount = 0;
  window.addEventListener('error', function () { errCount++; });
  window.addEventListener('unhandledrejection', function () { rejCount++; });

  /* ---------------- state ---------------- */
  PG.version = '1.0.0';
  PG.id = 'game';
  PG.save = {};
  PG.defaults = {};
  PG.paused = false;       // host pause (ad, tab hidden, platform)
  PG.userPaused = false;   // player pause
  PG.muted = false;        // player mute
  PG.platAudio = true;     // platform audio flag
  PG.playing = false;      // set true by game during active gameplay (perf sampling)
  PG.w = 800; PG.h = 600; PG.dpr = 1;
  PG.lang = 'en';
  PG.time = 0;

  /* ---------------- bridge ---------------- */
  function bridgeCall(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }

  PG.init = function (opts) {
    PG.id = opts.id; PG.version = opts.version || '1.0.0';
    PG.defaults = opts.defaults || {};
    PG.save = JSON.parse(JSON.stringify(PG.defaults));
    return new Promise(function (resolve) {
      var done = false;
      function finish() { if (done) return; done = true; PG._inited = true; resolve(); }
      setTimeout(finish, 4500);
      var hasBridge = typeof window.bridge !== 'undefined' && window.bridge;
      if (!hasBridge) { loadLocal(); finish(); return; }
      B = window.bridge;
      B.initialize().then(function () {
        try {
          PG.lang = (B.platform.language || 'en').slice(0, 2);
          PG.platAudio = B.platform.isAudioEnabled !== false;
          B.platform.on(B.EVENT_NAME.AUDIO_STATE_CHANGED, function (en) { PG.platAudio = !!en; PG._applyAudio(); });
          B.platform.on(B.EVENT_NAME.PAUSE_STATE_CHANGED, function (p) { PG.paused = !!p; PG._applyAudio(); });
        } catch (e) { }
        return B.storage.get(['save']).then(function (data) {
          var raw = data && data[0];
          if (raw) { try { var o = typeof raw === 'string' ? JSON.parse(raw) : raw; merge(PG.save, o); } catch (e) { } }
        }).catch(function () { });
      }).catch(function () { B = null; loadLocal(); }).then(function () { PG._applyAudio(); finish(); });
    });
  };
  function merge(dst, src) { for (var k in src) { if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') merge(dst[k], src[k]); else dst[k] = src[k]; } }
  // Only used when the Bridge script is unavailable (local dev); the real build always goes through Bridge.storage.
  function loadLocal() { try { var s = localStorage.getItem('pg_' + PG.id); if (s) merge(PG.save, JSON.parse(s)); } catch (e) { } }
  var saveTimer = 0;
  PG.commit = function (immediate) {
    clearTimeout(saveTimer);
    var run = function () {
      var s = JSON.stringify(PG.save);
      if (B) { try { B.storage.set(['save'], [s]).catch(function () { }); } catch (e) { } }
      else { try { localStorage.setItem('pg_' + PG.id, s); } catch (e) { } }
    };
    if (immediate) run(); else saveTimer = setTimeout(run, 250);
  };
  PG.ready = function () { if (PG._readySent) return; PG._readySent = true; if (B) bridgeCall(function () { B.platform.sendMessage('game_ready'); }); };
  PG.msg = function (m, data) { if (B) bridgeCall(function () { B.platform.sendMessage(m, data); }); };
  PG.track = function (name, data) { if (B) bridgeCall(function () { B.analytics.send(name, data); }); };

  /* ---------------- ads ---------------- */
  var adBusy = false;
  PG.rewardedSupported = function () { return !!B && bridgeCall(function () { return B.advertisement.isRewardedSupported; }, false); };
  PG.interstitial = function (placement) {
    return new Promise(function (resolve) {
      if (!B || adBusy || !bridgeCall(function () { return B.advertisement.isInterstitialSupported; }, false)) { resolve(false); return; }
      adBusy = true; var opened = false, fin = false;
      function end(ok) { if (fin) return; fin = true; adBusy = false; try { B.advertisement.off(B.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onS); } catch (e) { } clearTimeout(t1); clearTimeout(t2); resolve(ok); }
      function onS(s) { if (s === 'opened') { opened = true; } else if (s === 'closed') end(true); else if (s === 'failed') end(false); }
      var t1 = setTimeout(function () { if (!opened) end(false); }, 5000);
      var t2 = setTimeout(function () { end(false); }, 120000);
      try { B.advertisement.on(B.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onS); B.advertisement.showInterstitial(placement); } catch (e) { end(false); }
    });
  };
  PG.rewarded = function (placement) {
    return new Promise(function (resolve) {
      if (!B || adBusy || !PG.rewardedSupported()) { resolve(false); return; }
      adBusy = true; var opened = false, got = false, fin = false;
      function end() { if (fin) return; fin = true; adBusy = false; try { B.advertisement.off(B.EVENT_NAME.REWARDED_STATE_CHANGED, onS); } catch (e) { } clearTimeout(t1); clearTimeout(t2); resolve(got); }
      function onS(s) { if (s === 'opened') opened = true; else if (s === 'rewarded') got = true; else if (s === 'closed' || s === 'failed') end(); }
      var t1 = setTimeout(function () { if (!opened) end(); }, 5000);
      var t2 = setTimeout(end, 180000);
      try { B.advertisement.on(B.EVENT_NAME.REWARDED_STATE_CHANGED, onS); B.advertisement.showRewarded(placement); } catch (e) { end(); }
    });
  };

  /* ---------------- perf telemetry ---------------- */
  var perf = { dts: [], active: 0, wall0: 0, target: 60, over: [0, 0, 0, 0, 0] };
  PG.perfTarget = function (t) { perf.target = t; };
  PG._perfFrame = function (dt) {
    if (!PG.playing || PG.paused || PG.userPaused || document.hidden || dt > 1500) return;
    if (!perf.wall0) perf.wall0 = performance.now();
    perf.dts.push(dt); perf.active += dt;
    if (dt > 50) perf.over[0]++; if (dt > 100) perf.over[1]++; if (dt > 250) perf.over[2]++; if (dt > 500) perf.over[3]++; if (dt > 1000) perf.over[4]++;
    if (perf.active >= 30000) PG._perfFlush();
  };
  PG._perfFlush = function () {
    var d = perf.dts; if (d.length < 30) { perf.dts = []; perf.active = 0; perf.wall0 = 0; perf.over = [0, 0, 0, 0, 0]; return; }
    var s = d.slice().sort(function (a, b) { return a - b; });
    var q = function (p) { return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
    var sum = 0; for (var i = 0; i < d.length; i++) sum += d[i];
    var fpsAvg = 1000 / (sum / d.length);
    var fpsP10 = 1000 / q(0.90); // 10th percentile of FPS == 90th percentile of frame time
    var r = function (x) { return Math.round(x * 10) / 10; };
    PG.track('performance_sample', {
      target_fps: perf.target, window_ms: Math.round(performance.now() - perf.wall0), active_ms: Math.round(perf.active), frame_count: d.length,
      fps_avg: r(fpsAvg), fps_p10: r(fpsP10), frame_time_p50_ms: r(q(0.5)), frame_time_p95_ms: r(q(0.95)), frame_time_p99_ms: r(q(0.99)), frame_time_max_ms: r(s[s.length - 1]),
      frames_over_50ms: perf.over[0], frames_over_100ms: perf.over[1], frames_over_250ms: perf.over[2], frames_over_500ms: perf.over[3], frames_over_1000ms: perf.over[4],
      game_version: PG.version, js_error_count: errCount, unhandled_rejection_count: rejCount
    });
    errCount = 0; rejCount = 0;
    perf.dts = []; perf.active = 0; perf.wall0 = 0; perf.over = [0, 0, 0, 0, 0];
  };

  /* ---------------- canvas / loop ---------------- */
  var canvas, ctx, userUpdate, userRender, lastT = 0, started = false;
  var touchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  PG.touch = touchDevice;
  PG.setup = function (cv, update, render) {
    canvas = cv; ctx = cv.getContext('2d'); userUpdate = update; userRender = render; PG.ctx = ctx; PG.canvas = cv;
    var st = document.createElement('style');
    st.textContent = 'html,body{margin:0;height:100%;overflow:hidden;background:#000;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;overscroll-behavior:none}canvas{display:block;position:absolute;left:50%;top:0;transform:translateX(-50%);touch-action:none;outline:none}';
    document.head.appendChild(st);
    window.addEventListener('resize', resize); window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
    resize();
    bindInput();
    document.addEventListener('visibilitychange', function () { PG._applyAudio(); lastT = 0; });
    window.addEventListener('blur', function () { PG._applyAudio(); });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    requestAnimationFrame(frame);
  };
  function resize() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var w = Math.min(vw, vh * 2); // never wider than 2:1
    dpr = Math.min(window.devicePixelRatio || 1, touchDevice ? 2 : 2);
    canvas.style.width = w + 'px'; canvas.style.height = vh + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(vh * dpr);
    PG.w = w; PG.h = vh; PG.dpr = dpr;
    if (PG.onResize) PG.onResize(w, vh);
  }
  function frame(t) {
    requestAnimationFrame(frame);
    if (!lastT) { lastT = t; return; }
    var dtms = t - lastT;
    if (dtms < 15.5) return; // cap at ~60fps on high refresh panels
    lastT = t;
    var dt = Math.min(dtms, 50) / 1000;
    var halt = PG.paused || document.hidden;
    if (!halt) {
      PG.time += dt;
      if (!PG.userPaused) userUpdate(dt);
      PG._perfFrame(dtms);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, PG.w, PG.h);
    userRender(ctx, PG.w, PG.h, dt);
    PG.hud(ctx);
    I.pressed = false; I.released = false; I.clicked = false; I.keysPressed = {};
    if (!started && PG._inited) { started = true; PG.ready(); }
  }

  /* ---------------- input ---------------- */
  var I = (PG.input = { x: 0, y: 0, down: false, pressed: false, released: false, px: 0, py: 0, dx: 0, dy: 0, keys: {}, keysPressed: {}, wheel: 0 });
  function pos(e) { var r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * (PG.w / r.width), (e.clientY - r.top) * (PG.h / r.height)]; }
  function bindInput() {
    var el = canvas;
    el.addEventListener('pointerdown', function (e) {
      var p = pos(e); I.x = p[0]; I.y = p[1]; I.px = p[0]; I.py = p[1]; I.down = true; I.pressed = true; I.pid = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (_) { } PG.audioUnlock(); e.preventDefault();
      if (PG.onDown) PG.onDown(I.x, I.y);
    });
    el.addEventListener('pointermove', function (e) {
      var p = pos(e); I.dx += p[0] - I.x; I.dy += p[1] - I.y; I.x = p[0]; I.y = p[1];
      if (PG.onMove) PG.onMove(I.x, I.y);
    });
    function up(e) { var p = pos(e); I.x = p[0]; I.y = p[1]; if (I.down) { I.released = true; I.down = false; if (PG.onUp) PG.onUp(I.x, I.y); } }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    window.addEventListener('keydown', function (e) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) e.preventDefault();
      var k = e.key.toLowerCase(); if (!I.keys[k]) I.keysPressed[k] = true; I.keys[k] = true; PG.audioUnlock();
    });
    window.addEventListener('keyup', function (e) { I.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', function () { I.keys = {}; I.down = false; });
  }
  PG.key = function (k) { return !!I.keys[k]; };
  PG.keyHit = function (k) { return !!I.keysPressed[k]; };
  PG.inRect = function (x, y, w, h, px, py) { px = px === undefined ? I.x : px; py = py === undefined ? I.y : py; return px >= x && px <= x + w && py >= y && py <= y + h; };

  /* ---------------- UI toolkit ---------------- */
  var U = (PG.ui = {});
  var hudBtns = [];
  PG.font = '"Trebuchet MS","Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif';
  PG.scale = function () { return Math.max(0.55, Math.min(PG.w / 420, PG.h / 700, 2.2)); }; // generic UI unit
  U.rr = function (c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  U.text = function (c, s, x, y, size, color, align, o) {
    o = o || {}; c.font = (o.weight || '800') + ' ' + size + 'px ' + PG.font; c.textAlign = align || 'center'; c.textBaseline = o.base || 'middle';
    if (o.shadow !== false) { c.fillStyle = o.shadowColor || 'rgba(0,0,0,.35)'; c.fillText(s, x + size * 0.04, y + size * 0.07); }
    if (o.stroke) { c.lineWidth = size * 0.14; c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.strokeText(s, x, y); }
    c.fillStyle = color || '#fff'; c.fillText(s, x, y);
  };
  // immediate-mode button. returns true when clicked.
  U.button = function (c, x, y, w, h, label, o) {
    o = o || {}; var hover = PG.inRect(x, y, w, h), press = I.down && hover && PG.inRect(x, y, w, h, I.px, I.py);
    var col = o.color || '#ffb703', dark = o.dark || shade(col, -0.28);
    var off = press ? 2 : 0; var disabled = o.disabled;
    if (disabled) { col = '#8a8f98'; dark = '#5d626b'; }
    c.save(); U.rr(c, x, y + 5, w, h, h * 0.3); c.fillStyle = dark; c.fill();
    U.rr(c, x, y + off, w, h, h * 0.3); c.fillStyle = col; c.fill();
    c.globalAlpha = 0.28; U.rr(c, x + 3, y + off + 3, w - 6, h * 0.42, h * 0.25); c.fillStyle = '#fff'; c.fill(); c.globalAlpha = 1;
    U.text(c, label, x + w / 2, y + off + h / 2 + 1, o.size || Math.min(h * 0.46, 30), o.textColor || '#fff', 'center', { shadowColor: 'rgba(0,0,0,.3)' });
    if (o.sub) U.text(c, o.sub, x + w / 2, y + off + h * 0.78, Math.min(h * 0.24, 16), 'rgba(255,255,255,.9)', 'center', { shadow: false });
    c.restore();
    if (I.released && !disabled && PG.inRect(x, y, w, h) && PG.inRect(x, y, w, h, I.px, I.py)) { I.released = false; PG.sfx('tap'); return true; }
    return false;
  };
  U.panel = function (c, x, y, w, h, o) {
    o = o || {}; c.save(); U.rr(c, x, y + 6, w, h, 22); c.fillStyle = 'rgba(0,0,0,.28)'; c.fill();
    U.rr(c, x, y, w, h, 22); c.fillStyle = o.fill || 'rgba(20,24,40,.88)'; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = o.stroke || 'rgba(255,255,255,.22)'; c.stroke(); c.restore();
  };
  function shade(hex, p) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (v) { return Math.max(0, Math.min(255, Math.round(v + (p < 0 ? v * p : (255 - v) * p)))); };
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  U.shade = shade;
  U.coin = function (c, x, y, r) {
    c.save(); c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fillStyle = '#e09f00'; c.fill();
    c.beginPath(); c.arc(x, y - r * 0.05, r * 0.88, 0, 6.2832); c.fillStyle = '#ffd23f'; c.fill();
    c.beginPath(); c.arc(x, y - r * 0.05, r * 0.58, 0, 6.2832); c.strokeStyle = '#e8a800'; c.lineWidth = r * 0.16; c.stroke(); c.restore();
  };
  // Persistent HUD: sound toggle + pause (always visible, top right). Drawn above everything.
  PG.hudHidePause = false;
  PG.hud = function (c) {
    var s = PG.scale(), r = 17 * s, pad = 10 * s;
    var cx = PG.w - pad - r; var cy = pad + r;
    function ib(x, y, draw) {
      var hit = Math.hypot(I.x - x, I.y - y) < r + 4 && Math.hypot(I.px - x, I.py - y) < r + 4;
      c.save(); c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fillStyle = 'rgba(15,18,30,.55)'; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.4)'; c.stroke();
      draw(c, x, y, r); c.restore();
      if (I.released && hit) { I.released = false; return true; } return false;
    }
    if (ib(cx, cy, function (c, x, y, r) {
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x - r * 0.5, y - r * 0.2); c.lineTo(x - r * 0.2, y - r * 0.2); c.lineTo(x + r * 0.15, y - r * 0.5); c.lineTo(x + r * 0.15, y + r * 0.5); c.lineTo(x - r * 0.2, y + r * 0.2); c.lineTo(x - r * 0.5, y + r * 0.2); c.closePath(); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2;
      if (PG.muted) { c.beginPath(); c.moveTo(x + r * 0.3, y - r * 0.3); c.lineTo(x + r * 0.7, y + r * 0.3); c.moveTo(x + r * 0.7, y - r * 0.3); c.lineTo(x + r * 0.3, y + r * 0.3); c.stroke(); }
      else { c.beginPath(); c.arc(x + r * 0.1, y, r * 0.42, -0.9, 0.9); c.stroke(); c.beginPath(); c.arc(x + r * 0.1, y, r * 0.7, -0.8, 0.8); c.stroke(); }
    })) { PG.setMuted(!PG.muted); PG.sfx('tap'); }
    if (PG.playing && !PG.hudHidePause) {
      if (ib(cx - r * 2.3, cy, function (c, x, y, r) { c.fillStyle = '#fff'; if (PG.userPaused) { c.beginPath(); c.moveTo(x - r * 0.25, y - r * 0.45); c.lineTo(x + r * 0.5, y); c.lineTo(x - r * 0.25, y + r * 0.45); c.fill(); } else { c.fillRect(x - r * 0.42, y - r * 0.42, r * 0.28, r * 0.84); c.fillRect(x + r * 0.14, y - r * 0.42, r * 0.28, r * 0.84); } })) {
        PG.userPaused = !PG.userPaused; PG.msg(PG.userPaused ? 'level_paused' : 'level_resumed'); PG._applyAudio();
      }
    }
    if (PG.userPaused && PG.playing) {
      c.save(); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, PG.w, PG.h);
      U.text(c, 'PAUSED', PG.w / 2, PG.h * 0.4, 46 * s, '#fff', 'center');
      if (U.button(c, PG.w / 2 - 110 * s, PG.h * 0.5, 220 * s, 56 * s, 'Resume', { color: '#2ec4b6' })) { PG.userPaused = false; PG.msg('level_resumed'); PG._applyAudio(); }
      c.restore();
    }
  };
  PG.setMuted = function (m) { PG.muted = m; PG.save.muted = m; PG.commit(); PG._applyAudio(); };

  /* ---------------- audio (small WebAudio synth, no external files) ---------------- */
  var AC = null, master = null, musicGain = null, musicTimer = 0, musicCfg = null, musicStep = 0;
  PG.audioUnlock = function () {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.connect(AC.destination); musicGain = AC.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master); } catch (e) { return; } }
    if (AC.state === 'suspended') AC.resume();
    PG._applyAudio();
  };
  PG._applyAudio = function () {
    if (PG.muted === false && PG.save && PG.save.muted) PG.muted = true;
    var on = !PG.muted && PG.platAudio && !PG.paused && !document.hidden && !PG.userPaused;
    if (master) master.gain.value = on ? 0.8 : 0;
    if (AC) { if (!on && AC.state === 'running' && (PG.paused || document.hidden)) AC.suspend(); else if ((on || PG.userPaused || PG.muted) && AC.state === 'suspended' && !PG.paused && !document.hidden) AC.resume(); }
  };
  function tone(f, t0, dur, type, vol, slide, dest) {
    var o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, vol, hp) {
    var n = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = AC.createBufferSource(); s.buffer = buf; var g = AC.createGain(); g.gain.value = vol; var f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
    s.connect(f); f.connect(g); g.connect(master); s.start(t0);
  }
  var lastSfx = {};
  PG.sfx = function (name, pitch) {
    if (!AC || PG.muted || !PG.platAudio || PG.paused) return;
    var now = AC.currentTime; if (lastSfx[name] && now - lastSfx[name] < 0.035) return; lastSfx[name] = now;
    var p = pitch || 1;
    switch (name) {
      case 'tap': tone(520 * p, now, 0.07, 'triangle', 0.18, 1.3); break;
      case 'coin': tone(988 * p, now, 0.08, 'square', 0.1); tone(1319 * p, now + 0.07, 0.16, 'square', 0.1); break;
      case 'pop': tone(380 * p, now, 0.11, 'sine', 0.3, 2.2); break;
      case 'merge': tone(330 * p, now, 0.1, 'triangle', 0.25, 1.5); tone(495 * p, now + 0.07, 0.16, 'triangle', 0.22, 1.2); break;
      case 'hit': noise(now, 0.12, 0.35, 500); tone(140 * p, now, 0.12, 'square', 0.15, 0.5); break;
      case 'boom': noise(now, 0.4, 0.5, 120); tone(90 * p, now, 0.35, 'sawtooth', 0.25, 0.4); break;
      case 'shoot': tone(700 * p, now, 0.09, 'sawtooth', 0.1, 0.4); break;
      case 'jump': tone(300 * p, now, 0.16, 'sine', 0.3, 2.4); break;
      case 'land': noise(now, 0.07, 0.25, 300); break;
      case 'win': [523, 659, 784, 1047].forEach(function (f, i) { tone(f * p, now + i * 0.09, 0.22, 'triangle', 0.28); }); break;
      case 'lose': [392, 330, 262, 196].forEach(function (f, i) { tone(f * p, now + i * 0.13, 0.28, 'sawtooth', 0.14); }); break;
      case 'whoosh': noise(now, 0.18, 0.18, 1500); break;
      case 'drop': tone(220 * p, now, 0.12, 'sine', 0.3, 0.5); break;
      case 'perfect': tone(880 * p, now, 0.1, 'triangle', 0.25); tone(1320 * p, now + 0.08, 0.2, 'triangle', 0.25); break;
      case 'upgrade': [440, 554, 659, 880].forEach(function (f, i) { tone(f * p, now + i * 0.06, 0.18, 'square', 0.1); }); break;
      case 'err': tone(160, now, 0.18, 'square', 0.15); break;
      case 'ghost': tone(300 * p, now, 0.5, 'sine', 0.2, 0.5); tone(305 * p, now, 0.5, 'sine', 0.2, 0.5); break;
      case 'bell': tone(1568 * p, now, 0.5, 'sine', 0.2); tone(2093 * p, now, 0.35, 'sine', 0.1); break;
      default: tone(440 * p, now, 0.08, 'sine', 0.2);
    }
  };
  // Gentle generative background music. cfg: {scale:[semitones], root:Hz, bpm, wave, vol, bass}
  PG.music = function (cfg) {
    PG.audioUnlock(); if (!AC) return; musicCfg = cfg; musicStep = 0; clearInterval(musicTimer);
    if (!cfg) return; var stepMs = 60000 / cfg.bpm / 2;
    musicTimer = setInterval(function () {
      if (!AC || PG.muted || !PG.platAudio || PG.paused || PG.userPaused || document.hidden) return;
      var now = AC.currentTime, sc = cfg.scale, i = musicStep++;
      var deg = [0, 2, 4, 2, 5, 4, 2, 1, 0, 3, 5, 3, 6, 5, 3, 2][i % 16] + (Math.floor(i / 16) % 2 ? 1 : 0);
      var oct = Math.floor(deg / sc.length), f = cfg.root * Math.pow(2, (sc[deg % sc.length] + 12 * oct) / 12);
      if (i % 2 === 0 || Math.random() < 0.45) tone(f * 2, now, 0.45, cfg.wave || 'triangle', (cfg.vol || 0.07), 1, musicGain);
      if (i % 8 === 0) tone(cfg.root / 2 * Math.pow(2, sc[(Math.floor(i / 8) * 2) % sc.length] / 12), now, stepMs * 7 / 1000, 'sine', (cfg.bass || 0.12), 1, musicGain);
    }, stepMs);
  };

  /* ---------------- math / helpers ---------------- */
  PG.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  PG.lerp = function (a, b, t) { return a + (b - a) * t; };
  PG.rand = function (a, b) { return a + Math.random() * (b - a); };
  PG.ri = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  PG.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  PG.ease = { out: function (t) { return 1 - Math.pow(1 - t, 3); }, io: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }, back: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); } };
  PG.mulberry = function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  PG.fmt = function (n) { n = Math.floor(n); if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K'; return String(n); };
  // generic particle system
  PG.parts = [];
  PG.burst = function (x, y, n, o) {
    o = o || {};
    for (var i = 0; i < n; i++) { var a = Math.random() * 6.2832, s = PG.rand(o.min || 40, o.max || 220); PG.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), life: PG.rand(0.4, o.life || 0.9), t: 0, size: PG.rand(o.s0 || 3, o.s1 || 7), color: o.colors ? PG.pick(o.colors) : '#fff', g: o.g === undefined ? 300 : o.g, shape: o.shape || 'c' }); }
  };
  PG.updateParts = function (dt) { for (var i = PG.parts.length - 1; i >= 0; i--) { var p = PG.parts[i]; p.t += dt; if (p.t >= p.life) { PG.parts.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } };
  PG.drawParts = function (c) {
    for (var i = 0; i < PG.parts.length; i++) { var p = PG.parts[i], k = 1 - p.t / p.life; c.globalAlpha = Math.max(0, k); c.fillStyle = p.color; var s = p.size * (0.4 + 0.6 * k);
      if (p.shape === 's') c.fillRect(p.x - s, p.y - s, s * 2, s * 2); else { c.beginPath(); c.arc(p.x, p.y, s, 0, 6.2832); c.fill(); } }
    c.globalAlpha = 1;
  };
  // floating text popups
  PG.pops = [];
  PG.popText = function (x, y, s, color, size) { PG.pops.push({ x: x, y: y, s: s, color: color || '#fff', t: 0, size: size || 22 }); };
  PG.updatePops = function (dt) { for (var i = PG.pops.length - 1; i >= 0; i--) { var p = PG.pops[i]; p.t += dt; p.y -= 40 * dt; if (p.t > 1) PG.pops.splice(i, 1); } };
  PG.drawPops = function (c) { for (var i = 0; i < PG.pops.length; i++) { var p = PG.pops[i]; c.globalAlpha = Math.max(0, 1 - p.t); U.text(c, p.s, p.x, p.y, p.size * (1 + Math.min(p.t * 2, 0.3) * 0.5), p.color, 'center', { stroke: 'rgba(0,0,0,.4)' }); } c.globalAlpha = 1; };
  PG.shake = 0;
  PG.vibrate = function (ms) { try { if (navigator.vibrate && !PG.muted) navigator.vibrate(ms); } catch (e) { } };

  // permanent upgrade helper: PG.save.up = {id: level}
  PG.upLevel = function (id) { return (PG.save.up && PG.save.up[id]) || 0; };
  PG.upCost = function (base, growth, lvl) { return Math.round(base * Math.pow(growth, lvl)); };
  PG.buyUp = function (id, cost, max) {
    var lvl = PG.upLevel(id); if (lvl >= max || PG.save.coins < cost) { PG.sfx('err'); return false; }
    PG.save.coins -= cost; PG.save.up = PG.save.up || {}; PG.save.up[id] = lvl + 1; PG.commit(); PG.sfx('upgrade');
    PG.track('upgrade_purchased', { upgrade_id: id, level: lvl + 1 }); return true;
  };
  window.__pg_debug = PG; // debug hook for headless testing
})();
