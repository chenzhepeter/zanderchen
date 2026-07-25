// 全局状态单例 + 存档层
// 存档设计照搬 airline/js/state.js：payload 三段式（version/savedAt/state + counters）、
// {ok, reason} 三态返回、槽位摘要不反序列化到 state。
import { SHIP_BY_ID } from './data/ships.js';
import { PORTS } from './data/ports.js';
import { GOODS } from './data/goods.js';

// 版本号：北京日期 + 当天提交序号（由 .githooks/pre-commit 自动更新）
export const APP_VERSION = '2026.7.25.1';
export const SAVE_VERSION = 1;
export const STORAGE_KEY = 'blackbeard.save';
export const SLOT_KEY = (i) => `blackbeard.slot.${i}`;
export const NUM_SLOTS = 5;

// 模块级计数器：不在 state 里，必须单独存/恢复，否则读档后新对象会与旧对象撞 id
let shipUid = 1;
let logUid = 1;
export function nextShipUid() { return shipUid++; }

export const state = {
  version: SAVE_VERSION,
  date: { y: 1697, m: 5, d: 1 },
  chapter: 0,
  player: {
    name: '爱德华·蒂奇',
    gold: 400,
    fame: 0,      // 官方声望
    infamy: 0,    // 海盗恶名
    hp: 100, hpMax: 100,
    skills: { sailing: 1, combat: 1, leadership: 1, negotiation: 1 },
    exp: 0,
  },
  fleet: [],
  flagship: 0,             // fleet 索引
  crewMorale: 70,
  supplies: { food: 60, water: 60 },
  position: { lng: -2.59, lat: 51.45 },
  atPort: 'BRISTOL',
  voyage: null,            // { path:[{lng,lat}], idx, destId, days }
  officers: [],            // 已招募 officer id
  flags: {},               // 剧情旗标
  discovered: ['BRISTOL'],
  portState: {},           // portId -> { stock: {goodId: qty}, mod: {goodId: 倍率} }
  activeEffects: [],       // 统一 buff/debuff 池（带 remaining）
  eventLog: [],
  pendingEvent: null,
  pendingDialog: null,
  log: [],                 // 航海日志
  gameOver: false,
  ending: null,
};

// ===== 工厂 =====
export function makeShip(typeId, nameOverride) {
  const t = SHIP_BY_ID[typeId];
  return {
    uid: nextShipUid(),
    typeId,
    name: nameOverride || t.name,
    hull: t.hull, hullMax: t.hull,
    armor: t.armor, speed: t.speed, guns: t.guns,
    cargoMax: t.cargo,
    crew: Math.round(t.crewMax * 0.5), crewMax: t.crewMax,
    upgrades: { guns: 0, plating: 0, sails: 0, hold: 0 },
    cargo: {},   // goodId -> qty
  };
}

// 派生属性（含改装加成）
export function shipStat(sh) {
  const u = sh.upgrades || {};
  return {
    guns: sh.guns + (u.guns || 0) * 4,
    armor: sh.armor + (u.plating || 0) * 2,
    hullMax: sh.hullMax + (u.plating || 0) * 30,
    speed: sh.speed + (u.sails || 0) * 0.8,
    cargoMax: sh.cargoMax + (u.hold || 0) * 25,
  };
}
export function cargoUsed(sh) {
  return Object.values(sh.cargo || {}).reduce((a, b) => a + b, 0);
}
export function fleetSpeed() {
  const alive = state.fleet;
  if (!alive.length) return 6;
  return Math.min(...alive.map(s => shipStat(s).speed));   // 舰队按最慢船
}
export function fleetCrew() {
  return state.fleet.reduce((a, s) => a + s.crew, 0);
}

export function addLog(text) {
  state.log.unshift({ id: logUid++, date: { ...state.date }, text });
  if (state.log.length > 200) state.log.length = 200;
}

