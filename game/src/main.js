// Tern: game state, the fixed-step loop, the chase and cockpit cameras, and the staged
// screenshot scenes (?shot=cover|cockpit|approach|title) that render one exact frame.

import { createAircraft, stepAircraft } from './aircraft.js';
import { createAudio } from './audio.js';
import { drawCockpit } from './cockpit.js';
import { drawHud } from './hud.js';
import { createInput } from './input.js';
import { createMinimap } from './minimap.js';
import { MISSIONS, createMissionRun, missionStart, nextObjective, updateMission } from './missions.js';
import { drawPlane } from './plane-model.js';
import { createRenderer } from './renderer.js';
import { drawSceneObjects } from './scene-objects.js';
import { drawDebrief, drawPause, drawTitle } from './screens.js';
import { buildTerrain, sampleHeight } from './terrain.js';
import { AIRFIELDS, SEED, runwayFrame, wrap, wrapDelta } from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const terrain = buildTerrain(SEED);
const r3d = createRenderer(terrain, 512, 288);
const minimap = createMinimap(terrain);
const input = createInput(canvas);
const audio = createAudio();
const best = JSON.parse(localStorage.getItem('tern-best') ?? '{}');

const game = { mode: 'title', view: 'chase', selected: 0, run: null, aircraft: null, time: 0, prop: 0, cam: null };

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

function startMission(index) {
  game.selected = index;
  const mission = MISSIONS[index];
  game.run = createMissionRun(mission, terrain);
  game.aircraft = createAircraft(missionStart(mission));
  game.cam = null;
  game.mode = 'play';
  audio.start();
}

/** Title-screen flyby: the Tern circles Kestrel Field on autopilot. */
function attractAircraft(t) {
  const f = AIRFIELDS[0];
  const ang = t * 0.08 + 0.5;
  const x = wrap(f.x + 40 + Math.cos(ang) * 90), y = wrap(f.y + Math.sin(ang) * 90);
  return { ...createAircraft({ x, y, z: f.elevation + 55, yaw: ang + Math.PI / 2, speed: 8.4, throttle: 0.7 }), roll: 0.25, pitch: -0.12 };
}

// ---------------------------------------------------------------- cameras

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function chaseCamera(a, dt, snap) {
  const back = 3.2, up = 1.0;
  const target = {
    yaw: a.yaw, pitch: a.pitch * 0.55 - 0.1, roll: a.roll * 0.55,
  };
  if (!game.cam || snap) game.cam = { ...target };
  const k = Math.min(1, dt * 3.5);
  game.cam.yaw = lerpAngle(game.cam.yaw, target.yaw, k);
  game.cam.pitch += (target.pitch - game.cam.pitch) * k;
  game.cam.roll += (target.roll - game.cam.roll) * k;
  const cx = a.x - Math.cos(game.cam.yaw) * back, cy = a.y - Math.sin(game.cam.yaw) * back;
  const cz = Math.max(a.z + up, sampleHeight(terrain, cx, cy) + 0.7);
  return { x: wrap(cx), y: wrap(cy), z: cz, yaw: game.cam.yaw, pitch: game.cam.pitch, roll: game.cam.roll };
}

function cockpitCamera(a) {
  // Look a little down so the runway ahead clears the glare shield.
  return { x: a.x, y: a.y, z: a.z + 0.15, yaw: a.yaw, pitch: a.pitch - 0.2, roll: a.roll };
}

// ---------------------------------------------------------------- approach guidance

function approachInfo(a, objective) {
  const f = objective.field;
  if (!f) return null;
  const fr = runwayFrame(f, a.x, a.y);
  const end = Math.abs(fr.along) - f.half;
  if (end < 0 || end > 140 || Math.abs(fr.across) > 30) return null;
  const want = (end + 4) * Math.tan((3.5 * Math.PI) / 180);
  return { lateral: fr.across * Math.sign(-fr.along || 1), slopeError: a.z - f.elevation - want };
}

