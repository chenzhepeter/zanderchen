// 全局状态单例 + 存档层
// 存档设计照搬 blackbeard/js/state.js：payload 三段式（version/savedAt/state + counters）、
// {ok, reason} 三态返回、槽位摘要不反序列化到 state。
import { STARTER_DECK } from './data/cards.js';
import { COMPANIONS } from './data/companions.js';

// 版本号：北京日期 + 当天提交序号（由 .githooks/pre-commit 自动更新）
export const APP_VERSION = '2026.9.12.1';
export const SAVE_VERSION = 1;
export const STORAGE_KEY = 'odyssey.save';
export const SLOT_KEY = (i) => `odyssey.slot.${i}`;
// 章首档：每章开头自动写一份，允许退回本章重打（战斗/谜题中不可读档）
export const CHAPTER_KEY = 'odyssey.chapterhead';
export const NUM_SLOTS = 5;

// 模块级计数器：不在 state 里，必须单独存/恢复，否则读档后新对象会与旧对象撞 id
let logUid = 1;

// 傲慢每过一档就永久塞一张神怒牌进牌组
export const HUBRIS_STEP = 25;
export const HUBRIS_MAX = 100;

export const state = {
  version: SAVE_VERSION,
  chapter: 0,              // 0=序章 … 12=伊塔卡，13=尾声
  node: null,              // 当前 VN 节点 id
  scene: null,             // 当前背景 id
  speaker: null,           // 当前立绘 { who, emote }
  player: {
    name: '奥德修斯',
    // 三维成长（忍耐单列，因为它是每章回满的消耗资源而非永久属性）
    metis: 1, bie: 1, peitho: 1,
    endure: 3, endureMax: 3,
    hp: 40, hpMax: 40,
  },
  // ===== 跨章连锁资源：只减不增，或极难增 =====
  crew: 600,               // 船员；归零 → 结局「海上亡魂」
  ships: 12,
  supply: 80,              // 不足 20 时战斗手牌上限 −1（饥饿）
  hubris: 0,               // 傲慢；每 25 点永久插入 1 张神怒牌
  kleos: 0,                // 名声；第 11 章赠礼与结局评级
  favor: { athena: 0, poseidon: 0 },
  arrows: 0,               // 箭矢，留到终章弓之试炼

  // ===== 牌组 =====
  deck: [],                // 牌组母本（卡牌 id 列表，可重复）
  exiled: [],              // 永久移出的卡（同伴阵亡 / 被净化的神怒）
  wrathGiven: 0,           // 已因傲慢发放的神怒牌数（防重复发）
  companions: {},          // 同伴 id -> 'alive' | 'dead'
  relics: [],              // 已获得的神物 id

  flags: {},               // 剧情旗标
  notes: [],               // 已解锁的神话笔记 id
  prophecy: [],            // 冥府获得的预言 id（后续章节的真实提示）
  log: [],                 // 航海日志
  gameOver: false,
  ending: null,
};

// ===== 派生 =====
export function aliveCompanions() {
  return COMPANIONS.filter(c => state.companions[c.id] === 'alive');
}
export function isStarving() { return state.supply < 20; }
export function handSize() { return isStarving() ? 4 : 5; }
export function hubrisTier() { return Math.floor(state.hubris / HUBRIS_STEP); }

export function addLog(text) {
  state.log.unshift({ id: logUid++, chapter: state.chapter, text });
  if (state.log.length > 200) state.log.length = 200;
}

// ===== 资源改动统一入口 =====
// 全部走这里，别在各处直接 +=：船员归零、傲慢满档这些判定只在这一处做。
export function addCrew(n) {
  state.crew = Math.max(0, state.crew + n);
  if (state.crew <= 0) { state.gameOver = true; state.ending = 'LOST'; }
  return state.crew;
}
export function addSupply(n) { state.supply = Math.max(0, state.supply + n); }
export function addKleos(n) { state.kleos = Math.max(0, state.kleos + n); }
export function addFavor(god, n) {
  if (!(god in state.favor)) return;
  state.favor[god] += n;
}
// 返回本次该发放的神怒牌张数，交给调用方插牌并演出。
// 注意必须无条件返回 owed：早先这里写成「档次没变就返回 0」，
// 结果 wrathGiven 已经加过、牌却没发出去，欠下的神怒牌被悄悄吞掉了。
export function addHubris(n) {
  state.hubris = Math.max(0, Math.min(HUBRIS_MAX, state.hubris + n));
  const owed = Math.max(0, hubrisTier() - state.wrathGiven);
  state.wrathGiven += owed;
  if (state.hubris >= HUBRIS_MAX) { state.gameOver = true; state.ending = 'LOST'; }
  return owed;
}

export function hasFlag(f) { return !!state.flags[f]; }
export function setFlag(f, v = true) { state.flags[f] = v; }
export function hasRelic(id) { return state.relics.includes(id); }
export function unlockNote(id) { if (!state.notes.includes(id)) state.notes.push(id); }

