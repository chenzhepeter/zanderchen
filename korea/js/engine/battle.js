// 战斗控制器：一局战斗的全部规则流程（部署 → 我方回合 → 敌方回合 → … → 胜负）。
// 模块单例 B + cleanup 守卫的写法照搬 blackbeard/js/battle.js；与 UI/渲染的联系全部走 HOST 晚绑定
// （同 odyssey/js/vn.js 的 bindHost），所以本文件不 import ui/render，node 下也能跑（selftest.js）。
import { TERRAIN, FORT, IMPASSABLE } from '../data/terrain.js';
import { WEAPONS } from '../data/weapons.js';
import { UNIT_TYPES } from '../data/units.js';
import { ITEMS, GEAR } from '../data/items.js';
import { TACTICS } from '../data/tactics.js';
import { key, manhattan, chebyshev, terrain, computeReach, pathFrom, computeVision, adjacentEnemies, unitAt, unitMp, DIRS4, tilesInRange, inBounds } from './grid.js';
import { effMen, typeOf, currentWeapon, canFire, bestWeaponFor, resolveAttack, applyCasualties, addMorale, addFatigue, addXp, applyUnlocks, unitValue, scoreLevel } from './rules.js';
import { runEvents, findObj } from './script.js';
import { canUseTactic, tacticTargets, applyTactic } from './tactics.js';
import { runEnemyPhase } from './ai.js';

let HOST = {
  log: () => {}, say: async () => {}, refresh: () => {}, anim: async () => {}, onEnd: () => {}, toast: () => {}, mapChanged: () => {},
};
export function bindHost(h) { HOST = { ...HOST, ...h }; }

export let B = null;
export const getB = () => B;
let uidSeq = 1;

// 带种子的随机数（xorshift，照搬 odyssey/js/art/common.js 的 rng，但把内部状态暴露出来以便存档）
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  r.get = () => s; r.set = (v) => { s = v >>> 0 || 1; };
  return r;
}

const AIRBOMB = { id: 'airbomb', name: '空袭', atk: 24, rmin: 0, rmax: 99, ammo: 0, split: 0.55, vsArmor: 0.8, indirect: true, cls: 'air' };

// ===== 建立部队 =====
export function makeUnit(spec) {
  const t = UNIT_TYPES[spec.type];
  if (!t) throw new Error('未知兵种 ' + spec.type);
  const level = spec.level || 1;
  const u = {
    uid: spec.uid || uidSeq++, id: spec.id || ('u' + uidSeq), type: spec.type, side: spec.side || t.side, faction: t.faction,
    name: spec.name || t.name, x: spec.x, y: spec.y,
    men: spec.men ?? t.men, menMax: t.men, wounded: spec.wounded || 0,
    morale: spec.morale ?? t.morale, fatigue: spec.fatigue || 0,
    ammo: spec.ammo ?? t.ammo, ammoMax: t.ammo,
    weapons: spec.weapons ? [...spec.weapons] : [...t.weapons], weapon: spec.weapon || 0,
    gear: spec.gear ? [...spec.gear] : [], items: spec.items ? [...spec.items] : [],
    tactics: [...new Set([...(t.tactics || []), ...(spec.tactics || [])])],
    xp: spec.xp || 0, level, mobility: t.mobility,
    moved: false, acted: false, mp: 0, status: {}, cooldowns: {},
    ai: { stance: spec.stance || (t.side === 'e' ? 'attack' : 'hold'), target: spec.target || null },
    alive: true, offmap: false, roster: spec.roster || null, hero: !!spec.hero, named: spec.named || null,
    mines: t.mines || 0, bridges: t.bridges || 0, stock: t.stock || 0,
    lostKilled: 0, lostWounded: 0, restedTurn: 0,
  };
  if (u.side === 'e' && spec.level == null) u.level = B?.level?.enemyLevel || 1;
  applyUnlocks(u);
  return u;
}

// ===== 开局 =====
// opts: { roster: 花名册记录[], playerName, heroStats:{cmd,intel}, seed }
export function startBattle(level, opts = {}) {
  const map = { w: level.map[0].length, h: level.map.length, rows: [...level.map] };
  B = {
    level, map, objs: new Map(), forts: level.map.map(r => Array(r.length).fill(0)),
    units: [], turn: 1, phase: 'deploy', night: level.startTime === 'night', weather: level.weather || 'clear',
    flags: {}, firedEvents: new Set(), rng: makeRng(opts.seed || (Date.now() & 0xffffffff)),
    stats: { enemyCas: 0, enemyUnitsKilled: 0, ownKilled: 0, ownWounded: 0, captured: [], capturedItems: [], escaped: 0, breakthrough: 0, preserved: 0, objectives: 0, treasures: 0 },
    vision: new Set(), mineHit: false, turnLimitReached: false, result: null,
    playerName: opts.playerName || '师长', heroStats: opts.heroStats || { cmd: 1, intel: 1 },
    roster: opts.roster || [], deployed: [], busy: false,
  };
  B.night = level.startTime === 'night';
  for (const o of level.objs || []) B.objs.set(key(o.x, o.y), { ...o });
  for (const f of level.forts || []) B.forts[f.y][f.x] = f.level;
  for (const a of level.allies || []) B.units.push(makeUnit({ ...a, side: 'p' }));
  for (const e of level.enemies || []) B.units.push(makeUnit({ ...e, side: 'e', level: e.level || level.enemyLevel || 1 }));
  computeBreakRect();
  recomputeVision();
  return B;
}

export function cleanup() { B = null; }

