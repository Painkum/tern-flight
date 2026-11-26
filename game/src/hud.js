// Head-up display for the chase view: speed and altitude tapes, heading tape, pitch ladder,
// throttle, fuel and damage, the mission panel and the steering cue.

import { toFeet, toKnots, wrapDelta } from './world.js';

const GREEN = '#7dffb0', AMBER = '#ffc861', RED = '#ff6a5a';
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

export function compassDeg(yaw) {
  return ((((yaw * 180) / Math.PI + 90) % 360) + 360) % 360;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,16,24,0.55)';
  ctx.strokeStyle = 'rgba(125,255,176,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function glowText(ctx, text, x, y, size, color, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

/** A vertical tape (speed on the left, altitude on the right) with its boxed readout. */
function tape(ctx, x, cy, value, step, label, side, warn) {
  const h = 260, w = 74, pxPer = 60 / step;
  panel(ctx, x - w / 2, cy - h / 2, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - w / 2, cy - h / 2, w, h);
  ctx.clip();
  const first = Math.floor((value - (h / 2) / pxPer) / step) * step;
  for (let v = first; v < value + (h / 2) / pxPer + step; v += step / 2) {
    const y = cy - (v - value) * pxPer;
    const major = Math.round(v / step) * step === v;
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const tx = side < 0 ? x + w / 2 : x - w / 2;
    ctx.moveTo(tx, y);
    ctx.lineTo(tx + side * -(major ? 14 : 7), y);
    ctx.stroke();
    if (major && v >= 0) glowText(ctx, String(Math.round(v)), x + side * 6, y, 13, GREEN, 'center', 500);
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeStyle = warn ? RED : GREEN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - w / 2 - 6, cy - 17, w + 12, 34, 5);
  ctx.fill();
  ctx.stroke();
  glowText(ctx, String(Math.round(value)), x, cy, 20, warn ? RED : GREEN, 'center', 700);
  glowText(ctx, label, x, cy - h / 2 - 14, 13, GREEN, 'center');
}

function headingTape(ctx, cx, y, heading) {
  const w = 420, pxPer = 4;
  panel(ctx, cx - w / 2, y - 18, w, 40);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, y - 18, w, 40);
  ctx.clip();
  for (let d = Math.floor((heading - 60) / 5) * 5; d <= heading + 60; d += 5) {
    const x = cx + wrapAngle(d - heading) * pxPer;
    const n = ((d % 360) + 360) % 360;
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 22);
    ctx.lineTo(x, y + (n % 10 === 0 ? 10 : 15));
    ctx.stroke();
    if (n % 30 === 0) {
      const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[n] ?? String(n / 10).padStart(2, '0');
      glowText(ctx, label, x, y - 3, 14, GREEN, 'center', 700);
    }
  }
  ctx.restore();
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.moveTo(cx, y + 24);
  ctx.lineTo(cx - 7, y + 33);
  ctx.lineTo(cx + 7, y + 33);
  ctx.fill();
  glowText(ctx, `HDG ${String(Math.round(heading) % 360).padStart(3, '0')}°`, cx, y + 46, 15, GREEN, 'center', 700);
}

function wrapAngle(d) {
  return ((((d + 180) % 360) + 360) % 360) - 180;
}

function pitchLadder(ctx, cx, cy, pitch, roll, focal) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  ctx.strokeStyle = 'rgba(125,255,176,0.8)';
  ctx.lineWidth = 2;
  const deg = (pitch * 180) / Math.PI;
  for (let p = -30; p <= 30; p += 10) {
    const y = (deg - p) * focal * 0.012;
    if (Math.abs(y) > 170) continue;
    ctx.setLineDash(p < 0 ? [8, 6] : []);
    ctx.beginPath();
    ctx.moveTo(-110, y); ctx.lineTo(-40, y);
    ctx.moveTo(40, y); ctx.lineTo(110, y);
    ctx.stroke();
    if (p !== 0) glowText(ctx, String(p), 124, y, 12, GREEN, 'left', 500);
  }
  ctx.setLineDash([]);
  ctx.restore();
  // fixed aircraft symbol
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 46, cy); ctx.lineTo(cx - 16, cy); ctx.lineTo(cx - 8, cy + 9);
  ctx.moveTo(cx + 46, cy); ctx.lineTo(cx + 16, cy); ctx.lineTo(cx + 8, cy + 9);
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color, label, value) {
  panel(ctx, x, y, w, h);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillRect(x + 5, y + h - 5 - (h - 10) * frac, w - 10, (h - 10) * frac);
  ctx.shadowBlur = 0;
  glowText(ctx, label, x + w / 2, y - 12, 12, GREEN, 'center');
  glowText(ctx, value, x + w / 2, y + h + 13, 13, color, 'center', 700);
}

