// 电脑 AI：感知战场 → 评估攻防 → 反制选兵 → 经济与集火。比旧版随机出兵显著更强。
// 设计为 side 通用（aiStep(state, side)），便于对两侧分别驱动与离线对战测试。
import { UNITS, LANES, THREAT, ECONOMY, FIELD, SIDES, NPC_SCALE } from './data/config.js';
import { spawnSquad, spawnBlock, spawnSpecial } from './units.js';
import { spawnPoint } from './combat.js';

// 兵种归类（用于反制）
const CAT = { infantry: 'swarm', dog: 'swarm', archer: 'ranged', cannon: 'ranged', knight: 'tank', mage: 'caster' };
const MARCH_UNITS = ['infantry', 'dog', 'archer', 'knight', 'mage', 'cannon'];

// 调参
const DECIDE_MIN = 0.45, DECIDE_RAND = 0.4; // 决策间隔（更勤快）
const DEFEND_THRESH = 4.5;   // 触发主动防守的来袭威胁（小股骚扰交给箭塔处理，省下能量攒结构/攻坚波）
const ATTACK_MIN = 7;        // 攒够一波再打（足以"前排+攻坚炮"协同，避免单一廉价兵刷屏）
const MOMENTUM = 1.0;        // 集火同一路的倾向

export function updateThreat(state) {
  let cur = THREAT[0];
  for (const tier of THREAT) if (state.time >= tier.t) cur = tier;
  state.threat = cur;
}

// 游戏主循环只驱动电脑（enemy）侧
export function updateAI(state, dt) { aiStep(state, 'enemy', dt); }

export function aiStep(state, side, dt) {
  const opp = side === 'player' ? 'enemy' : 'player';
  const e = state.energy[side];

  // 能量回复
  e.acc += dt;
  const regen = state.threat.regen * NPC_SCALE.regen;
  while (e.acc >= regen && e.value < ECONOMY.max) { e.acc -= regen; e.value = Math.min(ECONOMY.max, e.value + 1); }

  // 决策节流（每侧独立）
  const mem = state.aiMem || (state.aiMem = {});
  const m = mem[side] || (mem[side] = { timer: 0, comp: { tank: 0, swarm: 0, ranged: 0, caster: 0 }, pushLane: 1 });
  m.timer -= dt;
  if (m.timer > 0) return;
  m.timer = DECIDE_MIN + Math.random() * DECIDE_RAND;

  // ===== 感知 =====
  const keepX = SIDES[side].keepX;
  const advOf = (x) => Math.max(0, 1 - Math.abs(x - keepX) / FIELD.W); // 对手越靠近我方基地→越接近 1

  const danger = [0, 0, 0];           // 各路来袭威胁（越深入我方越高）
  const oppDef = [0, 0, 0];           // 对手在各路的兵力（进攻该路的阻力）
  const compCur = { tank: 0, swarm: 0, ranged: 0, caster: 0 };
  for (const u of state.units) {
    if (u.state === 'dead') continue;
    if (u.side === opp) {
      const cost = UNITS[u.type].cost || 1;
      const adv = advOf(u.x);
      danger[u.lane] += cost * (0.35 + 0.9 * adv);
      oppDef[u.lane] += cost;
      const c = CAT[u.type]; if (c) compCur[c] += cost;
    }
  }
  // 对手成分做指数平滑，避免抖动
  for (const k in m.comp) m.comp[k] = m.comp[k] * 0.6 + compCur[k] * 0.4;
  const comp = m.comp;

  const oppTowerHp = [0, 1, 2].map(L => {
    const t = state.buildings.find(b => b.side === opp && b.kind === 'tower' && b.lane === L && b.alive);
    return t ? t.hp : 0;
  });

  const validLanes = [0, 1, 2].filter(L => spawnPoint(state, side, L));
  if (validLanes.length === 0) return;

  // ===== 选路：被压最重的路优先回防，否则集火最易突破的对手路 =====
  let defLane = -1, defMax = 0;
  for (const L of [0, 1, 2]) if (danger[L] > defMax) { defMax = danger[L]; defLane = L; }
  const defending = defMax >= DEFEND_THRESH && !!spawnPoint(state, side, defLane);

  let lane;
  if (defending) {
    lane = defLane;
  } else {
    let best = -Infinity; lane = validLanes[0];
    for (const L of validLanes) {
      const towerGone = oppTowerHp[L] === 0 ? 3 : 0;
      const sc = towerGone - oppTowerHp[L] / 1000 * 2 - oppDef[L] * 0.5 + (L === m.pushLane ? MOMENTUM : 0) + Math.random() * 0.4;
      if (sc > best) { best = sc; lane = L; }
    }
    m.pushLane = lane;
  }

  const aff = (k) => UNITS[k].cost <= e.value && state.threat.lv >= UNITS[k].unlock;
  const has = (type) => state.units.some(u => u.side === side && u.type === type && u.state !== 'dead');
  const mageOnLane = (L) => state.units.some(u => u.side === side && u.type === 'mage' && u.lane === L && u.state !== 'dead');
  const totalDanger = danger[0] + danger[1] + danger[2];

  // ===== 防御结构投资：解锁后尽快建造（自动开火，性价比极高，长期镇守主楼）=====
  // 狙击手秒杀闯入己方半场的单位、投石机轰炸密集团体——是 PvE 防守核心，应主动建。
  if (state.threat.lv >= UNITS.sniper.unlock && !has('sniper') && aff('sniper') && (totalDanger > 0.5 || e.value >= UNITS.sniper.cost + 2)) {
    return void doBuild(state, side, 'sniper');
  }
  if (state.threat.lv >= UNITS.catapult.unlock && !has('catapult') && aff('catapult') && (totalDanger > 1 || e.value >= UNITS.catapult.cost + 2)) {
    return void doBuild(state, side, 'catapult');
  }

  // ===== 路障：被压路放拒马拖住；进攻时封锁被压的次要路、集中兵力 =====
  if (defending && aff('block') && blocksOnLane(state, side, lane) === 0 && Math.random() < 0.7) {
    if (doBlock(state, side, lane)) return;
  }
  if (!defending) for (const L of [0, 1, 2]) {
    if (L !== lane && danger[L] >= DEFEND_THRESH && blocksOnLane(state, side, L) === 0 && aff('block') && Math.random() < 0.5) {
      if (doBlock(state, side, L)) return;
    }
  }

  // ===== 攒够一波再出手（小股骚扰交给箭塔；塔已破则趁势强攻）=====
  // 统一 burst 经济：避免每次决策只出最便宜的兵 → 既能凑齐攻坚炮波，也能攒出狙击/投石结构。
  const rush = oppTowerHp[lane] === 0;
  if (e.value < ATTACK_MIN && !rush) return;

  // 该路有己方拒马 → 只在其后布置远程兵（弓兵/炮手的箭与炮弹可越障攻击被卡住的敌人；近战会被自家拒马挡住）
  if (blocksOnLane(state, side, lane) > 0) {
    if (aff('cannon')) doSpawn(state, side, 'cannon', lane); // 炮手抛射越障 + 范围杀伤聚集在拒马前的敌群
    if (aff('archer')) doSpawn(state, side, 'archer', lane); // 弓兵越障射击
    return;
  }

  // ===== 组波（多兵种协同）：前排 + 攻坚炮(破塔) + 后排输出；防守时前排换克制兵 =====
  const front = defending
    ? defenderFor(comp, aff, mageOnLane, lane)
    : (oppTowerHp[lane] > 0 ? (aff('infantry') ? 'infantry' : attackFront(comp, aff)) : attackFront(comp, aff));
  if (front) doSpawn(state, side, front, lane);
  if (oppTowerHp[lane] > 0 && aff('cannon')) doSpawn(state, side, 'cannon', lane); // 攻坚破塔
  const back = attackBack(comp, aff, mageOnLane, lane);
  if (back) doSpawn(state, side, back, lane);
}