// ===== 部署 =====
export function deployCells() {
  const out = [];
  for (const r of B.level.deploy || []) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
    if (!inBounds(B.map, x, y)) continue;
    if (terrain(B.map, x, y).cost.foot >= IMPASSABLE || terrain(B.map, x, y).water) continue;
    out.push({ x, y });
  }
  return out;
}
export function canDeployAt(x, y) {
  return deployCells().some(c => c.x === x && c.y === y) && !unitAt(B.units, x, y);
}
export function deployableRoster() {
  const reserved = new Set(B.level.reserved || []);
  return B.roster.filter(r => !reserved.has(r.id) && r.men > 0);
}
export function deployUnit(rosterId, x, y) {
  if (B.phase !== 'deploy') return { ok: false, msg: '现在不能部署' };
  const rec = B.roster.find(r => r.id === rosterId);
  if (!rec) return { ok: false, msg: '没有这支部队' };
  if ((B.level.reserved || []).includes(rosterId)) return { ok: false, msg: '这支部队本关由剧情安排出场' };
  if (!canDeployAt(x, y)) return { ok: false, msg: '这里不能部署' };
  const existing = B.units.find(u => u.roster === rosterId && u.alive);
  if (existing) { existing.x = x; existing.y = y; recomputeVision(); return { ok: true, unit: existing }; }
  const deployedCount = B.units.filter(u => u.roster && u.alive).length;
  if (deployedCount >= (B.level.maxDeploy || 8)) return { ok: false, msg: `本关最多上场 ${B.level.maxDeploy || 8} 支部队` };
  const u = unitFromRoster(rec, x, y);
  B.units.push(u);
  recomputeVision();
  return { ok: true, unit: u };
}
export function unitFromRoster(rec, x, y) {
  const t = UNIT_TYPES[rec.type];
  return makeUnit({
    ...rec, id: rec.id, roster: rec.id, side: 'p', x, y,
    men: rec.men ?? t.men, wounded: 0, fatigue: 0, ammo: t.ammo, morale: Math.max(60, rec.morale ?? t.morale),
    hero: !!rec.hero, level: rec.level, xp: rec.xp, weapons: rec.weapons, gear: rec.gear, items: rec.items, tactics: rec.tactics,
  });
}
export function undeployUnit(uid) {
  const i = B.units.findIndex(u => u.uid === uid && u.roster);
  if (i >= 0) { B.units.splice(i, 1); recomputeVision(); return true; }
  return false;
}
export function autoDeploy() {
  const cells = deployCells().filter(c => !unitAt(B.units, c.x, c.y));
  // 优先靠近部署区中心、地形防御高的格子
  const cx = cells.reduce((s, c) => s + c.x, 0) / (cells.length || 1), cy = cells.reduce((s, c) => s + c.y, 0) / (cells.length || 1);
  cells.sort((a, b) => (terrain(B.map, b.x, b.y).def - terrain(B.map, a.x, a.y).def) || (Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)));
  const pri = ['hero', 'hq', 'inf1', 'inf2', 'mg1', 'yue', 'du', 'art1', 'cheng', 'fu', 'eng1', 'med1', 'sup1'];
  const list = deployableRoster().filter(r => !B.units.some(u => u.roster === r.id));
  list.sort((a, b) => pri.indexOf(a.id) - pri.indexOf(b.id));
  for (const rec of list) {
    if (B.units.filter(u => u.roster && u.alive).length >= (B.level.maxDeploy || 8)) break;
    const c = cells.shift();
    if (!c) break;
    B.units.push(unitFromRoster(rec, c.x, c.y));
  }
  recomputeVision();
}
export async function finishDeploy() {
  if (B.phase !== 'deploy') return;
  if (!B.units.some(u => u.side === 'p' && u.roster)) return { ok: false, msg: '至少要部署一支部队' };
  B.phase = 'p';
  B.turn = 1;
  await startPlayerTurn();
  return { ok: true };
}

// ===== 昼夜/视野 =====
export function isNightTurn(turn) {
  const idx = Math.floor((turn - 1) / 2);
  return B.level.startTime === 'night' ? idx % 2 === 0 : idx % 2 === 1;
}
export function recomputeVision() {
  B.vision = computeVision(B.map, B.units, 'p', UNIT_TYPES, { night: B.night });
  if (B.level.revealAll) for (let y = 0; y < B.map.h; y++) for (let x = 0; x < B.map.w; x++) B.vision.add(key(x, y));
}
// 玩家能看见这支敌军吗（迷雾 + 埋伏 + 坑道）
export function playerCanSee(u) {
  if (u.side === 'p') return true;
  if (!B.vision.has(key(u.x, u.y))) return false;
  if (u.status?.ambush && !u.status.ambushRevealed) return false;
  return true;
}
export function visibleUnits() { return B.units.filter(u => u.alive && !u.offmap && playerCanSee(u)); }

// ===== 回合流程 =====
async function startPlayerTurn() {
  B.night = isNightTurn(B.turn);
  turnUpkeep('p');
  recomputeVision();
  HOST.refresh();
  await runEvents(B, { kind: 'turnStart', phase: 'p' }, effectApi);
  await checkEnd();
  HOST.refresh();
}

