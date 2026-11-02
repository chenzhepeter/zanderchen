import { SIDES, CORE, WALL_HP, STORAGE_KEY, LEGACY_STORAGE_KEY, PREVIOUS_STORAGE_KEY, DEFAULT_SPEED, SAVE_VERSION, DEFENDERS, BUGS, STARTING_CREDITS, STARTING_BOMBS } from './data/config.js';
import { SLOTS, SLOT_BY_ID } from './battlefield.js';
import { PROTOTYPE } from './data/rounds.js';
export const clone = value => JSON.parse(JSON.stringify(value));
export function createGame(seed = 271828) {
  return { campaignId: PROTOTYPE.id, phase: 'planning', roundIndex: 0, credits: STARTING_CREDITS, bombs: STARTING_BOMBS, bombCooldown: 0, shake: 0, core: { ...CORE, maxHp: CORE.hp }, walls: Object.fromEntries(SIDES.map(side => [side, { hp: WALL_HP, maxHp: WALL_HP }])), defenders: [], enemies: [], projectiles: [], effects: [], events: [], nextId: 1, seed, time: 0, speed: DEFAULT_SPEED, spawnIndex: 0, spawnQueue: [], lastSettled: 0, focusId: null, coreRepaired: false, roundStats: { kills: 0, bombsUsed: 0, earned: 0, damage: {} }, stats: { kills: 0, lost: 0, spent: 0, earned: 0, retries: 0, duration: 0, wallsBroken: 0 }, report: null, history: [], checkpoint: null };
}
export function snapshot(state) { const { history, checkpoint, events, effects, ...saved } = state; return clone(saved); }
export function makeCheckpoint(state) { state.history = []; state.checkpoint = snapshot(state); }
export function restoreCheckpoint(state) {
  if (!state.checkpoint) return false;
  const checkpoint = clone(state.checkpoint), retries = state.stats.retries + 1;
  Object.assign(state, checkpoint, { checkpoint, history: [], events: [], effects: [], shake:0 });
  state.stats.retries = retries;
  return true;
}
export function random(state) { state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0; return state.seed / 4294967296; }
export function emit(state, type, message, extra = {}) { state.events.push({ type, message, ...extra }); }
export function saveGame(state, storage = globalThis.localStorage) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, campaignId: state.campaignId, savedAt: Date.now(), state: snapshot(state), checkpoint: state.checkpoint, history: state.history })); return true; } catch { return false; }
}
export function loadGame(storage = globalThis.localStorage) {
  try {
    const p = JSON.parse(storage.getItem(STORAGE_KEY) || storage.getItem(PREVIOUS_STORAGE_KEY) || storage.getItem(LEGACY_STORAGE_KEY));
    if ([1,2].includes(p?.version) && p.campaignId === PROTOTYPE.id) {
      const convert = input => migrateCampaign(p.version === 1 ? migrateLegacy(input) : clone(input));
      p.state = convert(p.state); p.checkpoint = p.checkpoint ? convert(p.checkpoint) : null;
      p.history = (p.history || []).map(convert); p.version = SAVE_VERSION;
    }
    if (p?.version !== SAVE_VERSION || p.campaignId !== PROTOTYPE.id || !p.state || !Number.isInteger(p.state.roundIndex) || p.state.roundIndex < 0 || p.state.roundIndex >= PROTOTYPE.rounds.length || !['planning', 'resupply', 'victory', 'defeat', 'combat', 'paused'].includes(p.state.phase)) return null;
    const s = p.state;
    if (!Number.isFinite(s.credits) || s.credits < 0 || !Number.isInteger(s.bombs) || s.bombs < 0 || !Number.isFinite(s.bombCooldown) || !SIDES.every(side => Number.isFinite(s.walls?.[side]?.hp)) || !Number.isFinite(s.core?.hp) || !Array.isArray(s.defenders) || !Array.isArray(s.enemies) || !Array.isArray(s.projectiles) || !Array.isArray(s.spawnQueue) || !s.stats || !s.roundStats || !Number.isInteger(s.lastSettled) || s.lastSettled < 0 || s.lastSettled > PROTOTYPE.rounds.length) return null;
    const validPosition = e => Number.isFinite(e.x) && Number.isFinite(e.y) && typeof e.id === 'string';
    if (!s.defenders.every(e => validPosition(e) && DEFENDERS[e.type] && e.type !== 'bomb' && Number.isFinite(e.hp) && [1,2,3].includes(e.level) && Array.isArray(e.path)) || !s.enemies.every(e => validPosition(e) && BUGS[e.type] && Number.isFinite(e.hp))) return null;
    return { ...createGame(), ...s, phase: s.phase === 'combat' ? 'paused' : s.phase, events: [], effects: [], checkpoint: p.checkpoint || null, history: p.history || [] };
  } catch { return null; }
}

function migrateLegacy(input) {
  const s = clone(input);
  s.credits += STARTING_CREDITS - 620;
  for (let i = 0; i < (s.lastSettled || 0); i++) s.credits += PROTOTYPE.rounds[i].supply - [300, 340, 380][i];
  s.bombs = STARTING_BOMBS + (s.mines?.length || 0); s.bombCooldown = 0;
  delete s.mines;
  s.stats.earned = 0; s.roundStats.earned = 0; s.roundStats.bombsUsed = 0; delete s.roundStats.mines;
  if (s.report) { s.report.bombsUsed = 0; s.report.earned = 0; delete s.report.mines; }
  return s;
}

function migrateCampaign(s) {
  s.speed = DEFAULT_SPEED; s.shake=0;
  const used = new Set(s.defenders.filter(u=>u.type!=='cannon').map(u=>u.slotId));
  for (const unit of s.defenders) {
    unit.level ||= 1;
    if (unit.type==='cannon' && SLOT_BY_ID[unit.slotId]?.kind==='heavy') {
      const slot=SLOTS.find(p=>p.kind==='cannon' && p.side===unit.side && !used.has(p.id));
      if(slot) {unit.slotId=slot.id;used.add(slot.id);}
    }
    const slot=SLOT_BY_ID[unit.slotId];
    if (slot && !unit.path.length) {unit.x=slot.x;unit.y=slot.y;}
    const destination=SLOT_BY_ID[unit.destination];
    if(destination && unit.path.length)unit.path[unit.path.length-1]={x:destination.x,y:destination.y};
  }
  if(s.phase==='victory' && s.lastSettled<PROTOTYPE.rounds.length)s.phase='resupply';
  return s;
}
