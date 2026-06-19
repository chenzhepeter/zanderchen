// 单位：生成、移动、索敌、攻击、兵种技能
import { UNITS, LANES, SIDES, FIELD, NPC_SCALE } from './data/config.js';
import {
  nextId, dist, damageUnit, damageBuilding, spawnProjectile, addEffect, addFloatText,
  nearestEnemyUnitInLane, nearestEnemyUnitInRange, enemyStructureOnLane, spawnPoint,
  bestBombCenter,
} from './combat.js';

const TOWER_MOUNTED = ['mage', 'sniper', 'catapult']; // 城楼/主楼上的人，狙击/投石不打

// 在有效出兵点生成一名单位（mage 例外：驻城楼顶）
export function makeUnit(state, side, type, lane, opts = {}) {
  const cfg = UNITS[type];
  const dir = SIDES[side].dir;
  const ai = !!(state.controllers && state.controllers[side] === 'ai'); // 仅 AI 侧吃威胁加成（再 ×0.9 下调）
  const hpMul = ai ? state.threat.hpMul * NPC_SCALE.stat : 1;

  const tower = state.buildings.find(b => b.side === side && b.kind === 'tower' && b.lane === lane && b.alive);
  let useLane = lane, x, baseY;

  if (opts.fixed) {
    // 指定位置生成（路障/狙击手/投石机）
    useLane = opts.fixed.lane ?? lane;
    x = opts.fixed.x;
    baseY = opts.fixed.baseY;
  } else if (type === 'mage') {
    // 驻塔：站在城楼顶
    x = tower ? tower.x : SIDES[side].towerX;
    baseY = (tower ? tower.y : LANES[lane].y) - 36;
  } else {
    // 城楼存活→从城楼出；三城楼全毁→从主楼出（归中路）
    const sp = spawnPoint(state, side, lane);
    useLane = sp ? sp.lane : lane;
    const startX = sp ? sp.x : SIDES[side].towerX;
    x = startX + dir * (28 + (opts.offset || 0));
    baseY = LANES[useLane].y + (opts.yo || 0);
  }
  const y = baseY;

  const u = {
    id: nextId(), side, type, cfg, lane: useLane, dir,
    x, y, baseY,
    hp: cfg.hp * hpMul, maxHp: cfg.hp * hpMul,
    dmgMul: ai ? state.threat.dmgMul * NPC_SCALE.stat : 1,
    state: 'march', target: null,
    atkTimer: 0, healTimer: cfg.heal ? cfg.heal.cd : 0,
    // 动画
    animTime: Math.random() * 6, walkPhase: 0, attackAnim: 0, hitFlash: 0, deathT: 0,
    // 骑士冲锋
    marchTime: 0, charging: false, chargeUsed: false,
    // 弓兵穿透
    shotCount: 0,
    // 狗减速 debuff
    slowUntil: 0, slowFactor: 1,
    // 狙击手/投石机技能冷却
    abilityTimer: 0,
    // 法师驻塔
    tower: type === 'mage' ? tower : null,
  };
  if (type === 'mage' && tower) tower.mage = u;
  return u;
}

export function spawnSquad(state, side, type, lane) {
  const cfg = UNITS[type];
  const out = [];
  const n = cfg.squad || 1;
  for (let i = 0; i < n; i++) {
    const yo = n > 1 ? (i - (n - 1) / 2) * 26 : (Math.random() * 16 - 8);
    const u = makeUnit(state, side, type, lane, { offset: i * 14, yo });
    state.units.push(u);
    out.push(u);
  }
  addEffect(state, { type: 'spawn', x: out[0].x, y: out[0].baseY, life: 0.5 });
  return out;
}

// 路障：放在自家半场某路的指定 x
export function spawnBlock(state, side, lane, x) {
  const u = makeUnit(state, side, 'block', lane, { fixed: { x, baseY: LANES[lane].y, lane } });
  state.units.push(u);
  addEffect(state, { type: 'spawn', x, y: LANES[lane].y, life: 0.5 });
  return u;
}

