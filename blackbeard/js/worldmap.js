// 古地图海图渲染：静态层（海岸线/港口）与动态层（船只/航线）分离，支持缩放平移。
// 与 airline/js/map.js 的关键差异：那里每次 rerender 清空重建整个内容层，
// 与逐帧船只动画不兼容；这里静态层只在数据变化时重建，船只节点持久化、只改 transform。
import { LANDS } from './data/coast.js';
import { PORTS, NATIONS } from './data/ports.js';
import { project, unproject, VIEW_W, VIEW_H } from './geo.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

let svg = null, vp = null;
let layerLand, layerRoute, layerPorts, layerShips, layerFx;
let view = { k: 1, tx: 0, ty: 0 };
let portNodes = {};      // portId -> <g>
let shipNode = null;
let cb = {};

export function initMap(target, callbacks = {}) {
  cb = callbacks;
  svg = target;
  svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = '';

  // —— 羊皮纸 / 做旧滤镜 ——
  const defs = el('defs');
  defs.innerHTML = `
    <filter id="parch" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" seed="7" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.10"/></feComponentTransfer>
      <feComposite operator="over" in2="SourceGraphic"/>
    </filter>
    <filter id="softInk"><feGaussianBlur stdDeviation="0.7"/></filter>
    <radialGradient id="seaGrad" cx="45%" cy="40%" r="75%">
      <stop offset="0%" stop-color="#cfe0e6"/><stop offset="100%" stop-color="#a8c4cf"/>
    </radialGradient>
    <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#9a7f55" stroke-width="0.8" opacity="0.35"/>
    </pattern>`;
  svg.appendChild(defs);

  // 海面底
  svg.appendChild(el('rect', { x: 0, y: 0, width: VIEW_W, height: VIEW_H, fill: 'url(#seaGrad)' }));

  vp = el('g', { id: 'vp' });
  svg.appendChild(vp);

  layerLand = el('g', { id: 'lay-land' });
  layerRoute = el('g', { id: 'lay-route' });
  layerPorts = el('g', { id: 'lay-ports' });
  layerShips = el('g', { id: 'lay-ships' });
  layerFx = el('g', { id: 'lay-fx' });
  vp.append(layerLand, layerRoute, layerPorts, layerShips, layerFx);

  // 羊皮纸做旧覆盖 + 图廓
  svg.appendChild(el('rect', {
    x: 0, y: 0, width: VIEW_W, height: VIEW_H, fill: '#c9a227', opacity: 0.07,
    'pointer-events': 'none',
  }));
  svg.appendChild(el('rect', {
    x: 4, y: 4, width: VIEW_W - 8, height: VIEW_H - 8, fill: 'none',
    stroke: '#6b5330', 'stroke-width': 3, opacity: 0.55, 'pointer-events': 'none',
  }));

  drawLand();
  drawGraticule();
  drawCompass();
  drawPorts();
  bindInteractions();
  applyView();
  return { project, unproject };
}