function turnUpkeep(side) {
  for (const u of B.units) {
    if (u.side !== side || !u.alive || u.offmap) continue;
    const t = typeOf(u);
    const idle = !u.moved && !u.acted && u.restedTurn !== B.turn - 1;
    u.moved = false; u.acted = false;
    u.status.march = false; u.status.nightraid = false; u.status.scout = false;
    if (u.status.confused > 0) u.status.confused--;
    for (const k of Object.keys(u.cooldowns)) if (u.cooldowns[k] > 0) u.cooldowns[k]--;
    u.mp = unitMp(u, t);
    // 什么都没干的部队自然恢复一点体力
    if (idle && B.turn > 1) addFatigue(u, -8);
    // 严寒（长津湖）：不在村庄/坑道且没穿棉衣的部队每回合疲劳上升，疲劳过高开始冻伤
    if (B.weather === 'snow' && !u.gear.includes('cotton') && !u.status.tunnel && B.turn > 1) {
      const sheltered = terrain(B.map, u.x, u.y).shelter;
      const mult = side === 'p' ? 1 : 0.5;
      if (!sheltered) {
        addFatigue(u, Math.round(6 * mult));
        if (u.fatigue > 60 && effMen(u) > 5) {
          const frost = Math.max(1, Math.round(effMen(u) * 0.03 * mult));
          u.wounded = Math.min(u.men, u.wounded + frost);
          if (side === 'p') B.stats.ownWounded += frost;
          HOST.log(`${u.name} 有 ${frost} 人冻伤。`, 'bad');
        }
      }
    }
    // 补给点
    if (u.ammo < u.ammoMax) {
      for (const o of B.objs.values()) {
        if (o.kind !== 'depot' || o.owner !== side) continue;
        if (manhattan(o, u) <= 1) { u.ammo = Math.min(u.ammoMax, u.ammo + 20); HOST.log(`${u.name} 在补给点补充了弹药。`, 'sys'); break; }
      }
    }
    // 士气：被包围 / 没弹药
    const adj = adjacentEnemies(B.units, u);
    if (adj >= 3) addMorale(u, -8);
    if (u.ammo <= 0) addMorale(u, -3);
    if (u.status.tunnel) addFatigue(u, -5);
  }
}

export async function endPlayerTurn() {
  if (!B || B.phase !== 'p' || B.busy) return;
  B.busy = true;
  try {
    B.phase = 'e';
    B.night = isNightTurn(B.turn);
    turnUpkeep('e');
    HOST.refresh();
    await runEvents(B, { kind: 'turnStart', phase: 'e' }, effectApi);
    if (B.phase === 'over') return;
    await airStrikes();
    if (B.phase === 'over') return;
    await runEnemyPhase(B, aiApi);
    if (B.phase === 'over') return;
    // 回合结束
    if (B.turn >= B.level.turns) {
      B.turnLimitReached = true;
      await checkEnd(true);
      if (B.phase === 'over') return;
    }
    B.turn++;
    B.phase = 'p';
    await startPlayerTurn();
  } finally {
    B.busy = false;
    HOST.refresh();
  }
}

// ===== 空袭 =====
async function airStrikes() {
  if (B.night || !(B.level.air > 0)) return;
  for (let i = 0; i < B.level.air; i++) {
    const cands = B.units.filter(u => u.side === 'p' && u.alive && !u.offmap && !u.status.tunnel && !terrain(B.map, u.x, u.y).hide);
    if (!cands.length) return;
    let total = 0;
    const weights = cands.map(u => {
      const t = typeOf(u), tr = terrain(B.map, u.x, u.y);
      let w = unitValue(u) / 50 + 1;
      if (tr.id === 'plain' || tr.id === 'snow') w *= 1.5;
      if (tr.road) w *= 1.3;
      if (t.supply || t.artillery) w *= 1.5;
      if (B.forts[u.y][u.x] >= 2) w *= 0.5;
      total += w; return w;
    });
    let r = B.rng() * total, target = cands[0];
    for (let k = 0; k < cands.length; k++) { r -= weights[k]; if (r <= 0) { target = cands[k]; break; } }
    const aa = B.units.find(u => u.side === 'p' && u.alive && !u.offmap && typeOf(u).aa && chebyshev(u, target) <= 2);
    if (aa && B.rng() < 0.5) {
      HOST.log(`✈️ 敌机扑向 ${target.name}，被 ${aa.name} 的高射机枪赶跑了！`, 'good');
      await HOST.anim('air', { x: target.x, y: target.y, repelled: true });
      continue;
    }
    const fake = { type: 'us_inf', men: 120, menMax: 120, wounded: 0, level: 2, morale: 80, fatigue: 0, side: 'e', status: {} };
    const res = resolveAttack(fake, target, AIRBOMB, ctxFor(fake, target, AIRBOMB), B.rng);
    await HOST.anim('air', { x: target.x, y: target.y, cas: res.cas });
    const routed = applyCasualties(target, res.killed, res.wounded);
    B.stats.ownKilled += res.killed; B.stats.ownWounded += res.wounded;
    addMorale(target, -Math.round(res.cas / target.menMax * 40));
    HOST.log(`✈️ 敌机空袭 ${target.name}：阵亡 ${res.killed}，受伤 ${res.wounded}。`, 'bad');
    if (routed) await killUnit(target, null);
    HOST.refresh();
  }
}

// ===== 移动 =====
export function reachFor(u) {
  if (!B || !u.alive || u.moved || u.status.tunnel || u.mp <= 0) return new Map();
  return computeReach(B.map, u, B.units, u.mp, B.objs, { seeAmbush: false });
}

