// 贸易：供需价格模型 + 买卖。玩家大量吞吐会推动价格，抑制无限刷钱。
import { state, cargoUsed, shipStat } from './state.js';
import { GOODS, GOOD_BY_ID } from './data/goods.js';
import { PORT_BY_ID } from './data/ports.js';

const NORMAL_STOCK = 60;

function stockFactor(stock) {
  // 库存多 → 便宜；库存少 → 昂贵
  const f = 1.55 - stock / (NORMAL_STOCK * 1.7);
  return Math.max(0.55, Math.min(1.9, f));
}

export function priceAt(portId, goodId) {
  const ps = state.portState[portId];
  const g = GOOD_BY_ID[goodId];
  if (!ps || !g) return null;
  const stock = ps.stock[goodId] ?? 0;
  const base = g.basePrice * (ps.mod[goodId] ?? 1) * stockFactor(stock);
  const evt = effectMod(portId, goodId);
  const mid = base * evt;
  return {
    buy: Math.max(1, Math.round(mid * 1.06)),
    sell: Math.max(1, Math.round(mid * 0.9)),
    stock,
    trend: (ps.mod[goodId] ?? 1) < 0.9 ? 'cheap' : ((ps.mod[goodId] ?? 1) > 1.2 ? 'dear' : 'flat'),
  };
}

// 事件对价格的影响（复用 activeEffects 池；scope 前缀语言同 airline）
function effectMod(portId, goodId) {
  let m = 1;
  for (const e of state.activeEffects) {
    if (e.kind !== 'price') continue;
    if (e.good && e.good !== goodId) continue;
    if (e.scope === 'global' || e.scope === `port:${portId}`) m *= e.mult;
  }
  return m;
}

export function marketList(portId) {
  return GOODS.map(g => ({ good: g, ...priceAt(portId, g.id) })).filter(x => x.buy);
}

export function fleetCargoSpace() {
  return state.fleet.reduce((a, s) => a + shipStat(s).cargoMax - cargoUsed(s), 0);
}
export function fleetCargoTotal(goodId) {
  return state.fleet.reduce((a, s) => a + (s.cargo[goodId] || 0), 0);
}

export function buy(portId, goodId, qty) {
  const p = priceAt(portId, goodId);
  if (!p) return { ok: false, msg: '此地不经营这种货物。' };
  qty = Math.min(qty, p.stock, fleetCargoSpace(), Math.floor(state.player.gold / p.buy));
  if (qty <= 0) return { ok: false, msg: '钱不够、舱位不足，或者货已售罄。' };
  const cost = qty * p.buy;
  state.player.gold -= cost;
  state.portState[portId].stock[goodId] -= qty;
  // 装船：按剩余舱位依次分配
  let left = qty;
  for (const s of state.fleet) {
    const room = shipStat(s).cargoMax - cargoUsed(s);
    if (room <= 0) continue;
    const put = Math.min(room, left);
    s.cargo[goodId] = (s.cargo[goodId] || 0) + put;
    left -= put;
    if (left <= 0) break;
  }
  return { ok: true, qty, cost, msg: `买入 ${GOOD_BY_ID[goodId].name} ×${qty}，付出 ${cost} 金币。` };
}

export function sell(portId, goodId, qty) {
  const p = priceAt(portId, goodId);
  if (!p) return { ok: false, msg: '此地不收这种货物。' };
  qty = Math.min(qty, fleetCargoTotal(goodId));
  if (qty <= 0) return { ok: false, msg: '船上没有这种货。' };
  const gain = qty * p.sell;
  state.player.gold += gain;
  state.portState[portId].stock[goodId] += qty;
  let left = qty;
  for (const s of state.fleet) {
    const have = s.cargo[goodId] || 0;
    if (!have) continue;
    const take = Math.min(have, left);
    s.cargo[goodId] = have - take;
    if (!s.cargo[goodId]) delete s.cargo[goodId];
    left -= take;
    if (left <= 0) break;
  }
  return { ok: true, qty, gain, msg: `卖出 ${GOOD_BY_ID[goodId].name} ×${qty}，得到 ${gain} 金币。` };
}

// 每月：库存回归常态、价格轻微漂移（挂在月边界，日推进不做重结算）
export function monthlyMarketDrift() {
  for (const pid in state.portState) {
    const p = PORT_BY_ID[pid];
    const ps = state.portState[pid];
    for (const g of GOODS) {
      const isProd = p.produces.includes(g.id);
      const target = isProd ? 80 + p.size * 20 : (p.wants.includes(g.id) ? 10 : 30);
      ps.stock[g.id] = Math.round(ps.stock[g.id] + (target - ps.stock[g.id]) * 0.35);
      const baseMod = isProd ? 0.65 : (p.wants.includes(g.id) ? 1.45 : 1.0);
      ps.mod[g.id] = +(baseMod + (Math.random() - 0.5) * 0.12).toFixed(3);
    }
  }
}

// 补给（粮食/淡水）单独计价，不占货舱
export function buySupplies(portId, kind, qty) {
  const unit = kind === 'food' ? 6 : 4;
  const cost = qty * unit;
  if (state.player.gold < cost) return { ok: false, msg: '金币不足。' };
  state.player.gold -= cost;
  state.supplies[kind] = Math.min(400, state.supplies[kind] + qty);
  return { ok: true, msg: `补充${kind === 'food' ? '粮食' : '淡水'} ${qty} 单位，付出 ${cost} 金币。` };
}
