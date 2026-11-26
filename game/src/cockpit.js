// Cockpit view: canopy frame, glare shield and a lit six-pack of round gauges.

import { toFeet, toKnots } from './world.js';
import { compassDeg } from './hud.js';

const FONT = '"Segoe UI", Arial, sans-serif';
const LIT = '#f6f0da', NEEDLE = '#ff9a3c';

function bezel(ctx, x, y, r, title) {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.12);
  g.addColorStop(0, '#1d2226');
  g.addColorStop(0.86, '#0c0f12');
  g.addColorStop(1, '#3a3f45');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,150,0.25)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,220,160,0.08)'; // backlight glow
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `600 ${Math.round(r * 0.16)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = LIT;
  ctx.fillText(title, x, y + r * 0.45);
}

function ticks(ctx, x, y, r, count, from, to, labelEvery, labelFn) {
  for (let i = 0; i <= count; i++) {
    const t = from + ((to - from) * i) / count;
    const major = i % labelEvery === 0;
    ctx.strokeStyle = LIT;
    ctx.lineWidth = major ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(t) * r * 0.92, y + Math.sin(t) * r * 0.92);
    ctx.lineTo(x + Math.cos(t) * r * (major ? 0.76 : 0.83), y + Math.sin(t) * r * (major ? 0.76 : 0.83));
    ctx.stroke();
    if (major && labelFn) {
      ctx.fillStyle = LIT;
      ctx.font = `500 ${Math.round(r * 0.15)}px ${FONT}`;
      ctx.fillText(labelFn(i), x + Math.cos(t) * r * 0.6, y + Math.sin(t) * r * 0.6);
    }
  }
}

function needle(ctx, x, y, r, angle, len = 0.78, color = NEEDLE) {
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(angle) * r * 0.12, y - Math.sin(angle) * r * 0.12);
  ctx.lineTo(x + Math.cos(angle) * r * len, y + Math.sin(angle) * r * len);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#d8d2c0';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

const START = Math.PI * 0.75, SWEEP = Math.PI * 1.5;

function airspeed(ctx, x, y, r, kt) {
  bezel(ctx, x, y, r, 'KNOTS');
  ticks(ctx, x, y, r, 24, START, START + SWEEP, 4, (i) => String(i * 10));
  ctx.strokeStyle = '#3fbf5f'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(x, y, r * 0.95, START + SWEEP * (90 / 240), START + SWEEP * (190 / 240)); ctx.stroke();
  needle(ctx, x, y, r, START + SWEEP * Math.min(1, kt / 240));
}

function attitude(ctx, x, y, r, pitch, roll) {
  bezel(ctx, x, y, r, '');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-roll);
  const off = pitch * r * 1.4;
  ctx.fillStyle = '#2f7fc4';
  ctx.fillRect(-r, -r * 2 + off, r * 2, r * 2);
  ctx.fillStyle = '#8a5a2e';
  ctx.fillRect(-r, off, r * 2, r * 2);
  ctx.strokeStyle = LIT;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-r, off); ctx.lineTo(r, off); ctx.stroke();
  for (const p of [-0.35, -0.17, 0.17, 0.35]) {
    ctx.beginPath(); ctx.moveTo(-r * 0.2, off - p * r * 1.4); ctx.lineTo(r * 0.2, off - p * r * 1.4); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = NEEDLE;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y); ctx.lineTo(x - r * 0.15, y); ctx.lineTo(x, y + r * 0.1); ctx.lineTo(x + r * 0.15, y); ctx.lineTo(x + r * 0.5, y);
  ctx.stroke();
}

function altimeter(ctx, x, y, r, ft) {
  bezel(ctx, x, y, r, 'ALT FT');
  ticks(ctx, x, y, r, 50, -Math.PI / 2, Math.PI * 1.5, 5, (i) => String((i / 5) % 10));
  needle(ctx, x, y, r, -Math.PI / 2 + ((ft % 1000) / 1000) * Math.PI * 2);
  needle(ctx, x, y, r, -Math.PI / 2 + ((ft % 10000) / 10000) * Math.PI * 2, 0.5, '#e8e2cc');
}

function headingDial(ctx, x, y, r, hdg) {
  bezel(ctx, x, y, r, '');
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((-hdg * Math.PI) / 180);
  for (let d = 0; d < 360; d += 10) {
    const t = (d * Math.PI) / 180 - Math.PI / 2;
    ctx.strokeStyle = LIT;
    ctx.lineWidth = d % 30 === 0 ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(t) * r * 0.9, Math.sin(t) * r * 0.9);
    ctx.lineTo(Math.cos(t) * r * (d % 30 === 0 ? 0.74 : 0.82), Math.sin(t) * r * (d % 30 === 0 ? 0.74 : 0.82));
    ctx.stroke();
    if (d % 30 === 0) {
      ctx.save();
      ctx.translate(Math.cos(t) * r * 0.6, Math.sin(t) * r * 0.6);
      ctx.rotate(t + Math.PI / 2);
      ctx.fillStyle = LIT;
      ctx.font = `600 ${Math.round(r * 0.16)}px ${FONT}`;
      ctx.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] ?? String(d / 10), 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
  ctx.fillStyle = NEEDLE;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.45); ctx.lineTo(x - r * 0.12, y + r * 0.2); ctx.lineTo(x + r * 0.12, y + r * 0.2);
  ctx.fill();
}

function vsi(ctx, x, y, r, fpm) {
  bezel(ctx, x, y, r, 'VS ×100');
  ticks(ctx, x, y, r, 20, Math.PI, Math.PI * 3, 5, (i) => String(Math.abs((i - 10) * 4)));
  const t = Math.max(-1, Math.min(1, fpm / 4000));
  needle(ctx, x, y, r, Math.PI + (t + 1) * Math.PI);
}

function fuelGauge(ctx, x, y, r, fuel, throttle) {
  bezel(ctx, x, y, r, 'FUEL');
  ticks(ctx, x, y, r, 8, Math.PI * 1.15, Math.PI * 1.85, 4, (i) => ['E', '½', 'F'][i / 4]);
  needle(ctx, x, y, r, Math.PI * 1.15 + Math.PI * 0.7 * fuel, 0.78, fuel < 0.15 ? '#ff5a4a' : NEEDLE);
  ctx.fillStyle = LIT;
  ctx.font = `600 ${Math.round(r * 0.15)}px ${FONT}`;
  ctx.fillText(`THR ${Math.round(throttle * 100)}%`, x, y + r * 0.7);
}

/** Draw the cockpit over the rendered world. */
export function drawCockpit(ctx, w, h, a, warnings) {
  const top = h * 0.66;
  // canopy frame
  ctx.fillStyle = '#1b1f24';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w * 0.07, 0); ctx.lineTo(w * 0.16, top); ctx.lineTo(0, top);
  ctx.moveTo(w, 0); ctx.lineTo(w * 0.93, 0); ctx.lineTo(w * 0.84, top); ctx.lineTo(w, top);
  ctx.fill();
  ctx.fillRect(0, 0, w, 16);
  ctx.fillRect(w / 2 - 6, 0, 12, top * 0.12);
  // glare shield and panel
  const g = ctx.createLinearGradient(0, top - 30, 0, h);
  g.addColorStop(0, '#20252b');
  g.addColorStop(0.12, '#2c3238');
  g.addColorStop(1, '#16191d');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, top + 10);
  ctx.quadraticCurveTo(w / 2, top - 40, w, top + 10);
  ctx.lineTo(w, h); ctx.lineTo(0, h);
  ctx.fill();
  const r = Math.min(w / 16, (h - top) / 2.6);
  const cy = top + (h - top) * 0.55;
  const cols = [w * 0.2, w * 0.32, w * 0.44, w * 0.56, w * 0.68, w * 0.8];
  airspeed(ctx, cols[0], cy, r, toKnots(a.speed));
  attitude(ctx, cols[1], cy, r, a.pitch, a.roll);
  altimeter(ctx, cols[2], cy, r, toFeet(a.z));
  headingDial(ctx, cols[3], cy, r, compassDeg(a.yaw));
  vsi(ctx, cols[4], cy, r, a.vs * 10 * 196.85);
  fuelGauge(ctx, cols[5], cy, r, a.fuel, a.throttle);
  // annunciator lights
  const lights = [['STALL', warnings.stall], ['LOW FUEL', warnings.fuel], ['GEAR DMG', warnings.damage], ['BRAKE', warnings.brake]];
  lights.forEach(([label, on], i) => {
    const x = w * 0.08, y = top + 40 + i * 34;
    ctx.fillStyle = on ? '#ff5240' : '#3a2220';
    if (on) { ctx.shadowColor = '#ff5240'; ctx.shadowBlur = 14; }
    ctx.fillRect(x - 46, y - 12, 92, 24);
    ctx.shadowBlur = 0;
    ctx.fillStyle = on ? '#fff2e8' : '#7a5a55';
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 1);
  });
}
