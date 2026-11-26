// Voxel-space terrain renderer: draws the islands column by column, front to back, with sky,
// haze and a camera roll applied when the frame is presented. Also projects world points for
// the objects drawn on top (rings, beacons, the aircraft's shadow).

import { MAP } from './world.js';

const FAR = 720;
const FOV = (78 * Math.PI) / 180;

export function createRenderer(terrain, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const pixels = new Uint32Array(image.data.buffer);
  const ybuf = new Float32Array(width);
  const focal = width / 2 / Math.tan(FOV / 2);
  const sky = { top: [38, 92, 168], horizon: [196, 214, 226], haze: [184, 204, 218] };
  let cam = null, horizon = height / 2;

  function skyRow(row) {
    const t = Math.max(0, Math.min(1, (horizon - row) / (height * 0.9)));
    const k = Math.pow(t, 0.7);
    const r = sky.horizon[0] + (sky.top[0] - sky.horizon[0]) * k;
    const g = sky.horizon[1] + (sky.top[1] - sky.horizon[1]) * k;
    const b = sky.horizon[2] + (sky.top[2] - sky.horizon[2]) * k;
    return (255 << 24) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
  }

  /** Render the terrain seen from camera {x, y, z, yaw, pitch}. */
  function draw(camera) {
    cam = camera;
    horizon = height / 2 + Math.tan(camera.pitch) * focal;
    for (let row = 0; row < height; row++) {
      const c = skyRow(row);
      pixels.fill(c, row * width, (row + 1) * width);
    }
    ybuf.fill(height);
    const cos = Math.cos(camera.yaw), sin = Math.sin(camera.yaw);
    const half = Math.tan(FOV / 2);
    const hmap = terrain.height, cmap = terrain.color;
    let dz = 0.35;
    for (let z = 1; z < FAR; z += dz, dz *= 1.011) {
      const fx = camera.x + cos * z, fy = camera.y + sin * z;
      const lx = fx + sin * z * half, ly = fy - cos * z * half;   // left edge of this slice
      const stepX = (-sin * z * half * 2) / width, stepY = (cos * z * half * 2) / width;
      const fog = Math.min(1, Math.pow(z / FAR, 1.6));
      const fr = sky.haze[0] * fog, fg = sky.haze[1] * fog, fb = sky.haze[2] * fog, keep = 1 - fog;
      const inv = focal / z;
      let px = lx, py = ly;
      for (let col = 0; col < width; col++, px += stepX, py += stepY) {
        const ix = ((px | 0) % MAP + MAP) % MAP, iy = ((py | 0) % MAP + MAP) % MAP;
        const i = iy * MAP + ix;
        const top = (camera.z - hmap[i]) * inv + horizon;
        const bottom = ybuf[col];
        if (top >= bottom) continue;
        const c = cmap[i];
        const color = (255 << 24) |
          ((((c >> 16) & 255) * keep + fb) << 16) |
          ((((c >> 8) & 255) * keep + fg) << 8) |
          (((c & 255) * keep + fr) | 0);
        const from = Math.max(0, top | 0), to = Math.min(height, bottom | 0);
        for (let row = from; row < to; row++) pixels[row * width + col] = color;
        ybuf[col] = top;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  /** Screen position of a world point for the last drawn camera, or null when behind it. */
  function project(x, y, z) {
    let dx = x - cam.x, dy = y - cam.y;
    if (dx > MAP / 2) dx -= MAP; if (dx < -MAP / 2) dx += MAP;
    if (dy > MAP / 2) dy -= MAP; if (dy < -MAP / 2) dy += MAP;
    const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
    const fwd = dx * c + dy * s;
    if (fwd < 0.5) return null;
    const lat = -dx * s + dy * c;
    return { x: width / 2 + (lat / fwd) * focal, y: horizon + ((cam.z - z) / fwd) * focal, scale: focal / fwd, dist: fwd };
  }

  /** Whether terrain hides the straight line from the camera to a world point. */
  function occluded(x, y, z) {
    for (let k = 1; k < 24; k++) {
      const t = k / 24;
      const sx = cam.x + wrapD(x - cam.x) * t, sy = cam.y + wrapD(y - cam.y) * t, sz = cam.z + (z - cam.z) * t;
      const ix = ((sx | 0) % MAP + MAP) % MAP, iy = ((sy | 0) % MAP + MAP) % MAP;
      if (terrain.height[iy * MAP + ix] > sz + 0.5) return true;
    }
    return false;
  }

  /** Draw the frame onto the visible canvas, rolled by `roll` radians and scaled to fill it. */
  function present(target, w, h, roll) {
    target.save();
    target.imageSmoothingEnabled = true;
    target.translate(w / 2, h / 2);
    target.rotate(-roll);
    // Scale so the rotated frame still covers every corner of the screen.
    const c = Math.abs(Math.cos(roll)), sn = Math.abs(Math.sin(roll));
    const s = Math.max((w * c + h * sn) / width, (w * sn + h * c) / height);
    target.drawImage(canvas, (-width * s) / 2, (-height * s) / 2, width * s, height * s);
    target.restore();
  }

  /** Map a point from this renderer's canvas to the presented screen (after roll and scale). */
  function toScreen(p, w, h, roll) {
    const c = Math.abs(Math.cos(roll)), sn = Math.abs(Math.sin(roll));
    const s = Math.max((w * c + h * sn) / width, (w * sn + h * c) / height);
    const dx = (p.x - width / 2) * s, dy = (p.y - height / 2) * s;
    const cr = Math.cos(-roll), sr = Math.sin(-roll);
    return { x: w / 2 + dx * cr - dy * sr, y: h / 2 + dx * sr + dy * cr, k: s };
  }

  return { canvas, ctx, draw, project, occluded, present, toScreen, width, height, get horizon() { return horizon; }, focal };
}

function wrapD(d) {
  if (d > MAP / 2) return d - MAP;
  if (d < -MAP / 2) return d + MAP;
  return d;
}
