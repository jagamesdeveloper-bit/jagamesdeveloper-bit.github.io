// Single seam between the game and the hosting platform.
// The Playgama SDK is NOT wired in yet: its init flow, ad calls and storage API
// must be taken from the Playgama developer console docs before filling these in.
// Until then every method falls back to plain browser behaviour.
const SAVE_KEY = 'lane-clash-save-v1';

export const Platform = {
  async init() {
    // TODO(playgama): initialise the platform SDK here.
  },
  gameReady() {
    // TODO(playgama): tell the platform the game finished loading.
  },
  language() {
    return (navigator.language || 'en').slice(0, 2).toLowerCase();
  },
  save(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage blocked */ }
  },
  load() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
  },
  // Resolve true when an ad was shown. Called between matches only.
  async showInterstitial() { return false; },
  async showRewarded() { return false; },
  // cb(true) when the tab loses focus, cb(false) when it returns.
  onFocusChange(cb) {
    document.addEventListener('visibilitychange', () => cb(document.hidden));
    window.addEventListener('blur', () => cb(true));
  },
};

const STRINGS = {
  en: {
    title: 'LANE CLASH', play: 'PLAY', again: 'PLAY AGAIN', victory: 'VICTORY!', defeat: 'DEFEAT',
    draw: 'DRAW', paused: 'PAUSED', resume: 'Tap to resume', overtime: 'OVERTIME',
    sudden: 'SUDDEN DEATH', next: 'NEXT', sfxOn: 'SFX ON', sfxOff: 'SFX OFF',
    hint: 'Drag a card onto your half of the arena',
  },
};
export const t = (key) => {
  const table = STRINGS[Platform.language()] || STRINGS.en;
  return table[key] ?? STRINGS.en[key] ?? key;
};
