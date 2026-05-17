import { state, commitAllRouteSnapshots } from './state.js';
import { CITY_BY_ID, distanceKm, recomputeCityStates, SLOTS_BY_SIZE } from './data/cities.js';
import { AIRCRAFT_BY_ID, FLIGHTS_PER_QUARTER } from './data/aircraft.js';
import { EVENTS } from './data/events.js';

// === 季度推进总入口 ===
// aiActFn: AI 例行动作 (买机/开线/调价)
// aiChoiceFn: AI 对带 choice 的事件做选择 (传入 event, 由 ai.js 处理)
export function advanceQuarter(aiActFn, aiChoiceFn) {
  const triggered = triggerEventsForQuarter();
  // AI 先消化 choice 事件（玩家由 UI 单独处理）
  if (aiChoiceFn) {
    for (const ev of triggered) if (ev.choice) aiChoiceFn(ev);
  }
  if (aiActFn) aiActFn();
  simulateQuarterOperations();
  applyEndOfQuarterFinance();
  advanceTime();
  decayEffects();
  processLandingApplications();
  checkGameOver();
  // 季末所有航线 commit 一次基线，玩家下季的"还原"以此为准
  commitAllRouteSnapshots();
  return triggered;
}

// 单城市当前已使用的航线槽位 (所有航司聚合)
export function routesAtCity(cityId) {
  let n = 0;
  for (const al of state.airlines) for (const r of al.routes) {
    if (r.fromCity === cityId || r.toCity === cityId) n++;
  }
  return n;
}
export function cityRouteSlots(city) {
  return SLOTS_BY_SIZE[city.size] || 6;
}

export function advanceTime() {
  state.quarter += 1;
  if (state.quarter > 4) {
    state.quarter = 1; state.year += 1;
    // 跨年时同步城市规模演化 (亚洲崛起 etc.)
    recomputeCityStates(state.year);
  }
}

// === 事件触发 ===
export function triggerEventsForQuarter() {
  const triggered = [];
  for (const ev of EVENTS) {
    if (ev.triggerYear === state.year && ev.triggerQuarter === state.quarter && !state.eventLog.includes(ev.id)) {
      state.eventLog.push(ev.id);
      applyEventEffects(ev);
      triggered.push(ev);
    }
  }
  return triggered;
}

export function applyEventEffects(ev) {
  for (const eff of ev.effects || []) {
    if (eff.kind === 'unlock') continue;
    if (eff.kind === 'prestige') {
      if (eff.target === 'self') {
        const p = state.airlines.find(a => a.id === state.playerId);
        if (p && !p.bankrupt) p.prestige += eff.delta;
      } else if (eff.target === 'random') {
        const candidates = state.airlines.filter(a => !a.bankrupt);
        if (candidates.length === 0) continue;
        const a = candidates[Math.floor(Math.random() * candidates.length)];
        a.prestige += eff.delta;
      } else if (eff.target === 'all') {
        for (const a of state.airlines) if (!a.bankrupt) a.prestige += eff.delta;
      }
      continue;
    }
    if (eff.kind === 'fuel') {
      state.activeEffects.push({ kind: 'fuel', mult: eff.mult, remaining: eff.durationQuarters || 1 });
      recomputeFuelPrice();
      continue;
    }
    if (eff.kind === 'demand') {
      state.activeEffects.push({
        kind: 'demand', scope: eff.scope, mult: eff.mult,
        remaining: eff.durationQuarters || 1, startOffset: eff.startOffset || 0,
      });
      continue;
    }
    if (eff.kind === 'fleetGround') {
      state.activeEffects.push({ kind: 'fleetGround', modelIds: eff.modelIds, remaining: eff.durationQuarters || 1 });
      for (const a of state.airlines) for (const ac of a.aircraft) {
        if (eff.modelIds.includes(ac.modelId)) ac.grounded = true;
      }
      continue;
    }
    if (eff.kind === 'cost') {
      state.activeEffects.push({
        kind: 'cost', scope: eff.scope, addPerSeat: eff.addPerSeat || 0,
        remaining: eff.durationQuarters || 1,
      });
      continue;
    }
    if (eff.kind === 'fuelDistance') {
      state.activeEffects.push({
        kind: 'fuelDistance', regions: eff.regions, mult: eff.mult,
        remaining: eff.durationQuarters || 1,
      });
      continue;
    }
  }
}

