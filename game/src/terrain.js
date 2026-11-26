// Builds the islands: a wrapping heightmap with flattened airfields and a shaded colour map.

import { createFractalNoise, createRng } from './random.js';
import { AIRFIELDS, MAP, SEA, runwayFrame } from './world.js';

const SNOW = 96, ROCK = 70, SAND = SEA + 2.5;

function rgb(r, g, b) {
  return (255 << 24) | (b << 16) | (g << 8) | r; // little-endian ABGR for ImageData
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

export function buildTerrain(seed) {
  const n = MAP * MAP;
  const height = new Float32Array(n);
  const color = new Uint32Array(n);
  const land = createFractalNoise(seed, MAP, 4, 7);
  const ridge = createFractalNoise(seed + 1, MAP, 8, 4);
  const forest = createFractalNoise(seed + 2, MAP, 16, 3);

  for (let y = 0; y < MAP; y++) {
    for (let x = 0; x < MAP; x++) {
      const base = land(x, y);
      const r = 1 - Math.abs(ridge(x, y) * 2 - 1); // sharp ridgelines
      let h = (base - 0.42) * 260 + r * r * 55 * Math.max(0, base - 0.45) * 4;
      height[y * MAP + x] = Math.max(h, 0);
    }
  }
  flattenAirfields(height);

  const rng = createRng(seed + 3);
  for (let y = 0; y < MAP; y++) {
    for (let x = 0; x < MAP; x++) {
      const i = y * MAP + x;
      const h = height[i];
      const west = height[y * MAP + ((x + MAP - 1) % MAP)];
      const north = height[((y + MAP - 1) % MAP) * MAP + x];
      const light = Math.max(0.55, Math.min(1.35, 1 + (h - west) * 0.06 + (h - north) * 0.05));
      const grain = 0.94 + rng() * 0.12;
      let r, g, b;
      if (h <= SEA) {
        const depth = Math.min(1, (SEA - h) / 30);
        r = mix(70, 18, depth); g = mix(150, 64, depth); b = mix(170, 118, depth);
      } else if (h < SAND) {
        r = 214; g = 196; b = 140;
      } else if (h > SNOW) {
        r = 236; g = 240; b = 246;
      } else if (h > ROCK) {
        const t = (h - ROCK) / (SNOW - ROCK);
        r = mix(120, 150, t); g = mix(112, 146, t); b = mix(100, 140, t);
      } else if (forest(x, y) > 0.55) {
        r = 46; g = 92; b = 44;
      } else {
        const t = (h - SAND) / (ROCK - SAND);
        r = mix(118, 104, t); g = mix(162, 128, t); b = mix(72, 70, t);
      }
      const k = (h <= SEA ? 1 : light) * grain;
      color[i] = rgb(Math.min(255, r * k) | 0, Math.min(255, g * k) | 0, Math.min(255, b * k) | 0);
    }
  }
  paintVillages(height, color, seed);
  paintRunways(color);
  for (let i = 0; i < n; i++) if (height[i] < SEA) height[i] = SEA; // water is a flat surface
  return { height, color };
}

/** Level each airfield and blend the ground around it so the runway sits on a plateau. */
function flattenAirfields(height) {
  for (const f of AIRFIELDS) {
    let sum = 0, count = 0;
    forArea(f, 0, (i) => { sum += height[i]; count++; });
    f.elevation = Math.max(SEA + 6, sum / count);
    const blend = 16;
    forArea(f, blend, (i, edge) => {
      const t = Math.min(1, edge / blend);
      height[i] = f.elevation + (height[i] - f.elevation) * t * t;
    });
  }
}

/** Visit cells within `margin` of a field's paved area; edge is the distance outside it (0 inside). */
function forArea(f, margin, visit) {
  const reach = Math.ceil(f.half + f.width + margin + 8);
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const x = (f.x + dx + MAP) % MAP, y = (f.y + dy + MAP) % MAP;
      const fr = runwayFrame(f, x, y);
      const outA = Math.max(0, Math.abs(fr.along) - f.half - 4);
      const outC = Math.max(0, Math.abs(fr.across) - f.width - 6);
      const edge = Math.hypot(outA, outC);
      if (edge <= margin) visit(y * MAP + x, edge);
    }
  }
}

function paintRunways(color) {
  const asphalt = rgb(74, 76, 80), stripe = rgb(236, 236, 228), apron = rgb(122, 126, 118);
  for (const f of AIRFIELDS) {
    forArea(f, 0, (i) => {
      const x = i % MAP, y = (i / MAP) | 0;
      const fr = runwayFrame(f, x, y);
      const onPave = Math.abs(fr.along) <= f.half && Math.abs(fr.across) <= f.width;
      if (!onPave) { if (Math.abs(fr.across) < f.width + 3) color[i] = apron; return; }
      const a = Math.abs(fr.along);
      let c = asphalt;
      if (Math.abs(fr.across) < 0.5 && Math.floor(fr.along / 3) % 2 === 0 && a < f.half - 5) c = stripe; // centreline
      if (a > f.half - 4 && a < f.half - 1 && Math.floor(fr.across * 1.5) % 2 === 0) c = stripe;          // thresholds
      if (Math.abs(Math.abs(fr.across) - f.width) < 0.4) c = stripe;                                       // edges
      color[i] = c;
    });
  }
}

/** Small clusters of red-roofed houses on gentle lowland, raised so they stand out in the voxels. */
function paintVillages(height, color, seed) {
  const rng = createRng(seed + 9);
  const roofs = [rgb(176, 64, 48), rgb(196, 92, 56), rgb(150, 54, 50)];
  const walls = rgb(226, 214, 190);
  let placed = 0;
  for (let tries = 0; tries < 4000 && placed < 26; tries++) {
    const cx = (rng() * MAP) | 0, cy = (rng() * MAP) | 0;
    const h = height[cy * MAP + cx];
    if (h < SAND + 3 || h > ROCK - 20) continue;
    placed++;
    const houses = 5 + ((rng() * 8) | 0);
    for (let k = 0; k < houses; k++) {
      const hx = (cx + Math.round((rng() - 0.5) * 18) + MAP) % MAP;
      const hy = (cy + Math.round((rng() - 0.5) * 18) + MAP) % MAP;
      const roof = roofs[(rng() * roofs.length) | 0];
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          const i = ((hy + dy) % MAP) * MAP + ((hx + dx) % MAP);
          if (height[i] <= SEA + 1) continue;
          height[i] += dy === 0 ? 1.6 : 1.2;
          color[i] = dy === 0 ? roof : walls;
        }
      }
    }
  }
}

/** Bilinear height at any point, wrapping. */
export function sampleHeight(terrain, x, y) {
  const fx = Math.floor(x), fy = Math.floor(y);
  const tx = x - fx, ty = y - fy;
  const x0 = ((fx % MAP) + MAP) % MAP, y0 = ((fy % MAP) + MAP) % MAP;
  const x1 = (x0 + 1) % MAP, y1 = (y0 + 1) % MAP;
  const h = terrain.height;
  const a = h[y0 * MAP + x0], b = h[y0 * MAP + x1], c = h[y1 * MAP + x0], d = h[y1 * MAP + x1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
