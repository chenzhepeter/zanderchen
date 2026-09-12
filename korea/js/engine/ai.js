// 敌方 AI：一层贪心打分（同 blackbeard/js/battle.js 的 aiTurn 思路），按"姿态"分流：
//   attack    主动找我军打
//   objective 朝指定要点推进，占领后转为 hold
//   hold      守在原地（工事里），只在能开火或挪一格就能开火时动
//   flee      朝出口逃（云山撤退、三所里南逃），被堵住才还手
//   convoy    运输队：只走不打
// 每支部队：候选位置 = 原地 + 可达格；每个位置算"最佳攻击收益 − 反击损失 + 地形/工事分 − 风险 + 目标趋近分"。
import { UNIT_TYPES } from '../data/units.js';
import { manhattan, chebyshev, terrain, distanceField, key, adjacentEnemies } from './grid.js';
import { effMen, typeOf, bestWeaponFor, resolveAttack, unitValue } from './rules.js';
import { FORT } from '../data/terrain.js';
import { findObj } from './script.js';

const half = () => 0.5;

export async function runEnemyPhase(B, api) {
  B._df = new Map();
  const order = B.units.filter(u => u.side === 'e' && u.alive && !u.offmap);
  const players = api.playerUnits();
  const nearest = (u) => players.length ? Math.min(...players.map(p => manhattan(u, p))) : 99;
  order.sort((a, b) => ((typeOf(b).artillery ? 1 : 0) - (typeOf(a).artillery ? 1 : 0)) || (nearest(a) - nearest(b)));
  for (const u of order) {
    if (B.phase === 'over') return;
    if (!u.alive || u.offmap) continue;
    try { await actUnit(B, u, api); } catch (e) { console.error('AI error', u.name, e); }
    await api.afterEnemyMove(u);
    if (B.phase === 'over') return;
    await api.checkEnd();
  }
  B._df = null;
}

// 自动战斗/自测：让某一方全部部队按 AI 行动（我方自动打时用 attack 姿态）
export async function autoPlaySide(B, api, side) {
  B._df = new Map();
  const order = B.units.filter(u => u.side === side && u.alive && !u.offmap);
  for (const u of order) {
    if (B.phase === 'over') return;
    if (!u.alive || u.offmap || u.acted) continue;
    if (side === 'p' && u.ai.stance !== 'flee') u.ai.stance = u.ai.target ? 'objective' : 'attack';
    try { await actUnit(B, u, api); } catch (e) { console.error('AI error', u.name, e); }
    if (B.phase === 'over') return;
    await api.checkEnd();
  }
  B._df = null;
}

function visibleTargets(B, u) {
  return B.units.filter(p => p.side !== u.side && p.alive && !p.offmap && !(p.status.ambush && !p.status.ambushRevealed));
}

function fieldTo(B, targets, mobility) {
  const k = targets.map(t => key(t.x, t.y)).sort().join('|') + '#' + mobility;
  if (!B._df) B._df = new Map();
  if (!B._df.has(k)) B._df.set(k, distanceField(B.map, targets, mobility, B.objs));
  return B._df.get(k);
}

function goalTiles(B, u) {
  const tg = u.ai.target;
  if (tg === 'exit') return [...B.objs.values()].filter(o => o.kind === 'exit' && o.owner === 'e');
  if (typeof tg === 'string') { const o = findObj(B, tg); return o ? [o] : []; }
  if (tg && tg.x != null) return [tg];
  return [];
}

async function actUnit(B, u, api) {
  const t = typeOf(u);
  const targets = visibleTargets(B, u);
  const near = targets.length ? Math.min(...targets.map(p => manhattan(u, p))) : 99;
  // 疑兵：不敢动
  if (u.status.confused > 0) {
    api.log(`${u.name} 疑神疑鬼，按兵不动。`, 'sys');
    return;
  }
  // 士气崩溃 → 溃退
  if (u.morale < 20 && u.ai.stance !== 'flee' && !t.hq && [...B.objs.values()].some(o => o.kind === 'exit' && o.owner === 'e')) {
    u.ai.stance = 'flee'; u.ai.target = 'exit';
    api.log(`${u.name} 士气崩溃，开始溃退！`, 'good');
  }
  // 目标要点已经是自己的 → 守；被夺回 → 再攻
  if (u.ai.stance === 'hold' && typeof u.ai.target === 'string' && u.ai.target !== 'exit') {
    const o = findObj(B, u.ai.target);
    if (o && o.owner !== 'e') u.ai.stance = 'objective';
  }
  if (u.ai.stance === 'objective') {
    const o = findObj(B, u.ai.target);
    if (o && o.owner === 'e' && manhattan(u, o) <= 1) u.ai.stance = 'hold';
  }
  // 太累又没仗打 → 休息
  if (u.fatigue > 75 && near > 3) { api.rest(u); return; }

  if (u.ai.stance === 'flee' || u.ai.stance === 'convoy') return fleeAct(B, u, api, targets);
  return fightAct(B, u, api, targets);
}

