// 全局状态单例 + 存档层
// 存档设计照搬 airline/js/state.js：payload 三段式（version/savedAt/state + counters）、
// {ok, reason} 三态返回、槽位摘要不反序列化到 state。
import { SHIP_BY_ID } from './data/ships.js';
import { PORTS } from './data/ports.js';
import { GOODS, GOOD_BY_ID } from './data/goods.js';
import { EQUIP_BY_ID } from './data/equipment.js';

// 版本号：北京日期 + 当天提交序号（由 .githooks/pre-commit 自动更新）
export const APP_VERSION = '2026.7.27.2';
// v2：加入小时时钟、三条名声、装备/背包、银行、发现物 —— 旧存档不兼容
export const SAVE_VERSION = 2;
export const STORAGE_KEY = 'blackbeard.save';
export const SLOT_KEY = (i) => `blackbeard.slot.${i}`;
export const NUM_SLOTS = 5;

// 模块级计数器：不在 state 里，必须单独存/恢复，否则读档后新对象会与旧对象撞 id
let shipUid = 1;
let logUid = 1;
export function nextShipUid() { return shipUid++; }

export const state = {
  version: SAVE_VERSION,
  date: { y: 1697, m: 5, d: 1, h: 8 },   // h：小时（0–23.5，半小时步进）
  chapter: 0,
  player: {
    name: '爱德华·蒂奇',
    gold: 400,
    // 三条名声（仿原版：冒険 / 交易 / 戦闘）
    fame: { adventure: 0, trade: 0, battle: 0 },
    infamy: 0,    // 通缉度（三结局判定依赖它，与三名声并存）
    luck: 30,     // 運：影响决斗触发、海上事故
    hp: 100, hpMax: 100,
    skills: { sailing: 1, combat: 1, leadership: 1, negotiation: 1 },
    equipment: { weapon: null, armor: null },
    exp: 0,
  },
  inventory: [],                          // 道具/备用装备 id 列表
  bank: { deposit: 0, loan: 0 },          // 存款（月利3%）/ 借款（月利10%）
  discoveries: { found: {}, reported: {} },
  fleet: [],
  flagship: 0,             // fleet 索引
  crewMorale: 70,
  supplies: { water: 60 },  // 粮食改为货舱里的 grain 货物；淡水靠港免费补满
  position: { lng: -2.59, lat: 51.45 },
  atPort: 'BRISTOL',
  view: 'port',            // 'port' 港口主视野 | 'sail' 近海航行视野
  heading: 270,            // 航向（度）
  waypoint: null,          // 下一个航点 {lng,lat}
  npcShips: [],            // 近海视野里的其他船
  fog: null,               // 迷雾：已探明格 { key: 1 }
  officers: [],            // 已招募 officer id
  quests: null,            // { active:[{id,since}], done:[id], counters:{} }
  flags: {},               // 剧情旗标
  discovered: ['BRISTOL'],
  portState: {},           // portId -> { stock: {goodId: qty}, mod: {goodId: 倍率} }
  activeEffects: [],       // 统一 buff/debuff 池（带 remaining）
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
// 占舱体积：按货物 bulk 计（木材/棉花/火药体积大，香料体积小）
export function cargoUsed(sh) {
  let n = 0;
  for (const id in (sh.cargo || {})) n += sh.cargo[id] * (GOOD_BY_ID[id]?.bulk || 1);
  return n;
}
export function bulkOf(goodId) { return GOOD_BY_ID[goodId]?.bulk || 1; }
export function fleetSpeed() {
  const alive = state.fleet;
  if (!alive.length) return 6;
  return Math.min(...alive.map(s => shipStat(s).speed));   // 舰队按最慢船
}
export function fleetCrew() {
  return state.fleet.reduce((a, s) => a + s.crew, 0);
}

// ===== 主角派生属性 =====
// 决斗伤害与接舷战力都读这两个：装备 + 剑技
export function playerAtk() {
  const w = EQUIP_BY_ID[state.player.equipment?.weapon];
  return 6 + (w?.atk || 0) + (state.player.skills?.combat || 1) * 2;
}
export function playerDef() {
  const a = EQUIP_BY_ID[state.player.equipment?.armor];
  return (a?.def || 0) + (state.player.skills?.combat || 1);
}
export function hasItem(id) { return state.inventory.includes(id); }
export function addItem(id) { state.inventory.push(id); }
export function removeItem(id) {
  const i = state.inventory.indexOf(id);
  if (i >= 0) state.inventory.splice(i, 1);
  return i >= 0;
}

// ===== 三条名声 =====
// 全部走这两个函数，避免各处再直接 +=（旧代码把 fame 当数字用过）
export function addFame(track, n) {
  const f = state.player.fame;
  if (typeof f !== 'object') return;
  if (typeof track === 'object') {          // 支持 addFame({trade:8, battle:2})
    for (const k in track) if (k in f) f[k] = Math.max(0, f[k] + track[k]);
    return;
  }
  if (track in f) f[track] = Math.max(0, f[track] + n);
}
export function totalFame() {
  const f = state.player.fame;
  return typeof f === 'object' ? (f.adventure + f.trade + f.battle) : (f || 0);
}
// 名声门槛：req 形如 { trade:200, battle:150 }，全部满足才算够
export function meetsFame(req) {
  if (!req) return true;
  const f = state.player.fame;
  for (const k in req) if ((f[k] || 0) < req[k]) return false;
  return true;
}

export function addLog(text) {
  state.log.unshift({ id: logUid++, date: { ...state.date }, text });
  if (state.log.length > 200) state.log.length = 200;
}

// ===== 新游戏 =====
export function initNewGame() {
  Object.assign(state, {
    version: SAVE_VERSION,
    date: { y: 1697, m: 5, d: 1, h: 8 },
    chapter: 0,
    player: {
      name: '爱德华·蒂奇', gold: 400,
      fame: { adventure: 0, trade: 0, battle: 0 },
      infamy: 0, luck: 30,
      hp: 100, hpMax: 100,
      skills: { sailing: 1, combat: 1, leadership: 1, negotiation: 1 },
      equipment: { weapon: 'w_cutlass', armor: 'a_leather' },   // 开局带一把水手弯刀
      exp: 0,
    },
    inventory: [],
    bank: { deposit: 0, loan: 0 },
    discoveries: { found: {}, reported: {} },
    fleet: [],
    flagship: 0,
    crewMorale: 70,
    supplies: { water: 60 },
    position: { lng: -2.59, lat: 51.45 },
    atPort: 'BRISTOL',
    view: 'port',
    heading: 270,
    waypoint: null,
    npcShips: [],
    fog: {},
    officers: [],
    quests: { active: [], done: [], counters: { wins: 0, winsMerchant: 0, winsPatrol: 0 } },
    flags: {},
    discovered: ['BRISTOL'],
    portState: {},
    activeEffects: [],
    log: [],
    gameOver: false,
    ending: null,
  });
  shipUid = 1; logUid = 1;
  const first = makeShip('skiff', '海雀号');
  first.cargo.grain = 50;          // 约够 10 人吃 50 天；之后要自己在市场补
  state.fleet.push(first);
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
      view: state.view, heading: state.heading, waypoint: state.waypoint,
      npcShips: state.npcShips, fog: state.fog,
      officers: state.officers, quests: state.quests, flags: state.flags,
      discovered: state.discovered, portState: state.portState,
      inventory: state.inventory, bank: state.bank, discoveries: state.discoveries,
      activeEffects: state.activeEffects,
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
        gold: s.player?.gold, infamy: s.player?.infamy,
        // 摘要只显示名声总和（三条分列留给存档内的人物面板）
        fame: (() => { const f = s.player?.fame; return typeof f === 'object' ? (f.adventure + f.trade + f.battle) : (f || 0); })(),
        ships: s.fleet?.length || 0,
        where: s.atPort || '海上',
      });
    } catch (e) { out.push(null); }
  }
  return out;
}
