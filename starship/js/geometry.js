import { CORE, WORLD as W } from './data/config.js';
import { wallSegments } from './battlefield.js';
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function angleDiff(a, b) { return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))); }
export function moveToward(p, target, amount) {
  const d = distance(p, target);
  if (d <= amount) { p.x = target.x; p.y = target.y; return true; }
  p.x += (target.x - p.x) / d * amount; p.y += (target.y - p.y) / d * amount;
  return false;
}
export function crosses(a, b, s) {
  const dx = b.x - a.x, dy = b.y - a.y, ex = s.x2 - s.x1, ey = s.y2 - s.y1;
  const den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-8) return false;
  const t = ((s.x1 - a.x) * ey - (s.y1 - a.y) * ex) / den;
  const u = ((s.x1 - a.x) * dy - (s.y1 - a.y) * dx) / den;
  return t > 0.001 && t < 0.999 && u >= 0 && u <= 1;
}
export function lineClear(a, b, walls, exemptSide = null) { return !wallSegments(walls).some(s => s.side !== exemptSide && crosses(a, b, s)); }
export function coreBlocks(a, b) {
  const x = CORE.x - CORE.w / 2, y = CORE.y - CORE.h / 2;
  return [{ x1: x, y1: y, x2: x + CORE.w, y2: y }, { x1: x, y1: y + CORE.h, x2: x + CORE.w, y2: y + CORE.h }, { x1: x, y1: y, x2: x, y2: y + CORE.h }, { x1: x + CORE.w, y1: y, x2: x + CORE.w, y2: y + CORE.h }].some(s => crosses(a, b, s));
}
export function outsideSide(p, side) { return ({ north: p.y <= W.top, south: p.y >= W.bottom, east: p.x >= W.right, west: p.x <= W.left })[side] || false; }
