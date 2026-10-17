import { CARDS, ROWS } from './data.js';
import { mulberry32 } from './util.js';

const hyp = Math.hypot;

// Simple opponent: reacts to units on its half with a counter, otherwise pushes a lane.
export class Bot {
  constructor(match, side = 1, seed = 7) {
    this.m = match;
    this.side = side;
    this.rng = mulberry32(seed);
    this.wait = 3;
  }

  // y of a point `d` tiles in front of this side's own back edge.
  _y(d) { return this.side === 1 ? d : ROWS - d; }

  update(dt) {
    const m = this.m;
    if (m.state === 'ended') return;
    this.wait -= dt;
    if (this.wait > 0) return;

    const foe = 1 - this.side;
    const e = m.elixir[this.side];
    const hand = m.decks[this.side].hand;
    const afford = hand.map((id, slot) => ({ id, slot, c: CARDS[id] })).filter((o) => o.c.cost <= e);
    if (!afford.length) { this.wait = 0.5; return; }

    const threats = m.units.filter((u) => u.alive && u.side === foe && !u.building && m.ownHalf(this.side, u.y));
    let pick = null, x = 9, y = this._y(6.5);

    if (threats.length) {
      const own = m.towers.find((t) => t.side === this.side && t.type === 'king');
      threats.sort((a, b) => hyp(a.x - own.x, a.y - own.y) - hyp(b.x - own.x, b.y - own.y));
      const th = threats[0];
      const cluster = threats.filter((t) => hyp(t.x - th.x, t.y - th.y) < 2.5).length >= 3;
      const prefs = cluster ? ['fireball']
        : threats.some((t) => t.air) ? ['musketeer', 'dragon', 'archers']
        : th.targets === 'buildings' ? ['cannon', 'knight', 'goblins', 'archers', 'musketeer']
        : ['knight', 'goblins', 'archers', 'cannon', 'musketeer'];
      for (const id of prefs) {
        pick = afford.find((o) => o.id === id);
        if (pick) break;
      }
      x = th.x;
      if (pick && pick.id === 'fireball') y = th.y;
      else if (pick && pick.id === 'cannon') y = this._y(8);
    } else if (e >= 7 || (e >= 5 && this.rng() < 0.35)) {
      const pool = afford.filter((o) => o.c.type === 'troop');
      if (pool.length && this.rng() < 0.8) {
        pick = pool.find((o) => o.id === 'giant' && this.rng() < 0.6) || pool[Math.floor(this.rng() * pool.length)];
        x = this.rng() < 0.5 ? 4 : 14;
        y = this._y(3);
      }
    }

    if (pick) m.deploy(this.side, pick.slot, x, y);
    this.wait = 1 + this.rng() * 2;
  }
}
