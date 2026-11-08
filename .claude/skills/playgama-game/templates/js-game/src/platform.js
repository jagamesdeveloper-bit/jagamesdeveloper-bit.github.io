// The ONLY file that talks to Playgama Bridge. Game code imports `gate` and the object from initPlatform().
// Covers the SDK "Required steps": init first, language, storage-only saves, pause + audio state,
// game_ready, interstitials. Works without Bridge (local dev) with in-memory storage and no ads.

/** Why the game is silent / paused. Audible only when no reason holds (guides: Sound, "one volume controller"). */
class Gate {
  constructor() {
    this.silentWhy = new Set();
    this.pausedWhy = new Set();
    this.subs = new Set();
  }
  silent(why, on) { this._flip(this.silentWhy, why, on); }   // player mute, platform audio off
  pause(why, on) { this._flip(this.pausedWhy, why, on); }    // game's own pause menu
  both(why, on) { this.silent(why, on); this.pause(why, on); } // ad open, page hidden, platform pause
  get isSilent() { return this.silentWhy.size > 0; }
  get isPaused() { return this.pausedWhy.size > 0; }
  onChange(fn) { this.subs.add(fn); }
  _flip(set, why, on) {
    if (on === set.has(why)) return;
    if (on) set.add(why); else set.delete(why);
    this.subs.forEach((fn) => fn(this));
  }
}
export const gate = new Gate();

const safe = (fn) => { try { return fn(); } catch (e) { console.warn(e); } };

export async function initPlatform() {
  const b = window.bridge;
  if (!b) return localFallback();

  await b.initialize();                                           // required step 2: before anything else

  // --- audio + pause (required step 5) -----------------------------------------------------------
  gate.silent('platform', b.platform.isAudioEnabled === false);    // initial state, events only fire on change
  b.platform.on(b.EVENT_NAME.AUDIO_STATE_CHANGED, (enabled) => gate.silent('platform', !enabled));
  b.platform.on(b.EVENT_NAME.PAUSE_STATE_CHANGED, (paused) => gate.both('platform', !!paused));
  document.addEventListener('visibilitychange', () => gate.both('hidden', document.hidden));
  gate.both('hidden', document.hidden);

  // --- ads: pause + mute while a full-screen ad is open (req 2.1.6) --------------------------------
  const adWaiters = new Set();
  const adEvent = (kind) => (state) => {
    if (state === 'opened') gate.both('ad', true);
    else if (state === 'closed' || state === 'failed') gate.both('ad', false);
    else if (state === 'rewarded') setTimeout(() => gate.both('ad', false), 1500);   // safety net if 'closed' never comes
    adWaiters.forEach((fn) => fn(kind, state));
  };
  b.advertisement.on(b.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, adEvent('i'));
  b.advertisement.on(b.EVENT_NAME.REWARDED_STATE_CHANGED, adEvent('r'));
  if (b.advertisement.interstitialState === 'opened' || b.advertisement.rewardedState === 'opened') gate.both('ad', true);

  // --- storage (required step 4): batched writes, never localStorage/PlayerPrefs ---------------------
  let pending = {};
  let timer = 0;
  const flush = () => {
    clearTimeout(timer);
    timer = 0;
    const keys = Object.keys(pending);
    if (!keys.length) return Promise.resolve();
    const values = keys.map((k) => JSON.stringify(pending[k]));
    pending = {};
    return b.storage.set(keys, values).catch((e) => console.warn('save failed', e));
  };
  gate.onChange((g) => { if (g.isPaused) flush(); });             // persist when the player leaves

  return {
    id: b.platform.id,
    language: String(b.platform.language || 'en').slice(0, 2).toLowerCase(),   // required step 3
    caps: {
      interstitial: !!b.advertisement.isInterstitialSupported,
      rewarded: !!b.advertisement.isRewardedSupported,
      externalLinks: !!b.platform.isExternalLinksAllowed,
    },

    /** One call for all keys at startup. Missing keys come back as null: always keep defaults in the game. */
    async load(keys) {
      const raw = await b.storage.get(keys).catch(() => []);
      const out = {};
      keys.forEach((k, i) => {
        const v = Array.isArray(raw) ? raw[i] : raw && raw[k];
        out[k] = v == null ? null : safe(() => JSON.parse(v));
      });
      return out;
    },
    /** Call on meaningful change only (level done, setting changed). Writes are debounced into one call. */
    save(key, value) {
      pending[key] = value;
      if (!timer) timer = setTimeout(flush, 400);
    },
    flush,

    msg: (name, data) => safe(() => b.platform.sendMessage(name, data)),
    ready: () => safe(() => b.platform.sendMessage('game_ready')),   // required step 6
    track: (name, data) => safe(() => b.analytics.send(name, data)),

    /** Call at every natural pause. Bridge decides if an ad really shows. Resolves when the game may go on. */
    showInterstitial(placement) {
      if (!b.advertisement.isInterstitialSupported) return Promise.resolve();
      return new Promise((resolve) => {
        let opened = false;
        const done = () => { adWaiters.delete(onAd); clearTimeout(t); resolve(); };
        const onAd = (kind, state) => {
          if (kind !== 'i') return;
          if (state === 'opened') { opened = true; clearTimeout(t); }
          else if (state === 'failed' || (opened && state === 'closed')) done();
        };
        const t = setTimeout(done, 3000);                           // Bridge skipped it (too early / no fill)
        adWaiters.add(onAd);
        safe(() => b.advertisement.showInterstitial(placement));
      });
    },
    /** Resolves true ONLY when the ad was watched to the end (req 2.2.5). */
    showRewarded(placement) {
      if (!b.advertisement.isRewardedSupported) return Promise.resolve(false);
      return new Promise((resolve) => {
        let opened = false;
        const done = (ok) => { adWaiters.delete(onAd); clearTimeout(t); resolve(ok); };
        const onAd = (kind, state) => {
          if (kind !== 'r') return;
          if (state === 'opened') { opened = true; clearTimeout(t); }
          else if (state === 'rewarded') done(true);
          else if (state === 'failed' || (opened && state === 'closed')) done(false);
        };
        const t = setTimeout(() => done(false), 5000);
        adWaiters.add(onAd);
        safe(() => b.advertisement.showRewarded(placement));
      });
    },
  };
}

function localFallback() {
  console.warn('[platform] Bridge not found - local fallback (memory storage, no ads)');
  const mem = {};
  document.addEventListener('visibilitychange', () => gate.both('hidden', document.hidden));
  return {
    id: 'local',
    language: String(navigator.language || 'en').slice(0, 2).toLowerCase(),
    caps: { interstitial: false, rewarded: false, externalLinks: false },
    load: async (keys) => Object.fromEntries(keys.map((k) => [k, mem[k] ?? null])),
    save: (k, v) => { mem[k] = v; },
    flush: () => Promise.resolve(),
    msg() {}, ready() {}, track() {},
    showInterstitial: () => Promise.resolve(),
    showRewarded: () => Promise.resolve(false),
  };
}
