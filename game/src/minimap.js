// Moving map: a north-up chart of the area around the aircraft with fields, rings and beacons.

import { AIRFIELDS, MAP, wrapDelta } from './world.js';

export function createMinimap(terrain) {
  const size = 256;
  const chart = document.createElement('canvas');
  chart.width = chart.height = size;
  const cctx = chart.getContext('2d');
  const img = cctx.createImageData(size, size);
  const px = new Uint32Array(img.data.buffer);
  const step = MAP / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) px[y * size + x] = terrain.color[(y * step) * MAP + x * step];
  cctx.putImageData(img, 0, 0);

  /** Draw the map in a circle of radius r centred on (cx, cy); range is world units shown edge to centre. */
  function draw(ctx, cx, cy, r, a, run, range = 160) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0a1418';
    ctx.fill();
    ctx.clip();
    const scale = r / range;              // screen px per world unit
    const chartScale = scale * step;      // screen px per chart px
    ctx.imageSmoothingEnabled = true;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        ctx.drawImage(chart, cx - (a.x - ox * MAP) * scale, cy - (a.y - oy * MAP) * scale, size * chartScale, size * chartScale);
      }
    }
    const at = (x, y) => [cx + wrapDelta(x, a.x) * scale, cy + wrapDelta(y, a.y) * scale];
    for (const f of AIRFIELDS) {
      const [x, y] = at(f.x, f.y);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(f.dir) * f.half * scale, y - Math.sin(f.dir) * f.half * scale);
      ctx.lineTo(x + Math.cos(f.dir) * f.half * scale, y + Math.sin(f.dir) * f.half * scale);
      ctx.stroke();
    }
    for (const ring of run.rings) {
      const [x, y] = at(ring.x, ring.y);
      ctx.fillStyle = ring.passed ? '#7dffb0' : '#ffd23a';
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const b of run.beacons) {
      const [x, y] = at(b.x, b.y);
      ctx.fillStyle = b.visited ? '#7dffb0' : '#ff7a4a';
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(125,255,176,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a.yaw + Math.PI / 2);
    ctx.fillStyle = '#ffc861';
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#7dffb0';
    ctx.font = '700 12px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - r + 12);
  }

  return { draw };
}