// 沿路径移动；途中可能踩雷、撞上埋伏；到达后拾取缴获品、占领要点、出口撤离/逃离
export async function moveUnit(u, x, y, opts = {}) {
  const reach = opts.reach || reachFor(u);
  const node = reach.get(key(x, y));
  if (!node) return { ok: false, msg: '走不到那里' };
  let path = pathFrom(node);
  const walked = [path[0]];
  let stopReason = null;
  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    // 隐藏的敌军挡在格子上 → 发现并停在前一格
    const hidden = unitAt(B.units, p.x, p.y);
    if (hidden && hidden.side !== u.side) { hidden.status.ambushRevealed = true; stopReason = 'blocked'; break; }
    walked.push(p);
    // 地雷
    const o = B.objs.get(key(p.x, p.y));
    if (o && o.kind === 'mine' && o.owner !== u.side) { stopReason = 'mine'; break; }
    // 埋伏：走到隐藏敌军身边就停下
    const amb = B.units.find(e => e.alive && !e.offmap && e.side !== u.side && e.status.ambush && !e.status.ambushRevealed && manhattan(e, p) === 1);
    if (amb) { stopReason = 'ambush'; break; }
  }
  const dest = walked[walked.length - 1];
  const cost = reach.get(key(dest.x, dest.y))?.cost ?? node.cost;
  await HOST.anim('move', { unit: u, path: walked });
  u.x = dest.x; u.y = dest.y; u.moved = true; u.mp = 0;
  u.status.ambush = false; u.status.ambushRevealed = false;
  if (terrain(B.map, u.x, u.y).height >= 2) addFatigue(u, 3);
  if (B.night) addFatigue(u, 1);
  recomputeVision();
  if (stopReason === 'mine') await hitMine(u, dest);
  if (stopReason === 'ambush' && u.alive) await springAmbush(u);
  if (u.alive) await arrive(u);
  HOST.refresh();
  await runEvents(B, { kind: 'action' }, effectApi);
  await checkEnd();
  return { ok: true, stopped: stopReason };
}

async function hitMine(u, p) {
  const o = B.objs.get(key(p.x, p.y));
  B.objs.delete(key(p.x, p.y));
  const cas = Math.max(3, Math.round(effMen(u) * (0.08 + B.rng() * 0.08)));
  const killed = Math.round(cas * 0.5);
  await HOST.anim('explode', { x: p.x, y: p.y, text: `-${cas}` });
  const routed = applyCasualties(u, killed, cas - killed);
  addMorale(u, -12);
  if (u.side === 'p') { B.stats.ownKilled += killed; B.stats.ownWounded += cas - killed; }
  else { B.stats.enemyCas += cas; }
  if (o && o.owner === 'p' && u.side === 'e') B.mineHit = true;
  HOST.log(`💣 ${u.name} 踩上地雷：阵亡 ${killed}，受伤 ${cas - killed}。`, u.side === 'p' ? 'bad' : 'good');
  if (routed) await killUnit(u, null);
  if (B.mineHit) await runEvents(B, { kind: 'mine' }, effectApi);
}

// 走进埋伏圈：埋伏的一方先打一枪
async function springAmbush(victim) {
  const ambushers = B.units.filter(e => e.alive && !e.offmap && e.side !== victim.side && e.status.ambush && !e.status.ambushRevealed && manhattan(e, victim) === 1);
  for (const a of ambushers) {
    a.status.ambushRevealed = true;
    const w = bestWeaponFor(a, 1, victim);
    if (!w || !victim.alive) { a.status.ambush = false; continue; }
    HOST.log(`🌲 ${a.name} 伏击了 ${victim.name}！`, a.side === 'p' ? 'good' : 'bad');
    await doAttack(a, victim, w, { ambush: true, noCounter: true, free: true });
    a.status.ambush = false;
  }
}

async function arrive(u) {
  const k = key(u.x, u.y);
  const o = B.objs.get(k);
  if (!o) return;
  if (o.kind === 'treasure') {
    B.objs.delete(k);
    if (u.side === 'p') {
      giveLoot(u, o.item);
      B.stats.treasures++;
      HOST.log(`🎁 ${u.name} 拾取了 ${o.name || ITEMS[o.item]?.name || WEAPONS[o.item]?.name}。`, 'good');
      HOST.toast(`拾取：${o.name || ''}`);
    }
  } else if ((o.kind === 'flag' || o.kind === 'tunnel') && o.owner !== u.side && !typeOf(u).convoy) {
    const prev = o.owner;
    o.owner = u.side;
    if (prev === 'p') o.lostBefore = true;
    if (u.side === 'p') B.stats.objectives++;
    HOST.log(`🚩 ${u.name} ${u.side === 'p' ? '占领' : '夺取'}了 ${o.name}。`, u.side === 'p' ? 'good' : 'bad');
    await runEvents(B, { kind: 'objChange', obj: o }, effectApi);
  } else if (o.kind === 'exit' && o.owner === 'e' && u.side === 'e' && (u.ai.stance === 'flee' || u.ai.stance === 'convoy')) {
    u.offmap = true; B.stats.escaped++;
    HOST.log(`🏁 ${u.name} 逃出了战场。`, 'bad');
  }
}

function giveLoot(u, id) {
  if (WEAPONS[id]) { if (!u.weapons.includes(id) && u.weapons.length < 3) u.weapons.push(id); else B.stats.captured.push(id); }
  else if (ITEMS[id]) { if (id === 'cotton') { if (!u.gear.includes('cotton')) u.gear.push('cotton'); else u.items.push(id); } else u.items.push(id); }
}

// ===== 攻击 =====
export function attackTargets(u, weapon) {
  const w = weapon || currentWeapon(u);
  const out = [];
  if (!u.alive || u.acted || u.status.tunnel) return out;
  for (const e of B.units) {
    if (e.side === u.side || !e.alive || e.offmap) continue;
    if (e.status.tunnel && !(w.rmax === 1 && manhattan(u, e) === 1 && !w.indirect)) continue;   // 坑道里只能被邻格强攻
    if (u.side === 'p' && !playerCanSee(e)) continue;
    const d = manhattan(u, e);
    if (!canFire(u, w, d)) continue;
    out.push({ unit: e, dist: d, weapon: w });
  }
  return out;
}

