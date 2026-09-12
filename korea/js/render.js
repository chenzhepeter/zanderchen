// 战场渲染 + 输入：canvas 2D，程序化地形（无图片素材，同仓库其他游戏），相机可平移/缩放/双指捏合。
// 相机、DPR、rAF 循环与 pointer 事件的写法参考 blackbeard/js/battle.js；地形只画一次进离屏 canvas 再缩放贴上。
// 与战斗逻辑的联系只有回调（onTap/onHover/canSee/state），本文件不 import battle.js。
import { TERRAIN, FORT, OBJ_KINDS } from './data/terrain.js';
import { UNIT_TYPES, FACTIONS } from './data/units.js';
import { key, manhattan } from './engine/grid.js';
import { effMen } from './engine/rules.js';

export const TS = 48;            // 基准格子大小（CSS px，zoom=1）
const TR = 64;                   // 离屏地形每格像素
const OUTLINE = '#241f33';       // 与 towerclash / odyssey 一致的描边色

let canvas = null, ctx = null, wrap = null, raf = 0, cb = null;
let cam = { ox: 0, oy: 0, zoom: 1 };
let terrainCanvas = null, terrainRows = null;
let hl = { reach: null, targets: [], tactic: [], path: [], deploy: [], selected: null, hover: null, hoverPath: null };
let anims = [];        // 进行中的动画（顺序执行的由 animate() 串起来）
let floats = [];       // 漂浮文字
let pointers = new Map();
let drag = null, pinch = null;
let lastTapAt = 0;

