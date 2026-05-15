import { AIRLINES } from './data/airlines.js';
import { AIRCRAFT_BY_ID } from './data/aircraft.js';
import { CITIES, CITY_BY_ID, distanceKm } from './data/cities.js';

export const STORAGE_KEY = 'airline.save';
export const SAVE_VERSION = 3;

// 单例 GameState — 用模块内可变对象暴露
export const state = {
  version: SAVE_VERSION,
  year: 2000,
  quarter: 1,
  playerId: null,         // 玩家选中的航司 id
  airlines: [],           // 4 家 (含玩家)
  fuelPrice: 1.0,         // 单位倍率，1.0 = 基准
  fuelPriceBase: 1.0,
  activeEffects: [],      // 来自历史事件的持续效果
  eventLog: [],           // 已触发过的事件 id 列表
  pendingEvent: null,     // 等待玩家决策的事件
  pendingDialog: null,    // 季度结算弹窗
  landingApplications: [],// {airlineId, cityId, eta}
  lastQuarterReports: {}, // airlineId -> { revenue, fuel, opCost, profit, routes: [...] }
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
  state.gameOver = false;
  uidCounter = 1;
  routeCounter = 1;

  state.airlines = AIRLINES.map(tmpl => {
    const isPlayer = tmpl.id === playerId;
    const aircraft = [];
    for (const { modelId, count } of tmpl.initialFleet) {
      for (let i = 0; i < count; i++) {
        aircraft.push({ uid: newUid(), modelId, ageQuarters: Math.floor(Math.random()*20), routeId: null, grounded: false });
      }
    }
    const routes = [];
    const landingRights = new Set([tmpl.hubCity]);
    for (const [fromId, toId] of tmpl.initialRoutes) {
      landingRights.add(fromId);
      landingRights.add(toId);
      const r = {
        id: newRouteId(),
        ownerId: tmpl.id,
        fromCity: fromId,
        toCity: toId,
        fare: defaultFareFor(fromId, toId),
        serviceLevel: 2,
        adSpend: 0,
        assignedAircraft: [],
        lastLoadFactor: 0.75,
        lastProfit: 0,
      };
      routes.push(r);
    }
    // 给每条初始航线分配一架飞机（找一架尚未分配的）
    for (const r of routes) {
      const dist = distanceKm(CITY_BY_ID[r.fromCity], CITY_BY_ID[r.toCity]);
      const ac = aircraft.find(a => !a.routeId && AIRCRAFT_BY_ID[a.modelId].rangeKm >= dist);
      if (ac) { ac.routeId = r.id; r.assignedAircraft.push(ac.uid); }
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
  // 固定分配避免 RNG: 让不同基地的 AI 各具个性
  const map = { CCA: 'aggressive', DAL: 'balanced', DLH: 'conservative', SIA: 'balanced' };
  return map[id] || 'balanced';
}

// 默认票价：粗略 = 60 + 距离*0.08 (美元)
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

// ---- save / load ----
export function saveGame() {
  const payload = {
    version: SAVE_VERSION,
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
      gameOver: state.gameOver,
      airlines: state.airlines,
    },
    counters: { uid: uidCounter, route: routeCounter },
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.warn('save failed', e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw);
    if (!p || p.version !== SAVE_VERSION) return false;
    Object.assign(state, p.state);
    uidCounter = p.counters?.uid || 1;
    routeCounter = p.counters?.route || 1;
    return true;
  } catch (e) {
    console.warn('load failed', e);
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function hasSave() {
  try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
}

// 暴露 uid 工厂供 ui.js 使用
export { newUid, newRouteId };
