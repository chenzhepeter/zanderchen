// 贸易：供需价格模型 + 买卖。玩家大量吞吐会推动价格，抑制无限刷钱。
import { state, cargoUsed, shipStat, bulkOf, addFame } from './state.js';
import { GOODS, GOOD_BY_ID } from './data/goods.js';
import { PORTS, PORT_BY_ID } from './data/ports.js';

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
  // 港口态度与性质：海盗窝不问货怎么来的，收赃加价；
  // 敌视/戒备港的额外盘剥只有在你恶名在外之后才落到头上——
  // 否则连布里斯托尔这个老家（stance 是 hostile，指的是日后的英国）开局就要抽你的税。
  const port = PORT_BY_ID[portId];
  const fence = port?.pirateHaven ? 1.18 : 1;
  const inf = state.player.infamy || 0;
  const tax = (port?.stance === 'hostile' && inf > 30) ? 1.10
    : (port?.stance === 'wary' && inf > 15) ? 1.04
      : (port?.stance === 'hostile' && inf > 15) ? 1.04 : 1;
  return {
    buy: Math.max(1, Math.round(mid * 1.06 * tax)),
    sell: Math.max(1, Math.round(mid * 0.9 * fence / tax)),
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
  const bulk = bulkOf(goodId);                       // 体积大的货占更多舱位
  qty = Math.min(qty, p.stock, Math.floor(fleetCargoSpace() / bulk), Math.floor(state.player.gold / p.buy));
  if (qty <= 0) return { ok: false, msg: '钱不够、舱位不足，或者货已售罄。' };
  const cost = qty * p.buy;
  state.player.gold -= cost;
  state.portState[portId].stock[goodId] -= qty;
  // 装船：按剩余舱位依次分配
  let left = qty;
  for (const s of state.fleet) {
    const room = Math.floor((shipStat(s).cargoMax - cargoUsed(s)) / bulk);
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
  // 交易名声：按成交额给，每 2000 金一点，单笔封顶 12 点
  addFame('trade', Math.min(12, Math.floor(gain / 2000)));
  return { ok: true, qty, gain, msg: `卖出 ${GOOD_BY_ID[goodId].name} ×${qty}，得到 ${gain} 金币。` };
}

// 每月：库存回归常态、价格轻微漂移（挂在月边界，日推进不做重结算）
// ===== 市场行情事件（activeEffects 池的生产者）=====
// 以前这个池只有消费者（effectMod 读它算价格）没有生产者，等于常年空转。
// 现在每月按概率给几个港口丢一条行情，到期自动消失。
const MARKET_EVENTS = [
  { kind: 'price', mult: 2.1, months: 2, text: (p, g) => `${p.name}闹起${g.name}荒——价钱翻着跟头往上走。` },
  { kind: 'price', mult: 1.6, months: 2, text: (p, g) => `${p.name}的${g.name}供不应求。` },
  { kind: 'price', mult: 0.45, months: 3, text: (p, g) => `${p.name}的${g.name}堆满码头，贱得像沙子。` },
  { kind: 'price', mult: 0.65, months: 2, text: (p, g) => `${p.name}今年${g.name}丰收，价钱压得很低。` },
];

export function tickEffects() {
  state.activeEffects = (state.activeEffects || []).filter(e => {
    e.remaining -= 1;
    return e.remaining > 0;
  });
}

export function rollMarketEvents() {
  const pool = PORTS.filter(p => !p.anchorageOnly);
  const news = [];
  for (let i = 0; i < 3; i++) {
    if (Math.random() > 0.4) continue;
    const p = pool[(Math.random() * pool.length) | 0];
    const g = GOODS[(Math.random() * GOODS.length) | 0];
    const t = MARKET_EVENTS[(Math.random() * MARKET_EVENTS.length) | 0];
    if (state.activeEffects.some(e => e.scope === `port:${p.id}` && e.good === g.id)) continue;
    state.activeEffects.push({
      kind: t.kind, scope: `port:${p.id}`, good: g.id,
      mult: t.mult, remaining: t.months,
    });
    news.push(t.text(p, g));
  }
  return news;
}

export function effectsAt(portId) {
  return (state.activeEffects || []).filter(e => e.scope === `port:${portId}` || e.scope === 'global');
}

export function monthlyMarketDrift() {
  tickEffects();
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

// 淡水靠港免费补满（见 voyage.refillWater）；粮食请在市场购买「粮食」货物。
