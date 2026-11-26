// Seeded randomness and periodic value noise: the same seed always builds the same islands.

/** mulberry32: a small, fast seeded PRNG returning floats in [0, 1). */
export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Value noise on a lattice that wraps every `size` cells, so the world tiles seamlessly.
 * Returns a sampler noise(x, y) in [0, 1] for x, y in lattice units.
 */
export function createPeriodicNoise(rng, size) {
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  return function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = smooth(x - xi), fy = smooth(y - yi);
    const x0 = ((xi % size) + size) % size, y0 = ((yi % size) + size) % size;
    const x1 = (x0 + 1) % size, y1 = (y0 + 1) % size;
    const a = grid[y0 * size + x0], b = grid[y0 * size + x1];
    const c = grid[y1 * size + x0], d = grid[y1 * size + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

/** Fractal noise: octaves of periodic noise, each twice as fine and half as strong. */
export function createFractalNoise(seed, mapSize, baseCells, octaves) {
  const rng = createRng(seed);
  const layers = [];
  for (let o = 0; o < octaves; o++) {
    const cells = baseCells << o;
    layers.push({ noise: createPeriodicNoise(rng, cells), scale: cells / mapSize, weight: 1 / (1 << o) });
  }
  const total = layers.reduce((s, l) => s + l.weight, 0);
  return function fractal(x, y) {
    let v = 0;
    for (const l of layers) v += l.noise(x * l.scale, y * l.scale) * l.weight;
    return v / total;
  };
}
