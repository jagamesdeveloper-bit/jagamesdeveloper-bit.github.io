/* Ember Stair - prototype
 * One-button climber: tap to jump, tap in the air to turn around once per jump.
 * Rising lava forces you up the tower. Playgama Bridge handles ads, storage, audio/pause state.
 */
(() => {
    'use strict';

    // ------------------------------------------------------------------ config
    const TITLE = 'Ember Stair';          // must match the title in the Playgama publication request (3.5.1)
    const HAS_AUDIO_FILES = false;        // TODO: set true once recorded audio exists in /audio (ogg/mp3, 3.3.2)
    const AUDIO_FILES = {
        music: 'audio/music.ogg',
        jump: 'audio/jump.ogg',
        turn: 'audio/turn.ogg',
        land: 'audio/land.ogg',
        crumble: 'audio/crumble.ogg',
        die: 'audio/die.ogg',
        click: 'audio/click.ogg',
    };

    const W = 360;                // tower width in world units
    const MIN_VIEW_H = 560;       // minimum visible world height
    const STEP = 1 / 60;
    const GRAVITY = 1500;
    const JUMP_V = 600;           // jump height = v^2 / 2g = 120 units
    const PLAYER_HALF_W = 11;
    const FOOT_HALF_W = 9;
    const PLAT_H = 14;
    const REVIVE_MIN_HEIGHT = 250; // no revive offer for very short runs

    const STR = {
        en: { tapStart: 'TAP TO START', best: 'BEST', gameOver: 'GAME OVER', newBest: 'NEW BEST!', retry: 'PLAY AGAIN', reviveTitle: 'The lava got you!', reviveBtn: 'Watch ad to continue', noThanks: 'No thanks', paused: 'PAUSED', resume: 'RESUME', hintJump: 'TAP to jump', hintTurn: 'TAP in the air to turn around' },
        ru: { tapStart: 'НАЖМИ, ЧТОБЫ НАЧАТЬ', best: 'РЕКОРД', gameOver: 'ИГРА ОКОНЧЕНА', newBest: 'НОВЫЙ РЕКОРД!', retry: 'ИГРАТЬ СНОВА', reviveTitle: 'Лава настигла вас!', reviveBtn: 'Смотреть рекламу и продолжить', noThanks: 'Нет, спасибо', paused: 'ПАУЗА', resume: 'ПРОДОЛЖИТЬ', hintJump: 'НАЖМИ — прыжок', hintTurn: 'НАЖМИ в воздухе — разворот' },
        es: { tapStart: 'TOCA PARA EMPEZAR', best: 'RÉCORD', gameOver: 'FIN DEL JUEGO', newBest: '¡NUEVO RÉCORD!', retry: 'JUGAR DE NUEVO', reviveTitle: '¡La lava te alcanzó!', reviveBtn: 'Ver anuncio y continuar', noThanks: 'No, gracias', paused: 'PAUSA', resume: 'CONTINUAR', hintJump: 'TOCA para saltar', hintTurn: 'TOCA en el aire para girar' },
        de: { tapStart: 'ZUM STARTEN TIPPEN', best: 'REKORD', gameOver: 'SPIEL VORBEI', newBest: 'NEUER REKORD!', retry: 'NOCHMAL SPIELEN', reviveTitle: 'Die Lava hat dich erwischt!', reviveBtn: 'Werbung ansehen und weitermachen', noThanks: 'Nein danke', paused: 'PAUSE', resume: 'WEITER', hintJump: 'TIPPEN zum Springen', hintTurn: 'In der Luft TIPPEN zum Umdrehen' },
        fr: { tapStart: 'TOUCHE POUR COMMENCER', best: 'RECORD', gameOver: 'PARTIE TERMINÉE', newBest: 'NOUVEAU RECORD !', retry: 'REJOUER', reviveTitle: "La lave t'a rattrapé !", reviveBtn: 'Regarder une pub pour continuer', noThanks: 'Non merci', paused: 'PAUSE', resume: 'REPRENDRE', hintJump: 'TOUCHE pour sauter', hintTurn: "TOUCHE en l'air pour faire demi-tour" },
        pt: { tapStart: 'TOQUE PARA COMEÇAR', best: 'RECORDE', gameOver: 'FIM DE JOGO', newBest: 'NOVO RECORDE!', retry: 'JOGAR NOVAMENTE', reviveTitle: 'A lava te pegou!', reviveBtn: 'Assistir anúncio e continuar', noThanks: 'Não, obrigado', paused: 'PAUSA', resume: 'CONTINUAR', hintJump: 'TOQUE para pular', hintTurn: 'TOQUE no ar para virar' },
        tr: { tapStart: 'BAŞLAMAK İÇİN DOKUN', best: 'REKOR', gameOver: 'OYUN BİTTİ', newBest: 'YENİ REKOR!', retry: 'TEKRAR OYNA', reviveTitle: 'Lav seni yakaladı!', reviveBtn: 'Reklam izle ve devam et', noThanks: 'Hayır, teşekkürler', paused: 'DURAKLATILDI', resume: 'DEVAM ET', hintJump: 'Zıplamak için DOKUN', hintTurn: 'Havada DOKUN: dön' },
    };

    const BIOMES = [
        { top: '#1b1226', bot: '#3a1f3d', brick: '#4a2a50', plat: '#8b6b5a', platTop: '#d2a374' },
        { top: '#0f2230', bot: '#1f4a5c', brick: '#2f6a80', plat: '#5f7f8a', platTop: '#a9d3de' },
        { top: '#2a1a10', bot: '#5a3418', brick: '#7a4a24', plat: '#9a7048', platTop: '#e0b070' },
        { top: '#14261a', bot: '#254a2c', brick: '#37703f', plat: '#6a8a5a', platTop: '#b5de90' },
        { top: '#2a1024', bot: '#5a1f4a', brick: '#82306a', plat: '#9a5a86', platTop: '#e6a0cf' },
    ];
    const BIOME_LEN = 600;

    // --------------------------------------------------------------- bridge shim
    // Real Bridge is loaded from playgama-bridge.js. This tiny shim only exists so the file can be opened without it.
    const memStore = {};
    const bridge = window.bridge || {
        EVENT_NAME: {},
        initialize: () => Promise.resolve(),
        platform: { language: 'en', isAudioEnabled: true, sendMessage() {}, on() {} },
        storage: {
            get: keys => Promise.resolve(keys.map(k => (k in memStore ? memStore[k] : null))),
            set: (keys, values) => { keys.forEach((k, i) => { memStore[k] = values[i]; }); return Promise.resolve(); },
        },
        advertisement: { isRewardedSupported: false, isInterstitialSupported: false, showRewarded() {}, showInterstitial() {}, on() {} },
        analytics: { send() {} },
    };

    function safe(fn) { try { return fn(); } catch (e) { return undefined; } }
    function sendMsg(name) { safe(() => bridge.platform.sendMessage(name)); }
    function track(name, data) { safe(() => bridge.analytics.send(name, data)); }

    // ------------------------------------------------------------------ globals
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    const S = { BOOT: 'boot', MENU: 'menu', PLAY: 'play', PAUSED: 'paused', REVIVE: 'revive', OVER: 'over' };
    let state = S.BOOT;

    let L = STR.en;
    let best = 0;
    let userMuted = false;
    let tutorialDone = false;
    let platformAudio = true;
    let platformPaused = false;
    let adOpen = false;
    let readySent = false;
    let booted = false;

    let cssW = 360, cssH = 640, dpr = 1, scale = 1, viewW = 360, viewH = MIN_VIEW_H, offX = 0;
    let uiTime = 0;
    let acc = 0;
    let lastTs = 0;

    let run = null;
    let player = null;
    let ui = { buttons: [] };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const rand = (a, b) => a + Math.random() * (b - a);

    // -------------------------------------------------------------------- audio
    const audio = {
        clips: {},
        musicWanted: false,
        init() {
            if (!HAS_AUDIO_FILES) return;
            Object.keys(AUDIO_FILES).forEach(name => {
                const a = new Audio(AUDIO_FILES[name]);
                a.preload = 'auto';
                if (name === 'music') { a.loop = true; a.volume = 0.45; } else { a.volume = 0.8; }
                this.clips[name] = a;
            });
        },
        on() { return platformAudio && !userMuted && !document.hidden && !adOpen; },
        play(name) {
            if (!HAS_AUDIO_FILES || !this.on()) return;
            const a = this.clips[name];
            if (!a) return;
            safe(() => { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); });
        },
        sync() {
            if (!HAS_AUDIO_FILES) return;
            const m = this.clips.music;
            if (!m) return;
            const want = this.on() && (state === S.PLAY || state === S.PAUSED || state === S.REVIVE || state === S.OVER || state === S.MENU);
            if (want && m.paused) { const p = m.play(); if (p && p.catch) p.catch(() => {}); }
            if (!want && !m.paused) m.pause();
        },
    };

    // ---------------------------------------------------------------- storage
    function persist(keys, values) {
        safe(() => bridge.storage.set(keys, values.map(String)).catch(() => {}));
    }

    async function loadSave() {
        const keys = ['ember_best', 'ember_muted', 'ember_tutorial'];
        try {
            const data = await bridge.storage.get(keys);
            const read = i => (Array.isArray(data) ? data[i] : data && data[keys[i]]);
            best = Number(read(0)) || 0;
            userMuted = String(read(1)) === 'true';
            tutorialDone = String(read(2)) === 'true';
        } catch (e) { /* no saved data: defaults */ }
    }

    // ---------------------------------------------------------------- run setup
    function makePlat(x, w, y, type) {
        return { x, w, y, type, cx: x + w / 2, baseCx: x + w / 2, amp: 0, phase: 0, dx: 0, crumbleT: -1, falling: false, vy: 0 };
    }

    function newRun() {
        const ground = makePlat(0, W, 0, 'ground');
        run = {
            plats: [ground],
            lastGen: ground,
            camY: -70,      // start a little below the ground line so the floor is visible
            lava: -170,
            t: 0,
            peak: 0,
            reviveUsed: false,
            revivePending: false,
            particles: [],
            shake: 0,
            overT: 0,
            newBest: false,
            jumps: 0,
            emberT: 0,
        };
        player = { x: W / 2, y: 0, vy: 0, dir: 1, grounded: true, plat: ground, airTurnUsed: false, leftGroundT: 0, buffer: 0, squash: 0 };
        genPlatforms();
    }

    function genPlatforms() {
        while (run.lastGen.y < run.camY + viewH + 320) {
            const prev = run.lastGen;
            const t = Math.min(1, prev.y / 3500);
            const gap = Math.min(102, lerp(64, 100, t) + rand(-5, 5));
            const w = lerp(140, 72, t) + rand(-12, 12);
            const prevC = prev.baseCx;
            const cx = clamp(prevC + rand(-140, 140), w / 2 + 10, W - w / 2 - 10);
            const y = prev.y + gap;
            let type = 'normal';
            const r = Math.random();
            if (y > 700 && r < 0.30) type = 'moving';
            else if (y > 300 && r < 0.20) type = 'crumble';
            const p = makePlat(cx - w / 2, w, y, type);
            if (type === 'moving') {
                p.amp = Math.max(0, Math.min(55, cx - w / 2 - 10, W - w / 2 - 10 - cx));
                p.phase = rand(0, Math.PI * 2);
            }
            run.plats.push(p);
            run.lastGen = p;
        }
    }

    // --------------------------------------------------------------- game flow
    function startRun() {
        newRun();
        state = S.PLAY;
        sendMsg('level_started');
        audio.play('click');
    }

    function pauseGame() {
        if (state !== S.PLAY) return;
        state = S.PAUSED;
        sendMsg('level_paused');
    }

    function resumeGame() {
        if (state !== S.PAUSED) return;
        state = S.PLAY;
        sendMsg('level_resumed');
    }

    function rewardedSupported() { return !!safe(() => bridge.advertisement.isRewardedSupported); }
    function interstitialSupported() { return !!safe(() => bridge.advertisement.isInterstitialSupported); }

    function die() {
        audio.play('die');
        run.shake = 0.35;
        if (!run.reviveUsed && run.peak >= REVIVE_MIN_HEIGHT && rewardedSupported()) {
            state = S.REVIVE;
            track('revive_offered', { height_m: Math.floor(run.peak / 10) });
        } else {
            finishRun();
        }
    }

    function finishRun() {
        state = S.OVER;
        run.overT = 0;
        run.revivePending = false;
        const meters = Math.floor(run.peak / 10);
        const keys = [];
        const values = [];
        if (meters > best) {
            best = meters;
            run.newBest = true;
            keys.push('ember_best');
            values.push(best);
        }
        if (!tutorialDone) {
            tutorialDone = true;
            keys.push('ember_tutorial');
            values.push(true);
            track('tutorial_completed');
        }
        if (keys.length) persist(keys, values);
        sendMsg('level_failed');
        track('run_ended', { height_m: meters, revived: run.reviveUsed, jumps: run.jumps });
        // Natural pause: Bridge decides whether an ad is actually shown (delay/interval), we never time it ourselves.
        if (interstitialSupported()) safe(() => bridge.advertisement.showInterstitial('game_over'));
    }

    function requestRevive() {
        if (state !== S.REVIVE || run.revivePending) return;
        run.revivePending = true;
        try {
            bridge.advertisement.showRewarded('revive');
        } catch (e) {
            finishRun();
        }
    }

    function declineRevive() {
        if (state !== S.REVIVE) return;
        run.reviveUsed = true; // the offer is made once per attempt
        finishRun();
    }

    function doRevive() {
        run.reviveUsed = true;
        run.revivePending = false;
        const target = run.camY + viewH * 0.4;
        let pick = null;
        let bd = Infinity;
        for (const p of run.plats) {
            if (p.falling || p.type === 'ground' && p.y < run.camY) continue;
            if (p.y < run.camY + 30 || p.y > run.camY + viewH - 120) continue;
            const d = Math.abs(p.y - target);
            if (d < bd) { bd = d; pick = p; }
        }
        if (!pick) {
            pick = makePlat(0, W, run.camY + viewH * 0.4, 'ground');
            run.plats.push(pick);
        }
        pick.crumbleT = -1;
        player.x = pick.x + pick.w / 2;
        player.y = pick.y;
        player.vy = 0;
        player.grounded = true;
        player.plat = pick;
        player.airTurnUsed = false;
        run.lava = run.camY - 100;
        state = S.PLAY;
        track('revive_taken', { height_m: Math.floor(run.peak / 10) });
    }

    // ------------------------------------------------------------------ update
    function spawnParticle(x, y, vx, vy, life, color, size) {
        if (run.particles.length > 140) return;
        run.particles.push({ x, y, vx, vy, life, max: life, color, size });
    }

    function overlaps(p) {
        return player.x + FOOT_HALF_W > p.x && player.x - FOOT_HALF_W < p.x + p.w;
    }

    function jumpOrTurn() {
        if (state !== S.PLAY) return;
        const canCoyote = !player.grounded && player.plat === null && (run.t - player.leftGroundT) < 0.09 && player.vy <= 0 && !player.jumped;
        if (player.grounded || canCoyote) {
            player.vy = JUMP_V;
            player.grounded = false;
            player.plat = null;
            player.airTurnUsed = false;
            player.jumped = true;
            player.squash = -0.25;
            run.jumps++;
            audio.play('jump');
            for (let i = 0; i < 5; i++) spawnParticle(player.x + rand(-6, 6), player.y, rand(-30, 30), rand(10, 50), 0.35, '#e8c9a0', 2);
        } else if (!player.airTurnUsed) {
            player.dir = -player.dir;
            player.airTurnUsed = true;
            audio.play('turn');
            for (let i = 0; i < 6; i++) spawnParticle(player.x, player.y + 12, -player.dir * rand(20, 80), rand(-20, 30), 0.3, '#ffd27a', 2);
        } else {
            player.buffer = 0.12;
        }
    }

    function land(p) {
        player.y = p.y;
        player.vy = 0;
        player.grounded = true;
        player.plat = p;
        player.airTurnUsed = false;
        player.jumped = false;
        player.squash = 0.3;
        if (p.type === 'crumble' && p.crumbleT < 0) p.crumbleT = 0.5;
        audio.play('land');
        for (let i = 0; i < 6; i++) spawnParticle(player.x + rand(-8, 8), p.y, rand(-50, 50), rand(10, 60), 0.4, '#d9c3a0', 2);
        if (player.buffer > 0) { player.buffer = 0; jumpOrTurn(); }
    }

    function update(dt) {
        run.t += dt;
        run.shake = Math.max(0, run.shake - dt);
        if (player.buffer > 0) player.buffer -= dt;
        player.squash *= Math.pow(0.001, dt);

        // lava rises faster the higher you are
        run.lava += Math.min(62, 16 + run.peak * 0.012) * dt;

        // platforms
        for (const p of run.plats) {
            p.dx = 0;
            if (p.falling) {
                p.vy -= GRAVITY * dt;
                p.y += p.vy * dt;
                continue;
            }
            if (p.type === 'moving') {
                const nx = p.baseCx + Math.sin(run.t * 1.4 + p.phase) * p.amp - p.w / 2;
                p.dx = nx - p.x;
                p.x = nx;
            }
            if (p.crumbleT >= 0) {
                p.crumbleT -= dt;
                if (p.crumbleT <= 0) { p.falling = true; p.vy = 0; audio.play('crumble'); }
            }
        }

        // horizontal movement
        const speed = Math.min(190, 120 + run.peak * 0.03);
        if (player.grounded && player.plat) player.x += player.plat.dx;
        player.x += player.dir * speed * dt;
        if (player.x < PLAYER_HALF_W) { player.x = PLAYER_HALF_W; player.dir = 1; }
        if (player.x > W - PLAYER_HALF_W) { player.x = W - PLAYER_HALF_W; player.dir = -1; }

        // lost the floor under our feet
        if (player.grounded) {
            const p = player.plat;
            if (!p || p.falling || !overlaps(p)) {
                player.grounded = false;
                player.plat = null;
                player.leftGroundT = run.t;
            }
        }

        // vertical
        if (!player.grounded) {
            const prevY = player.y;
            player.vy -= GRAVITY * dt;
            player.y += player.vy * dt;
            if (player.vy <= 0) {
                for (const p of run.plats) {
                    if (p.falling) continue;
                    if (prevY >= p.y - 0.01 && player.y <= p.y && overlaps(p)) { land(p); break; }
                }
            }
        }

        if (player.y > run.peak) run.peak = player.y;

        // camera only ever moves up
        const target = player.y - viewH * 0.4;
        if (target > run.camY) run.camY += (target - run.camY) * Math.min(1, dt * 8);

        genPlatforms();
        run.plats = run.plats.filter(p => p.y > run.camY - 160);

        // ember trail
        run.emberT -= dt;
        if (run.emberT <= 0) {
            run.emberT = 0.05;
            spawnParticle(player.x + rand(-5, 5), player.y + 14, rand(-10, 10), rand(20, 50), 0.5, Math.random() < 0.5 ? '#ff9d4a' : '#ffd27a', 2);
        }
        for (const q of run.particles) {
            q.life -= dt;
            q.x += q.vx * dt;
            q.y += q.vy * dt;
        }
        run.particles = run.particles.filter(q => q.life > 0);

        // death
        if (player.y < run.lava || player.y < run.camY - 30) die();
    }

    // ------------------------------------------------------------------- render
    function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
    function mix(a, b, t) {
        const A = hex(a), B = hex(b);
        return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')';
    }

    function biomeAt(height) {
        const i = Math.floor(height / BIOME_LEN);
        const f = (height % BIOME_LEN) / BIOME_LEN;
        const t = clamp((f - 0.8) / 0.2, 0, 1);
        const a = BIOMES[i % BIOMES.length];
        const b = BIOMES[(i + 1) % BIOMES.length];
        return {
            top: mix(a.top, b.top, t), bot: mix(a.bot, b.bot, t), brick: mix(a.brick, b.brick, t),
            plat: mix(a.plat, b.plat, t), platTop: mix(a.platTop, b.platTop, t),
        };
    }

    const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    function text(str, x, y, size, color, align, weight, maxW) {
        let s = size;
        ctx.font = (weight || '800') + ' ' + s + 'px ' + FONT;
        if (maxW) {
            const w = ctx.measureText(str).width;
            if (w > maxW) { s = Math.max(9, Math.floor(size * maxW / w)); ctx.font = (weight || '800') + ' ' + s + 'px ' + FONT; }
        }
        ctx.textAlign = align || 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color || '#fff';
        ctx.fillText(str, x, y);
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    const sx = x => x + offX;
    const sy = y => run.camY + viewH - y;

    function drawBackground(b) {
        const g = ctx.createLinearGradient(0, 0, 0, viewH);
        g.addColorStop(0, b.top);
        g.addColorStop(1, b.bot);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, viewW, viewH);

        // tower interior
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(offX, 0, W, viewH);
        ctx.strokeStyle = b.brick;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.5;
        const row = 40;
        const first = Math.floor(run.camY / row) * row;
        ctx.beginPath();
        for (let y = first; y < run.camY + viewH + row; y += row) {
            const py = sy(y);
            ctx.moveTo(offX, py);
            ctx.lineTo(offX + W, py);
            const odd = (Math.round(y / row) % 2) ? 0 : 36;
            for (let x = odd; x < W; x += 72) {
                ctx.moveTo(offX + x, py);
                ctx.lineTo(offX + x, py - row);
            }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        // walls
        ctx.fillStyle = b.brick;
        ctx.fillRect(offX - 8, 0, 8, viewH);
        ctx.fillRect(offX + W, 0, 8, viewH);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(offX - 8, 0, 3, viewH);
        ctx.fillRect(offX + W + 5, 0, 3, viewH);
    }

    function drawPlatforms(b) {
        for (const p of run.plats) {
            if (state === S.MENU && p.type !== 'ground') continue; // keep the title screen clean
            const x = sx(p.x);
            const y = sy(p.y);
            if (y < -40 || y > viewH + 60) continue;
            const wob = p.crumbleT >= 0 && !p.falling ? Math.sin(uiTime * 60) * 1.5 : 0;
            ctx.save();
            ctx.translate(wob, 0);
            if (p.type === 'ground') {
                ctx.fillStyle = b.plat;
                ctx.fillRect(x, y, p.w, viewH);
                ctx.fillStyle = b.platTop;
                ctx.fillRect(x, y, p.w, 5);
            } else {
                const body = p.type === 'crumble' ? '#7a5a4a' : p.type === 'moving' ? '#5a6f8a' : b.plat;
                const top = p.type === 'crumble' ? '#c9a07a' : p.type === 'moving' ? '#9fc3ea' : b.platTop;
                ctx.fillStyle = body;
                roundRect(x, y, p.w, PLAT_H, 4);
                ctx.fill();
                ctx.fillStyle = top;
                roundRect(x, y, p.w, 5, 3);
                ctx.fill();
                if (p.type === 'crumble') {
                    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(x + p.w * 0.3, y + 5); ctx.lineTo(x + p.w * 0.38, y + PLAT_H);
                    ctx.moveTo(x + p.w * 0.7, y + 5); ctx.lineTo(x + p.w * 0.62, y + PLAT_H);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
    }

    function drawLava() {
        const base = sy(run.lava);
        if (base > viewH + 40) return;
        const g = ctx.createLinearGradient(0, base - 30, 0, base + 160);
        g.addColorStop(0, 'rgba(255,170,60,0.0)');
        g.addColorStop(0.15, '#ffb23c');
        g.addColorStop(0.35, '#ff5a1f');
        g.addColorStop(1, '#8a1408');
        // glow above the surface
        const glow = ctx.createLinearGradient(0, base - 90, 0, base);
        glow.addColorStop(0, 'rgba(255,90,30,0)');
        glow.addColorStop(1, 'rgba(255,110,40,0.35)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, base - 90, viewW, 90);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, viewH + 10);
        ctx.lineTo(0, base);
        for (let x = 0; x <= viewW + 12; x += 12) {
            ctx.lineTo(x, base + Math.sin(x * 0.05 + uiTime * 3) * 4 + Math.sin(x * 0.13 - uiTime * 2) * 2);
        }
        ctx.lineTo(viewW, viewH + 10);
        ctx.closePath();
        ctx.fill();
    }

    function drawPlayer(px, py, dir, squash, idle) {
        const flick = Math.sin(uiTime * 18) * 2;
        const sq = squash || 0;
        const h = 30 * (1 + sq * 0.5);
        const w = 22 * (1 - sq * 0.4);
        ctx.save();
        ctx.translate(px, py);
        // flame tail
        ctx.fillStyle = '#ff6a1f';
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h * 0.35);
        ctx.quadraticCurveTo(-w * 0.55, -h * 0.95, flick * 0.5, -h - 6 - flick);
        ctx.quadraticCurveTo(w * 0.55, -h * 0.95, w / 2, -h * 0.35);
        ctx.closePath();
        ctx.fill();
        // body
        const g = ctx.createRadialGradient(0, -h * 0.4, 2, 0, -h * 0.35, w);
        g.addColorStop(0, '#fff2a8');
        g.addColorStop(0.6, '#ffb23c');
        g.addColorStop(1, '#ff6a1f');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, -h * 0.38, w / 2, h * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        // eyes
        ctx.fillStyle = '#2a1209';
        const ex = dir * 2.5;
        ctx.beginPath();
        ctx.arc(-4 + ex, -h * 0.45, 2.1, 0, Math.PI * 2);
        ctx.arc(4 + ex, -h * 0.45, 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawParticles() {
        for (const q of run.particles) {
            ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
            ctx.fillStyle = q.color;
            ctx.fillRect(sx(q.x) - q.size / 2, sy(q.y) - q.size / 2, q.size, q.size);
        }
        ctx.globalAlpha = 1;
    }

    // ----- UI -----
    function button(id, label, x, y, w, h, primary, onTap) {
        ui.buttons.push({ id, x, y, w, h, onTap });
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = primary ? '#ff8a2a' : 'rgba(255,255,255,0.14)';
        roundRect(x, y, w, h, 12);
        ctx.fill();
        ctx.restore();
        if (primary) {
            ctx.strokeStyle = '#ffd27a';
            ctx.lineWidth = 2;
            roundRect(x, y, w, h, 12);
            ctx.stroke();
        }
        text(label, x + w / 2, y + h / 2 + 1, 18, primary ? '#2a1209' : '#fff', 'center', '800', w - 24);
    }

    function iconButton(id, x, y, drawIcon, onTap) {
        const s = 44;
        ui.buttons.push({ id, x, y, w: s, h: s, onTap });
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        roundRect(x, y, s, s, 10);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        drawIcon(x + s / 2, y + s / 2);
    }

    function pauseIcon(cx, cy) { ctx.fillRect(cx - 7, cy - 8, 5, 16); ctx.fillRect(cx + 2, cy - 8, 5, 16); }

    function speakerIcon(muted) {
        return (cx, cy) => {
            ctx.beginPath();
            ctx.moveTo(cx - 9, cy - 4); ctx.lineTo(cx - 4, cy - 4); ctx.lineTo(cx + 2, cy - 9);
            ctx.lineTo(cx + 2, cy + 9); ctx.lineTo(cx - 4, cy + 4); ctx.lineTo(cx - 9, cy + 4);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            if (muted) {
                ctx.moveTo(cx + 6, cy - 5); ctx.lineTo(cx + 13, cy + 5);
                ctx.moveTo(cx + 13, cy - 5); ctx.lineTo(cx + 6, cy + 5);
            } else {
                ctx.arc(cx + 2, cy, 7, -0.9, 0.9);
                ctx.moveTo(cx + 2 + 11 * Math.cos(-0.9), cy + 11 * Math.sin(-0.9));
                ctx.arc(cx + 2, cy, 11, -0.9, 0.9);
            }
            ctx.stroke();
        };
    }

    function toggleMute() {
        userMuted = !userMuted;
        persist(['ember_muted'], [userMuted]);
        audio.sync();
    }

    function card(h) {
        const w = Math.min(310, viewW - 36);
        const x = (viewW - w) / 2;
        const y = (viewH - h) / 2;
        ctx.fillStyle = 'rgba(8,4,14,0.62)';
        ctx.fillRect(0, 0, viewW, viewH);
        ctx.fillStyle = '#241530';
        roundRect(x, y, w, h, 18);
        ctx.fill();
        ctx.strokeStyle = '#ff8a2a';
        ctx.lineWidth = 2;
        roundRect(x, y, w, h, 18);
        ctx.stroke();
        return { x, y, w, h };
    }

    function drawHUD() {
        const scrim = ctx.createLinearGradient(0, 0, 0, 100);
        scrim.addColorStop(0, 'rgba(8,4,14,0.7)');
        scrim.addColorStop(1, 'rgba(8,4,14,0)');
        ctx.fillStyle = scrim;
        ctx.fillRect(0, 0, viewW, 100);
        const meters = Math.floor(run.peak / 10);
        text(meters + ' m', viewW / 2, 40, 34, '#fff', 'center', '900');
        text(L.best + ' ' + best + ' m', viewW / 2, 66, 14, 'rgba(255,255,255,0.7)', 'center', '700');
        if (state === S.PLAY || state === S.PAUSED) iconButton('pause', 12, 12, pauseIcon, pauseGame);
        // tutorial hints (short, shown only until the first run is over)
        if (!tutorialDone && state === S.PLAY) {
            const hint = player.grounded ? L.hintJump : (!player.airTurnUsed ? L.hintTurn : null);
            if (hint && run.peak < 400) text(hint, viewW / 2, viewH * 0.22, 20, '#ffd27a', 'center', '800', viewW - 40);
        }
        // lava danger tint
        const gap = player.y - run.lava;
        if (gap < 220) {
            const a = (1 - gap / 220) * 0.35;
            const g = ctx.createLinearGradient(0, viewH * 0.6, 0, viewH);
            g.addColorStop(0, 'rgba(255,40,10,0)');
            g.addColorStop(1, 'rgba(255,40,10,' + a.toFixed(3) + ')');
            ctx.fillStyle = g;
            ctx.fillRect(0, viewH * 0.6, viewW, viewH * 0.4);
        }
    }

    function drawMenuOverlay() {
        const blink = 0.55 + 0.45 * Math.sin(uiTime * 4);
        ctx.shadowColor = '#ff8a2a';
        ctx.shadowBlur = 24;
        text(TITLE.toUpperCase(), viewW / 2, viewH * 0.28, 40, '#ffd27a', 'center', '900', viewW - 36);
        ctx.shadowBlur = 0;
        text(L.best + ': ' + best + ' m', viewW / 2, viewH * 0.28 + 44, 18, 'rgba(255,255,255,0.85)', 'center', '700');
        ctx.globalAlpha = blink;
        text(L.tapStart, viewW / 2, viewH * 0.62, 22, '#fff', 'center', '800', viewW - 36);
        ctx.globalAlpha = 1;
    }

    function drawPaused() {
        const c = card(190);
        text(L.paused, c.x + c.w / 2, c.y + 56, 30, '#fff', 'center', '900');
        button('resume', L.resume, c.x + 24, c.y + 100, c.w - 48, 52, true, resumeGame);
    }

    function drawRevive() {
        const c = card(300);
        text(L.reviveTitle, c.x + c.w / 2, c.y + 50, 24, '#fff', 'center', '900', c.w - 30);
        text(Math.floor(run.peak / 10) + ' m', c.x + c.w / 2, c.y + 100, 40, '#ffd27a', 'center', '900');
        button('revive', L.reviveBtn, c.x + 20, c.y + 150, c.w - 40, 58, true, requestRevive);
        button('decline', L.noThanks, c.x + 20, c.y + 222, c.w - 40, 48, false, declineRevive);
    }

    function drawOver() {
        const c = card(300);
        text(L.gameOver, c.x + c.w / 2, c.y + 48, 28, '#fff', 'center', '900', c.w - 30);
        text(Math.floor(run.peak / 10) + ' m', c.x + c.w / 2, c.y + 110, 56, '#ffd27a', 'center', '900');
        if (run.newBest) text(L.newBest, c.x + c.w / 2, c.y + 160, 20, '#7dffa8', 'center', '900');
        else text(L.best + ': ' + best + ' m', c.x + c.w / 2, c.y + 160, 18, 'rgba(255,255,255,0.75)', 'center', '700');
        button('retry', L.retry, c.x + 20, c.y + 200, c.w - 40, 60, true, () => { if (run.overT > 0.4) startRun(); });
    }

    function render() {
        ui.buttons = [];
        if (!run) newRun();
        const peakForBiome = state === S.MENU || state === S.BOOT ? 0 : run.peak;
        const b = biomeAt(peakForBiome);

        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
        ctx.save();
        if (run.shake > 0) ctx.translate(rand(-4, 4) * run.shake * 3, rand(-4, 4) * run.shake * 3);
        drawBackground(b);
        drawPlatforms(b);
        drawLava();
        drawParticles();
        if (state !== S.BOOT) drawPlayer(sx(player.x), sy(player.y), player.dir, player.squash);
        ctx.restore();

        if (state === S.MENU) drawMenuOverlay();
        if (state === S.PLAY || state === S.PAUSED || state === S.REVIVE || state === S.OVER) drawHUD();
        if (state === S.PAUSED) drawPaused();
        if (state === S.REVIVE) drawRevive();
        if (state === S.OVER) drawOver();
        if (state !== S.BOOT) iconButton('mute', viewW - 56, 12, speakerIcon(userMuted), toggleMute);
    }

    // -------------------------------------------------------------------- input
    function pressAt(clientX, clientY) {
        const px = clientX / scale;
        const py = clientY / scale;
        for (let i = ui.buttons.length - 1; i >= 0; i--) {
            const b = ui.buttons[i];
            if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) { b.onTap(); return; }
        }
        action();
    }

    function action() {
        if (state === S.MENU) startRun();
        else if (state === S.PLAY) jumpOrTurn();
        else if (state === S.OVER && run.overT > 0.4) startRun();
    }

    canvas.addEventListener('pointerdown', e => {
        e.preventDefault();
        pressAt(e.clientX, e.clientY);
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
        if (e.repeat) return;
        const k = e.code;
        if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW' || k === 'Enter') {
            e.preventDefault();
            if (state === S.PAUSED) resumeGame(); else action();
        } else if (k === 'KeyP') {
            if (state === S.PLAY) pauseGame(); else if (state === S.PAUSED) resumeGame();
        } else if (k === 'KeyM') {
            toggleMute();
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && state === S.PLAY) pauseGame();
        audio.sync();
    });

    // ------------------------------------------------------------------- layout
    function resize() {
        cssW = window.innerWidth || 360;
        cssH = window.innerHeight || 640;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        scale = Math.min(cssW / W, cssH / MIN_VIEW_H);
        viewW = cssW / scale;
        viewH = cssH / scale;
        offX = (viewW - W) / 2;
    }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);

    // --------------------------------------------------------------- main loop
    function frame(ts) {
        const dtReal = Math.min(0.1, Math.max(0, (ts - lastTs) / 1000));
        lastTs = ts;
        uiTime += dtReal;
        const frozen = platformPaused || adOpen || document.hidden;

        if (state === S.PLAY && !frozen) {
            acc += dtReal;
            while (acc >= STEP) {
                update(STEP);
                acc -= STEP;
                if (state !== S.PLAY) { acc = 0; break; }
            }
        } else {
            acc = 0;
        }
        if (state === S.OVER && run) run.overT += dtReal;

        render();
        audio.sync();

        if (booted && !readySent) {
            readySent = true;
            sendMsg('game_ready'); // first interactive frame is on screen
        }
        requestAnimationFrame(frame);
    }

    // --------------------------------------------------------------------- boot
    function wireBridgeEvents() {
        const E = bridge.EVENT_NAME || {};
        safe(() => bridge.platform.on(E.AUDIO_STATE_CHANGED, enabled => { platformAudio = !!enabled; audio.sync(); }));
        safe(() => bridge.platform.on(E.PAUSE_STATE_CHANGED, paused => { platformPaused = !!paused; }));
        safe(() => bridge.advertisement.on(E.INTERSTITIAL_STATE_CHANGED, st => {
            if (st === 'opened') adOpen = true;
            else if (st === 'closed' || st === 'failed') adOpen = false;
        }));
        safe(() => bridge.advertisement.on(E.REWARDED_STATE_CHANGED, st => {
            if (st === 'opened') {
                adOpen = true;
            } else if (st === 'rewarded') {
                // Reward only here, never on 'closed'.
                if (state === S.REVIVE && run.revivePending) doRevive();
            } else if (st === 'closed' || st === 'failed') {
                adOpen = false;
                // Ad cancelled or failed: no reward, the game simply moves on.
                if (state === S.REVIVE && run.revivePending) { run.reviveUsed = true; finishRun(); }
            }
        }));
    }

    async function boot() {
        resize();
        audio.init();
        try { await bridge.initialize(); } catch (e) { /* mock platform is used */ }

        const lang = String(safe(() => bridge.platform.language) || 'en').slice(0, 2).toLowerCase();
        L = STR[lang] || STR.en;
        document.documentElement.lang = STR[lang] ? lang : 'en';
        platformAudio = safe(() => bridge.platform.isAudioEnabled) !== false;
        if (safe(() => bridge.advertisement.interstitialState) === 'opened') adOpen = true;
        wireBridgeEvents();

        await loadSave();
        newRun();
        state = S.MENU;
        booted = true;
    }

    requestAnimationFrame(ts => { lastTs = ts; frame(ts); });
    boot();
})();
