import { state } from './state.js';
import { CITIES, CITY_BY_ID } from './data/cities.js';

// === Mercator 投影 ===
// viewBox: 1000 × 500，可视纬度窗 [-72, 80]——包含南极洲北缘与格陵兰。
// 投影不强制 clamp，让 SVG viewBox 自然裁剪，保持极地多边形几何完整。
const VIEW_W = 1000, VIEW_H = 500;
const VIS_LAT_MIN = -72, VIS_LAT_MAX = 80;

function mercY(lat) {
  // 仅在数学奇点附近 clamp，避免 log(0) 出 NaN
  const safe = Math.max(-89.9, Math.min(89.9, lat));
  return Math.log(Math.tan(Math.PI / 4 + safe * Math.PI / 360));
}
const Y_TOP = mercY(VIS_LAT_MAX);
const Y_BOT = mercY(VIS_LAT_MIN);
const Y_SPAN = Y_TOP - Y_BOT;

export function project(lng, lat) {
  const x = (lng + 180) / 360 * VIEW_W;
  const y = (Y_TOP - mercY(lat)) / Y_SPAN * VIEW_H;
  return { x, y };
}

// === TopoJSON 真实陆地几何 (CDN 加载) ===
// world-atlas land-110m: ~28KB simplified land polygons
let landPolygons = null;  // 解码后的 polygon 列表: [ [ring, ring, ...], ... ]
let landLoadAttempted = false;

const CDN_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json';