// —— 反制选兵 ——
function defenderFor(comp, aff, mageOnLane, lane) {
  // 对手多群兵 → 法师(驻塔 AoE+治疗) / 炮(AoE) / 弓
  if (comp.swarm > comp.ranged && comp.swarm >= comp.tank) {
    if (aff('mage') && !mageOnLane(lane)) return 'mage';
    if (aff('cannon')) return 'cannon';
    if (aff('archer')) return 'archer';
  }
  // 对手多远程 → 骑士(抗箭冲锋扑脸)
  if (comp.ranged >= comp.swarm && comp.ranged >= comp.tank && aff('knight')) return 'knight';
  // 对手多坦克 → 弓兵集火 + 狗减速
  if (comp.tank > comp.swarm && comp.tank > comp.ranged) {
    if (aff('archer')) return 'archer';
    if (aff('dog')) return 'dog';
  }
  // 默认：性价比前排
  return aff('infantry') ? 'infantry' : (aff('dog') ? 'dog' : (aff('archer') ? 'archer' : null));
}

function attackFront(comp, aff) {
  // 对手远程多 → 骑士扛箭破阵；否则便宜前排
  if (comp.ranged >= comp.tank && aff('knight')) return 'knight';
  if (aff('infantry')) return 'infantry';
  return aff('knight') ? 'knight' : (aff('dog') ? 'dog' : null);
}

function attackBack(comp, aff, mageOnLane, lane) {
  // 对手群兵多 → AoE；否则弓兵输出
  if (comp.swarm > comp.ranged && aff('cannon')) return 'cannon';
  if (aff('archer')) return 'archer';
  return null;
}

// —— 执行 ——
function doSpawn(state, side, type, lane) {
  const cost = UNITS[type].cost;
  if (state.energy[side].value < cost) return false;
  if (type === 'mage') {
    const t = state.buildings.find(b => b.side === side && b.kind === 'tower' && b.lane === lane && b.alive);
    if (!t || t.mage) return false;
  } else if (!spawnPoint(state, side, lane)) return false;
  state.energy[side].value -= cost;
  spawnSquad(state, side, type, lane);
  return true;
}
function doBuild(state, side, type) {
  const cost = UNITS[type].cost;
  if (state.energy[side].value < cost) return false;
  if (!state.buildings.some(b => b.side === side && b.kind === 'keep' && b.alive)) return false;
  state.energy[side].value -= cost;
  spawnSpecial(state, side, type);
  return true;
}
function doBlock(state, side, lane) {
  const cost = UNITS.block.cost;
  if (state.energy[side].value < cost) return false;
  const mid = FIELD.W / 2;
  const x = side === 'enemy'
    ? Math.max(mid + 40, SIDES.enemy.towerX - 130)
    : Math.min(mid - 40, SIDES.player.towerX + 130);
  state.energy[side].value -= cost;
  spawnBlock(state, side, lane, x);
  return true;
}
function blocksOnLane(state, side, lane) {
  return state.units.filter(u => u.side === side && u.type === 'block' && u.lane === lane && u.state !== 'dead').length;
}