// 狙击手（主楼顶）/ 投石机（主楼旁）
export function spawnSpecial(state, side, type) {
  const keep = state.buildings.find(b => b.side === side && b.kind === 'keep' && b.alive);
  if (!keep) return null;
  const dir = SIDES[side].dir;
  const fixed = type === 'sniper'
    ? { x: keep.x, baseY: keep.y - 118, lane: 1 }            // 主楼顶
    : { x: keep.x + dir * 74, baseY: keep.y + 30, lane: 1 }; // 主楼旁（错开，不遮挡）
  const u = makeUnit(state, side, type, 1, { fixed });
  state.units.push(u);
  addEffect(state, { type: 'spawn', x: u.x, y: u.baseY, life: 0.5 });
  return u;
}

export function updateUnits(state, dt) {
  for (const u of state.units) {
    if (u.state === 'dead') { u.deathT += dt; continue; }
    u.animTime += dt;
    if (u.hitFlash > 0) u.hitFlash = Math.max(0, u.hitFlash - dt * 4);
    if (u.attackAnim > 0) u.attackAnim = Math.max(0, u.attackAnim - dt * 4);
    u.atkTimer = Math.max(0, u.atkTimer - dt);

    // 路障：静止、无攻击（仅可被摧毁）
    if (u.type === 'block') continue;
    // 狙击手/投石机：静止结构，每 5s 自动寻敌开火
    if (u.type === 'sniper' || u.type === 'catapult') { updateSpecial(state, u, dt); continue; }

    if (u.type === 'mage') { updateMage(state, u, dt); continue; }

    const ranged = u.cfg.kind === 'ranged';
    // 选目标：远程兵（弓兵）锁定最近威胁，可跨三路；近战兵守本路
    let target = ranged
      ? nearestEnemyUnitInRange(state, u.side, u.x, u.y, u.cfg.aggro)
      : nearestEnemyUnitInLane(state, u, u.cfg.aggro);
    let targetIsBuilding = false;
    if (!target) {
      target = enemyStructureOnLane(state, u.side, u.lane);
      targetIsBuilding = !!target;
    }
    u.target = target;

    if (!target) { marchForward(state, u, dt); continue; }

    const tx = target.x, ty = target.y;
    const reach = u.cfg.range + (u.cfg.radius || 12) + (targetIsBuilding ? 26 : (target.cfg ? target.cfg.radius : 0));
    // 需要向目标真实位置聚拢的情形：远程兵打（跨路）单位，或任何兵攻打建筑
    //（主楼居中且在城楼后方 → 上/下路单位需向内走到主楼跟前，而非沿本路边隔空攻击）
    const converge = ranged || targetIsBuilding;
    const gap = converge ? dist(u.x, u.y, tx, ty) : Math.abs(tx - u.x);

    if (gap > reach) {
      u.state = 'march';
      // converge 时向目标真实 (x,y) 靠拢；否则沿本路推进守线
      moveToward(state, u, tx, ty, dt, !converge);
    } else {
      u.state = 'fight';
      u.walkPhase = 0;
      u.facing = Math.sign(tx - u.x) || u.dir;
      if (u.atkTimer <= 0) doAttack(state, u, target, targetIsBuilding);
    }
  }
}

function marchForward(state, u, dt) {
  u.state = 'march';
  const goalX = u.dir > 0 ? 2000 : -800;
  moveToward(state, u, goalX, u.baseY, dt);
}

function moveToward(state, u, tx, ty, dt, snapLane = true) {
  const dirX = Math.sign(tx - u.x) || u.dir;
  u.facing = dirX;
  let speed = u.cfg.speed;
  // 减速 debuff（狗撕咬）
  if (u.slowUntil && state.time < u.slowUntil) speed *= (u.slowFactor || 1);
  // 友军避让减速（骑士踩踏：无视友军）
  if (!u.cfg.trample) {
    for (const o of state.units) {
      if (o === u || o.state === 'dead' || o.side !== u.side || o.lane !== u.lane) continue;
      if (o.type === 'block') continue;
      if (Math.sign(o.x - u.x) === dirX && Math.abs(o.x - u.x) < (u.cfg.radius + o.cfg.radius)) {
        speed *= 0.35; break;
      }
    }
  }
  u.x += dirX * speed * dt;
  // 路障阻挡：双方都无法穿过
  for (const o of state.units) {
    if (o === u || o.state === 'dead' || o.type !== 'block' || o.lane !== u.lane) continue;
    const gap = (o.x - u.x) * dirX;
    const minGap = u.cfg.radius + o.cfg.radius;
    if (gap > 0 && gap < minGap) { u.x = o.x - dirX * minGap; break; }
  }
  if (snapLane) {
    // 回到本路中心线
    u.y += (u.baseY - u.y) * Math.min(1, dt * 4);
  } else {
    // 远程兵向跨路目标纵向靠近
    const dy = ty - u.y;
    u.y += Math.sign(dy) * Math.min(Math.abs(dy), speed * dt * 0.7);
  }
  u.walkPhase += speed * dt * 0.05;
  // 骑士冲锋蓄力
  if (u.cfg.charge) {
    u.marchTime += dt;
    if (u.marchTime >= u.cfg.charge.time && !u.charging && !u.chargeUsed) {
      u.charging = true;
      addFloatText(state, u.x, u.y - 30, '冲锋!', '#ffd34d');
    }
  }
}