export function applyChoiceOption(option, airline) {
  if (!option) return;
  if (option.costCash) airline.cash -= option.costCash;
  for (const eff of option.applyEffects || []) {
    if (eff.kind === 'prestige') {
      if (eff.target === 'self') airline.prestige += eff.delta;
      else if (eff.target === 'all') for (const a of state.airlines) if (!a.bankrupt) a.prestige += eff.delta;
    } else if (eff.kind === 'cashGrant') {
      airline.cash += eff.amount || 0;
    } else if (eff.kind === 'prestigePerQuarter') {
      airline.prestigePerQuarter += eff.delta || 0;
    }
  }
}

// === 季度模拟 ===
// 两大机制（拥挤度缩水已移除，蛋糕大小固定，对手只分走份额）：
//   1. 指数价格弹性  fareIndex = (baseFare/fare)^ELASTICITY_EXP
//      高价指数级抑制需求；低价反向放大吸引力
//   2. 马太效应  每条航线"吸引力 = 运力 × 价格力 × 声望"，再 ^MATTHEW_EXP
//      → 价格 / 声望优势的航线吃下不成比例的市场，弱者越弱
const ELASTICITY_EXP = 1.8;
const MATTHEW_EXP    = 1.6;

export function simulateQuarterOperations() {
  // Pass 1: 算每条有运力航线的运力 / 价格力 / 吸引力，聚合到 pair
  const pairs = {};
  for (const al of state.airlines) {
    if (al.bankrupt) continue;
    for (const r of al.routes) {
      const cap = quarterSeatCapacity(al, r);
      if (cap === 0) continue;
      const from = CITY_BY_ID[r.fromCity], to = CITY_BY_ID[r.toCity];
      const dist = distanceKm(from, to);
      const baseFare = 60 + dist * 0.08;
      const fareIndex = clamp(0.05, Math.pow(baseFare / Math.max(20, r.fare), ELASTICITY_EXP), 2.2);
      const prestigeBoost = 1 + (al.prestige - 50) * 0.0018;
      const attrRaw = cap * fareIndex * prestigeBoost;
      const attrW = Math.pow(attrRaw, MATTHEW_EXP);

      const key = pairKey(r.fromCity, r.toCity);
      const bucket = pairs[key] = pairs[key] || { routes: [], airlineSet: new Set() };
      bucket.routes.push({ al, r, cap, attrW, from, to, dist });
      bucket.airlineSet.add(al.id);
    }
  }

  // Pass 2: 每个 pair 算市场容量与总吸引力分母
  for (const key in pairs) {
    const b = pairs[key];
    const sample = b.routes[0];
    const distFactor = distanceFactor(sample.dist);
    const baseDemand = (sample.from.baseDemand + sample.to.baseDemand) / 2 * distFactor;
    const demandMult = demandMultiplierFor(sample.from, sample.to);
    const seasonality = seasonalityFactor();
    // 蛋糕大小固定，多家航司共享同一总量（份额由马太效应公式分配）
    b.marketSeats = baseDemand * demandMult * seasonality * 30;
    b.totalAttrW = b.routes.reduce((s, x) => s + x.attrW, 0) || 1;
  }

  // 初始化每家航司的 report
  const reports = {};
  for (const al of state.airlines) reports[al.id] = blankReport(al);

  // Pass 3: 按 pair 内的份额计算每条航线的载荷 / 收入 / 利润
  for (const key in pairs) {
    const b = pairs[key];
    for (const x of b.routes) {
      const share = x.attrW / b.totalAttrW;
      const myDemand = Math.min(x.cap, b.marketSeats * share);
      const loadFactor = clamp(0.02, myDemand / x.cap, 0.95);
      x.r.lastLoadFactor = loadFactor;

      const passengers = x.cap * loadFactor;
      const revenue = passengers * x.r.fare;
      const acModel = airlineAcModelForRoute(x.al, x.r);
      const fuelDistMult = fuelDistanceMultFor(x.from, x.to);
      const fuelCost = passengers * x.dist * fuelDistMult * acModel.fuelPerSeatKm * state.fuelPrice * 0.6;
      const flights = FLIGHTS_PER_QUARTER;
      const landingCostM = flights * (5 + (x.from.size + x.to.size)) / 1000;
      const serviceCostM = passengers * 22 / 1e6;
      let safetyCostM = 0;
      for (const e of state.activeEffects) {
        if (e.kind === 'cost' && matchesCostScope(e.scope, x.from, x.to)) {
          safetyCostM += passengers * e.addPerSeat / 1e6;
        }
      }
      const revenueM = revenue / 1e6;
      const fuelCostM = fuelCost / 1e6;
      const netM = revenueM - fuelCostM - landingCostM - serviceCostM - safetyCostM;
      x.r.lastProfit = netM;

      const rep = reports[x.al.id];
      rep.revenue += revenueM;
      rep.fuel += fuelCostM;
      rep.landing += landingCostM;
      rep.service += serviceCostM;
      rep.safety += safetyCostM;
      rep.passengers += passengers;
      rep.routes.push({ routeId: x.r.id, loadFactor, profit: netM, revenue: revenueM });
    }
  }

  // 无运力的航线置零
  for (const al of state.airlines) {
    if (al.bankrupt) continue;
    for (const r of al.routes) {
      if (quarterSeatCapacity(al, r) === 0) { r.lastLoadFactor = 0; r.lastProfit = 0; }
    }
  }

  // 营业现金流入账
  for (const al of state.airlines) {
    if (al.bankrupt) continue;
    const rep = reports[al.id];
    al.cash += (rep.revenue - rep.fuel - rep.landing - rep.service - rep.safety);
    state.lastQuarterReports[al.id] = rep;
  }
}