// FNV-1a（照搬 blackbeard/js/town.js）：地形细节的确定性随机
function hash(x, y, k = 0) {
  let h = 2166136261;
  const s = `${x},${y},${k}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

export function getCam() { return cam; }
export function getState() { return cb?.state?.(); }

// ===== 打开/关闭 =====
export function openMap(canvasEl, callbacks) {
  canvas = canvasEl; ctx = canvas.getContext('2d'); wrap = canvas.parentElement; cb = callbacks;
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  terrainDirty();
  fitToMap();
  startLoop();
}
export function closeMap() {
  cancelAnimationFrame(raf); raf = 0;
  if (!canvas) return;
  window.removeEventListener('resize', resize);
  canvas.removeEventListener('pointerdown', onDown);
  canvas.removeEventListener('pointermove', onMove);
  canvas.removeEventListener('pointerup', onUp);
  canvas.removeEventListener('pointercancel', onUp);
  canvas.removeEventListener('pointerleave', onLeave);
  canvas.removeEventListener('wheel', onWheel);
  canvas = null; ctx = null; cb = null; anims = []; floats = [];
  hl = { reach: null, targets: [], tactic: [], path: [], deploy: [], selected: null, hover: null, hoverPath: null };
}
function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = wrap.clientWidth || 1, h = wrap.clientHeight || 1;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  clampCam();
}
export function setHighlights(partial) { Object.assign(hl, partial); }
export function clearHighlights() { hl.reach = null; hl.targets = []; hl.tactic = []; hl.path = []; hl.hoverPath = null; }

// ===== 相机 =====
const viewW = () => wrap?.clientWidth || 1;
const viewH = () => wrap?.clientHeight || 1;
const ts = () => TS * cam.zoom;
export function fitToMap() {
  const B = getState(); if (!B) return;
  const z = Math.min(viewW() / (B.map.w * TS), viewH() / (B.map.h * TS), 1.6);
  // 窄屏上整图缩得太小看不清计数器，最少 0.8 倍，其余靠拖动/捏合
  cam.zoom = Math.max(0.8, Math.min(1.6, z));
  cam.ox = (viewW() - B.map.w * ts()) / 2; cam.oy = (viewH() - B.map.h * ts()) / 2;
  clampCam();
  // 放不下时对准我方部队/部署区
  if (z < 0.8) {
    const mine = B.units.filter(u => u.side === 'p' && u.alive && !u.offmap);
    const cells = mine.length ? mine : (B.level.deploy || []).map(r => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 }));
    if (cells.length) centerOn(cells.reduce((a, c) => a + c.x, 0) / cells.length, cells.reduce((a, c) => a + c.y, 0) / cells.length);
  }
}
export function tileCenter(x, y) { const s = tileToScreen(x, y); return { x: s.x + ts() / 2, y: s.y + ts() / 2 }; }
function clampCam() {
  const B = getState(); if (!B) return;
  const mw = B.map.w * ts(), mh = B.map.h * ts();
  const W = viewW(), H = viewH();
  if (mw <= W) cam.ox = (W - mw) / 2; else cam.ox = Math.min(0, Math.max(W - mw, cam.ox));
  // 地图比视口矮时靠上放（给顶栏留 60px），免得手机竖屏上地图挤在正中、上下大片黑
  if (mh <= H) cam.oy = Math.min((H - mh) / 2, 60); else cam.oy = Math.min(0, Math.max(H - mh, cam.oy));
}
export function centerOn(x, y) {
  cam.ox = viewW() / 2 - (x + 0.5) * ts(); cam.oy = viewH() / 2 - (y + 0.5) * ts();
  clampCam();
}
export function zoomBy(f, cx, cy) {
  const z0 = cam.zoom;
  cam.zoom = Math.max(0.45, Math.min(2.4, cam.zoom * f));
  const k = cam.zoom / z0;
  cam.ox = cx - (cx - cam.ox) * k; cam.oy = cy - (cy - cam.oy) * k;
  clampCam();
}
export function screenToTile(sx, sy) {
  const B = getState(); if (!B) return null;
  const x = Math.floor((sx - cam.ox) / ts()), y = Math.floor((sy - cam.oy) / ts());
  if (x < 0 || y < 0 || x >= B.map.w || y >= B.map.h) return null;
  return { x, y };
}
const tileToScreen = (x, y) => ({ x: cam.ox + x * ts(), y: cam.oy + y * ts() });

// ===== 输入 =====
function pos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function onDown(e) {
  canvas.setPointerCapture?.(e.pointerId);
  const p = pos(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 1) drag = { start: p, ox: cam.ox, oy: cam.oy, moved: false, id: e.pointerId };
  else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: cam.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    drag = null;
  }
}
function onMove(e) {
  const p = pos(e);
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const f = (pinch.zoom * (d / (pinch.dist || 1))) / cam.zoom;
    zoomBy(f, (a.x + b.x) / 2, (a.y + b.y) / 2);
    return;
  }
  if (drag && pointers.size === 1) {
    const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) > 8) drag.moved = true;
    if (drag.moved) { cam.ox = drag.ox + dx; cam.oy = drag.oy + dy; clampCam(); }
    return;
  }
  if (e.pointerType === 'mouse') {
    const t = screenToTile(p.x, p.y);
    const changed = (t?.x !== hl.hover?.x) || (t?.y !== hl.hover?.y);
    hl.hover = t;
    if (changed) cb?.onHover?.(t);
  }
}
function onUp(e) {
  const p = pos(e);
  const wasDrag = drag && drag.id === e.pointerId ? drag : null;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (wasDrag) {
    drag = null;
    if (!wasDrag.moved && e.type === 'pointerup') {
      const now = Date.now();
      if (now - lastTapAt < 80) return;      // 双指松开时的抖动
      lastTapAt = now;
      const t = screenToTile(p.x, p.y);
      cb?.onTap?.(t, e);
    }
  }
  if (pointers.size === 0) drag = null;
}
function onLeave(e) { if (e.pointerType === 'mouse') { hl.hover = null; cb?.onHover?.(null); } }
function onWheel(e) {
  e.preventDefault();
  const p = pos(e);
  zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
}

// ===== 动画 =====
export function animate(type, payload) {
  return new Promise(resolve => {
    const durs = { move: Math.max(220, 110 * ((payload.path?.length || 2) - 1)), attack: 420, hit: 350, explode: 520, air: 700, die: 380, spawn: 300 };
    const fast = cb?.fast?.() ? 0.45 : 1;
    anims.push({ type, payload, t0: performance.now(), dur: (durs[type] || 300) * fast, resolve });
    if (type === 'attack') floats.push({ x: payload.to.x, y: payload.to.y, text: `-${payload.cas}`, color: payload.to.side === 'p' ? '#ffb3a7' : '#fff3b0', t0: performance.now() + 150 * fast, dur: 900 });
    if (type === 'hit' || type === 'explode') floats.push({ x: payload.x, y: payload.y, text: payload.text || '', color: '#fff3b0', t0: performance.now(), dur: 900 });
    if (type === 'air' && payload.cas != null) floats.push({ x: payload.x, y: payload.y, text: `-${payload.cas}`, color: '#ffb3a7', t0: performance.now() + 350 * fast, dur: 900 });
    if (type === 'move') centerIfOffscreen(payload.path[payload.path.length - 1]);
    if (type === 'attack') centerIfOffscreen(payload.to);
  });
}
function centerIfOffscreen(t) {
  const s = tileToScreen(t.x, t.y);
  const m = ts();
  if (s.x < -m || s.y < -m || s.x > viewW() || s.y > viewH()) centerOn(t.x, t.y);
}
function tickAnims(now) {
  for (const a of anims) {
    if (!a.done && now - a.t0 >= a.dur) { a.done = true; a.resolve(); }
  }
  anims = anims.filter(a => !a.done || now - a.t0 < a.dur + 60);
  floats = floats.filter(f => now - f.t0 < f.dur);
}
function movingPos(u, now) {
  const a = anims.find(x => x.type === 'move' && x.payload.unit === u && !x.done);
  if (!a) return null;
  const path = a.payload.path;
  const p = Math.min(1, (now - a.t0) / a.dur) * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(p)), f = p - i;
  const A = path[i], Bp = path[i + 1] || A;
  return { x: A.x + (Bp.x - A.x) * f, y: A.y + (Bp.y - A.y) * f };
}

// ===== 主循环 =====

function draw() {
  const B = getState();
  const now = performance.now();
  tickAnims(now);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#23261f';
  ctx.fillRect(0, 0, viewW(), viewH());
  if (!B) return;
  const m = ts();
  ctx.imageSmoothingEnabled = true;
  if (terrainCanvas) ctx.drawImage(terrainCanvas, cam.ox, cam.oy, B.map.w * m, B.map.h * m);
  // 网格
  ctx.strokeStyle = 'rgba(36,31,51,0.18)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= B.map.w; x++) { ctx.moveTo(cam.ox + x * m, cam.oy); ctx.lineTo(cam.ox + x * m, cam.oy + B.map.h * m); }
  for (let y = 0; y <= B.map.h; y++) { ctx.moveTo(cam.ox, cam.oy + y * m); ctx.lineTo(cam.ox + B.map.w * m, cam.oy + y * m); }
  ctx.stroke();
  drawForts(B, m);
  drawObjs(B, m);
  drawDeploy(B, m);
  drawHighlights(B, m);
  drawFog(B, m);
  drawUnits(B, m, now);
  drawRings(B, m);
  drawAnims(B, m, now);
  drawFloats(m, now);
  drawWeather(B, m, now);
}

// ===== 地形离屏 =====
export function terrainDirty() { terrainCanvas = null; }
function ensureTerrain(B) {
  if (terrainCanvas && terrainRows === B.map.rows.join('\n')) return;
  terrainRows = B.map.rows.join('\n');
  terrainCanvas = document.createElement('canvas');
  terrainCanvas.width = B.map.w * TR; terrainCanvas.height = B.map.h * TR;
  const c = terrainCanvas.getContext('2d');
  for (let y = 0; y < B.map.h; y++) for (let x = 0; x < B.map.w; x++) drawTile(c, B, x, y);
}
const isRoadLike = (B, x, y) => { const r = B.map.rows[y]; if (!r) return false; const t = TERRAIN[r[x]]; return !!t && (t.road || t.id === 'village' || t.id === 'town'); };
function drawTile(c, B, x, y) {
  const ch = B.map.rows[y][x];
  const t = TERRAIN[ch] || TERRAIN['.'];
  const X = x * TR, Y = y * TR;
  c.fillStyle = t.color; c.fillRect(X, Y, TR, TR);
  const r = (k) => hash(x, y, k);
  switch (t.id) {
    case 'plain': case 'snow': {
      c.strokeStyle = t.id === 'snow' ? 'rgba(180,190,200,0.5)' : 'rgba(70,100,50,0.45)'; c.lineWidth = 2;
      for (let i = 0; i < 7; i++) { const px = X + 6 + r(i) * (TR - 12), py = Y + 6 + r(i + 20) * (TR - 12); c.beginPath(); c.moveTo(px, py + 4); c.lineTo(px + 2, py - 3); c.stroke(); }
      break;
    }
    case 'road': case 'bridge': case 'village': case 'town': {
      if (t.id === 'bridge') { c.fillStyle = TERRAIN['~'].color; c.fillRect(X, Y, TR, TR); waves(c, X, Y, r); }
      else if (t.id === 'village') { c.fillStyle = TERRAIN['.'].color; c.fillRect(X, Y, TR, TR); }
      const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => isRoadLike(B, x + dx, y + dy));
      if (t.id !== 'town' || nb.length) {
        c.strokeStyle = t.id === 'bridge' ? '#8b6b45' : '#b9a888'; c.lineWidth = TR * 0.34; c.lineCap = 'round';
        const cx = X + TR / 2, cy = Y + TR / 2;
        if (!nb.length) { c.beginPath(); c.moveTo(X, cy); c.lineTo(X + TR, cy); c.stroke(); }
        for (const [dx, dy] of nb) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + dx * TR / 2, cy + dy * TR / 2); c.stroke(); }
        c.strokeStyle = 'rgba(90,70,40,0.35)'; c.lineWidth = 2; c.setLineDash([6, 8]);
        for (const [dx, dy] of nb) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + dx * TR / 2, cy + dy * TR / 2); c.stroke(); }
        c.setLineDash([]);
      }
      if (t.id === 'village') houses(c, X, Y, 2, r);
      if (t.id === 'town') houses(c, X, Y, 4, r, true);
      break;
    }
    case 'hill': case 'snowhill': bumps(c, X, Y, t.id === 'snowhill' ? '#a9b0b6' : '#8a865a', r, 3); break;
    case 'mountain': {
      bumps(c, X, Y, '#726f62', r, 2);
      c.fillStyle = '#6a675c'; c.beginPath(); c.moveTo(X + 8, Y + TR - 8); c.lineTo(X + TR / 2, Y + 10); c.lineTo(X + TR - 8, Y + TR - 8); c.closePath(); c.fill();
      c.fillStyle = '#a9a69a'; c.beginPath(); c.moveTo(X + TR / 2, Y + 10); c.lineTo(X + TR / 2 + 8, Y + 22); c.lineTo(X + TR / 2 - 8, Y + 22); c.closePath(); c.fill();
      break;
    }
    case 'forest': {
      for (let i = 0; i < 5; i++) {
        const px = X + 10 + r(i) * (TR - 20), py = Y + 12 + r(i + 30) * (TR - 22);
        c.fillStyle = '#5a3d22'; c.fillRect(px - 2, py, 4, 9);
        c.fillStyle = i % 2 ? '#3f6b35' : '#4a7c3f'; c.beginPath(); c.arc(px, py - 2, 8, 0, Math.PI * 2); c.fill();
      }
      break;
    }
    case 'river': waves(c, X, Y, r); break;
    case 'ice': {
      c.strokeStyle = 'rgba(120,150,170,0.6)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(X + r(1) * TR, Y); c.lineTo(X + r(2) * TR, Y + r(3) * TR); c.lineTo(X + r(4) * TR, Y + TR); c.stroke();
      break;
    }
    case 'cliff': {
      c.strokeStyle = '#3a3733'; c.lineWidth = 3;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(X + i * 16, Y); c.lineTo(X + i * 16 + 16, Y + TR); c.stroke(); }
      break;
    }
  }
}
function waves(c, X, Y, r) {
  c.strokeStyle = 'rgba(220,235,250,0.55)'; c.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const py = Y + 14 + i * 16 + r(i) * 6;
    c.beginPath(); c.moveTo(X + 6, py);
    for (let k = 1; k <= 4; k++) c.quadraticCurveTo(X + 6 + (k - 0.5) * 13, py + (k % 2 ? -4 : 4), X + 6 + k * 13, py);
    c.stroke();
  }
}
function bumps(c, X, Y, color, r, n) {
  c.strokeStyle = color; c.lineWidth = 3; c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const px = X + 12 + r(i) * (TR - 24), py = Y + 20 + r(i + 40) * (TR - 28), w = 10 + r(i + 50) * 10;
    c.beginPath(); c.moveTo(px - w, py); c.quadraticCurveTo(px, py - w * 0.9, px + w, py); c.stroke();
  }
}
function houses(c, X, Y, n, r, town = false) {
  for (let i = 0; i < n; i++) {
    const px = X + 8 + (i % 2) * 28 + r(i) * 8, py = Y + 8 + Math.floor(i / 2) * 28 + r(i + 7) * 6;
    c.fillStyle = town ? '#8a7a6a' : '#c9b48c'; c.fillRect(px, py + 8, 18, 12);
    c.fillStyle = town ? '#5b4a44' : '#8a4a3a'; c.beginPath(); c.moveTo(px - 2, py + 8); c.lineTo(px + 9, py); c.lineTo(px + 20, py + 8); c.closePath(); c.fill();
    c.strokeStyle = OUTLINE; c.lineWidth = 1; c.strokeRect(px, py + 8, 18, 12);
  }
}

// ===== 覆盖层 =====
function drawForts(B, m) {
  for (let y = 0; y < B.map.h; y++) for (let x = 0; x < B.map.w; x++) {
    const f = B.forts[y][x]; if (!f) continue;
    const s = tileToScreen(x, y);
    ctx.save(); ctx.translate(s.x, s.y);
    if (f >= 1) { ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = Math.max(2, m * 0.07); ctx.beginPath(); ctx.moveTo(m * 0.12, m * 0.82); ctx.lineTo(m * 0.88, m * 0.82); ctx.stroke(); }
    if (f >= 2) { ctx.fillStyle = '#b8a070'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(m * (0.25 + i * 0.25), m * 0.74, m * 0.11, m * 0.06, 0, 0, Math.PI * 2); ctx.fill(); } ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(m * (0.25 + i * 0.25), m * 0.74, m * 0.11, m * 0.06, 0, 0, Math.PI * 2); ctx.stroke(); } }
    if (f >= 3) { ctx.fillStyle = '#6f6a63'; ctx.fillRect(m * 0.2, m * 0.56, m * 0.6, m * 0.14); ctx.strokeStyle = OUTLINE; ctx.strokeRect(m * 0.2, m * 0.56, m * 0.6, m * 0.14); }
    ctx.restore();
  }
}
function drawObjs(B, m) {
  const phase = B.phase;
  for (const o of B.objs.values()) {
    if (o.kind === 'mine' && o.owner !== 'p' && !o.revealed) continue;      // 敌方地雷看不见
    if (o.kind === 'deploy') continue;
    const s = tileToScreen(o.x, o.y);
    ctx.save(); ctx.translate(s.x, s.y);
    const fs = Math.max(10, m * 0.42);
    ctx.font = `${fs}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (o.kind === 'flag' || o.kind === 'tunnel') {
      const col = o.owner === 'p' ? '#c0392b' : o.owner === 'e' ? '#3b5b8a' : '#888';
      ctx.fillStyle = col; ctx.globalAlpha = 0.22; ctx.fillRect(0, 0, m, m); ctx.globalAlpha = 1;
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, m * 0.06); ctx.strokeRect(m * 0.05, m * 0.05, m * 0.9, m * 0.9);
      if (o.kind === 'flag') {
        ctx.fillStyle = col; ctx.fillRect(m * 0.18, m * 0.12, m * 0.06, m * 0.5);
        ctx.beginPath(); ctx.moveTo(m * 0.24, m * 0.12); ctx.lineTo(m * 0.6, m * 0.25); ctx.lineTo(m * 0.24, m * 0.38); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = '#2b2620'; ctx.beginPath(); ctx.ellipse(m * 0.5, m * 0.45, m * 0.22, m * 0.16, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(m * 0.28, m * 0.45, m * 0.44, m * 0.12);
      }
      if (m >= 34 && o.name) { ctx.font = `bold ${Math.max(9, m * 0.2)}px "DM Sans","Noto Serif SC",sans-serif`; ctx.fillStyle = '#fff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; ctx.strokeText(o.name, m * 0.5, m * 0.86); ctx.fillText(o.name, m * 0.5, m * 0.86); }
    } else if (o.kind === 'wire') {
      ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = Math.max(1.5, m * 0.04);
      ctx.beginPath(); for (let i = 0; i <= 6; i++) ctx.lineTo(m * (0.08 + i * 0.14), m * (i % 2 ? 0.38 : 0.62)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m * 0.08, m * 0.5); ctx.lineTo(m * 0.92, m * 0.5); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(m * (0.2 + i * 0.2), m * 0.42); ctx.lineTo(m * (0.2 + i * 0.2) + 4, m * 0.58); ctx.stroke(); }
    } else if (o.kind === 'mine') {
      ctx.fillStyle = o.owner === 'p' ? 'rgba(192,57,43,0.75)' : 'rgba(40,40,40,0.8)';
      ctx.beginPath(); ctx.arc(m * 0.5, m * 0.5, m * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(8, m * 0.22)}px "DM Sans",sans-serif`; ctx.fillText('雷', m * 0.5, m * 0.51);
    } else if (o.kind === 'depot') {
      ctx.fillStyle = '#c9a25c'; ctx.fillRect(m * 0.28, m * 0.3, m * 0.44, m * 0.34);
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.strokeRect(m * 0.28, m * 0.3, m * 0.44, m * 0.34);
      ctx.beginPath(); ctx.moveTo(m * 0.5, m * 0.3); ctx.lineTo(m * 0.5, m * 0.64); ctx.stroke();
      if (m >= 34) { ctx.fillStyle = '#fff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; ctx.font = `bold ${Math.max(9, m * 0.2)}px "DM Sans","Noto Serif SC",sans-serif`; ctx.strokeText('补给', m * 0.5, m * 0.84); ctx.fillText('补给', m * 0.5, m * 0.84); }
    } else if (o.kind === 'treasure') {
      ctx.fillText('🎁', m * 0.5, m * 0.52);
    } else if (o.kind === 'exit') {
      ctx.fillStyle = o.owner === 'p' ? 'rgba(192,57,43,0.25)' : 'rgba(59,91,138,0.3)'; ctx.fillRect(0, 0, m, m);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = `${Math.max(10, m * 0.34)}px sans-serif`; ctx.fillText(o.owner === 'p' ? '⤴' : '⤵', m * 0.5, m * 0.5);
    }
    ctx.restore();
  }
}
function drawDeploy(B, m) {
  if (B.phase !== 'deploy') return;
  for (const c of hl.deploy || []) {
    const s = tileToScreen(c.x, c.y);
    ctx.fillStyle = 'rgba(255,220,120,0.22)'; ctx.fillRect(s.x, s.y, m, m);
    ctx.strokeStyle = 'rgba(255,220,120,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(s.x + 1, s.y + 1, m - 2, m - 2);
  }
}
function drawHighlights(B, m) {
  if (hl.reach) for (const n of hl.reach.values()) {
    const s = tileToScreen(n.x, n.y);
    ctx.fillStyle = 'rgba(80,150,255,0.32)'; ctx.fillRect(s.x, s.y, m, m);
  }
  for (const t of hl.tactic || []) {
    const s = tileToScreen(t.x, t.y);
    ctx.fillStyle = 'rgba(190,120,255,0.35)'; ctx.fillRect(s.x, s.y, m, m);
    ctx.strokeStyle = 'rgba(190,120,255,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(s.x + 2, s.y + 2, m - 4, m - 4);
  }
  const path = hl.hoverPath || hl.path;
  if (path && path.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(2, m * 0.08); ctx.setLineDash([m * 0.2, m * 0.15]); ctx.lineCap = 'round';
    ctx.beginPath();
    path.forEach((p, i) => { const s = tileToScreen(p.x, p.y); i ? ctx.lineTo(s.x + m / 2, s.y + m / 2) : ctx.moveTo(s.x + m / 2, s.y + m / 2); });
    ctx.stroke(); ctx.setLineDash([]);
  }
}
function drawFog(B, m) {
  if (B.level?.revealAll) return;
  ctx.fillStyle = 'rgba(10,12,20,0.5)';
  for (let y = 0; y < B.map.h; y++) for (let x = 0; x < B.map.w; x++) {
    if (B.vision.has(key(x, y))) continue;
    const s = tileToScreen(x, y);
    ctx.fillRect(s.x, s.y, m + 0.5, m + 0.5);
  }
}

// ===== 单位 =====
function factionColor(u) { return FACTIONS[u.faction]?.color || '#666'; }
function drawUnits(B, m, now) {
  const dying = anims.filter(a => a.type === 'die' && !a.done).map(a => a.payload.unit);
  const spawning = anims.filter(a => a.type === 'spawn' && !a.done);
  const list = B.units.filter(u => (u.alive || dying.includes(u)) && !u.offmap);
  for (const u of list) {
    if (u.side === 'e' && !cb.canSee(u)) continue;
    const mv = movingPos(u, now);
    const px = mv ? mv.x : u.x, py = mv ? mv.y : u.y;
    const s = tileToScreen(px, py);
    let alpha = 1, scale = 1;
    const d = anims.find(a => a.type === 'die' && a.payload.unit === u && !a.done);
    if (d) alpha = 1 - (now - d.t0) / d.dur;
    const sp = spawning.find(a => a.payload.unit === u);
    if (sp) scale = 0.4 + 0.6 * Math.min(1, (now - sp.t0) / sp.dur);
    drawCounter(u, s.x, s.y, m, alpha, scale, B);
  }
}
function drawCounter(u, x, y, m, alpha, scale, B) {
  const t = UNIT_TYPES[u.type];
  ctx.save();
  ctx.globalAlpha = alpha * ((u.side === 'p' && u.acted && u.moved && B.phase === 'p') ? 0.62 : 1);
  ctx.translate(x + m / 2, y + m / 2); ctx.scale(scale, scale); ctx.translate(-m / 2, -m / 2);
  const pad = m * 0.1, w = m - pad * 2, h = m * 0.7, r = m * 0.12;
  // 影子
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(pad + 2, pad + 3, w, h, r); ctx.fill();
  ctx.fillStyle = factionColor(u); roundRect(pad, pad, w, h, r); ctx.fill();
  ctx.lineWidth = Math.max(1.5, m * 0.045); ctx.strokeStyle = u.hero ? '#ffd166' : (u.status?.ambush ? '#7ed37e' : OUTLINE);
  if (u.hero) ctx.lineWidth *= 1.6;
  roundRect(pad, pad, w, h, r); ctx.stroke();
  // 兵种字
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${m * 0.34}px "Noto Serif SC","DM Sans",serif`;
  ctx.fillText(t.glyph, m / 2, pad + h / 2 + 1);
  // 等级
  ctx.font = `bold ${m * 0.17}px "DM Sans",sans-serif`; ctx.textAlign = 'left';
  ctx.fillText(`L${u.level}`, pad + m * 0.06, pad + m * 0.13);
  // 状态图标
  const icons = [];
  if (u.fatigue >= 50) icons.push('💤'); if (u.wounded > u.men * 0.25) icons.push('🩹'); if (u.ammo < 6) icons.push('⚠️');
  if (u.status?.ambush) icons.push('🌲'); if (u.status?.confused) icons.push('🎭'); if (u.status?.tunnel) icons.push('🕳️'); if (u.status?.march) icons.push('🏃');
  if (icons.length && m >= 30) { ctx.font = `${m * 0.2}px sans-serif`; ctx.textAlign = 'right'; ctx.fillText(icons.slice(0, 3).join(''), m - pad - 2, pad + m * 0.13); }
  // 人数条
  const eff = effMen(u), ratio = eff / u.menMax, wr = u.wounded / u.menMax;
  const by = pad + h + m * 0.04, bh = m * 0.1;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(pad, by, w, bh);
  ctx.fillStyle = ratio > 0.6 ? '#6fcf6f' : ratio > 0.3 ? '#f2c94c' : '#eb5757'; ctx.fillRect(pad, by, w * ratio, bh);
  ctx.fillStyle = '#f0a0a0'; ctx.fillRect(pad + w * ratio, by, w * Math.min(wr, 1 - ratio), bh);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.strokeRect(pad, by, w, bh);
  if (m >= 40) { ctx.fillStyle = '#fff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5; ctx.font = `bold ${m * 0.16}px "DM Sans",sans-serif`; ctx.textAlign = 'center'; ctx.strokeText(String(eff), m / 2, by + bh / 2 + 0.5); ctx.fillText(String(eff), m / 2, by + bh / 2 + 0.5); }
  ctx.restore();
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawRings(B, m) {
  for (const t of hl.targets || []) {
    const s = tileToScreen(t.x, t.y);
    ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = Math.max(2, m * 0.07); ctx.strokeRect(s.x + 2, s.y + 2, m - 4, m - 4);
    ctx.fillStyle = 'rgba(255,60,60,0.18)'; ctx.fillRect(s.x, s.y, m, m);
  }
  if (hl.selected) {
    const u = hl.selected; const s = tileToScreen(u.x, u.y);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);
    ctx.strokeStyle = `rgba(255,214,102,${0.6 + 0.4 * pulse})`; ctx.lineWidth = Math.max(2, m * 0.08); ctx.strokeRect(s.x + 1, s.y + 1, m - 2, m - 2);
  }
  if (hl.hover) {
    const s = tileToScreen(hl.hover.x, hl.hover.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(s.x + 1, s.y + 1, m - 2, m - 2);
  }
}

// ===== 动画绘制 =====
function drawAnims(B, m, now) {
  for (const a of anims) {
    const p = Math.min(1, (now - a.t0) / a.dur);
    if (a.type === 'attack') {
      const f = tileToScreen(a.payload.from.x, a.payload.from.y), t = tileToScreen(a.payload.to.x, a.payload.to.y);
      const fx = f.x + m / 2, fy = f.y + m / 2, tx = t.x + m / 2, ty = t.y + m / 2;
      const w = a.payload.weapon;
      if (w.indirect) {
        // 抛物线炮弹
        const q = Math.min(1, p / 0.7);
        const cx = fx + (tx - fx) * q, cy = fy + (ty - fy) * q - Math.sin(q * Math.PI) * m * 1.6;
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx, cy, Math.max(3, m * 0.08), 0, Math.PI * 2); ctx.fill();
        if (p > 0.7) burst(tx, ty, m * 0.7, (p - 0.7) / 0.3, '#ffb347');
      } else {
        const q = Math.min(1, p / 0.5);
        ctx.strokeStyle = a.payload.from.side === 'p' ? '#ffe08a' : '#a8c8ff'; ctx.lineWidth = Math.max(2, m * 0.06);
        ctx.setLineDash([m * 0.15, m * 0.1]); ctx.lineDashOffset = -now / 20;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + (tx - fx) * q, fy + (ty - fy) * q); ctx.stroke(); ctx.setLineDash([]);
        if (p > 0.5) burst(tx, ty, m * 0.45, (p - 0.5) / 0.5, '#fff1a8');
      }
    } else if (a.type === 'explode') {
      const s = tileToScreen(a.payload.x, a.payload.y);
      burst(s.x + m / 2, s.y + m / 2, m * 0.9, p, '#ff8c42');
    } else if (a.type === 'air') {
      const s = tileToScreen(a.payload.x, a.payload.y);
      const tx = s.x + m / 2, ty = s.y + m / 2;
      const px = tx - m * 4 + p * m * 8, py = ty - m * 2.5 + Math.sin(p * Math.PI) * m * 0.3;
      ctx.font = `${m * 0.8}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✈️', px, py);
      if (a.payload.repelled) {
        if (p > 0.3 && p < 0.8) { ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]); }
      } else if (p > 0.45) burst(tx, ty, m * 1.1, (p - 0.45) / 0.55, '#ff6b3d');
    }
  }
}
function burst(x, y, r, p, color) {
  ctx.save(); ctx.globalAlpha = 1 - p;
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * (0.3 + p * 0.7), 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + p; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4); ctx.lineTo(x + Math.cos(a) * r * (0.6 + p * 0.6), y + Math.sin(a) * r * (0.6 + p * 0.6)); ctx.stroke(); }
  ctx.restore();
}
function drawFloats(m, now) {
  for (const f of floats) {
    if (now < f.t0) continue;
    const p = (now - f.t0) / f.dur;
    const s = tileToScreen(f.x, f.y);
    ctx.save(); ctx.globalAlpha = 1 - p * p;
    ctx.font = `bold ${Math.max(12, m * 0.34)}px "DM Sans",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; ctx.fillStyle = f.color;
    const y = s.y + m * 0.3 - p * m * 0.6;
    ctx.strokeText(f.text, s.x + m / 2, y); ctx.fillText(f.text, s.x + m / 2, y);
    ctx.restore();
  }
}
function drawWeather(B, m, now) {
  if (B.night) {
    ctx.fillStyle = 'rgba(12,18,48,0.38)'; ctx.fillRect(0, 0, viewW(), viewH());
  }
  if (B.weather === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const W = viewW(), H = viewH();
    for (let i = 0; i < 40; i++) {
      const x = (hash(i, 1) * W + now * 0.02 * (0.5 + hash(i, 2))) % W;
      const y = (hash(i, 3) * H + now * 0.05 * (0.6 + hash(i, 4))) % H;
      ctx.beginPath(); ctx.arc(x, y, 1.5 + hash(i, 5) * 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// 每帧前保证地形缓存存在（draw 内调用）
const _draw = draw;
function drawWrapped() { const B = getState(); if (B) ensureTerrain(B); _draw(); }
// 用包装后的 draw 替换循环里的调用
function loopWrapped() { if (!canvas) return; drawWrapped(); raf = requestAnimationFrame(loopWrapped); }
export function startLoop() { cancelAnimationFrame(raf); loopWrapped(); }

// ===== 简报用的小地图 =====
export function drawMiniMap(cv, level, opts = {}) {
  const w = level.map[0].length, h = level.map.length;
  const cell = Math.floor(Math.min(cv.width / w, cv.height / h));
  const c = cv.getContext('2d');
  c.fillStyle = '#23261f'; c.fillRect(0, 0, cv.width, cv.height);
  const ox = (cv.width - w * cell) / 2, oy = (cv.height - h * cell) / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = TERRAIN[level.map[y][x]] || TERRAIN['.'];
    c.fillStyle = t.color; c.fillRect(ox + x * cell, oy + y * cell, cell, cell);
  }
  for (const r of level.deploy || []) { c.fillStyle = 'rgba(255,220,120,0.35)'; c.fillRect(ox + r.x0 * cell, oy + r.y0 * cell, (r.x1 - r.x0 + 1) * cell, (r.y1 - r.y0 + 1) * cell); }
  for (const o of level.objs || []) {
    if (o.kind === 'flag' || o.kind === 'tunnel') { c.fillStyle = o.owner === 'p' ? '#c0392b' : '#3b5b8a'; c.fillRect(ox + o.x * cell, oy + o.y * cell, cell, cell); }
    else if (o.kind === 'depot') { c.fillStyle = '#c9a25c'; c.fillRect(ox + o.x * cell + 1, oy + o.y * cell + 1, cell - 2, cell - 2); }
    else if (o.kind === 'exit') { c.fillStyle = o.owner === 'p' ? 'rgba(192,57,43,0.6)' : 'rgba(59,91,138,0.7)'; c.fillRect(ox + o.x * cell, oy + o.y * cell, cell, cell); }
  }
  for (const e of level.enemies || []) { c.fillStyle = '#3b5b8a'; c.fillRect(ox + e.x * cell + 1, oy + e.y * cell + 1, cell - 2, cell - 2); c.strokeStyle = '#fff'; c.lineWidth = 1; c.strokeRect(ox + e.x * cell + 1, oy + e.y * cell + 1, cell - 2, cell - 2); }
  for (const a of level.allies || []) { c.fillStyle = '#c0392b'; c.fillRect(ox + a.x * cell + 1, oy + a.y * cell + 1, cell - 2, cell - 2); c.strokeStyle = '#fff'; c.strokeRect(ox + a.x * cell + 1, oy + a.y * cell + 1, cell - 2, cell - 2); }
}
