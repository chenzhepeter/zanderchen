// 全局状态单例 + 存档层。
// 存档设计照搬 odyssey/js/state.js（源头是 blackbeard/js/state.js）：payload 三段式（version/savedAt/state + counters）、
// {ok, reason} 三态返回、槽位摘要不反序列化到 state；关首档 levelhead 允许"重打本关"。
import { UNIT_TYPES } from './data/units.js';
import { XP_TABLE } from './data/tactics.js';
import { initialRoster } from './data/campaign.js';

// 版本号：北京日期 + 当天提交序号（由 .githooks/pre-commit 自动更新）
export const APP_VERSION = '2026.9.12.2';
export const SAVE_VERSION = 1;
export const STORAGE_KEY = 'korea.save';
export const SLOT_KEY = (i) => `korea.slot.${i}`;
export const LEVEL_KEY = 'korea.levelhead';
export const NUM_SLOTS = 5;

// 原版主角有"统帅"（影响直属部队攻防）与"智力"（影响策略效果）
export const HERO_STATS = {
  inf: { cmd: 2, intel: 1 }, cav: { cmd: 1, intel: 2 }, mg: { cmd: 2, intel: 1 }, spec: { cmd: 1, intel: 3 },
};

let logUid = 1;

export const state = {
  version: SAVE_VERSION,
  playerName: '', heroType: 'inf', heroStats: { cmd: 2, intel: 1 },
  level: 1,                 // 当前关
  unlocked: 1,              // 已解锁到第几关
  cleared: {},              // 关卡号 -> { score, rank, turn }
  roster: [],               // 独立一师花名册（跨关持久）
  armory: { weapons: [], items: [] },   // 军械库：缴获的武器/物品，整补时分配
  totalScore: 0,
  phase: 'setup',           // setup | briefing | battle | refit | ending
  battle: null,             // 战斗中的序列化快照（每回合自动写）
  pendingResult: null,      // 刚打完还没整补的战果
  battleLog: [],            // 战斗中的战报（随战斗快照一起存）
  log: [],
  ending: null,
};

export function addLog(text) {
  state.log.unshift({ id: logUid++, level: state.level, text });
  if (state.log.length > 100) state.log.length = 100;
}

export function initNewGame(heroType, playerName) {
  const roster = initialRoster(heroType, playerName || '师长').map(r => {
    const t = UNIT_TYPES[r.type];
    return {
      id: r.id, type: r.type, name: r.name, hero: !!r.hero, named: r.named || null,
      men: t.men, level: r.level || 1, xp: r.xp || 0, morale: t.morale,
      weapons: [...t.weapons], weapon: 0, gear: [], items: [],
      tactics: [...new Set([...(t.tactics || []), ...(r.tactics || [])])],
    };
  });
  Object.assign(state, {
    version: SAVE_VERSION, playerName: playerName || '师长', heroType, heroStats: { ...HERO_STATS[heroType] },
    level: 1, unlocked: 1, cleared: {}, roster, armory: { weapons: [], items: [] }, totalScore: 0,
    phase: 'briefing', battle: null, pendingResult: null, log: [], ending: null,
  });
  logUid = 1;
  addLog('1950 年 10 月，独立一师跨过鸭绿江。');
}

// 战后结算：把战场上的部队状态写回花名册（伤员 70% 归队、溃散部队重建、缴获入库、补充兵）
export function settleBattle(B, result) {
  const s = result.stats;
  for (const rec of state.roster) {
    const u = B.units.find(x => x.roster === rec.id);
    if (!u) continue;
    const t = UNIT_TYPES[rec.type];
    if (!u.alive) {
      rec.men = Math.round(t.men * 0.4);
      rec.level = Math.max(1, u.level - 1);
      rec.xp = XP_TABLE[rec.level - 1];
    } else {
      rec.men = Math.max(5, u.men - Math.round(u.wounded * 0.3));
      rec.level = u.level; rec.xp = u.xp;
    }
    rec.weapons = [...u.weapons]; rec.weapon = Math.min(u.weapon, rec.weapons.length - 1);
    rec.gear = [...u.gear]; rec.items = [...u.items]; rec.tactics = [...u.tactics];
    rec.morale = Math.max(60, Math.min(100, u.morale + 10));
    if (result.win) {
      const add = Math.min(t.men - rec.men, 20 + Math.floor(result.score / 40));
      rec.men += Math.max(0, add);
      rec.replaced = Math.max(0, add);
    }
  }
  for (const w of s.captured) state.armory.weapons.push(w);
  for (const it of s.capturedItems) state.armory.items.push(it);
  if (result.win) {
    const prev = state.cleared[B.level.num];
    if (!prev || prev.score < result.score) state.cleared[B.level.num] = { score: result.score, rank: result.rank, turn: result.turn };
    state.totalScore = Object.values(state.cleared).reduce((a, c) => a + c.score, 0);
    state.unlocked = Math.max(state.unlocked, Math.min(10, B.level.num + 1));
    // 主角随战功成长
    const n = Object.keys(state.cleared).length;
    state.heroStats.cmd = HERO_STATS[state.heroType].cmd + Math.floor(n / 3);
    state.heroStats.intel = HERO_STATS[state.heroType].intel + Math.floor(n / 4);
  }
  state.battle = null;
}

