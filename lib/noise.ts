/* The noise behind the *@ fields (binary-stage.tsx, scatter-stage.tsx). */

/* Deterministic hash → [0, 1). Seeded so the pattern is the same on every
   load; only the flicker is random. */
export function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

/* Value noise, bilinearly interpolated between lattice hashes. */
function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi + seed, yi);
  const b = hash(xi + 1 + seed, yi);
  const c = hash(xi + seed, yi + 1);
  const d = hash(xi + 1 + seed, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

/* Three octaves: big landmasses with ragged coasts. */
export function fbm(x: number, y: number, seed: number) {
  return noise(x, y, seed) * 0.55 + noise(x * 2.1, y * 2.1, seed + 17) * 0.3 + noise(x * 4.3, y * 4.3, seed + 41) * 0.15;
}
