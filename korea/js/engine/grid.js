// 方格数学 + 寻路 + 视野。纯函数，不碰 DOM，node 可直接跑（见 selftest.js）。
// 移动用四邻（上下左右），射程与距离用曼哈顿距离，视野用切比雪夫距离（看起来更圆）。
// 寻路是二叉堆 Dijkstra：blackbeard/js/battle.js 的 computeReach 用数组 FIFO 松弛，
// 在 8~15 行动力、24×16 的地图上会明显卡，所以这里重写。
import { TERRAIN, IMPASSABLE } from '../data/terrain.js';
import { GEAR } from '../data/items.js';

export const DIRS4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const key = (x, y) => x + ',' + y;
export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export function inBounds(map, x, y) { return x >= 0 && y >= 0 && x < map.w && y < map.h; }
export function terrain(map, x, y) { return TERRAIN[map.rows[y][x]] || TERRAIN['.']; }

// ---- 二叉堆（最小堆，按 cost）----
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) {
    const a = this.a; a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].cost <= a[i].cost) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].cost < a[m].cost) m = l;
        if (r < a.length && a[r].cost < a[m].cost) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

// 单格进入消耗。unit 需要 mobility / gear / side；objs 是覆盖物 Map。
export function stepCost(map, unit, x, y, objs) {
  const t = terrain(map, x, y);
  let c = t.cost[unit.mobility];
  if (c >= IMPASSABLE) return IMPASSABLE;
  const gear = unit.gear || [];
  if (gear.includes('horse') && t.id === 'mountain') return IMPASSABLE;
  if (gear.includes('truck') && !t.road) c += 1;              // 卡车离开公路很笨重
  const o = objs && objs.get(key(x, y));
  if (o) {
    if (o.kind === 'wire') {
      if (unit.mobility === 'horse') return IMPASSABLE;
      if (unit.mobility === 'foot') c += 2;
      else if (unit.mobility === 'wheel') return IMPASSABLE;    // 履带能压过铁丝网，轮式不行
    }
  }
  return c;
}

export function unitMp(unit, type) {
  let mp = type.mp;
  for (const g of unit.gear || []) {
    const gd = GEAR[g];
    if (!gd) continue;
    mp += gd.mp || 0;
  }
  if (unit.status?.march) mp = Math.ceil(mp * 1.5);
  // 伤员拖慢速度（原版：伤员影响速度）
  const eff = unit.men - unit.wounded;
  if (unit.men > 0 && unit.wounded / unit.men > 0.4) mp = Math.max(1, mp - 1);
  if (unit.fatigue >= 90) mp = Math.max(1, mp - 1);
  return Math.max(1, mp);
}

// 可达范围。返回 Map key -> { x, y, cost, prev }。规则：
// - 不能穿过敌军；可以穿过友军但不能停在友军格上；
// - 进入与敌军相邻的格子（控制区 ZOC）后立即停止（出发格除外）；
// - 卡车装具在公路上额外获得 roadMp（这里简化为公路格进入费用减 1，最低 1）。
export function computeReach(map, unit, units, mp, objs, opts = {}) {
  const occ = new Map();
  for (const u of units) if (u.alive !== false && !u.offmap) occ.set(key(u.x, u.y), u);
  const enemyAdj = new Set();
  for (const u of units) {
    if (u.alive === false || u.offmap || u.side === unit.side) continue;
    if (u.status?.ambush && !opts.seeAmbush) continue;          // 埋伏中的敌军不产生 ZOC（发现不了）
    if (u.status?.tunnel) continue;
    for (const [dx, dy] of DIRS4) enemyAdj.add(key(u.x + dx, u.y + dy));
  }
  const truck = (unit.gear || []).includes('truck');
  const best = new Map();
  const start = { x: unit.x, y: unit.y, cost: 0, prev: null };
  best.set(key(unit.x, unit.y), start);
  const heap = new Heap();
  heap.push(start);
  while (heap.size) {
    const cur = heap.pop();
    const ck = key(cur.x, cur.y);
    if (best.get(ck) !== cur) continue;
    const stopped = cur.cost > 0 && enemyAdj.has(ck);          // 进了控制区不能再走
    if (stopped) continue;
    for (const [dx, dy] of DIRS4) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const nk = key(nx, ny);
      const o = occ.get(nk);
      if (o && o.side !== unit.side && !(o.status?.ambush && !opts.seeAmbush)) continue;   // 敌军挡路
      let c = stepCost(map, unit, nx, ny, objs);
      if (c >= IMPASSABLE) continue;
      if (truck && terrain(map, nx, ny).road) c = Math.max(1, c - 1);
      const nc = cur.cost + c;
      if (nc > mp) continue;
      const prevBest = best.get(nk);
      if (prevBest && prevBest.cost <= nc) continue;
      const node = { x: nx, y: ny, cost: nc, prev: cur, occupiedByFriend: !!o };
      best.set(nk, node);
      heap.push(node);
    }
  }
  // 停留点不能是友军所在格（可穿过不可停）；隐藏敌军所在格也不能停（会被"发现"——由 battle 处理）
  const out = new Map();
  for (const [k, n] of best) {
    if (n.occupiedByFriend) continue;
    if (n.cost === 0) continue;
    out.set(k, n);
  }
  return out;
}

