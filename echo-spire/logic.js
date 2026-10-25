/* Echo Spire - puzzle logic (no rendering). Shared by the game and the level verifier. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EchoLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Directions as quarter turns counter-clockwise: 0:+x 1:+y 2:-x 3:-y
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const mod = (n, m) => ((n % m) + m) % m;

  function rotPoint(px, py, x, y, k) {
    let dx = x - px, dy = y - py;
    for (let i = mod(k, 4); i > 0; i--) { const t = dx; dx = -dy; dy = t; }
    return [px + dx, py + dy];
  }

  // Turns raw level data into the structure used at runtime.
  function prepare(def) {
    const pieces = def.pieces.map((p, id) => ({
      id,
      color: p.color,
      pivot: p.pivot || [0, 0],
      rot: p.rot ? { cycle: p.rot.cycle || 4, step: p.rot.step || 1 } : null,
      slide: p.slide || null,
      blocks: p.blocks.map(b => ({
        x: b[0], y: b[1], z: b[2], kind: b[3] || 'b', dir: b[4] || 0, color: b[5] || null,
      })),
    }));
    const offsets = [];
    const flat = [];
    pieces.forEach(p => {
      offsets.push(flat.length);
      p.blocks.forEach((b, bi) => flat.push({ pi: p.id, bi, b }));
    });
    const find = cell => {
      const i = flat.findIndex(f => f.b.x === cell[0] && f.b.y === cell[1] && f.b.z === cell[2] && f.b.kind !== 'd');
      if (i < 0) throw new Error('No walkable block at ' + cell + ' in ' + def.name);
      return i;
    };
    const handles = (def.handles || []).map(h => ({
      type: h.type,
      targets: Array.isArray(h.piece) ? h.piece : [h.piece],
      host: h.on === undefined ? (Array.isArray(h.piece) ? h.piece[0] : h.piece) : h.on,
      at: h.at,
      dir: h.dir || 1,
      plateOnly: !!h.plateOnly,
    }));
    // Plates: walking onto the tile fires a handle, as if it had been tapped.
    const plates = (def.plates || []).map(p => ({ idx: find(p.at), hi: p.handle }));
    const plateMap = new Map(plates.map(p => [p.idx, p.hi]));
    return {
      name: def.name, hint: def.hint, sky: def.sky, illusion: !!def.illusion, blind: !!def.blind, walkOnly: !!def.walkOnly, par: def.par,
      pieces, flat, offsets, handles, plates, plateMap,
      start: find(def.start), goal: find(def.goal),
    };
  }

  function initialState(level) {
    return level.pieces.map(() => ({ r: 0, s: 0 }));
  }

  // Quarter turns applied to a piece for rotation state r.
  function rotK(piece, r) {
    return piece.rot ? mod(r * piece.rot.step, 4) : 0;
  }

  // Every block's current grid cell for a given state.
  function cells(level, state) {
    const out = new Array(level.flat.length);
    level.flat.forEach((f, i) => {
      const p = level.pieces[f.pi], st = state[f.pi], b = f.b;
      const k = rotK(p, st.r);
      const c = rotPoint(p.pivot[0], p.pivot[1], b.x + 0.5, b.y + 0.5, k);
      let x = Math.floor(c[0]), y = Math.floor(c[1]), z = b.z;
      if (st.s && p.slide) { x += p.slide[0]; y += p.slide[1]; z += p.slide[2]; }
      out[i] = { pi: f.pi, bi: f.bi, x, y, z, kind: b.kind, dir: mod(b.dir + k, 4), walk: b.kind !== 'd' };
    });
    return out;
  }

  // Cells a walkable tile can step into. A connection needs both sides to agree.
  function ports(t) {
    const out = [];
    if (t.kind === 'l') {
      // a ladder cell stands level with the top of the blocks around it, one cell below
      for (const d of DIRS) out.push([t.x + d[0], t.y + d[1], t.z - 1]);
    } else if (t.kind === 'b') {
      for (const d of DIRS) {
        out.push([t.x + d[0], t.y + d[1], t.z]);
        out.push([t.x + d[0], t.y + d[1], t.z + 1]);
      }
    } else {
      const d = DIRS[t.dir];
      out.push([t.x - d[0], t.y - d[1], t.z - 1]);
      out.push([t.x + d[0], t.y + d[1], t.z]);
      out.push([t.x + d[0], t.y + d[1], t.z + 1]);
    }
    return out;
  }

  // Tiles that look touching on screen, even if they are far apart in 3D.
  function visuallyLinked(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) < 2) return false;
    // Same spot on screen: the Penrose staircase closing on itself.
    if (dx === dy && dy === dz) return true;
    return Math.abs(dx - dy) === 1 && Math.abs(Math.abs((dx + dy) / 2 - dz) - 0.5) < 1e-9;
  }

  function buildGraph(level, all) {
    const adj = all.map(() => []);
    const at = new Map();
    all.forEach((t, i) => at.set(t.x + ',' + t.y + ',' + t.z, i));
    const pt = all.map(t => (t.walk ? ports(t) : null));
    all.forEach((t, i) => {
      if (!t.walk) return;
      for (const p of pt[i]) {
        const j = at.get(p[0] + ',' + p[1] + ',' + p[2]);
        if (j === undefined || j === i || !all[j].walk) continue;
        if (pt[j].some(q => q[0] === t.x && q[1] === t.y && q[2] === t.z)) adj[i].push(j);
      }
    });
    // ladders also climb: up and down to other ladder cells, and onto the block they stand on
    all.forEach((t, i) => {
      if (t.kind !== 'l') return;
      for (const dz of [1, -1]) {
        const j = at.get(t.x + ',' + t.y + ',' + (t.z + dz));
        if (j === undefined || !all[j].walk) continue;
        if (all[j].kind !== 'l' && !(dz === -1 && all[j].kind === 'b')) continue;
        if (!adj[i].includes(j)) adj[i].push(j);
        if (!adj[j].includes(i)) adj[j].push(i);
      }
    });
    adj.ill = new Set();
    if (level.illusion) {
      // Bucket tiles by where they land on screen; linked tiles are the same spot or one diagonal step apart.
      const scr = new Map();
      all.forEach((t, i) => {
        if (!t.walk || t.kind !== 'b') return;
        const k = (t.x - t.y) + ',' + (t.x + t.y - 2 * t.z);
        const list = scr.get(k);
        if (list) list.push(i); else scr.set(k, [i]);
      });
      const OFFS = [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      all.forEach((t, i) => {
        if (!t.walk || t.kind !== 'b') return;
        const sx = t.x - t.y, sy = t.x + t.y - 2 * t.z;
        for (const o of OFFS) {
          const list = scr.get((sx + o[0]) + ',' + (sy + o[1]));
          if (!list) continue;
          for (const j of list) {
            if (j > i && visuallyLinked(t, all[j]) && !adj[i].includes(j)) { adj[i].push(j); adj[j].push(i); adj.ill.add(i + ',' + j); }
          }
        }
      });
    }
    return adj;
  }

  function findPath(adj, a, b) {
    if (a === b) return [a];
    const prev = new Map([[a, -1]]);
    const q = [a];
    for (let h = 0; h < q.length; h++) {
      for (const n of adj[q[h]]) {
        if (prev.has(n)) continue;
        prev.set(n, q[h]);
        if (n === b) {
          const path = [b];
          for (let c = q[h]; c !== -1; c = prev.get(c)) path.push(c);
          return path.reverse();
        }
        q.push(n);
      }
    }
    return null;
  }

  // New state after pressing handle hi.
  function tap(level, state, hi) {
    const h = level.handles[hi];
    const next = state.map(s => ({ r: s.r, s: s.s }));
    for (const pi of h.targets) {
      if (h.type === 'rot') next[pi].r = mod(next[pi].r + h.dir, level.pieces[pi].rot.cycle);
      else next[pi].s = 1 - next[pi].s;
    }
    return next;
  }

  const stateKey = st => st.map(p => p.r + '.' + p.s).join('|');

  // Shortest list of crank taps that gets the player to the goal. Walking is free, so only taps cost, and
  // the search runs over (pose, connected region the player is in) instead of every single tile.
  // Returns { taps, seq: [{ hi, at }] } where `at` is the tile the player must stand on when tapping
  // (that matters when a piece carries the player), or null if unsolvable.
  function solve(level, state, startIdx, maxTaps) {
    maxTaps = maxTaps || 12;
    const infos = new Map();
    const info = (st, sk) => {
      let g = infos.get(sk);
      if (g) return g;
      const all = cells(level, st), adj = buildGraph(level, all);
      const label = new Int32Array(all.length).fill(-1), comps = [];
      all.forEach((t, i) => {
        if (!t.walk || label[i] >= 0) return;
        const id = comps.length, list = [i];
        label[i] = id;
        for (let h = 0; h < list.length; h++) for (const n of adj[list[h]]) if (label[n] < 0) { label[n] = id; list.push(n); }
        comps.push(list);
      });
      g = { label, comps };
      infos.set(sk, g);
      return g;
    };
    const sk0 = stateKey(state);
    const startComp = info(state, sk0).label[startIdx];
    const parent = new Map([[sk0 + '#' + startComp, null]]);
    let layer = [{ st: state, sk: sk0, comp: startComp, rep: startIdx }];
    for (let taps = 0; layer.length && taps <= maxTaps; taps++) {
      for (const nd of layer) {
        if (info(nd.st, nd.sk).label[level.goal] !== nd.comp) continue;
        const seq = [];
        for (let k = nd.sk + '#' + nd.comp, p = parent.get(k); p; k = p.from, p = parent.get(k)) seq.unshift({ hi: p.act, at: p.at, plate: !!p.plate });
        return { taps, seq };
      }
      const next = [];
      for (const nd of layer) {
        const tiles = info(nd.st, nd.sk).comps[nd.comp];
        const from = nd.sk + '#' + nd.comp;
        for (const pl of level.plates) {
          if (!tiles.includes(pl.idx) || (pl.idx === nd.rep && tiles.length < 2)) continue;
          const st2 = tap(level, nd.st, pl.hi), sk2 = stateKey(st2), g2 = info(st2, sk2);
          const k2 = sk2 + '#' + g2.label[pl.idx];
          if (parent.has(k2)) continue;
          parent.set(k2, { from, act: pl.hi, at: pl.idx, plate: true });
          next.push({ st: st2, sk: sk2, comp: g2.label[pl.idx], rep: pl.idx });
        }
        for (let hi = 0; hi < level.handles.length; hi++) {
          if (level.handles[hi].plateOnly) continue;
          const st2 = tap(level, nd.st, hi), sk2 = stateKey(st2), g2 = info(st2, sk2);
          // try the tile the player is already on first, so hints only ask to move when it is needed
          const order = [nd.rep].concat(tiles);
          for (const t of order) {
            const c2 = g2.label[t], k2 = sk2 + '#' + c2;
            if (parent.has(k2)) continue;
            parent.set(k2, { from, act: hi, at: t });
            next.push({ st: st2, sk: sk2, comp: c2, rep: t });
          }
        }
      }
      layer = next;
    }
    return null;
  }

  return { DIRS, mod, rotPoint, prepare, initialState, rotK, cells, buildGraph, findPath, tap, stateKey, solve };
});
