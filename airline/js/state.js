import { AIRLINES, PLAYER_TEMPLATE } from './data/airlines.js';
import { AIRCRAFT_BY_ID } from './data/aircraft.js';
import { CITIES, CITY_BY_ID, distanceKm, recomputeCityStates } from './data/cities.js';

export const STORAGE_KEY = 'airline.save';
export const SLOT_KEY = (i) => `airline.slot.${i}`;
export const SAVE_VERSION = 13;
export const NUM_SLOTS = 5;
export const APP_VERSION = '2026.5.19.4';

// 借款机制常量
export const INTEREST_RATE_PER_QUARTER = 0.02;  // 2% / 季 ≈ 8.2% / 年
export const CREDIT_BASELINE = 100;             // $100M 基线
export const CREDIT_CAP = 500;                  // 总额度上限
export const DISTRESS_LOSS_THRESHOLD = -10;     // 近 4 季累计亏 < −$10M 触发折扣
export const DISTRESS_MULT = 0.5;               // 困境额度 ×0.5
export const PROFIT_HISTORY_LEN = 4;            // 滚动 4 季

// 玩家航司 id（固定为星途航空 STR）
export const PLAYER_ID = PLAYER_TEMPLATE.id;

// 单例 GameState
// 注意: route 现在只挂 1 架飞机（route.aircraftUid，可为 null）；同一城市对允许多条独立航线
export const state = {
  version: SAVE_VERSION,
  year: 2000,
  quarter: 1,
  playerId: null,
  playerHub: null,  // 玩家选定的基地城市 ID
  airlines: [],
  fuelPrice: 1.0,
  fuelPriceBase: 1.0,
  activeEffects: [],
  eventLog: [],
  pendingEvent: null,
  pendingDialog: null,
  landingApplications: [],
  lastQuarterReports: {},
  intelLog: [],
  thisTurnActions: [],
  gameOver: false,
};

let uidCounter = 1;
function newUid() { return `u${uidCounter++}`; }
let routeCounter = 1;
function newRouteId() { return `r${routeCounter++}`; }

// 简版盈亏平衡价（与 sim.js 的 computeBreakEvenFare 公式一致，避免循环依赖）
function quickBreakEven(distKm, fromCity, toCity, fuelPrice) {
  const fuelPerSeat = distKm * 0.03 * 0.6 * fuelPrice;
  const opPerSeat = 25 + (fromCity.size + toCity.size) * 2;
  return Math.max(20, Math.round(fuelPerSeat + opPerSeat));
}

