import { DEFENDERS, BUGS, ANGLES, WORLD, CORE, POWER_LEVELS } from './data/config.js';
import { SLOT_BY_ID } from './battlefield.js';
import { distance, angleDiff, moveToward, lineClear, coreBlocks, outsideSide } from './geometry.js';
import { emit } from './state.js';
import { addBlast, addImpact } from './effects.js';

export class SpatialIndex {
  constructor(enemies) { this.cells = new Map(); for (const e of enemies) if (e.hp > 0) { const key = `${Math.floor(e.x / 8)},${Math.floor(e.y / 8)}`; if (!this.cells.has(key)) this.cells.set(key, []); this.cells.get(key).push(e); } }
  query(p, radius) { const out = []; for (let x = Math.floor((p.x - radius) / 8); x <= Math.floor((p.x + radius) / 8); x++) for (let y = Math.floor((p.y - radius) / 8); y <= Math.floor((p.y + radius) / 8); y++) for (const e of this.cells.get(`${x},${y}`) || []) if (e.hp > 0 && distance(p, e) <= radius) out.push(e); return out; }
}
export function legalTarget(state, unit, enemy) {
  const cfg = DEFENDERS[unit.type], air = BUGS[enemy.type].air;
  if (enemy.hp <= 0 || unit.hp <= 0 || unit.path.length || unit.deployTime > 0) return false;
  if (unit.type === 'sam' && !air || (unit.type === 'cannon' || unit.type === 'flamethrower') && air) return false;
  const range = air ? cfg.airRange ?? cfg.range : cfg.range;
  if (distance(unit, enemy) > range) return false;
  const baseAngle = ANGLES[unit.side] ?? 0;
  if (cfg.arc < Math.PI * 2 && angleDiff(Math.atan2(enemy.y - unit.y, enemy.x - unit.x), baseAngle) > cfg.arc / 2) return false;
  if (air || unit.type === 'cannon') return true;
  const exempt = unit.slotId && outsideSide(enemy, unit.side) ? unit.side : null;
  return lineClear(unit, enemy, state.walls, exempt) && !coreBlocks(unit, enemy);
}
export function hurtEnemy(state, enemy, amount, damageKind, source = null) {
  if (enemy.hp <= 0) return;
  const actual = Math.min(enemy.hp, amount * (damageKind === 'bullet' ? BUGS[enemy.type].armor ?? 1 : damageKind === 'fire' && BUGS[enemy.type].armor ? 0.65 : 1));
  enemy.hp = Math.max(0, enemy.hp - actual); enemy.hit = 0.12;
  if (actual > 0) addImpact(state, enemy, damageKind === 'explosion');
  if (source) { source.damageDealt += actual; state.roundStats.damage[source.type] = (state.roundStats.damage[source.type] || 0) + actual; }
  if (!enemy.hp) {
    const reward = BUGS[enemy.type].reward;
    state.stats.kills++; state.roundStats.kills++; state.credits += reward;
    state.stats.earned = (state.stats.earned || 0) + reward; state.roundStats.earned = (state.roundStats.earned || 0) + reward;
    state.effects.push({ type: 'corpse', x: enemy.x, y: enemy.y, angle: enemy.angle, bug: enemy.type, seed: state.nextId, life: 12, maxLife: 12 });
    state.effects.push({ type: 'reward', x: enemy.x, y: enemy.y, amount: reward, life: 1.1, maxLife: 1.1 });
  }
}
function explode(state, p, damage, radius, source, index) {
  addBlast(state, p, radius, p.kind || 'shell');
  for (const e of index.query(p, radius)) if (!BUGS[e.type].air && lineClear(p, e, state.walls) && !coreBlocks(p, e)) {
    const before = e.hp;
    hurtEnemy(state, e, damage, 'explosion', source);
    if (p.kind === 'bomb') { e.stun = 0.9; state.roundStats.damage.bomb = (state.roundStats.damage.bomb || 0) + before - e.hp; }
  }
}
export function throwBomb(state, target) {
  if (!['combat', 'paused'].includes(state.phase)) return { ok: false, message: '战斗开始后才能投掷炸弹' };
  if (!Number.isFinite(target?.x) || !Number.isFinite(target?.y) || target.x < 0 || target.x > WORLD.w || target.y < 0 || target.y > WORLD.h || distance(CORE, target) > DEFENDERS.bomb.range) return { ok: false, message: '请选择战场内的投掷落点' };
  if (state.bombs < 1) return { ok: false, message: '炸弹已用完，可以实时补充' };
  if (state.bombCooldown > 0) return { ok: false, message: '投掷准备中，请稍候' };
  const origin = state.defenders.filter(u => u.type === 'infantry' && u.hp > 0).sort((a, b) => distance(a, target) - distance(b, target))[0] || CORE;
  state.bombs--; state.bombCooldown = DEFENDERS.bomb.cooldown; state.roundStats.bombsUsed++;
  state.projectiles.push({ id: `p${state.nextId++}`, kind: 'bomb', x: origin.x, y: origin.y, sx: origin.x, sy: origin.y, tx: target.x, ty: target.y, sourceId: null, damage: DEFENDERS.bomb.damage, radius: DEFENDERS.bomb.splash, time: 0, duration: Math.max(0.65, Math.min(1.4, distance(origin, target) / 32)), life: 4, trail: [] });
  emit(state, 'throw', ''); return { ok: true };
}
export function updateTroops(state, dt) {
  for (const u of state.defenders) {
    if (u.hp <= 0 || u.deployTime > 0) continue;
    u.hit = Math.max(0, (u.hit || 0) - dt);
    if (!u.path.length) continue;
    if (moveToward(u, u.path[0], 5.5 * dt)) u.path.shift();
    if (!u.path.length && u.destination) {
      const slot = SLOT_BY_ID[u.destination];
      Object.assign(u, { slotId: slot.id, side: slot.side, angle: ANGLES[slot.side] ?? 0, destination: null });
    }
  }
}
export function updateCombat(state, dt) {
  for (const enemy of state.enemies) if (enemy.hp > 0 && enemy.burnTime > 0) {
    enemy.burnAcc = (enemy.burnAcc || 0) + Math.min(dt, enemy.burnTime);
    enemy.burnTime = Math.max(0, enemy.burnTime - dt);
    if (enemy.burnAcc >= 0.2 - 1e-9 || enemy.burnTime === 0) {
      hurtEnemy(state, enemy, enemy.burnDamage * enemy.burnAcc, 'fire', state.defenders.find(u=>u.id===enemy.burnSource));
      enemy.burnAcc = 0;
    }
  }
  const index = new SpatialIndex(state.enemies);
  const reservations = new Map();
  for (const p of state.projectiles) if (p.targetId) reservations.set(p.targetId, (reservations.get(p.targetId) || 0) + p.damage);
  for (const unit of state.defenders) {
    if (unit.hp <= 0) continue;
    const cfg = DEFENDERS[unit.type];
    if (unit.deployTime > 0) { unit.deployTime = Math.max(0, unit.deployTime - dt); unit.status = unit.refitting ? '改装中 · 暂停射击' : '增援部署中'; if(unit.deployTime===0)unit.refitting=false; continue; }
    unit.cooldown = Math.max(0, unit.cooldown - dt);
    if (unit.path.length) { unit.status = '调动中 · 暂停射击'; continue; }
    const candidates = index.query(unit, cfg.range).filter(e => legalTarget(state, unit, e));
    const unreserved = candidates.filter(e => e.hp > (reservations.get(e.id) || 0));
    const pool = unreserved.length ? unreserved : candidates;
    const score = e => {
      let value = distance(unit, e);
      if (e.id === state.focusId) value -= 100000;
      if (unit.type === 'cannon') value -= e.type === 'armor' ? 10000 : index.query(e, cfg.splash).filter(o => !BUGS[o.type].air).length * 12;
      if (unit.type === 'machinegun' && BUGS[e.type].air) value += 500;
      if (e.stage === 'inside') value -= 70;
      return value;
    };
    pool.sort((a, b) => score(a) - score(b));
    const target = pool[0];
    unit.targetId = target?.id ?? null;
    if (!target) { unit.status = '警戒 · 射界内无可攻击目标'; continue; }
    const wantedAngle = Math.atan2(target.y - unit.y, target.x - unit.x);
    const delta = Math.atan2(Math.sin(wantedAngle - unit.angle), Math.cos(wantedAngle - unit.angle));
    unit.angle += Math.sign(delta) * Math.min(Math.abs(delta), (unit.type === 'cannon' ? 2 : 7) * dt);
    if (unit.cooldown > 0) { unit.status = unit.type === 'flamethrower' ? '持续喷射' : unit.type === 'infantry' || unit.type === 'machinegun' ? '压制射击' : '装填中'; continue; }
    if (Math.abs(delta) > 0.18) { unit.status = '转向瞄准'; continue; }
    unit.cooldown = cfg.cooldown; unit.fire = 0.12;
    const power = POWER_LEVELS[(unit.level || 1) - 1];
    const damage = cfg.damage * power * (BUGS[target.type].air ? cfg.airMult ?? 1 : 1);
    if (unit.type === 'flamethrower') {
      unit.flameTime = 0.2; unit.status = '扇面喷火';
      for (const enemy of candidates) if (angleDiff(Math.atan2(enemy.y-unit.y,enemy.x-unit.x),unit.angle) <= cfg.flameArc/2) {
        hurtEnemy(state,enemy,damage,'fire',unit);
        enemy.burnTime=cfg.burnDuration;enemy.burnDamage=cfg.burnDamage*power;enemy.burnSource=unit.id;
      }
      emit(state,'flame',''); continue;
    }
    if (unit.type === 'infantry' || unit.type === 'machinegun') {
      const travel = distance(unit, target) / 95;
      state.projectiles.push({ id: `p${state.nextId++}`, kind: 'bullet', x: unit.x, y: unit.y, sx: unit.x, sy: unit.y, tx: target.x + (target.vx || 0) * travel, ty: target.y + (target.vy || 0) * travel, targetId: target.id, sourceId: unit.id, damage, air: BUGS[target.type].air, exemptSide: unit.slotId && outsideSide(target, unit.side) ? unit.side : null, time: 0, duration: travel, life: 1, trail: [] });
      reservations.set(target.id, (reservations.get(target.id) || 0) + damage);
      if (unit.type === 'machinegun') emit(state, 'gun', '');
    } else {
      const kind = unit.type === 'sam' ? 'missile' : 'shell';
      state.projectiles.push({ id: `p${state.nextId++}`, kind, x: unit.x, y: unit.y, sx: unit.x, sy: unit.y, tx: target.x, ty: target.y, targetId: kind === 'missile' ? target.id : null, sourceId: unit.id, damage, radius: cfg.splash || 0, time: 0, duration: distance(unit, target) / (kind === 'missile' ? 35 : 27), life: 8, trail: [] });
      reservations.set(target.id, (reservations.get(target.id) || 0) + damage);
      emit(state, kind, '');
    }
  }
  for (const p of state.projectiles) {
    if (p.dead) continue;
    p.time += dt; p.life -= dt;
    p.trail ||= []; p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 8) p.trail.shift();
    const source = state.defenders.find(u => u.id === p.sourceId);
    if (p.kind === 'bullet') {
      const previous = { x: p.x, y: p.y };
      const reached = moveToward(p, { x: p.tx, y: p.ty }, 95 * dt);
      if (!p.air && (!lineClear(previous, p, state.walls, p.exemptSide) || coreBlocks(previous, p))) { p.dead = true; continue; }
      const dx = p.x - previous.x, dy = p.y - previous.y, len2 = dx * dx + dy * dy;
      const hits = index.query(p, 3).filter(e => {
        if (BUGS[e.type].air !== p.air) return false;
        const t = len2 ? Math.max(0, Math.min(1, ((e.x - previous.x) * dx + (e.y - previous.y) * dy) / len2)) : 0;
        return Math.hypot(e.x - previous.x - t * dx, e.y - previous.y - t * dy) <= BUGS[e.type].radius + 0.3;
      }).sort((a, b) => distance(previous, a) - distance(previous, b));
      if (hits.length) { hurtEnemy(state, hits[0], p.damage, 'bullet', source); p.dead = true; }
      else if (reached) p.dead = true;
    } else if (p.kind === 'missile') {
      const target = state.enemies.find(e => e.id === p.targetId && e.hp > 0);
      if (target) { p.tx = target.x; p.ty = target.y; }
      if (moveToward(p, { x: p.tx, y: p.ty }, 35 * dt)) {
        if (target) hurtEnemy(state, target, p.damage, 'explosion', source);
        addBlast(state, p, 2, 'air'); p.dead = true;
      }
    } else {
      const k = Math.min(1, p.time / Math.max(0.01, p.duration));
      p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k;
      if (k >= 1) { explode(state, p, p.damage, p.radius, source, index); emit(state, 'explosion', ''); p.dead = true; }
    }
    if (p.life <= 0) p.dead = true;
  }
  state.projectiles = state.projectiles.filter(p => !p.dead);
}
