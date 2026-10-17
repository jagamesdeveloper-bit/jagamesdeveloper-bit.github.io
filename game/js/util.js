export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Small seeded PRNG so a match can be replayed from its seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Events {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, []);
    this.map.get(name).push(fn);
  }
  emit(name, data) {
    const list = this.map.get(name);
    if (list) for (const fn of list) fn(data);
  }
}

// Recycles plain objects. Callers must overwrite every field after acquire().
export class Pool {
  constructor() { this.free = []; }
  acquire() { return this.free.pop() || {}; }
  release(o) { this.free.push(o); }
}
