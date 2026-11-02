import { ROCKS, wallSegments } from './battlefield.js';
import { CORE, BUGS } from './data/config.js';
import { crosses, clamp, distance } from './geometry.js';

export function makeFlockGrid(enemies) {
  const cells = new Map();
  for (const e of enemies) if (e.hp > 0) { const key = `${Math.floor(e.x / 4)},${Math.floor(e.y / 4)}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(e); }
  return e => {
    const result = [], cx = Math.floor(e.x / 4), cy = Math.floor(e.y / 4);
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) result.push(...(cells.get(`${x},${y}`) || []));
    return result;
  };
}
function pushFromSegment(p, segment, radius) {
  const dx = segment.x2 - segment.x1, dy = segment.y2 - segment.y1, length = dx * dx + dy * dy;
  const k = clamp(((p.x - segment.x1) * dx + (p.y - segment.y1) * dy) / length, 0, 1);
  const cx = segment.x1 + dx * k, cy = segment.y1 + dy * k, d = Math.hypot(p.x - cx, p.y - cy);
  if (d > 0.00001 && d < radius) { p.x = cx + (p.x - cx) / d * radius; p.y = cy + (p.y - cy) / d * radius; }
}
export function constrainGround(previous, next, radius, segments) {
  for (const s of segments) pushFromSegment(next, s, radius + 0.13);
  for (const rock of ROCKS) {
    const d = distance(next, rock), min = radius + rock.r;
    if (d > 0.00001 && d < min) { next.x = rock.x + (next.x - rock.x) / d * min; next.y = rock.y + (next.y - rock.y) / d * min; }
  }
  const cx = clamp(next.x, CORE.x - CORE.w / 2, CORE.x + CORE.w / 2), cy = clamp(next.y, CORE.y - CORE.h / 2, CORE.y + CORE.h / 2), d = Math.hypot(next.x - cx, next.y - cy);
  if (d > 0 && d < radius + 0.1) { next.x = cx + (next.x - cx) / d * (radius + 0.1); next.y = cy + (next.y - cy) / d * (radius + 0.1); }
  if (segments.some(s => crosses(previous, next, s))) return { ...previous };
  return next;
}
export function steerEnemy(e, goal, dt, neighbors, segments) {
  const cfg = BUGS[e.type], finalGoal = goal;
  if (!cfg.air) {
    const key = `${goal.x.toFixed(2)},${goal.y.toFixed(2)}`;
    if (e.navKey !== key) { e.navKey = key; e.navPath = obstaclePath(e, goal, cfg.radius); }
    while (e.navPath.length > 1 && distance(e, e.navPath[0]) < 1.2) e.navPath.shift();
    goal = e.navPath[0] || goal;
  }
  const d = distance(e, goal);
  if (d < 0.7) { e.vx *= 0.7; e.vy *= 0.7; return distance(e, finalGoal) < 1.3; }
  let dx = (goal.x - e.x) / d, dy = (goal.y - e.y) / d;
  const wave = cfg.air ? Math.sin(e.flightTime * 6.5 + e.variant * 17) * Math.min(0.65, d / 7) : Math.sin(e.walk * 0.45 + e.variant * 17) * Math.min(0.18, d / 60);
  const gx = dx; dx -= dy * wave; dy += gx * wave;
  for (const other of neighbors(e)) {
    if (other === e || other.hp <= 0 || BUGS[other.type].air !== cfg.air) continue;
    const near = distance(e, other), spacing = cfg.radius + BUGS[other.type].radius + 0.45;
    if (near > 0.01 && near < spacing) { const force = (spacing - near) / spacing * 1.5; dx += (e.x - other.x) / near * force; dy += (e.y - other.y) / near * force; }
  }
  const norm = Math.hypot(dx, dy) || 1, speed = cfg.speed * e.speedFactor * (cfg.air ? e.flightBoost || 1 : 1);
  const smooth = Math.min(1, dt * (cfg.air ? 17 : e.type === 'armor' ? 3.5 : 8));
  e.vx += (dx / norm * speed - e.vx) * smooth; e.vy += (dy / norm * speed - e.vy) * smooth;
  const previous = { x: e.x, y: e.y }, proposed = { x: e.x + e.vx * dt, y: e.y + e.vy * dt };
  const position = cfg.air ? proposed : constrainGround(previous, proposed, cfg.radius, segments);
  e.x = position.x; e.y = position.y;
  const moved = distance(previous, e); e.walk += moved * (e.type === 'runner' ? 6 : 4);
  if (moved > 0.0001) {
    const angle = Math.atan2(e.y - previous.y, e.x - previous.x), delta = Math.atan2(Math.sin(angle - e.angle), Math.cos(angle - e.angle));
    e.angle += delta * Math.min(1, dt * 8); e.bank = delta;
  }
  return distance(e, finalGoal) < 1.3;
}
function obstaclePath(start, goal, radius) {
  const stones = ROCKS.filter(r => start.side === 'north' ? r.y < 28 : start.side === 'south' ? r.y > 62 : start.side === 'west' ? r.x < 38 : r.x > 82);
  const clear = (a, b) => stones.every(rock => {
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const t = length ? clamp(((rock.x - a.x) * dx + (rock.y - a.y) * dy) / length, 0, 1) : 0;
    const margin = rock.r + radius + 0.2;
    if (a === start && distance(a, rock) < margin + 0.05 && dx * (a.x - rock.x) + dy * (a.y - rock.y) > 0) return true;
    return Math.hypot(rock.x - a.x - t * dx, rock.y - a.y - t * dy) >= margin;
  });
  if (clear(start, goal)) return [{ ...goal }];
  const nodes = [start, goal];
  for (const rock of stones) for (let i = 0; i < 8; i++) { const r = (rock.r + radius + 0.65) / Math.cos(Math.PI / 8), angle = i * Math.PI / 4; nodes.push({ x: rock.x + Math.cos(angle) * r, y: rock.y + Math.sin(angle) * r }); }
  const costs = nodes.map(() => Infinity), previous = [], visited = new Set(); costs[0] = 0;
  for (let n = 0; n < nodes.length; n++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current === -1 || costs[i] < costs[current])) current = i;
    if (current === -1 || !Number.isFinite(costs[current])) break;
    if (current === 1) { const path = []; for (let at = 1; at !== 0; at = previous[at]) path.unshift({ x: nodes[at].x, y: nodes[at].y }); return path; }
    visited.add(current);
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && clear(nodes[current], nodes[i])) { const cost = costs[current] + distance(nodes[current], nodes[i]); if (cost < costs[i]) { costs[i] = cost; previous[i] = current; } }
  }
  return [{ ...goal }];
}
export function safeWaypoint(p, side) {
  for (const rock of ROCKS) if (distance(p, rock) < rock.r + 2.5) {
    if (side === 'north' || side === 'south') p.x = rock.x + (p.x < rock.x ? -1 : 1) * (rock.r + 3.5);
    else p.y = rock.y + (p.y < rock.y ? -1 : 1) * (rock.r + 3.5);
  }
  return p;
}
export const navigationSegments = state => wallSegments(state.walls);