async function fleeAct(B, u, api, targets) {
  const goals = goalTiles(B, u);
  const reach = api.reachFor(u);
  const cands = [{ x: u.x, y: u.y, cost: 0 }, ...reach.values()];
  let best = null, bestScore = -Infinity;
  const df = goals.length ? fieldTo(B, goals, u.mobility) : null;
  for (const c of cands) {
    const d = df ? (df.get(key(c.x, c.y))?.cost ?? 999) : 0;
    const nearP = targets.length ? Math.min(...targets.map(p => manhattan(c, p))) : 9;
    const s = -d * 3 + Math.min(nearP, 4) * 1.5 + terrain(B.map, c.x, c.y).def * 5 - c.cost * 0.2;
    if (s > bestScore) { bestScore = s; best = c; }
  }
  if (best && (best.x !== u.x || best.y !== u.y)) await api.moveUnit(u, best.x, best.y, { reach });
  if (!u.alive || u.offmap || u.ai.stance === 'convoy') return;
  // 被堵住了就还手
  const atk = bestAttackFrom(B, u, u, targets, api, true);
  if (atk && (adjacentEnemies(B.units, u) > 0 || atk.est >= 8)) await api.doAttack(u, atk.target, atk.weapon, {});
  u.acted = true;
}

// 从 pos 出发的最佳攻击方案 { target, weapon, est, score }
function bestAttackFrom(B, u, pos, targets, api, direct = false) {
  let best = null;
  const probe = { ...u, x: pos.x, y: pos.y };
  for (const p of targets) {
    const d = manhattan(pos, p);
    const w = bestWeaponFor(u, d, p);
    if (!w) continue;
    if (p.status.tunnel && !(d === 1 && !w.indirect)) continue;
    const est = resolveAttack(probe, p, w, api.ctxFor(probe, p, w), half).cas;
    if (est <= 0) continue;
    const pt = typeOf(p);
    let value = est * (1 + unitValue(p) / 200);
    if (est >= effMen(p) * 0.9) value += 40;       // 能打溃
    if (pt.hq) value *= 1.5;
    if (pt.supply || pt.artillery) value *= 1.3;
    let retaliation = 0;
    if (!w.indirect && !typeOf(p).artillery && p.morale >= 20) {
      const cw = bestWeaponFor(p, d, u);
      if (cw && !cw.indirect) retaliation = resolveAttack(p, probe, cw, api.ctxFor(p, probe, cw, { isCounter: true }), half).cas * 0.7;
    }
    const score = value - retaliation * (1 + unitValue(u) / 300);
    if (!best || score > best.score) best = { target: p, weapon: w, est, score };
  }
  return best;
}

async function fightAct(B, u, api, targets) {
  const t = typeOf(u);
  const reach = api.reachFor(u);
  const cur = { x: u.x, y: u.y, cost: 0 };
  let cands = [cur, ...reach.values()];
  const goals = u.ai.stance === 'objective' ? goalTiles(B, u) : [];
  const df = goals.length ? fieldTo(B, goals, u.mobility) : null;
  const hold = u.ai.stance === 'hold';
  const curFort = B.forts[u.y][u.x] || 0;
  let best = null, bestScore = -Infinity;
  for (const c of cands) {
    const isCur = c.x === u.x && c.y === u.y;
    if (hold && !isCur && manhattan(c, cur) > 2) continue;
    const tr = terrain(B.map, c.x, c.y);
    const fort = B.forts[c.y][c.x] || 0;
    const atk = bestAttackFrom(B, u, c, targets, api);
    const adj = adjacentEnemies(B.units, { ...u, x: c.x, y: c.y });
    let s = (atk ? atk.score + 12 : 0);
    s += (Math.max(0, tr.def) + FORT[fort].def * 0.6) * 40;
    s -= adj * (t.artillery ? 25 : 3);
    if (t.artillery && adj > 0) s -= 30;
    if (t.artillery && atk) s += Math.min(manhattan(c, atk.target), atk.weapon.rmax) * 2;   // 炮兵离得越远越好
    if (df) { const dc = df.get(key(c.x, c.y))?.cost; s -= (dc == null ? 60 : dc) * 2.5; }
    else if (u.ai.stance === 'attack' && !atk && targets.length) {
      const nearP = Math.min(...targets.map(p => manhattan(c, p)));
      s -= nearP * 2.5;
    }
    if (hold) {
      if (isCur) s += 15 + FORT[curFort].def * 20;
      else if (!atk) continue;                 // 守军没仗打就不挪窝
      else s -= 8;
    }
    s -= c.cost * 0.3;
    if (s > bestScore) { bestScore = s; best = { c, atk }; }
  }
  if (!best) return;
  if (best.c.x !== u.x || best.c.y !== u.y) {
    await api.moveUnit(u, best.c.x, best.c.y, { reach });
    if (!u.alive || u.offmap) return;
  }
  // 到位后重新找目标（可能踩雷停在半路）
  const atk = bestAttackFrom(B, u, u, visibleTargets(B, u), api);
  if (atk) await api.doAttack(u, atk.target, atk.weapon, {});
  u.acted = true;
}
