// 近海航行视野（仿《大航海时代2》）：只看得见本船周围的海面。
// 点海面设定下一个航点（不是直接点城市）；附近的船只与海岸线可见；靠近港口才能入港。
import { state } from './state.js';
import { PORTS, NATIONS } from './data/ports.js';
import { LAND_RINGS, distanceNm, bearing, windAt, isSea } from './geo.js';
import { isKnown } from './fog.js';

let canvas, ctx, cb = {}, raf = 0, T = null;

// 视野跨度（度）：出海只看得见眼前一段海面——最远也不过望远镜视距，
// 想知道自己在世界的哪里，只能开海图。
const ZOOMS = [2, 4, 8, 12];

export function openSail(callbacks) {
  cb = callbacks || {};
  canvas = document.getElementById('scanvas');
  ctx = canvas.getContext('2d');
  T = { zoom: 1, hover: null, t: 0, wake: [] };
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onTap);
  canvas.addEventListener('pointermove', onMove);
  loop();
}
export function closeSail() {
  cancelAnimationFrame(raf);
  if (!canvas) return;
  canvas.removeEventListener('pointerdown', onTap);
  canvas.removeEventListener('pointermove', onMove);
  window.removeEventListener('resize', resize);
  T = null;
}
export function zoomSail(dir) {
  if (!T) return;
  T.zoom = Math.max(0, Math.min(ZOOMS.length - 1, T.zoom + dir));
}
export function sailSpanDeg() { return T ? ZOOMS[T.zoom] : 8; }

function resize() {
  if (!canvas) return;
  const wrap = canvas.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(wrap.clientWidth * dpr);
  canvas.height = Math.round(wrap.clientHeight * dpr);
  canvas.style.width = wrap.clientWidth + 'px';
  canvas.style.height = wrap.clientHeight + 'px';
}

// ===== 局部投影：以本船为中心的等距圆柱（小范围内足够准，且缩放直观）=====
function view() {
  const spanLng = ZOOMS[T.zoom];
  const aspect = canvas.height / canvas.width;
  const spanLat = spanLng * aspect * Math.cos(state.position.lat * Math.PI / 180);
  return {
    lng0: state.position.lng - spanLng / 2,
    lat0: state.position.lat + spanLat / 2,
    spanLng, spanLat,
    kx: canvas.width / spanLng,
    ky: canvas.height / spanLat,
  };
}
const toScreen = (v, lng, lat) => {
  let dl = lng - v.lng0;
  if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
  return { x: dl * v.kx, y: (v.lat0 - lat) * v.ky };
};
function toWorld(v, x, y) {
  return { lng: v.lng0 + x / v.kx, lat: v.lat0 - y / v.ky };
}

function clientToCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}

function onMove(e) {
  if (!T) return;
  const p = clientToCanvas(e);
  T.hover = toWorld(view(), p.x, p.y);
}

function onTap(e) {
  if (!T || state.gameOver) return;
  const p = clientToCanvas(e);
  const v = view();
  const w = toWorld(v, p.x, p.y);

  // 先看是否点到近处的港口 / 船只
  const port = portNear(w, v);
  if (port) { cb.onPort && cb.onPort(port); return; }
  const ship = shipNear(w, v);
  if (ship) { cb.onShip && cb.onShip(ship); return; }

  if (!isSea(w.lng, w.lat)) { cb.onBlocked && cb.onBlocked(); return; }
  cb.onWaypoint && cb.onWaypoint(w);
}

