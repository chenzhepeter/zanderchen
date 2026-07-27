// 任务引擎：接取 / 追踪 / 判定 / 结算。主线随章节自动接取，支线由 NPC 或港口给出。
import { state, addLog, addFame, addItem } from './state.js';
import { QUESTS, QUEST_BY_ID } from './data/quests.js';
import { PORT_BY_ID } from './data/ports.js';
import { GOOD_BY_ID } from './data/goods.js';
import { OFFICER_BY_ID } from './data/officers.js';
import { EQUIP_BY_ID } from './data/equipment.js';

const FAME_NAME = { adventure: '冒险名声', trade: '交易名声', battle: '战斗名声' };

export function ensureQuests() {
  if (!state.quests) state.quests = { active: [], done: [], counters: { wins: 0, winsMerchant: 0, winsPatrol: 0 } };
  if (!state.quests.counters) state.quests.counters = { wins: 0, winsMerchant: 0, winsPatrol: 0 };
  // 公会委托是运行时生成的，不在 QUESTS 表里——接下来的那份得自己存着
  if (!state.quests.jobs) state.quests.jobs = {};
}

// 任务对象可能来自静态表，也可能是接下的公会委托
export function questById(id) {
  ensureQuests();
  return QUEST_BY_ID[id] || state.quests.jobs[id] || null;
}

export const isActive = id => { ensureQuests(); return state.quests.active.some(a => a.id === id); };
export const isDone = id => { ensureQuests(); return state.quests.done.includes(id); };
export const activeQuests = () => { ensureQuests(); return state.quests.active.map(a => questById(a.id)).filter(Boolean); };
export const doneQuests = () => { ensureQuests(); return state.quests.done.map(id => questById(id)).filter(Boolean); };

const KIND_WORD = { main: '主线', side: '支线', job: '公会' };

export function accept(id) {
  ensureQuests();
  if (isActive(id) || isDone(id)) return false;
  const q = QUEST_BY_ID[id];
  if (!q) return false;
  state.quests.active.push({ id, since: { ...state.date } });
  addLog(`接受${KIND_WORD[q.kind] || '支线'}任务：${q.title}`);
  return true;
}

// 接下一条公会委托：任务对象随存档一起保存，并按月数算出到期日
export function acceptJob(job) {
  ensureQuests();
  if (isActive(job.id) || isDone(job.id)) return false;
  state.quests.jobs[job.id] = job;
  state.quests.active.push({ id: job.id, since: { ...state.date }, due: dueDate(job.deadlineMonths || 1) });
  addLog(`接下公会委托：${job.title}`);
  return true;
}

function dueDate(months) {
  let y = state.date.y, m = state.date.m + months;
  while (m > 12) { m -= 12; y++; }
  return { y, m, d: state.date.d };
}
function pastDue(due) {
  if (!due) return false;
  const a = state.date;
  if (a.y !== due.y) return a.y > due.y;
  if (a.m !== due.m) return a.m > due.m;
  return a.d > due.d;
}
export function dueText(a) {
  if (!a.due) return '';
  return `期限 ${a.due.y}年${a.due.m}月${a.due.d}日`;
}

// 逾期作废：扣名声，任务从列表里消失（原版是 −10）
export function checkDeadlines() {
  ensureQuests();
  const expired = [];
  for (const a of [...state.quests.active]) {
    if (!pastDue(a.due)) continue;
    const q = questById(a.id);
    state.quests.active = state.quests.active.filter(x => x.id !== a.id);
    delete state.quests.jobs[a.id];
    if (q?.failPenalty) addFame(q.failPenalty);
    addLog(`委托逾期作废：${q?.title || a.id}。`);
    expired.push(q || { title: a.id });
  }
  return expired;
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
    case 'arrive': return state.atPort === o.port;   // 必须人现在就在那个港
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
      case 'arrive': return `亲自赶到 ${PORT_BY_ID[o.port]?.name || o.port}　${evalObj(o) ? '✅' : '⬜'}`;
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
  if (r.fame) {
    // 兼容旧写法（数字→战斗名声）；新写法是 { adventure, trade, battle }
    const f = typeof r.fame === 'number' ? { battle: r.fame } : r.fame;
    addFame(f);
    bits.push(Object.entries(f).map(([k, v]) => `${FAME_NAME[k]} ${v > 0 ? '+' : ''}${v}`).join(' '));
  }
  if (r.infamy) { p.infamy = Math.max(0, p.infamy + r.infamy); bits.push(`恶名 ${r.infamy > 0 ? '+' : ''}${r.infamy}`); }
  if (r.morale) { state.crewMorale = Math.min(100, state.crewMorale + r.morale); bits.push(`士气 +${r.morale}`); }
  if (r.skill && p.skills[r.skill] !== undefined) { p.skills[r.skill] += 1; bits.push(`${skillName(r.skill)} +1`); }
  if (r.officer && !state.officers.includes(r.officer)) {
    state.officers.push(r.officer);
    bits.push(`${OFFICER_BY_ID[r.officer]?.name || r.officer} 加入`);
  }
  if (r.item) { addItem(r.item); bits.push(`获得${EQUIP_BY_ID[r.item]?.name || '道具'}`); }
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
    const q = questById(a.id);
    if (!q) continue;
    if (!evalObj(q.objective)) continue;
    consumeDeliver(q);
    const bits = grant(q);
    state.quests.active = state.quests.active.filter(x => x.id !== a.id);
    state.quests.done.push(a.id);
    delete state.quests.jobs[a.id];
    addLog(`完成${KIND_WORD[q.kind] || '支线'}任务：${q.title}`);
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
