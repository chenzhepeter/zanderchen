import { AIRLINES } from './data/airlines.js';
import { AIRCRAFT_BY_ID } from './data/aircraft.js';
import { CITIES, CITY_BY_ID, distanceKm } from './data/cities.js';

export const STORAGE_KEY = 'airline.save';     // 自动存档
export const SLOT_KEY = (i) => `airline.slot.${i}`;
export const SAVE_VERSION = 5;
export const NUM_SLOTS = 5;

// Ad tier 配置（取代之前的 adSpend 数值）
export const AD_TIERS = {
  none:  { cost: 0,    boost: 1.00, label: '无广告' },
  small: { cost: 1e6,  boost: 1.06, label: '小额广告 ($1M)' },
  large: { cost: 4e6,  boost: 1.15, label: '大额广告 ($4M)' },
};

// 单例 GameState
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
  thisTurnActions: [],   // 本季玩家操作日志（结束季度时回顾，季末清空）
  gameOver: false,
};

let uidCounter = 1;
function newUid() { return `u${uidCounter++}`; }
let routeCounter = 1;
function newRouteId() { return `r${routeCounter++}`; }

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
    // 先建好航线对象（不带飞机）
    const routes = tmpl.initialRoutes.map(([fromId, toId]) => ({
      id: newRouteId(),
      ownerId: tmpl.id,
      fromCity: fromId,
      toCity: toId,
      fare: defaultFareFor(fromId, toId),
      adTier: 'none',
      assignedAircraft: [],
      lastLoadFactor: 0.75,
      lastProfit: 0,
    }));
    // 给每条航线找一架航程足够的闲置飞机
    // 按航线距离从长到短分配，确保长航线先拿到大飞机
    const routeByDist = routes.map(r => ({
      r, dist: distanceKm(CITY_BY_ID[r.fromCity], CITY_BY_ID[r.toCity]),
    })).sort((a, b) => b.dist - a.dist);
    for (const { r, dist } of routeByDist) {
      const ac = aircraft.find(a => !a.routeId && AIRCRAFT_BY_ID[a.modelId].rangeKm >= dist);
      if (ac) {
        ac.routeId = r.id;
        r.assignedAircraft.push(ac.uid);
      }
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
      debt: tmpl.initialDebt,
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
  const map = { CCA: 'aggressive', DAL: 'balanced', DLH: 'conservative', SIA: 'balanced' };
  return map[id] || 'balanced';
}

export function defaultFareFor(fromId, toId) {
  const a = CITY_BY_ID[fromId], b = CITY_BY_ID[toId];
  const d = distanceKm(a, b);
  return Math.round(60 + d * 0.08);
}

export function getPlayer() {
  return state.airlines.find(a => a.id === state.playerId);
}

export function getAirline(id) {
  return state.airlines.find(a => a.id === id);
}

export function findAircraft(airline, uid) {
  return airline.aircraft.find(a => a.uid === uid);
}

export function findRoute(airline, routeId) {
  return airline.routes.find(r => r.id === routeId);
}

// === 玩家操作日志（用于结束季度的确认弹窗） ===
export function logPlayerAction(type, desc) {
  if (!state.thisTurnActions) state.thisTurnActions = [];
  state.thisTurnActions.push({ type, desc, ts: Date.now() });
}

export function clearTurnActions() {
  state.thisTurnActions = [];
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

function applyPayload(p) {
  if (!p || p.version !== SAVE_VERSION) return false;
  Object.assign(state, p.state);
  if (!state.thisTurnActions) state.thisTurnActions = [];
  uidCounter = p.counters?.uid || 1;
  routeCounter = p.counters?.route || 1;
  return true;
}

// 自动存档
export function saveGame() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPayload())); return true; }
  catch (e) { console.warn('save failed', e); return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return applyPayload(JSON.parse(raw));
  } catch (e) { console.warn('load failed', e); return false; }
}

export function clearSave() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function hasSave() {
  try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
}

// 手动多档存档（5 个槽位）
export function saveToSlot(slot) {
  if (slot < 1 || slot > NUM_SLOTS) return false;
  try { localStorage.setItem(SLOT_KEY(slot), JSON.stringify(buildPayload())); return true; }
  catch (e) { console.warn('save slot failed', e); return false; }
}

export function loadFromSlot(slot) {
  if (slot < 1 || slot > NUM_SLOTS) return false;
  try {
    const raw = localStorage.getItem(SLOT_KEY(slot));
    if (!raw) return false;
    return applyPayload(JSON.parse(raw));
  } catch (e) { console.warn('load slot failed', e); return false; }
}

export function deleteSlot(slot) {
  if (slot < 1 || slot > NUM_SLOTS) return false;
  try { localStorage.removeItem(SLOT_KEY(slot)); return true; } catch { return false; }
}

// 返回 5 个槽位的元信息（空槽为 null）
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
        slot: i,
        savedAt: p.savedAt,
        year: p.state.year,
        quarter: p.state.quarter,
        airlineName: me?.nameZh || p.state.playerId,
        cash: me?.cash || 0,
        routes: me?.routes?.length || 0,
      });
    } catch { out.push(null); }
  }
  return out;
}

export { newUid, newRouteId };
