// 游戏核心：全局状态 + 模拟推进 + 能量 + 投射物 + 胜负判定
import { ECONOMY, UNITS, THREAT } from './data/config.js';
import { dist, damageUnit, damageBuilding, addEffect, spawnPoint } from './combat.js';
import { createBuildings, updateBuildings, keepOf } from './towers.js';
import { spawnSquad, updateUnits, cleanupUnits } from './units.js';
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
    dirty: true,
  };
  state.buildings = createBuildings(state);
  return state;
}

// 玩家出兵（被 input/ui 调用）。返回是否成功。
export function playerSpawn(state, type) {
  if (state.over) return false;
  const cfg = UNITS[type];
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

    if (pr.kind === 'orb') {
      // 飞向目标点，到点 AoE
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