function blankReport(al) {
  return {
    airlineId: al.id, revenue: 0, fuel: 0, landing: 0,
    service: 0, safety: 0,
    maintenance: 0, passengers: 0, routes: [],
  };
}

function pairKey(a, b) { return [a, b].sort().join('_'); }

function distanceFactor(km) {
  if (km < 500) return 0.5;
  if (km < 1500) return 1.0;
  if (km < 5000) return 1.1;
  if (km < 10000) return 0.95;
  return 0.85;
}

function airlineAcModelForRoute(al, r) {
  if (!r.aircraftUid) return { fuelPerSeatKm: 0.03 };
  const ac = al.aircraft.find(a => a.uid === r.aircraftUid);
  if (!ac) return { fuelPerSeatKm: 0.03 };
  return AIRCRAFT_BY_ID[ac.modelId];
}

export function quarterSeatCapacity(al, r) {
  if (!r.aircraftUid) return 0;
  const ac = al.aircraft.find(a => a.uid === r.aircraftUid);
  if (!ac || ac.grounded) return 0;
  const m = AIRCRAFT_BY_ID[ac.modelId];
  const from = CITY_BY_ID[r.fromCity], to = CITY_BY_ID[r.toCity];
  const dist = distanceKm(from, to);
  if (m.rangeKm < dist) return 0;
  return m.capacity * FLIGHTS_PER_QUARTER;
}