export async function loadDetailedLand() {
  if (landLoadAttempted) return landPolygons != null;
  landLoadAttempted = true;
  try {
    const resp = await fetch(CDN_URL, { cache: 'force-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const topo = await resp.json();
    landPolygons = decodeTopoLand(topo);
    return true;
  } catch (e) {
    console.warn('detailed map unavailable, using fallback', e);
    return false;
  }
}

// 解码 TopoJSON 的 land 对象 → 经纬度坐标多边形数组
function decodeTopoLand(topo) {
  const tx = topo.transform || {};
  const scale = tx.scale || [1, 1];
  const translate = tx.translate || [0, 0];
  // 还原弧: 每条弧是 delta 编码
  const arcs = topo.arcs.map(arc => {
    let lng = 0, lat = 0;
    return arc.map(([dx, dy]) => {
      lng += dx; lat += dy;
      return [lng * scale[0] + translate[0], lat * scale[1] + translate[1]];
    });
  });
  const polys = [];
  const collectPolygon = (poly) => {
    return poly.map(ring => {
      const pts = [];
      for (const idx of ring) {
        let arc;
        if (idx < 0) arc = arcs[~idx].slice().reverse();
        else arc = arcs[idx];
        if (pts.length > 0) arc = arc.slice(1);
        pts.push(...arc);
      }
      return pts;
    });
  };
  const ingest = (geom) => {
    if (!geom) return;
    if (geom.type === 'Polygon') polys.push(collectPolygon(geom.arcs));
    else if (geom.type === 'MultiPolygon') {
      for (const p of geom.arcs) polys.push(collectPolygon(p));
    } else if (geom.type === 'GeometryCollection') {
      for (const g of geom.geometries) ingest(g);
    }
  };
  ingest(topo.objects.land);
  return polys;
}

// === SVG 渲染 ===

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

// 简化的兜底大陆轮廓 (CDN 失败时使用)
const FALLBACK_LAND = `
M 90 110 L 220 95 L 320 90 L 380 80 L 460 75 L 530 90 L 560 120 L 540 150 L 510 170 L 480 200 L 460 230 L 430 250 L 400 270 L 380 295 L 360 310 L 320 330 L 280 320 L 240 295 L 200 270 L 160 235 L 130 200 Z
M 580 95 L 660 85 L 740 85 L 820 95 L 870 115 L 900 145 L 920 185 L 920 225 L 890 250 L 850 290 L 800 315 L 750 330 L 700 320 L 650 290 L 610 250 L 580 195 Z
M 740 245 L 800 235 L 860 245 L 900 285 L 910 335 L 890 380 L 850 410 L 800 420 L 760 410 L 720 380 L 720 320 Z
M 870 385 L 940 385 L 970 410 L 970 445 L 920 465 L 880 460 L 860 430 Z
M 100 380 L 140 360 L 180 355 L 210 380 L 220 420 L 200 455 L 160 475 L 130 465 L 100 425 Z
`;

export function buildMapSvg(el) {
  el.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
  el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  el.innerHTML = '';

  // 海洋
  el.appendChild(svgEl('rect', {
    x: 0, y: 0, width: VIEW_W, height: VIEW_H, fill: '#b8d8e8',
  }));

  // 陆地层 (先用 fallback，CDN 加载完成后会重绘)
  const landLayer = svgEl('g', { id: 'map-land' });
  el.appendChild(landLayer);
  drawLand(el);

  // 航线层 / 城市层
  el.appendChild(svgEl('g', { id: 'map-routes' }));
  el.appendChild(svgEl('g', { id: 'map-cities' }));
}

export function drawLand(el) {
  const layer = el.querySelector('#map-land');
  if (!layer) return;
  layer.innerHTML = '';

  if (landPolygons) {
    // 每个多边形一条 <path>，配合 fill-rule="evenodd" 正确呈现外环+空洞
    for (const poly of landPolygons) {
      const d = polygonToPath(poly);
      if (!d) continue;
      layer.appendChild(svgEl('path', {
        d,
        fill: '#e7eddc',
        'fill-rule': 'evenodd',
        stroke: '#9aae89',
        'stroke-width': 0.4,
        'stroke-linejoin': 'round',
      }));
    }
  } else {
    layer.appendChild(svgEl('path', {
      d: FALLBACK_LAND,
      fill: '#e7eddc',
      stroke: '#9aae89',
      'stroke-width': 1,
    }));
  }
}

// 一个多边形（外环 + 0..N 内环空洞）→ 一条 path 数据
function polygonToPath(poly) {
  const parts = [];
  for (const ring of poly) {
    if (!ring || ring.length === 0) continue;
    const pts = ring.map(([lng, lat]) => {
      const p = project(lng, lat);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    });
    parts.push('M' + pts.join('L') + 'Z');
  }
  return parts.join(' ');
}

// === 航线 + 城市 (与之前相同接口) ===
export function drawMapContents(el, opts = {}) {
  const routesLayer = el.querySelector('#map-routes');
  const citiesLayer = el.querySelector('#map-cities');
  if (!routesLayer || !citiesLayer) return;
  routesLayer.innerHTML = '';
  citiesLayer.innerHTML = '';

  // 航线
  for (const al of state.airlines) {
    for (const r of al.routes) {
      const a = CITY_BY_ID[r.fromCity], b = CITY_BY_ID[r.toCity];
      if (!a || !b) continue;
      const pa = project(a.lng, a.lat);
      const pb = project(b.lng, b.lat);
      // 弧线: 控制点在中点向上偏移
      const midX = (pa.x + pb.x) / 2;
      const midY = (pa.y + pb.y) / 2 - Math.abs(pb.x - pa.x) * 0.18;
      routesLayer.appendChild(svgEl('path', {
        d: `M ${pa.x} ${pa.y} Q ${midX} ${midY} ${pb.x} ${pb.y}`,
        fill: 'none',
        stroke: al.color,
        'stroke-width': al.isPlayer ? 2 : 1.2,
        'stroke-opacity': al.isPlayer ? 0.85 : 0.45,
        'stroke-linecap': 'round',
      }));
    }
  }

  // 城市点
  const playerRights = (state.airlines.find(a => a.isPlayer)?.landingRights) || [];
  for (const c of CITIES) {
    const p = project(c.lng, c.lat);
    const g = svgEl('g', { class: 'map-city', 'data-id': c.id });
    g.style.cursor = 'pointer';
    g.appendChild(svgEl('circle', {
      cx: p.x, cy: p.y, r: 3 + c.size * 0.5,
      fill: playerRights.includes(c.id) ? '#2563eb' : '#475569',
      stroke: '#ffffff', 'stroke-width': 1.5,
    }));
    const txt = svgEl('text', {
      x: p.x + 6, y: p.y + 3.5,
      'font-size': 11,
      fill: '#0f172a',
      'font-family': 'system-ui, sans-serif',
      'paint-order': 'stroke',
      stroke: '#ffffff',
      'stroke-width': 2.5,
      'stroke-linejoin': 'round',
    });
    txt.textContent = c.iata;
    g.appendChild(txt);

    if (opts.onCityClick) g.addEventListener('click', () => opts.onCityClick(c));
    citiesLayer.appendChild(g);
  }
}
