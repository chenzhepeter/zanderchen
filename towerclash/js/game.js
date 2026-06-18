// 游戏核心：全局状态 + 模拟推进 + 能量 + 投射物 + 胜负判定
import { ECONOMY, UNITS, THREAT, FIELD, SIDES, LANES } from './data/config.js';
import { dist, damageUnit, damageBuilding, addEffect, spawnPoint, nearestEnemyUnitToPoint } from './combat.js';
import { createBuildings, updateBuildings, keepOf } from './towers.js';
import { spawnSquad, spawnBlock, spawnSpecial, updateUnits, cleanupUnits } from './units.js';
import { updateAI, updateThreat } from './ai.js';

export function createGame() {
  const state = {
    time: 0,
    over: false,
    result: null, // 'win' | 'lose'
    threat: THREAT[0],
    units: [],
    buildings: [],
    projectiles: [],
    effects: [],
    energy: {
      player: { value: ECONOMY.start, acc: 0 },
      enemy: { value: ECONOMY.start, acc: 0 },
    },
    ai: { timer: 1.5 },
    selectedLane: 1, // 当前出兵城楼（路）
    pendingAction: null, // 放置路障 / 狙击瞄准 / 投石瞄准
    dirty: true,
  };
  state.buildings = createBuildings(state);
  return state;
}

// 玩家出兵（被 input/ui 调用）。返回是否成功。
export function playerSpawn(state, type) {
  if (state.over) return false;
  const cfg = UNITS[type];
  if (state.threat.lv < cfg.unlock) return false; // 该兵种尚未解锁（按威胁等级逐级解锁）
  const e = state.energy.player;
  if (e.value < cfg.cost) return false;
  const lane = state.selectedLane;
  if (type === 'mage') {
    // 法师需驻存活城楼（每城楼限一名），不能从主楼出
    const tower = state.buildings.find(b => b.side === 'player' && b.kind === 'tower' && b.lane === lane && b.alive);
    if (!tower) return false;
    if (tower.mage && tower.mage.state !== 'dead') return false;
  } else {
    // 该路城楼被毁则不能出兵；三城楼全毁时从主楼出
    if (!spawnPoint(state, 'player', lane)) return false;
  }
  e.value -= cfg.cost;
  spawnSquad(state, 'player', type, lane);
  return true;
}

export function canAfford(state, type) {
  return state.energy.player.value >= UNITS[type].cost;
}

// 玩家已部署的特殊结构（狙击手/投石机，每种限一座）
export function playerHasSpecial(state, type) {
  return state.units.find(u => u.side === 'player' && u.type === type && u.state !== 'dead') || null;
}

// 按钮点击分发：普通兵种直接出兵；路障/狙击/投石进入放置或瞄准模式。
// 返回状态码供 UI 反馈：ok/built/pending/locked/poor/cd/no
export function requestUnit(state, type) {
  if (state.over) return 'no';
  const cfg = UNITS[type];
  if (state.threat.lv < cfg.unlock) return 'locked';
  const e = state.energy.player;

  if (type === 'block') {
    if (e.value < cfg.cost) return 'poor';
    state.pendingAction = { type: 'placeBlock', cost: cfg.cost };
    return 'pending';
  }
  if (type === 'sniper' || type === 'catapult') {
    const ex = playerHasSpecial(state, type);
    if (!ex) {
      if (e.value < cfg.cost) return 'poor';
      const keep = state.buildings.find(b => b.side === 'player' && b.kind === 'keep' && b.alive);
      if (!keep) return 'no';
      e.value -= cfg.cost;
      spawnSpecial(state, 'player', type);
      return 'built';
    }
    if (ex.abilityTimer > 0) return 'cd';
    state.pendingAction = { type: type === 'sniper' ? 'aimSniper' : 'aimCatapult', unit: ex };
    return 'pending';
  }
  return playerSpawn(state, type) ? 'ok' : 'no';
}