function ctxFor(att, def, w, extra = {}) {
  const dt = terrain(B.map, def.x, def.y);
  const at = att.x != null ? terrain(B.map, att.x, att.y) : { height: 0 };
  return {
    night: B.night,
    attackerHeight: w.indirect ? 0 : at.height, defenderHeight: w.indirect ? 0 : dt.height,
    terrainDef: Math.max(0, dt.def) + (dt.def < 0 ? dt.def : 0),
    fortLevel: B.forts[def.y]?.[def.x] || 0,
    flank: adjacentEnemies(B.units, def),
    ambush: !!extra.ambush, nightraid: !!att.status?.nightraid && !extra.isCounter,
    isCounter: !!extra.isCounter, counterMult: extra.counterMult,
    protagonist: att.hero ? (B.heroStats?.cmd || 0) : 0,
    defTunnel: !!def.status?.tunnel, snow: B.weather === 'snow',
  };
}

export async function attack(u, target) {
  if (!B || B.phase !== 'p' || u.side !== 'p') return { ok: false, msg: '现在不能攻击' };
  if (u.acted) return { ok: false, msg: '这支部队本回合已经行动过了' };
  const w = currentWeapon(u);
  const d = manhattan(u, target);
  if (!canFire(u, w, d)) return { ok: false, msg: w.ammo > 0 && u.ammo < w.ammo ? '弹药不够' : '不在射程内' };
  if (target.status.tunnel && !(d === 1 && !w.indirect)) return { ok: false, msg: '敌人在坑道里，只能贴上去强攻' };
  const res = await doAttack(u, target, w, { ambush: !!u.status.ambush });
  u.acted = true; u.status.ambush = false; u.status.ambushRevealed = false;
  HOST.refresh();
  await runEvents(B, { kind: 'action' }, effectApi);
  await checkEnd();
  return { ok: true, res };
}

// 一次完整的攻击（含面杀伤、反击、死亡结算）。extra.free 表示不消耗行动
export async function doAttack(att, def, w, extra = {}) {
  const ctx = ctxFor(att, def, w, extra);
  const res = resolveAttack(att, def, w, ctx, B.rng);
  if (w.ammo > 0) att.ammo = Math.max(0, att.ammo - w.ammo);
  addFatigue(att, 5);
  await HOST.anim('attack', { from: att, to: def, weapon: w, cas: res.cas, killed: res.killed });
  const routed = applyCasualties(def, res.killed, res.wounded);
  bookCasualties(def, res);
  addMorale(def, -Math.round(res.cas / def.menMax * 40));
  addFatigue(def, 2);
  if (res.cas > 0) addMorale(att, 3);
  addXp(att, res.cas / 4 + 2);
  addXp(def, res.cas / 8);
  const who = att.side === 'p' ? 'good' : 'bad';
  const tag = extra.isCounter ? '反击' : (w.indirect ? '炮击' : '攻击');
  HOST.log(`${att.name} 用${w.name}${tag} ${def.name}：阵亡 ${res.killed}，受伤 ${res.wounded}${res.detail.length ? '（' + res.detail.join('，') + '）' : ''}`, who);
  // 面杀伤：目标四邻的敌军吃 40%
  if (w.area) {
    for (const [dx, dy] of DIRS4) {
      const o = unitAt(B.units, def.x + dx, def.y + dy);
      if (!o || o.side === att.side || o.status.tunnel) continue;
      const r2 = resolveAttack(att, o, w, ctxFor(att, o, w, { isCounter: false }), B.rng);
      const k2 = Math.round(r2.killed * (w.areaMult || 0.4)), wd2 = Math.round(r2.wounded * (w.areaMult || 0.4));
      if (k2 + wd2 <= 0) continue;
      const r3 = applyCasualties(o, k2, wd2);
      bookCasualties(o, { killed: k2, wounded: wd2, cas: k2 + wd2 });
      addMorale(o, -Math.round((k2 + wd2) / o.menMax * 30));
      HOST.log(`　波及 ${o.name}：阵亡 ${k2}，受伤 ${wd2}`, who);
      await HOST.anim('hit', { x: o.x, y: o.y, text: `-${k2 + wd2}` });
      if (r3) await killUnit(o, att);
    }
  }
  if (routed) { await killUnit(def, att); return { ...res, killedUnit: true, text: `阵亡 ${res.killed}，受伤 ${res.wounded}，${def.name} 溃散！` }; }
  // 反击
  if (!extra.noCounter && !extra.isCounter && !w.indirect && def.alive && def.morale >= 20 && !def.status.confused && !def.status.tunnel && !typeOf(def).artillery) {
    const cw = bestWeaponFor(def, manhattan(att, def), att);
    if (cw && !cw.indirect) {
      const cm = (cw.counter || 0.8) * (att.status?.nightraid ? 0.5 : 1);
      await doAttack(def, att, cw, { isCounter: true, counterMult: cm, noCounter: true });
    }
  }
  return { ...res, text: `阵亡 ${res.killed}，受伤 ${res.wounded}` };
}

function bookCasualties(u, res) {
  if (u.side === 'p') { B.stats.ownKilled += res.killed; B.stats.ownWounded += res.wounded; }
  else B.stats.enemyCas += res.cas;
}

