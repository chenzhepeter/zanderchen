// 全球海图（参考图，不能点击直航）：仿原版的格状海图——经纬网格 + 迷雾格，
// 已探明处画出海岸线与港口，未探明处是空白羊皮纸。
// 这是玩家唯一能确认自己身在何处的地方：航行视野里没有小地图。
import { state } from './state.js';
import { PORTS, NATIONS } from './data/ports.js';
import { LAND_RINGS, project, VIEW_W, VIEW_H, LAT_MIN, LAT_MAX } from './geo.js';

const LATN = LAT_MAX - 0.01, LATS = LAT_MIN + 0.01;
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

  // 经纬网格：格状海图的骨架（10° 一格，30° 加粗）
  ctx.save();
  ctx.lineWidth = 1 / C.k;
  for (let lng = -180; lng <= 180; lng += 10) {
    const a = project(lng, LATN), b = project(lng, LATS);
    const major = lng % 30 === 0;
    ctx.strokeStyle = major ? 'rgba(107,83,48,.45)' : 'rgba(107,83,48,.20)';
    ctx.lineWidth = (major ? 1.6 : 0.9) / C.k;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (let lat = -70; lat <= 80; lat += 10) {
    const a = project(-180, lat), b = project(180, lat);
    const major = lat === 0 || Math.abs(lat) === 30 || Math.abs(lat) === 60;
    ctx.strokeStyle = lat === 0 ? 'rgba(140,47,34,.5)' : major ? 'rgba(107,83,48,.45)' : 'rgba(107,83,48,.20)';
    ctx.lineWidth = (major ? 1.6 : 0.9) / C.k;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // 度数标注（贴着赤道与本初子午线，缩放时字号保持可读）
  ctx.fillStyle = 'rgba(90,72,42,.75)';
  ctx.font = `${11 / C.k + 3}px "DM Sans", sans-serif`;
  ctx.textAlign = 'center';
  for (let lng = -180; lng <= 180; lng += 30) {
    const q = project(lng, 2);
    ctx.fillText(`${Math.abs(lng)}°${lng === 0 ? '' : lng < 0 ? 'W' : 'E'}`, q.x, q.y - 3 / C.k);
  }
  ctx.textAlign = 'left';
  for (let lat = -60; lat <= 60; lat += 30) {
    const q = project(2, lat);
    ctx.fillText(`${Math.abs(lat)}°${lat === 0 ? '' : lat < 0 ? 'S' : 'N'}`, q.x + 4 / C.k, q.y - 3 / C.k);
  }
  ctx.restore();

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
  ctx.fillRect(12, canvas.height - 44, 380, 32);
  ctx.fillStyle = '#f0e2bd';
  ctx.font = `${Math.max(12, canvas.width / 110)}px "DM Sans", sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`已探明 ${(exploredRatio() * 100).toFixed(1)}% · 红圈是本船 · 滚轮缩放 · 拖动平移`, 22, canvas.height - 23);
}