/** Draw the chase-view HUD. */
export function drawHud(ctx, w, h, a, run, objective, opts) {
  const kt = toKnots(a.speed), ft = toFeet(a.z), heading = compassDeg(a.yaw);
  const agl = toFeet(a.z - opts.ground);
  pitchLadder(ctx, w / 2, h / 2, a.pitch, a.roll, opts.focal);
  tape(ctx, 120, h / 2, kt, 20, 'KT', -1, a.stalled || kt < 95);
  tape(ctx, w - 120, h / 2, ft, 200, 'FT', 1, agl < 150 && !a.onGround);
  headingTape(ctx, w / 2, 34, heading);
  glowText(ctx, `VS ${Math.round(a.vs * 10 * 196.85)} fpm`, w - 120, h / 2 - 170, 13, GREEN, 'center');
  glowText(ctx, `AGL ${Math.round(agl)} ft`, w - 120, h / 2 - 190, 13, agl < 150 ? AMBER : GREEN, 'center');
  glowText(ctx, `G ${a.gForce.toFixed(1)}`, 120, h / 2 - 170, 13, GREEN, 'center');

  bar(ctx, 40, h - 190, 30, 140, a.throttle, GREEN, 'THR', `${Math.round(a.throttle * 100)}%`);
  bar(ctx, 90, h - 190, 30, 140, a.fuel, a.fuel < 0.15 ? RED : AMBER, 'FUEL', `${Math.round(a.fuel * 100)}%`);
  bar(ctx, 140, h - 190, 30, 140, 1 - a.damage, a.damage > 0.5 ? RED : GREEN, 'HULL', `${Math.round((1 - a.damage) * 100)}%`);

  // Mission panel
  const m = run.mission;
  panel(ctx, 20, 20, 300, 96);
  glowText(ctx, m.name.toUpperCase(), 34, 40, 15, AMBER, 'left', 700);
  const left = Math.max(0, m.timeLimit - run.time);
  glowText(ctx, `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, 306, 40, 15, left < 30 ? RED : GREEN, 'right', 700);
  let progress = '';
  if (m.id === 'rings') progress = `Rings ${run.rings.filter((r) => r.passed).length}/10`;
  else if (m.id === 'patrol') progress = `Beacons ${run.beacons.filter((b) => b.visited).length}/4`;
  else progress = 'Deliver to Gannet Point';
  glowText(ctx, progress, 34, 66, 14, GREEN);
  glowText(ctx, `Next: ${objective.label}  ${Math.round(objective.dist * 10 / 1852 * 10) / 10} nm`, 34, 92, 14, GREEN);
  glowText(ctx, `Score ${run.score}`, 306, 66, 14, GREEN, 'right');

  // Steering cue toward the objective
  const bearing = (Math.atan2(wrapDelta(objective.y, a.y), wrapDelta(objective.x, a.x)) * 180) / Math.PI + 90;
  const rel = wrapAngle(bearing - heading);
  const cueX = w / 2 + Math.max(-200, Math.min(200, rel * 4));
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cueX, 88); ctx.lineTo(cueX - 8, 100); ctx.lineTo(cueX + 8, 100);
  ctx.fill();

  if (a.stalled) glowText(ctx, 'STALL', w / 2, h / 2 + 90, 30, RED, 'center', 800);
  else if (a.fuel <= 0) glowText(ctx, 'ENGINE OUT: GLIDE', w / 2, h / 2 + 90, 26, RED, 'center', 800);
  else if (a.fuel < 0.12) glowText(ctx, 'LOW FUEL', w / 2, h / 2 + 90, 22, AMBER, 'center', 800);
  if (objective.field && opts.approach) drawApproach(ctx, w, h, opts.approach);
}

/** Glide-slope and centreline guidance on final approach. */
function drawApproach(ctx, w, h, ap) {
  panel(ctx, w / 2 - 120, h - 98, 240, 74);
  glowText(ctx, 'APPROACH', w / 2, h - 84, 12, AMBER, 'center', 700);
  const gx = w / 2 + Math.max(-90, Math.min(90, ap.lateral * 9));
  const gy = h - 54 + Math.max(-22, Math.min(22, ap.slopeError * 3));
  ctx.strokeStyle = 'rgba(125,255,176,0.6)';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 100, h - 54); ctx.lineTo(w / 2 + 100, h - 54);
  ctx.moveTo(w / 2, h - 78); ctx.lineTo(w / 2, h - 30);
  ctx.stroke();
  ctx.fillStyle = Math.abs(ap.lateral) < 2 && Math.abs(ap.slopeError) < 3 ? GREEN : AMBER;
  ctx.beginPath();
  ctx.arc(gx, gy, 7, 0, Math.PI * 2);
  ctx.fill();
}
