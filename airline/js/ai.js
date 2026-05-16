import { state } from './state.js';
import { CITIES, CITY_BY_ID, distanceKm } from './data/cities.js';
import { AIRCRAFT, AIRCRAFT_BY_ID } from './data/aircraft.js';
import {
  buyAircraft, openRoute, assignAircraftToRoute,
  applyForLanding, setFare, closeRoute, recommendedFare,
} from './sim.js';
import { logAiAction } from './intel.js';

// AI 配置：保守 / 标准 / 进取
// 全局上调买机/开线上限到 3（更激进）
const PROFILE = {
  conservative: { cashBuffer: 0.45, maxBuysPerTurn: 3, maxOpensPerTurn: 3, fareMult: 1.05, maxCompetitors: 2 },
  balanced:     { cashBuffer: 0.30, maxBuysPerTurn: 3, maxOpensPerTurn: 3, fareMult: 1.00, maxCompetitors: 3 },
  aggressive:   { cashBuffer: 0.15, maxBuysPerTurn: 3, maxOpensPerTurn: 3, fareMult: 0.92, maxCompetitors: 3 },
};

export function runAiTurn() {
  for (const al of state.airlines) {
    if (al.isPlayer || al.bankrupt) continue;
    const profile = PROFILE[al.aiProfile] || PROFILE.balanced;
    aiActOnce(al, profile);
  }
}

function aiActOnce(al, profile) {
  let opensThisTurn = 0;
  // 1) 闲置飞机 → 为它们开新航线（受 maxOpensPerTurn 上限约束）
  for (const ac of al.aircraft) {
    if (opensThisTurn >= profile.maxOpensPerTurn) break;
    if (ac.routeId || ac.grounded) continue;
    const m = AIRCRAFT_BY_ID[ac.modelId];
    const cand = bestNewRoute(al, m.rangeKm, profile);
    if (!cand) continue;
    const fare = Math.round(recommendedFare(al, { fromCity: cand.from, toCity: cand.to }) * profile.fareMult);
    const r = openRoute(al, cand.from, cand.to, fare, ac.uid);
    if (r.ok) {
      opensThisTurn++;
      const a = CITY_BY_ID[cand.from], b = CITY_BY_ID[cand.to];
      logAiAction(al.id, 'open', `用 ${m.name} 开通 ${a.iata}-${b.iata} (${cand.dist}km)`);
    }
  }

  // 2) 调价 — 围绕推荐价（盈亏平衡 ×2）±50% 的区间内调整
  for (const r of al.routes) {
    const oldFare = r.fare;
    const ideal = recommendedFare(al, r);
    const upperBound = Math.round(ideal * 1.5);
    const lowerBound = Math.round(ideal * 0.65);
    if (r.lastLoadFactor > 0.9 && r.fare < upperBound) {
      setFare(al, r.id, Math.min(r.fare * 1.05, upperBound));
      if (r.fare - oldFare >= 5) {
        const a = CITY_BY_ID[r.fromCity], b = CITY_BY_ID[r.toCity];
        logAiAction(al.id, 'fare-up', `上调 ${a.iata}-${b.iata} 票价至 $${r.fare}`);
      }
    } else if (r.lastLoadFactor < 0.5 && r.lastLoadFactor > 0 && r.fare > lowerBound) {
      setFare(al, r.id, Math.max(r.fare * 0.93, lowerBound));
      if (oldFare - r.fare >= 5) {
        const a = CITY_BY_ID[r.fromCity], b = CITY_BY_ID[r.toCity];
        logAiAction(al.id, 'fare-down', `下调 ${a.iata}-${b.iata} 票价至 $${r.fare}`);
      }
    }
  }

  // 3) 关闭长期亏损 & 拥挤的航线
  for (const r of [...al.routes]) {
    const ownerCount = countAirlinesOnPair(r.fromCity, r.toCity);
    if (r.lastProfit < -1 && ownerCount >= 3) {
      const a = CITY_BY_ID[r.fromCity], b = CITY_BY_ID[r.toCity];
      closeRoute(al, r.id);
      logAiAction(al.id, 'close', `关闭亏损线 ${a.iata}-${b.iata} (拥挤 ${ownerCount} 家)`);
    }
  }

  // 4) 申请着陆权（高需求且尚未拥有）
  if (al.cash > 200) {
    const candidates = CITIES.filter(c =>
      !al.landingRights.includes(c.id) &&
      !state.landingApplications.find(a => a.airlineId === al.id && a.cityId === c.id),
    ).sort((a, b) => b.baseDemand * b.size - a.baseDemand * a.size);
    if (candidates.length > 0) {
      const target = candidates[0];
      const r = applyForLanding(al, target.id);
      if (r.ok) logAiAction(al.id, 'landing', `申请 ${target.nameZh}(${target.iata}) 着陆权（${r.eta} 季）`);
    }
  }

  // 5) 买新飞机 + 立刻开新航线
  let bought = 0;
  while (bought < profile.maxBuysPerTurn && canExpand(al, profile)) {
    const cand = bestNewRoute(al, Infinity, profile);
    if (!cand) break;
    const m = pickModelForDistance(al, cand.dist);
    if (!m) break;
    const buyRes = buyAircraft(al, m.id);
    if (!buyRes.ok) break;
    bought++;
    const newAc = buyRes.aircraft;
    const fare = Math.round(recommendedFare(al, { fromCity: cand.from, toCity: cand.to }) * profile.fareMult);
    const openRes = openRoute(al, cand.from, cand.to, fare, newAc.uid);
    if (openRes.ok) {
      const a = CITY_BY_ID[cand.from], b = CITY_BY_ID[cand.to];
      logAiAction(al.id, 'buy', `购入 ${m.name} 并开 ${a.iata}-${b.iata}`);
    }
  }
}

