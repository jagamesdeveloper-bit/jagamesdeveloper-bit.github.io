// Node dev tool: builds carousel layouts constructively and keeps the ones with the longest forced route.
// Every platform is placed to line up with one arm tip in one pose, by real contact or by an impossible join.
// Run: node echo-spire/dev/search-carousel.js [trials] [seed]
const L = require('../logic.js');
const levels = require('../levels.js');
const trials = +process.argv[2] || 5000;
let seed = +process.argv[3] || 11;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = a => a[Math.floor(rnd() * a.length)];
const D = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// offsets from an arm tip to a tile that looks attached to it (real neighbour or impossible join)
const OFFS = [];
for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
  const real = dz === 0 && Math.abs(dx) + Math.abs(dy) === 1;
  const ill = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) >= 2 &&
    ((Math.abs(dx - dy) === 1 && Math.abs(Math.abs((dx + dy) / 2 - dz) - 0.5) < 1e-9) || (dx === dy && dy === dz));
  if (real || ill) OFFS.push({ d: [dx, dy, dz], real });
}

function overlaps(lv) {
  const q = [L.initialState(lv)], keys = new Set([L.stateKey(q[0])]);
  for (let h = 0; h < q.length; h++) for (let i = 0; i < lv.handles.length; i++) {
    const nx = L.tap(lv, q[h], i), k = L.stateKey(nx);
    if (!keys.has(k)) { keys.add(k); q.push(nx); }
  }
  for (const st of q) {
    const m = new Set();
    for (const t of L.cells(lv, st)) { const k = t.x + ',' + t.y + ',' + t.z; if (m.has(k)) return true; m.add(k); }
  }
  return false;
}

const out = [], stat = { built: 0, ok: 0 };
for (let t = 0; t < trials; t++) {
  const cz = 3;
  const arms = [ri(1, 2), ri(1, 2), ri(1, 2), ri(1, 2)];
  const m = ri(4, 6), plats = [], used = new Set();
  for (let j = 0; j < m; j++) {
    const i = ri(0, 3), k = ri(0, 3), dir = D[(i + k) % 4];
    const tip = [dir[0] * arms[i], dir[1] * arms[i], cz];
    const o = pick(OFFS), x = tip[0] + o.d[0], y = tip[1] + o.d[1], z = tip[2] + o.d[2];
    if (z < 0 || z > 6 || (Math.abs(x) <= 2 && Math.abs(y) <= 2)) continue;
    const key = x + ',' + y + ',' + z;
    if (used.has(key)) continue;
    used.add(key);
    const group = [[x, y, z]];
    if (rnd() < 0.5) { const d = pick(D), k2 = (x + d[0]) + ',' + (y + d[1]) + ',' + z; if (!used.has(k2) && !(Math.abs(x + d[0]) <= 2 && Math.abs(y + d[1]) <= 2)) { used.add(k2); group.push([x + d[0], y + d[1], z]); } }
    plats.push(group);
  }
  if (plats.length < 4) continue;
  const tiles = plats.flat();
  const plateCells = [];
  for (let p = 0; p < plats.length; p++) if (rnd() < 0.45) plateCells.push(plats[p][plats[p].length - 1]);
  if (!plateCells.length) plateCells.push(plats[1][0]);
  const start = plats[0][0], goal = plats[plats.length - 1][0];
  if (plateCells.some(c => c[0] === goal[0] && c[1] === goal[1] && c[2] === goal[2])) continue;
  const def = levels.carousel({ name: 'x', hint: '', sky: ['#fff', '#000'], arms, cz, platforms: tiles, plates: plateCells, start, goal });
  let lv;
  try { lv = L.prepare(def); } catch (e) { continue; }
  stat.built++;
  if (overlaps(lv)) continue;
  const sol = L.solve(lv, L.initialState(lv), lv.start, 14);
  stat.ok++;
  if (sol && sol.taps >= 3) out.push({ taps: sol.taps, arms, cz, tiles, plateCells, start, goal });
}
out.sort((a, b) => b.taps - a.taps);
console.log(JSON.stringify(stat), 'taps histogram:', JSON.stringify(out.reduce((h, o) => (h[o.taps] = (h[o.taps] || 0) + 1, h), {})));
out.slice(0, 5).forEach(o => console.log(JSON.stringify({ taps: o.taps, arms: o.arms, platforms: o.tiles, plates: o.plateCells, start: o.start, goal: o.goal })));
