import { CARDS, CARD_IDS, TOWER, TOWER_POS, MATCH, COLS, ROWS, RIVER, BRIDGES } from './data.js';
import { Pool, Events, mulberry32, shuffle, clamp } from './util.js';

const hyp = Math.hypot;
let NEXT_ID = 1;

// Pure game simulation: no DOM, no rendering. Side 0 = player (bottom), side 1 = enemy (top).
export class Match {
  constructor(seed = 1) {
    this.events = new Events();
    this.unitPool = new Pool();
    this.projPool = new Pool();
    this.units = [];
    this.projectiles = [];
    this.reset(seed);
  }

  reset(seed = this.seed + 1) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    for (const u of this.units) this.unitPool.release(u);
    for (const p of this.projectiles) this.projPool.release(p);
    this.units = [];
    this.projectiles = [];
    this.spells = [];
    this.fx = [];
    this.towers = [];
    this.state = 'regular';
    this.time = MATCH.regular;
    this.clock = 0;
    this.elixir = [MATCH.elixirStart, MATCH.elixirStart];
    this.crowns = [0, 0];
    this.winner = null;
    this.decks = [this._makeDeck(), this._makeDeck()];
    for (const side of [0, 1]) {
      this.towers.push(this._tower(side, 'princess', 0), this._tower(side, 'princess', 1), this._tower(side, 'king', 0));
    }
  }

  // ---------- setup ----------
  _makeDeck() {
    const order = shuffle(CARD_IDS, this.rng);
    return { hand: order.slice(0, 4), queue: order.slice(4) };
  }

  _tower(side, type, lane) {
    const pos = type === 'king' ? TOWER_POS.king : TOWER_POS.princess[lane];
    const def = TOWER[type];
    return {
      id: NEXT_ID++, kind: 'tower', side, type, lane,
      x: pos.x, y: side === 1 ? pos.y : ROWS - pos.y,
      hp: def.hp, maxHp: def.hp, dmg: def.dmg, as: def.as, range: def.range, radius: def.radius, proj: def.proj,
      air: false, building: true, awake: type !== 'king', alive: true, cd: 0.5, flash: 0, target: null, tid: 0,
    };
  }

  // ---------- helpers ----------
  _ok(t, id) { return !!t && t.alive && t.id === id; }
  _gap(a, b) { return hyp(a.x - b.x, a.y - b.y) - a.radius - b.radius; }
  ownHalf(side, y) { return side === 0 ? y >= RIVER.bottom + 0.5 : y <= RIVER.top - 0.5; }
  fastElixir() { return this.state !== 'regular'; }

  // ---------- player actions ----------
  canDeploy(side, card, x, y) {
    if (this.state === 'ended') return false;
    if (card.type === 'spell') return x >= 0 && x <= COLS && y >= 0 && y <= ROWS;
    if (x < 0.8 || x > COLS - 0.8 || !this.ownHalf(side, y)) return false;
    if (side === 0 ? y > ROWS - 0.8 : y < 0.8) return false;
    for (const t of this.towers) {
      if (t.alive && hyp(x - t.x, y - t.y) < t.radius + 0.7) return false;
    }
    return true;
  }

  deploy(side, slot, x, y) {
    const deck = this.decks[side];
    const card = CARDS[deck.hand[slot]];
    if (!card || this.elixir[side] < card.cost || !this.canDeploy(side, card, x, y)) return false;
    this.elixir[side] -= card.cost;
    if (card.type === 'spell') {
      this.spells.push({ t: card.spell.delay, max: card.spell.delay, x, y, side, ...card.spell });
    } else {
      const n = card.count;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const off = n === 1 ? 0 : 0.7;
        this._spawnUnit(side, card, x + Math.cos(a) * off, y + Math.sin(a) * off);
      }
    }
    // Played card goes to the back of the queue; the next card takes its slot.
    deck.hand[slot] = deck.queue.shift();
    deck.queue.push(card.id);
    this.events.emit('deploy', { side, card, x, y });
    return true;
  }

  _spawnUnit(side, card, x, y) {
    const d = card.unit;
    const u = this.unitPool.acquire();
    Object.assign(u, {
      id: NEXT_ID++, kind: 'unit', side, cardId: card.id, x, y,
      hp: d.hp, maxHp: d.hp, dmg: d.dmg, as: d.as, speed: d.speed, range: d.range, radius: d.radius,
      targets: d.targets, aggro: d.aggro, air: d.air, building: d.building, proj: d.proj, splash: d.splash,
      life: d.life, color: d.color, icon: d.icon, deployT: d.deploy, deployMax: d.deploy,
      cd: 0.2, target: null, tid: 0, lane: x < COLS / 2 ? 0 : 1, flash: 0, alive: true,
    });
    this.units.push(u);
  }

  // ---------- main step ----------
  step(dt) {
    if (this.state === 'ended') { this._cleanup(dt); return; }
    this.clock += dt;
    this._stepTime(dt);
    const rate = MATCH.elixirPerSec * (this.fastElixir() ? MATCH.fastMult : 1);
    for (let s = 0; s < 2; s++) this.elixir[s] = Math.min(MATCH.elixirMax, this.elixir[s] + rate * dt);

    for (const t of this.towers) this._stepTower(t, dt);
    for (const u of this.units) if (u.alive) this._stepUnit(u, dt);
    this._separate();
    for (const p of this.projectiles) this._stepProjectile(p, dt);
    this._stepSpells(dt);
    this._cleanup(dt);
  }

  _stepTime(dt) {
    this.time -= dt;
    if (this.time > 0 || this.state === 'ended') return;
    const tied = this.crowns[0] === this.crowns[1];
    if (this.state === 'regular') {
      if (!tied) return this._end(this.crowns[0] > this.crowns[1] ? 0 : 1);
      this.state = 'overtime'; this.time = MATCH.overtime; this.events.emit('phase', 'overtime');
    } else if (this.state === 'overtime') {
      if (!tied) return this._end(this.crowns[0] > this.crowns[1] ? 0 : 1);
      this.state = 'sudden'; this.time = MATCH.sudden; this.events.emit('phase', 'sudden');
    } else if (this.state === 'sudden') {
      this._end(tied ? -1 : (this.crowns[0] > this.crowns[1] ? 0 : 1));
    }
  }

  _end(winner) {
    this.state = 'ended';
    this.winner = winner;
    this.time = Math.max(0, this.time);
    this.events.emit('end', winner);
  }

  // ---------- targeting ----------
  _canHit(e, c) {
    if (e.targets === 'buildings') return c.building;
    if (e.targets === 'ground') return !c.air;
    return true;
  }

  _findTarget(e) {
    let best = null, bd = e.aggro;
    const consider = (c) => {
      if (!c.alive || c.side === e.side || !this._canHit(e, c)) return;
      const d = this._gap(e, c);
      if (d <= bd) { bd = d; best = c; }
    };
    for (const t of this.towers) consider(t);
    for (const u of this.units) consider(u);
    return best;
  }

  _laneGoal(u) {
    const enemy = 1 - u.side;
    let king = null;
    for (const t of this.towers) {
      if (!t.alive || t.side !== enemy) continue;
      if (t.type === 'princess' && t.lane === u.lane) return t;
      if (t.type === 'king') king = t;
    }
    return king;
  }

  // ---------- units ----------
  _stepUnit(u, dt) {
    if (u.flash > 0) u.flash -= dt;
    if (u.deployT > 0) { u.deployT -= dt; return; }
    if (u.life) {
      u.hp -= (u.maxHp / u.life) * dt;
      if (u.hp <= 0) { this._kill(u); return; }
    }
    u.cd -= dt;

    if (!(this._ok(u.target, u.tid) && this._gap(u, u.target) <= u.aggro * 1.3)) {
      u.target = this._findTarget(u);
      u.tid = u.target ? u.target.id : 0;
    }
    let dest;
    if (u.target) {
      if (this._gap(u, u.target) <= u.range) {
        if (u.cd <= 0) { this._attack(u, u.target); u.cd = u.as; }
        return;
      }
      dest = u.target;
    } else {
      dest = this._laneGoal(u);
    }
    if (!dest || u.speed <= 0) return;
    const wp = this._path(u, dest);
    const dx = wp.x - u.x, dy = wp.y - u.y;
    const d = hyp(dx, dy);
    if (d < 0.001) return;
    const step = Math.min(u.speed * dt, d);
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
  }

  // Ground units may only cross the river on a bridge.
  _path(u, dest) {
    if (u.air) return dest;
    const inBand = u.y >= RIVER.top && u.y <= RIVER.bottom;
    const crossing = (u.y > RIVER.bottom && dest.y < RIVER.top) || (u.y < RIVER.top && dest.y > RIVER.bottom);
    if (!inBand && !crossing) return dest;
    const br = BRIDGES[u.lane];
    const goingUp = inBand ? dest.y < u.y : u.y > RIVER.bottom;
    if (inBand) return { x: clamp(u.x, br.x - br.half + 0.6, br.x + br.half - 0.6), y: goingUp ? RIVER.top - 1 : RIVER.bottom + 1 };
    const entryY = goingUp ? RIVER.bottom + 0.8 : RIVER.top - 0.8;
    if (Math.abs(u.x - br.x) > br.half - 0.5) return { x: br.x, y: entryY };
    return { x: br.x, y: goingUp ? RIVER.top - 1 : RIVER.bottom + 1 };
  }

  _attack(src, target) {
    if (src.proj) this._shoot(src, target);
    else this.damage(target, src.dmg, src.side);
  }

  _shoot(src, target) {
    const p = this.projPool.acquire();
    Object.assign(p, {
      x: src.x, y: src.y, tx: target.x, ty: target.y, target, tid: target.id,
      dmg: src.dmg, speed: src.proj, splash: src.splash || 0, side: src.side, done: false,
    });
    this.projectiles.push(p);
  }

  _stepTower(t, dt) {
    if (!t.alive) return;
    if (t.flash > 0) t.flash -= dt;
    t.cd -= dt;
    if (!t.awake) return;
    if (!(this._ok(t.target, t.tid) && this._gap(t, t.target) <= t.range)) {
      let best = null, bd = t.range;
      for (const u of this.units) {
        if (!u.alive || u.side === t.side) continue;
        const d = this._gap(t, u);
        if (d <= bd) { bd = d; best = u; }
      }
      t.target = best;
      t.tid = best ? best.id : 0;
    }
    if (t.target && t.cd <= 0) { this._shoot(t, t.target); t.cd = t.as; }
  }

  _stepProjectile(p, dt) {
    if (p.done) return;
    const live = this._ok(p.target, p.tid);
    if (live) { p.tx = p.target.x; p.ty = p.target.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = hyp(dx, dy);
    const step = p.speed * dt;
    if (d <= step + 0.05) {
      p.done = true;
      if (p.splash) this._area(p.tx, p.ty, p.splash, p.dmg, p.dmg, p.side);
      else if (live) this.damage(p.target, p.dmg, p.side);
    } else {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
  }

  _stepSpells(dt) {
    for (const s of this.spells) {
      s.t -= dt;
      if (s.t <= 0 && !s.done) { s.done = true; this._area(s.x, s.y, s.radius, s.dmg, s.towerDmg, s.side); }
    }
  }

  _area(x, y, r, dmg, towerDmg, side) {
    for (const t of this.towers) {
      if (t.alive && t.side !== side && hyp(t.x - x, t.y - y) - t.radius <= r) this.damage(t, towerDmg, side);
    }
    for (const u of this.units) {
      if (u.alive && u.side !== side && hyp(u.x - x, u.y - y) - u.radius <= r) this.damage(u, dmg, side);
    }
    this.fx.push({ t: 'blast', x, y, r, life: 0.35, max: 0.35 });
    this.events.emit('boom', { x, y });
  }

  // ---------- damage / death ----------
  damage(target, amount, srcSide) {
    if (!target.alive || this.state === 'ended') return;
    target.hp -= amount;
    target.flash = 0.12;
    this.fx.push({ t: 'num', x: target.x, y: target.y - target.radius, text: Math.round(amount), life: 0.7, max: 0.7, side: srcSide });
    this.events.emit('hit', target);
    if (target.kind === 'tower' && target.type === 'king') target.awake = true;
    if (target.hp <= 0) this._kill(target);
  }

  _kill(e) {
    e.hp = 0;
    e.alive = false;
    this.fx.push({ t: 'puff', x: e.x, y: e.y, r: e.radius * 1.6, life: 0.4, max: 0.4 });
    if (e.kind !== 'tower') { this.events.emit('unitDied', e); return; }
    this.crowns[1 - e.side] += e.type === 'king' ? 3 : 1;
    if (e.type === 'princess') {
      for (const t of this.towers) if (t.side === e.side && t.type === 'king') t.awake = true;
    }
    this.events.emit('tower', e);
    if (e.type === 'king' || this.state === 'sudden') this._end(1 - e.side);
  }

  // ---------- physics-lite ----------
  _separate() {
    const us = this.units;
    for (let i = 0; i < us.length; i++) {
      const a = us[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j];
        if (!b.alive || a.air !== b.air || (a.speed === 0 && b.speed === 0)) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = a.radius + b.radius;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = hyp(dx, dy);
        if (d >= min) continue;
        const nx = d > 0.0001 ? dx / d : 1, ny = d > 0.0001 ? dy / d : 0;
        const ov = min - d;
        const wa = b.speed === 0 ? 1 : a.speed === 0 ? 0 : 0.5;
        a.x -= nx * ov * wa; a.y -= ny * ov * wa;
        b.x += nx * ov * (1 - wa); b.y += ny * ov * (1 - wa);
      }
    }
    for (const u of us) {
      if (!u.alive) continue;
      if (!u.air) {
        for (const t of this.towers) {
          if (!t.alive) continue;
          const dx = u.x - t.x, dy = u.y - t.y;
          const min = u.radius + t.radius;
          const d = hyp(dx, dy);
          if (d < min && d > 0.0001) { u.x = t.x + (dx / d) * min; u.y = t.y + (dy / d) * min; }
        }
        this._keepOffRiver(u);
      }
      u.x = clamp(u.x, u.radius, COLS - u.radius);
      u.y = clamp(u.y, u.radius, ROWS - u.radius);
    }
  }

  _keepOffRiver(u) {
    if (u.y < RIVER.top - u.radius * 0.5 || u.y > RIVER.bottom + u.radius * 0.5) return;
    for (const b of BRIDGES) if (Math.abs(u.x - b.x) <= b.half - u.radius * 0.5) return;
    const mid = (RIVER.top + RIVER.bottom) / 2;
    u.y = u.y < mid ? RIVER.top - u.radius * 0.5 - 0.01 : RIVER.bottom + u.radius * 0.5 + 0.01;
  }

  _cleanup(dt) {
    let n = 0;
    for (const u of this.units) {
      if (u.alive) this.units[n++] = u; else this.unitPool.release(u);
    }
    this.units.length = n;
    n = 0;
    for (const p of this.projectiles) {
      if (!p.done) this.projectiles[n++] = p; else this.projPool.release(p);
    }
    this.projectiles.length = n;
    this.spells = this.spells.filter((s) => !s.done);
    n = 0;
    for (const f of this.fx) {
      f.life -= dt;
      if (f.life > 0) this.fx[n++] = f;
    }
    this.fx.length = n;
  }
}