function demandMultiplierFor(from, to) {
  let m = 1.0;
  for (const e of state.activeEffects) {
    if (e.kind !== 'demand') continue;
    if (e.startOffset && e.startOffset > 0) continue;
    if (matchesScope(e.scope, from, to)) m *= e.mult;
  }
  return m;
}
function fuelDistanceMultFor(from, to) {
  let m = 1.0;
  for (const e of state.activeEffects) {
    if (e.kind !== 'fuelDistance') continue;
    if (e.regions.includes(from.region) || e.regions.includes(to.region)) m *= e.mult;
  }
  return m;
}
function matchesScope(scope, from, to) {
  if (scope === 'global') return true;
  if (scope.startsWith('region:')) {
    const reg = scope.slice('region:'.length);
    return from.region === reg || to.region === reg;
  }
  if (scope.startsWith('country:')) {
    const c = scope.slice('country:'.length);
    return from.country === c || to.country === c;
  }
  return false;
}
function matchesCostScope(scope, from, to) {
  return matchesScope(scope, from, to);
}
function seasonalityFactor() {
  return state.quarter === 2 || state.quarter === 3 ? 1.10 : 0.92;
}
function clamp(min, x, max) { return Math.max(min, Math.min(max, x)); }

// 机队同制造商折扣：全 Boeing 或全 Airbus 时维护费 ×0.9
// （COMAC C919 视为中立，单一其它厂商也算单一品牌；仅在机队 ≥ 2 架时生效）
export const FLEET_MAINT_DISCOUNT = 0.10;
export function fleetMaintDiscountInfo(airline) {
  if (!airline.aircraft || airline.aircraft.length < 2) {
    return { eligible: false, brand: null, discount: 0, reason: '机队至少需 2 架' };
  }
  const brands = new Set();
  for (const ac of airline.aircraft) {
    const m = AIRCRAFT_BY_ID[ac.modelId];
    brands.add(m.manufacturer);
  }
  if (brands.size === 1) {
    const brand = [...brands][0];
    if (brand === 'Boeing' || brand === 'Airbus') {
      return { eligible: true, brand, discount: FLEET_MAINT_DISCOUNT, reason: `全 ${brand} 机队` };
    }
    return { eligible: false, brand, discount: 0, reason: `仅 Boeing 或 Airbus 单一品牌可享折扣` };
  }
  return { eligible: false, brand: null, discount: 0, reason: `机队含 ${brands.size} 个制造商` };
}

// === 财务 ===
// 无债务系统：现金 < 0 时 AI 自动抛售飞机筹资；玩家由 UI 弹窗强制选择。
export function applyEndOfQuarterFinance() {
  for (const al of state.airlines) {
    if (al.bankrupt) continue;
    let maint = 0;
    for (const ac of al.aircraft) maint += AIRCRAFT_BY_ID[ac.modelId].maintenancePerQuarter;
    const dInfo = fleetMaintDiscountInfo(al);
    if (dInfo.eligible) maint = maint * (1 - dInfo.discount);
    al.cash -= maint;
    state.lastQuarterReports[al.id].maintenance = maint;
    state.lastQuarterReports[al.id].maintDiscount = dInfo.eligible ? dInfo : null;

    for (const ac of al.aircraft) ac.ageQuarters += 1;
    if (al.prestigePerQuarter) al.prestige += al.prestigePerQuarter;

    // AI 现金告急 → 卖最便宜的飞机直到现金回正或无机可卖
    if (!al.isPlayer && al.cash < 0) {
      while (al.cash < 0 && al.aircraft.length > 0) {
        const sorted = [...al.aircraft].sort((a, b) => {
          const ma = AIRCRAFT_BY_ID[a.modelId], mb = AIRCRAFT_BY_ID[b.modelId];
          return ma.purchasePrice - mb.purchasePrice;
        });
        sellAircraft(al, sorted[0].uid);
      }
      if (al.cash < 0 && al.aircraft.length === 0) al.bankrupt = true;
    }
    // 玩家现金 < 0 且无机可卖：UI 端会判定为破产
    if (al.isPlayer && al.cash < 0 && al.aircraft.length === 0) al.bankrupt = true;
  }
}