// ===== 新游戏 =====
export function initNewGame() {
  Object.assign(state, {
    version: SAVE_VERSION,
    date: { y: 1697, m: 5, d: 1 },
    chapter: 0,
    player: {
      name: '爱德华·蒂奇', gold: 400, fame: 0, infamy: 0,
      hp: 100, hpMax: 100,
      skills: { sailing: 1, combat: 1, leadership: 1, negotiation: 1 },
      exp: 0,
    },
    fleet: [],
    flagship: 0,
    crewMorale: 70,
    supplies: { food: 60, water: 60 },
    position: { lng: -2.59, lat: 51.45 },
    atPort: 'BRISTOL',
    voyage: null,
    officers: [],
    flags: {},
    discovered: ['BRISTOL'],
    portState: {},
    activeEffects: [],
    eventLog: [],
    pendingEvent: null,
    pendingDialog: null,
    log: [],
    gameOver: false,
    ending: null,
  });
  shipUid = 1; logUid = 1;
  state.fleet.push(makeShip('skiff', '海雀号'));
  seedPortStates();
  addLog('1697 年 5 月，布里斯托尔。你在艾冯河的码头上签了字，成为一名水手。');
}

// 各港初始库存与价格波动
export function seedPortStates() {
  state.portState = {};
  for (const p of PORTS) {
    if (p.anchorageOnly) continue;
    const stock = {}, mod = {};
    for (const g of GOODS) {
      const isProd = p.produces.includes(g.id);
      const isWant = p.wants.includes(g.id);
      stock[g.id] = isProd ? 80 + p.size * 20 : (isWant ? 10 : 30);
      mod[g.id] = isProd ? 0.65 : (isWant ? 1.45 : 1.0);
    }
    state.portState[p.id] = { stock, mod };
  }
}

// ===== 存档 =====
function buildPayload() {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    state: {
      date: state.date, chapter: state.chapter, player: state.player,
      fleet: state.fleet, flagship: state.flagship, crewMorale: state.crewMorale,
      supplies: state.supplies, position: state.position, atPort: state.atPort,
      voyage: state.voyage, officers: state.officers, flags: state.flags,
      discovered: state.discovered, portState: state.portState,
      activeEffects: state.activeEffects, eventLog: state.eventLog,
      pendingEvent: state.pendingEvent, pendingDialog: state.pendingDialog,
      log: state.log, gameOver: state.gameOver, ending: state.ending,
    },
    counters: { ship: shipUid, log: logUid },
  };
}

function applyPayload(p) {
  if (!p) return { ok: false, reason: 'corrupt' };
  if (p.version !== SAVE_VERSION) {
    return { ok: false, reason: 'version', oldVersion: p.version };
  }
  Object.assign(state, p.state);
  shipUid = p.counters?.ship || 1;
  logUid = p.counters?.log || 1;
  if (!state.portState || !Object.keys(state.portState).length) seedPortStates();
  return { ok: true };
}

export function saveGame() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPayload())); return true; }
  catch (e) { console.warn('save failed', e); return false; }
}
export function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ok: false, reason: 'empty' };
  try { return applyPayload(JSON.parse(raw)); }
  catch (e) { return { ok: false, reason: 'corrupt' }; }
}
export function clearSave() { localStorage.removeItem(STORAGE_KEY); }
export function hasSave() { return !!localStorage.getItem(STORAGE_KEY); }

export function saveToSlot(slot) {
  if (slot < 1 || slot > NUM_SLOTS) return false;
  try { localStorage.setItem(SLOT_KEY(slot), JSON.stringify(buildPayload())); return true; }
  catch (e) { return false; }
}
export function loadFromSlot(slot) {
  const raw = localStorage.getItem(SLOT_KEY(slot));
  if (!raw) return { ok: false, reason: 'empty' };
  try { return applyPayload(JSON.parse(raw)); }
  catch (e) { return { ok: false, reason: 'corrupt' }; }
}
export function deleteSlot(slot) { localStorage.removeItem(SLOT_KEY(slot)); return true; }

// 槽位摘要：只 parse 元数据，不写入 state；坏档/版本不符一律当空槽，列表永不崩
export function listSaveSlots() {
  const out = [];
  for (let i = 1; i <= NUM_SLOTS; i++) {
    const raw = localStorage.getItem(SLOT_KEY(i));
    if (!raw) { out.push(null); continue; }
    try {
      const p = JSON.parse(raw);
      if (p.version !== SAVE_VERSION) { out.push(null); continue; }
      const s = p.state;
      out.push({
        slot: i, savedAt: p.savedAt,
        date: s.date, chapter: s.chapter,
        gold: s.player?.gold, fame: s.player?.fame, infamy: s.player?.infamy,
        ships: s.fleet?.length || 0,
        where: s.atPort || '海上',
      });
    } catch (e) { out.push(null); }
  }
  return out;
}
