import { BUGS, WORLD as W, CORE, DEFENDERS, DEFAULT_SPEED } from './data/config.js';
import { gapCenter, insideGap, outerWallPoint } from './battlefield.js';
import { distance, clamp, lineClear, coreBlocks } from './geometry.js';
import { random, emit } from './state.js';
import { makeFlockGrid, navigationSegments, steerEnemy, safeWaypoint } from './navigation.js';
import { PROTOTYPE } from './data/rounds.js';
import { addBlast } from './effects.js';

export function spawnEnemy(state, entry) {
  const jitter = (random(state) - 0.5) * 10, wallTarget = outerWallPoint(entry.side, entry.lane, jitter);
  let x = wallTarget.x, y = wallTarget.y;
  if (entry.side === 'north') y = -2;
  if (entry.side === 'south') y = W.h + 2;
  if (entry.side === 'east') x = W.w + 2;
  if (entry.side === 'west') x = -2;
  const spread = (random(state) - 0.5) * 25;
  if (entry.side === 'north' || entry.side === 'south') x = clamp(x + spread, 12, 108); else y = clamp(y + spread, 8, 82);
  const cfg = BUGS[entry.type];
  const horizontal = entry.side === 'north' || entry.side === 'south';
  const normal = entry.side === 'north' || entry.side === 'west' ? 1 : -1;
  const route = horizontal ? [{ x: x + (random(state) - 0.5) * 6, y: y + normal * 12 }, { x: wallTarget.x + (random(state) - 0.5) * 6, y: wallTarget.y - normal * 9 }] : [{ x: x + normal * 14, y: y + (random(state) - 0.5) * 6 }, { x: wallTarget.x - normal * 10, y: wallTarget.y + (random(state) - 0.5) * 6 }];
  const variant = random(state), pressure = PROTOTYPE.rounds[state.roundIndex].threat;
  const healthScale = cfg.air ? 1 + (pressure.health - 1) * 0.45 : pressure.health;
  const hp = Math.round(cfg.hp * healthScale);
  state.enemies.push({ id: `e${state.nextId++}`, type: entry.type, side: entry.side, x, y, hp, maxHp: hp, angle: { north: Math.PI / 2, south: -Math.PI / 2, east: Math.PI, west: 0 }[entry.side], stage: cfg.air ? 'air' : 'approach', target: wallTarget, route: route.map(p => safeWaypoint(p, entry.side)), vx: 0, vy: 0, damageScale: cfg.air ? Math.sqrt(pressure.damage) : pressure.damage, speedFactor: (0.9 + variant * 0.2) * pressure.speed, variant, turnBias: variant > 0.5 ? 1 : -1, jitter, stun: 0, attackFlash: 0, attackTimer: variant * 0.85, walk: variant * 10 });
}
export function damageDefender(state, unit, amount) {
  if (unit.hp <= 0) return;
  unit.hp = Math.max(0, unit.hp - amount); unit.hit = 0.14;
  if (!unit.hp) { state.stats.lost++; emit(state, 'loss', '一支防御单位已失联'); addBlast(state, unit, 1.8); }
}
export function breakWall(state, side) {
  const wall = state.walls[side];
  if (wall.broken) return;
  wall.hp = 0; wall.broken = true; state.stats.wallsBroken++; state.speed = Math.min(state.speed, DEFAULT_SPEED);
  emit(state, 'breach', side, { side });
  const gap = gapCenter(side);
  addBlast(state, gap, 5, 'breach');
  for (const u of state.defenders.filter(u => u.side === side && DEFENDERS[u.type].mobile && u.hp > 0)) {
    damageDefender(state, u, 45);
    const p = { x: clamp(u.x, 43, 77), y: clamp(u.y, 33, 57) };
    u.slotId = null; u.side = 'reserve'; u.destination = null; u.path = [p];
  }
}
function corePoint(enemy) {
  return { x: clamp(enemy.x, CORE.x - CORE.w / 2, CORE.x + CORE.w / 2), y: clamp(enemy.y, CORE.y - CORE.h / 2, CORE.y + CORE.h / 2) };
}
function insideTarget(state, e, isAir) {
  const previous = state.defenders.find(u => u.id === e.prey && u.hp > 0);
  if (previous && e.preyTimer > 0 && (isAir || distance(e, previous) < 8 && lineClear(e, previous, state.walls) && !coreBlocks(e, previous))) return { point: previous, unit: previous };
  const candidates = state.defenders.filter(u => u.hp > 0 && distance(e, u) < (isAir ? 35 : 7) && (isAir || (lineClear(e, u, state.walls) && !coreBlocks(e, u))));
  candidates.sort((a, b) => distance(e, a) - distance(e, b));
  if (candidates.length) { e.prey = candidates[0].id; e.preyTimer = 1.3; return { point: candidates[0], unit: candidates[0] }; }
  return { point: corePoint(e), unit: null };
}
export function updateEnemies(state, dt) {
  const neighbors = makeFlockGrid(state.enemies), segments = navigationSegments(state);
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const cfg = BUGS[e.type];
    e.route ||= []; e.vx ||= 0; e.vy ||= 0; e.variant ??= 0.5; e.speedFactor ??= 1; e.turnBias ??= 1;
    e.flightTime = (e.flightTime || 0) + dt;
    e.attackTimer = Math.max(0, (e.attackTimer || 0) - dt); e.preyTimer = Math.max(0, (e.preyTimer || 0) - dt); e.attackFlash = Math.max(0, e.attackFlash - dt);
    if (e.stun > 0) { e.stun -= dt; continue; }
    const attack = apply => { e.vx *= 0.7; e.vy *= 0.7; if (e.attackTimer <= 0) { apply(cfg.damage * (e.damageScale || 1) * 0.85); e.attackTimer = 0.75 + e.variant * 0.2; e.attackFlash = 0.32; } };
    const advance = goal => steerEnemy(e, goal, dt, neighbors, segments);
    if (cfg.air) {
      if (e.route.length) { e.flightBoost = 1.12; if (advance(e.route[0])) e.route.shift(); continue; }
      if (e.evadeTime > 0 && e.evadePoint) {
        e.evadeTime -= dt; e.flightBoost = 1.5; advance(e.evadePoint); continue;
      }
      const {point,unit} = insideTarget(state,e,true);
      e.flightBoost = distance(e,point) < 12 ? 1.35 : 1;
      if (distance(e,point) <= cfg.radius + 1.1) {
        if (e.attackTimer <= 0) {
          const amount = cfg.damage * (e.damageScale || 1) * 1.2;
          if(unit)damageDefender(state,unit,amount);else {state.core.hp=Math.max(0,state.core.hp-amount);state.core.hit=0.18;}
          e.attackTimer=1.05;e.attackFlash=0.32;
          const angle=Math.atan2(e.y-point.y,e.x-point.x)+e.turnBias*1.1;
          e.evadePoint={x:clamp(point.x+Math.cos(angle)*8,2,W.w-2),y:clamp(point.y+Math.sin(angle)*8,2,W.h-2)};
          e.evadeTime=0.65;e.preyTimer=0;
        } else advance({x:point.x+Math.cos(e.flightTime*3+e.variant*6)*4,y:point.y+Math.sin(e.flightTime*3+e.variant*6)*4});
      } else advance(point);
      continue;
    }
    if (e.route.length && (e.stage === 'approach' || cfg.air)) { if (advance(e.route[0])) e.route.shift(); continue; }
    if (cfg.air || e.stage === 'inside') {
      const { point, unit } = insideTarget(state, e, cfg.air);
      if (distance(e, point) <= cfg.radius + 0.8) {
        attack(amount => { if (unit) damageDefender(state, unit, amount); else { state.core.hp = Math.max(0, state.core.hp - amount); state.core.hit = 0.18; } });
      } else advance(point);
    } else if (state.walls[e.side].hp > 0) {
      e.stage = 'approach';
      if (distance(e, e.target) < cfg.radius + 1.2) attack(amount => {
        const wall = state.walls[e.side]; wall.hp = Math.max(0, wall.hp - amount); wall.hit = 0.18;
        if (wall.hp <= 0) breakWall(state, e.side);
      }); else advance(e.target);
    } else if (e.stage !== 'crossing') {
      const p = gapCenter(e.side);
      const outside = { x: p.x + (e.side === 'west' ? -1.5 : e.side === 'east' ? 1.5 : 0), y: p.y + (e.side === 'north' ? -1.5 : e.side === 'south' ? 1.5 : 0) };
      if (advance(outside)) e.stage = 'crossing';
    } else if (advance(insideGap(e.side))) e.stage = 'inside';
  }
}
