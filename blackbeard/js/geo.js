// 地理基础：全球墨卡托投影 + TopoJSON 解码 + 点在陆判定 + 距离/方位 + 风带
// 陆地数据已本地化（js/data/land110m.js），运行时不发任何网络请求。
import { LAND_TOPO } from './data/land110m.js';

// ===== 全球视窗（墨卡托，纬度截到 ±78 以免两极拉伸失控）=====
export const LNG_MIN = -180, LNG_MAX = 180;
export const LAT_MIN = -78, LAT_MAX = 78;
export const VIEW_W = 2400;

export function mercY(lat) {
  const safe = Math.max(-85, Math.min(85, lat));
  return Math.log(Math.tan(Math.PI / 4 + safe * Math.PI / 360));
}
const Y_TOP = mercY(LAT_MAX), Y_BOT = mercY(LAT_MIN);
const Y_SPAN = Y_TOP - Y_BOT, LNG_SPAN = LNG_MAX - LNG_MIN;
export const VIEW_H = Math.round(VIEW_W * Y_SPAN / (LNG_SPAN * Math.PI / 180));

export function project(lng, lat) {
  return {
    x: (lng - LNG_MIN) / LNG_SPAN * VIEW_W,
    y: (Y_TOP - mercY(lat)) / Y_SPAN * VIEW_H,
  };
}
export function unproject(x, y) {
  const lng = LNG_MIN + (x / VIEW_W) * LNG_SPAN;
  const yM = Y_TOP - (y / VIEW_H) * Y_SPAN;
  const lat = (Math.atan(Math.exp(yM)) - Math.PI / 4) * 360 / Math.PI;
  return { lng, lat };
}

// ===== TopoJSON 解码 =====
// 弧为增量编码的整数坐标，需按 transform 还原为经纬度；环由弧索引拼接（负索引表示反向）
function decodeTopo(topo) {
  const { scale, translate } = topo.transform;
  const arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx; y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
  const ringOf = (idxs) => {
    const pts = [];
    for (const i of idxs) {
      const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      // 相邻弧首尾重复，拼接时去掉一个
      pts.push(...(pts.length ? a.slice(1) : a));
    }
    return pts;
  };
  const rings = [];
  for (const geo of topo.geometries) {
    const polys = geo.type === 'MultiPolygon' ? geo.arcs : [geo.arcs];
    for (const poly of polys) {
      for (const ringIdx of poly) {
        const pts = ringOf(ringIdx);
        if (pts.length < 4) continue;
        let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
        for (const [x, y] of pts) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        rings.push({ pts, bbox: [x0, y0, x1, y1] });
      }
    }
  }
  return rings;
}

export const LAND_RINGS = decodeTopo(LAND_TOPO);

// ===== 点在陆判定（包围盒预筛 + 射线法）=====
function inRing(lng, lat, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isLand(lng, lat) {
  for (const r of LAND_RINGS) {
    const b = r.bbox;
    if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
    if (inRing(lng, lat, r.pts)) return true;
  }
  return false;
}

// 海域缓存：0.25° 网格，避免重复的多边形判定
const seaCache = new Map();
export function isSea(lng, lat) {
  if (lat < LAT_MIN || lat > LAT_MAX) return false;
  const L = ((lng + 180) % 360 + 360) % 360 - 180;      // 归一到 [-180,180)
  const key = (Math.round(L * 4) << 12) ^ Math.round(lat * 4);
  let v = seaCache.get(key);
  if (v === undefined) { v = !isLand(L, lat); seaCache.set(key, v); }
  return v;
}

// ===== 距离与方位 =====
const R_KM = 6371;
export const KM_PER_NM = 1.852;
export function distanceKm(a, b) {
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  let dLng = b.lng - a.lng;
  if (dLng > 180) dLng -= 360; if (dLng < -180) dLng += 360;   // 跨反子午线取近路
  dLng = toRad(dLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R_KM * Math.asin(Math.sqrt(s)));
}
export function distanceNm(a, b) { return Math.round(distanceKm(a, b) / KM_PER_NM); }

export function bearing(a, b) {
  const toRad = d => d * Math.PI / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// 从起点按方位与距离推算终点（用于逐点航行）
export function destPoint(from, brg, nm) {
  const R = R_KM / KM_PER_NM;                 // 地球半径（海里）
  const d = nm / R;
  const t = brg * Math.PI / 180;
  const la1 = from.lat * Math.PI / 180, lo1 = from.lng * Math.PI / 180;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(t));
  const lo2 = lo1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return { lat: la2 * 180 / Math.PI, lng: ((lo2 * 180 / Math.PI + 540) % 360) - 180 };
}

// ===== 风带 =====
export function windAt(lng, lat, month = 6) {
  const seasonal = Math.sin((month - 1) / 12 * Math.PI * 2) * 3;
  const L = Math.abs(lat) - seasonal;
  const north = lat >= 0;
  if (L > 60) return { dir: north ? 250 : 290, name: '极地东风', strength: 0.7 };
  if (L > 33) return { dir: north ? 75 : 105, name: '盛行西风', strength: 0.9 };
  if (L > 28) return { dir: north ? 90 : 90, name: '副热带无风带', strength: 0.35 };
  if (L > 8) return { dir: north ? 250 : 290, name: north ? '东北信风' : '东南信风', strength: 0.9 };
  if (L > 2) return { dir: 260, name: '赤道无风带', strength: 0.2 };
  return { dir: north ? 250 : 290, name: '赤道无风带', strength: 0.3 };
}

export function windFactor(course, wind) {
  const diff = Math.abs(((course - wind.dir + 540) % 360) - 180);
  const align = Math.cos((180 - diff) * Math.PI / 180);
  return 1 + align * 0.45 * wind.strength;
}