function doAttack(state, u, target, isBuilding) {
  u.atkTimer = u.cfg.atkCd;
  u.attackAnim = 1;
  let dmg = u.cfg.dmg * u.dmgMul;

  // 骑士冲锋：首次撞击双倍 + 击退
  if (u.cfg.charge && u.charging && !u.chargeUsed) {
    dmg *= u.cfg.charge.mult;
    u.charging = false;
    u.chargeUsed = true;
    // 仅击退可移动单位；路障/驻塔法师/狙击/投石等固定目标不被推动（避免"位置突然后退"）
    if (!isBuilding && target.state !== 'dead' && (target.cfg.speed || 0) > 0) {
      target.x += u.dir * u.cfg.charge.knockback;
      addEffect(state, { type: 'hit', x: target.x, y: target.y - 14, life: 0.3, big: true });
    }
    addFloatText(state, target.x, target.y - 34, '撞击!', '#ffd34d');
  }
  // 冲锋一旦停下交战即重置蓄力计时
  if (u.cfg.charge) u.marchTime = 0;

  if (u.cfg.kind === 'ranged') {
    fireArrow(state, u, target, dmg, isBuilding);
  } else {
    // 近战瞬时
    if (isBuilding) damageBuilding(state, target, dmg, { siege: !!u.cfg.siege });
    else {
      damageUnit(state, target, dmg, { kind: 'melee', attacker: u });
      // 狗撕咬：命中后给敌人套减速
      if (u.cfg.slow && target.state !== 'dead' && target.type !== 'block') {
        target.slowUntil = state.time + u.cfg.slow.dur;
        target.slowFactor = u.cfg.slow.factor;
        addFloatText(state, target.x, target.y - 26, '减速', '#7fd3ff');
      }
    }
  }
}

function fireArrow(state, u, target, dmg, isBuilding) {
  // 炮手：抛物线炮弹，落点范围爆炸
  if (u.cfg.proj === 'shell') {
    const d0 = Math.max(1, dist(u.x, u.y, target.x, target.y));
    spawnProjectile(state, {
      kind: 'shell', side: u.side, x: u.x, y: u.y - 16, x0: u.x, y0: u.y - 16,
      tx: target.x, ty: target.y, d0, speed: u.cfg.projSpeed, dmg, aoe: u.cfg.aoe, lane: u.lane,
    });
    return;
  }
  u.shotCount++;
  const pierce = u.cfg.pierceEvery && (u.shotCount % u.cfg.pierceEvery === 0);
  if (pierce && !isBuilding) {
    // 穿透箭：朝目标方向直线飞行（可跨路），贯穿沿途多个敌人
    const dx = target.x - u.x, dy = (target.y - 14) - (u.y - 14);
    const len = Math.hypot(dx, dy) || 1;
    spawnProjectile(state, {
      kind: 'arrow', side: u.side, x: u.x, y: u.y - 14,
      vx: dx / len * u.cfg.projSpeed, vy: dy / len * u.cfg.projSpeed, dmg, pierce: true,
      hitSet: new Set(), pierceMax: u.cfg.pierceMax || 3, life: 1.4, lane: u.lane,
    });
    addFloatText(state, u.x, u.y - 30, '穿透!', '#aef');
  } else {
    spawnProjectile(state, {
      kind: 'arrow', side: u.side, x: u.x, y: u.y - 14,
      target, isBuilding, speed: u.cfg.projSpeed, dmg, pierce: false, lane: u.lane,
    });
  }
}

