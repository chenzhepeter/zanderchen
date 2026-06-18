// 共享战斗工具：伤害结算、投射物、特效、目标查找。
// 只依赖 config，不依赖 units/towers/game，以避免循环引用。
import { UNITS } from './data/config.js';

let _id = 1;
export function nextId() { return _id++; }

export function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.hypot(dx, dy);
}

// ---- 特效 ----
export function addEffect(state, e) {
  state.effects.push(Object.assign({ t: 0, life: 0.4 }, e));
}

export function addFloatText(state, x, y, text, color) {
  state.effects.push({ type: 'text', x, y, text, color: color || '#fff', t: 0, life: 0.8, vy: -40 });
}

// ---- 投射物 ----
export function spawnProjectile(state, p) {
  state.projectiles.push(Object.assign({
    id: nextId(), t: 0, life: 3, dead: false, hitSet: null,
  }, p));
}

// ---- 伤害：单位 ----
// opts: { kind: 'melee'|'arrow'|'bolt'|'orb' } 用于兵种抗性判定
export function damageUnit(state, u, amount, opts = {}) {
  if (!u || u.state === 'dead') return;
  let amt = amount;
  // 兵种对特定伤害类型的减免（骑士重甲免疫大半箭矢）
  if (opts.kind && u.cfg && u.cfg.resist && u.cfg.resist[opts.kind]) {
    amt *= (1 - u.cfg.resist[opts.kind]);
  }
  // 路障(拒马)抗箭：弓箭手对其伤害 −50%
  if (u.type === 'block' && opts.kind === 'arrow') amt *= 0.5;
  // 步兵结阵减伤
  if (u.type === 'infantry') {
    const f = UNITS.infantry.formation;
    let near = 0;
    for (const o of state.units) {
      if (o !== u && o.state !== 'dead' && o.side === u.side && o.type === 'infantry') {
        if (dist(u.x, u.y, o.x, o.y) <= f.radius) near++;
      }
    }
    if (near >= f.count) amt *= (1 - f.reduce);
  }
  u.hp -= amt;
  u.hitFlash = 1;
  addEffect(state, { type: 'hit', x: u.x, y: u.y - 14, life: 0.25 });
  if (u.hp <= 0) {
    u.hp = 0;
    u.state = 'dead';
    u.deathT = 0;
  }
}

// 对建筑伤害倍率：攻坚单位（炮）满威力，其余兵种伤害有限 → 需用炮攻坚
export const VS_BUILDING = { siege: 2.5, normal: 0.4 };

// ---- 伤害：建筑 ----
export function damageBuilding(state, b, amount, opts = {}) {
  if (!b || !b.alive) return;
  amount *= opts.siege ? VS_BUILDING.siege : VS_BUILDING.normal;
  b.hp -= amount;
  b.flash = 1;
  if (b.hp <= 0) {
    b.hp = 0;
    b.alive = false;
    // 城楼倒塌 → 驻塔法师阵亡
    if (b.mage && b.mage.state !== 'dead') {
      b.mage.state = 'dead';
      b.mage.deathT = 0;
    }
    addEffect(state, { type: 'rubble', x: b.x, y: b.y, life: 1.2 });
  }
}

// ---- 目标查找 ----
// 同路最近的敌方单位（按 x 距离），限定 aggro 范围内
export function nearestEnemyUnitInLane(state, u, aggro) {
  let best = null, bestd = aggro;
  for (const o of state.units) {
    if (o.state === 'dead' || o.side === u.side) continue;
    if (o.lane !== u.lane) continue;
    const d = Math.abs(o.x - u.x);
    if (d <= bestd) { bestd = d; best = o; }
  }
  return best;
}

// 自动寻敌：最贵的敌方单位（狙击手用）。exclude 排除城楼/主楼上的人
export function mostExpensiveEnemy(state, side, exclude) {
  let best = null, bestCost = -1;
  for (const o of state.units) {
    if (o.state === 'dead' || o.side === side) continue;
    if (exclude && exclude.includes(o.type)) continue;
    const cost = (UNITS[o.type] && UNITS[o.type].cost) || 0;
    if (cost > bestCost) { bestCost = cost; best = o; }
  }
  return best;
}

// 自动寻敌：以某敌方单位为中心、aoe 半径内敌人最多的落点（投石机用）
export function bestBombCenter(state, side, aoe, exclude) {
  const foes = state.units.filter(o => o.state !== 'dead' && o.side !== side && !(exclude && exclude.includes(o.type)));
  if (!foes.length) return null;
  let best = null, bestN = 0;
  for (const c of foes) {
    let n = 0;
    for (const o of foes) if (dist(c.x, c.y, o.x, o.y) <= aoe) n++;
    if (n > bestN) { bestN = n; best = c; }
  }
  return best ? { x: best.x, y: best.y, n: bestN } : null;
}

// 距某点最近的敌方单位；exclude 为排除的兵种类型
export function nearestEnemyUnitToPoint(state, side, x, y, maxR, exclude) {
  let best = null, bestd = maxR;
  for (const o of state.units) {
    if (o.state === 'dead' || o.side === side) continue;
    if (exclude && exclude.includes(o.type)) continue;
    const d = dist(x, y, o.x, o.y - 12);
    if (d <= bestd) { bestd = d; best = o; }
  }
  return best;
}

// 半径范围内最近敌方单位（用于箭塔，跨路也能打）
export function nearestEnemyUnitInRange(state, side, x, y, range) {
  let best = null, bestd = range;
  for (const o of state.units) {
    if (o.state === 'dead' || o.side === side) continue;
    const d = dist(x, y, o.x, o.y);
    if (d <= bestd) { bestd = d; best = o; }
  }
  return best;
}

// 某方某路的有效出兵点：
//  - 该路城楼存活 → 从城楼出兵
//  - 该路城楼已毁，但其它路还有城楼 → 该路不可出兵（返回 null）
//  - 三个城楼全毁 → 从主楼出兵（居中，归中路）
export function spawnPoint(state, side, lane) {
  const tower = state.buildings.find(b => b.side === side && b.kind === 'tower' && b.lane === lane && b.alive);
  if (tower) return { x: tower.x, lane, tower };
  const keep = state.buildings.find(b => b.side === side && b.kind === 'keep' && b.alive);
  // 中路城楼被毁 → 从主楼出兵（中路）
  if (lane === 1 && keep) return { x: keep.x, lane: 1, fromKeep: true };
  // 其它路：仍有城楼存活则该路不可出兵
  const anyTower = state.buildings.some(b => b.side === side && b.kind === 'tower' && b.alive);
  if (anyTower) return null;
  // 三城楼全毁 → 主楼（中路）
  if (keep) return { x: keep.x, lane: 1, fromKeep: true };
  return null;
}

// 该路上敌方的下一个攻击建筑（先城楼后主楼）
export function enemyStructureOnLane(state, side, lane) {
  const enemy = side === 'player' ? 'enemy' : 'player';
  const tower = state.buildings.find(b => b.side === enemy && b.kind === 'tower' && b.lane === lane && b.alive);
  if (tower) return tower;
  const keep = state.buildings.find(b => b.side === enemy && b.kind === 'keep' && b.alive);
  return keep || null;
}