function canExpand(al, profile) {
  const totalMaint = al.aircraft.reduce((s, a) => s + AIRCRAFT_BY_ID[a.modelId].maintenancePerQuarter, 0);
  return al.cash > totalMaint * 4 * profile.cashBuffer;
}

function pickModelForDistance(al, dist) {
  const yr = state.year;
  const usable = AIRCRAFT.filter(m =>
    yr >= m.availableFrom && yr <= m.availableUntil && m.rangeKm >= dist,
  );
  const affordable = usable.filter(m => al.cash >= m.purchasePrice * 1.2);
  if (affordable.length === 0) return null;
  // 短航线偏小机型，长航线偏大机型
  if (dist < 3000) affordable.sort((a, b) => a.purchasePrice - b.purchasePrice);
  else affordable.sort((a, b) => b.capacity - a.capacity);
  return affordable[Math.floor(affordable.length / 3)];
}

// 选最佳新航线：偏向高需求 + 低竞争，尊重已开通避免（同公司）
function bestNewRoute(al, maxRange, profile) {
  const rights = al.landingRights;
  const ownPairs = new Set(al.routes.map(r => pairKey(r.fromCity, r.toCity)));
  let best = null;
  for (let i = 0; i < rights.length; i++) {
    for (let j = i + 1; j < rights.length; j++) {
      const idA = rights[i], idB = rights[j];
      if (ownPairs.has(pairKey(idA, idB))) continue;  // 同公司同城市对避免
      const a = CITY_BY_ID[idA], b = CITY_BY_ID[idB];
      const dist = distanceKm(a, b);
      if (dist < 400 || dist > maxRange) continue;
      const competitors = countAirlinesOnPair(idA, idB);
      if (competitors >= profile.maxCompetitors + 1) continue;  // 过于拥挤直接跳过
      const hotness = a.baseDemand * a.size + b.baseDemand * b.size;
      const score = hotness - 250 * competitors;
      if (!best || score > best.score) best = { from: idA, to: idB, dist, score, competitors };
    }
  }
  return best;
}

function countAirlinesOnPair(cityA, cityB) {
  const set = new Set();
  for (const al of state.airlines) {
    if (al.routes.some(r => pairKey(r.fromCity, r.toCity) === pairKey(cityA, cityB))) {
      set.add(al.id);
    }
  }
  return set.size;
}

function pairKey(a, b) { return [a, b].sort().join('-'); }