function updateMage(state, u, dt) {
  // 城楼倒了法师已在 damageBuilding 里阵亡，这里兜底
  if (u.tower && !u.tower.alive) { u.state = 'dead'; u.deathT = 0; return; }
  // 治疗光环
  u.healTimer -= dt;
  if (u.healTimer <= 0) {
    u.healTimer = u.cfg.heal.cd;
    let healed = false;
    for (const o of state.units) {
      if (o.state === 'dead' || o.side !== u.side || o === u) continue;
      if (dist(u.x, u.y, o.x, o.y) <= u.cfg.heal.range && o.hp < o.maxHp) {
        o.hp = Math.min(o.maxHp, o.hp + u.cfg.heal.amount);
        addFloatText(state, o.x, o.y - 30, '+' + u.cfg.heal.amount, '#7CFF8A');
        healed = true;
      }
    }
    if (healed) addEffect(state, { type: 'heal', x: u.x, y: u.y, life: 0.6, r: u.cfg.heal.range });
  }
  // 法球：锁定射程内最近威胁（可跨三路）
  const enemyU = nearestEnemyUnitInRange(state, u.side, u.x, u.y, u.cfg.range);
  if (enemyU && u.atkTimer <= 0) {
    u.atkTimer = u.cfg.atkCd;
    u.attackAnim = 1;
    u.facing = u.dir;
    spawnProjectile(state, {
      kind: 'orb', side: u.side, x: u.x, y: u.y - 8,
      tx: enemyU.x, ty: enemyU.y, speed: u.cfg.projSpeed,
      dmg: u.cfg.dmg * u.dmgMul, aoe: u.cfg.aoe, lane: u.lane,
    });
  }
}

// 狙击手/投石机：每 5s 自动寻敌开火
function updateSpecial(state, u, dt) {
  u.abilityTimer = Math.max(0, u.abilityTimer - dt);
  if (u.abilityTimer > 0) return;
  if (u.type === 'sniper') {
    // 锁定闯入己方半场、最强(成本最高)的敌人；骑士打到 30% 血，其余秒杀。不打城楼上的人
    const mid = FIELD.W / 2;
    const kLeave = u.cfg.knightLeave || 0.3;
    let t = null, bestCost = -1;
    for (const o of state.units) {
      if (o.state === 'dead' || o.side === u.side) continue;
      if (TOWER_MOUNTED.includes(o.type)) continue;
      const inOwn = u.side === 'player' ? o.x < mid : o.x > mid;
      if (!inOwn) continue;
      if (o.type === 'knight' && o.hp <= o.maxHp * kLeave) continue; // 已残骑士不再浪费子弹
      const cost = (UNITS[o.type] && UNITS[o.type].cost) || 0;
      if (cost > bestCost || (cost === bestCost && (!t || o.hp > t.hp))) { bestCost = cost; t = o; }
    }
    if (!t) return;
    if (t.type === 'knight') { t.hp = Math.min(t.hp, t.maxHp * kLeave); t.hitFlash = 1; }
    else { t.hp = 0; t.state = 'dead'; t.deathT = 0; }
    u.abilityTimer = u.cfg.ability.cd; u.attackAnim = 1; u.facing = Math.sign(t.x - u.x) || u.dir;
    addEffect(state, { type: 'snipe', x: u.x, y: u.y - 12, tx: t.x, ty: t.y - 12, life: 0.25 });
    addEffect(state, { type: 'hit', x: t.x, y: t.y - 12, life: 0.35, big: true });
  } else {
    // 轰炸敌人最密集（潜在伤害最大）的团体；不砸城楼
    const c = bestBombCenter(state, u.side, u.cfg.aoe, TOWER_MOUNTED);
    if (!c) return;
    for (const o of state.units) {
      if (o.state === 'dead' || o.side === u.side) continue;
      if (dist(c.x, c.y, o.x, o.y - 10) <= u.cfg.aoe) damageUnit(state, o, u.cfg.dmg, { kind: 'orb' });
    }
    u.abilityTimer = u.cfg.ability.cd; u.attackAnim = 1;
    addEffect(state, { type: 'lob', x: u.x, y: u.y - 20, tx: c.x, ty: c.y, life: 0.6 });
    addEffect(state, { type: 'boom', x: c.x, y: c.y, life: 0.5, r: u.cfg.aoe });
  }
}

// 清理已淡出的尸体
export function cleanupUnits(state) {
  state.units = state.units.filter(u => !(u.state === 'dead' && u.deathT > 1.0));
}
