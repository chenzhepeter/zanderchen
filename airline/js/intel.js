// 情报系统：对手动作日志 + 航线竞争分析 + 玩家策略建议
import { state, getPlayer } from './state.js';
import { CITY_BY_ID, distanceKm } from './data/cities.js';
import { AIRCRAFT, AIRCRAFT_BY_ID } from './data/aircraft.js';
import { quarterSeatCapacity } from './sim.js';

const MAX_LOG_QUARTERS = 8;

export function logAiAction(airlineId, type, desc) {
  const tag = `${state.year}-${state.quarter}`;
  let entry = state.intelLog[state.intelLog.length - 1];
  if (!entry || entry.tag !== tag) {
    entry = { tag, year: state.year, quarter: state.quarter, items: [] };
    state.intelLog.push(entry);
    while (state.intelLog.length > MAX_LOG_QUARTERS) state.intelLog.shift();
  }
  entry.items.push({ airlineId, type, desc });
}

// 玩家每条航线的竞争快照（按城市对聚合）
export function computeCompetition() {
  const p = getPlayer();
  if (!p) return [];
  const items = [];
  for (const r of p.routes) {
    const key = pairKey(r.fromCity, r.toCity);
    let myCap = 0, totalCap = 0;
    const ownerCaps = {};
    for (const al of state.airlines) {
      for (const ar of al.routes) {
        if (pairKey(ar.fromCity, ar.toCity) !== key) continue;
        const cap = quarterSeatCapacity(al, ar);
        totalCap += cap;
        if (al.id === p.id) myCap += cap;
        else ownerCaps[al.id] = (ownerCaps[al.id] || 0) + cap;
      }
    }
    const opponents = Object.entries(ownerCaps).map(([id, cap]) => {
      const al = state.airlines.find(a => a.id === id);
      return { id, name: al?.nameShort, color: al?.color, cap };
    });
    items.push({
      route: r, myCap, totalCap,
      myShare: totalCap > 0 ? myCap / totalCap : 1,
      opponents,
    });
  }
  return items;
}

