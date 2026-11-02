import { SIDES, DEFAULT_SPEED } from './data/config.js';
import { PROTOTYPE, spawnPlan } from './data/rounds.js';
import { SLOT_BY_ID } from './battlefield.js';
import { createGame, makeCheckpoint, emit } from './state.js';
import { spawnEnemy, updateEnemies } from './enemies.js';
import { updateTroops, updateCombat } from './combat.js';
export function newCampaign(seed) { const state = createGame(seed); makeCheckpoint(state); return state; }
export function startRound(state) {
  if (state.phase !== 'planning') return false;
  state.phase = 'combat'; state.time = 0; state.spawnIndex = 0; state.spawnQueue = spawnPlan(PROTOTYPE.rounds[state.roundIndex]); state.speed = DEFAULT_SPEED;
  state.roundStats = { kills: 0, bombsUsed: 0, earned: 0, damage: {}, startingCore: state.core.hp, startingWalls: Object.fromEntries(SIDES.map(side => [side, state.walls[side].hp])) };
  for (const u of state.defenders) u.veteran = true;
  emit(state, 'round', `第 ${state.roundIndex + 1} 回合开始`);
  return true;
}
export function settleRound(state) {
  const number = state.roundIndex + 1;
  if (state.phase !== 'combat' || state.lastSettled >= number || state.spawnIndex < state.spawnQueue.length || state.enemies.some(e => e.hp > 0)) return false;
  const round = PROTOTYPE.rounds[state.roundIndex];
  state.lastSettled = number; state.credits += round.supply;
  state.report = { round: number, name: round.name, supply: round.supply, kills: state.roundStats.kills, bombsUsed: state.roundStats.bombsUsed, earned: state.roundStats.earned, coreLost: Math.round((state.roundStats.startingCore ?? state.core.hp) - state.core.hp), damage: { ...state.roundStats.damage }, broken: SIDES.filter(side => state.walls[side].hp <= 0) };
  for (const u of state.defenders) if (u.hp > 0) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.2); u.fire=0;u.flameTime=0;u.cooldown=0;u.deployTime=0;u.refitting=false;u.targetId=null;u.status='整备就绪';
    if(u.path.length) { const endpoint=SLOT_BY_ID[u.destination] || u.path.at(-1);u.x=endpoint.x;u.y=endpoint.y;if(u.destination){u.slotId=u.destination;u.side=endpoint.side;}u.path=[];u.destination=null; }
  }
  for (const wall of Object.values(state.walls)) if (wall.hp > 0) wall.hp = Math.min(wall.maxHp, wall.hp + 80);
  state.enemies = []; state.projectiles = []; state.shake=0;
  state.phase = number >= PROTOTYPE.rounds.length ? 'victory' : 'resupply';
  emit(state, 'supply', `运输机抵达 · +${round.supply} 军需点`);
  return true;
}
export function nextRound(state) {
  if (state.phase !== 'resupply' || state.roundIndex + 1 >= PROTOTYPE.rounds.length) return false;
  state.roundIndex++; state.phase = 'planning'; state.time = 0; state.spawnQueue = []; state.spawnIndex = 0; state.coreRepaired = false; state.focusId = null;
  state.roundStats = { kills: 0, bombsUsed: 0, earned: 0, damage: {} }; state.bombCooldown = 0;
  state.defenders = state.defenders.filter(u => u.hp > 0); state.effects = [];
  makeCheckpoint(state); return true;
}
export function togglePause(state) {
  if (state.phase === 'combat') { state.phase = 'paused'; return true; }
  if (state.phase === 'paused') { state.phase = 'combat'; return true; }
  return false;
}
export function update(state, dt) {
  if (state.phase !== 'combat') return;
  state.time += dt; state.stats.duration += dt;
  state.bombCooldown = Math.max(0, state.bombCooldown - dt); state.shake = Math.max(0, (state.shake || 0) - dt * 1.8);
  for (const wall of Object.values(state.walls)) wall.hit = Math.max(0, (wall.hit || 0) - dt);
  state.core.hit = Math.max(0, (state.core.hit || 0) - dt);
  while (state.spawnIndex < state.spawnQueue.length && state.spawnQueue[state.spawnIndex].at <= state.time && state.enemies.length < 200) spawnEnemy(state, state.spawnQueue[state.spawnIndex++]);
  updateTroops(state, dt); updateEnemies(state, dt); updateCombat(state, dt);
  for (const u of state.defenders) { u.fire = Math.max(0, (u.fire || 0) - dt); u.flameTime = Math.max(0, (u.flameTime || 0) - dt); }
  for (const e of state.enemies) e.hit = Math.max(0, (e.hit || 0) - dt);
  state.enemies = state.enemies.filter(e => e.hp > 0);
  state.effects = state.effects.filter(e => (e.life -= dt) > 0).slice(-700);
  if (state.core.hp <= 0) { state.phase = 'defeat'; emit(state, 'defeat', '指挥中心失守'); }
  else if (state.spawnIndex >= state.spawnQueue.length && !state.enemies.length) settleRound(state);
}