// 解析战场点击（处于放置/瞄准模式时）
export function resolveTap(state, x, y) {
  const a = state.pendingAction;
  if (!a) return false;
  state.pendingAction = null;

  if (a.type === 'placeBlock') {
    const riverX = FIELD.W / 2 - 30;          // 仅自家半场（左侧）道路
    if (x > riverX) return true;              // 点到对方半场 → 取消
    const px = Math.max(SIDES.player.towerX + 30, Math.min(riverX, x));
    let lane = 0, ld = Infinity;
    for (const l of LANES) { const d = Math.abs(l.y - y); if (d < ld) { ld = d; lane = l.id; } }
    const e = state.energy.player;
    if (e.value >= a.cost) { e.value -= a.cost; spawnBlock(state, 'player', lane, px); }
    return true;
  }
  if (a.type === 'aimSniper') {
    const s = a.unit;
    if (s.state !== 'dead' && s.abilityTimer <= 0) {
      // 不能狙杀城楼/主楼上的人（法师、对方狙击手/投石机）
      const tgt = nearestEnemyUnitToPoint(state, 'player', x, y, 90, ['mage', 'sniper', 'catapult']);
      if (tgt) {
        tgt.hp = 0; tgt.state = 'dead'; tgt.deathT = 0;
        s.abilityTimer = UNITS.sniper.ability.cd; s.attackAnim = 1;
        addEffect(state, { type: 'snipe', x: s.x, y: s.y - 12, tx: tgt.x, ty: tgt.y - 12, life: 0.25 });
        addEffect(state, { type: 'hit', x: tgt.x, y: tgt.y - 12, life: 0.35, big: true });
      } else {
        state.pendingAction = a; // 没点到目标，保持瞄准
      }
    }
    return true;
  }
  if (a.type === 'aimCatapult') {
    const c = a.unit;
    if (c.state !== 'dead' && c.abilityTimer <= 0) {
      const cfg = UNITS.catapult;
      for (const o of state.units) {
        if (o.state === 'dead' || o.side === 'player') continue;
        if (dist(x, y, o.x, o.y - 10) <= cfg.aoe) damageUnit(state, o, cfg.dmg, { kind: 'orb' });
      }
      c.abilityTimer = cfg.ability.cd; c.attackAnim = 1;
      addEffect(state, { type: 'lob', x: c.x, y: c.y - 20, tx: x, ty: y, life: 0.6 });
      addEffect(state, { type: 'boom', x, y, life: 0.5, r: cfg.aoe });
    }
    return true;
  }
  return true;
}

export function update(state, dt) {
  if (state.over) { advanceEffects(state, dt); return; }
  state.time += dt;
  updateThreat(state);

  // 玩家能量回复
  const p = state.energy.player;
  p.acc += dt;
  while (p.acc >= ECONOMY.playerRegen && p.value < ECONOMY.max) {
    p.acc -= ECONOMY.playerRegen;
    p.value = Math.min(ECONOMY.max, p.value + 1);
  }

  updateAI(state, dt);
  updateUnits(state, dt);
  updateBuildings(state, dt);
  updateProjectiles(state, dt);
  advanceEffects(state, dt);
  cleanupUnits(state);

  checkOver(state);
}

function updateProjectiles(state, dt) {
  for (const pr of state.projectiles) {
    if (pr.dead) continue;
    pr.t += dt;

    if (pr.pierce) {
      // 直线穿透箭
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      for (const o of state.units) {
        if (o.state === 'dead' || o.side === pr.side) continue;
        if (pr.hitSet.has(o.id)) continue;
        if (dist(pr.x, pr.y, o.x, o.y - 12) < 22) {
          pr.hitSet.add(o.id);
          damageUnit(state, o, pr.dmg, { kind: pr.kind });
        }
      }
      if (pr.t > pr.life || pr.x < -50 || pr.x > 1330) pr.dead = true;
      continue;
    }

    if (pr.kind === 'orb' || pr.kind === 'shell') {
      // 飞向目标点，到点范围爆炸（炮弹为抛物线，视觉在渲染层处理）
      const d = dist(pr.x, pr.y, pr.tx, pr.ty);
      const step = pr.speed * dt;
      if (d <= step) {
        pr.x = pr.tx; pr.y = pr.ty;
        for (const o of state.units) {
          if (o.state === 'dead' || o.side === pr.side) continue;
          if (dist(pr.x, pr.y, o.x, o.y - 10) <= pr.aoe) damageUnit(state, o, pr.dmg, { kind: 'orb' });
        }
        addEffect(state, { type: 'boom', x: pr.x, y: pr.y, life: 0.4, r: pr.aoe });
        pr.dead = true;
      } else {
        pr.x += (pr.tx - pr.x) / d * step;
        pr.y += (pr.ty - pr.y) / d * step;
      }
      continue;
    }

    // 跟踪箭/弩矢（arrow / bolt）
    const tgt = pr.target;
    if (!tgt || (tgt.state === 'dead') || (tgt.alive === false)) { pr.dead = true; continue; }
    const ty = tgt.y - (pr.isBuilding ? 30 : 12);
    const d = dist(pr.x, pr.y, tgt.x, ty);
    const step = pr.speed * dt;
    if (d <= step + 6) {
      if (pr.isBuilding) damageBuilding(state, tgt, pr.dmg);
      else damageUnit(state, tgt, pr.dmg, { kind: pr.kind });
      addEffect(state, { type: 'hit', x: tgt.x, y: ty, life: 0.2 });
      pr.dead = true;
    } else {
      pr.x += (tgt.x - pr.x) / d * step;
      pr.y += (ty - pr.y) / d * step;
      pr.angle = Math.atan2(ty - pr.y, tgt.x - pr.x);
    }
    if (pr.t > pr.life) pr.dead = true;
  }
  state.projectiles = state.projectiles.filter(p => !p.dead);
}

function advanceEffects(state, dt) {
  for (const e of state.effects) e.t += dt;
  state.effects = state.effects.filter(e => e.t < e.life);
}

function checkOver(state) {
  const pk = keepOf(state, 'player');
  const ek = keepOf(state, 'enemy');
  if (ek && !ek.alive) { state.over = true; state.result = 'win'; }
  else if (pk && !pk.alive) { state.over = true; state.result = 'lose'; }
}
