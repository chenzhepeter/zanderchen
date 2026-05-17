import { AIRLINES } from './data/airlines.js';
import { AIRCRAFT_BY_ID } from './data/aircraft.js';
import { CITIES, CITY_BY_ID, distanceKm, recomputeCityStates } from './data/cities.js';

export const STORAGE_KEY = 'airline.save';
export const SLOT_KEY = (i) => `airline.slot.${i}`;
export const SAVE_VERSION = 11;
export const NUM_SLOTS = 5;
export const APP_VERSION = '2026.5.17.1';

// 单例 GameState
// 注意: route 现在只挂 1 架飞机（route.aircraftUid，可为 null）；同一城市对允许多条独立航线
export const state = {
  version: SAVE_VERSION,
  year: 2000,
  quarter: 1,
  playerId: null,
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

export function initNewGame(playerId) {
  state.version = SAVE_VERSION;
  state.year = 2000;
  state.quarter = 1;
  state.playerId = playerId;
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

  state.airlines = AIRLINES.map(tmpl => {
    const isPlayer = tmpl.id === playerId;
    const aircraft = [];
    for (const { modelId, count } of tmpl.initialFleet) {
      for (let i = 0; i < count; i++) {
        aircraft.push({ uid: newUid(), modelId, ageQuarters: Math.floor(Math.random() * 20), routeId: null, grounded: false });
      }
    }
    const landingRights = new Set([tmpl.hubCity]);
    for (const [fromId, toId] of tmpl.initialRoutes) {
      landingRights.add(fromId);
      landingRights.add(toId);
    }
    // 路线骨架（不带飞机和票价）
    const routes = tmpl.initialRoutes.map(([fromId, toId]) => ({
      id: newRouteId(),
      ownerId: tmpl.id,
      fromCity: fromId,
      toCity: toId,
      fare: 0,
      aircraftUid: null,
      lastLoadFactor: 0.75,
      lastProfit: 0,
      _committed: null,  // 季末提交的"基线"，revert 用
    }));
    // 按距离从长到短分配兼容飞机，确保长航线先拿到大飞机
    const byDist = routes.map(r => ({
      r, dist: distanceKm(CITY_BY_ID[r.fromCity], CITY_BY_ID[r.toCity]),
    })).sort((a, b) => b.dist - a.dist);
    for (const { r, dist } of byDist) {
      const ac = aircraft.find(a => !a.routeId && AIRCRAFT_BY_ID[a.modelId].rangeKm >= dist);
      if (ac) { ac.routeId = r.id; r.aircraftUid = ac.uid; }
      // 默认票价: 盈亏平衡价 × 2.0（50% 毛利率）
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
      routes,
      landingRights: Array.from(landingRights),
      aiProfile: isPlayer ? null : pickAiProfile(tmpl.id),
      isPlayer,
      bankrupt: false,
    };
  });
}

function pickAiProfile(id) {
  // 4 家航司: CCA 进取 / DAL 平衡 / IBE 保守 / SIA 平衡
  const map = { CCA: 'aggressive', DAL: 'balanced', IBE: 'conservative', SIA: 'balanced' };
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