// ---------------------------------------------------------------- frame

function render(dt, snap = false) {
  const w = canvas.width, h = canvas.height;
  const a = game.mode === 'title' ? attractAircraft(game.time) : game.aircraft;
  const run = game.run ?? createMissionRun(MISSIONS[0], terrain);
  const cockpit = game.view === 'cockpit' && game.mode !== 'title';
  const cam = cockpit ? cockpitCamera(a) : chaseCamera(a, dt, snap || game.mode === 'title');
  const ground = sampleHeight(terrain, a.x, a.y);

  r3d.draw(cam);
  if (game.mode !== 'title') drawSceneObjects(r3d, run, a, ground, game.time);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  r3d.present(ctx, w, h, cam.roll);

  const seen = !cockpit && a.state !== 'crashed' && game.mode !== 'title' && r3d.project(a.x, a.y, a.z);
  if (seen) {
    // Draw the Tern where the camera actually sees it, at the scale of the world around it.
    const at = r3d.toScreen(seen, w, h, cam.roll);
    drawPlane(ctx, {
      cx: at.x, cy: at.y, size: (seen.scale * at.k * 18) / 10,
      roll: -(a.roll - cam.roll), pitch: a.pitch - cam.pitch - 0.1, yaw: lerpAngle(0, a.yaw - cam.yaw, 1) * 0.8,
      elev: 0.26, prop: game.prop, throttle: a.throttle, damage: a.damage,
    });
  }
  if (a.state === 'crashed') drawWreck(w, h);

  if (game.mode === 'title') { drawTitle(ctx, w, h, game.selected, best); return; }
  const objective = nextObjective(run, a);
  objective.dist = Math.hypot(wrapDelta(objective.x, a.x), wrapDelta(objective.y, a.y));
  if (cockpit) {
    drawCockpit(ctx, w, h, a, { stall: a.stalled, fuel: a.fuel < 0.12, damage: a.damage > 0.25, brake: a.brakes && a.onGround });
    minimap.draw(ctx, w * 0.92, h * 0.83, Math.min(80, h * 0.12), a, run);
  } else {
    drawHud(ctx, w, h, a, run, objective, { ground, focal: r3d.focal * (h / r3d.height), approach: approachInfo(a, objective) });
    minimap.draw(ctx, w - 110, h - 110, 90, a, run);
  }
  if (a.lastEvent && performance.now() - a.lastEvent.at < 3000) banner(w, h, a.lastEvent.text);
  if (game.mode === 'pause') drawPause(ctx, w, h);
  if (game.mode === 'debrief') drawDebrief(ctx, w, h, run, a);
}

function banner(w, h, msg) {
  ctx.font = '700 22px "Segoe UI", Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,16,24,0.6)';
  const tw = ctx.measureText(msg).width + 40;
  ctx.fillRect(w / 2 - tw / 2, h * 0.24 - 22, tw, 44);
  ctx.fillStyle = '#fff3dc';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, w / 2, h * 0.24);
}