function portNear(w, v) {
  const tol = v.spanLng * 0.02;
  let best = null, bd = tol;
  for (const p of PORTS) {
    const d = Math.hypot(p.lng - w.lng, p.lat - w.lat);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function shipNear(w, v) {
  const tol = v.spanLng * 0.02;
  let best = null, bd = tol;
  for (const s of (state.npcShips || [])) {
    const d = Math.hypot(s.lng - w.lng, s.lat - w.lat);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

// ===== 渲染 =====
function loop(ts = 0) {
  if (!T) return;
  T.t = ts / 1000;
  draw();
  raf = requestAnimationFrame(loop);
}

function draw() {
  const v = view();
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // 海面
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#5d8ea3'); g.addColorStop(1, '#3f6a80');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawSwell(v);
  drawLand(v);
  drawGrid(v);
  drawPorts(v);
  pushWake();
  drawWake(v);
  drawNpcShips(v);
  drawRouteLine(v);
  drawOwnShip(v);
  drawOverlay(v);
}

// 涌浪纹理，给"海面"以尺度感
function drawSwell(v) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.lineWidth = Math.max(1, canvas.width / 900);
  const step = canvas.height / 26;
  for (let y = 0; y < canvas.height; y += step) {
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 18) {
      const yy = y + Math.sin((x / 90) + T.t * 0.6 + y) * 3;
      x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawLand(v) {
  const lngMax = v.lng0 + v.spanLng, latMin = v.lat0 - v.spanLat;
  ctx.save();
  for (const ring of LAND_RINGS) {
    const b = ring.bbox;
    if (b[2] < v.lng0 || b[0] > lngMax || b[3] < latMin || b[1] > v.lat0) continue;
    ctx.beginPath();
    let started = false;
    for (const [lng, lat] of ring.pts) {
      const s = toScreen(v, lng, lat);
      started ? ctx.lineTo(s.x, s.y) : (ctx.moveTo(s.x, s.y), started = true);
    }
    ctx.closePath();
    ctx.fillStyle = '#d9c89a'; ctx.fill();
    ctx.strokeStyle = '#7a6338'; ctx.lineWidth = Math.max(1.5, canvas.width / 700); ctx.stroke();
    // 浅滩晕圈
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = Math.max(4, canvas.width / 180); ctx.stroke();
  }
  ctx.restore();
}

function drawGrid(v) {
  const step = v.spanLng > 20 ? 10 : v.spanLng > 10 ? 5 : 1;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.font = `${Math.max(11, canvas.width / 110)}px "DM Sans", sans-serif`;
  for (let lng = Math.ceil(v.lng0 / step) * step; lng < v.lng0 + v.spanLng; lng += step) {
    const s = toScreen(v, lng, v.lat0);
    ctx.beginPath(); ctx.moveTo(s.x, 0); ctx.lineTo(s.x, canvas.height); ctx.stroke();
    ctx.fillText(`${Math.abs(Math.round(lng))}°${lng < 0 ? 'W' : 'E'}`, s.x + 4, 16);
  }
  for (let lat = Math.floor(v.lat0 / step) * step; lat > v.lat0 - v.spanLat; lat -= step) {
    const s = toScreen(v, v.lng0, lat);
    ctx.beginPath(); ctx.moveTo(0, s.y); ctx.lineTo(canvas.width, s.y); ctx.stroke();
    ctx.fillText(`${Math.abs(Math.round(lat))}°${lat < 0 ? 'S' : 'N'}`, 4, s.y - 4);
  }
  ctx.restore();
}

function drawPorts(v) {
  for (const p of PORTS) {
    const s = toScreen(v, p.lng, p.lat);
    if (s.x < -60 || s.x > canvas.width + 60 || s.y < -60 || s.y > canvas.height + 60) continue;
    const known = state.discovered.includes(p.id) || isKnown(p.lng, p.lat);
    const R = Math.max(7, canvas.width / 150);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = known ? (NATIONS[p.nation]?.color || '#444') : '#8a8578';
    ctx.strokeStyle = '#2c2418'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 港口小旗
    ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(0, -R * 2.4); ctx.stroke();
    ctx.fillStyle = known ? '#f3e7c8' : '#b8b0a0';
    ctx.beginPath(); ctx.moveTo(0, -R * 2.4); ctx.lineTo(R * 1.5, -R * 2.0); ctx.lineTo(0, -R * 1.6); ctx.closePath(); ctx.fill();
    ctx.font = `bold ${Math.max(12, canvas.width / 105)}px "Noto Serif SC", serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,30,36,.85)';
    const label = known ? p.name : '？';
    ctx.strokeText(label, 0, R * 2.6); ctx.fillStyle = '#fff'; ctx.fillText(label, 0, R * 2.6);
    ctx.restore();
  }
}

function drawNpcShips(v) {
  for (const s of (state.npcShips || [])) {
    const p = toScreen(v, s.lng, s.lat);
    if (p.x < -40 || p.x > canvas.width + 40 || p.y < -40 || p.y > canvas.height + 40) continue;
    const d = distanceNm(state.position, s);
    drawSail(p.x, p.y, s.heading || 0, s.kind === 'patrol' ? '#8c2f22' : '#5b4a8c', Math.max(9, canvas.width / 130));
    ctx.save();
    ctx.font = `${Math.max(10, canvas.width / 130)}px "DM Sans", sans-serif`;
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText(`${s.kind === 'patrol' ? '巡逻舰' : '商船'} ${d}浬`, p.x, p.y + 28);
    ctx.restore();
  }
}

function drawRouteLine(v) {
  const wp = state.waypoint;
  if (!wp) return;
  const a = toScreen(v, state.position.lng, state.position.lat);
  const b = toScreen(v, wp.lng, wp.lat);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,221,77,.9)'; ctx.lineWidth = 2; ctx.setLineDash([9, 7]);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawSail(x, y, heading, color, size) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(heading * Math.PI / 180);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(2, 3, size * .9, size * .5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.strokeStyle = '#241f33'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -size * 1.5); ctx.quadraticCurveTo(size * .75, -size * .3, size * .55, size);
  ctx.lineTo(-size * .55, size); ctx.quadraticCurveTo(-size * .75, -size * .3, 0, -size * 1.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f2ead6';
  ctx.beginPath(); ctx.ellipse(0, -size * .2, size * .45, size * .8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// 航迹尾流：记录走过的经纬点，越旧越淡
function pushWake() {
  const p = state.position;
  const last = T.wake[T.wake.length - 1];
  if (!last || Math.hypot(last.lng - p.lng, last.lat - p.lat) > sailSpanDeg() * 0.006) {
    T.wake.push({ lng: p.lng, lat: p.lat });
    if (T.wake.length > 90) T.wake.shift();
  }
}
function drawWake(v) {
  if (T.wake.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 1; i < T.wake.length; i++) {
    const a = toScreen(v, T.wake[i - 1].lng, T.wake[i - 1].lat);
    const b = toScreen(v, T.wake[i].lng, T.wake[i].lat);
    const k = i / T.wake.length;
    ctx.strokeStyle = `rgba(255,255,255,${(0.05 + k * 0.30).toFixed(3)})`;
    ctx.lineWidth = 1 + k * 3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.restore();
}

function drawOwnShip(v) {
  const s = toScreen(v, state.position.lng, state.position.lat);
  const size = Math.max(11, canvas.width / 105);
  // 船尾的白浪：只在真的在走的时候翻起来
  if (state.waypoint) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate((state.heading || 0) * Math.PI / 180);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const off = ((T.t * 34 + i * 12) % 36);
      ctx.globalAlpha = 0.5 * (1 - off / 36);
      ctx.beginPath();
      ctx.arc(0, size * 1.1 + off, size * (0.35 + off / 55), Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(s.x, s.y, size * 1.9 + Math.sin(T.t * 2) * 2, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  drawSail(s.x, s.y, state.heading || 0, '#2f5fa8', size);
}

function drawOverlay(v) {
  const w = windAt(state.position.lng, state.position.lat, state.date.m);
  const R = Math.max(40, canvas.width / 22);
  // 罗盘与风向
  ctx.save();
  ctx.translate(canvas.width - R - 24, R + 24);
  ctx.fillStyle = 'rgba(16,26,32,.55)';
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.save(); ctx.rotate(w.dir * Math.PI / 180);
  ctx.fillStyle = '#ffe9a8'; ctx.strokeStyle = '#241f33'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -R * .62); ctx.lineTo(R * .22, R * .16); ctx.lineTo(0, 0); ctx.lineTo(-R * .22, R * .16);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.max(10, R * .26)}px "DM Sans", sans-serif`;
  ctx.fillText('N', 0, -R * .68);
  ctx.font = `${Math.max(11, R * .27)}px "Noto Serif SC", serif`;
  ctx.fillText(w.name, 0, R + 16);
  ctx.restore();

  // 比例尺
  const nmPerPx = 60 / v.kx;
  const barPx = canvas.width * 0.16;
  ctx.save();
  ctx.translate(24, canvas.height - 34);
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(barPx, 0);
  ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.moveTo(barPx, -6); ctx.lineTo(barPx, 6); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `${Math.max(11, canvas.width / 120)}px "DM Sans", sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(barPx * nmPerPx)} 海里`, 0, -10);
  ctx.restore();

  // 鼠标处的方位与距离提示
  if (T.hover) {
    const d = distanceNm(state.position, T.hover);
    const b = Math.round(bearing(state.position, T.hover));
    ctx.save();
    ctx.fillStyle = 'rgba(16,26,32,.72)';
    ctx.fillRect(canvas.width / 2 - 110, canvas.height - 46, 220, 30);
    ctx.fillStyle = '#e8f0f4'; ctx.textAlign = 'center';
    ctx.font = `${Math.max(12, canvas.width / 115)}px "DM Sans", sans-serif`;
    ctx.fillText(`方位 ${b}° · ${d} 海里`, canvas.width / 2, canvas.height - 26);
    ctx.restore();
  }
}
