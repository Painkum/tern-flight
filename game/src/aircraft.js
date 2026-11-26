// The Tern, a light two-seat monoplane: an arcade flight model with real consequences.
// Throttle and drag set speed, climbs bleed it, slow flight stalls, banking turns, fuel burns
// with throttle, and the ground is either a landing or a damage report.

import { sampleHeight } from './terrain.js';
import { AIRFIELDS, onRunway, runwayFrame, wrap } from './world.js';

const G = 0.981;            // gravity in world units / s² (one unit is 10 m)
const THRUST = 1.45;        // full-throttle acceleration
const DRAG = 0.0105;        // drag per speed²
const STALL = 4.4;          // units/s (about 86 kt)
const ROTATE = 5.2;         // speed to lift off
const MAX_PITCH_RATE = 0.9, MAX_ROLL_RATE = 1.7, MAX_YAW_RATE = 0.35;
const FUEL_BURN = 0.003;    // fuel fraction per second at full throttle
const GEAR = 0.35;          // wheel height above the ground

export function createAircraft(start) {
  return {
    x: start.x, y: start.y, z: start.z, yaw: start.yaw, pitch: start.pitch ?? 0, roll: 0,
    speed: start.speed ?? 0, throttle: start.throttle ?? 0, fuel: start.fuel ?? 1, damage: 0,
    vs: 0, onGround: !!start.onGround, stalled: false, engineOut: false, brakes: false,
    state: 'flying', // 'flying' | 'landed' | 'crashed'
    lastEvent: null, gForce: 1, airborneTime: 0,
  };
}

/** Advance the aircraft by dt seconds under the pilot's controls {pitch, roll, yaw, throttle, brake}. */
export function stepAircraft(a, ctl, dt, terrain) {
  if (a.state === 'crashed') return;
  a.throttle = Math.max(0, Math.min(1, a.throttle + ctl.throttle * dt * 0.6));
  a.brakes = ctl.brake;
  a.engineOut = a.fuel <= 0;
  const power = a.engineOut ? 0 : a.throttle * (1 - a.damage * 0.4);
  a.fuel = Math.max(0, a.fuel - FUEL_BURN * (0.15 + a.throttle) * dt);

  // Control authority grows with airspeed: mushy when slow, crisp when fast.
  const authority = Math.min(1, a.speed / 7);
  const lift = Math.min(1.2, (a.speed / STALL) ** 2);
  a.stalled = !a.onGround && a.speed < STALL;

  if (a.onGround) {
    a.roll += (0 - a.roll) * Math.min(1, dt * 6);
    a.yaw += ctl.yaw * 0.6 * dt * Math.min(1, a.speed / 2);
    const wantPitch = a.speed > ROTATE * 0.85 ? Math.max(0, ctl.pitch) * 0.25 : 0;
    a.pitch += (wantPitch - a.pitch) * Math.min(1, dt * 3);
  } else {
    a.roll += ctl.roll * MAX_ROLL_RATE * authority * dt;
    a.roll *= 1 - (ctl.roll === 0 ? 0.6 * dt : 0);          // gentle roll-out when centred
    a.roll = Math.max(-1.35, Math.min(1.35, a.roll));
    a.pitch += ctl.pitch * MAX_PITCH_RATE * authority * Math.cos(a.roll) * dt;
    if (a.stalled) a.pitch -= (0.6 + a.pitch) * dt * 1.2;    // the nose falls through
    a.pitch -= (1 - Math.min(1, lift)) * 0.25 * dt;           // too slow to hold the nose up
    a.pitch = Math.max(-1.3, Math.min(1.3, a.pitch));
    const turn = (G * Math.tan(a.roll)) / Math.max(a.speed, 2) * Math.min(1, lift);
    a.yaw += (turn + ctl.yaw * MAX_YAW_RATE * authority) * dt;
    a.airborneTime += dt;
  }
  a.yaw = ((a.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

  let accel = THRUST * power - DRAG * a.speed * a.speed - G * Math.sin(a.pitch);
  if (a.onGround) accel -= (a.brakes ? 1.6 : 0.12) * Math.sign(a.speed);
  a.speed = Math.max(0, a.speed + accel * dt);

  const cp = Math.cos(a.pitch);
  a.x = wrap(a.x + Math.cos(a.yaw) * cp * a.speed * dt);
  a.y = wrap(a.y + Math.sin(a.yaw) * cp * a.speed * dt);
  let climb = Math.sin(a.pitch) * a.speed;
  if (!a.onGround) climb -= (1 - Math.min(1, lift)) * G * 1.4; // sink when lift is short
  a.vs = climb;
  a.z += climb * dt;
  a.gForce = 1 + Math.abs(ctl.pitch) * authority * 1.5 + (1 / Math.cos(a.roll) - 1);

  const ground = sampleHeight(terrain, a.x, a.y);
  if (a.onGround) {
    a.z = ground + GEAR;
    if (a.speed > ROTATE && a.pitch > 0.06) { a.onGround = false; a.state = 'flying'; event(a, 'Airborne'); }
    if (!fieldUnder(a)) groundDamage(a, dt);
    if (a.speed < 0.15 && a.state === 'flying' && a.airborneTime > 3) { a.state = 'landed'; event(a, 'Stopped on the runway'); }
  } else if (a.z <= ground + GEAR) {
    touchDown(a, ground);
  }
}

function fieldUnder(a) {
  return AIRFIELDS.find((f) => onRunway(f, a.x, a.y)) ?? null;
}

/** First contact with the ground: a landing, a hard landing or a crash. */
function touchDown(a, ground) {
  const field = fieldUnder(a);
  const sink = -a.vs;
  const gentle = sink < 1.3 && Math.abs(a.roll) < 0.2 && a.pitch > -0.22 && a.speed < 8.5;
  if (field && gentle) {
    a.onGround = true; a.z = ground + GEAR; a.pitch = Math.max(0, a.pitch * 0.3); a.roll = 0;
    const along = runwayFrame(field, a.x, a.y).across;
    event(a, sink < 0.6 ? `Butter! Touchdown at ${field.name}` : `Firm touchdown at ${field.name}`, Math.abs(along));
  } else if (field && sink < 2.6 && Math.abs(a.roll) < 0.45) {
    a.onGround = true; a.z = ground + GEAR; a.pitch = 0; a.roll = 0;
    a.damage = Math.min(1, a.damage + 0.3);
    event(a, 'Hard landing: gear damaged');
  } else {
    a.state = 'crashed'; a.z = ground + GEAR; a.speed = 0; a.damage = 1;
    event(a, field ? 'Crashed on the runway' : 'Crashed into the terrain');
  }
}

function groundDamage(a, dt) {
  if (a.speed > 1.5) a.damage = Math.min(1, a.damage + dt * 0.25);
  if (a.damage >= 1) { a.state = 'crashed'; event(a, 'Ran off the runway and broke up'); }
}

function event(a, text, value) {
  a.lastEvent = { text, value, at: performance.now() };
}
