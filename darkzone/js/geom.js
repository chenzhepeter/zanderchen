// geom.js — 射线、碰撞、寻路（纯函数）
import { ROOM_GRAPH, REGIONS, doorCenter, regionAt } from './level.js';

const D2R = Math.PI / 180;

// 支持 dist(x1,y1,x2,y2) 与 dist(obj1,obj2) 两种调用
export function dist(a, b, c, d) {
  if (typeof b === 'number') return Math.hypot(a - c, b - d);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 支持 angleTo(x1,y1,x2,y2) 与 angleTo(obj1,obj2)
export function angleTo(a, b, c, d) {
  if (typeof b === 'number') return Math.atan2(d - b, c - a);
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function angDiff(a, b) {
  let d = (a - b + Math.PI) % (Math.PI * 2) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// 射线与线段求交，返回距离 t（>=0），无交点返回 null
export function raySegment(ox, oy, dx, dy, s) {
  const ex = s.x2 - s.x1;
  const ey = s.y2 - s.y1;
  const den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((s.x1 - ox) * ey - (s.y1 - oy) * ex) / den;
  const u = ((s.x1 - ox) * dy - (s.y1 - oy) * dx) / den;
  if (t >= 0 && u >= 0 && u <= 1) return t;
  return null;
}

// 射线对一组墙段，返回最近命中距离
export function raycast(ox, oy, dx, dy, segs, maxDist = 100) {
  let best = maxDist;
  for (const s of segs) {
    const t = raySegment(ox, oy, dx, dy, s);
    if (t !== null && t < best) best = t;
  }
  return best;
}

// 两点间线段是否被墙挡住
export function blocked(x1, y1, x2, y2, segs) {
  const d = dist(x1, y1, x2, y2);
  if (d < 0.001) return false;
  const dx = (x2 - x1) / d;
  const dy = (y2 - y1) / d;
  const t = raycast(x1, y1, dx, dy, segs, d);
  return t < d - 0.05;
}

// 线段穿过的墙段（声音衰减用）
export function wallsCrossed(x1, y1, x2, y2, segs) {
  const d = dist(x1, y1, x2, y2);
  if (d < 0.001) return [];
  const dx = (x2 - x1) / d;
  const dy = (y2 - y1) / d;
  const out = [];
  for (const s of segs) {
    const t = raySegment(x1, y1, dx, dy, s);
    if (t !== null && t < d - 0.05) out.push(s);
  }
  return out;
}

// 点到线段距离 + 最近点
export function pointToSegment(px, py, s) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  let u = len2 > 0 ? ((px - s.x1) * dx + (py - s.y1) * dy) / len2 : 0;
  u = Math.max(0, Math.min(1, u));
  const cx = s.x1 + u * dx;
  const cy = s.y1 + u * dy;
  return { d: Math.hypot(px - cx, py - cy), cx, cy };
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// 圆与墙、矩形的碰撞解算（原地修改 pos）
export function resolveCollision(pos, radius, walls, rects) {
  for (let iter = 0; iter < 3; iter++) {
    for (const s of walls) {
      const { d, cx, cy } = pointToSegment(pos.x, pos.y, s);
      if (d < radius && d > 0.0001) {
        pos.x = cx + ((pos.x - cx) / d) * radius;
        pos.y = cy + ((pos.y - cy) / d) * radius;
      } else if (d <= 0.0001) {
        // 极少：圆心在线段上，向北推
        pos.y += radius;
      }
    }
    for (const r of rects) {
      const cx = Math.max(r.x, Math.min(pos.x, r.x + r.w));
      const cy = Math.max(r.y, Math.min(pos.y, r.y + r.h));
      let dx = pos.x - cx;
      let dy = pos.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.y = cy + (dy / d) * radius;
        } else {
          // 圆心在矩形内：推到最近边
          const left = pos.x - r.x;
          const right = r.x + r.w - pos.x;
          const bottom = pos.y - r.y;
          const top = r.y + r.h - pos.y;
          const m = Math.min(left, right, bottom, top);
          if (m === left) pos.x = r.x - radius;
          else if (m === right) pos.x = r.x + r.w + radius;
          else if (m === bottom) pos.y = r.y - radius;
          else pos.y = r.y + r.h + radius;
        }
      }
    }
  }
  // 地图边界
  pos.x = Math.max(radius, Math.min(48 - radius, pos.x));
  pos.y = Math.max(radius, Math.min(30 - radius, pos.y));
  return pos;
}

// 带碰撞的移动
export function moveWithCollision(pos, angle, step, radius, walls, rects) {
  const next = { x: pos.x + Math.cos(angle) * step, y: pos.y + Math.sin(angle) * step };
  resolveCollision(next, radius, walls, rects);
  const moved = dist(next.x, next.y, pos.x, pos.y);
  pos.x = next.x;
  pos.y = next.y;
  return moved;
}

// BFS 房间图寻路：返回门点 waypoints（含目标点）；同房间直接返回 [target]
export function findPath(from, to, doors, doorCostForGuard) {
  const rf = regionAt(from.x, from.y);
  const rt = regionAt(to.x, to.y);
  if (!rf || !rt) return [{ x: to.x, y: to.y }];
  if (rf.id === rt.id) return [{ x: to.x, y: to.y }];

  const doorById = Object.fromEntries(doors.map((d) => [d.id, d]));
  const q = [rf.id];
  const prev = { [rf.id]: null };
  while (q.length) {
    const cur = q.shift();
    if (cur === rt.id) break;
    for (const e of ROOM_GRAPH[cur] || []) {
      if (!(e.region in prev)) {
        prev[e.region] = { from: cur, door: e.door };
        q.push(e.region);
      }
    }
  }
  if (!(rt.id in prev)) return [{ x: to.x, y: to.y }];
  const doorIds = [];
  let cur = rt.id;
  while (prev[cur]) {
    doorIds.push(prev[cur].door);
    cur = prev[cur].from;
  }
  doorIds.reverse();
  const wps = doorIds.map((id) => {
    const c = doorCenter(doorById[id]);
    return { x: c.x, y: c.y, door: id };
  });
  wps.push({ x: to.x, y: to.y });
  return wps;
}

// 朝向某个目标点的角度（带平滑插值）
export function faceToward(current, target, maxTurn) {
  const want = Math.atan2(target.y - current.y, target.x - current.x);
  let d = (want - current + Math.PI) % (Math.PI * 2) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxTurn) return want;
  return current + Math.sign(d) * maxTurn;
}

export function insideRect(x, y, r) {
  return pointInRect(x, y, r);
}

export function segIntersectsRect(x1, y1, x2, y2, r) {
  // 端点在矩形内
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  // 线段与四条边相交
  const sides = [
    { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y },
    { x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h },
    { x1: r.x + r.w, y1: r.y + r.h, x2: r.x, y2: r.y + r.h },
    { x1: r.x, y1: r.y + r.h, x2: r.x, y2: r.y },
  ];
  const d = dist(x1, y1, x2, y2);
  const dx = (x2 - x1) / d;
  const dy = (y2 - y1) / d;
  for (const s of sides) {
    const t = raySegment(x1, y1, dx, dy, s);
    if (t !== null && t < d) return true;
  }
  return false;
}

export { D2R };
