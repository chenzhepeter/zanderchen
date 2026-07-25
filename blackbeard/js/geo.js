// 地理与投影：真墨卡托（大西洋窗口）+ 反投影 + 点在陆判定 + 距离/方位 + 风带。
// 与 airline/js/map.js 的区别：那里 x 是等距圆柱、y 是墨卡托（纵向被压缩，不能用于测距）；
// 这里保持 x/y 同尺度的真墨卡托，航向与距离才有意义。
import { LANDS } from './data/coast.js';

// 大西洋视窗
export const LNG_MIN = -100, LNG_MAX = 20;
export const LAT_MIN = -12, LAT_MAX = 60;
export const VIEW_W = 1200;

export function mercY(lat) {
  const safe = Math.max(-85, Math.min(85, lat));
  return Math.log(Math.tan(Math.PI / 4 + safe * Math.PI / 360));
}
const Y_TOP = mercY(LAT_MAX);
const Y_BOT = mercY(LAT_MIN);
const Y_SPAN = Y_TOP - Y_BOT;
const LNG_SPAN = LNG_MAX - LNG_MIN;
// 真墨卡托：纵向比例 = 横向比例，故由经度跨度（弧度）推出画布高度
export const VIEW_H = Math.round(VIEW_W * Y_SPAN / (LNG_SPAN * Math.PI / 180));

export function project(lng, lat) {
  return {
    x: (lng - LNG_MIN) / LNG_SPAN * VIEW_W,
    y: (Y_TOP - mercY(lat)) / Y_SPAN * VIEW_H,
  };
}

// 屏幕（图坐标）→ 经纬度：点海图下达航行指令的前提
export function unproject(x, y) {
  const lng = LNG_MIN + (x / VIEW_W) * LNG_SPAN;
  const yM = Y_TOP - (y / VIEW_H) * Y_SPAN;
  const lat = (Math.atan(Math.exp(yM)) - Math.PI / 4) * 360 / Math.PI;
  return { lng, lat };
}

// ===== 点在多边形（射线法）=====
function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isLand(lng, lat) {
  for (const L of LANDS) if (inRing(lng, lat, L.ring)) return true;
  return false;
}
export function isSea(lng, lat) {
  if (lng < LNG_MIN || lng > LNG_MAX || lat < LAT_MIN || lat > LAT_MAX) return false;
  return !isLand(lng, lat);
}

// ===== 距离与方位 =====
const R_KM = 6371;
export function distanceKm(a, b) {
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R_KM * Math.asin(Math.sqrt(s)));
}
export const KM_PER_NM = 1.852;
export function distanceNm(a, b) { return Math.round(distanceKm(a, b) / KM_PER_NM); }

// 方位角：从 a 指向 b，0=正北，顺时针
export function bearing(a, b) {
  const toRad = d => d * Math.PI / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ===== 风带 =====
// 返回 { dir, name, strength }：dir 为风"吹向"的方位角（0=北），strength 0..1
// 简化的历史风系：东北信风（帆船西行的高速公路）、赤道无风带、盛行西风（回程）
export function windAt(lng, lat, month = 6) {
  const seasonal = Math.sin((month - 1) / 12 * Math.PI * 2) * 3; // 风带随季节南北摆动
  const L = lat - seasonal;
  if (L > 33) return { dir: 75, name: '盛行西风', strength: 0.9 };      // 自西向东
  if (L > 28) return { dir: 90, name: '变风带', strength: 0.5 };
  if (L > 8) return { dir: 250, name: '东北信风', strength: 0.9 };       // 自东北吹向西南
  if (L > 2) return { dir: 260, name: '赤道无风带', strength: 0.2 };
  return { dir: 300, name: '东南信风', strength: 0.8 };
}

// 航向与风的契合度 → 航速倍率（顺风快、逆风慢，需抢风）
export function windFactor(course, wind) {
  const diff = Math.abs(((course - wind.dir + 540) % 360) - 180); // 0=完全逆风,180=完全顺风
  const align = Math.cos((180 - diff) * Math.PI / 180);           // 1=顺风, -1=逆风
  return 1 + align * 0.45 * wind.strength;                        // 约 0.6 ~ 1.4
}
