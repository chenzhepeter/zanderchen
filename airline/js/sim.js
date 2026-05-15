import { state } from './state.js';
import { CITY_BY_ID, distanceKm } from './data/cities.js';
import { AIRCRAFT_BY_ID, FLIGHTS_PER_QUARTER } from './data/aircraft.js';
import { EVENTS } from './data/events.js';

// 季度推进总入口 (在玩家点击"结束回合"后调用)
export function advanceQuarter(aiActFn) {
  // 1) 触发本季度历史事件 (返回 pendingEvent 用于 UI 弹窗)
  const triggered = triggerEventsForQuarter();
  // 2) AI 行动
  if (aiActFn) aiActFn();
  // 3) 模拟全部航司的本季运营
  simulateQuarterOperations();
  // 4) 老化、利息、维护
  applyEndOfQuarterFinance();
  // 5) 推进时间
  advanceTime();
  // 6) 解锁机型、衰减效果
  decayEffects();
  // 7) 处理着陆权申请
  processLandingApplications();
  // 8) 终局
  checkGameOver();
  return triggered;
}

// === 时间 ===
export function advanceTime() {
  state.quarter += 1;
  if (state.quarter > 4) { state.quarter = 1; state.year += 1; }
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
    if (eff.kind === 'unlock') {
      // unlocks are evaluated at purchase time (via aircraft availableFrom); we add to log only
      continue;
    }
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
      state.activeEffects.push({
        kind: 'fuel', mult: eff.mult,
        remaining: eff.durationQuarters || 1,
      });
      recomputeFuelPrice();
      continue;
    }
    if (eff.kind === 'demand') {
      state.activeEffects.push({
        kind: 'demand',
        scope: eff.scope, mult: eff.mult,
        remaining: eff.durationQuarters || 1,
        startOffset: eff.startOffset || 0,
      });
      continue;
    }
    if (eff.kind === 'fleetGround') {
      state.activeEffects.push({
        kind: 'fleetGround',
        modelIds: eff.modelIds,
        remaining: eff.durationQuarters || 1,
      });
      // 立刻接地
      for (const a of state.airlines) {
        for (const ac of a.aircraft) {
          if (eff.modelIds.includes(ac.modelId)) ac.grounded = true;
        }
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

// 玩家选择 choice 后执行
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

// === 模拟一季度 ===
export function simulateQuarterOperations() {
  // 计算所有航线本季载荷率与利润
  // 同一城市对若多家航司开通，分摊总需求
  const pairTotals = {}; // "PEK_HKG" -> { totalSeats, byOwner: { ownerId: seats } }
  const routeInfo = []; // 缓存

  for (const al of state.airlines) {
    if (al.bankrupt) continue;
    for (const r of al.routes) {
      const cap = quarterSeatCapacity(al, r);
      const key = pairKey(r.fromCity, r.toCity);
      pairTotals[key] = pairTotals[key] || { totalSeats: 0, byOwner: {} };
      pairTotals[key].totalSeats += cap;
      pairTotals[key].byOwner[al.id] = (pairTotals[key].byOwner[al.id] || 0) + cap;
      routeInfo.push({ al, r, cap, key });
    }
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

      const baseDemand = (from.baseDemand + to.baseDemand) / 2 * distFactor; // 抽象成"每季最大潜在载客"
      const demandMult = demandMultiplierFor(from, to);
      const seasonality = seasonalityFactor(from, to);
      // 总市场容量 (本季度该城市对的潜在乘客)
      const marketSeats = baseDemand * demandMult * seasonality * 30; // 系数让数字落在数千-数万

      // 价格弹性: 玩家或 AI 设的 fare 与 baseFare 之比
      const baseFare = 60 + dist * 0.08;
      const fareIndex = clamp(baseFare / Math.max(20, r.fare), 0.35, 1.6);
      const serviceBoost = 1 + (r.serviceLevel - 2) * 0.10; // 等级 1/2/3 -> 0.9/1.0/1.1
      const adBoost = 1 + Math.log10(1 + r.adSpend / 1e6) * 0.05;
      const prestigeBoost = 1 + (al.prestige - 50) * 0.001;

      const attractiveness = fareIndex * serviceBoost * adBoost * prestigeBoost;
      // 本航司在该城市对的运力占比
      const totalPairCap = pairTotals[info.key].totalSeats;
      const myShare = cap / totalPairCap;
      // 市场份额 = 运力份额 × 吸引力的相对优势(简化: attractiveness 作为系数)
      const myDemand = Math.min(cap, marketSeats * myShare * attractiveness);
      const loadFactor = clamp(myDemand / cap, 0.10, 0.95);

      r.lastLoadFactor = loadFactor;

      const passengers = cap * loadFactor;
      const revenue = passengers * r.fare;

      // 燃油
      const model = avgFleetModelOnRoute(al, r); // 加权平均
      const fuelDistMult = fuelDistanceMultFor(from, to);
      const fuelCost = passengers * dist * fuelDistMult * model.fuelPerSeatKm * state.fuelPrice * 0.6; // 0.6: 单位标定
      // 着陆费 + 服务运营
      const flights = quarterFlightsOnRoute(al, r);
      const landingFee = flights * 8; // 每航段 8 千美元 = 0.008 百万 → 这里我们以"千美元"为内部单位再除以 1000
      // 我们将所有金额折算成百万美元；landingFee/seats 等需要重新标定
      // 为简化，下面所有"乘客×单价"已使每条短航线收入约 0.5-3 百万 量级
      // landingFee 用 dist 与 size 折算到百万
      const landingCostM = flights * (5 + (from.size + to.size)) / 1000; // 每架次几千美元 → 百万级
      // 服务 / 餐食
      const serviceCostM = passengers * (10 + r.serviceLevel * 8) / 1000_000; // 美元/座 → 百万
      // 广告也是支出
      const adCostM = r.adSpend / 1e6;

      // 永久性事件成本 (9/11 后的安保 +8/座)
      let safetyCostM = 0;
      for (const e of state.activeEffects) {
        if (e.kind === 'cost' && (e.scope === 'global')) {
          safetyCostM += passengers * e.addPerSeat / 1e6;
        }
      }

      const profit = revenue/1000 - fuelCost/1000 - landingCostM - serviceCostM - adCostM - safetyCostM;
      // 收入/燃油单位:  revenue 单位"美元"，÷1000 转千美元; profit 仍以"千美元"小数级 → 这里我们再除1000转百万
      const revenueM = revenue / 1e6;
      const fuelCostM = fuelCost / 1e6;
      const netM = revenueM - fuelCostM - landingCostM - serviceCostM - adCostM - safetyCostM;
      r.lastProfit = netM;

      report.revenue += revenueM;
      report.fuel += fuelCostM;
      report.landing += landingCostM;
      report.service += serviceCostM;
      report.ad += adCostM;
      report.safety += safetyCostM;
      report.passengers += passengers;
      report.routes.push({ routeId: r.id, loadFactor, profit: netM, revenue: revenueM });
    }

    al.cash += (report.revenue - report.fuel - report.landing - report.service - report.ad - report.safety);
    state.lastQuarterReports[al.id] = report;
  }
}

function blankReport(al) {
  return {
    airlineId: al.id, revenue: 0, fuel: 0, landing: 0,
    service: 0, ad: 0, safety: 0,
    maintenance: 0, interest: 0, passengers: 0, routes: [],
  };
}

function pairKey(a, b) { return [a, b].sort().join('_'); }

function distanceFactor(km) {
  // 距离过短或过长都减弱需求
  if (km < 500) return 0.5;
  if (km < 1500) return 1.0;
  if (km < 5000) return 1.1;
  if (km < 10000) return 0.95;
  return 0.85;
}

function quarterFlightsOnRoute(al, r) {
  const from = CITY_BY_ID[r.fromCity], to = CITY_BY_ID[r.toCity];
  const dist = distanceKm(from, to);
  let total = 0;
  for (const uid of r.assignedAircraft) {
    const ac = al.aircraft.find(x => x.uid === uid);
    if (!ac || ac.grounded) continue;
    const model = AIRCRAFT_BY_ID[ac.modelId];
    if (model.rangeKm < dist) continue;
    total += FLIGHTS_PER_QUARTER;
  }
  return total;
}

export function quarterSeatCapacity(al, r) {
  const from = CITY_BY_ID[r.fromCity], to = CITY_BY_ID[r.toCity];
  const dist = distanceKm(from, to);
  let total = 0;
  for (const uid of r.assignedAircraft) {
    const ac = al.aircraft.find(x => x.uid === uid);
    if (!ac || ac.grounded) continue;
    const model = AIRCRAFT_BY_ID[ac.modelId];
    if (model.rangeKm < dist) continue;
    total += model.capacity * FLIGHTS_PER_QUARTER;
  }
  return total;
}

function avgFleetModelOnRoute(al, r) {
  let totalSeats = 0, weightedFuel = 0;
  for (const uid of r.assignedAircraft) {
    const ac = al.aircraft.find(x => x.uid === uid);
    if (!ac) continue;
    const m = AIRCRAFT_BY_ID[ac.modelId];
    totalSeats += m.capacity;
    weightedFuel += m.fuelPerSeatKm * m.capacity;
  }
  if (totalSeats === 0) return { fuelPerSeatKm: 0.03 };
  return { fuelPerSeatKm: weightedFuel / totalSeats };
}

function demandMultiplierFor(from, to) {
  let m = 1.0;
  for (const e of state.activeEffects) {
    if (e.kind !== 'demand') continue;
    if (e.startOffset && e.startOffset > 0) continue; // 还未生效的延迟段
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

function seasonalityFactor(from, to) {
  // 简化：Q2/Q3 比 Q1/Q4 稍旺
  return state.quarter === 2 || state.quarter === 3 ? 1.10 : 0.92;
}

function clamp(min, x, max) { return Math.max(min, Math.min(max, x)); }
function clamp2(x, min, max) { return Math.max(min, Math.min(max, x)); }

// === 财务 ===
export function applyEndOfQuarterFinance() {
  for (const al of state.airlines) {
    if (al.bankrupt) continue;
    // 维护
    let maint = 0;
    for (const ac of al.aircraft) {
      const m = AIRCRAFT_BY_ID[ac.modelId];
      maint += m.maintenancePerQuarter;
    }
    al.cash -= maint;
    state.lastQuarterReports[al.id].maintenance = maint;

    // 利息 1.5%/季
    const interest = al.debt * 0.015;
    al.cash -= interest;
    state.lastQuarterReports[al.id].interest = interest;

    // 年龄 +1
    for (const ac of al.aircraft) ac.ageQuarters += 1;

    // SAF 选择带来的每季声望
    if (al.prestigePerQuarter) al.prestige += al.prestigePerQuarter;

    // 破产判定: 现金极负且无足够资产
    if (al.cash < -2000) al.bankrupt = true;
  }
}

// 效果衰减 & 解禁
export function decayEffects() {
  // 衰减并移除到期效果
  const next = [];
  for (const e of state.activeEffects) {
    if (e.startOffset && e.startOffset > 0) {
      e.startOffset -= 1;
      next.push(e); // 仍未启动
      continue;
    }
    e.remaining -= 1;
    if (e.remaining > 0) next.push(e);
    else {
      // 停飞效果到期 → 解除
      if (e.kind === 'fleetGround') {
        for (const a of state.airlines) {
          for (const ac of a.aircraft) {
            if (e.modelIds.includes(ac.modelId)) ac.grounded = false;
          }
        }
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
  if (state.year > 2030 || (state.year === 2030 && state.quarter > 4)) {
    state.gameOver = true;
  }
}

// === 玩家动作 (在 ui.js 中调用) ===
export function buyAircraft(airline, modelId) {
  const m = AIRCRAFT_BY_ID[modelId];
  if (!m) return { ok: false, msg: '机型不存在' };
  if (state.year < m.availableFrom || state.year > m.availableUntil) return { ok: false, msg: `该机型 ${m.availableFrom}-${m.availableUntil} 期间方可购买` };
  if (airline.cash < m.purchasePrice) return { ok: false, msg: '现金不足' };
  airline.cash -= m.purchasePrice;
  airline.aircraft.push({ uid: `u${Date.now()}${Math.floor(Math.random()*999)}`, modelId, ageQuarters: 0, routeId: null, grounded: false });
  return { ok: true };
}

export function sellAircraft(airline, uid) {
  const idx = airline.aircraft.findIndex(a => a.uid === uid);
  if (idx === -1) return { ok: false, msg: '飞机不存在' };
  const ac = airline.aircraft[idx];
  const m = AIRCRAFT_BY_ID[ac.modelId];
  // 残值: 折旧 5%/年
  const yrs = ac.ageQuarters / 4;
  const resale = Math.max(m.purchasePrice * 0.25, m.purchasePrice * Math.pow(0.95, yrs) * 0.7);
  airline.cash += resale;
  if (ac.routeId) {
    const r = airline.routes.find(x => x.id === ac.routeId);
    if (r) r.assignedAircraft = r.assignedAircraft.filter(u => u !== uid);
  }
  airline.aircraft.splice(idx, 1);
  return { ok: true, resale };
}

export function openRoute(airline, fromCity, toCity, fare, serviceLevel = 2) {
  if (fromCity === toCity) return { ok: false, msg: '起降城市不能相同' };
  if (!airline.landingRights.includes(fromCity)) return { ok: false, msg: `没有 ${fromCity} 着陆权` };
  if (!airline.landingRights.includes(toCity))   return { ok: false, msg: `没有 ${toCity} 着陆权` };
  const exists = airline.routes.find(r =>
    (r.fromCity === fromCity && r.toCity === toCity) ||
    (r.fromCity === toCity   && r.toCity === fromCity));
  if (exists) return { ok: false, msg: '该城市对你已开通' };
  airline.routes.push({
    id: `r${Date.now()}${Math.floor(Math.random()*999)}`,
    ownerId: airline.id,
    fromCity, toCity,
    fare: fare || Math.round(60 + distanceKm(CITY_BY_ID[fromCity], CITY_BY_ID[toCity]) * 0.08),
    serviceLevel,
    adSpend: 0,
    assignedAircraft: [],
    lastLoadFactor: 0,
    lastProfit: 0,
  });
  return { ok: true };
}

export function closeRoute(airline, routeId) {
  const idx = airline.routes.findIndex(r => r.id === routeId);
  if (idx === -1) return { ok: false };
  const r = airline.routes[idx];
  for (const uid of r.assignedAircraft) {
    const ac = airline.aircraft.find(a => a.uid === uid);
    if (ac) ac.routeId = null;
  }
  airline.routes.splice(idx, 1);
  return { ok: true };
}

export function assignAircraftToRoute(airline, uid, routeId) {
  const ac = airline.aircraft.find(a => a.uid === uid);
  if (!ac) return { ok: false, msg: '飞机不存在' };
  // 解除旧航线分配
  if (ac.routeId) {
    const oldR = airline.routes.find(r => r.id === ac.routeId);
    if (oldR) oldR.assignedAircraft = oldR.assignedAircraft.filter(u => u !== uid);
  }
  if (routeId) {
    const r = airline.routes.find(x => x.id === routeId);
    if (!r) return { ok: false, msg: '航线不存在' };
    const dist = distanceKm(CITY_BY_ID[r.fromCity], CITY_BY_ID[r.toCity]);
    const m = AIRCRAFT_BY_ID[ac.modelId];
    if (m.rangeKm < dist) return { ok: false, msg: `${m.name} 航程不够（${m.rangeKm} < ${dist}km）` };
    r.assignedAircraft.push(uid);
    ac.routeId = routeId;
  } else {
    ac.routeId = null;
  }
  return { ok: true };
}

export function applyForLanding(airline, cityId) {
  if (airline.landingRights.includes(cityId)) return { ok: false, msg: '已拥有' };
  if (state.landingApplications.find(a => a.airlineId === airline.id && a.cityId === cityId)) return { ok: false, msg: '已在排队' };
  const city = CITY_BY_ID[cityId];
  const eta = Math.max(1, 5 - city.size); // size 5 -> 1 季; size 1 -> 4 季
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

export function setServiceLevel(airline, routeId, level) {
  const r = airline.routes.find(x => x.id === routeId);
  if (!r) return { ok: false };
  r.serviceLevel = Math.max(1, Math.min(3, level | 0));
  return { ok: true };
}

export function setAdSpend(airline, routeId, spendMillion) {
  const r = airline.routes.find(x => x.id === routeId);
  if (!r) return { ok: false };
  r.adSpend = Math.max(0, spendMillion * 1e6);
  return { ok: true };
}
