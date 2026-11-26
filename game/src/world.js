// The fixed facts of the Tessel Isles: map size, sea level, airfields and how world units map to the HUD.

export const MAP = 1024;            // the world wraps every MAP units on both axes
export const SEA = 18;             // sea level, in world units
export const UNIT_M = 10;          // one world unit is ten metres
export const SEED = 7741;

/** Runways: centre, direction (radians, 0 = +x), half length and half width in world units. */
export const AIRFIELDS = [
  { id: 'home', name: 'Kestrel Field', x: 300, y: 520, dir: 0, half: 34, width: 2.6 },
  { id: 'cliff', name: 'Gannet Point', x: 690, y: 300, dir: Math.PI / 2, half: 26, width: 2.2 },
];

export function wrap(v) {
  return ((v % MAP) + MAP) % MAP;
}

/** Shortest signed difference a - b on the wrapping map. */
export function wrapDelta(a, b) {
  let d = a - b;
  if (d > MAP / 2) d -= MAP;
  if (d < -MAP / 2) d += MAP;
  return d;
}

/** Where a point sits in a runway's own frame: along (from centre) and across. */
export function runwayFrame(field, x, y) {
  const dx = wrapDelta(x, field.x), dy = wrapDelta(y, field.y);
  const c = Math.cos(field.dir), s = Math.sin(field.dir);
  return { along: dx * c + dy * s, across: -dx * s + dy * c };
}

export function onRunway(field, x, y) {
  const f = runwayFrame(field, x, y);
  return Math.abs(f.along) <= field.half && Math.abs(f.across) <= field.width;
}

export const toFeet = (units) => units * UNIT_M * 3.2808;
export const toKnots = (unitsPerSec) => unitsPerSec * UNIT_M * 1.9438;
