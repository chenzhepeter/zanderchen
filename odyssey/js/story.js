// 剧情结算层：act 执行 / 条件判定 / 章节切换 / 结局判定。
// VN 脚本、战斗奖励、谜题结果全部走这里改状态，别在别处直接改 state 上的资源字段。
import {
  state, addCrew, addSupply, addKleos, addHubris, addFavor, setFlag, unlockNote,
  saveGame, saveChapterHead, addLog, HUBRIS_STEP,
} from './state.js';
import { CARDS, WRATH_ORDER, REWARD_POOL } from './data/cards.js';
import { COMPANIONS, COMPANION_BY_ID } from './data/companions.js';
import { CHAPTERS, CHAPTER_BY_NUM, LAST_CHAPTER } from './data/chapters.js';
import { judgeEnding } from './data/endings.js';

let UI = null;
export function bindUI(ui) { UI = ui; }

// ===== 条件判定 =====
// 支持：flag / noFlag / endure / crew / supply / kleos / hubris / metis / bie / peitho
//      hasCard / hasRelic / alive / dead / chapter
export function checkCond(c) {
  if (!c) return true;
  const p = state.player;
  if (c.flag && !state.flags[c.flag]) return false;
  if (c.noFlag && state.flags[c.noFlag]) return false;
  if (c.endure != null && p.endure < c.endure) return false;
  if (c.crew != null && state.crew < c.crew) return false;
  if (c.supply != null && state.supply < c.supply) return false;
  if (c.kleos != null && state.kleos < c.kleos) return false;
  if (c.hubris != null && state.hubris < c.hubris) return false;
  if (c.hubrisUnder != null && state.hubris > c.hubrisUnder) return false;
  if (c.metis != null && p.metis < c.metis) return false;
  if (c.bie != null && p.bie < c.bie) return false;
  if (c.peitho != null && p.peitho < c.peitho) return false;
  if (c.hasCard && !state.deck.includes(c.hasCard)) return false;
  if (c.hasRelic && !state.relics.includes(c.hasRelic)) return false;
  if (c.anyRelic && !state.deck.some(id => CARDS[id]?.color === 'relic')) return false;
  if (c.alive && state.companions[c.alive] !== 'alive') return false;
  if (c.dead && state.companions[c.dead] === 'alive') return false;
  return true;
}

// 条件没满足时告诉玩家差在哪——不给提示的门槛只会让人以为是 bug
export function condText(c) {
  if (!c) return '';
  const out = [];
  if (c.endure != null) out.push(`忍耐 ≥ ${c.endure}`);
  if (c.crew != null) out.push(`船员 ≥ ${c.crew}`);
  if (c.supply != null) out.push(`补给 ≥ ${c.supply}`);
  if (c.kleos != null) out.push(`名声 ≥ ${c.kleos}`);
  if (c.metis != null) out.push(`智谋 ≥ ${c.metis}`);
  if (c.bie != null) out.push(`武勇 ≥ ${c.bie}`);
  if (c.peitho != null) out.push(`言辞 ≥ ${c.peitho}`);
  if (c.hasRelic) out.push(`需要「${CARDS[c.hasRelic]?.name || c.hasRelic}」`);
  if (c.anyRelic) out.push('需要任意一张神物牌');
  if (c.alive) out.push(`${COMPANION_BY_ID[c.alive]?.name} 还活着`);
  if (c.flag) out.push('需要之前的某个选择');
  return out.join(' · ');
}

