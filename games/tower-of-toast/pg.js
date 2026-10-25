/* PG - shared Playgama platform layer + small canvas toolkit.
   Bridge (init, storage, ads, pause/audio, analytics), input, themed UI, sample audio + music,
   transitions, textures, particles. Each game supplies PG.theme for its own look. */
(function () {
  'use strict';
  var PG = (window.PG = {});
  var ASSETS = window.PG_ASSETS || { sfx: {}, music: null, fonts: [] };
  var B = null; // bridge instance (or null)
  var errCount = 0, rejCount = 0;
  window.addEventListener('error', function () { errCount++; });
  window.addEventListener('unhandledrejection', function () { rejCount++; });

  /* ---------------- state ---------------- */
  PG.version = '1.0.0';
  PG.id = 'game';
  PG.save = {};
  PG.defaults = {};
  PG.paused = false;       // host pause (ad, platform)
  PG.userPaused = false;   // player pause
  PG.muted = false;        // player mute (everything)
  PG.musicOff = false;     // player music toggle
  PG.sfxOff = false;       // player sound-effects toggle
  PG.platAudio = true;     // platform audio flag
  PG.playing = false;      // set true by the game during active gameplay
  PG.w = 800; PG.h = 600; PG.dpr = 1;
  PG.lang = 'en';
  PG.time = 0;
  PG.font = 'system-ui';   // display family (theme)
  PG.bodyFont = 'system-ui';
  var FALLBACK = ',"Trebuchet MS","Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif';

  /* ---------------- theme ---------------- */
  // Games replace parts of this before PG.init. Drawing callbacks receive (c, ...) and the state flags.
  PG.theme = {
    font: null, body: null, weight: '800', bodyWeight: '700',
    text: '#fff', textShadow: 'rgba(0,0,0,.35)',
    button: null, panel: null, hudButton: null, pauseScreen: null,
    transition: { style: 'fade', color: '#000', time: 0.32 },
    musicVolume: 0.42
  };

  /* ---------------- bridge ---------------- */
  function bridgeCall(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }

  PG.init = function (opts) {
    PG.id = opts.id; PG.version = opts.version || '1.0.0';
    PG.defaults = opts.defaults || {};
    PG.save = JSON.parse(JSON.stringify(PG.defaults));
    if (PG.theme.font) PG.font = PG.theme.font;
    PG.bodyFont = PG.theme.body || PG.font;
    var fontsReady = loadFonts();
    initAudio();
    var bridgeReady = new Promise(function (resolve) {
      var hasBridge = typeof window.bridge !== 'undefined' && window.bridge;
      if (!hasBridge) { loadLocal(); resolve(); return; }
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
      }).catch(function () { B = null; loadLocal(); }).then(resolve);
    });
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return; done = true;
        PG.muted = !!PG.save.muted; PG.musicOff = !!PG.save.musicOff; PG.sfxOff = !!PG.save.sfxOff;
        PG._inited = true; PG._applyAudio(); resolve();
      }
      setTimeout(finish, 5000);
      Promise.all([bridgeReady, fontsReady]).then(finish, finish);
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

  function loadFonts() {
    if (!ASSETS.fonts || !ASSETS.fonts.length || !window.FontFace || !document.fonts) return Promise.resolve();
    var all = ASSETS.fonts.map(function (f) {
      try { var ff = new FontFace(f.family, 'url(' + f.file + ')', { weight: f.weight || '400' }); document.fonts.add(ff); return ff.load().catch(function () { }); }
      catch (e) { return Promise.resolve(); }
    });
    return Promise.race([Promise.all(all), new Promise(function (r) { setTimeout(r, 3000); })]);
  }

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
    var r = function (x) { return Math.round(x * 10) / 10; };
    PG.track('performance_sample', {
      target_fps: perf.target, window_ms: Math.round(performance.now() - perf.wall0), active_ms: Math.round(perf.active), frame_count: d.length,
      fps_avg: r(1000 / (sum / d.length)), fps_p10: r(1000 / q(0.90)), frame_time_p50_ms: r(q(0.5)), frame_time_p95_ms: r(q(0.95)), frame_time_p99_ms: r(q(0.99)), frame_time_max_ms: r(s[s.length - 1]),
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
    st.textContent = 'html,body{margin:0;height:100%;overflow:hidden;background:' + (PG.theme.pageColor || '#000') + ';-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;touch-action:none;overscroll-behavior:none}canvas{display:block;position:absolute;left:50%;top:0;transform:translateX(-50%);touch-action:none;outline:none}';
    document.head.appendChild(st);
    window.addEventListener('resize', resize); window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
    resize();
    bindInput();
    document.addEventListener('visibilitychange', function () { PG._applyAudio(); lastT = 0; });
    window.addEventListener('blur', function () { PG._applyAudio(); });
    window.addEventListener('focus', function () { PG._applyAudio(); });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    requestAnimationFrame(frame);
  };
  function resize() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var w = Math.min(vw, vh * 2); // never wider than 2:1
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    if (!PG._inited) { ctx.setTransform(PG.dpr, 0, 0, PG.dpr, 0, 0); drawLoading(ctx, t / 1000); return; }
    if (!halt) {
      PG.time += dt;
      if (!PG.userPaused) userUpdate(dt);
      PG._perfFrame(dtms);
      updateTransition(dt);
      updateCounts(dt);
    }
    ctx.setTransform(PG.dpr, 0, 0, PG.dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    userRender(ctx, PG.w, PG.h, dt);
    ctx.setTransform(PG.dpr, 0, 0, PG.dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    PG.hud(ctx);
    drawTransition(ctx);
    I.pressed = false; I.released = false; I.keysPressed = {};
    if (!started && PG._inited) { started = true; PG.ready(); }
  }

  function drawLoading(c, t) {
    var w = PG.w, h = PG.h; c.fillStyle = PG.theme.pageColor || '#000'; c.fillRect(0, 0, w, h);
    if (PG.theme.loading) { PG.theme.loading(c, w, h, t); return; }
    c.strokeStyle = PG.theme.loadingColor || 'rgba(255,255,255,.7)'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.arc(w / 2, h / 2, 16, t * 5, t * 5 + 4.2); c.stroke();
  }

  /* ---------------- input ---------------- */
  var I = (PG.input = { x: -1, y: -1, down: false, pressed: false, released: false, px: 0, py: 0, keys: {}, keysPressed: {} });
  function pos(e) { var r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * (PG.w / r.width), (e.clientY - r.top) * (PG.h / r.height)]; }
  function blocked() { return trans.t > 0 && trans.phase === 0; }
  function bindInput() {
    var el = canvas;
    el.addEventListener('pointerdown', function (e) {
      var p = pos(e); I.x = p[0]; I.y = p[1]; I.px = p[0]; I.py = p[1]; I.down = true; I.pressed = true; I.pid = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (_) { } PG.audioUnlock(); e.preventDefault();
      if (PG.onDown && !blocked() && !PG.inHud(I.x, I.y) && !PG.userPaused) PG.onDown(I.x, I.y);
    });
    el.addEventListener('pointermove', function (e) {
      var p = pos(e); I.x = p[0]; I.y = p[1];
      if (PG.onMove && !PG.userPaused) PG.onMove(I.x, I.y);
    });
    function up(e) {
      var p = pos(e); I.x = p[0]; I.y = p[1];
      if (I.down) { I.released = true; I.down = false; if (PG.onUp && !blocked() && !PG.inHud(I.px, I.py) && !PG.userPaused) PG.onUp(I.x, I.y); }
    }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    window.addEventListener('keydown', function (e) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) e.preventDefault();
      var k = e.key.toLowerCase(); if (!I.keys[k]) I.keysPressed[k] = true; I.keys[k] = true; PG.audioUnlock();
      if ((k === 'escape' || k === 'p') && PG.playing) togglePause();
      if (k === 'm') PG.setMuted(!PG.muted);
    });
    window.addEventListener('keyup', function (e) { I.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', function () { I.keys = {}; I.down = false; });
  }
  PG.key = function (k) { return !PG.userPaused && !!I.keys[k]; };
  PG.keyHit = function (k) { return !PG.userPaused && !blocked() && !!I.keysPressed[k]; };
  PG.inRect = function (x, y, w, h, px, py) { px = px === undefined ? I.x : px; py = py === undefined ? I.y : py; return px >= x && px <= x + w && py >= y && py <= y + h; };

  /* ---------------- UI toolkit ---------------- */
  var U = (PG.ui = {});
  PG.scale = function () { return Math.max(0.55, Math.min(PG.w / 420, PG.h / 620, 2.2)); }; // generic UI unit
  U.rr = function (c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  U.fontStr = function (size, o) {
    o = o || {}; var body = o.font === 'body';
    var fam = body ? PG.bodyFont : PG.font, wt = o.weight || (body ? PG.theme.bodyWeight : PG.theme.weight);
    return wt + ' ' + Math.max(1, size) + 'px "' + fam + '"' + FALLBACK;
  };
  U.text = function (c, s, x, y, size, color, align, o) {
    o = o || {}; c.font = U.fontStr(size, o); c.textAlign = align || 'center'; c.textBaseline = o.base || 'middle';
    if (o.spacing !== undefined && 'letterSpacing' in c) c.letterSpacing = o.spacing + 'px';
    var sh = o.shadow === undefined ? PG.theme.textShadow : o.shadow;
    if (sh) { c.fillStyle = o.shadowColor || sh; c.fillText(s, x + size * (o.sx === undefined ? 0.04 : o.sx), y + size * (o.sy === undefined ? 0.07 : o.sy)); }
    if (o.stroke) { c.lineWidth = o.strokeWidth || size * 0.16; c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.miterLimit = 2; c.strokeText(s, x, y); }
    c.fillStyle = color || PG.theme.text; c.fillText(s, x, y);
    if (o.spacing !== undefined && 'letterSpacing' in c) c.letterSpacing = '0px';
  };
  U.measure = function (c, s, size, o) { c.font = U.fontStr(size, o); return c.measureText(s).width; };
  U.fit = function (c, s, size, maxW, o) { var w = U.measure(c, s, size, o); return w > maxW ? size * maxW / w : size; };
  // click detection shared by every button-like element
  var inPauseUI = false;
  U.hit = function (x, y, w, h) {
    if (PG.userPaused && PG.playing && !inPauseUI) return false;
    if (I.released && !blocked() && PG.inRect(x, y, w, h) && PG.inRect(x, y, w, h, I.px, I.py)) { I.released = false; PG.sfx('tap'); return true; }
    return false;
  };
  U.state = function (x, y, w, h) { var hover = PG.inRect(x, y, w, h) && !PG.touch; return { hover: hover, press: I.down && PG.inRect(x, y, w, h) && PG.inRect(x, y, w, h, I.px, I.py) }; };
  // immediate-mode button: theme draws it, returns true when clicked
  U.button = function (c, x, y, w, h, label, o) {
    o = o || {}; var s = U.state(x, y, w, h); s.disabled = !!o.disabled;
    c.save(); (PG.theme.button || defaultButton)(c, x, y, w, h, label, o, s); c.restore();
    if (!o.disabled && U.hit(x, y, w, h)) return true;
    return false;
  };
  function defaultButton(c, x, y, w, h, label, o, s) {
    var col = o.disabled ? '#8a8f98' : (o.color || '#ffb703'), off = s.press ? 2 : 0;
    U.rr(c, x, y + 4, w, h, h * 0.3); c.fillStyle = shade(col, -0.3); c.fill();
    U.rr(c, x, y + off, w, h, h * 0.3); c.fillStyle = col; c.fill();
    U.text(c, label, x + w / 2, y + off + h / 2, o.size || Math.min(h * 0.44, 28), '#fff', 'center');
  }
  U.panel = function (c, x, y, w, h, o) { c.save(); (PG.theme.panel || defaultPanel)(c, x, y, w, h, o || {}); c.restore(); };
  function defaultPanel(c, x, y, w, h, o) { U.rr(c, x, y, w, h, 18); c.fillStyle = o.fill || 'rgba(20,24,40,.9)'; c.fill(); }
  function shade(hex, p) {
    if (hex[0] !== '#') return hex; var n = parseInt(hex.length === 4 ? hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (v) { return Math.max(0, Math.min(255, Math.round(v + (p < 0 ? v * p : (255 - v) * p)))); };
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  U.shade = shade;
  U.coin = function (c, x, y, r, col) {
    col = col || ['#c98a06', '#ffd23f', '#e8a800'];
    c.save(); c.beginPath(); c.arc(x, y + r * 0.1, r, 0, 6.2832); c.fillStyle = col[0]; c.fill();
    c.beginPath(); c.arc(x, y - r * 0.05, r * 0.9, 0, 6.2832); c.fillStyle = col[1]; c.fill();
    c.beginPath(); c.arc(x, y - r * 0.05, r * 0.56, 0, 6.2832); c.strokeStyle = col[2]; c.lineWidth = r * 0.15; c.stroke(); c.restore();
  };

  /* ---------------- HUD: sound + pause, pause screen ---------------- */
  PG.hudHidePause = false;
  PG.hudRect = function () { var s = PG.scale(), r = 17 * s, pad = 10 * s; return { x: PG.w - pad - r * 2 - (PG.playing && !PG.hudHidePause ? r * 2.4 : 0), y: pad - 4, w: r * 2 + (PG.playing && !PG.hudHidePause ? r * 2.4 : 0) + pad + 4, h: r * 2 + 8, r: r, pad: pad }; };
  PG.inHud = function (x, y) { var h = PG.hudRect(); return x >= h.x - 6 && y <= h.y + h.h + 6 && y >= 0; };
  function defaultHudButton(c, x, y, r, kind, on) {
    c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fillStyle = 'rgba(15,18,30,.55)'; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.4)'; c.stroke();
    PG.hudIcon(c, x, y, r, kind, '#fff');
  }
  PG.hudIcon = function (c, x, y, r, kind, col, lw) {
    c.fillStyle = col; c.strokeStyle = col; c.lineWidth = lw || Math.max(1.6, r * 0.12); c.lineCap = 'round'; c.lineJoin = 'round';
    if (kind === 'sound' || kind === 'mute') {
      c.beginPath(); c.moveTo(x - r * 0.5, y - r * 0.2); c.lineTo(x - r * 0.2, y - r * 0.2); c.lineTo(x + r * 0.12, y - r * 0.5); c.lineTo(x + r * 0.12, y + r * 0.5); c.lineTo(x - r * 0.2, y + r * 0.2); c.lineTo(x - r * 0.5, y + r * 0.2); c.closePath(); c.fill();
      if (kind === 'mute') { c.beginPath(); c.moveTo(x + r * 0.3, y - r * 0.28); c.lineTo(x + r * 0.68, y + r * 0.28); c.moveTo(x + r * 0.68, y - r * 0.28); c.lineTo(x + r * 0.3, y + r * 0.28); c.stroke(); }
      else { c.beginPath(); c.arc(x + r * 0.08, y, r * 0.4, -0.85, 0.85); c.stroke(); c.beginPath(); c.arc(x + r * 0.08, y, r * 0.68, -0.8, 0.8); c.stroke(); }
    } else if (kind === 'pause') { var bw = r * 0.26; U.rr(c, x - r * 0.4, y - r * 0.42, bw, r * 0.84, bw * 0.3); c.fill(); U.rr(c, x + r * 0.14, y - r * 0.42, bw, r * 0.84, bw * 0.3); c.fill(); }
    else if (kind === 'play') { c.beginPath(); c.moveTo(x - r * 0.25, y - r * 0.45); c.lineTo(x + r * 0.5, y); c.lineTo(x - r * 0.25, y + r * 0.45); c.closePath(); c.fill(); }
    else if (kind === 'music' || kind === 'nomusic') {
      c.beginPath(); c.ellipse(x - r * 0.28, y + r * 0.32, r * 0.2, r * 0.15, -0.4, 0, 6.2832); c.fill(); c.beginPath(); c.ellipse(x + r * 0.32, y + r * 0.2, r * 0.2, r * 0.15, -0.4, 0, 6.2832); c.fill();
      c.beginPath(); c.moveTo(x - r * 0.1, y + r * 0.3); c.lineTo(x - r * 0.1, y - r * 0.45); c.lineTo(x + r * 0.5, y - r * 0.58); c.lineTo(x + r * 0.5, y + r * 0.18); c.stroke();
      if (kind === 'nomusic') { c.beginPath(); c.moveTo(x - r * 0.6, y - r * 0.6); c.lineTo(x + r * 0.6, y + r * 0.6); c.stroke(); }
    }
  };
  function togglePause() { if (!PG.playing) return; PG.userPaused = !PG.userPaused; PG.msg(PG.userPaused ? 'level_paused' : 'level_resumed'); PG._applyAudio(); }
  PG.togglePause = togglePause;
  PG.hud = function (c) {
    var H = PG.hudRect(), r = H.r, cx = PG.w - H.pad - r, cy = H.pad + r, draw = PG.theme.hudButton || defaultHudButton;
    function ib(x, y, kind, on) {
      var hit = Math.hypot(I.x - x, I.y - y) < r + 6 && Math.hypot(I.px - x, I.py - y) < r + 6, press = I.down && hit;
      c.save(); if (press) { c.translate(x, y); c.scale(0.92, 0.92); c.translate(-x, -y); } draw(c, x, y, r, kind, on); c.restore();
      if (I.released && hit && !blocked()) { I.released = false; return true; } return false;
    }
    if (PG.userPaused && PG.playing) drawPause(c);
    if (ib(cx, cy, PG.muted ? 'mute' : 'sound', !PG.muted)) { PG.setMuted(!PG.muted); PG.sfx('tap'); }
    if (PG.playing && !PG.hudHidePause) { if (ib(cx - r * 2.4, cy, PG.userPaused ? 'play' : 'pause', true)) { togglePause(); PG.sfx('tap'); } }
  };
  function drawPause(c) {
    inPauseUI = true; try { drawPauseInner(c); } finally { inPauseUI = false; }
  }
  function drawPauseInner(c) {
    var w = PG.w, h = PG.h, s = PG.scale();
    if (PG.theme.pauseScreen) { var res = PG.theme.pauseScreen(c, w, h, s); if (res) handlePause(res); return; }
    c.save(); c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.8, 300 * s), ph = 250 * s, px = w / 2 - pw / 2, py = h / 2 - ph / 2;
    U.panel(c, px, py, pw, ph, {});
    U.text(c, 'Paused', w / 2, py + 40 * s, 34 * s, PG.theme.text, 'center');
    var bw = pw * 0.8, bh = 48 * s, bx = w / 2 - bw / 2;
    var res = null;
    if (U.button(c, bx, py + 76 * s, bw, bh, 'Resume', { primary: true })) res = 'resume';
    if (U.button(c, bx, py + 76 * s + bh + 10 * s, bw / 2 - 5 * s, bh, PG.musicOff ? 'Music off' : 'Music on', { small: true })) res = 'music';
    if (U.button(c, bx + bw / 2 + 5 * s, py + 76 * s + bh + 10 * s, bw / 2 - 5 * s, bh, PG.sfxOff ? 'Sound off' : 'Sound on', { small: true })) res = 'sfx';
    c.restore(); if (res) handlePause(res);
  }
  function handlePause(res) {
    if (res === 'resume') togglePause();
    else if (res === 'music') { PG.musicOff = !PG.musicOff; PG.save.musicOff = PG.musicOff; PG.commit(); PG._applyAudio(); }
    else if (res === 'sfx') { PG.sfxOff = !PG.sfxOff; PG.save.sfxOff = PG.sfxOff; PG.commit(); }
  }
  PG.setMuted = function (m) { PG.muted = m; PG.save.muted = m; PG.commit(); PG._applyAudio(); };

  /* ---------------- transitions ---------------- */
  var trans = { t: 0, phase: 0, cb: null, style: 'fade', dur: 0.3 };
  // PG.go(fn): cover the screen, run fn at full cover, then reveal
  PG.go = function (fn) {
    if (trans.t > 0) { if (fn) fn(); return; }
    var T = PG.theme.transition || {}; trans.style = T.style || 'fade'; trans.dur = T.time || 0.3; trans.color = T.color || '#000';
    trans.t = 0.0001; trans.phase = 0; trans.cb = fn; PG.sfx('whoosh');
  };
  function updateTransition(dt) {
    if (trans.t <= 0) return; trans.t += dt / trans.dur;
    if (trans.phase === 0 && trans.t >= 1) { trans.phase = 1; trans.t = 1; var f = trans.cb; trans.cb = null; if (f) f(); }
    else if (trans.phase === 1) { trans.t -= 2 * dt / trans.dur; if (trans.t <= 0) { trans.t = 0; trans.phase = 0; } }
  }
  function drawTransition(c) {
    if (trans.t <= 0) return; var k = PG.ease.io(Math.min(1, trans.t)), w = PG.w, h = PG.h;
    c.save(); c.fillStyle = trans.color;
    if (PG.theme.transition && PG.theme.transition.draw) PG.theme.transition.draw(c, w, h, k, trans.phase);
    else if (trans.style === 'iris') { var R = Math.hypot(w, h) * 0.6 * (1 - k); c.beginPath(); c.rect(0, 0, w, h); c.arc(w / 2, h / 2, Math.max(0, R), 0, 6.2832, true); c.fill('evenodd'); }
    else if (trans.style === 'curtain') { var cw = w / 2 * k; c.fillRect(0, 0, cw, h); c.fillRect(w - cw, 0, cw, h); }
    else if (trans.style === 'wipe') { c.beginPath(); var e = (w + h) * k; c.moveTo(0, 0); c.lineTo(e, 0); c.lineTo(e - h, h); c.lineTo(0, h); c.closePath(); c.fill(); }
    else if (trans.style === 'pixel') { var n = 12, cs = Math.ceil(Math.max(w, h) / n); for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) { var th = ((i * 7 + j * 13) % n) / n; if (k > th) c.fillRect(i * cs, j * cs, cs + 1, cs + 1); } }
    else if (trans.style === 'bands') { var nb = 6; for (var b = 0; b < nb; b++) { var kk = PG.clamp(k * 1.6 - b * 0.12, 0, 1); c.fillRect(b * w / nb, 0, w / nb + 1, h * kk); } }
    else { c.globalAlpha = k; c.fillRect(0, 0, w, h); }
    c.restore();
  }
  PG.transitioning = function () { return trans.t > 0; };

  /* ---------------- audio: samples + music (Kenney / OpenGameArt CC0), synth fallback ---------------- */
  var AC = null, master = null, sfxGain = null, musicGain = null, buffers = {}, musicEl = null, musicNode = null, musicWanted = false, synthCfg = null, synthTimer = 0, synthStep = 0;
  function initAudio() {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; return; }
    master = AC.createGain(); master.connect(AC.destination);
    sfxGain = AC.createGain(); sfxGain.connect(master);
    musicGain = AC.createGain(); musicGain.gain.value = PG.theme.musicVolume; musicGain.connect(master);
    Object.keys(ASSETS.sfx || {}).forEach(function (name) {
      buffers[name] = { list: [], vol: ASSETS.sfx[name].vol || 1, last: -1 };
      ASSETS.sfx[name].files.forEach(function (f) {
        fetch(f).then(function (r) { if (!r.ok) throw new Error('x'); return r.arrayBuffer(); }).then(function (ab) {
          return new Promise(function (res, rej) { AC.decodeAudioData(ab, res, rej); });
        }).then(function (buf) { buffers[name].list.push(buf); }).catch(function () { });
      });
    });
  }
  PG.audioUnlock = function () {
    if (!AC) return;
    if (AC.state === 'suspended' && audible()) AC.resume();
    if (!PG._unlocked) { PG._unlocked = true; try { var b = AC.createBuffer(1, 1, 22050), s = AC.createBufferSource(); s.buffer = b; s.connect(AC.destination); s.start(0); } catch (e) { } }
    PG._applyAudio();
  };
  function audible() { return !PG.muted && PG.platAudio && !PG.paused && !document.hidden; }
  PG._applyAudio = function () {
    if (!AC) return;
    var on = audible();
    master.gain.value = on ? 0.9 : 0;
    if (!on && AC.state === 'running') { AC.suspend(); }
    else if (on && AC.state === 'suspended' && PG._unlocked) { AC.resume(); }
    var playMusic = on && musicWanted && !PG.musicOff && PG._unlocked;
    if (musicEl) { if (playMusic && musicEl.paused) { var p = musicEl.play(); if (p && p.catch) p.catch(function () { }); } else if (!playMusic && !musicEl.paused) musicEl.pause(); }
  };
  function tone(f, t0, dur, type, vol, slide, dest) {
    var o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfxGain); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, vol, hp, lp) {
    var n = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var s = AC.createBufferSource(); s.buffer = buf; var g = AC.createGain(); g.gain.value = vol; var f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
    var last = f; if (lp) { var f2 = AC.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; f.connect(f2); last = f2; }
    s.connect(f); last.connect(g); g.connect(sfxGain); s.start(t0);
  }
  var lastSfx = {};
  PG.sfx = function (name, pitch, vol) {
    if (!AC || PG.muted || PG.sfxOff || !PG.platAudio || PG.paused || AC.state !== 'running') return;
    var now = AC.currentTime; if (lastSfx[name] && now - lastSfx[name] < 0.03) return; lastSfx[name] = now;
    var p = pitch || 1, b = buffers[name];
    if (b && b.list.length) {
      var i = Math.floor(Math.random() * b.list.length); if (b.list.length > 1 && i === b.last) i = (i + 1) % b.list.length; b.last = i;
      var src = AC.createBufferSource(), g = AC.createGain(); src.buffer = b.list[i]; src.playbackRate.value = p * (0.96 + Math.random() * 0.08);
      g.gain.value = b.vol * (vol === undefined ? 1 : vol); src.connect(g); g.connect(sfxGain); src.start(now); return;
    }
    synth(name, p, now);
  };
  function synth(name, p, now) {
    switch (name) {
      case 'tap': tone(520 * p, now, 0.06, 'triangle', 0.12, 1.3); break;
      case 'coin': tone(988 * p, now, 0.07, 'square', 0.06); tone(1319 * p, now + 0.06, 0.14, 'square', 0.06); break;
      case 'pop': noise(now, 0.06, 0.4, 900, 4000); tone(420 * p, now, 0.08, 'sine', 0.22, 2); break;
      case 'merge': tone(330 * p, now, 0.1, 'triangle', 0.2, 1.5); tone(495 * p, now + 0.07, 0.16, 'triangle', 0.18, 1.2); break;
      case 'hit': noise(now, 0.1, 0.3, 400, 3000); tone(140 * p, now, 0.1, 'square', 0.1, 0.5); break;
      case 'boom': noise(now, 0.45, 0.5, 60, 1200); tone(80 * p, now, 0.35, 'sine', 0.35, 0.4); break;
      case 'splash': noise(now, 0.35, 0.35, 300, 2500); noise(now + 0.05, 0.25, 0.2, 1500); break;
      case 'shoot': tone(700 * p, now, 0.08, 'sawtooth', 0.07, 0.4); break;
      case 'jump': tone(300 * p, now, 0.15, 'sine', 0.25, 2.4); break;
      case 'land': noise(now, 0.07, 0.25, 200, 1500); break;
      case 'win': case 'golden': case 'ace': [523, 659, 784, 1047].forEach(function (f, i) { tone(f * p, now + i * 0.09, 0.22, 'triangle', 0.2); }); break;
      case 'lose': [392, 330, 262, 196].forEach(function (f, i) { tone(f * p, now + i * 0.13, 0.28, 'triangle', 0.16); }); break;
      case 'whoosh': noise(now, 0.2, 0.14, 900, 3500); break;
      case 'drop': tone(220 * p, now, 0.12, 'sine', 0.25, 0.5); break;
      case 'perfect': tone(880 * p, now, 0.1, 'triangle', 0.2); tone(1320 * p, now + 0.08, 0.2, 'triangle', 0.2); break;
      case 'upgrade': [440, 554, 659, 880].forEach(function (f, i) { tone(f * p, now + i * 0.06, 0.16, 'triangle', 0.12); }); break;
      case 'err': tone(160, now, 0.16, 'square', 0.08); break;
      case 'ghost': tone(300 * p, now, 0.5, 'sine', 0.15, 0.5); tone(306 * p, now, 0.5, 'sine', 0.15, 0.5); break;
      case 'bell': tone(1568 * p, now, 0.45, 'sine', 0.15); tone(2093 * p, now, 0.3, 'sine', 0.08); break;
      default: tone(440 * p, now, 0.06, 'sine', 0.12);
    }
  }
  // Background music: the game's CC0 track if it ships one, otherwise a soft generative loop.
  PG.music = function (cfg) {
    if (!AC) return; musicWanted = true;
    if (ASSETS.music) {
      if (!musicEl) {
        musicEl = new Audio(ASSETS.music); musicEl.loop = true; musicEl.preload = 'auto'; musicEl.crossOrigin = 'anonymous';
        try { musicNode = AC.createMediaElementSource(musicEl); musicNode.connect(musicGain); } catch (e) { musicEl.volume = PG.theme.musicVolume; }
      }
      PG._applyAudio(); return;
    }
    synthCfg = cfg; clearInterval(synthTimer); if (!cfg) return; var stepMs = 60000 / cfg.bpm / 2;
    synthTimer = setInterval(function () {
      if (!AC || PG.muted || PG.musicOff || !PG.platAudio || PG.paused || document.hidden || AC.state !== 'running') return;
      var now = AC.currentTime, sc = cfg.scale, i = synthStep++;
      var deg = [0, 2, 4, 2, 5, 4, 2, 1, 0, 3, 5, 3, 6, 5, 3, 2][i % 16] + (Math.floor(i / 16) % 2 ? 1 : 0);
      var oct = Math.floor(deg / sc.length), f = cfg.root * Math.pow(2, (sc[deg % sc.length] + 12 * oct) / 12);
      if (i % 2 === 0 || Math.random() < 0.45) tone(f * 2, now, 0.45, cfg.wave || 'triangle', (cfg.vol || 0.07), 1, musicGain);
    }, stepMs);
  };
  PG.musicDuck = function (amount, time) { if (!musicGain || !AC) return; var g = musicGain.gain, now = AC.currentTime, v = PG.theme.musicVolume; g.cancelScheduledValues(now); g.setValueAtTime(v * amount, now); g.linearRampToValueAtTime(v, now + (time || 1.2)); };

  /* ---------------- textures ---------------- */
  var texCache = {};
  // grain: tileable noise canvas; mono grey speckles with given contrast
  PG.texture = function (key, w, h, painter) {
    if (texCache[key]) return texCache[key];
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h; var c = cv.getContext('2d'); painter(c, w, h); texCache[key] = cv; return cv;
  };
  PG.grain = function (c, w, h, alpha, opts) {
    opts = opts || {};
    var tx = PG.texture('grain' + (opts.size || 160), opts.size || 160, opts.size || 160, function (c, W, H) {
      var id = c.createImageData(W, H), d = id.data, r = PG.mulberry(77);
      for (var i = 0; i < d.length; i += 4) { var v = r() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      c.putImageData(id, 0, 0);
    });
    var pat = c.createPattern(tx, 'repeat');
    c.save(); c.globalAlpha = alpha; c.globalCompositeOperation = opts.mode || 'overlay';
    var ox = opts.animate ? Math.floor(PG.time * 24) * 37 % 160 : 0, oy = opts.animate ? Math.floor(PG.time * 24) * 53 % 160 : 0;
    c.translate(-ox, -oy); c.fillStyle = pat; c.fillRect(ox, oy, w, h); c.restore();
  };
  PG.vignette = function (c, w, h, alpha, col) {
    var g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col || 'rgba(0,0,0,' + alpha + ')'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  };

  /* ---------------- math / helpers ---------------- */
  PG.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  PG.lerp = function (a, b, t) { return a + (b - a) * t; };
  PG.rand = function (a, b) { return a + Math.random() * (b - a); };
  PG.ri = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  PG.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  PG.ease = { out: function (t) { return 1 - Math.pow(1 - t, 3); }, io: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }, back: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }, elastic: function (t) { return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * 2.0944) + 1; } };
  PG.mulberry = function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  PG.hash = function (n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  PG.fmt = function (n) { n = Math.floor(n); if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T'; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K'; return String(n); };
  // animated counters: PG.count('score', target) returns a smoothly rising display value
  var counts = {};
  PG.count = function (key, target) { var c = counts[key]; if (!c || target < c.v) { c = counts[key] = { v: target, t: target }; } c.t = target; return c.v; };
  function updateCounts(dt) { for (var k in counts) { var c = counts[k]; if (c.v < c.t) c.v = Math.min(c.t, c.v + Math.max(1, (c.t - c.v) * Math.min(1, dt * 9))); } }
  // generic particle system (shape: c circle, s square, or a function(c,p,k))
  PG.parts = [];
  PG.burst = function (x, y, n, o) {
    o = o || {};
    for (var i = 0; i < n; i++) { var a = o.angle !== undefined ? o.angle + PG.rand(-(o.spread || 3.2), o.spread || 3.2) / 2 : Math.random() * 6.2832, s = PG.rand(o.min || 40, o.max || 220); PG.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), life: PG.rand((o.life || 0.9) * 0.5, o.life || 0.9), t: 0, size: PG.rand(o.s0 || 3, o.s1 || 7), color: o.colors ? PG.pick(o.colors) : '#fff', g: o.g === undefined ? 300 : o.g, shape: o.shape || 'c', rot: Math.random() * 6.28, vr: PG.rand(-8, 8), drag: o.drag || 0 }); }
  };
  PG.updateParts = function (dt) { for (var i = PG.parts.length - 1; i >= 0; i--) { var p = PG.parts[i]; p.t += dt; if (p.t >= p.life) { PG.parts.splice(i, 1); continue; } p.vy += p.g * dt; if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; } p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; } };
  PG.drawParts = function (c) {
    for (var i = 0; i < PG.parts.length; i++) {
      var p = PG.parts[i], k = 1 - p.t / p.life, s = p.size * (0.4 + 0.6 * k); c.globalAlpha = Math.max(0, Math.min(1, k * 1.6)); c.fillStyle = p.color;
      if (typeof p.shape === 'function') p.shape(c, p, k);
      else if (p.shape === 's') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-s, -s * 0.6, s * 2, s * 1.2); c.restore(); }
      else { c.beginPath(); c.arc(p.x, p.y, s, 0, 6.2832); c.fill(); }
    }
    c.globalAlpha = 1;
  };
  // floating text popups (styled by the theme)
  PG.pops = [];
  PG.popText = function (x, y, s, color, size, o) { PG.pops.push({ x: x, y: y, s: s, color: color || PG.theme.text, t: 0, size: size || 22, o: o || {} }); };
  PG.updatePops = function (dt) { for (var i = PG.pops.length - 1; i >= 0; i--) { var p = PG.pops[i]; p.t += dt; p.y -= 34 * dt * (1 - p.t); if (p.t > 1.1) PG.pops.splice(i, 1); } };
  PG.drawPops = function (c) {
    for (var i = 0; i < PG.pops.length; i++) {
      var p = PG.pops[i], a = p.t < 0.8 ? 1 : 1 - (p.t - 0.8) / 0.3, sc = p.t < 0.12 ? PG.ease.back(p.t / 0.12) : 1; c.globalAlpha = Math.max(0, a);
      var st = PG.theme.popStyle || { stroke: 'rgba(0,0,0,.45)' };
      U.text(c, p.s, p.x, p.y, p.size * sc, p.color, 'center', { stroke: p.o.stroke || st.stroke, strokeWidth: p.size * 0.16, shadow: false });
    }
    c.globalAlpha = 1;
  };
  PG.vibrate = function (ms) { try { if (navigator.vibrate && !PG.muted) navigator.vibrate(ms); } catch (e) { } };

  // permanent upgrade helper: PG.save.up = {id: level}
  PG.upLevel = function (id) { return (PG.save.up && PG.save.up[id]) || 0; };
  PG.upCost = function (base, growth, lvl) { return Math.round(base * Math.pow(growth, lvl)); };
  PG.buyUp = function (id, cost, max) {
    var lvl = PG.upLevel(id); if (lvl >= max || (PG.save.coins || 0) < cost) { PG.sfx('err'); return false; }
    PG.save.coins -= cost; PG.save.up = PG.save.up || {}; PG.save.up[id] = lvl + 1; PG.commit(); PG.sfx('upgrade');
    PG.track('upgrade_purchased', { upgrade_id: id, level: lvl + 1 }); return true;
  };
  window.__pg_debug = PG; // debug hook for headless testing
})();
