// 电脑骷髅 AI：随能量自动出兵 + 威胁等级渐进强化
import { UNITS, UNIT_ORDER, LANES, THREAT, ECONOMY } from './data/config.js';
import { spawnSquad } from './units.js';
import { spawnPoint } from './combat.js';

// 根据时间更新威胁等级
export function updateThreat(state) {
  let cur = THREAT[0];
  for (const tier of THREAT) {
    if (state.time >= tier.t) cur = tier;
  }
  state.threat = cur;
}

export function updateAI(state, dt) {
  const e = state.energy.enemy;
  // 电脑能量回复（按威胁等级）
  e.acc += dt;
  const regen = state.threat.regen;
  while (e.acc >= regen && e.value < ECONOMY.max) {
    e.acc -= regen;
    e.value = Math.min(ECONOMY.max, e.value + 1);
  }

  // 决策节流
  state.ai.timer -= dt;
  if (state.ai.timer > 0) return;
  state.ai.timer = 1.2 + Math.random() * 1.0;

  // 评估各路压力（玩家在该路的部队/是否逼近骷髅城楼）
  const laneThreat = [0, 0, 0];
  for (const u of state.units) {
    if (u.state === 'dead') continue;
    if (u.side === 'player') laneThreat[u.lane] += 1;
    else laneThreat[u.lane] -= 0.6;
  }

  // 只在仍可出兵的路里选（城楼被毁的路不可出兵；三路全毁则任意路都走主楼）
  const validLanes = [0, 1, 2].filter(i => spawnPoint(state, 'enemy', i));
  if (validLanes.length === 0) return;
  // 选最需要支援/施压的路：玩家兵力最多的路
  let lane = validLanes[0], best = -Infinity;
  for (const i of validLanes) {
    const score = laneThreat[i] + Math.random() * 0.5;
    if (score > best) { best = score; lane = i; }
  }
  // 偶尔随机换一条可用路施压
  if (Math.random() < 0.3) lane = validLanes[(Math.random() * validLanes.length) | 0];

  // 选兵种：优先能负担的较强单位，按压力调味
  const affordable = UNIT_ORDER.filter(k => UNITS[k].cost <= e.value);
  if (affordable.length === 0) return;

  let type;
  const r = Math.random();
  if (laneThreat[lane] >= 2 && affordable.includes('mage') && !mageOnLane(state, lane)) {
    type = 'mage'; // 压力大时驻法师防守
  } else if (affordable.includes('knight') && r < 0.35) {
    type = 'knight';
  } else if (affordable.includes('archer') && r < 0.65) {
    type = 'archer';
  } else {
    type = affordable.includes('infantry') ? 'infantry' : affordable[affordable.length - 1];
  }

  spawnAI(state, type, lane);

  // 高威胁等级偶发双倍出兵
  if (state.threat.double && Math.random() < 0.5) {
    const lane2 = (lane + 1) % 3;
    if (UNITS[type].cost <= state.energy.enemy.value) spawnAI(state, type, lane2);
  }
}

function spawnAI(state, type, lane) {
  const cost = UNITS[type].cost;
  if (state.energy.enemy.value < cost) return;
  if (type === 'mage') {
    // 法师需城楼存活且该路无驻塔法师
    const tower = state.buildings.find(b => b.side === 'enemy' && b.kind === 'tower' && b.lane === lane && b.alive);
    if (!tower || tower.mage) return;
  } else if (!spawnPoint(state, 'enemy', lane)) {
    return; // 该路城楼被毁且其它路尚存城楼 → 不可出兵
  }
  state.energy.enemy.value -= cost;
  spawnSquad(state, 'enemy', type, lane);
}

function mageOnLane(state, lane) {
  return state.units.some(u => u.side === 'enemy' && u.type === 'mage' && u.lane === lane && u.state !== 'dead');
}
