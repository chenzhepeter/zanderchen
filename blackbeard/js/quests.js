// 任务引擎：接取 / 追踪 / 判定 / 结算。主线随章节自动接取，支线由 NPC 或港口给出。
import { state, addLog } from './state.js';
import { QUESTS, QUEST_BY_ID } from './data/quests.js';
import { PORT_BY_ID } from './data/ports.js';
import { GOOD_BY_ID } from './data/goods.js';
import { OFFICER_BY_ID } from './data/officers.js';

export function ensureQuests() {
  if (!state.quests) state.quests = { active: [], done: [], counters: { wins: 0, winsMerchant: 0, winsPatrol: 0 } };
  if (!state.quests.counters) state.quests.counters = { wins: 0, winsMerchant: 0, winsPatrol: 0 };
}

export const isActive = id => { ensureQuests(); return state.quests.active.some(a => a.id === id); };
export const isDone = id => { ensureQuests(); return state.quests.done.includes(id); };
export const activeQuests = () => { ensureQuests(); return state.quests.active.map(a => QUEST_BY_ID[a.id]).filter(Boolean); };
export const doneQuests = () => { ensureQuests(); return state.quests.done.map(id => QUEST_BY_ID[id]).filter(Boolean); };

export function accept(id) {
  ensureQuests();
  if (isActive(id) || isDone(id)) return false;
  const q = QUEST_BY_ID[id];
  if (!q) return false;
  state.quests.active.push({ id, since: { ...state.date } });
  addLog(`接受${q.kind === 'main' ? '主线' : '支线'}任务：${q.title}`);
  return true;
}

// 主线随章节自动接取
export function syncMainQuests() {
  ensureQuests();
  for (const q of QUESTS) {
    if (q.kind !== 'main') continue;
    if (q.chapter > state.chapter) continue;
    if (q.require?.flag && !state.flags[q.require.flag]) continue;
    if (!isActive(q.id) && !isDone(q.id)) accept(q.id);
  }
}

// 某港可接的支线（未接、未完成、且在该港）
export function offersAt(portId) {
  ensureQuests();
  return QUESTS.filter(q => q.kind === 'side' && q.port === portId
    && !isActive(q.id) && !isDone(q.id)
    && (!q.require?.flag || state.flags[q.require.flag]));
}

// ===== 目标判定 =====
function cargoTotal(goodId) {
  return state.fleet.reduce((a, s) => a + (s.cargo[goodId] || 0), 0);
}

function evalObj(o) {
  const c = state.quests.counters;
  switch (o.type) {
    case 'visit': return state.discovered.includes(o.port);
    case 'visitAny': return o.ports.some(p => state.discovered.includes(p));
    case 'deliver': return state.atPort === o.port && cargoTotal(o.good) >= o.qty;
    case 'defeat': {
      if (o.kind === 'merchant') return c.winsMerchant >= o.count;
      if (o.kind === 'patrol') return c.winsPatrol >= o.count;
      return c.wins >= o.count;
    }
    case 'gold': return state.player.gold >= o.amount;
    case 'talk': return !!state.flags['talked_' + o.npc];
    case 'flag': return !!state.flags[o.flag];
    case 'multi':
      if (o.all) return o.all.every(evalObj);
      if (o.any) return o.any.some(evalObj);
      return false;
    default: return false;
  }
}

