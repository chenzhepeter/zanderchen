// 全球海图（参考图，不能点击直航）：已探明处画出海岸线与港口，未探明处是空白羊皮纸。
// 另提供小航海图（minimap）用于在航行视野里显示大致位置。
import { state } from './state.js';
import { PORTS, NATIONS } from './data/ports.js';
import { LAND_RINGS, project, VIEW_W, VIEW_H } from './geo.js';
import { eachCell, CELL, exploredRatio } from './fog.js';

let canvas, ctx, raf = 0, C = null;

export function openChart() {
  canvas = document.getElementById('cchart');
  ctx = canvas.getContext('2d');
  C = { k: 1, tx: 0, ty: 0, drag: null };
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  centerOnShip();
  loop();
}
export function closeChart() {
  cancelAnimationFrame(raf);
  if (!canvas) return;
  canvas.removeEventListener('wheel', onWheel);
  canvas.removeEventListener('pointerdown', onDown);
  canvas.removeEventListener('pointermove', onMove);
  canvas.removeEventListener('pointerup', onUp);
  window.removeEventListener('resize', resize);
  C = null;
}

function resize() {
  if (!canvas) return;
  const wrap = canvas.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(wrap.clientWidth * dpr);
  canvas.height = Math.round(wrap.clientHeight * dpr);
  canvas.style.width = wrap.clientWidth + 'px';
  canvas.style.height = wrap.clientHeight + 'px';
}