// 把模板转成 runtime airline 对象（含航线骨架 + 兼容飞机的初始分配 + 票价）
function buildAirlineFromTemplate(tmpl, isPlayer) {
  const aircraft = [];
  for (const { modelId, count } of tmpl.initialFleet) {
    for (let i = 0; i < count; i++) {
      // AI 飞机有年龄随机化（模拟既有运营）；玩家飞机全新（age 0）
      const age = isPlayer ? 0 : Math.floor(Math.random() * 20);
      aircraft.push({ uid: newUid(), modelId, ageQuarters: age, routeId: null, grounded: false });
    }
  }
  const landingRights = new Set([tmpl.hubCity]);
  for (const [fromId, toId] of tmpl.initialRoutes) {
    landingRights.add(fromId);
    landingRights.add(toId);
  }
  // 路线骨架
  const routes = tmpl.initialRoutes.map(([fromId, toId]) => ({
    id: newRouteId(),
    ownerId: tmpl.id,
    fromCity: fromId,
    toCity: toId,
    fare: 0,
    aircraftUid: null,
    lastLoadFactor: 0.75,
    lastProfit: 0,
    _committed: null,
  }));
  // 按距离从长到短分配兼容飞机
  const byDist = routes.map(r => ({
    r, dist: distanceKm(CITY_BY_ID[r.fromCity], CITY_BY_ID[r.toCity]),
  })).sort((a, b) => b.dist - a.dist);
  for (const { r, dist } of byDist) {
    const ac = aircraft.find(a => !a.routeId && AIRCRAFT_BY_ID[a.modelId].rangeKm >= dist);
    if (ac) { ac.routeId = r.id; r.aircraftUid = ac.uid; }
    r.fare = Math.round(quickBreakEven(dist, CITY_BY_ID[r.fromCity], CITY_BY_ID[r.toCity], 1.0) * 2.0);
    r._committed = { fare: r.fare, aircraftUid: r.aircraftUid };
  }
  return {
    id: tmpl.id,
    codeIATA: tmpl.codeIATA,
    nameZh: tmpl.nameZh,
    nameShort: tmpl.nameShort,
    country: tmpl.country,
    hubCity: tmpl.hubCity,
    color: tmpl.color,
    cash: tmpl.initialCash,
    prestige: tmpl.initialPrestige,
    prestigePerQuarter: 0,
    aircraft,
    // 过滤掉没有分配到飞机的初始航线（不允许"无飞机"航线挂着占槽位）
    routes: routes.filter(r => r.aircraftUid !== null),
    landingRights: Array.from(landingRights),
    aiProfile: isPlayer ? null : pickAiProfile(tmpl.id),
    // 每季度可开 1 条线 / 买 1 架机 / 申请 1 个着陆权
    turnActions: { open: 0, buy: 0, landing: 0 },
    // 借款机制
    debt: 0,                  // 当前未偿债务
    profitHistory: [],        // 滚动 4 季净利（用于信用额度计算）
    isPlayer,
    bankrupt: false,
  };
}

// 玩家代表星途航空 (STR)，开局选择一个 3/4 星城市作为基地。
export function initNewGame(playerHubCityId) {
  state.version = SAVE_VERSION;
  state.year = 2000;
  state.quarter = 1;
  state.playerId = PLAYER_ID;
  state.playerHub = playerHubCityId;
  state.fuelPrice = 1.0;
  state.fuelPriceBase = 1.0;
  state.activeEffects = [];
  state.eventLog = [];
  state.pendingEvent = null;
  state.pendingDialog = null;
  state.landingApplications = [];
  state.lastQuarterReports = {};
  state.intelLog = [];
  state.thisTurnActions = [];
  state.gameOver = false;
  uidCounter = 1;
  routeCounter = 1;
  recomputeCityStates(2000);

  // 4 家 AI 巨头
  const ai = AIRLINES.map(tmpl => buildAirlineFromTemplate(tmpl, false));

  // 玩家：以选定城市为基地的星途航空
  const hubCity = CITY_BY_ID[playerHubCityId];
  const playerTmpl = {
    ...PLAYER_TEMPLATE,
    hubCity: playerHubCityId,
    country: hubCity ? hubCity.country : 'INT',
  };
  const player = buildAirlineFromTemplate(playerTmpl, true);

  state.airlines = [...ai, player];
}

function pickAiProfile(id) {
  // 4 家 AI: CCA 进取 / DAL 平衡 / DLH 平衡 / SIA 平衡
  const map = { CCA: 'aggressive', DAL: 'balanced', DLH: 'balanced', SIA: 'balanced' };
  return map[id] || 'balanced';
}

export function getPlayer() { return state.airlines.find(a => a.id === state.playerId); }
export function getAirline(id) { return state.airlines.find(a => a.id === id); }
export function findAircraft(airline, uid) { return airline.aircraft.find(a => a.uid === uid); }
export function findRoute(airline, routeId) { return airline.routes.find(r => r.id === routeId); }

// === 玩家操作日志 ===
export function logPlayerAction(type, desc) {
  if (!state.thisTurnActions) state.thisTurnActions = [];
  state.thisTurnActions.push({ type, desc, ts: Date.now() });
}
export function clearTurnActions() { state.thisTurnActions = []; }

// 季末为所有航线打基线快照（revert 用）；同步玩家航线和 AI 航线
export function commitAllRouteSnapshots() {
  for (const al of state.airlines) {
    for (const r of al.routes) {
      r._committed = { fare: r.fare, aircraftUid: r.aircraftUid };
    }
  }
}