export function heroRecord() { return state.roster.find(r => r.hero); }

// ===== 存档 =====
function buildPayload() {
  return {
    version: SAVE_VERSION, savedAt: Date.now(),
    state: {
      playerName: state.playerName, heroType: state.heroType, heroStats: state.heroStats,
      level: state.level, unlocked: state.unlocked, cleared: state.cleared, roster: state.roster, armory: state.armory,
      totalScore: state.totalScore, phase: state.phase, battle: state.battle, battleLog: state.battleLog || [], pendingResult: state.pendingResult, log: state.log, ending: state.ending,
    },
    counters: { log: logUid },
  };
}
function applyPayload(p) {
  if (!p) return { ok: false, reason: 'corrupt' };
  if (p.version !== SAVE_VERSION) return { ok: false, reason: 'version', oldVersion: p.version };
  Object.assign(state, p.state);
  logUid = p.counters?.log || 1;
  if (!Array.isArray(state.roster) || !state.roster.length) return { ok: false, reason: 'corrupt' };
  return { ok: true };
}
export function saveGame() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPayload())); return true; }
  catch (e) { console.warn('save failed', e); return false; }
}
export function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ok: false, reason: 'empty' };
  try { return applyPayload(JSON.parse(raw)); } catch (e) { return { ok: false, reason: 'corrupt' }; }
}
export function hasSave() { return !!localStorage.getItem(STORAGE_KEY); }
export function clearSave() { localStorage.removeItem(STORAGE_KEY); }

// 关首档：每关部署前写一份，允许"重打本关"
export function saveLevelHead() {
  try { localStorage.setItem(LEVEL_KEY, JSON.stringify(buildPayload())); return true; } catch (e) { return false; }
}
export function loadLevelHead() {
  const raw = localStorage.getItem(LEVEL_KEY);
  if (!raw) return { ok: false, reason: 'empty' };
  try { return applyPayload(JSON.parse(raw)); } catch (e) { return { ok: false, reason: 'corrupt' }; }
}
export function levelHeadInfo() {
  const raw = localStorage.getItem(LEVEL_KEY);
  if (!raw) return null;
  try { const p = JSON.parse(raw); if (p.version !== SAVE_VERSION) return null; return { level: p.state.level, savedAt: p.savedAt }; } catch (e) { return null; }
}

export function saveToSlot(slot) {
  if (slot < 1 || slot > NUM_SLOTS) return false;
  try { localStorage.setItem(SLOT_KEY(slot), JSON.stringify(buildPayload())); return true; } catch (e) { return false; }
}
export function loadFromSlot(slot) {
  const raw = localStorage.getItem(SLOT_KEY(slot));
  if (!raw) return { ok: false, reason: 'empty' };
  try { return applyPayload(JSON.parse(raw)); } catch (e) { return { ok: false, reason: 'corrupt' }; }
}
export function deleteSlot(slot) { localStorage.removeItem(SLOT_KEY(slot)); return true; }

// 槽位摘要：只 parse 元数据，不写入 state；坏档/版本不符一律当空槽
export function listSaveSlots() {
  const out = [];
  for (let i = 1; i <= NUM_SLOTS; i++) {
    const raw = localStorage.getItem(SLOT_KEY(i));
    if (!raw) { out.push(null); continue; }
    try {
      const p = JSON.parse(raw);
      if (p.version !== SAVE_VERSION) { out.push(null); continue; }
      const s = p.state;
      out.push({ slot: i, savedAt: p.savedAt, level: s.level, playerName: s.playerName, phase: s.phase, totalScore: s.totalScore, inBattle: !!s.battle, turn: s.battle?.turn });
    } catch (e) { out.push(null); }
  }
  return out;
}
