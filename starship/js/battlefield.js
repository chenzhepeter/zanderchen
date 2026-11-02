import { SIDES, WORLD as W } from './data/config.js';

export const RING = [{ x: 60, y: 33 }, { x: 77, y: 33 }, { x: 77, y: 45 }, { x: 77, y: 57 }, { x: 60, y: 57 }, { x: 43, y: 57 }, { x: 43, y: 45 }, { x: 43, y: 33 }];
const slots = [];
for (const side of SIDES) {
  const horizontal = side === 'north' || side === 'south';
  const edge = side === 'north' ? W.top : side === 'south' ? W.bottom : side === 'west' ? W.left : W.right;
  const inward = side === 'north' || side === 'west' ? 1 : -1;
  const point = (along, offset = 0) => horizontal ? { x: along, y: edge + inward * offset } : { x: edge + inward * offset, y: along };
  const add = (kind, i, p) => slots.push({ id: `${side}-${kind}-${i}`, kind, side, ...p, ring: SIDES.indexOf(side) * 2 });
  (horizontal ? [46, 60, 74] : [34, 45, 56]).forEach((v, i) => add('infantry', i, point(v, 1.6)));
  (horizontal ? [41.5, 78.5] : [39.5, 50.5]).forEach((v,i)=>add('infantry',i+3,point(v,horizontal?1.6:4.8)));
  (horizontal ? [53, 67] : [39, 51]).forEach((v, i) => add('heavy', i, point(v, 0.6)));
  (horizontal ? [52, 60, 68] : [34, 45, 56]).forEach((v, i) => add('cannon', i, point(v, 5)));
}
[{ x: 47, y: 36 }, { x: 73, y: 36 }, { x: 73, y: 54 }, { x: 47, y: 54 }, { x: 52, y: 39 }, { x: 68, y: 39 }, { x: 68, y: 51 }, { x: 52, y: 51 }].forEach((p, i) => slots.push({ id: `air-${i}`, kind: 'air', side: 'reserve', ...p }));
[{ x: 47, y: 45, ring: 6 }, { x: 73, y: 45, ring: 2 }, { x: 49, y: 41.5, ring: 7 }, { x: 49, y: 48.5, ring: 5 }, { x: 71, y: 41.5, ring: 1 }, { x: 71, y: 48.5, ring: 3 }].forEach((p, i) => slots.push({ id: `reserve-${i}`, kind: 'infantry', side: 'reserve', ...p }));
export const SLOTS = slots;
export const SLOT_BY_ID = Object.fromEntries(SLOTS.map(s => [s.id, s]));
export const ROCKS = [{ x: 20, y: 33, r: 2.4 }, { x: 26, y: 61, r: 2.8 }, { x: 96, y: 29, r: 3 }, { x: 92, y: 58, r: 2.5 }, { x: 50, y: 13, r: 2.1 }, { x: 79, y: 17, r: 2.7 }, { x: 43, y: 76, r: 2 }, { x: 73, y: 79, r: 2.6 }];
export const canUseSlot = (state, slot) => slot.side === 'reserve' || slot.kind === 'cannon' || state.walls[slot.side].hp > 0;
export const isInside = p => p.x > W.left && p.x < W.right && p.y > W.top && p.y < W.bottom;
export const gapCenter = side => ({ north: { x: 60, y: W.top }, south: { x: 60, y: W.bottom }, west: { x: W.left, y: 45 }, east: { x: W.right, y: 45 } })[side];
export const insideGap = side => ({ north: { x: 60, y: 31 }, south: { x: 60, y: 59 }, west: { x: 41, y: 45 }, east: { x: 79, y: 45 } })[side];
export function outerWallPoint(side, lane = 0, jitter = 0) {
  return ({ north: { x: 52 + lane * 16 + jitter, y: 26.8 }, south: { x: 52 + lane * 16 + jitter, y: 63.2 }, west: { x: 36.8, y: 38 + lane * 14 + jitter }, east: { x: 83.2, y: 38 + lane * 14 + jitter } })[side];
}
export function wallSegments(walls) {
  const out = [];
  for (const side of SIDES) {
    const horizontal = side === 'north' || side === 'south';
    const v = side === 'north' ? W.top : side === 'south' ? W.bottom : side === 'west' ? W.left : W.right;
    const lo = horizontal ? W.left : W.top, hi = horizontal ? W.right : W.bottom, mid = (lo + hi) / 2;
    const ranges = walls[side].hp > 0 ? [[lo, hi]] : [[lo, mid - 3], [mid + 3, hi]];
    for (const [a, b] of ranges) out.push(horizontal ? { x1: a, y1: v, x2: b, y2: v, side } : { x1: v, y1: a, x2: v, y2: b, side });
  }
  return out;
}
export function troopPath(unit, destination) {
  const start = SLOT_BY_ID[unit.slotId];
  const a = start?.ring ?? RING.reduce((best, p, i) => Math.hypot(p.x - unit.x, p.y - unit.y) < Math.hypot(RING[best].x - unit.x, RING[best].y - unit.y) ? i : best, 0);
  const b = destination.ring;
  const clockwise = (b - a + 8) % 8, counter = (a - b + 8) % 8;
  const step = clockwise <= counter ? 1 : -1, count = Math.min(clockwise, counter);
  return [RING[a], ...Array.from({ length: count }, (_, i) => RING[(a + step * (i + 1) + 8) % 8]), { x: destination.x, y: destination.y }].map(p => ({ ...p }));
}