export async function killUnit(u, by) {
  if (!u.alive) return;
  u.alive = false;
  const t = typeOf(u);
  await HOST.anim('die', { unit: u });
  if (u.side === 'e') {
    B.stats.enemyUnitsKilled++;
    HOST.log(`☠️ ${u.name} 被歼灭！`, 'good');
    if (by && by.side === 'p') {
      addXp(by, 25);
      addMorale(by, 10);
      for (const [id, chance] of t.loot || []) {
        if (B.rng() < chance) {
          if (WEAPONS[id]) { B.stats.captured.push(id); HOST.log(`　缴获 ${WEAPONS[id].name}`, 'good'); }
          else if (ITEMS[id]) { B.stats.capturedItems.push(id); HOST.log(`　缴获 ${ITEMS[id].name}`, 'good'); }
        }
      }
    }
    for (const o of B.units) if (o.side === 'e' && o.alive && !o.offmap && chebyshev(o, u) <= 2) addMorale(o, -6);
  } else {
    HOST.log(`💔 ${u.name} 失去战斗力，退出战场。`, 'bad');
    for (const o of B.units) if (o.side === 'p' && o.alive && !o.offmap && chebyshev(o, u) <= 2) addMorale(o, -5);
  }
  await runEvents(B, { kind: 'death', unit: u }, effectApi);
}

// ===== 其他行动 =====
export function rest(u) {
  if (u.acted || u.moved) return { ok: false, msg: '移动或行动之后不能休息' };
  addFatigue(u, -25); u.acted = true; u.moved = true; u.restedTurn = B.turn;
  if (u.wounded > 0) { const h = Math.min(u.wounded, Math.max(1, Math.round(u.wounded * 0.1))); u.wounded -= h; }
  HOST.log(`${u.name} 原地休息，疲劳 −25。`, 'sys');
  HOST.refresh();
  return { ok: true };
}
export function hold(u) { u.acted = true; u.moved = true; HOST.refresh(); return { ok: true }; }
export function setWeapon(u, idx) { if (idx >= 0 && idx < u.weapons.length) { u.weapon = idx; HOST.refresh(); } }

export function healTargets(u) {
  if (!typeOf(u).medic || u.acted) return [];
  return B.units.filter(o => o.side === u.side && o.alive && !o.offmap && o !== u && o.wounded > 0 && manhattan(o, u) <= 1);
}
export function heal(u) {
  const ts = healTargets(u);
  if (!ts.length) return { ok: false, msg: '相邻没有需要治疗的部队' };
  let total = 0;
  for (const o of ts) { const h = Math.min(o.wounded, 15 + u.level * 2); o.wounded -= h; total += h; addMorale(o, 3); }
  u.acted = true; addXp(u, total / 3);
  HOST.log(`🩺 ${u.name} 治疗了 ${total} 名伤员，他们重新归队。`, 'good');
  HOST.refresh();
  return { ok: true };
}
export function supplyTargets(u) {
  if (!typeOf(u).supply || u.acted || u.stock <= 0) return [];
  return B.units.filter(o => o.side === u.side && o.alive && !o.offmap && o !== u && o.ammo < o.ammoMax && manhattan(o, u) <= 1);
}
export function supplyAction(u) {
  const ts = supplyTargets(u);
  if (!ts.length) return { ok: false, msg: u.stock <= 0 ? '运输队的存货发完了' : '相邻没有缺弹药的部队' };
  let total = 0;
  for (const o of ts) { const n = Math.min(o.ammoMax - o.ammo, 20, u.stock); o.ammo += n; u.stock -= n; total += n; }
  u.acted = true; addXp(u, 4);
  HOST.log(`📦 ${u.name} 补充了 ${total} 单位弹药（剩余存货 ${u.stock}）。`, 'good');
  HOST.refresh();
  return { ok: true };
}
export function canRetreat(u) {
  const o = B.objs.get(key(u.x, u.y));
  return !!o && o.kind === 'exit' && o.owner === 'p';
}
export async function retreat(u) {
  if (!canRetreat(u)) return { ok: false, msg: '只有站在己方出口上才能撤退' };
  u.offmap = true; u.acted = true; B.stats.preserved++;
  HOST.log(`🏁 ${u.name} 撤出战场，保存了实力。`, 'sys');
  recomputeVision(); HOST.refresh();
  await checkEnd();
  return { ok: true };
}

export function useItem(u, idx) {
  const id = u.items[idx];
  const it = ITEMS[id];
  if (!it) return { ok: false, msg: '没有这个物品' };
  const e = it.effect;
  if (e.gear) { if (!u.gear.includes(e.gear)) u.gear.push(e.gear); }
  if (e.fatigue) addFatigue(u, e.fatigue);
  if (e.morale) addMorale(u, e.morale);
  if (e.heal) u.wounded = Math.max(0, u.wounded - e.heal);
  if (e.ammo) u.ammo = Math.min(u.ammoMax, u.ammo + e.ammo);
  if (e.mines) { u.mines = (u.mines || 0) + e.mines; }
  u.items.splice(idx, 1);
  HOST.log(`${u.name} 使用了${it.name}。`, 'sys');
  HOST.refresh();
  return { ok: true };
}