// 人类可读的进度
export function progressText(q) {
  const c = state.quests.counters;
  const one = (o) => {
    switch (o.type) {
      case 'visit': return `抵达 ${PORT_BY_ID[o.port]?.name || o.port}　${state.discovered.includes(o.port) ? '✅' : '⬜'}`;
      case 'visitAny': return `抵达任意美洲港口　${o.ports.some(p => state.discovered.includes(p)) ? '✅' : '⬜'}`;
      case 'deliver': return `在 ${PORT_BY_ID[o.port]?.name} 交付 ${GOOD_BY_ID[o.good]?.name} ×${o.qty}　（当前船上 ${cargoTotal(o.good)}）${evalObj(o) ? '✅' : ''}`;
      case 'defeat': {
        const cur = o.kind === 'merchant' ? c.winsMerchant : o.kind === 'patrol' ? c.winsPatrol : c.wins;
        return `海战获胜 ${Math.min(cur, o.count)}/${o.count}${o.kind === 'patrol' ? '（巡逻舰）' : ''}　${cur >= o.count ? '✅' : ''}`;
      }
      case 'gold': return `攒够 ${o.amount} 金币　（当前 ${state.player.gold}）${evalObj(o) ? '✅' : ''}`;
      case 'talk': return `与目标人物对话　${evalObj(o) ? '✅' : '⬜'}`;
      case 'flag': return `${evalObj(o) ? '✅ 已完成' : '⬜ 进行中'}`;
      default: return '';
    }
  };
  const o = q.objective;
  if (o.type === 'multi') return (o.all || o.any).map(one).join('<br>');
  return one(o);
}

// ===== 结算 =====
function grant(q) {
  const r = q.reward || {};
  const p = state.player;
  const bits = [];
  if (r.gold) { p.gold = Math.max(0, p.gold + r.gold); bits.push(`${r.gold > 0 ? '+' : ''}${r.gold} 金币`); }
  if (r.exp) { p.exp += r.exp; bits.push(`+${r.exp} 经验`); }
  if (r.fame) { p.fame = Math.max(0, p.fame + r.fame); bits.push(`声望 ${r.fame > 0 ? '+' : ''}${r.fame}`); }
  if (r.infamy) { p.infamy = Math.max(0, p.infamy + r.infamy); bits.push(`恶名 ${r.infamy > 0 ? '+' : ''}${r.infamy}`); }
  if (r.morale) { state.crewMorale = Math.min(100, state.crewMorale + r.morale); bits.push(`士气 +${r.morale}`); }
  if (r.skill && p.skills[r.skill] !== undefined) { p.skills[r.skill] += 1; bits.push(`${skillName(r.skill)} +1`); }
  if (r.officer && !state.officers.includes(r.officer)) {
    state.officers.push(r.officer);
    bits.push(`${OFFICER_BY_ID[r.officer]?.name || r.officer} 加入`);
  }
  if (r.item) { state.flags['item_' + r.item] = true; bits.push('获得道具'); }
  return bits;
}
function skillName(k) {
  return { sailing: '航海', combat: '战斗', leadership: '统率', negotiation: '交涉' }[k] || k;
}

// 交货任务完成时扣除货物
function consumeDeliver(q) {
  const objs = q.objective.type === 'multi' ? (q.objective.all || q.objective.any || []) : [q.objective];
  for (const o of objs) {
    if (o.type !== 'deliver') continue;
    let left = o.qty;
    for (const s of state.fleet) {
      const have = s.cargo[o.good] || 0;
      if (!have) continue;
      const take = Math.min(have, left);
      s.cargo[o.good] = have - take;
      if (!s.cargo[o.good]) delete s.cargo[o.good];
      left -= take;
      if (left <= 0) break;
    }
  }
}

// 检查全部在进行的任务，返回刚完成的任务数组（供 UI 弹窗）
export function checkAll() {
  ensureQuests();
  syncMainQuests();
  const finished = [];
  for (const a of [...state.quests.active]) {
    const q = QUEST_BY_ID[a.id];
    if (!q) continue;
    if (!evalObj(q.objective)) continue;
    consumeDeliver(q);
    const bits = grant(q);
    state.quests.active = state.quests.active.filter(x => x.id !== a.id);
    state.quests.done.push(a.id);
    addLog(`完成${q.kind === 'main' ? '主线' : '支线'}任务：${q.title}`);
    finished.push({ quest: q, rewards: bits });
  }
  return finished;
}

// ===== 事件钩子 =====
export function onBattleWin(kind) {
  ensureQuests();
  const c = state.quests.counters;
  c.wins++;
  if (kind === 'merchant') c.winsMerchant++;
  if (kind === 'patrol') c.winsPatrol++;
}
export function onTalk(npcId) {
  state.flags['talked_' + npcId] = true;
}
