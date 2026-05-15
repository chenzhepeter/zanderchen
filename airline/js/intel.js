// 情报系统：对手动作日志 + 航线竞争分析 + 玩家策略建议
import { state, getPlayer } from './state.js';
import { CITY_BY_ID, distanceKm } from './data/cities.js';
import { AIRCRAFT, AIRCRAFT_BY_ID } from './data/aircraft.js';
import { quarterSeatCapacity } from './sim.js';

const MAX_LOG_QUARTERS = 8;  // 仅保留最近 8 季度对手动作

// === 日志 ===
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

// === 航线竞争快照 ===
export function computeCompetition() {
  const p = getPlayer();
  if (!p) return [];
  const items = [];
  for (const r of p.routes) {
    const key = [r.fromCity, r.toCity].sort().join('-');
    let myCap = 0, totalCap = 0;
    const opponents = [];
    for (const al of state.airlines) {
      for (const ar of al.routes) {
        const akey = [ar.fromCity, ar.toCity].sort().join('-');
        if (akey !== key) continue;
        const cap = quarterSeatCapacity(al, ar);
        totalCap += cap;
        if (al.id === p.id) myCap += cap;
        else if (cap > 0) opponents.push({ id: al.id, name: al.nameShort, color: al.color, cap });
      }
    }
    items.push({
      route: r,
      myCap,
      totalCap,
      myShare: totalCap > 0 ? myCap / totalCap : 1,
      opponents,
    });
  }
  return items;
}

// === 策略建议 ===
export function computeRecommendations() {
  const recs = [];
  const p = getPlayer();
  if (!p) return recs;

  // 1) 闲置飞机
  const idle = p.aircraft.filter(a => !a.routeId && !a.grounded);
  if (idle.length > 0) {
    const cost = idle.reduce((s, a) => s + AIRCRAFT_BY_ID[a.modelId].maintenancePerQuarter, 0);
    recs.push({
      severity: 'warn',
      icon: '⚠️',
      text: `${idle.length} 架闲置飞机每季消耗 $${cost.toFixed(1)}M 维护，建议派往新航线或出售。`,
    });
  }

  // 2) 停飞机型
  const grounded = p.aircraft.filter(a => a.grounded);
  if (grounded.length > 0) {
    recs.push({
      severity: 'warn',
      icon: '🛑',
      text: `${grounded.length} 架飞机因突发事件停飞，期间航线运力下降，必要时短期租入运力或暂关航线。`,
    });
  }

  // 3) 现金流
  const totalMaint = p.aircraft.reduce((s, a) => s + AIRCRAFT_BY_ID[a.modelId].maintenancePerQuarter, 0);
  if (totalMaint > 0) {
    const runwayQuarters = p.cash / Math.max(1, totalMaint + p.debt * 0.015);
    if (p.cash < totalMaint * 3) {
      recs.push({
        severity: 'warn',
        icon: '🆘',
        text: `现金仅够 ${runwayQuarters.toFixed(1)} 季运营。出售旧机、关亏损线、或降价提升满座率。`,
      });
    } else if (p.cash > totalMaint * 10) {
      recs.push({
        severity: 'info',
        icon: '💰',
        text: `现金充裕 ($${p.cash.toFixed(0)}M)，是扩张良机：买新机、开高需求航线、申请热门着陆权。`,
      });
    }
  }

  // 4) 每条航线的载荷率信号
  for (const r of p.routes) {
    if (!r.lastLoadFactor) continue;
    const a = CITY_BY_ID[r.fromCity], b = CITY_BY_ID[r.toCity];
    if (r.lastLoadFactor > 0.92) {
      recs.push({
        severity: 'info',
        icon: '📈',
        text: `${a.nameZh}-${b.nameZh} 载荷 ${pct(r.lastLoadFactor)} — 加飞机或上调 5–10% 票价可提升利润。`,
      });
    } else if (r.lastLoadFactor < 0.50 && r.lastLoadFactor > 0) {
      recs.push({
        severity: 'warn',
        icon: '📉',
        text: `${a.nameZh}-${b.nameZh} 载荷仅 ${pct(r.lastLoadFactor)} — 考虑降价 5–10% 或降级服务等级。`,
      });
    } else if (r.lastProfit < 0) {
      recs.push({
        severity: 'warn',
        icon: '💸',
        text: `${a.nameZh}-${b.nameZh} 上季亏损 $${Math.abs(r.lastProfit).toFixed(1)}M — 调整定价或关停。`,
      });
    }
  }

  // 5) 新解锁机型
  for (const m of AIRCRAFT) {
    if (m.availableFrom !== state.year) continue;
    if (state.quarter > 2) continue; // 当年前两季提醒一次
    if (p.aircraft.some(a => a.modelId === m.id)) continue;
    if (p.cash < m.purchasePrice) continue;
    recs.push({
      severity: 'info',
      icon: '✈️',
      text: `本年新机型 ${m.name} 解锁（${m.capacity}座/${m.rangeKm}km/$${m.purchasePrice}M），现金可购入。`,
    });
  }

  // 6) 扩张机会：有着陆权但未开通的高需求城市对
  const ownPairs = new Set(p.routes.map(r => pairKey(r.fromCity, r.toCity)));
  const candidates = [];
  for (let i = 0; i < p.landingRights.length; i++) {
    for (let j = i + 1; j < p.landingRights.length; j++) {
      const idA = p.landingRights[i], idB = p.landingRights[j];
      if (ownPairs.has(pairKey(idA, idB))) continue;
      const a = CITY_BY_ID[idA], b = CITY_BY_ID[idB];
      if (!a || !b) continue;
      const dist = distanceKm(a, b);
      if (dist < 400) continue;
      let comp = 0;
      for (const al of state.airlines) {
        if (al.id === p.id) continue;
        if (al.routes.some(rr => pairKey(rr.fromCity, rr.toCity) === pairKey(idA, idB))) comp++;
      }
      const score = (a.baseDemand + b.baseDemand) / 2 - comp * 80;
      candidates.push({ a, b, dist, comp, score });
    }
  }
  candidates.sort((x, y) => y.score - x.score);
  if (candidates.length > 0) {
    const top = candidates[0];
    recs.push({
      severity: 'info',
      icon: '🛫',
      text: `推荐开通 ${top.a.nameZh}-${top.b.nameZh}（${top.dist}km，${top.comp === 0 ? '目前无对手' : `${top.comp} 家对手在飞`}）。`,
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
    if (c) {
      recs.push({
        severity: 'info',
        icon: '🛬',
        text: `${c.nameZh} 是行业热点（${topLack[1]} 条对手航线进出），考虑申请着陆权。`,
      });
    }
  }

  // 8) 油价异常
  if (state.fuelPrice >= 1.3) {
    recs.push({
      severity: 'warn',
      icon: '⛽',
      text: `油价 ${state.fuelPrice.toFixed(2)}× — 优先派遣省油机型（787/A321neo）执飞长航线。`,
    });
  } else if (state.fuelPrice <= 0.7) {
    recs.push({
      severity: 'info',
      icon: '⛽',
      text: `油价跌至 ${state.fuelPrice.toFixed(2)}× — 老款宽体（767/A330）单位成本下降，可短期增飞。`,
    });
  }

  return recs;
}

function pct(x) { return Math.round(x * 100) + '%'; }
function pairKey(a, b) { return [a, b].sort().join('-'); }