export function decayEffects() {
  const next = [];
  for (const e of state.activeEffects) {
    if (e.startOffset && e.startOffset > 0) { e.startOffset -= 1; next.push(e); continue; }
    e.remaining -= 1;
    if (e.remaining > 0) next.push(e);
    else if (e.kind === 'fleetGround') {
      for (const a of state.airlines) for (const ac of a.aircraft) {
        if (e.modelIds.includes(ac.modelId)) ac.grounded = false;
      }
    }
  }
  state.activeEffects = next;
  recomputeFuelPrice();
}
export function recomputeFuelPrice() {
  let mult = 1.0;
  for (const e of state.activeEffects) if (e.kind === 'fuel') mult *= e.mult;
  state.fuelPrice = state.fuelPriceBase * mult;
}

export function processLandingApplications() {
  const stillPending = [];
  for (const app of state.landingApplications) {
    app.eta -= 1;
    if (app.eta <= 0) {
      const al = state.airlines.find(a => a.id === app.airlineId);
      if (al && !al.landingRights.includes(app.cityId)) al.landingRights.push(app.cityId);
    } else stillPending.push(app);
  }
  state.landingApplications = stillPending;
}

export function checkGameOver() {
  // 游戏时长缩短为 2000–2025 (25 年 / 100 季度)
  if (state.year > 2025 || (state.year === 2025 && state.quarter > 4)) state.gameOver = true;
}

// === 玩家 / AI 动作 ===
export function buyAircraft(airline, modelId) {
  const m = AIRCRAFT_BY_ID[modelId];
  if (!m) return { ok: false, msg: '机型不存在' };
  if (state.year < m.availableFrom || state.year > m.availableUntil) return { ok: false, msg: `该机型 ${m.availableFrom}-${m.availableUntil} 期间方可购买` };
  if (airline.cash < m.purchasePrice) return { ok: false, msg: '现金不足' };
  airline.cash -= m.purchasePrice;
  const ac = { uid: `u${Date.now()}${Math.floor(Math.random() * 999)}`, modelId, ageQuarters: 0, routeId: null, grounded: false };
  airline.aircraft.push(ac);
  return { ok: true, aircraft: ac };
}

export function sellAircraft(airline, uid) {
  const idx = airline.aircraft.findIndex(a => a.uid === uid);
  if (idx === -1) return { ok: false, msg: '飞机不存在' };
  const ac = airline.aircraft[idx];
  const m = AIRCRAFT_BY_ID[ac.modelId];
  const yrs = ac.ageQuarters / 4;
  const resale = Math.max(m.purchasePrice * 0.25, m.purchasePrice * Math.pow(0.95, yrs) * 0.7);
  airline.cash += resale;
  // 释放航线的飞机绑定
  if (ac.routeId) {
    const r = airline.routes.find(x => x.id === ac.routeId);
    if (r) r.aircraftUid = null;
  }
  airline.aircraft.splice(idx, 1);
  return { ok: true, resale };
}