// ===== 策略 =====
export function tacticCheck(u, id) { return canUseTactic(B, u, id); }
export function tacticTargetList(u, id) { return tacticTargets(B, u, id); }
export async function useTactic(u, id, target) {
  if (u.acted) return { ok: false, msg: '本回合已经行动过了' };
  const c = canUseTactic(B, u, id);
  if (!c.ok) return c;
  const t = TACTICS[id];
  if (t.target !== 'self') {
    const list = tacticTargets(B, u, id);
    const hit = list.find(x => x.x === target?.x && x.y === target?.y);
    if (!hit) return { ok: false, msg: '目标不合法' };
    target = hit;
  }
  const msg = applyTactic(B, u, id, target, tacticApi);
  if (id !== 'march' && id !== 'ambush' && id !== 'tunnel') u.acted = true;
  if (id === 'ambush' || id === 'tunnel') { u.acted = true; u.moved = true; }
  HOST.log(`🎯 ${msg}`, 'good');
  recomputeVision();
  HOST.refresh();
  await runEvents(B, { kind: 'action' }, effectApi);
  await checkEnd();
  return { ok: true, msg };
}
const tacticApi = {
  recomputeVision,
  mapChanged: () => HOST.mapChanged(),
  directDamage: (att, def, w, extra) => {
    // 同步版本的伤害（火攻）：不走动画等待
    const res = resolveAttack(att, def, w, ctxFor(att, def, w, extra), B.rng);
    const routed = applyCasualties(def, res.killed, res.wounded);
    bookCasualties(def, res);
    addMorale(def, -Math.round(res.cas / def.menMax * 40));
    addXp(att, res.cas / 3 + 4);
    HOST.anim('hit', { x: def.x, y: def.y, text: `-${res.cas}` });
    if (routed) killUnit(def, att);
    return { ...res, text: `阵亡 ${res.killed}，受伤 ${res.wounded}${routed ? '，' + def.name + ' 溃散！' : ''}` };
  },
};

// ===== 事件效果 =====
const effectApi = {
  async effect(act) {
    switch (act.type) {
      case 'say': await HOST.say(act.lines); break;
      case 'flag': B.flags[act.flag] = true; break;
      case 'toast': HOST.toast(act.text); break;
      case 'log': HOST.log(act.text, 'sys'); break;
      case 'spawn':
        for (const s of act.units) {
          const spot = freeSpot(s.x, s.y);
          if (!spot) continue;
          const u = makeUnit({ ...s, x: spot.x, y: spot.y, side: s.side || 'e', level: s.level || (s.side === 'p' ? 1 : B.level.enemyLevel || 1) });
          B.units.push(u);
          await HOST.anim('spawn', { unit: u });
        }
        recomputeVision(); HOST.refresh();
        break;
      case 'spawnRoster':
        act.ids.forEach((id, i) => {
          const rec = B.roster.find(r => r.id === id);
          if (!rec || rec.men <= 0) return;
          const at = act.at[i] || act.at[0];
          const spot = freeSpot(at.x, at.y);
          if (!spot) return;
          const u = unitFromRoster(rec, spot.x, spot.y);
          u.mp = unitMp(u, typeOf(u));
          B.units.push(u);
          HOST.anim('spawn', { unit: u });
        });
        recomputeVision(); HOST.refresh();
        break;
      case 'stance':
        for (const u of B.units) if (act.ids.includes(u.id)) { u.ai.stance = act.stance; if (act.target) u.ai.target = act.target; }
        break;
      case 'addObj': B.objs.set(key(act.obj.x, act.obj.y), { ...act.obj }); HOST.refresh(); break;
      case 'removeObj': B.objs.delete(key(act.x, act.y)); HOST.refresh(); break;
      case 'objOwner': { const o = findObj(B, act.id); if (o) o.owner = act.owner; break; }
      case 'morale': for (const u of B.units) if (u.side === act.side && u.alive) addMorale(u, act.n); break;
      case 'win': await finish(true); break;
      case 'lose': await finish(false); break;
    }
  },
};
function freeSpot(x, y) {
  if (inBounds(B.map, x, y) && !unitAt(B.units, x, y) && terrain(B.map, x, y).cost.foot < IMPASSABLE) return { x, y };
  for (let r = 1; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy;
    if (inBounds(B.map, nx, ny) && !unitAt(B.units, nx, ny) && terrain(B.map, nx, ny).cost.foot < IMPASSABLE) return { x: nx, y: ny };
  }
  return null;
}

// ===== AI 用的接口 =====
const aiApi = {
  reachFor, moveUnit, doAttack, killUnit, ctxFor, rest,
  playerUnits: () => B.units.filter(u => u.side === 'p' && u.alive && !u.offmap),
  refresh: () => HOST.refresh(),
  log: (t, k) => HOST.log(t, k),
  checkEnd,
  // 敌军到达"突破线"（铁原）：离开战场并计数
  async afterEnemyMove(u) {
    const rect = B.breakRect;
    if (rect && u.alive && !u.offmap && u.x >= rect.x0 && u.x <= rect.x1 && u.y >= rect.y0 && u.y <= rect.y1) {
      u.offmap = true; B.stats.breakthrough++;
      HOST.log(`⚠️ ${u.name} 突破了我军防线！`, 'bad');
    }
    await runEvents(B, { kind: 'action' }, effectApi);
  },
};

