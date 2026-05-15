import { state } from './state.js';
import { CITIES, CITY_BY_ID, distanceKm } from './data/cities.js';
import { AIRCRAFT, AIRCRAFT_BY_ID } from './data/aircraft.js';
import {
  buyAircraft, openRoute, assignAircraftToRoute,
  applyForLanding, setFare,
} from './sim.js';

const PROFILE = {
  conservative: { riskTolerance: 0.5, cashBuffer: 0.6, maxBuysPerTurn: 1, maxRoutesPerTurn: 1, fareMult: 1.05 },
  balanced:     { riskTolerance: 1.0, cashBuffer: 0.4, maxBuysPerTurn: 1, maxRoutesPerTurn: 2, fareMult: 1.00 },
  aggressive:   { riskTolerance: 1.5, cashBuffer: 0.2, maxBuysPerTurn: 2, maxRoutesPerTurn: 2, fareMult: 0.95 },
};

// AI 主行动入口
export function runAiTurn() {
  for (const al of state.airlines) {
    if (al.isPlayer || al.bankrupt) continue;
    const profile = PROFILE[al.aiProfile] || PROFILE.balanced;
    aiActOnce(al, profile);
  }
}

function aiActOnce(al, profile) {
  // 1) 给闲置飞机分配航线
  for (const ac of al.aircraft) {
    if (ac.routeId || ac.grounded) continue;
    const route = pickRouteForAircraft(al, ac);
    if (route) assignAircraftToRoute(al, ac.uid, route.id);
  }

  // 2) 调价：如果上季 loadFactor 过低，降价；过高，加价
  for (const r of al.routes) {
    if (r.lastLoadFactor > 0.9) setFare(al, r.id, r.fare * 1.05);
    else if (r.lastLoadFactor < 0.55 && r.lastLoadFactor > 0) setFare(al, r.id, r.fare * 0.95);
  }

  // 3) 申请着陆权: 在不重叠的高价值城市
  if (al.cash > 200) {
    const candidates = CITIES.filter(c =>
      !al.landingRights.includes(c.id) &&
      !state.landingApplications.find(a => a.airlineId === al.id && a.cityId === c.id)
    ).sort((a, b) => b.baseDemand - a.baseDemand);
    if (candidates.length > 0) applyForLanding(al, candidates[0].id);
  }

  // 4) 开新航线: 在拥有着陆权的城市间选有空运力的、对手少的
  let opened = 0;
  for (let i = 0; i < profile.maxRoutesPerTurn; i++) {
    if (!canExpand(al, profile)) break;
    const cand = bestNewRoute(al);
    if (!cand) break;
    const r = openRoute(al, cand.from, cand.to, Math.round((60 + cand.dist * 0.08) * profile.fareMult));
    if (r.ok) {
      opened++;
      // 立刻分配一架飞机
      const ac = al.aircraft.find(a => !a.routeId && !a.grounded && AIRCRAFT_BY_ID[a.modelId].rangeKm >= cand.dist);
      if (ac) {
        const newR = al.routes[al.routes.length - 1];
        assignAircraftToRoute(al, ac.uid, newR.id);
      }
    } else break;
  }

  // 5) 买飞机: 现金充足且有闲置航线时
  let bought = 0;
  while (bought < profile.maxBuysPerTurn && canExpand(al, profile)) {
    const need = countNeededAircraft(al);
    if (need <= 0) break;
    const model = pickModel(al);
    if (!model) break;
    const r = buyAircraft(al, model.id);
    if (!r.ok) break;
    bought++;
    // 把新飞机扔到最需要的航线
    const newAc = al.aircraft[al.aircraft.length - 1];
    const route = pickRouteForAircraft(al, newAc);
    if (route) assignAircraftToRoute(al, newAc.uid, route.id);
  }
}

function canExpand(al, profile) {
  // 现金 > 维护 × buffer * 4 季
  const totalMaint = al.aircraft.reduce((s, a) => s + AIRCRAFT_BY_ID[a.modelId].maintenancePerQuarter, 0);
  return al.cash > totalMaint * 4 * profile.cashBuffer;
}

function pickRouteForAircraft(al, ac) {
  const model = AIRCRAFT_BY_ID[ac.modelId];
  // 选一条已开但运力不足 (lastLoadFactor 高) 或还没有飞机的航线
  const candidates = al.routes.filter(r => {
    const d = distanceKm(CITY_BY_ID[r.fromCity], CITY_BY_ID[r.toCity]);
    return model.rangeKm >= d && (r.assignedAircraft.length === 0 || r.lastLoadFactor > 0.85);
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.lastLoadFactor - a.lastLoadFactor);
  return candidates[0];
}

function countNeededAircraft(al) {
  let need = 0;
  for (const r of al.routes) {
    if (r.assignedAircraft.length === 0) need++;
    else if (r.lastLoadFactor > 0.9) need++;
  }
  return need;
}

function pickModel(al) {
  const yr = state.year;
  // AI 偏好范围合理且 ROI 高的机型
  const usable = AIRCRAFT.filter(m => yr >= m.availableFrom && yr <= m.availableUntil);
  // 在现金内能买的、最大载量的
  const affordable = usable.filter(m => al.cash >= m.purchasePrice * 1.2);
  if (affordable.length === 0) return null;
  affordable.sort((a, b) => b.capacity - a.capacity);
  // 但避免太大: 取中位偏上
  return affordable[Math.floor(affordable.length / 3)];
}

function bestNewRoute(al) {
  const rights = al.landingRights;
  const open = new Set(al.routes.map(r => pairKey(r.fromCity, r.toCity)));
  let best = null;
  for (let i = 0; i < rights.length; i++) {
    for (let j = i + 1; j < rights.length; j++) {
      const k = pairKey(rights[i], rights[j]);
      if (open.has(k)) continue;
      const dist = distanceKm(CITY_BY_ID[rights[i]], CITY_BY_ID[rights[j]]);
      if (dist < 400) continue;
      const score = (CITY_BY_ID[rights[i]].baseDemand + CITY_BY_ID[rights[j]].baseDemand) / 2 - competitorsOn(rights[i], rights[j]) * 100;
      if (!best || score > best.score) best = { from: rights[i], to: rights[j], dist, score };
    }
  }
  return best;
}

function competitorsOn(a, b) {
  let n = 0;
  for (const al of state.airlines) {
    if (al.routes.find(r => (r.fromCity === a && r.toCity === b) || (r.fromCity === b && r.toCity === a))) n++;
  }
  return n;
}

function pairKey(a, b) { return [a, b].sort().join('_'); }
