// Things in the world drawn over the terrain: gold rings, lighthouse beacons, runway edge
// lights and the aircraft's shadow. All use the renderer's projection so they sit in the scene.

import { AIRFIELDS } from './world.js';

/** A ring as a thick gold ellipse: its disc faces along ring.dir. */
function drawRing(r3d, ctx, ring, next) {
  const pts = [];
  const nx = -Math.sin(ring.dir), ny = Math.cos(ring.dir); // ring plane: lateral + up
  for (let k = 0; k <= 28; k++) {
    const t = (k / 28) * Math.PI * 2;
    const p = r3d.project(ring.x + nx * Math.cos(t) * ring.radius, ring.y + ny * Math.cos(t) * ring.radius, ring.z + Math.sin(t) * ring.radius);
    if (!p) return;
    pts.push(p);
  }
  if (r3d.occluded(ring.x, ring.y, ring.z)) return;
  const width = Math.max(1.5, pts[0].scale * 0.7);
  ctx.lineWidth = width * 1.8;
  ctx.strokeStyle = 'rgba(60,30,0,0.35)';
  path(ctx, pts);
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = ring.passed ? 'rgba(120,255,160,0.55)' : next ? '#ffd23a' : '#e0a92a';
  if (next) { ctx.shadowColor = '#ffd23a'; ctx.shadowBlur = 16; }
  path(ctx, pts);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function path(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}

function drawBeacon(r3d, ctx, b, time) {
  const base = r3d.project(b.x, b.y, b.z);
  const top = r3d.project(b.x, b.y, b.z + 6);
  if (!base || !top || r3d.occluded(b.x, b.y, b.z + 3)) return;
  const w = Math.max(2, base.scale * 1.3);
  ctx.fillStyle = '#f2efe6';
  ctx.fillRect(base.x - w / 2, top.y, w, base.y - top.y);
  ctx.fillStyle = '#c83a2e';
  for (let k = 1; k < 4; k += 2) ctx.fillRect(base.x - w / 2, top.y + ((base.y - top.y) * k) / 4, w, (base.y - top.y) / 4);
  const pulse = b.visited ? 0.25 : 0.6 + 0.4 * Math.sin(time * 4);
  const g = ctx.createRadialGradient(top.x, top.y, 0, top.x, top.y, w * 6);
  g.addColorStop(0, `rgba(255,240,170,${pulse})`);
  g.addColorStop(1, 'rgba(255,240,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(top.x - w * 6, top.y - w * 6, w * 12, w * 12);
  if (!b.visited) {
    const sky = r3d.project(b.x, b.y, b.z + 60);
    if (sky) {
      ctx.strokeStyle = 'rgba(255,230,120,0.35)';
      ctx.lineWidth = Math.max(1, w * 0.6);
      ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(sky.x, sky.y); ctx.stroke();
    }
  }
}

function drawRunwayLights(r3d, ctx) {
  for (const f of AIRFIELDS) {
    const c = Math.cos(f.dir), s = Math.sin(f.dir);
    for (let k = -f.half; k <= f.half; k += 6) {
      for (const side of [-1, 1]) {
        const x = f.x + c * k - s * side * (f.width + 0.6), y = f.y + s * k + c * side * (f.width + 0.6);
        const p = r3d.project(x, y, f.elevation + 0.3);
        if (!p || p.dist > 260 || p.dist < 2) continue;
        const end = Math.abs(k) > f.half - 6;
        ctx.fillStyle = end ? '#ff5a3a' : '#fff3c0';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.min(3, Math.max(1, p.scale * 0.2)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawShadow(r3d, ctx, a, ground) {
  const p = r3d.project(a.x, a.y, ground);
  if (!p) return;
  const size = p.scale * 0.55;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, size, size * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw the mission's objects into the renderer's own canvas (before it is rolled and presented). */
export function drawSceneObjects(r3d, run, a, ground, time) {
  const ctx = r3d.ctx;
  drawRunwayLights(r3d, ctx);
  const nextRing = run.rings.find((r) => !r.passed);
  const rings = [...run.rings].sort((p, q) => dist(q, a) - dist(p, a));
  for (const ring of rings) drawRing(r3d, ctx, ring, ring === nextRing);
  for (const b of run.beacons) drawBeacon(r3d, ctx, b, time);
  drawShadow(r3d, ctx, a, ground);
}

function dist(p, a) {
  return Math.hypot(p.x - a.x, p.y - a.y);
}