export function routeIsModified(route) {
  if (!route._committed) return false;
  return route._committed.fare !== route.fare || route._committed.aircraftUid !== route.aircraftUid;
}

// === 序列化 ===
function buildPayload() {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    state: {
      year: state.year, quarter: state.quarter,
      playerId: state.playerId,
      playerHub: state.playerHub,
      fuelPrice: state.fuelPrice, fuelPriceBase: state.fuelPriceBase,
      activeEffects: state.activeEffects,
      eventLog: state.eventLog,
      pendingEvent: state.pendingEvent,
      pendingDialog: state.pendingDialog,
      landingApplications: state.landingApplications,
      lastQuarterReports: state.lastQuarterReports,
      intelLog: state.intelLog,
      thisTurnActions: state.thisTurnActions,
      gameOver: state.gameOver,
      airlines: state.airlines,
    },
    counters: { uid: uidCounter, route: routeCounter },
  };
}

// 返回 { ok: true } / { ok: false, reason: 'version'|'corrupt', oldVersion? }
function applyPayload(p) {
  if (!p) return { ok: false, reason: 'corrupt' };
  if (p.version !== SAVE_VERSION) {
    console.warn(`Save version mismatch: got v${p.version}, expected v${SAVE_VERSION}`);
    return { ok: false, reason: 'version', oldVersion: p.version };
  }
  Object.assign(state, p.state);
  if (!state.thisTurnActions) state.thisTurnActions = [];
  uidCounter = p.counters?.uid || 1;
  routeCounter = p.counters?.route || 1;
  return { ok: true };
}

export function saveGame() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPayload())); return true; }
  catch (e) { console.warn('save failed', e); return false; }
}
// 返回 { ok, reason?, oldVersion? } —— UI 据此区分"无存档/版本不兼容/解析失败"
export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ok: false, reason: 'empty' };
    return applyPayload(JSON.parse(raw));
  } catch (e) { console.warn('load failed', e); return { ok: false, reason: 'corrupt' }; }
}
export function clearSave() { try { localStorage.removeItem(STORAGE_KEY); } catch {} }
export function hasSave() { try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; } }

export function saveToSlot(slot) {
  if (slot < 1 || slot > NUM_SLOTS) return false;
  try { localStorage.setItem(SLOT_KEY(slot), JSON.stringify(buildPayload())); return true; }
  catch (e) { console.warn('save slot failed', e); return false; }
}
export function loadFromSlot(slot) {
  if (slot < 1 || slot > NUM_SLOTS) return { ok: false, reason: 'empty' };
  try {
    const raw = localStorage.getItem(SLOT_KEY(slot));
    if (!raw) return { ok: false, reason: 'empty' };
    return applyPayload(JSON.parse(raw));
  } catch (e) { console.warn('load slot failed', e); return { ok: false, reason: 'corrupt' }; }
}
export function deleteSlot(slot) {
  if (slot < 1 || slot > NUM_SLOTS) return false;
  try { localStorage.removeItem(SLOT_KEY(slot)); return true; } catch { return false; }
}
export function listSaveSlots() {
  const out = [];
  for (let i = 1; i <= NUM_SLOTS; i++) {
    try {
      const raw = localStorage.getItem(SLOT_KEY(i));
      if (!raw) { out.push(null); continue; }
      const p = JSON.parse(raw);
      if (!p || p.version !== SAVE_VERSION) { out.push(null); continue; }
      const me = p.state.airlines?.find(a => a.id === p.state.playerId);
      out.push({
        slot: i, savedAt: p.savedAt,
        year: p.state.year, quarter: p.state.quarter,
        airlineName: me?.nameZh || p.state.playerId,
        cash: me?.cash || 0,
        routes: me?.routes?.length || 0,
      });
    } catch { out.push(null); }
  }
  return out;
}

export { newUid, newRouteId };
