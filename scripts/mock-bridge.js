// Minimal Playgama Bridge mock for headless testing
(function () {
  var listeners = {}; var store = {}; var log = (window.__bridgeLog = []);
  function emitter(ns) { return { on: function (e, f) { (listeners[ns + e] = listeners[ns + e] || []).push(f); }, off: function (e, f) { listeners[ns + e] = (listeners[ns + e] || []).filter(function (x) { return x !== f; }); } }; }
  function emit(ns, e, v) { (listeners[ns + e] || []).slice().forEach(function (f) { f(v); }); }
  var adv = Object.assign(emitter('adv'), { isInterstitialSupported: true, isRewardedSupported: true,
    showInterstitial: function (p) { log.push('interstitial:' + p); setTimeout(function () { emit('adv', 'INT', 'opened'); setTimeout(function () { emit('adv', 'INT', 'closed'); }, 200); }, 50); },
    showRewarded: function (p) { log.push('rewarded:' + p); setTimeout(function () { emit('adv', 'REW', 'opened'); setTimeout(function () { emit('adv', 'REW', 'rewarded'); emit('adv', 'REW', 'closed'); }, 200); }, 50); } });
  window.bridge = { EVENT_NAME: { AUDIO_STATE_CHANGED: 'AUD', PAUSE_STATE_CHANGED: 'PAU', INTERSTITIAL_STATE_CHANGED: 'INT', REWARDED_STATE_CHANGED: 'REW' },
    initialize: function () { log.push('init'); return Promise.resolve(); },
    platform: Object.assign(emitter('plat'), { language: 'en', isAudioEnabled: true, sendMessage: function (m) { log.push('msg:' + m); return Promise.resolve(); } }),
    storage: { get: function (k) { log.push('get:' + k.join(',')); return Promise.resolve(k.map(function (x) { return store[x] === undefined ? null : store[x]; })); }, set: function (k, v) { log.push('set:' + k.join(',')); k.forEach(function (x, i) { store[x] = v[i]; }); return Promise.resolve(); } },
    advertisement: adv, analytics: { send: function (n, d) { log.push('an:' + n); } } };
  adv.on = function (e, f) { (listeners['adv' + e] = listeners['adv' + e] || []).push(f); };
  window.__bridgeEmit = emit; window.__bridgeStore = store;
})();
