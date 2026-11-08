// Boot order matters (guide: Loading and first session):
//   Bridge -> language + saved progress -> first scene -> FIRST FRAME DRAWN -> hide loading -> game_ready -> music.
import { CONFIG } from './config.js';
import { gate, initPlatform } from './platform.js';
import { setLang, t } from './i18n.js';
import { AudioBus } from './audio.js';
import { Input } from './input.js';
import { PerfSampler } from './perf.js';
import { Game } from './game.js';
import { applyWorld, createView } from './scale.js';

const $ = (id) => document.getElementById(id);
// SVG icons, never emoji in place of icons (req 4.3.2)
const SPEAKER = '<path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/>';
const ICON_ON = `<svg viewBox="0 0 24 24" width="1.3em" height="1.3em">${SPEAKER}<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
const ICON_OFF = `<svg viewBox="0 0 24 24" width="1.3em" height="1.3em">${SPEAKER}<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
const progress = (p) => { $('bar-fill').style.width = `${Math.round(p * 100)}%`; };

async function boot() {
  progress(0.1);
  const platform = await initPlatform();                          // 1. Bridge first
  setLang(platform.language);                                     // 2. language only from platform.language
  const saved = (await platform.load(['save'])).save || {};       // 3. one storage.get for all keys
  const save = { v: 1, best: 0, muted: false, ...saved };
  gate.silent('user', !!save.muted);
  progress(0.4);

  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const view = createView(canvas);
  const input = new Input(canvas);
  const audio = new AudioBus();
  const perf = new PerfSampler((n, d) => platform.track(n, d));
  const game = new Game();
  let state = 'menu';                                             // menu | play | over
  let revived = false;

  // ---- UI (DOM, so text scales, translates and is easy to hit on touch) --------------------------------
  const ui = $('ui');
  function build() {
    ui.innerHTML = `
      <div id="hud" hidden>
        <div class="stat"><span id="score"></span> &nbsp; <span id="lives"></span></div>
        <div class="btns"><button id="b-mute" class="ghost" aria-label="${t('sound')}"></button><button id="b-pause" class="ghost" aria-label="${t('paused')}">II</button></div>
      </div>
      <div class="screen" id="s-menu"><h1>${CONFIG.title}</h1><p>${t('tutorial')}</p><button id="b-play">${t('play')}</button><button id="b-mute2" class="ghost"></button></div>
      <div class="screen" id="s-pause" hidden><div class="panel"><h2>${t('paused')}</h2></div><button id="b-resume">${t('resume')}</button></div>
      <div class="screen" id="s-over" hidden><div class="panel"><h2>${t('over')}</h2><p>${t('score')}: <b id="o-score"></b> &nbsp; ${t('best')}: <b id="o-best"></b></p></div>
        <button id="b-revive" hidden>${t('revive')}</button><button id="b-again">${t('again')}</button></div>`;
    $('b-play').onclick = () => { audio.sfx('click'); start(); };
    $('b-again').onclick = () => { audio.sfx('click'); start(); };
    $('b-resume').onclick = () => setPaused(false);
    $('b-pause').onclick = () => setPaused(true);
    $('b-revive').onclick = revive;
    for (const id of ['b-mute', 'b-mute2']) $(id).onclick = toggleMute;
    refresh();
  }
  const show = (id, on) => { $(id).hidden = !on; };
  function refresh() {
    $('b-mute').innerHTML = $('b-mute2').innerHTML = save.muted ? ICON_OFF : ICON_ON;
    $('score').textContent = `${t('score')}: ${game.score}`;
    $('lives').textContent = `${t('lives')}: ${Math.max(0, game.lives)}`;
  }
  function screens() {
    show('s-menu', state === 'menu');
    show('s-over', state === 'over');
    show('s-pause', state === 'play' && gate.pausedWhy.has('menu'));
    show('hud', state === 'play');
  }
  function toggleMute() {
    save.muted = !save.muted;
    gate.silent('user', save.muted);
    platform.save('save', save);
    platform.track('settings_changed', { setting: 'muted', value: save.muted });
    refresh();
  }
  function setPaused(on) {
    gate.pause('menu', on);
    platform.msg(on ? 'level_paused' : 'level_resumed');
    screens();
  }

  // ---- lifecycle ------------------------------------------------------------------------------------------
  function start() {
    game.reset(); revived = false; state = 'play';
    gate.pause('menu', false);
    audio.play('music_game');
    platform.msg('level_started', { level: '1' });
    platform.track('level_started', { level: 1 });
    refresh(); screens();
  }
  async function end() {
    state = 'over';
    save.best = Math.max(save.best, game.score);
    platform.save('save', save);                                   // meaningful change: save once
    platform.msg('level_failed', { level: '1' });
    platform.track('level_failed', { level: 1, score: game.score });
    $('o-score').textContent = game.score; $('o-best').textContent = save.best;
    $('b-revive').hidden = !(platform.caps.rewarded && !revived); // hide what the platform lacks; revive once per attempt (2.2.4)
    audio.play('music_menu');
    screens();
    await platform.showInterstitial('game_over');                  // natural pause; Bridge decides if it really shows
  }
  async function revive() {
    if (revived || !(await platform.showRewarded('revive'))) return;   // reward only when watched to the end
    revived = true; game.lives = 1; game.dots = []; state = 'play';
    audio.play('music_game');
    refresh(); screens();
  }

  // ---- loop -------------------------------------------------------------------------------------------------
  let last = 0, resetClock = true;
  gate.onChange(() => { resetClock = true; screens(); });          // no giant dt after a pause / tab switch
  function frame(t0) {
    requestAnimationFrame(frame);
    const dtRaw = resetClock ? 0 : t0 - last;
    last = t0; resetClock = false;
    const active = state === 'play' && !gate.isPaused;
    if (active) {
      game.update(Math.min(dtRaw, 100) / 1000, view, input);
      for (const e of game.events.splice(0)) audio.sfx(e);
      if (game.over) end();
      refresh();
    }
    perf.frame(dtRaw, active);
    input.dpr = view.dpr;
    applyWorld(ctx, view);
    game.render(ctx, view);
    input.drawStick(ctx);
  }

  input.anyGesture = () => {                                       // browsers need a gesture before audio
    if (audio.unlocked) return;
    audio.unlock();
    audio.play(state === 'play' ? 'music_game' : 'music_menu');
  };
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' && state === 'play') setPaused(!gate.pausedWhy.has('menu'));
    if (e.code === 'Enter' && state !== 'play') start();
  });

  build();
  progress(0.7);
  await audio.load({ click: 'assets/audio/click', catch: 'assets/audio/catch', miss: 'assets/audio/miss', over: 'assets/audio/over' });
  progress(1);
  game.render(ctx, view);                                          // draw the first frame...
  requestAnimationFrame(frame);
  requestAnimationFrame(() => requestAnimationFrame(() => {        // ...make sure it is on screen...
    $('loading').hidden = true;                                    // ...then the loading screen is gone...
    platform.ready();                                              // ...and only now game_ready (required step 6).
    platform.track('tutorial_shown');
    audio.load({ music_menu: 'assets/audio/music_menu', music_game: 'assets/audio/music_game' })   // music after game_ready
      .then(() => { if (audio.unlocked) audio.play(state === 'play' ? 'music_game' : 'music_menu'); });
  }));

  // Debug hooks so a headless browser (or you) can drive and measure the game without guessing.
  window.__game = {
    get state() { return state; },
    start, setPaused, end: () => { game.lives = 0; },
    stats: () => ({ score: game.score, lives: game.lives, view: { ...view }, silent: gate.isSilent, paused: gate.isPaused }),
    perfFlush: () => perf.flush(),
  };
}

boot().catch((e) => {
  console.error(e);
  $('loading-title').textContent = 'Error';
});
