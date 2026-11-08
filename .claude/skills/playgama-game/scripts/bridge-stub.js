// Minimal in-page stand-in for playgama-bridge.js, used by qa-matrix.js (and handy for local debugging).
// It logs every call into window.__bridgeLog so a headless run can assert the required steps happened in order.
// It is NOT the real SDK: always also run the build in the QA Tool (get_local_game_qa_tool_link / archive QA link).
(function () {
  const log = (window.__bridgeLog = []);
  const t0 = performance.now();
  const rec = (...a) => log.push([Math.round(performance.now() - t0), ...a]);
  const emitter = () => {
    const h = {};
    return { on(e, f) { (h[e] = h[e] || []).push(f); }, emit(e, v) { (h[e] || []).forEach((f) => f(v)); } };
  };
  const EVENT_NAME = {
    AUDIO_STATE_CHANGED: 'audio_state_changed',
    PAUSE_STATE_CHANGED: 'pause_state_changed',
    INTERSTITIAL_STATE_CHANGED: 'interstitial_state_changed',
    REWARDED_STATE_CHANGED: 'rewarded_state_changed',
  };
  const platform = Object.assign(emitter(), {
    id: 'mock',
    language: window.__BRIDGE_LANG || 'en',
    isAudioEnabled: window.__BRIDGE_AUDIO !== false,
    isExternalLinksAllowed: false,
    payload: null,
    sendMessage(m, d) { rec('sendMessage', m, d); },
  });
  const mem = {};
  const storage = {
    get(keys) { rec('storage.get', keys); return Promise.resolve(keys.map((k) => (k in mem ? mem[k] : null))); },
    set(keys, vals) { rec('storage.set', keys); keys.forEach((k, i) => { mem[k] = vals[i]; }); return Promise.resolve(); },
    delete(keys) { keys.forEach((k) => delete mem[k]); return Promise.resolve(); },
  };
  const adv = Object.assign(emitter(), {
    isInterstitialSupported: true,
    isRewardedSupported: true,
    interstitialState: 'closed',
    rewardedState: 'closed',
    showInterstitial(p) {
      rec('showInterstitial', p);
      const set = (s) => { adv.interstitialState = s; adv.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, s); };
      setTimeout(() => set('opened'), 50);
      setTimeout(() => set('closed'), 450);
    },
    showRewarded(p) {
      rec('showRewarded', p);
      const set = (s) => { adv.rewardedState = s; adv.emit(EVENT_NAME.REWARDED_STATE_CHANGED, s); };
      setTimeout(() => set('opened'), 50);
      setTimeout(() => set('rewarded'), 350);
      setTimeout(() => set('closed'), 450);
    },
  });
  window.bridge = {
    EVENT_NAME,
    initialize() { rec('initialize'); return Promise.resolve(); },
    platform, storage, advertisement: adv,
    analytics: { send(n, d) { rec('analytics.send', n, d); } },
  };
})();