export function pathFrom(node) {
  const p = [];
  for (let n = node; n; n = n.prev) p.push({ x: n.x, y: n.y });
  return p.reverse();
}

// 距离场：从一组目标格出发，按某种机动类型反向扩散（AI 用来"朝目标走"）。
// 忽略 ZOC 与占位，只看地形；返回 Map key -> cost。
export function distanceField(map, targets, mobility, objs, limit = 200) {
  const best = new Map();
  const heap = new Heap();
  const fake = { mobility, gear: [] };
  for (const t of targets) {
    const n = { x: t.x, y: t.y, cost: 0 };
    best.set(key(t.x, t.y), n); heap.push(n);
  }
  while (heap.size) {
    const cur = heap.pop();
    if (best.get(key(cur.x, cur.y)) !== cur) continue;
    if (cur.cost > limit) continue;
    for (const [dx, dy] of DIRS4) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const c = stepCost(map, fake, nx, ny, objs);
      if (c >= IMPASSABLE) continue;
      const nc = cur.cost + c;
      const k = key(nx, ny);
      const pb = best.get(k);
      if (pb && pb.cost <= nc) continue;
      const n = { x: nx, y: ny, cost: nc };
      best.set(k, n); heap.push(n);
    }
  }
  return best;
}

// 射程内的格子（曼哈顿环）
export function tilesInRange(map, x, y, rmin, rmax) {
  const out = [];
  for (let dy = -rmax; dy <= rmax; dy++) for (let dx = -rmax; dx <= rmax; dx++) {
    const d = Math.abs(dx) + Math.abs(dy);
    if (d < rmin || d > rmax) continue;
    const nx = x + dx, ny = y + dy;
    if (inBounds(map, nx, ny)) out.push({ x: nx, y: ny, d });
  }
  return out;
}

// 视野：某一方所有部队的视野并集。返回 Set<key>。
// 视野半径 = 兵种视野 + 地形海拔加成 + 侦察加成 − 夜晚 1（最少 1）。
export function computeVision(map, units, side, types, { night = false } = {}) {
  const seen = new Set();
  for (const u of units) {
    if (u.side !== side || u.alive === false || u.offmap) continue;
    const t = types[u.type];
    let r = t.vision + terrain(map, u.x, u.y).vision + (u.status?.scout ? 3 : 0) - (night ? 1 : 0);
    r = Math.max(1, r);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = u.x + dx, ny = u.y + dy;
      if (inBounds(map, nx, ny)) seen.add(key(nx, ny));
    }
  }
  return seen;
}

// 某个位置四邻里敌军的数量（包围加成用）
export function adjacentEnemies(units, u) {
  let n = 0;
  for (const o of units) {
    if (o === u || o.side === u.side || o.alive === false || o.offmap) continue;
    if (Math.abs(o.x - u.x) + Math.abs(o.y - u.y) === 1) n++;
  }
  return n;
}

export function unitAt(units, x, y) {
  for (const u of units) if (u.alive !== false && !u.offmap && u.x === x && u.y === y) return u;
  return null;
}