function baseScale() { return Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H); }
function centerOnShip() {
  const p = project(state.position.lng, state.position.lat);
  C.k = 2.2;
  const s = baseScale() * C.k;
  C.tx = canvas.width / 2 - p.x * s;
  C.ty = canvas.height / 2 - p.y * s;
  clamp();
}
function clamp() {
  const s = baseScale() * C.k;
  const w = VIEW_W * s, h = VIEW_H * s;
  C.tx = w <= canvas.width ? (canvas.width - w) / 2 : Math.max(canvas.width - w, Math.min(0, C.tx));
  C.ty = h <= canvas.height ? (canvas.height - h) / 2 : Math.max(canvas.height - h, Math.min(0, C.ty));
}
function onWheel(e) {
  e.preventDefault();
  const before = C.k;
  C.k = Math.max(1, Math.min(8, C.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * (canvas.width / r.width);
  const my = (e.clientY - r.top) * (canvas.height / r.height);
  const f = C.k / before;
  C.tx = mx - (mx - C.tx) * f;
  C.ty = my - (my - C.ty) * f;
  clamp();
}
function onDown(e) { C.drag = { x: e.clientX, y: e.clientY }; }
function onMove(e) {
  if (!C || !C.drag) return;
  const r = canvas.getBoundingClientRect();
  const sc = canvas.width / r.width;
  C.tx += (e.clientX - C.drag.x) * sc;
  C.ty += (e.clientY - C.drag.y) * sc;
  C.drag = { x: e.clientX, y: e.clientY };
  clamp();
}
function onUp() { if (C) C.drag = null; }

function loop() { if (!C) return; draw(); raf = requestAnimationFrame(loop); }

function draw() {
  const s = baseScale() * C.k;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1a160f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(C.tx, C.ty); ctx.scale(s, s);

  // 羊皮纸底
  ctx.fillStyle = '#efe3c2';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // 海（只在已探明处显示为水色）
  ctx.fillStyle = '#a8c4cf';
  eachCell((c, r, known, lngW, latN) => {
    if (!known) return;
    const a = project(lngW, latN), b = project(lngW + CELL, latN - CELL);
    ctx.fillRect(a.x, a.y, b.x - a.x + 0.6, b.y - a.y + 0.6);
  });

  // 陆地（裁剪到已探明区域）
  ctx.save();
  ctx.beginPath();
  eachCell((c, r, known, lngW, latN) => {
    if (!known) return;
    const a = project(lngW, latN), b = project(lngW + CELL, latN - CELL);
    ctx.rect(a.x, a.y, b.x - a.x + 0.6, b.y - a.y + 0.6);
  });
  ctx.clip();
  for (const ring of LAND_RINGS) {
    ctx.beginPath();
    let started = false;
    for (const [lng, lat] of ring.pts) {
      const p = project(lng, lat);
      started ? ctx.lineTo(p.x, p.y) : (ctx.moveTo(p.x, p.y), started = true);
    }
    ctx.closePath();
    ctx.fillStyle = '#e0d3ac'; ctx.fill();
    ctx.strokeStyle = '#7a6338'; ctx.lineWidth = 1.2 / C.k; ctx.stroke();
  }
  ctx.restore();

  // 迷雾边界的做旧笔触
  ctx.strokeStyle = 'rgba(120,96,54,.28)'; ctx.lineWidth = 1 / C.k;
  eachCell((c, r, known, lngW, latN) => {
    if (!known) return;
    const a = project(lngW, latN), b = project(lngW + CELL, latN - CELL);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  });

  // 港口（只画已发现的）
  for (const p of PORTS) {
    if (!state.discovered.includes(p.id)) continue;
    const q = project(p.lng, p.lat);
    ctx.fillStyle = NATIONS[p.nation]?.color || '#444';
    ctx.strokeStyle = '#2c2418'; ctx.lineWidth = 1.2 / C.k;
    ctx.beginPath(); ctx.arc(q.x, q.y, 4.5 / C.k + 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2f1c';
    ctx.font = `${12 / C.k + 4}px "Noto Serif SC", serif`;
    ctx.textAlign = 'center';
    ctx.fillText(p.name, q.x, q.y - 8 / C.k - 4);
  }

  // 本船位置
  const me = project(state.position.lng, state.position.lat);
  ctx.strokeStyle = '#8c2f22'; ctx.lineWidth = 2.4 / C.k;
  ctx.beginPath(); ctx.arc(me.x, me.y, 10 / C.k + 3, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(me.x - 14 / C.k, me.y); ctx.lineTo(me.x + 14 / C.k, me.y);
  ctx.moveTo(me.x, me.y - 14 / C.k); ctx.lineTo(me.x, me.y + 14 / C.k); ctx.stroke();

  ctx.restore();

  // 图例
  ctx.fillStyle = 'rgba(24,20,13,.8)';
  ctx.fillRect(12, canvas.height - 44, 300, 32);
  ctx.fillStyle = '#f0e2bd';
  ctx.font = `${Math.max(12, canvas.width / 110)}px "DM Sans", sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`已探明 ${(exploredRatio() * 100).toFixed(1)}% · 滚轮缩放 · 拖动平移`, 22, canvas.height - 23);
}

// ===== 小航海图：画进任意 canvas 2D 上下文的一角 =====
export function drawMinimap(g, x, y, w, h) {
  const sx = w / VIEW_W, sy = h / VIEW_H;
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(239,227,194,.92)';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#6b5330'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
  g.save();
  g.beginPath(); g.rect(0, 0, w, h); g.clip();
  g.scale(sx, sy);
  // 已探明的海
  g.fillStyle = '#a8c4cf';
  eachCell((c, r, known, lngW, latN) => {
    if (!known) return;
    const a = project(lngW, latN), b = project(lngW + CELL, latN - CELL);
    g.fillRect(a.x, a.y, b.x - a.x + 1, b.y - a.y + 1);
  });
  // 陆地轮廓（淡）
  g.strokeStyle = 'rgba(122,99,56,.55)'; g.lineWidth = 1 / sx;
  for (const ring of LAND_RINGS) {
    g.beginPath();
    let st = false;
    for (const [lng, lat] of ring.pts) {
      const p = project(lng, lat);
      st ? g.lineTo(p.x, p.y) : (g.moveTo(p.x, p.y), st = true);
    }
    g.closePath(); g.stroke();
  }
  g.restore();
  // 本船
  const me = project(state.position.lng, state.position.lat);
  g.fillStyle = '#8c2f22';
  g.beginPath(); g.arc(me.x * sx, me.y * sy, 4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
  g.restore();
}