// ===== 静态层 =====
function ringToPath(ring) {
  return ring.map((p, i) => {
    const q = project(p[0], p[1]);
    return `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  }).join('') + 'Z';
}

function drawLand() {
  layerLand.innerHTML = '';
  for (const L of LANDS) {
    const d = ringToPath(L.ring);
    // 海岸晕线（古地图风）
    layerLand.appendChild(el('path', {
      d, fill: 'none', stroke: '#8a6d3f', 'stroke-width': 5, opacity: 0.22, filter: 'url(#softInk)',
    }));
    layerLand.appendChild(el('path', { d, fill: '#e8dcbe', stroke: '#6b5330', 'stroke-width': 1.1 }));
    layerLand.appendChild(el('path', { d, fill: 'url(#hatch)', stroke: 'none', opacity: 0.5 }));
  }
}

function drawGraticule() {
  const g = el('g', { opacity: 0.18, 'pointer-events': 'none' });
  for (let lng = -100; lng <= 20; lng += 20) {
    const a = project(lng, 60), b = project(lng, -12);
    g.appendChild(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#5c4a2e', 'stroke-width': 0.6, 'stroke-dasharray': '3 5' }));
  }
  for (let lat = -10; lat <= 60; lat += 10) {
    const a = project(-100, lat), b = project(20, lat);
    g.appendChild(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#5c4a2e', 'stroke-width': 0.6, 'stroke-dasharray': '3 5' }));
  }
  // 北回归线标注
  const tc = project(-98, 23.44);
  const t = el('text', { x: tc.x, y: tc.y - 3, fill: '#5c4a2e', 'font-size': 9, opacity: 0.75, 'font-style': 'italic' });
  t.textContent = '北回归线 · Tropic of Cancer';
  g.appendChild(t);
  layerLand.appendChild(g);
}

function drawCompass() {
  const c = project(-93, 3);
  const g = el('g', { transform: `translate(${c.x},${c.y})`, opacity: 0.72, 'pointer-events': 'none' });
  g.appendChild(el('circle', { r: 30, fill: 'none', stroke: '#6b5330', 'stroke-width': 1 }));
  g.appendChild(el('circle', { r: 22, fill: 'none', stroke: '#6b5330', 'stroke-width': 0.6, 'stroke-dasharray': '2 3' }));
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, long = i % 2 === 0;
    const r1 = long ? 30 : 20;
    g.appendChild(el('polygon', {
      points: `0,0 ${Math.sin(a - 0.1) * r1},${-Math.cos(a - 0.1) * r1} ${Math.sin(a) * r1 * 1.05},${-Math.cos(a) * r1 * 1.05} ${Math.sin(a + 0.1) * r1},${-Math.cos(a + 0.1) * r1}`,
      fill: i === 0 ? '#8c2f22' : '#6b5330', opacity: long ? 0.9 : 0.5,
    }));
  }
  const n = el('text', { x: 0, y: -34, 'text-anchor': 'middle', fill: '#8c2f22', 'font-size': 11, 'font-weight': 'bold' });
  n.textContent = 'N';
  g.appendChild(n);
  layerLand.appendChild(g);
}

// ===== 港口层 =====
export function drawPorts(stateRef) {
  layerPorts.innerHTML = '';
  portNodes = {};
  const discovered = stateRef?.discovered || null;
  for (const p of PORTS) {
    const q = project(p.lng, p.lat);
    const known = !discovered || discovered.includes(p.id);
    const g = el('g', {
      class: 'map-port', 'data-id': p.id,
      transform: `translate(${q.x.toFixed(1)},${q.y.toFixed(1)}) scale(${1 / view.k})`,
      style: 'cursor:pointer',
    });
    const col = NATIONS[p.nation]?.color || '#444';
    const r = 3 + p.size * 0.9;
    if (p.pirateHaven) {
      g.appendChild(el('circle', { r: r + 4, fill: 'none', stroke: '#2b2b2b', 'stroke-width': 1, 'stroke-dasharray': '2 2', opacity: 0.8 }));
    }
    // 海图上港口位置本就已知；"未访问"只是没去过（淡化 + 空心），不隐藏名字
    g.appendChild(el('circle', {
      r, fill: known ? col : '#f3e7c8', stroke: known ? '#3a2f1c' : col,
      'stroke-width': known ? 1.2 : 1.6, 'stroke-dasharray': known ? '' : '2.5 2',
    }));
    if (known) g.appendChild(el('circle', { r: r * 0.4, fill: '#fdf6e3', opacity: 0.85 }));
    const label = el('text', {
      x: 0, y: -r - 5, 'text-anchor': 'middle', 'font-size': 11,
      fill: '#3a2f1c', stroke: '#f3e7c8', 'stroke-width': 2.5, 'paint-order': 'stroke',
      'font-weight': '600', style: 'pointer-events:none', opacity: known ? 1 : 0.62,
    });
    label.textContent = p.name;
    g.appendChild(label);
    const title = el('title');
    title.textContent = `${p.name} · ${p.nameEn}（${NATIONS[p.nation].name}）${known ? '' : ' · 尚未到访'}`;
    g.appendChild(title);
    g.addEventListener('click', (e) => { e.stopPropagation(); cb.onPortClick && cb.onPortClick(p); });
    layerPorts.appendChild(g);
    portNodes[p.id] = g;
  }
}

// ===== 动态层：航线与船 =====
export function drawRoute(path) {
  layerRoute.innerHTML = '';
  if (!path || path.length < 2) return;
  const d = path.map((p, i) => {
    const q = project(p.lng, p.lat);
    return `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  }).join('');
  layerRoute.appendChild(el('path', { d, fill: 'none', stroke: '#8c2f22', 'stroke-width': 2, 'stroke-dasharray': '7 5', opacity: 0.85 }));
  const last = project(path[path.length - 1].lng, path[path.length - 1].lat);
  layerRoute.appendChild(el('circle', { cx: last.x, cy: last.y, r: 4, fill: 'none', stroke: '#8c2f22', 'stroke-width': 2 }));
}
export function clearRoute() { layerRoute.innerHTML = ''; }