// ===== 胜负 =====
function evalCond(c) {
  const alive = (u) => u.alive && !u.offmap;
  switch (c.type) {
    case 'enemyAliveLte': return B.units.filter(u => u.side === 'e' && alive(u)).length <= c.n;
    case 'objOwner': { const o = findObj(B, c.id); return !!o && o.owner === c.owner; }
    case 'escapedLte': return B.stats.escaped <= c.n;
    case 'escapedGte': return B.stats.escaped >= c.n;
    case 'turnLimit': return B.turnLimitReached;
    case 'unitDead': { const u = B.units.find(x => x.id === c.id); return !!u && !u.alive; }
    case 'reach': return B.units.filter(u => u.side === 'p' && alive(u) && u.x >= c.rect.x0 && u.x <= c.rect.x1 && u.y >= c.rect.y0 && u.y <= c.rect.y1).length >= c.n;
    case 'flagsOwnedGte': return c.ids.filter(id => findObj(B, id)?.owner === c.owner).length >= c.n;
    case 'enemyReachLte': return B.stats.breakthrough <= c.n;
    case 'enemyReachGte': return B.stats.breakthrough >= c.n;
    case 'preservedRatioGte': {
      const mine = B.units.filter(u => u.side === 'p');
      const ok = mine.filter(u => u.alive).length;   // 撤退的 offmap 但 alive
      return mine.length === 0 ? false : ok / mine.length >= c.r;
    }
    case 'heroDead': { const h = B.units.find(u => u.hero); return !!h && !h.alive; }
    case 'hqDead': { const h = B.units.find(u => u.side === 'p' && typeOf(u).hq); return !!h && !h.alive; }
    case 'flag': return !!B.flags[c.flag];
  }
  return false;
}
export function winProgress() {
  const w = B.level.win;
  const list = w.all || w.any || [];
  return list.map(c => ({ cond: c, ok: evalCond(c), text: condText(c) }));
}
export function condText(c) {
  switch (c.type) {
    case 'enemyAliveLte': return `地图上剩余敌军 ≤ ${c.n}（现在 ${B.units.filter(u => u.side === 'e' && u.alive && !u.offmap).length}）`;
    case 'objOwner': return `${c.owner === 'p' ? '占领/守住' : '敌占'} ${findObj(B, c.id)?.name || c.id}`;
    case 'escapedLte': return `逃脱的敌军 ≤ ${c.n}（现在 ${B.stats.escaped}）`;
    case 'escapedGte': return `逃脱的敌军 ≥ ${c.n}`;
    case 'turnLimit': return `坚持到第 ${B.level.turns} 回合结束`;
    case 'unitDead': return `消灭 ${B.units.find(x => x.id === c.id)?.name || c.id}`;
    case 'reach': return `${c.n} 支部队抵达指定区域`;
    case 'flagsOwnedGte': return `${c.ids.map(id => findObj(B, id)?.name).join('、')} 中至少 ${c.n} 处在我手`;
    case 'enemyReachLte': return `突破防线的敌军 ≤ ${c.n}（现在 ${B.stats.breakthrough}）`;
    case 'enemyReachGte': return `突破防线的敌军 ≥ ${c.n}`;
    case 'preservedRatioGte': return `保存 ${Math.round(c.r * 100)}% 以上的部队`;
    case 'heroDead': return '主角部队被消灭';
    case 'hqDead': return '师指挥部被消灭';
  }
  return c.type;
}
export async function checkEnd(atLimit = false) {
  if (!B || B.phase === 'over') return true;
  for (const c of B.level.lose || []) {
    if (c.type === 'turnLimit') continue;
    if (evalCond(c)) { await finish(false, condText(c)); return true; }
  }
  const w = B.level.win;
  const ok = w.all ? w.all.every(evalCond) : w.any ? w.any.some(evalCond) : false;
  if (ok) { await finish(true); return true; }
  if (atLimit || B.turnLimitReached) { await finish(false, '回合耗尽，任务未完成'); return true; }
  return false;
}
async function finish(win, reason = '') {
  if (!B || B.phase === 'over') return;
  B.phase = 'over';
  const s = B.stats;
  const score = win ? scoreLevel({ killed: s.enemyCas, captured: s.captured.length + s.capturedItems.length + s.treasures, ownKilled: s.ownKilled, turnsUsed: B.turn, turnLimit: B.level.turns, objectives: s.objectives, preserved: s.preserved }) : 0;
  B.result = { win, reason, score, turn: B.turn, stats: { ...s } };
  HOST.log(win ? '🎖️ 任务完成！' : `❌ 任务失败：${reason}`, win ? 'good' : 'bad');
  HOST.refresh();
  await HOST.onEnd(B.result);
}

// ===== 存档（战斗中）=====
export function serializeBattle() {
  if (!B) return null;
  return {
    levelNum: B.level.num, turn: B.turn, phase: B.phase, night: B.night, weather: B.weather,
    rows: B.map.rows, objs: [...B.objs.values()], forts: B.forts, units: B.units, flags: B.flags,
    fired: [...B.firedEvents], rng: B.rng.get(), stats: B.stats, mineHit: B.mineHit, turnLimitReached: B.turnLimitReached,
    playerName: B.playerName, heroStats: B.heroStats, roster: B.roster, uidSeq,
  };
}
export function restoreBattle(level, data) {
  startBattle(level, { roster: data.roster, playerName: data.playerName, heroStats: data.heroStats, seed: 1 });
  B.map.rows = [...data.rows];
  B.objs = new Map(data.objs.map(o => [key(o.x, o.y), o]));
  B.forts = data.forts;
  B.units = data.units.map(u => ({ ...u, status: u.status || {}, cooldowns: u.cooldowns || {}, ai: u.ai || { stance: 'hold' } }));
  B.turn = data.turn; B.phase = data.phase === 'e' ? 'p' : data.phase; B.night = data.night; B.weather = data.weather;
  B.flags = data.flags || {}; B.firedEvents = new Set(data.fired || []);
  B.rng.set(data.rng); B.stats = data.stats; B.mineHit = data.mineHit; B.turnLimitReached = data.turnLimitReached;
  uidSeq = Math.max(uidSeq, data.uidSeq || 1);
  computeBreakRect();
  recomputeVision();
  return B;
}
function computeBreakRect() {
  const c = (B.level.lose || []).find(x => x.type === 'enemyReachGte') || (B.level.win?.all || []).find(x => x.type === 'enemyReachLte');
  B.breakRect = c ? c.rect : null;
}

// 调试/自测接口（同 blackbeard 的 _rules）
export const debugApi = aiApi;
export const _rules = { evalCond, ctxFor, turnUpkeep, airStrikes, makeRng, get B() { return B; } };
