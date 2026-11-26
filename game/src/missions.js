// The three sorties: what each asks of the pilot, where it starts, and how it is scored.

import { sampleHeight } from './terrain.js';
import { AIRFIELDS, wrap, wrapDelta, onRunway } from './world.js';

const home = AIRFIELDS[0], cliff = AIRFIELDS[1];

export const MISSIONS = [
  {
    id: 'rings', name: 'Ring Run', brief: 'Thread the 10 gold rings down the Saltmarrow valley before the clock runs out, then land back at Kestrel Field.',
    timeLimit: 240, fuel: 0.7,
  },
  {
    id: 'ferry', name: 'Ferry Flight', brief: 'Take off from Kestrel Field and deliver the Tern to Gannet Point, a short strip on the cliffs. Fuel is tight: climb, cruise, then glide in.',
    timeLimit: 420, fuel: 0.32,
  },
  {
    id: 'patrol', name: 'Lighthouse Patrol', brief: 'Overfly the four lighthouse beacons below 1,500 ft in any order, watch the fuel, and land at either field.',
    timeLimit: 600, fuel: 0.55,
  },
];

/** Gold rings along a course out of Kestrel Field, each floating 90-160 m over the ground. */
function buildRings(terrain) {
  const rings = [];
  let x = home.x + 60, y = home.y, dir = 0;
  for (let i = 0; i < 10; i++) {
    dir += Math.sin(i * 1.7) * 0.45;
    x = wrap(x + Math.cos(dir) * 46);
    y = wrap(y + Math.sin(dir) * 46);
    const ground = sampleHeight(terrain, x, y);
    rings.push({ x, y, z: ground + 9 + (i % 3) * 3.5, dir, radius: 4.2, passed: false });
  }
  return rings;
}

function buildBeacons(terrain) {
  const spots = [[home.x - 120, home.y - 140], [home.x + 210, home.y + 150], [cliff.x + 90, cliff.y - 60], [cliff.x - 200, cliff.y + 40]];
  return spots.map(([x, y], i) => {
    const wx = wrap(x), wy = wrap(y);
    return { x: wx, y: wy, z: sampleHeight(terrain, wx, wy), name: ['North Light', 'Southreach', 'Gannet Light', 'Tessel Head'][i], visited: false };
  });
}

/** Where the Tern starts for a mission: on the runway, or airborne for the ring run. */
export function missionStart(mission) {
  if (mission.id === 'rings') {
    return { x: home.x + 10, y: home.y, z: home.elevation + 10, yaw: 0, pitch: 0, speed: 8, throttle: 0.75, fuel: mission.fuel };
  }
  return { x: home.x - home.half + 3, y: home.y, z: home.elevation + 0.35, yaw: home.dir, speed: 0, throttle: 0, fuel: mission.fuel, onGround: true };
}

export function createMissionRun(mission, terrain) {
  return {
    mission, time: 0, result: null, score: 0,
    rings: mission.id === 'rings' ? buildRings(terrain) : [],
    beacons: mission.id === 'patrol' ? buildBeacons(terrain) : [],
    target: mission.id === 'ferry' ? cliff : home,
    prev: null,
  };
}

/** Advance mission logic after the aircraft moved. Sets run.result once the sortie is decided. */
export function updateMission(run, a, dt) {
  if (run.result) return;
  run.time += dt;
  const m = run.mission;
  if (a.state === 'crashed') return finish(run, 'failed', a.lastEvent?.text ?? 'Crashed');

  if (m.id === 'rings') {
    for (const r of run.rings) if (!r.passed && crossedRing(run.prev, a, r)) { r.passed = true; run.score += 100; run.chime = true; }
  }
  if (m.id === 'patrol') {
    for (const b of run.beacons) {
      const d = Math.hypot(wrapDelta(a.x, b.x), wrapDelta(a.y, b.y));
      if (!b.visited && d < 14 && a.z - b.z < 45) { b.visited = true; run.score += 150; run.chime = true; }
    }
  }
  run.prev = { x: a.x, y: a.y, z: a.z };

  if (run.time > m.timeLimit) return finish(run, 'failed', 'Out of time');
  if (a.state === 'landed') {
    const field = AIRFIELDS.find((f) => onRunway(f, a.x, a.y));
    const goalsMet =
      m.id === 'rings' ? run.rings.every((r) => r.passed) && field === run.target :
      m.id === 'ferry' ? field === run.target :
      run.beacons.every((b) => b.visited) && !!field;
    if (goalsMet) {
      run.score += 500 + Math.round((m.timeLimit - run.time) * 2) + Math.round(a.fuel * 400) - Math.round(a.damage * 300);
      return finish(run, 'success', `Landed at ${field.name}`);
    }
    if (m.id === 'rings' && field) return finish(run, 'failed', `Landed with ${run.rings.filter((r) => !r.passed).length} rings missed`);
  }
}

function finish(run, result, reason) {
  run.result = result;
  run.reason = reason;
}

/** Did the path from prev to now pass through the ring's disc? */
function crossedRing(prev, a, r) {
  if (!prev) return false;
  const nx = Math.cos(r.dir), ny = Math.sin(r.dir);
  const d0 = wrapDelta(prev.x, r.x) * nx + wrapDelta(prev.y, r.y) * ny;
  const d1 = wrapDelta(a.x, r.x) * nx + wrapDelta(a.y, r.y) * ny;
  if (d0 > 0 || d1 < 0) return false;
  const t = d0 / (d0 - d1);
  const px = wrapDelta(prev.x, r.x) + (wrapDelta(a.x, r.x) - wrapDelta(prev.x, r.x)) * t;
  const py = wrapDelta(prev.y, r.y) + (wrapDelta(a.y, r.y) - wrapDelta(prev.y, r.y)) * t;
  const pz = prev.z + (a.z - prev.z) * t - r.z;
  const lateral = -px * ny + py * nx;
  return Math.hypot(lateral, pz) <= r.radius;
}

/** The next thing the pilot should fly to, for the HUD's steering cue. */
export function nextObjective(run, a) {
  if (run.mission.id === 'rings') {
    const r = run.rings.find((q) => !q.passed);
    if (r) return { x: r.x, y: r.y, z: r.z, label: `Ring ${run.rings.indexOf(r) + 1}/10` };
  }
  if (run.mission.id === 'patrol') {
    let best = null, bestD = Infinity;
    for (const b of run.beacons) {
      if (b.visited) continue;
      const d = Math.hypot(wrapDelta(b.x, a.x), wrapDelta(b.y, a.y));
      if (d < bestD) { bestD = d; best = b; }
    }
    if (best) return { x: best.x, y: best.y, z: best.z + 20, label: best.name };
  }
  const f = run.target;
  return { x: f.x, y: f.y, z: f.elevation, label: f.name, field: f };
}