export function setShip(lng, lat, heading = 0, visible = true) {
  if (!shipNode) {
    shipNode = el('g', { id: 'own-ship', style: 'pointer-events:none' });
    shipNode.appendChild(el('circle', { r: 9, fill: '#fdf6e3', opacity: 0.5 }));
    const hull = el('path', {
      d: 'M0,-9 L4.5,3 L0,6 L-4.5,3 Z', fill: '#8c2f22', stroke: '#3a2f1c', 'stroke-width': 1,
    });
    shipNode.appendChild(hull);
    shipNode.appendChild(el('line', { x1: 0, y1: -4, x2: 0, y2: -12, stroke: '#3a2f1c', 'stroke-width': 1 }));
    layerShips.appendChild(shipNode);
  }
  shipNode.style.display = visible ? '' : 'none';
  const q = project(lng, lat);
  shipNode.setAttribute('transform',
    `translate(${q.x.toFixed(1)},${q.y.toFixed(1)}) scale(${1 / view.k}) rotate(${heading.toFixed(0)})`);
}

// 海上遭遇等临时标记
export function pingAt(lng, lat, color = '#8c2f22') {
  const q = project(lng, lat);
  const c = el('circle', { cx: q.x, cy: q.y, r: 4, fill: 'none', stroke: color, 'stroke-width': 2 });
  layerFx.appendChild(c);
  let t = 0;
  const tick = () => {
    t += 0.05;
    c.setAttribute('r', 4 + t * 30);
    c.setAttribute('opacity', Math.max(0, 1 - t));
    if (t < 1) requestAnimationFrame(tick); else c.remove();
  };
  requestAnimationFrame(tick);
}

// ===== 视口缩放/平移 =====
function applyView() {
  vp.setAttribute('transform', `translate(${view.tx},${view.ty}) scale(${view.k})`);
  // 港口点与船只反向缩放，保持屏幕尺寸恒定
  for (const id in portNodes) {
    const p = PORTS.find(x => x.id === id);
    const q = project(p.lng, p.lat);
    portNodes[id].setAttribute('transform', `translate(${q.x.toFixed(1)},${q.y.toFixed(1)}) scale(${1 / view.k})`);
  }
  if (shipNode) {
    const tr = shipNode.getAttribute('transform') || '';
    const m = tr.match(/translate\(([-\d.]+),([-\d.]+)\).*rotate\(([-\d.]+)\)/);
    if (m) shipNode.setAttribute('transform',
      `translate(${m[1]},${m[2]}) scale(${1 / view.k}) rotate(${m[3]})`);
  }
}

export function zoomTo(lng, lat, k = 2.4) {
  const q = project(lng, lat);
  view.k = k;
  view.tx = VIEW_W / 2 - q.x * k;
  view.ty = VIEW_H / 2 - q.y * k;
  clampView(); applyView();
}

function clampView() {
  view.k = Math.max(1, Math.min(6, view.k));
  const minX = VIEW_W - VIEW_W * view.k, minY = VIEW_H - VIEW_H * view.k;
  view.tx = Math.max(minX, Math.min(0, view.tx));
  view.ty = Math.max(minY, Math.min(0, view.ty));
}

// 客户端坐标 → 图坐标（兼容高 DPR 与 letterbox）
function toMap(clientX, clientY) {
  const r = svg.getBoundingClientRect();
  const scale = Math.min(r.width / VIEW_W, r.height / VIEW_H);
  const ox = (r.width - VIEW_W * scale) / 2, oy = (r.height - VIEW_H * scale) / 2;
  const mx = (clientX - r.left - ox) / scale, my = (clientY - r.top - oy) / scale;
  return { x: (mx - view.tx) / view.k, y: (my - view.ty) / view.k };
}

function bindInteractions() {
  let dragging = false, moved = 0, last = null;

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const m = toMap(e.clientX, e.clientY);
    const before = view.k;
    view.k *= e.deltaY < 0 ? 1.15 : 1 / 1.15;
    view.k = Math.max(1, Math.min(6, view.k));
    // 以光标为锚点缩放
    view.tx -= m.x * (view.k - before);
    view.ty -= m.y * (view.k - before);
    clampView(); applyView();
  }, { passive: false });

  svg.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0; last = { x: e.clientX, y: e.clientY };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    moved += Math.abs(dx) + Math.abs(dy);
    const r = svg.getBoundingClientRect();
    const scale = Math.min(r.width / VIEW_W, r.height / VIEW_H);
    view.tx += dx / scale; view.ty += dy / scale;
    last = { x: e.clientX, y: e.clientY };
    clampView(); applyView();
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    if (moved < 5 && cb.onSeaClick) {          // 视作点击而非拖拽
      const m = toMap(e.clientX, e.clientY);
      const ll = unproject(m.x, m.y);
      cb.onSeaClick(ll.lng, ll.lat);
    }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', () => { dragging = false; });
}

export function highlightPort(id, on = true) {
  const g = portNodes[id];
  if (!g) return;
  g.classList.toggle('port-active', on);
}