// 开通新航线: 必须指定一架空闲且航程兼容的飞机；允许同一城市对开多条
export function openRoute(airline, fromCity, toCity, fare, aircraftUid) {
  if (fromCity === toCity) return { ok: false, msg: '起降城市不能相同' };
  if (!airline.landingRights.includes(fromCity)) return { ok: false, msg: `没有 ${fromCity} 着陆权` };
  if (!airline.landingRights.includes(toCity))   return { ok: false, msg: `没有 ${toCity} 着陆权` };
  // 检查两端城市的航线槽位
  const fromC = CITY_BY_ID[fromCity], toC = CITY_BY_ID[toCity];
  const fromUsed = routesAtCity(fromCity), fromCap = cityRouteSlots(fromC);
  if (fromUsed >= fromCap) return { ok: false, msg: `${fromC.nameZh} 航线槽位已满 (${fromUsed}/${fromCap})` };
  const toUsed = routesAtCity(toCity), toCap = cityRouteSlots(toC);
  if (toUsed >= toCap) return { ok: false, msg: `${toC.nameZh} 航线槽位已满 (${toUsed}/${toCap})` };

  if (!aircraftUid) return { ok: false, msg: '必须指定一架飞机' };
  const ac = airline.aircraft.find(a => a.uid === aircraftUid);
  if (!ac) return { ok: false, msg: '飞机不存在' };
  if (ac.routeId) return { ok: false, msg: '该飞机已在执飞其他航线' };
  if (ac.grounded) return { ok: false, msg: '该飞机被停飞' };
  const dist = distanceKm(fromC, toC);
  const m = AIRCRAFT_BY_ID[ac.modelId];
  if (m.rangeKm < dist) return { ok: false, msg: `${m.name} 航程不足（${m.rangeKm}km < ${dist}km）` };
  const finalFare = fare || Math.round(computeBreakEvenFare(airline, { fromCity, toCity }) * 2.0);
  const newRoute = {
    id: `r${Date.now()}${Math.floor(Math.random() * 999)}`,
    ownerId: airline.id,
    fromCity, toCity,
    fare: finalFare,
    aircraftUid: ac.uid,
    lastLoadFactor: 0,
    lastProfit: 0,
    _committed: { fare: finalFare, aircraftUid: ac.uid },
  };
  airline.routes.push(newRoute);
  ac.routeId = newRoute.id;
  return { ok: true, route: newRoute };
}

export function closeRoute(airline, routeId) {
  const idx = airline.routes.findIndex(r => r.id === routeId);
  if (idx === -1) return { ok: false };
  const r = airline.routes[idx];
  if (r.aircraftUid) {
    const ac = airline.aircraft.find(a => a.uid === r.aircraftUid);
    if (ac) ac.routeId = null;
  }
  airline.routes.splice(idx, 1);
  return { ok: true };
}

// 给一条航线换 / 设 / 卸飞机。newUid=null 卸下。
export function assignAircraftToRoute(airline, routeId, newAircraftUid) {
  const route = airline.routes.find(r => r.id === routeId);
  if (!route) return { ok: false, msg: '航线不存在' };
  const dist = distanceKm(CITY_BY_ID[route.fromCity], CITY_BY_ID[route.toCity]);
  // 先解除原飞机
  if (route.aircraftUid) {
    const oldAc = airline.aircraft.find(a => a.uid === route.aircraftUid);
    if (oldAc) oldAc.routeId = null;
  }
  if (newAircraftUid) {
    const ac = airline.aircraft.find(a => a.uid === newAircraftUid);
    if (!ac) return { ok: false, msg: '飞机不存在' };
    if (ac.routeId && ac.routeId !== routeId) return { ok: false, msg: '该飞机已在执飞其他航线' };
    if (ac.grounded) return { ok: false, msg: '该飞机被停飞' };
    const m = AIRCRAFT_BY_ID[ac.modelId];
    if (m.rangeKm < dist) return { ok: false, msg: `${m.name} 航程不够（${m.rangeKm}km < ${dist}km）` };
    ac.routeId = route.id;
    route.aircraftUid = newAircraftUid;
  } else {
    route.aircraftUid = null;
  }
  return { ok: true };
}

export function applyForLanding(airline, cityId) {
  if (airline.landingRights.includes(cityId)) return { ok: false, msg: '已拥有' };
  if (state.landingApplications.find(a => a.airlineId === airline.id && a.cityId === cityId)) return { ok: false, msg: '已在排队' };
  const city = CITY_BY_ID[cityId];
  const eta = Math.max(1, 5 - city.size);
  const fee = 20 + city.size * 10;
  if (airline.cash < fee) return { ok: false, msg: '申请费不足' };
  airline.cash -= fee;
  state.landingApplications.push({ airlineId: airline.id, cityId, eta });
  return { ok: true, eta, fee };
}

export function setFare(airline, routeId, fare) {
  const r = airline.routes.find(x => x.id === routeId);
  if (!r) return { ok: false };
  r.fare = Math.max(20, Math.round(fare));
  return { ok: true };
}