// ===== act 执行 =====
// 返回给 UI 演出的变化列表 [{icon, text, good}]
export function applyAct(act) {
  if (!act) return [];
  const fx = [];
  const p = state.player;

  if (act.crew) { addCrew(act.crew); fx.push({ icon: '⚓', text: `船员 ${sign(act.crew)}`, good: act.crew > 0 }); }
  if (act.ships) { state.ships = Math.max(0, state.ships + act.ships); fx.push({ icon: '⛵', text: `船 ${sign(act.ships)}`, good: act.ships > 0 }); }
  if (act.supply) { addSupply(act.supply); fx.push({ icon: '🍞', text: `补给 ${sign(act.supply)}`, good: act.supply > 0 }); }
  if (act.kleos) { addKleos(act.kleos); fx.push({ icon: '🏛️', text: `名声 ${sign(act.kleos)}`, good: act.kleos > 0 }); }
  if (act.arrows) { state.arrows += act.arrows; fx.push({ icon: '🏹', text: `箭矢 ${sign(act.arrows)}`, good: act.arrows > 0 }); }
  if (act.athena) { addFavor('athena', act.athena); fx.push({ icon: '🦉', text: `雅典娜的眷顾 ${sign(act.athena)}`, good: act.athena > 0 }); }
  if (act.poseidon) { addFavor('poseidon', act.poseidon); fx.push({ icon: '🔱', text: `波塞冬的怒意 ${sign(act.poseidon)}`, good: act.poseidon < 0 }); }
  for (const k of ['metis', 'bie', 'peitho']) {
    if (act[k]) { p[k] += act[k]; fx.push({ icon: '✦', text: `${statName(k)} ${sign(act[k])}`, good: act[k] > 0 }); }
  }
  if (act.endure) {
    p.endure = Math.max(0, Math.min(p.endureMax, p.endure + act.endure));
    fx.push({ icon: '🜃', text: `忍耐 ${sign(act.endure)}`, good: act.endure > 0 });
  }
  if (act.endureMax) { p.endureMax += act.endureMax; p.endure += act.endureMax; }
  if (act.hp) { p.hp = Math.max(0, Math.min(p.hpMax, p.hp + act.hp)); }

  // 傲慢放最后：它可能触发神怒牌，要在其它变化之后演出
  if (act.hubris) {
    const owed = addHubris(act.hubris);
    fx.push({ icon: '👑', text: `傲慢 ${sign(act.hubris)}`, good: act.hubris < 0 });
    for (let i = 0; i < owed; i++) {
      const id = WRATH_ORDER[(state.wrathGiven - owed + i) % WRATH_ORDER.length];
      state.deck.push(id);
      fx.push({ icon: CARDS[id].icon, text: `牌组永久混入「${CARDS[id].name}」`, good: false, big: true });
    }
  }

  for (const f of act.flags || []) setFlag(f);
  for (const f of act.clearFlags || []) setFlag(f, false);
  for (const n of act.notes || []) {
    if (!state.notes.includes(n)) { unlockNote(n); fx.push({ icon: '📖', text: '解锁了一条神话笔记', good: true }); }
  }
  for (const pr of act.prophecy || []) if (!state.prophecy.includes(pr)) state.prophecy.push(pr);
  for (const id of act.cards || []) {
    state.deck.push(id);
    fx.push({ icon: CARDS[id]?.icon || '🃏', text: `获得计谋牌「${CARDS[id]?.name || id}」`, good: true, big: true });
  }
  for (const id of act.relics || []) {
    if (!state.relics.includes(id)) state.relics.push(id);
    state.deck.push(id);
    fx.push({ icon: CARDS[id]?.icon || '✨', text: `获得神物「${CARDS[id]?.name || id}」`, good: true, big: true });
  }
  for (const id of act.removeCards || []) removeOneCard(id);
  // 永久净化神怒牌：全程只有三处（喀耳刻之岛 / 冥府 / 淮阿喀亚神庙）
  for (let i = 0; i < (act.purgeWrath || 0); i++) {
    const id = purgeOneWrath();
    if (id) fx.push({ icon: '🕯️', text: `永久除掉了「${CARDS[id].name}」`, good: true, big: true });
    else fx.push({ icon: '🕯️', text: '牌组里已经没有神怒牌了', good: true });
  }

  // 同伴生死：卡牌跟着人走
  for (const cid of act.kill || []) fx.push(...killCompanion(cid));
  for (const cid of act.save || []) {
    if (state.companions[cid] === 'alive') {
      setFlag('saved_' + cid);
      fx.push({ icon: '⚓', text: `${COMPANION_BY_ID[cid]?.name} 活下来了`, good: true, big: true });
    }
  }
  if (act.log) addLog(act.log);
  if (act.ending) { state.gameOver = true; state.ending = act.ending; }
  saveGame();
  return fx;
}

export function killCompanion(cid) {
  const c = COMPANION_BY_ID[cid];
  if (!c || state.companions[cid] !== 'alive') return [];
  state.companions[cid] = 'dead';
  const removed = removeOneCard(c.card, true);   // 从牌组移出，进 exiled
  addLog(`${c.name}死了。${c.death}`);
  return [{ icon: '🕯️', text: `${c.name} 阵亡 —— 牌组永久失去「${c.name}」`, good: false, big: true, dead: removed }];
}

// 从牌组母本里移掉一张；toExile 时记进 exiled（图鉴里能看到失去了什么）
export function removeOneCard(id, toExile = false) {
  const i = state.deck.indexOf(id);
  if (i < 0) return false;
  state.deck.splice(i, 1);
  if (toExile) state.exiled.push(id);
  return true;
}

// 净化：永久移除牌组里的一张神怒牌
export function purgeOneWrath() {
  const i = state.deck.findIndex(id => CARDS[id]?.color === 'wrath');
  if (i < 0) return null;
  const id = state.deck.splice(i, 1)[0];
  return id;
}
export function wrathInDeck() { return state.deck.filter(id => CARDS[id]?.color === 'wrath').length; }

// ===== 章节 =====
export function startChapter(n) {
  state.chapter = n;
  state.player.endure = state.player.endureMax;    // 忍耐每章回满
  state.player.hp = state.player.hpMax;
  const ch = CHAPTER_BY_NUM[n];
  if (ch) for (const id of ch.notes || []) unlockNote(id);
  saveChapterHead();                                // 章首档：允许退回本章重打
  saveGame();
}

export function nextChapterNum() {
  return state.chapter >= LAST_CHAPTER ? 13 : state.chapter + 1;
}

export function rewardChoices() {
  const pool = REWARD_POOL[state.chapter] || REWARD_POOL[0];
  return pool.map(id => CARDS[id]).filter(Boolean);
}

export function takeReward(id) {
  state.deck.push(id);
  saveGame();
}

export function finalEnding() {
  if (state.ending) return state.ending;
  return judgeEnding(state);
}

// ===== 小工具 =====
function sign(n) { return n > 0 ? `+${n}` : `${n}`; }
function statName(k) { return { metis: '智谋', bie: '武勇', peitho: '言辞' }[k] || k; }

// 章末结算摘要
export function chapterSummary() {
  const alive = COMPANIONS.filter(c => state.companions[c.id] === 'alive');
  return {
    crew: state.crew, ships: state.ships, supply: state.supply,
    kleos: state.kleos, hubris: state.hubris,
    deck: state.deck.length, wrath: wrathInDeck(),
    alive: alive.map(c => c.name),
    lost: COMPANIONS.filter(c => state.companions[c.id] === 'dead').map(c => c.name),
    nextWrathAt: (Math.floor(state.hubris / HUBRIS_STEP) + 1) * HUBRIS_STEP,
  };
}