// ===== 新游戏 =====
export function initNewGame() {
  Object.assign(state, {
    version: SAVE_VERSION,
    chapter: 0, node: null, scene: null, speaker: null,
    player: {
      name: '奥德修斯',
      metis: 1, bie: 1, peitho: 1,
      endure: 3, endureMax: 3,
      hp: 40, hpMax: 40,
    },
    crew: 600, ships: 12, supply: 80,
    hubris: 0, kleos: 0,
    favor: { athena: 0, poseidon: 0 },
    arrows: 0,
    deck: [...STARTER_DECK],
    exiled: [], wrathGiven: 0,
    companions: {}, relics: [],
    flags: {}, notes: [], prophecy: [], log: [],
    gameOver: false, ending: null,
  });
  // 序章开场时四名有名字的同伴都还活着——他们各自是牌组里的一张牌
  for (const c of COMPANIONS) {
    state.companions[c.id] = c.joinsAt === 0 ? 'alive' : 'away';
    if (c.joinsAt === 0) state.deck.push(c.card);
  }
  logUid = 1;
  addLog('特洛伊的城墙塌了。十二条船满载着战利品，船头朝西——回家。');
}

// ===== 存档 =====
function buildPayload() {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    state: {
      chapter: state.chapter, node: state.node, scene: state.scene, speaker: state.speaker,
      player: state.player,
      crew: state.crew, ships: state.ships, supply: state.supply,
      hubris: state.hubris, kleos: state.kleos, favor: state.favor, arrows: state.arrows,
      deck: state.deck, exiled: state.exiled, wrathGiven: state.wrathGiven,
      companions: state.companions, relics: state.relics,
      flags: state.flags, notes: state.notes, prophecy: state.prophecy,
      log: state.log, gameOver: state.gameOver, ending: state.ending,
    },
    counters: { log: logUid },
  };
}

function applyPayload(p) {
  if (!p) return { ok: false, reason: 'corrupt' };
  if (p.version !== SAVE_VERSION) return { ok: false, reason: 'version', oldVersion: p.version };
  Object.assign(state, p.state);
  logUid = p.counters?.log || 1;
  if (!Array.isArray(state.deck) || !state.deck.length) state.deck = [...STARTER_DECK];
  return { ok: true };
}

export function saveGame() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPayload())); return true; }
  catch (e) { console.warn('save failed', e); return false; }
}
export function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ok: false, reason: 'empty' };
  try { return applyPayload(JSON.parse(raw)); }
  catch (e) { return { ok: false, reason: 'corrupt' }; }
}
export function clearSave() { localStorage.removeItem(STORAGE_KEY); }
export function hasSave() { return !!localStorage.getItem(STORAGE_KEY); }

// 章首档：难度全靠跨章资源连锁，所以必须允许退回本章开头重打，
// 但不允许在战斗/谜题中途读档——否则连锁就没有重量了。
export function saveChapterHead() {
  try { localStorage.setItem(CHAPTER_KEY, JSON.stringify(buildPayload())); return true; }
  catch (e) { return false; }
}
export function loadChapterHead() {
  const raw = localStorage.getItem(CHAPTER_KEY);
  if (!raw) return { ok: false, reason: 'empty' };
  try { return applyPayload(JSON.parse(raw)); }
  catch (e) { return { ok: false, reason: 'corrupt' }; }
}
export function chapterHeadInfo() {
  const raw = localStorage.getItem(CHAPTER_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p.version !== SAVE_VERSION) return null;
    return { chapter: p.state.chapter, crew: p.state.crew, savedAt: p.savedAt };
  } catch (e) { return null; }
}

export function saveToSlot(slot) {
  if (slot < 1 || slot > NUM_SLOTS) return false;
  try { localStorage.setItem(SLOT_KEY(slot), JSON.stringify(buildPayload())); return true; }
  catch (e) { return false; }
}
export function loadFromSlot(slot) {
  const raw = localStorage.getItem(SLOT_KEY(slot));
  if (!raw) return { ok: false, reason: 'empty' };
  try { return applyPayload(JSON.parse(raw)); }
  catch (e) { return { ok: false, reason: 'corrupt' }; }
}
export function deleteSlot(slot) { localStorage.removeItem(SLOT_KEY(slot)); return true; }

// 槽位摘要：只 parse 元数据，不写入 state；坏档/版本不符一律当空槽，列表永不崩
export function listSaveSlots() {
  const out = [];
  for (let i = 1; i <= NUM_SLOTS; i++) {
    const raw = localStorage.getItem(SLOT_KEY(i));
    if (!raw) { out.push(null); continue; }
    try {
      const p = JSON.parse(raw);
      if (p.version !== SAVE_VERSION) { out.push(null); continue; }
      const s = p.state;
      out.push({
        slot: i, savedAt: p.savedAt,
        chapter: s.chapter, crew: s.crew, ships: s.ships,
        hubris: s.hubris, kleos: s.kleos,
        deck: (s.deck || []).length,
      });
    } catch (e) { out.push(null); }
  }
  return out;
}
