import { state, commitAllRouteSnapshots } from './state.js';
import { CITY_BY_ID, distanceKm, recomputeCityStates, SLOTS_BY_SIZE } from './data/cities.js';
import { AIRCRAFT_BY_ID, FLIGHTS_PER_QUARTER } from './data/aircraft.js';
import { EVENTS } from './data/events.js';

// === 季度推进总入口 ===
export function advanceQuarter(aiActFn) {
  const triggered = triggerEventsForQuarter();
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
        if (p) p.prestige += eff.delta;
      } else if (eff.target === 'random') {
        const a = state.airlines[Math.floor(Math.random() * state.airlines.length)];
        a.prestige += eff.delta;
      } else if (eff.target === 'all') {
        for (const a of state.airlines) a.prestige += eff.delta;
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
      else if (eff.target === 'all') for (const a of state.airlines) a.prestige += eff.delta;
    } else if (eff.kind === 'cashGrant') {
      airline.cash += eff.amount || 0;
      airline.debt += eff.debtAdd || 0;
    } else if (eff.kind === 'prestigePerQuarter') {
      airline.prestigePerQuarter += eff.delta || 0;
    }
  }
}

// === 季度模拟 ===
// 每条航线只挂一架飞机；同一城市对可以有多条独立航线（含同公司多条）。
// 载荷率核心：市场容量 / 总运力 × 价格吸引力 × 声望微调 × 拥挤度惩罚。
export function simulateQuarterOperations() {
  // 先按 city pair 聚合：所有航司、所有航线的总运力 + 按公司分组的运力
  const pairTotals = {}; // key -> { totalSeats, byOwner: {airlineId: seats}, ownerCount }
  const routeInfo = [];

  for (const al of state.airlines) {
    if (al.bankrupt) continue;
    for (const r of al.routes) {
      const cap = quarterSeatCapacity(al, r);
      const key = pairKey(r.fromCity, r.toCity);
      const bucket = pairTotals[key] = pairTotals[key] || { totalSeats: 0, byOwner: {} };
      bucket.totalSeats += cap;
      bucket.byOwner[al.id] = (bucket.byOwner[al.id] || 0) + cap;
      routeInfo.push({ al, r, cap, key });
    }
  }
  // 缓存每条 pair 的不同航司数量
  for (const key in pairTotals) {
    pairTotals[key].ownerCount = Object.keys(pairTotals[key].byOwner).length;
  }

  for (const al of state.airlines) {
    if (al.bankrupt) { state.lastQuarterReports[al.id] = blankReport(al); continue; }
    const report = blankReport(al);

    for (const r of al.routes) {
      const info = routeInfo.find(x => x.al === al && x.r === r);
      const cap = info.cap;
      if (cap === 0) { r.lastLoadFactor = 0; r.lastProfit = 0; continue; }

      const from = CITY_BY_ID[r.fromCity], to = CITY_BY_ID[r.toCity];
      const dist = distanceKm(from, to);

      const distFactor = distanceFactor(dist);
      const baseDemand = (from.baseDemand + to.baseDemand) / 2 * distFactor;
      const demandMult = demandMultiplierFor(from, to);
      const seasonality = seasonalityFactor();
      const marketSeats = baseDemand * demandMult * seasonality * 30;

      // 价格弹性（相对于"参考票价"）。过高的票价应严重打击需求。
      const baseFare = 60 + dist * 0.08;
      const fareIndex = clamp(0.08, baseFare / Math.max(20, r.fare), 1.5);
      const prestigeBoost = 1 + (al.prestige - 50) * 0.0015;

      // 拥挤度: 该城市对上的不同航司数量
      const ownerCount = pairTotals[info.key].ownerCount;
      const crowdPenalty = 1 / (1 + 0.25 * (ownerCount - 1));

      // 本航司在该城市对的运力份额（如果同公司多条航线，聚合后份额一致）
      const myCap = pairTotals[info.key].byOwner[al.id] || 0;
      const myShareInOwner = myCap > 0 ? cap / myCap : 1;  // 此航线占本公司在该对的份额
      const myOwnerShare = pairTotals[info.key].totalSeats > 0 ? myCap / pairTotals[info.key].totalSeats : 1;

      // 本航线吸引的乘客 = 市场总容量 × 本公司份额 × 价格 × 声望 × 拥挤度 × (该航线在本公司的比例)
      const myDemand = Math.min(cap, marketSeats * myOwnerShare * fareIndex * prestigeBoost * crowdPenalty * myShareInOwner);
      const loadFactor = clamp(0.05, myDemand / cap, 0.95);

      r.lastLoadFactor = loadFactor;
      const passengers = cap * loadFactor;
      const revenue = passengers * r.fare;  // USD

      // 燃油（单飞机机型决定燃效）
      const acModel = airlineAcModelForRoute(al, r);
      const fuelDistMult = fuelDistanceMultFor(from, to);
      const fuelCost = passengers * dist * fuelDistMult * acModel.fuelPerSeatKm * state.fuelPrice * 0.6;
      const flights = FLIGHTS_PER_QUARTER * (cap > 0 ? 1 : 0);
      const landingCostM = flights * (5 + (from.size + to.size)) / 1000;
      const serviceCostM = passengers * 22 / 1e6;

      let safetyCostM = 0;
      for (const e of state.activeEffects) {
        if (e.kind === 'cost') {
          if (matchesCostScope(e.scope, from, to)) safetyCostM += passengers * e.addPerSeat / 1e6;
        }
      }

      const revenueM = revenue / 1e6;
      const fuelCostM = fuelCost / 1e6;
      const netM = revenueM - fuelCostM - landingCostM - serviceCostM - safetyCostM;
      r.lastProfit = netM;

      report.revenue += revenueM;
      report.fuel += fuelCostM;
      report.landing += landingCostM;
      report.service += serviceCostM;
      report.safety += safetyCostM;
      report.passengers += passengers;
      report.routes.push({ routeId: r.id, loadFactor, profit: netM, revenue: revenueM });
    }

    al.cash += (report.revenue - report.fuel - report.landing - report.service - report.safety);
    state.lastQuarterReports[al.id] = report;
  }
}

function blankReport(al) {
  return {
    airlineId: al.id, revenue: 0, fuel: 0, landing: 0,
    service: 0, safety: 0,
    maintenance: 0, interest: 0, passengers: 0, routes: [],
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

// === 财务 ===
export function applyEndOfQuarterFinance() {
  for (const al of state.airlines) {
    if (al.bankrupt) continue;
    let maint = 0;
    for (const ac of al.aircraft) maint += AIRCRAFT_BY_ID[ac.modelId].maintenancePerQuarter;
    al.cash -= maint;
    state.lastQuarterReports[al.id].maintenance = maint;

    const interest = al.debt * 0.015;
    al.cash -= interest;
    state.lastQuarterReports[al.id].interest = interest;

    for (const ac of al.aircraft) ac.ageQuarters += 1;
    if (al.prestigePerQuarter) al.prestige += al.prestigePerQuarter;
    if (al.cash < -2000) al.bankrupt = true;
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
  if (state.year > 2030 || (state.year === 2030 && state.quarter > 4)) state.gameOver = true;
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
