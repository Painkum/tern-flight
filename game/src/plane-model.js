// The Tern's low-poly 3D model, flat-shaded and drawn with the painter's algorithm in the chase view.
// Body frame: x forward, y right, z up, in metres.

const CREAM = [236, 228, 206], RED = [196, 52, 44], DARK = [52, 56, 64], GLASS = [120, 176, 212], GREY = [150, 154, 160];

function quad(a, b, c, d, color) { return { pts: [a, b, c, d], color }; }
function tri(a, b, c, color) { return { pts: [a, b, c], color }; }

/** Fuselage cross-sections from nose to tail: station x, half width, top z, bottom z. */
const STATIONS = [
  [3.1, 0.35, 0.35, -0.35], [2.4, 0.62, 0.62, -0.55], [0.6, 0.7, 0.75, -0.6],
  [-1.6, 0.55, 0.6, -0.45], [-4.6, 0.18, 0.35, 0.05],
];

function buildModel() {
  const faces = [];
  for (let i = 0; i < STATIONS.length - 1; i++) {
    const [x0, w0, t0, b0] = STATIONS[i], [x1, w1, t1, b1] = STATIONS[i + 1];
    const ring0 = [[x0, 0, t0], [x0, w0, (t0 + b0) / 2 + 0.15], [x0, w0 * 0.8, b0], [x0, -w0 * 0.8, b0], [x0, -w0, (t0 + b0) / 2 + 0.15]];
    const ring1 = [[x1, 0, t1], [x1, w1, (t1 + b1) / 2 + 0.15], [x1, w1 * 0.8, b1], [x1, -w1 * 0.8, b1], [x1, -w1, (t1 + b1) / 2 + 0.15]];
    for (let k = 0; k < 5; k++) {
      const n = (k + 1) % 5;
      const stripe = i === 2 && (k === 1 || k === 4);
      faces.push(quad(ring0[k], ring0[n], ring1[n], ring1[k], stripe ? RED : CREAM));
    }
  }
  faces.push({ pts: STATIONS[0].length && [[3.1, 0, 0.35], [3.1, 0.35, 0.1], [3.1, 0.28, -0.35], [3.1, -0.28, -0.35], [3.1, -0.35, 0.1]], color: DARK });
  // Canopy
  faces.push(quad([1.9, -0.5, 0.65], [1.9, 0.5, 0.65], [0.2, 0.45, 1.15], [0.2, -0.45, 1.15], GLASS));
  faces.push(tri([0.2, 0.45, 1.15], [0.2, -0.45, 1.15], [-1.2, 0, 0.62], GLASS));
  faces.push(tri([1.9, 0.5, 0.65], [0.2, 0.45, 1.15], [0.6, 0.7, 0.75], GLASS));
  faces.push(tri([1.9, -0.5, 0.65], [0.2, -0.45, 1.15], [0.6, -0.7, 0.75], GLASS));
  // Wings (high wing), with red tips
  for (const side of [1, -1]) {
    faces.push(quad([1.4, 0.6 * side, 0.8], [1.3, 4.6 * side, 0.95], [-0.2, 4.6 * side, 0.95], [-0.3, 0.6 * side, 0.8], CREAM));
    faces.push(quad([1.3, 4.6 * side, 0.95], [1.25, 5.6 * side, 1.0], [-0.15, 5.6 * side, 1.0], [-0.2, 4.6 * side, 0.95], RED));
    faces.push(quad([-3.9, 0.15 * side, 0.25], [-3.95, 2.1 * side, 0.3], [-4.7, 2.0 * side, 0.3], [-4.7, 0.15 * side, 0.25], CREAM));
    faces.push(quad([0.9, 0.55 * side, -0.4], [0.7, 1.1 * side, -1.15], [0.5, 1.1 * side, -1.15], [0.6, 0.55 * side, -0.45], DARK)); // gear leg
  }
  faces.push(quad([-3.4, 0, 0.4], [-4.1, 0, 1.9], [-4.75, 0, 1.95], [-4.7, 0, 0.35], RED)); // fin
  return faces;
}

const MODEL = buildModel();

function rotate([x, y, z], roll, pitch, yaw) {
  // roll about x, then pitch about y, then yaw about z
  let cy = Math.cos(roll), sy = Math.sin(roll);
  let y1 = y * cy - z * sy, z1 = y * sy + z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  let x2 = x * cp - z1 * sp, z2 = x * sp + z1 * cp;
  const cw = Math.cos(yaw), sw = Math.sin(yaw);
  return [x2 * cw - y1 * sw, x2 * sw + y1 * cw, z2];
}

/**
 * Draw the aircraft at screen (cx, cy) as seen from behind and `elev` radians above, with its
 * attitude relative to the camera. `size` is the screen scale; `prop` is the propeller angle.
 */
export function drawPlane(ctx, { cx, cy, size, roll, pitch, yaw, elev, prop, throttle, damage }) {
  const light = norm([0.4, 0.5, 0.75]);
  const viewDist = 18;
  const project = (p) => {
    const [x, y, z] = rotate(p, roll, pitch, yaw);
    // camera behind (-x) and above: tilt the scene down by elev
    const ce = Math.cos(elev), se = Math.sin(elev);
    const depth = x * ce + z * se;         // toward the camera's forward axis
    const up = -x * se + z * ce;
    const k = size / (viewDist + depth);
    return { sx: cx + y * k, sy: cy - up * k, depth, world: [x, y, z] };
  };
  const drawn = MODEL.map((f) => {
    const ps = f.pts.map(project);
    const avg = ps.reduce((s, p) => s + p.depth, 0) / ps.length;
    const n = faceNormal(ps.map((p) => p.world));
    const shade = 0.55 + 0.45 * Math.abs(dot(n, light));
    return { ps, avg, color: f.color, shade };
  });
  drawn.sort((a, b) => b.avg - a.avg);
  ctx.save();
  ctx.lineJoin = 'round';
  for (const f of drawn) {
    const [r, g, b] = f.color;
    const s = f.shade * (1 - damage * 0.35);
    ctx.fillStyle = `rgb(${(r * s) | 0},${(g * s) | 0},${(b * s) | 0})`;
    ctx.strokeStyle = 'rgba(20,20,24,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    f.ps.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Propeller disc and blades at the nose
  const hub = project([3.25, 0, 0]);
  const discR = (1.25 * size) / (viewDist + hub.depth);
  ctx.fillStyle = `rgba(210,210,210,${0.12 + throttle * 0.12})`;
  ctx.beginPath();
  ctx.ellipse(hub.sx, hub.sy, discR, discR, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,40,40,0.8)';
  ctx.lineWidth = 2;
  for (const off of [0, Math.PI]) {
    const t = prop + off;
    ctx.beginPath();
    ctx.moveTo(hub.sx, hub.sy);
    ctx.lineTo(hub.sx + Math.cos(t) * discR, hub.sy + Math.sin(t) * discR);
    ctx.stroke();
  }
  if (damage > 0.5) {
    ctx.fillStyle = 'rgba(60,60,60,0.45)';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(hub.sx - 8 - i * 9, hub.sy - 6 - i * 7, 5 + i * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function faceNormal([a, b, c]) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return norm([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
}
function norm(v) { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
