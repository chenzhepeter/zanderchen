// 迷雾探索：全球 2° 网格，航行沿途按视距揭开。未探明处在海图上是空白羊皮纸。
import { state } from './state.js';
import { distanceNm } from './geo.js';

export const CELL = 2;                       // 每格 2°
const cols = 360 / CELL;                     // 180
const key = (c, r) => r * cols + c;
const cellOf = (lng, lat) => ({
  c: Math.floor((((lng + 180) % 360 + 360) % 360) / CELL),
  r: Math.floor((90 - lat) / CELL),
});

export function ensureFog() {
  if (!state.fog) state.fog = {};
}
export function isKnown(lng, lat) {
  ensureFog();
  const { c, r } = cellOf(lng, lat);
  return !!state.fog[key(c, r)];
}
export function knownCells() {
  ensureFog();
  return state.fog;
}

// 以当前位置为中心揭开视距内的格子；返回新揭开的格数
export function reveal(lng, lat, sightNm = 140) {
  ensureFog();
  const rad = Math.ceil(sightNm / 60 / CELL) + 1;   // 1° ≈ 60 海里
  const o = cellOf(lng, lat);
  let n = 0;
  for (let dc = -rad; dc <= rad; dc++) {
    for (let dr = -rad; dr <= rad; dr++) {
      const c = (o.c + dc + cols) % cols;
      const r = o.r + dr;
      if (r < 0 || r >= 180 / CELL) continue;
      const k = key(c, r);
      if (state.fog[k]) continue;
      // 用格中心到本船的真实距离判定，避免高纬度过度揭开
      const cl = { lng: c * CELL - 180 + CELL / 2, lat: 90 - r * CELL - CELL / 2 };
      if (distanceNm({ lng, lat }, cl) > sightNm) continue;
      state.fog[k] = 1;
      n++;
    }
  }
  return n;
}

export function exploredRatio() {
  ensureFog();
  return Object.keys(state.fog).length / (cols * (180 / CELL));
}

// 供海图渲染：遍历所有格，回调 (c, r, known, lngW, latN)
export function eachCell(cb) {
  ensureFog();
  for (let r = 0; r < 180 / CELL; r++) {
    for (let c = 0; c < cols; c++) {
      cb(c, r, !!state.fog[key(c, r)], c * CELL - 180, 90 - r * CELL);
    }
  }
}
