// Title (mission select), pause and debrief screens, drawn over the live world.

import { MISSIONS } from './missions.js';

const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

function card(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,18,28,0.78)';
  ctx.strokeStyle = 'rgba(255,200,97,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
}

function text(ctx, s, x, y, size, color, align = 'left', weight = 500) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function wrapText(ctx, s, x, y, maxW, lineH, size, color) {
  ctx.font = `400 ${size}px ${FONT}`;
  let line = '';
  for (const word of s.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (ctx.measureText(t).width > maxW && line) { text(ctx, line, x, y, size, color, 'left', 400); y += lineH; line = word; }
    else line = t;
  }
  text(ctx, line, x, y, size, color, 'left', 400);
  return y + lineH;
}

export function drawTitle(ctx, w, h, selected, best) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(6,12,24,0.55)');
  g.addColorStop(0.5, 'rgba(6,12,24,0.1)');
  g.addColorStop(1, 'rgba(6,12,24,0.65)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  text(ctx, 'TERN', w / 2, h * 0.16, 92, '#fff3dc', 'center', 800);
  ctx.shadowBlur = 0;
  text(ctx, 'BUSH FLYING OVER THE TESSEL ISLES', w / 2, h * 0.16 + 62, 18, '#ffc861', 'center', 700);
  const cw = Math.min(330, (w - 120) / 3), ch = 210, top = h * 0.36;
  MISSIONS.forEach((m, i) => {
    const x = w / 2 - (cw * 3 + 40) / 2 + i * (cw + 20);
    card(ctx, x, top, cw, ch);
    if (i === selected) {
      ctx.strokeStyle = '#ffd23a';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffd23a';
      ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.roundRect(x, top, cw, ch, 14); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    text(ctx, `${i + 1}`, x + 22, top + 30, 26, '#ffc861', 'left', 800);
    text(ctx, m.name, x + 52, top + 30, 22, '#fff3dc', 'left', 700);
    wrapText(ctx, m.brief, x + 22, top + 68, cw - 44, 21, 15, '#d6dde4');
    text(ctx, `Fuel ${Math.round(m.fuel * 100)}%  ·  ${Math.round(m.timeLimit / 60)} min`, x + 22, top + ch - 46, 14, '#7dffb0', 'left', 600);
    text(ctx, best[m.id] ? `Best ${best[m.id]}` : 'Not flown yet', x + 22, top + ch - 22, 14, '#9aa8b4', 'left', 500);
  });
  card(ctx, w / 2 - 330, h - 150, 660, 110);
  text(ctx, 'W/S pitch · A/D bank · Q/E rudder · Shift/Ctrl throttle · B brakes · C cockpit · P pause', w / 2, h - 122, 15, '#d6dde4', 'center');
  text(ctx, 'Click the screen to fly with the mouse', w / 2, h - 96, 15, '#d6dde4', 'center');
  text(ctx, 'Press 1, 2 or 3 to choose · Enter to take off', w / 2, h - 64, 18, '#ffd23a', 'center', 700);
}

export function drawPause(ctx, w, h) {
  ctx.fillStyle = 'rgba(6,12,24,0.55)';
  ctx.fillRect(0, 0, w, h);
  text(ctx, 'PAUSED', w / 2, h / 2 - 20, 54, '#fff3dc', 'center', 800);
  text(ctx, 'P to resume · M for missions', w / 2, h / 2 + 30, 18, '#ffc861', 'center', 600);
}

export function drawDebrief(ctx, w, h, run, a) {
  ctx.fillStyle = 'rgba(6,12,24,0.5)';
  ctx.fillRect(0, 0, w, h);
  const cw = 520, ch = 330, x = w / 2 - cw / 2, y = h / 2 - ch / 2;
  card(ctx, x, y, cw, ch);
  const ok = run.result === 'success';
  text(ctx, ok ? 'MISSION COMPLETE' : 'MISSION FAILED', w / 2, y + 46, 34, ok ? '#7dffb0' : '#ff6a5a', 'center', 800);
  text(ctx, run.reason, w / 2, y + 88, 18, '#fff3dc', 'center', 600);
  const rows = [
    ['Mission', run.mission.name],
    ['Time', `${Math.floor(run.time / 60)}:${String(Math.floor(run.time % 60)).padStart(2, '0')}`],
    ['Fuel left', `${Math.round(a.fuel * 100)}%`],
    ['Airframe', `${Math.round((1 - a.damage) * 100)}%`],
    ['Score', String(run.score)],
  ];
  rows.forEach(([k, v], i) => {
    text(ctx, k, x + 70, y + 136 + i * 30, 17, '#9aa8b4', 'left', 500);
    text(ctx, v, x + cw - 70, y + 136 + i * 30, 17, '#fff3dc', 'right', 700);
  });
  text(ctx, 'Enter to fly again · M for missions', w / 2, y + ch - 28, 16, '#ffc861', 'center', 700);
}