export function computeRecommendations() {
  const recs = [];
  const p = getPlayer();
  if (!p) return recs;

  // 1) 闲置飞机
  const idle = p.aircraft.filter(a => !a.routeId && !a.grounded);
  if (idle.length > 0) {
    const cost = idle.reduce((s, a) => s + AIRCRAFT_BY_ID[a.modelId].maintenancePerQuarter, 0);
    recs.push({
      severity: 'warn', icon: '⚠️',
      text: `${idle.length} 架闲置飞机每季消耗 $${cost.toFixed(1)}M 维护，去航线开新线或机队出售。`,
    });
  }

  // 2) 停飞
  const grounded = p.aircraft.filter(a => a.grounded);
  if (grounded.length > 0) {
    recs.push({
      severity: 'warn', icon: '🛑',
      text: `${grounded.length} 架飞机因突发事件停飞，期间该航线无运力。`,
    });
  }

  // 3) 现金流
  const totalMaint = p.aircraft.reduce((s, a) => s + AIRCRAFT_BY_ID[a.modelId].maintenancePerQuarter, 0);
  if (totalMaint > 0) {
    const runway = p.cash / Math.max(1, totalMaint + p.debt * 0.015);
    if (p.cash < totalMaint * 3) {
      recs.push({
        severity: 'warn', icon: '🆘',
        text: `现金仅够 ${runway.toFixed(1)} 季运营。出售旧机、关亏损线、或降价提升满座率。`,
      });
    } else if (p.cash > totalMaint * 10) {
      recs.push({
        severity: 'info', icon: '💰',
        text: `现金充裕 ($${p.cash.toFixed(0)}M)：买新机开新线、申请热门着陆权。`,
      });
    }
  }

  // 4) 每条航线载荷信号
  for (const r of p.routes) {
    if (!r.lastLoadFactor) continue;
    const a = CITY_BY_ID[r.fromCity], b = CITY_BY_ID[r.toCity];
    if (r.lastLoadFactor > 0.90) {
      recs.push({
        severity: 'info', icon: '📈',
        text: `${a.nameZh}-${b.nameZh} 载荷 ${pct(r.lastLoadFactor)} — 可上调 5–10% 票价或开第二条航线增加运力。`,
      });
    } else if (r.lastLoadFactor < 0.40 && r.lastLoadFactor > 0) {
      recs.push({
        severity: 'warn', icon: '📉',
        text: `${a.nameZh}-${b.nameZh} 载荷仅 ${pct(r.lastLoadFactor)} — 降价或考虑关闭，竞争可能过激。`,
      });
    } else if (r.lastProfit < 0) {
      recs.push({
        severity: 'warn', icon: '💸',
        text: `${a.nameZh}-${b.nameZh} 上季亏损 $${Math.abs(r.lastProfit).toFixed(1)}M — 调价或关停。`,
      });
    }
  }

  // 5) 当年解锁
  for (const m of AIRCRAFT) {
    if (m.availableFrom !== state.year) continue;
    if (state.quarter > 2) continue;
    if (p.aircraft.some(a => a.modelId === m.id)) continue;
    if (p.cash < m.purchasePrice) continue;
    recs.push({
      severity: 'info', icon: '✈️',
      text: `本年新机型 ${m.name} 解锁（${m.capacity}座/${m.rangeKm}km/$${m.purchasePrice}M）。`,
    });
  }

  // 6) 推荐开新航线: 在已有着陆权的城市对中选热门且非过度拥挤
  const ownPairs = new Set(p.routes.map(r => pairKey(r.fromCity, r.toCity)));
  const candidates = [];
  for (let i = 0; i < p.landingRights.length; i++) {
    for (let j = i + 1; j < p.landingRights.length; j++) {
      const idA = p.landingRights[i], idB = p.landingRights[j];
      if (ownPairs.has(pairKey(idA, idB))) continue;
      const a = CITY_BY_ID[idA], b = CITY_BY_ID[idB];
      const dist = distanceKm(a, b);
      if (dist < 400) continue;
      const comp = countAirlinesOnPair(idA, idB);
      if (comp >= 3) continue;
      const hotness = a.baseDemand * a.size + b.baseDemand * b.size;
      const score = hotness - 250 * comp;
      candidates.push({ a, b, dist, comp, score });
    }
  }
  candidates.sort((x, y) => y.score - x.score);
  if (candidates.length > 0) {
    const top = candidates[0];
    recs.push({
      severity: 'info', icon: '🛫',
      text: `推荐开通 ${top.a.nameZh}-${top.b.nameZh}（${top.dist}km，${top.comp === 0 ? '目前无对手' : `${top.comp} 家对手`}）。`,
    });
  }

  // 7) 高价值缺失着陆权
  const owned = new Set(p.landingRights);
  const pending = new Set(state.landingApplications.filter(x => x.airlineId === p.id).map(x => x.cityId));
  const usage = {};
  for (const al of state.airlines) {
    if (al.id === p.id) continue;
    for (const r of al.routes) {
      [r.fromCity, r.toCity].forEach(c => {
        if (!owned.has(c) && !pending.has(c)) usage[c] = (usage[c] || 0) + 1;
      });
    }
  }
  const topLack = Object.entries(usage).sort((x, y) => y[1] - x[1])[0];
  if (topLack) {
    const c = CITY_BY_ID[topLack[0]];
    if (c) recs.push({
      severity: 'info', icon: '🛬',
      text: `${c.nameZh} 是行业热点（${topLack[1]} 条对手航线进出），考虑申请着陆权。`,
    });
  }

  // 8) 油价
  if (state.fuelPrice >= 1.3) {
    recs.push({ severity: 'warn', icon: '⛽', text: `油价 ${state.fuelPrice.toFixed(2)}× — 优先派遣省油机型（787/A321neo）。` });
  } else if (state.fuelPrice <= 0.7) {
    recs.push({ severity: 'info', icon: '⛽', text: `油价跌至 ${state.fuelPrice.toFixed(2)}× — 老款宽体单位成本下降。` });
  }

  return recs;
}

function pct(x) { return Math.round(x * 100) + '%'; }
function pairKey(a, b) { return [a, b].sort().join('-'); }
function countAirlinesOnPair(a, b) {
  const k = pairKey(a, b);
  const set = new Set();
  for (const al of state.airlines) {
    if (al.routes.some(r => pairKey(r.fromCity, r.toCity) === k)) set.add(al.id);
  }
  return set.size;
}
