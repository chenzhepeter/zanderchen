import { state } from './state.js';
import { CITIES, CITY_BY_ID, distanceKm } from './data/cities.js';
import { AIRCRAFT, AIRCRAFT_BY_ID } from './data/aircraft.js';
import {
  buyAircraft, openRoute, assignAircraftToRoute,
  applyForLanding, setFare, closeRoute, recommendedFare,
  applyChoiceOption,
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

// 给每家 AI 应用 choice 事件（玩家走 UI 弹窗，AI 走这里）
// 按性格倾向打分选项；进取派偏行动 + 声望，保守派偏接受救助 / 不花钱
export function runAiChoicesForEvent(event) {
  if (!event || !event.choice || !event.choice.options) return;
  for (const al of state.airlines) {
    if (al.isPlayer || al.bankrupt) continue;
    const profile = al.aiProfile || 'balanced';
    const chosen = scoreChoiceOption(event.choice.options, profile, al);
    if (!chosen) continue;
    // 现金不够付 costCash 时降级到无成本选项（找一个 costCash=0 的）
    if (chosen.costCash && al.cash < chosen.costCash) {
      const fallback = event.choice.options.find(o => !o.costCash);
      if (fallback) {
        applyChoiceOption(fallback, al);
        logAiAction(al.id, 'choice', `事件「${event.nameZh}」(现金不足) 选: ${fallback.label}`);
        continue;
      }
    }
    applyChoiceOption(chosen, al);
    logAiAction(al.id, 'choice', `事件「${event.nameZh}」选: ${chosen.label}`);
  }
}

function scoreChoiceOption(options, profile, airline) {
  let best = null, bestScore = -Infinity;
  for (const opt of options) {
    const cost = opt.costCash || 0;
    const hasGrant = (opt.applyEffects || []).some(e => e.kind === 'cashGrant');
    const hasSelfPrestige = (opt.applyEffects || []).some(e => e.kind === 'prestige' && e.target === 'self' && (e.delta || 0) > 0);
    let score = 0;
    if (profile === 'aggressive') {
      // 进取：偏向行动 + 自我声望，少拿救助
      score += cost > 0 ? 2 : 0;
      score += hasSelfPrestige ? 2 : 0;
      score -= hasGrant ? 1.5 : 0;
      score -= cost / 500;
    } else if (profile === 'conservative') {
      // 保守：偏向救助 / 不花钱
      score += hasGrant ? 3 : 0;
      score -= cost / 100;
      score += !cost && !hasGrant ? 0.5 : 0;
    } else {
      // 平衡：温和倾向声望和救助
      score += hasSelfPrestige ? 1 : 0;
      score += hasGrant ? 1 : 0;
      score -= cost / 300;
    }
    score += Math.random() * 0.4;  // 小幅扰动，避免完全机械
    if (score > bestScore) { bestScore = score; best = opt; }
  }
  return best;
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

  // 3) 退出逻辑：连续 3 季亏损超过 max(0.5M 绝对线, 10% 总盈利) 才关线
  // 设计意图：AI 应积极开拓 + 通过调价争取盈利，不轻易撤出。
  const totalProfit = al.routes.reduce((s, r) => s + (r.lastProfit || 0), 0);
  // 阈值取 0.5M 与 10% 总盈利的较小者；总盈利 <= 0 时退化为 0（任何亏损都计数）
  const lossThreshold = Math.max(0, Math.min(0.5, 0.1 * totalProfit));
  for (const r of [...al.routes]) {
    if (r.lastProfit < -lossThreshold) {
      r._lossStreak = (r._lossStreak || 0) + 1;
    } else {
      r._lossStreak = 0;
    }
    if (r._lossStreak >= 3) {
      const a = CITY_BY_ID[r.fromCity], b = CITY_BY_ID[r.toCity];
      closeRoute(al, r.id);
      logAiAction(al.id, 'close', `连亏 3 季关闭 ${a.iata}-${b.iata} (上季 $${r.lastProfit.toFixed(1)}M)`);
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