// 估算每位乘客的盈亏平衡票价（USD）
export function computeBreakEvenFare(airline, route) {
  const a = CITY_BY_ID[route.fromCity], b = CITY_BY_ID[route.toCity];
  const dist = distanceKm(a, b);
  const fuelPerSeat = dist * 0.03 * 0.6 * state.fuelPrice;
  const opPerSeat = 25 + (a.size + b.size) * 2;
  return Math.max(20, Math.round(fuelPerSeat + opPerSeat));
}

// 推荐默认票价：盈亏平衡 × 2.0 (50% 毛利率)
export function recommendedFare(airline, route) {
  return Math.round(computeBreakEvenFare(airline, route) * 2.0);
}

// === 事件影响 → 人类可读描述 ===
const REGION_LABEL = {
  asia: '亚洲', europe: '欧洲', namerica: '北美', samerica: '南美',
  mideast: '中东', oceania: '大洋洲', africa: '非洲',
};
const COUNTRY_LABEL = {
  CN: '中国', US: '美国', GB: '英国', FR: '法国', DE: '德国', JP: '日本',
  HK: '中国香港', SG: '新加坡', IN: '印度', AE: '阿联酋', TR: '土耳其',
  ES: '西班牙', BR: '巴西', AU: '澳大利亚', RU: '俄罗斯', MX: '墨西哥',
  CA: '加拿大', ZA: '南非', EG: '埃及', TH: '泰国', IT: '意大利',
};
function scopeLabel(scope) {
  if (!scope || scope === 'global') return '全球';
  if (scope.startsWith('region:')) return REGION_LABEL[scope.slice(7)] || scope.slice(7);
  if (scope.startsWith('country:')) return COUNTRY_LABEL[scope.slice(8)] || scope.slice(8);
  return scope;
}
function durLabel(q) {
  if (!q || q >= 999) return '永久';
  return `持续 ${q} 季`;
}
export function describeEffect(eff) {
  switch (eff.kind) {
    case 'demand': {
      const pct = Math.round((eff.mult - 1) * 100);
      const sign = pct >= 0 ? '+' : '';
      const start = eff.startOffset ? ` (延迟 ${eff.startOffset} 季生效)` : '';
      return `${scopeLabel(eff.scope)} 客流 ${sign}${pct}% (${durLabel(eff.durationQuarters)})${start}`;
    }
    case 'fuel': {
      const pct = Math.round((eff.mult - 1) * 100);
      const sign = pct >= 0 ? '+' : '';
      return `全球油价 ${sign}${pct}% (${durLabel(eff.durationQuarters)})`;
    }
    case 'fleetGround': {
      const names = (eff.modelIds || []).map(id => AIRCRAFT_BY_ID[id]?.name || id).join('、');
      return `${names} 全球停飞 (${durLabel(eff.durationQuarters)})`;
    }
    case 'cost': {
      return `${scopeLabel(eff.scope)} 每座额外成本 +$${eff.addPerSeat} (${durLabel(eff.durationQuarters)})`;
    }
    case 'fuelDistance': {
      const pct = Math.round((eff.mult - 1) * 100);
      const sign = pct >= 0 ? '+' : '';
      const regs = (eff.regions || []).map(r => REGION_LABEL[r] || r).join('/');
      return `${regs} 航线绕飞，油耗 ${sign}${pct}% (${durLabel(eff.durationQuarters)})`;
    }
    case 'prestige': {
      const tgt = eff.target === 'self' ? '玩家' : eff.target === 'all' ? '全部航司' : '随机一家航司';
      const sign = eff.delta >= 0 ? '+' : '';
      return `${tgt} 声望 ${sign}${eff.delta}`;
    }
    case 'unlock': {
      return `解锁新机型：${AIRCRAFT_BY_ID[eff.modelId]?.name || eff.modelId}`;
    }
    default: return JSON.stringify(eff);
  }
}
export function describeEvent(ev) {
  const lines = (ev.effects || []).map(describeEffect);
  return lines;
}