function drawWreck(w, h) {
  const g = ctx.createRadialGradient(w / 2, h * 0.62, 10, w / 2, h * 0.62, 220);
  g.addColorStop(0, 'rgba(255,150,40,0.85)');
  g.addColorStop(0.4, 'rgba(120,40,10,0.5)');
  g.addColorStop(1, 'rgba(30,30,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------- loop

function handleKeys() {
  for (const code of input.takePresses()) {
    if (game.mode === 'title') {
      if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') game.selected = Number(code.slice(5)) - 1;
      if (code === 'ArrowLeft') game.selected = (game.selected + 2) % 3;
      if (code === 'ArrowRight') game.selected = (game.selected + 1) % 3;
      if (code === 'Enter') startMission(game.selected);
    } else if (game.mode === 'play') {
      if (code === 'KeyC') game.view = game.view === 'chase' ? 'cockpit' : 'chase';
      if (code === 'KeyP' || code === 'Escape') game.mode = 'pause';
    } else if (game.mode === 'pause') {
      if (code === 'KeyP' || code === 'Escape') game.mode = 'play';
      if (code === 'KeyM') game.mode = 'title';
    } else if (game.mode === 'debrief') {
      if (code === 'Enter') startMission(game.selected);
      if (code === 'KeyM') game.mode = 'title';
    }
  }
}

const STEP = 1 / 60;
let last = performance.now(), acc = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.time += dt;
  handleKeys();
  if (game.mode === 'play') {
    acc += dt;
    while (acc >= STEP) {
      const a = game.aircraft;
      stepAircraft(a, input.read(STEP), STEP, terrain);
      updateMission(game.run, a, STEP);
      if (game.run.chime) { audio.chime(); game.run.chime = false; }
      if (a.state === 'crashed' && !game.run.crunched) { audio.crunch(); game.run.crunched = true; }
      acc -= STEP;
    }
    game.prop += dt * (10 + game.aircraft.throttle * 40);
    if (game.run.result) {
      game.mode = 'debrief';
      if (game.run.result === 'success' && game.run.score > (best[game.run.mission.id] ?? 0)) {
        best[game.run.mission.id] = game.run.score;
        localStorage.setItem('tern-best', JSON.stringify(best));
      }
    }
  } else {
    acc = 0;
  }
  if (game.aircraft) audio.update(game.aircraft, game.mode !== 'play');
  render(dt);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- staged screenshots

function stageShot(name) {
  const home = AIRFIELDS[0], cliff = AIRFIELDS[1];
  game.time = 3.2;
  game.prop = 0.7;
  if (name === 'title') { game.mode = 'title'; game.selected = 0; render(0, true); return; }
  if (name === 'cover') {
    startMission(0);
    const run = game.run, ring = run.rings[2];
    run.rings[0].passed = run.rings[1].passed = true;
    run.score = 200;
    run.time = 41;
    const a = game.aircraft;
    Object.assign(a, { x: wrap(ring.x - Math.cos(ring.dir) * 26), y: wrap(ring.y - Math.sin(ring.dir) * 26 + 1.5), z: ring.z + 0.6, yaw: ring.dir + 0.05, pitch: 0.02, roll: 0.32, speed: 8.6, throttle: 0.78, fuel: 0.61 });
  } else if (name === 'cockpit' || name === 'approach') {
    startMission(name === 'cockpit' ? 1 : 2);
    // Both approaches come in from the sea side (+dir end): Kestrel has a ridge off its west end.
    const f = name === 'cockpit' ? cliff : home;
    const back = name === 'cockpit' ? 42 : 58;
    const a = game.aircraft;
    const dist = f.half + back;
    Object.assign(a, {
      x: wrap(f.x + Math.cos(f.dir) * dist + Math.sin(f.dir) * 1.2), y: wrap(f.y + Math.sin(f.dir) * dist - Math.cos(f.dir) * 1.2),
      z: f.elevation + (back + 4) * Math.tan((3.5 * Math.PI) / 180) + 0.4, yaw: f.dir + Math.PI + 0.02, pitch: -0.05, roll: -0.06,
      speed: 6.6, throttle: 0.32, fuel: name === 'cockpit' ? 0.11 : 0.38, onGround: false, airborneTime: 200,
    });
    if (name === 'approach') { game.run.beacons.forEach((b) => (b.visited = true)); game.run.score = 600; game.run.time = 388; }
    else game.run.time = 352;
    game.view = name === 'cockpit' ? 'cockpit' : 'chase';
  }
  game.mode = 'play';
  render(0, true);
  game.mode = 'shot';
}

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  // A staged frame at exactly 1280x720; its JPEG is left in the DOM for a headless browser to save.
  canvas.width = 1280;
  canvas.height = 720;
  stageShot(shot);
  document.body.dataset.frame = canvas.toDataURL('image/jpeg', 0.86);
  document.body.dataset.ready = 'yes';
} else {
  requestAnimationFrame(frame);
}
