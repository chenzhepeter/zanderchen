// 发现物引擎：航行时检测、邸宅上缴。原版《大航海时代2》的探险收入主干。
// 「发现」只是记在自己的航海日志上；要换成钱与冒险名声，得把记录带回收藏家那里。
import { state, addLog, addFame } from './state.js';
import { DISCOVERIES, DISCOVERY_BY_ID, COLLECTORS, KIND_NAME } from './data/discoveries.js';
import { distanceNm } from './geo.js';

// 望远镜让视距更远：接现有 i_spyglass 道具
function sightBonus() {
  return state.inventory.includes('i_spyglass') ? 1.35 : 1;
}

// 每次位移后调用：返回这一步新发现的条目
export function checkDiscoveries() {
  const found = [];
  const k = sightBonus();
  for (const d of DISCOVERIES) {
    if (state.discoveries.found[d.id]) continue;
    if (distanceNm(state.position, d) <= d.sightNm * k) {
      state.discoveries.found[d.id] = { y: state.date.y, m: state.date.m, d: state.date.d };
      addLog(`发现了${KIND_NAME[d.kind]}「${d.name}」。`);
      found.push(d);
    }
  }
  return found;
}

export function foundCount() { return Object.keys(state.discoveries.found).length; }
export function reportedCount() { return Object.keys(state.discoveries.reported).length; }
export function totalCount() { return DISCOVERIES.length; }

// 手上有几条还没上缴的记录
export function unreported() {
  return Object.keys(state.discoveries.found)
    .filter(id => !state.discoveries.reported[id])
    .map(id => DISCOVERY_BY_ID[id])
    .filter(Boolean)
    .sort((a, b) => b.reward - a.reward);
}

export function collectorAt(portId) {
  return COLLECTORS.find(c => c.port === portId) || null;
}

// 上缴一条：金币按收藏家的行情浮动，冒险名声固定
export function report(id, portId) {
  const d = DISCOVERY_BY_ID[id];
  if (!d) return { ok: false, msg: '没有这条记录。' };
  if (!state.discoveries.found[id]) return { ok: false, msg: '你还没亲眼见过它。' };
  if (state.discoveries.reported[id]) return { ok: false, msg: '这条已经上缴过了。' };
  const c = collectorAt(portId);
  if (!c) return { ok: false, msg: '这里没有收藏家。' };

  const gold = Math.round(d.reward * c.bonus);
  state.discoveries.reported[id] = portId;
  state.player.gold += gold;
  addFame('adventure', d.fame);
  addLog(`向${c.name}上缴「${d.name}」，得 ${gold} 金币。`);
  return { ok: true, gold, fame: d.fame, msg: `${c.name}付了 ${gold} 金币，冒险名声 +${d.fame}。` };
}

// 全部上缴
export function reportAll(portId) {
  const list = unreported();
  let gold = 0, fame = 0, n = 0;
  for (const d of list) {
    const r = report(d.id, portId);
    if (r.ok) { gold += r.gold; fame += r.fame; n++; }
  }
  return { n, gold, fame };
}
