// UI 外壳：标题 / 开局设置 / 战前简报 / 部署 / 战斗面板 / 剧情对话 / 战果 / 整补 / 关卡选择 / 存档 / 说明。
// 分工沿用仓库惯例（odyssey/js/ui.js）：战场走 canvas（render.js），面板与文本走 DOM + innerHTML；
// 战斗规则在 engine/battle.js，本文件只负责把玩家的点击翻译成规则调用，并把 HOST 回调画到屏幕上。
import {
  state, APP_VERSION, NUM_SLOTS, initNewGame, saveGame, loadGame, hasSave, saveLevelHead, loadLevelHead, levelHeadInfo,
  saveToSlot, loadFromSlot, deleteSlot, listSaveSlots, settleBattle, heroRecord, HERO_STATS,
} from './state.js';
import { LEVELS, LEVEL_BY_NUM, LAST_LEVEL, loadLevel } from './data/campaign.js';
import { UNIT_TYPES, PROTAGONIST_TYPES, FACTIONS } from './data/units.js';
import { WEAPONS } from './data/weapons.js';
import { ITEMS, GEAR } from './data/items.js';
import { TACTICS, XP_TABLE } from './data/tactics.js';
import { TERRAIN, FORT } from './data/terrain.js';
import { CHARACTERS, charName } from './data/characters.js';
import * as Battle from './engine/battle.js';
import * as R from './render.js';
import { key, manhattan, pathFrom, terrain, unitAt } from './engine/grid.js';
import { effMen, currentWeapon, canFire, fatigueLabel, moraleLabel, xpToNext, rankForScore, typeOf, resolveAttack, bestWeaponFor } from './engine/rules.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const settings = { fast: false };
let ui = { mode: 'idle', sel: null, inspect: null, tactic: null, deployId: null, busy: false, logs: [], logOpen: false, lastSave: 0, hoverEst: null };

// ===== 模态 / 提示 =====
export function openModal({ title, body, actions = [], wide = false, dismissable = false, cls = '' }) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-mask"></div>
    <div class="modal ${wide ? 'wide' : ''} ${cls}">
      ${title ? `<h2>${title}</h2>` : ''}
      <div class="modal-body">${body}</div>
      <div class="modal-actions">
        ${actions.map((a, i) => `<button class="${a.primary ? 'primary-btn' : 'ghost-btn'}" data-i="${i}" ${a.disabled ? 'disabled' : ''}>${a.label}</button>`).join('')}
      </div>
    </div>`;
  $$('.modal-actions button', root).forEach((btn, i) => btn.addEventListener('click', () => actions[i].onClick && actions[i].onClick()));
  if (dismissable) $('.modal-mask', root).addEventListener('click', closeModal);
}
export function closeModal() { $('#modal-root').innerHTML = ''; }
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.add('hidden'));
  $('#' + id).classList.remove('hidden');
}

// ===== 标题 =====
export function boot() {
  $('#version').textContent = 'v' + APP_VERSION;
  $('#btn-new').addEventListener('click', () => {
    if (hasSave()) openModal({ title: '开始新战役？', body: '<p>当前的进度会被新战役覆盖（存档槽位里的不受影响）。</p>', actions: [
      { label: '取消', onClick: closeModal }, { label: '开始新战役', primary: true, onClick: () => { closeModal(); showSetup(); } }] });
    else showSetup();
  });
  $('#btn-continue').addEventListener('click', () => {
    const r = loadGame();
    if (!r.ok) return toast(r.reason === 'version' ? '存档版本不兼容，请开始新战役' : '没有可用的进度');
    resumeFromState();
  });
  $('#btn-levels').addEventListener('click', showLevelSelect);
  $('#btn-slots').addEventListener('click', () => showSlots('load'));
  $('#btn-help').addEventListener('click', showHelp);
  document.addEventListener('keydown', onKey);
  showStart();
}
function showStart() {
  R.closeMap();
  Battle.cleanup();
  showScreen('start-screen');
  $('#btn-continue').disabled = !hasSave();
}

async function resumeFromState() {
  if (state.phase === 'battle' && state.battle) {
    const level = await loadLevel(state.battle.levelNum);
    if (!level) return toast('关卡数据缺失');
    bindBattleHost();
    Battle.restoreBattle(level, state.battle);
    ui.logs = state.battleLog || [];
    enterBattleScreen();
    return;
  }
  if (state.phase === 'refit') return showRefit();
  if (state.phase === 'ending') return showEnding();
  return beginLevel(state.level || 1);
}

// ===== 开局设置：主角兵种四选一 + 起名 =====
function showSetup() {
  showScreen('campaign-screen');
  const cards = PROTAGONIST_TYPES.map(id => {
    const t = UNIT_TYPES[id], hs = HERO_STATS[id];
    return `<label class="pick-card"><input type="radio" name="hero" value="${id}" ${id === 'inf' ? 'checked' : ''}>
      <div class="pick-inner"><div class="pick-title">${t.icon} ${t.name}</div>
      <div class="muted small">${t.desc}</div>
      <div class="small">人数 ${t.men} · 行动 ${t.mp} · 视野 ${t.vision}<br>统帅 ${hs.cmd} · 智力 ${hs.intel}</div></div></label>`;
  }).join('');
  $('#campaign-body').innerHTML = `
    <div class="camp-card">
      <p class="eyebrow">独立一师 · 出征</p>
      <h2>选择你的直属部队</h2>
      <p class="muted">和原版一样，师长直属一支连队，兵种四选一。"统帅"提高直属部队的攻防，"智力"提高策略效果。</p>
      <div class="pick-grid">${cards}</div>
      <div class="row" style="margin-top:14px;align-items:center;gap:10px;flex-wrap:wrap">
        <label>师长姓名：<input id="hero-name" class="input" maxlength="8" placeholder="例如：王大山" value="王大山"></label>
      </div>
      <div class="btn-row" style="margin-top:18px">
        <button class="ghost-btn" id="setup-back">‹ 返回</button>
        <button class="primary-btn big" id="setup-go">跨过鸭绿江 ▶</button>
      </div>
    </div>`;
  $('#setup-back').addEventListener('click', showStart);
  $('#setup-go').addEventListener('click', () => {
    const type = $('input[name=hero]:checked').value;
    const name = ($('#hero-name').value || '').trim() || '师长';
    initNewGame(type, name);
    saveGame();
    beginLevel(1);
  });
}

// ===== 关卡流程 =====
async function beginLevel(n) {
  state.level = n; state.phase = 'briefing'; state.battle = null; saveGame();
  const level = await loadLevel(n);
  if (!level) return toast('关卡数据缺失');
  showBriefing(level);
}
function showBriefing(level) {
  showScreen('campaign-screen');
  const roster = state.roster.filter(r => r.men > 0);
  const reserved = new Set(level.reserved || []);
  $('#campaign-body').innerHTML = `
    <div class="camp-card wide">
      <p class="eyebrow">第 ${level.num} 关 · ${level.date} · ${level.place}</p>
      <h2>${level.title}</h2>
      <div class="brief-grid">
        <div>
          <h4>背景</h4><div class="prose">${level.intro}</div>
          <h4>敌我态势</h4><div class="prose">${level.situation}</div>
          <div class="goal-box"><b>🎯 任务</b><br>${level.goal}<br><span class="muted small">回合上限 ${level.turns} · 开局${level.startTime === 'night' ? '夜晚' : '白天'}${level.weather === 'snow' ? ' · ❄️ 严寒' : ''}${level.air ? ` · ✈️ 白天每回合 ${level.air} 次空袭` : ''}</span></div>
          ${level.tips ? `<ul class="tips">${level.tips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
        </div>
        <div>
          <canvas id="minimap" width="360" height="240" class="minimap"></canvas>
          <p class="muted small">黄色：部署区 · 红：我方/要点 · 蓝：敌军/敌占要点</p>
          <h4>可上场部队（最多 ${level.maxDeploy} 支）</h4>
          <div class="roster-mini">${roster.map(r => `<span class="chip ${reserved.has(r.id) ? 'dim' : ''}">${UNIT_TYPES[r.type].icon} ${r.name} <i>L${r.level} · ${r.men}人</i>${reserved.has(r.id) ? ' · 剧情出场' : ''}</span>`).join('')}</div>
        </div>
      </div>
      <p class="hist">📖 ${level.note}</p>
      <div class="btn-row" style="margin-top:14px">
        <button class="ghost-btn" id="brief-back">‹ 标题</button>
        <button class="primary-btn big" id="brief-go">部署部队 ▶</button>
      </div>
    </div>`;
  R.drawMiniMap($('#minimap'), level);
  $('#brief-back').addEventListener('click', showStart);
  $('#brief-go').addEventListener('click', () => startDeploy(level));
}

function startDeploy(level) {
  saveLevelHead();
  bindBattleHost();
  Battle.startBattle(level, { roster: state.roster, playerName: state.playerName, heroStats: state.heroStats, seed: (Date.now() ^ (level.num * 7919)) >>> 0 });
  ui.logs = [];
  state.phase = 'battle';
  enterBattleScreen();
  const B = Battle.getB();
  if (B.phase === 'deploy') {
    ui.mode = 'deploy';
    R.setHighlights({ deploy: Battle.deployCells() });
    log('部署阶段：点下方的部队，再点黄色区域放置；也可以"自动部署"。', 'sys');
  }
}
function enterBattleScreen() {
  showScreen('battle-screen');
  R.openMap($('#map'), {
    state: () => Battle.getB(), canSee: (u) => Battle.playerCanSee(u), fast: () => settings.fast,
    onTap, onHover,
  });
  ui.mode = Battle.getB().phase === 'deploy' ? 'deploy' : 'idle';
  ui.sel = null; ui.inspect = null;
  if (ui.mode === 'deploy') R.setHighlights({ deploy: Battle.deployCells() });
  refresh();
}

// ===== HOST：战斗引擎回调 =====
function bindBattleHost() {
  Battle.bindHost({
    log, toast,
    refresh: () => { refresh(); autosave(); },
    anim: (type, payload) => R.animate(type, payload),
    say: (lines) => sayLines(lines),
    onEnd: (result) => onBattleEnd(result),
    mapChanged: () => R.terrainDirty(),
  });
}
function log(text, kind = 'sys') {
  ui.logs.push({ text, kind, turn: Battle.getB()?.turn });
  if (ui.logs.length > 120) ui.logs.shift();
  renderLog();
}
function autosave() {
  const B = Battle.getB();
  if (!B || B.phase !== 'p' || B.busy) return;
  const now = Date.now();
  if (now - ui.lastSave < 800) return;
  ui.lastSave = now;
  state.battle = Battle.serializeBattle();
  state.battleLog = ui.logs.slice(-40);
  state.phase = 'battle';
  saveGame();
}

// 剧情对话：逐句显示，点击继续；返回 Promise
function sayLines(lines) {
  return new Promise(resolve => {
    let i = 0;
    const box = $('#dialog');
    const show = () => {
      if (i >= lines.length) { box.classList.add('hidden'); box.onclick = null; resolve(); return; }
      const ln = lines[i++];
      const c = CHARACTERS[ln.who] || CHARACTERS.narrator;
      const name = charName(ln.who, state.playerName);
      box.classList.remove('hidden');
      box.innerHTML = `<div class="dlg-who ${c.faction}">${c.icon} ${name ? `<b>${escapeHtml(name)}</b>` : ''}${c.title ? `<span class="muted small">　${c.title}</span>` : ''}</div>
        <div class="dlg-text">${escapeHtml(ln.text)}</div><div class="dlg-more">${i < lines.length ? '点击继续 ▸' : '点击关闭 ✓'}</div>`;
    };
    box.onclick = show;
    show();
  });
}

// ===== 输入 =====
async function onTap(t) {
  const B = Battle.getB();
  if (!B || ui.busy || B.busy || B.phase === 'over') return;
  if (!$('#dialog').classList.contains('hidden')) return;
  if (B.phase === 'deploy') return onTapDeploy(t);
  if (B.phase !== 'p') return;
  if (!t) { deselect(); return; }
  const u = unitAt(B.units, t.x, t.y);
  const visible = u && Battle.playerCanSee(u);
  if (ui.mode === 'tactic' && ui.sel) {
    const list = Battle.tacticTargetList(ui.sel, ui.tactic);
    const hit = list.find(x => x.x === t.x && x.y === t.y);
    if (hit) { await run(() => Battle.useTactic(ui.sel, ui.tactic, hit)); afterAction(); }
    else { ui.mode = 'select'; toast('已取消'); selectUnit(ui.sel); }
    return;
  }
  if (ui.mode === 'select' && ui.sel) {
    const sel = ui.sel;
    // 攻击目标
    if (u && visible && u.side === 'e') {
      const tg = Battle.attackTargets(sel).find(x => x.unit === u);
      if (tg) { await run(() => Battle.attack(sel, u)); afterAction(); return; }
      inspectUnit(u); return;
    }
    // 移动
    const reach = ui.reach;
    if (reach && reach.has(key(t.x, t.y)) && !u) {
      await run(() => Battle.moveUnit(sel, t.x, t.y, { reach }));
      afterAction();
      return;
    }
    if (u && u.side === 'p') { selectUnit(u); return; }
    deselect();
    return;
  }
  // idle
  if (u && u.side === 'p') selectUnit(u);
  else if (u && visible) inspectUnit(u);
  else deselect();
}
function onTapDeploy(t) {
  const B = Battle.getB();
  if (!t) return;
  const u = unitAt(B.units, t.x, t.y);
  if (ui.deployId) {
    const r = Battle.deployUnit(ui.deployId, t.x, t.y);
    if (!r.ok) { toast(r.msg); return; }
    ui.deployId = null; ui.sel = r.unit;
    refresh();
    return;
  }
  if (u && u.roster) { ui.sel = u; ui.deployId = u.roster; toast(`再点一个黄色格子重新放置 ${u.name}`); refresh(); return; }
  if (u) { inspectUnit(u); return; }
  ui.sel = null; ui.inspect = null; refresh();
}
function onHover(t) {
  const B = Battle.getB();
  if (!B) return;
  ui.hoverEst = null;
  if (ui.mode === 'select' && ui.sel && ui.reach && t && ui.reach.has(key(t.x, t.y))) {
    R.setHighlights({ hoverPath: pathFrom(ui.reach.get(key(t.x, t.y))) });
  } else R.setHighlights({ hoverPath: null });
  if (t) {
    const u = unitAt(B.units, t.x, t.y);
    if (u && u.side === 'e' && Battle.playerCanSee(u) && ui.sel) {
      const tg = Battle.attackTargets(ui.sel).find(x => x.unit === u);
      if (tg) {
        const est = resolveAttack(ui.sel, u, tg.weapon, Battle._rules.ctxFor(ui.sel, u, tg.weapon, { ambush: !!ui.sel.status.ambush }), () => 0.5);
        ui.hoverEst = { unit: u, cas: est.cas, detail: est.detail };
      }
    }
    renderHint(t, u);
  } else renderHint(null);
}
async function run(fn) {
  ui.busy = true; refresh();
  try { const r = await fn(); if (r && r.ok === false && r.msg) toast(r.msg); return r; }
  catch (e) { console.error(e); toast('出错了：' + e.message); }
  finally { ui.busy = false; }
}
function afterAction() {
  const B = Battle.getB();
  if (!B || B.phase !== 'p') { deselect(); return; }
  const sel = ui.sel;
  if (sel && sel.alive && !sel.offmap) {
    if (sel.acted && sel.moved) { ui.mode = 'idle'; ui.reach = null; R.clearHighlights(); R.setHighlights({ selected: sel }); refresh(); }
    else selectUnit(sel);
  } else deselect();
}
function selectUnit(u) {
  ui.sel = u; ui.inspect = null; ui.mode = 'select';
  ui.reach = (!u.moved && !u.status.tunnel) ? Battle.reachFor(u) : null;
  const targets = u.acted ? [] : Battle.attackTargets(u).map(t => ({ x: t.unit.x, y: t.unit.y }));
  R.clearHighlights();
  R.setHighlights({ reach: ui.reach, targets, selected: u, tactic: [] });
  refresh();
}
function inspectUnit(u) { ui.inspect = u; refresh(); }
function deselect() { ui.sel = null; ui.inspect = null; ui.mode = 'idle'; ui.reach = null; ui.tactic = null; R.clearHighlights(); R.setHighlights({ selected: null }); refresh(); }
function onKey(e) {
  const B = Battle.getB();
  if (!B || $('#battle-screen').classList.contains('hidden')) return;
  if (e.key === 'Escape') { if ($('#modal-root').innerHTML) closeModal(); else deselect(); }
  if ((e.key === 'n' || e.key === 'N' || e.key === 'Tab') && B.phase === 'p') { e.preventDefault(); nextUnit(); }
  if ((e.key === 'e' || e.key === 'E') && B.phase === 'p' && !ui.busy) endTurn();
}
function nextUnit() {
  const B = Battle.getB();
  const list = B.units.filter(u => u.side === 'p' && u.alive && !u.offmap && !(u.acted && u.moved));
  if (!list.length) return toast('所有部队都行动过了');
  const i = ui.sel ? list.indexOf(ui.sel) : -1;
  const u = list[(i + 1) % list.length];
  selectUnit(u); R.centerOn(u.x, u.y);
}
async function endTurn() {
  const B = Battle.getB();
  if (!B || B.phase !== 'p' || ui.busy || B.busy) return;
  const idle = B.units.filter(u => u.side === 'p' && u.alive && !u.offmap && !u.acted && !u.moved).length;
  const go = async () => { closeModal(); deselect(); ui.busy = true; refresh(); try { await Battle.endPlayerTurn(); } finally { ui.busy = false; } refresh(); };
  if (idle >= 3 && B.turn <= 2) openModal({ title: '结束回合？', body: `<p>还有 ${idle} 支部队没有行动。</p>`, actions: [{ label: '再看看', onClick: closeModal }, { label: '结束回合', primary: true, onClick: go }] });
  else go();
}

// ===== 渲染 =====
export function refresh() {
  const B = Battle.getB();
  if (!B || $('#battle-screen').classList.contains('hidden')) return;
  renderTop(B); renderSide(B); renderActions(B); renderLog();
  $('#battle-screen').classList.toggle('busy', !!(ui.busy || B.busy));
  layoutOverlays();
}
// 顶栏/底栏会换行（窄屏），其他浮层的位置跟着它们的实际高度走
function layoutOverlays() {
  const ab = $('#actionbar').offsetHeight, tb = $('#topbar').offsetHeight;
  $('#logstrip').style.bottom = (ab + 6) + 'px';
  $('#log').style.bottom = (ab + 30) + 'px';
  $('#dialog').style.bottom = (ab + 16) + 'px';
  $('#hint').style.top = (tb + 6) + 'px';
  const side = $('#side');
  if (window.innerWidth <= 900) { side.style.bottom = (ab + 30) + 'px'; side.style.top = ''; }
  else { side.style.bottom = ''; side.style.top = (tb + 8) + 'px'; }
}
export function debugStartLevel(n) { return beginLevel(n); }
function renderTop(B) {
  const L = B.level;
  const wp = Battle.winProgress();
  $('#topbar').innerHTML = `
    <div class="tb-left"><b>第${L.num}关 ${L.title}</b><span class="tb-chip">回合 <b>${B.turn}</b>/${L.turns}</span>
      <span class="tb-chip">${B.night ? '🌙 夜晚' : '☀️ 白天'}</span>${B.weather === 'snow' ? '<span class="tb-chip">❄️ 严寒</span>' : ''}
      ${B.phase === 'deploy' ? '<span class="tb-chip warn">部署中</span>' : B.phase === 'e' ? '<span class="tb-chip warn">敌军行动中…</span>' : ''}</div>
    <div class="tb-right">
      <button class="tb-btn" data-cmd="goal" title="任务目标">🎯 ${wp.filter(x => x.ok).length}/${wp.length}</button>
      <button class="tb-btn" data-cmd="log" title="战报">📜</button>
      <button class="tb-btn" data-cmd="menu" title="菜单">☰</button>
    </div>`;
  $$('#topbar [data-cmd]').forEach(b => b.addEventListener('click', () => doCmd(b.dataset.cmd)));
}
function bar(v, cls) { return `<span class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span>`; }
function unitCard(u, B, full) {
  const t = UNIT_TYPES[u.type];
  const tr = terrain(B.map, u.x, u.y);
  const fort = B.forts[u.y]?.[u.x] || 0;
  const w = currentWeapon(u);
  const own = u.side === 'p';
  const next = xpToNext(u);
  let html = `<div class="uc-head"><span class="uc-name" style="border-color:${FACTIONS[u.faction].color}">${t.icon} ${escapeHtml(u.name)}</span>
      <span class="muted small">${t.name} · L${u.level}${own && next != null ? ` <i>(再 ${next} 经验升级)</i>` : ''}</span></div>
    <div class="uc-grid">
      <div>👥 兵力 <b>${effMen(u)}</b>/${u.menMax}${u.wounded ? ` <span class="bad">伤员 ${u.wounded}</span>` : ''}</div>
      <div>💪 士气 <b>${u.morale}</b> ${moraleLabel(u.morale)} ${bar(u.morale, 'morale')}</div>
      <div>💤 疲劳 <b>${u.fatigue}</b> ${fatigueLabel(u.fatigue)} ${bar(u.fatigue, 'fatigue')}</div>
      <div>🔫 弹药 <b>${u.ammo}</b>/${u.ammoMax}${u.stock ? ` · 存货 ${u.stock}` : ''}${u.mines ? ` · 地雷 ${u.mines}` : ''}${u.bridges ? ` · 桥材 ${u.bridges}` : ''}</div>
      <div>🗺️ ${tr.name}${tr.def ? ` 防御 ${Math.round(tr.def * 100)}%` : ''}${fort ? ` · ${FORT[fort].name} ${Math.round(FORT[fort].def * 100)}%` : ''}${tr.height ? ` · 海拔 ${tr.height}` : ''}</div>
      <div>🎯 当前武器 <b>${w.name}</b>（火力 ${w.atk} · 射程 ${w.rmin}${w.rmax !== w.rmin ? '~' + w.rmax : ''} · 耗弹 ${w.ammo}）</div>
    </div>`;
  const st = [];
  if (u.status.ambush) st.push('🌲 埋伏中'); if (u.status.confused) st.push(`🎭 疑兵（${u.status.confused} 回合）`); if (u.status.tunnel) st.push('🕳️ 坑道内');
  if (u.status.march) st.push('🏃 急行军'); if (u.status.nightraid) st.push('🌙 夜袭');
  if (own && B.phase === 'p') st.push(u.moved ? '已移动' : `行动力 ${u.mp}`, u.acted ? '已行动' : '可行动');
  if (st.length) html += `<div class="uc-status">${st.join(' · ')}</div>`;
  if (full && own) {
    html += `<div class="uc-sec"><b>武器</b> ${u.weapons.map((id, i) => `<button class="wbtn ${i === u.weapon ? 'on' : ''}" data-w="${i}" title="${WEAPONS[id].desc || ''}">${WEAPONS[id].name}${WEAPONS[id].ammo > u.ammo ? ' ⚠️' : ''}</button>`).join('')}</div>`;
    if (u.gear.length) html += `<div class="uc-sec"><b>装具</b> ${u.gear.map(g => `<span class="chip">${GEAR[g]?.icon || ''} ${GEAR[g]?.name || g}</span>`).join('')}</div>`;
    if (u.items.length) html += `<div class="uc-sec"><b>物品</b> ${u.items.map((id, i) => `<button class="wbtn" data-item="${i}" title="${ITEMS[id].desc}">${ITEMS[id].icon} ${ITEMS[id].name}</button>`).join('')}</div>`;
    if (u.tactics.length) html += `<div class="uc-sec"><b>策略</b> ${u.tactics.map(id => `<span class="chip" title="${TACTICS[id].desc}">${TACTICS[id].icon} ${TACTICS[id].name}</span>`).join('')}</div>`;
  } else if (!own) {
    html += `<div class="uc-sec muted small">武器：${u.weapons.map(id => WEAPONS[id].name).join('、')}${t.armor ? ` · 装甲 ${Math.round(t.armor * 100)}%` : ''}</div>`;
    if (ui.hoverEst && ui.hoverEst.unit === u) html += `<div class="uc-sec est">预计伤亡约 <b>${ui.hoverEst.cas}</b> 人${ui.hoverEst.detail.length ? '（' + ui.hoverEst.detail.join('，') + '）' : ''}</div>`;
    else if (ui.sel && B.phase === 'p') {
      const tg = Battle.attackTargets(ui.sel).find(x => x.unit === u);
      if (tg) { const est = resolveAttack(ui.sel, u, tg.weapon, Battle._rules.ctxFor(ui.sel, u, tg.weapon, { ambush: !!ui.sel.status.ambush }), () => 0.5); html += `<div class="uc-sec est">用${tg.weapon.name}攻击预计伤亡约 <b>${est.cas}</b> 人${est.detail.length ? '（' + est.detail.join('，') + '）' : ''}</div>`; }
    }
  }
  return html;
}
function renderSide(B) {
  const el = $('#side');
  const u = ui.inspect || ui.sel;
  if (!u) {
    el.classList.add('empty');
    el.innerHTML = B.phase === 'deploy'
      ? `<div class="side-hint">部署阶段：点下方部队，再点黄色格子放置。</div>`
      : `<div class="side-hint">点一支部队查看详情。蓝格：可移动 · 红框：可攻击。</div>`;
    return;
  }
  el.classList.remove('empty');
  el.innerHTML = `<div class="uc">${unitCard(u, B, u.side === 'p' && B.phase !== 'e')}<button class="side-close" data-close>✕</button></div>`;
  $('[data-close]', el).addEventListener('click', () => { if (ui.inspect) { ui.inspect = null; refresh(); } else deselect(); });
  $$('[data-w]', el).forEach(b => b.addEventListener('click', () => { Battle.setWeapon(u, +b.dataset.w); if (ui.sel === u) selectUnit(u); }));
  $$('[data-item]', el).forEach(b => b.addEventListener('click', () => { const r = Battle.useItem(u, +b.dataset.item); if (!r.ok) toast(r.msg); else toast('使用成功'); refresh(); }));
}
function renderActions(B) {
  const el = $('#actionbar');
  if (B.phase === 'deploy') {
    const list = Battle.deployableRoster();
    const deployed = new Set(B.units.filter(u => u.roster).map(u => u.roster));
    el.innerHTML = `<div class="ab-row deploy-row">
      ${list.map(r => `<button class="chip-btn ${deployed.has(r.id) ? 'done' : ''} ${ui.deployId === r.id ? 'on' : ''}" data-dep="${r.id}">${UNIT_TYPES[r.type].icon} ${escapeHtml(r.name)}<i>L${r.level} · ${r.men}人</i></button>`).join('')}
      </div>
      <div class="ab-row">
        <span class="muted small">已部署 ${deployed.size}/${B.level.maxDeploy}</span>
        ${ui.sel && ui.sel.roster ? `<button class="ghost-btn small" data-cmd="undeploy">收回 ${escapeHtml(ui.sel.name)}</button>` : ''}
        <button class="ghost-btn small" data-cmd="autodeploy">⚡ 自动部署</button>
        <button class="primary-btn" data-cmd="start" ${deployed.size ? '' : 'disabled'}>开始战斗 ▶</button>
      </div>`;
    $$('[data-dep]', el).forEach(b => b.addEventListener('click', () => { ui.deployId = ui.deployId === b.dataset.dep ? null : b.dataset.dep; ui.sel = null; refresh(); if (ui.deployId) toast('点黄色格子放置'); }));
    $$('[data-cmd]', el).forEach(b => b.addEventListener('click', () => doCmd(b.dataset.cmd)));
    return;
  }
  if (B.phase !== 'p') { el.innerHTML = `<div class="ab-row"><span class="muted">敌军行动中…</span></div>`; return; }
  const u = ui.sel;
  let btns = '';
  if (u && u.side === 'p' && u.alive) {
    const t = UNIT_TYPES[u.type];
    const can = !u.acted;
    btns += `<button class="ab-btn" data-cmd="tactic" ${can && u.tactics.length ? '' : 'disabled'}>🎯 策略</button>`;
    if (t.medic) btns += `<button class="ab-btn" data-cmd="heal" ${can && Battle.healTargets(u).length ? '' : 'disabled'}>🩺 治疗</button>`;
    if (t.supply) btns += `<button class="ab-btn" data-cmd="supply" ${can && Battle.supplyTargets(u).length ? '' : 'disabled'}>📦 补给</button>`;
    btns += `<button class="ab-btn" data-cmd="rest" ${!u.acted && !u.moved ? '' : 'disabled'}>😴 休息</button>`;
    if (Battle.canRetreat(u)) btns += `<button class="ab-btn" data-cmd="retreat">🏁 撤退</button>`;
    btns += `<button class="ab-btn" data-cmd="hold" ${(u.acted && u.moved) ? 'disabled' : ''}>✅ 待命</button>`;
    btns += `<button class="ab-btn" data-cmd="cancel">✖</button>`;
  } else {
    btns += `<span class="muted small">点一支己方部队开始行动 · N 键切换部队</span>`;
  }
  el.innerHTML = `<div class="ab-row">${btns}<span class="grow"></span>
    <button class="ab-btn" data-cmd="next">⏩ 下一支</button>
    <button class="primary-btn" data-cmd="end">结束回合 ▶</button></div>`;
  $$('[data-cmd]', el).forEach(b => b.addEventListener('click', () => doCmd(b.dataset.cmd)));
}
function renderLog() {
  const el = $('#log');
  const last = ui.logs.slice(-40);
  el.classList.toggle('open', ui.logOpen);
  el.innerHTML = `<div class="log-list">${last.map(l => `<div class="ll ${l.kind}">${escapeHtml(l.text)}</div>`).join('')}</div>`;
  el.scrollTop = el.scrollHeight;
  const strip = $('#logstrip');
  const l = ui.logs[ui.logs.length - 1];
  strip.innerHTML = l ? `<span class="ll ${l.kind}">${escapeHtml(l.text)}</span>` : '';
}
function renderHint(t, u) {
  const B = Battle.getB();
  const el = $('#hint');
  if (!t) { el.classList.add('hidden'); return; }
  const tr = terrain(B.map, t.x, t.y);
  const fort = B.forts[t.y]?.[t.x] || 0;
  const o = B.objs.get(key(t.x, t.y));
  const parts = [`${tr.name}${tr.def ? ` 防 ${Math.round(tr.def * 100)}%` : ''}`];
  if (fort) parts.push(`${FORT[fort].name} ${Math.round(FORT[fort].def * 100)}%`);
  if (o && !(o.kind === 'mine' && o.owner !== 'p' && !o.revealed)) parts.push(o.name || (o.kind === 'mine' ? '地雷' : o.kind === 'wire' ? '铁丝网' : o.kind === 'exit' ? '出口' : ''));
  if (u && Battle.playerCanSee(u)) parts.push(`${u.name} ${effMen(u)}人`);
  if (ui.reach && ui.reach.has(key(t.x, t.y))) parts.push(`消耗 ${ui.reach.get(key(t.x, t.y)).cost}`);
  el.textContent = parts.filter(Boolean).join(' · ');
  el.classList.remove('hidden');
}

// ===== 命令 =====
async function doCmd(cmd) {
  const B = Battle.getB();
  if (!B) return;
  const u = ui.sel;
  switch (cmd) {
    case 'menu': return showMenu();
    case 'goal': return showGoals();
    case 'log': ui.logOpen = !ui.logOpen; renderLog(); return;
    case 'autodeploy': Battle.autoDeploy(); ui.deployId = null; refresh(); return;
    case 'undeploy': if (u) { Battle.undeployUnit(u.uid); ui.sel = null; ui.deployId = null; refresh(); } return;
    case 'start': {
      ui.busy = true;
      const r = await Battle.finishDeploy();
      ui.busy = false;
      if (r && !r.ok) return toast(r.msg);
      ui.mode = 'idle'; ui.deployId = null; ui.sel = null; R.clearHighlights(); R.setHighlights({ deploy: [] });
      log(`第 ${B.turn} 回合开始。${B.night ? '夜色正浓，' : '天亮了，'}点一支部队开始行动。`, 'sys');
      refresh(); autosave();
      return;
    }
    case 'end': return endTurn();
    case 'next': return nextUnit();
    case 'cancel': return deselect();
    case 'hold': if (u) { Battle.hold(u); afterAction(); } return;
    case 'rest': if (u) { const r = Battle.rest(u); if (!r.ok) toast(r.msg); afterAction(); } return;
    case 'heal': if (u) { const r = Battle.heal(u); if (!r.ok) toast(r.msg); afterAction(); } return;
    case 'supply': if (u) { const r = Battle.supplyAction(u); if (!r.ok) toast(r.msg); afterAction(); } return;
    case 'retreat': if (u) { await run(() => Battle.retreat(u)); deselect(); } return;
    case 'tactic': if (u) showTactics(u); return;
  }
}
function showTactics(u) {
  const B = Battle.getB();
  const rows = u.tactics.map(id => {
    const t = TACTICS[id]; const c = Battle.tacticCheck(u, id);
    return `<button class="tac-row ${c.ok ? '' : 'off'}" data-tac="${id}" ${c.ok ? '' : 'disabled'}>
      <span class="tac-name">${t.icon} ${t.name}${t.fatigue ? ` <i class="muted small">疲劳 +${t.fatigue}</i>` : ''}${t.cd ? ` <i class="muted small">冷却 ${t.cd}</i>` : ''}</span>
      <span class="small">${t.desc}</span>${c.ok ? '' : `<span class="small bad">${c.msg}</span>`}</button>`;
  }).join('');
  openModal({ title: `🎯 ${escapeHtml(u.name)} · 策略`, body: `<div class="tac-list">${rows}</div>`, actions: [{ label: '关闭', onClick: closeModal }], wide: true, dismissable: true });
  $$('[data-tac]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.tac; closeModal();
    const t = TACTICS[id];
    if (t.target === 'self') { await run(() => Battle.useTactic(u, id)); afterAction(); return; }
    const list = Battle.tacticTargetList(u, id);
    if (!list.length) return toast('附近没有合适的目标');
    ui.mode = 'tactic'; ui.tactic = id;
    R.setHighlights({ reach: null, targets: [], tactic: list.map(x => ({ x: x.x, y: x.y })), selected: u });
    toast(`选择 ${t.name} 的目标`);
    refresh();
  }));
}
function showGoals() {
  const B = Battle.getB();
  const wp = Battle.winProgress();
  const lose = (B.level.lose || []).map(c => `<li>${Battle.condText(c)}</li>`).join('');
  openModal({ title: '🎯 任务目标', wide: true, body: `<p class="prose">${B.level.goal}</p>
    <h4>胜利条件${B.level.win.any ? '（满足任一）' : '（全部满足）'}</h4><ul class="cond">${wp.map(x => `<li class="${x.ok ? 'ok' : ''}">${x.ok ? '✅' : '⬜'} ${x.text}</li>`).join('')}</ul>
    <h4>失败条件</h4><ul class="cond">${lose}</ul>`, actions: [{ label: '继续', primary: true, onClick: closeModal }], dismissable: true });
}
function showMenu() {
  const B = Battle.getB();
  const head = levelHeadInfo();
  openModal({ title: '☰ 菜单', body: `<div class="menu-list">
      <button class="ghost-btn" data-m="save">💾 存到槽位</button>
      <button class="ghost-btn" data-m="load">📂 读取槽位</button>
      <button class="ghost-btn" data-m="retry" ${head ? '' : 'disabled'}>🔁 重打本关（回到部署前）</button>
      <button class="ghost-btn" data-m="fast">${settings.fast ? '🐢 动画：快速 ✓' : '🐇 动画：正常'}</button>
      <button class="ghost-btn" data-m="help">📘 说明</button>
      <button class="ghost-btn" data-m="title">🏠 回到标题（进度已自动保存）</button>
    </div><p class="muted small" style="margin-top:10px">v${APP_VERSION}</p>`, actions: [{ label: '继续战斗', primary: true, onClick: closeModal }], dismissable: true });
  $$('[data-m]').forEach(b => b.addEventListener('click', () => {
    const m = b.dataset.m; closeModal();
    if (m === 'save') { autosaveNow(); showSlots('save'); }
    if (m === 'load') showSlots('load');
    if (m === 'retry') openModal({ title: '重打本关？', body: '<p>回到本关部署之前的状态，本关的战斗记录会丢失。</p>', actions: [{ label: '取消', onClick: closeModal }, { label: '重打', primary: true, onClick: () => { closeModal(); const r = loadLevelHead(); if (r.ok) { R.closeMap(); Battle.cleanup(); saveGame(); beginLevel(state.level); } else toast('没有关首存档'); } }] });
    if (m === 'fast') { settings.fast = !settings.fast; toast(settings.fast ? '动画加速' : '动画正常'); }
    if (m === 'help') showHelp();
    if (m === 'title') { autosaveNow(); showStart(); }
  }));
}
function autosaveNow() { ui.lastSave = 0; const B = Battle.getB(); if (B && B.phase === 'p') autosave(); else if (B && B.phase === 'deploy') { state.phase = 'briefing'; saveGame(); } }

// ===== 战果 / 整补 =====
async function onBattleEnd(result) {
  const B = Battle.getB();
  const s = result.stats;
  result.rank = result.win ? rankForScore(result.score, B.level.par || 600) : '—';
  await new Promise(r => setTimeout(r, settings.fast ? 200 : 700));
  const body = `
    <div class="result-grid">
      <div class="stat-line"><span>歼敌（毙伤）</span><b>${s.enemyCas}</b></div>
      <div class="stat-line"><span>歼灭敌军部队</span><b>${s.enemyUnitsKilled} 支</b></div>
      <div class="stat-line"><span>我方阵亡 / 受伤</span><b>${s.ownKilled} / ${s.ownWounded}</b></div>
      <div class="stat-line"><span>缴获</span><b>${s.captured.length + s.capturedItems.length + s.treasures} 件</b></div>
      ${s.escaped ? `<div class="stat-line"><span>逃脱的敌军</span><b>${s.escaped} 支</b></div>` : ''}
      ${s.preserved ? `<div class="stat-line"><span>主动撤出的部队</span><b>${s.preserved} 支</b></div>` : ''}
      <div class="stat-line"><span>用时</span><b>${result.turn} / ${B.level.turns} 回合</b></div>
      ${result.win ? `<div class="stat-line big"><span>本关得分</span><b>${result.score} · 评级 ${result.rank}</b></div>` : `<div class="stat-line big bad"><span>失败原因</span><b>${escapeHtml(result.reason || '')}</b></div>`}
    </div>
    <p class="hist">📖 ${B.level.note}</p>`;
  if (result.win) {
    state.pendingResult = { ...result, levelNum: B.level.num };
    settleBattle(B, result);
    state.phase = 'refit'; saveGame();
    openModal({ title: `🎖️ 第 ${B.level.num} 关 · ${B.level.title} · 胜利`, wide: true, body, actions: [{ label: '整补部队 ▶', primary: true, onClick: () => { closeModal(); R.closeMap(); Battle.cleanup(); showRefit(); } }] });
  } else {
    state.battle = null; state.phase = 'briefing'; saveGame();
    openModal({ title: `❌ 第 ${B.level.num} 关 · ${B.level.title} · 失败`, wide: true, body, actions: [
      { label: '回到标题', onClick: () => { closeModal(); showStart(); } },
      { label: '重打本关 ▶', primary: true, onClick: () => { closeModal(); const r = loadLevelHead(); R.closeMap(); Battle.cleanup(); if (r.ok) saveGame(); beginLevel(state.level); } },
    ] });
  }
}
function showRefit() {
  showScreen('campaign-screen');
  const pr = state.pendingResult || {};
  const rows = state.roster.map(r => {
    const t = UNIT_TYPES[r.type];
    return `<tr><td>${t.icon} ${escapeHtml(r.name)}</td><td>${t.name}</td><td>L${r.level}</td>
      <td><b>${r.men}</b>/${t.men}${r.replaced ? ` <span class="good small">+${r.replaced} 补充</span>` : ''}${r.men < t.men * 0.5 ? ' <span class="bad small">残</span>' : ''}</td>
      <td>${r.weapons.map((w, i) => `<span class="chip ${i === r.weapon ? 'on' : ''}">${WEAPONS[w].name}</span>`).join('')}</td>
      <td>${r.gear.map(g => GEAR[g]?.name).join('、')}${r.items.length ? ` · ${r.items.map(i => ITEMS[i]?.icon).join('')}` : ''}</td></tr>`;
  }).join('');
  const armW = state.armory.weapons, armI = state.armory.items;
  const opts = state.roster.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  const armory = `${armW.map((w, i) => `<div class="arm-row"><span>🔫 ${WEAPONS[w].name} <i class="muted small">${WEAPONS[w].desc || ''}</i></span><select data-aw="${i}"><option value="">分配给…</option>${opts}</select></div>`).join('')}
    ${armI.map((it, i) => `<div class="arm-row"><span>${ITEMS[it].icon} ${ITEMS[it].name} <i class="muted small">${ITEMS[it].desc}</i></span><select data-ai="${i}"><option value="">分配给…</option>${opts}</select></div>`).join('')}
    ${!armW.length && !armI.length ? '<p class="muted small">军械库是空的。消灭敌军、拾取缴获品会有收获。</p>' : ''}`;
  const nextNum = Math.min(LAST_LEVEL + 1, (pr.levelNum || state.level) + 1);
  $('#campaign-body').innerHTML = `
    <div class="camp-card wide">
      <p class="eyebrow">整补 · 第 ${pr.levelNum || state.level} 关之后</p>
      <h2>独立一师 花名册</h2>
      <p class="muted small">伤员 70% 归队；被打散的部队按四成兵力重建、降 1 级；胜利后每支部队得到补充兵。缴获的武器和物品在下面分配（每支部队最多带 3 种武器）。</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>部队</th><th>兵种</th><th>等级</th><th>兵力</th><th>武器</th><th>装具 / 物品</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h4>军械库</h4><div class="armory">${armory}</div>
      <div class="stat-line" style="margin-top:12px"><span>累计战功</span><b>${state.totalScore}</b></div>
      <div class="btn-row" style="margin-top:14px">
        <button class="ghost-btn" id="refit-title">‹ 标题</button>
        <button class="primary-btn big" id="refit-go">${nextNum > LAST_LEVEL ? '停战 ▶' : `第 ${nextNum} 关 ▶`}</button>
      </div>
    </div>`;
  $$('[data-aw]').forEach(sel => sel.addEventListener('change', () => {
    const rec = state.roster.find(r => r.id === sel.value); if (!rec) return;
    const w = state.armory.weapons[+sel.dataset.aw];
    if (rec.weapons.includes(w)) return toast('这支部队已经有这种武器了');
    if (rec.weapons.length >= 3) { const old = rec.weapons.shift(); state.armory.weapons.push(old); toast(`${WEAPONS[old].name} 换回军械库`); }
    rec.weapons.push(w); state.armory.weapons.splice(+sel.dataset.aw, 1); saveGame(); showRefit();
  }));
  $$('[data-ai]').forEach(sel => sel.addEventListener('change', () => {
    const rec = state.roster.find(r => r.id === sel.value); if (!rec) return;
    const it = state.armory.items[+sel.dataset.ai];
    if (it === 'cotton') { if (!rec.gear.includes('cotton')) rec.gear.push('cotton'); else return toast('已经有棉衣了'); }
    else rec.items.push(it);
    state.armory.items.splice(+sel.dataset.ai, 1); saveGame(); showRefit();
  }));
  $('#refit-title').addEventListener('click', showStart);
  $('#refit-go').addEventListener('click', () => {
    for (const r of state.roster) delete r.replaced;
    state.pendingResult = null;
    if (nextNum > LAST_LEVEL) { state.phase = 'ending'; saveGame(); showEnding(); }
    else beginLevel(nextNum);
  });
}
function showEnding() {
  showScreen('campaign-screen');
  const total = state.totalScore;
  const cleared = Object.keys(state.cleared).length;
  const rank = total >= 9000 ? '特等功臣' : total >= 6500 ? '一等功' : total >= 4000 ? '二等功' : '三等功';
  const list = LEVELS.map(l => { const c = state.cleared[l.num]; return `<div class="stat-line"><span>第${l.num}关 ${l.title}</span><b>${c ? `${c.score} · ${c.rank}` : '—'}</b></div>`; }).join('');
  $('#campaign-body').innerHTML = `
    <div class="camp-card wide">
      <p class="eyebrow">1953 年 7 月 27 日 · 板门店</p>
      <h2>停战</h2>
      <div class="prose">上午 10 时，停战协定签字。晚上 10 时，前线的枪炮声停了下来。<br><br>
      从两水洞到金城，独立一师跟着志愿军打了整整两年零九个月。${escapeHtml(state.playerName)} 师长，你的部队 ${cleared} 次完成任务，累计战功 <b>${total}</b>，被授予 <b>${rank}</b>。<br><br>
      <i>197653 名志愿军烈士长眠在朝鲜。这个游戏献给他们。</i></div>
      <h4>战绩</h4>${list}
      <div class="btn-row" style="margin-top:18px"><button class="ghost-btn" id="end-levels">🗺️ 关卡选择</button><button class="primary-btn big" id="end-title">回到标题</button></div>
    </div>`;
  $('#end-title').addEventListener('click', showStart);
  $('#end-levels').addEventListener('click', showLevelSelect);
}

// ===== 关卡选择 / 存档 / 说明 =====
function showLevelSelect() {
  if (!state.roster.length) { const r = loadGame(); if (!r.ok) return toast('先开始一个新战役'); }
  const rows = LEVELS.map(l => {
    const locked = l.num > state.unlocked; const c = state.cleared[l.num];
    return `<button class="lvl-row ${locked ? 'locked' : ''} ${l.num === state.level ? 'cur' : ''}" data-lvl="${l.num}" ${locked ? 'disabled' : ''}>
      <span class="lvl-num">${l.num}</span><span class="lvl-title"><b>${l.title}</b><i class="muted small">${l.date} · ${l.place}</i></span>
      <span class="lvl-st">${locked ? '🔒' : c ? `${c.rank} · ${c.score}` : '未通关'}</span></button>`;
  }).join('');
  openModal({ title: '🗺️ 关卡选择', wide: true, body: `<p class="muted small">用当前的独立一师花名册重打任何已解锁的关卡。</p><div class="lvl-list">${rows}</div>`, actions: [{ label: '关闭', onClick: closeModal }], dismissable: true });
  $$('[data-lvl]').forEach(b => b.addEventListener('click', () => { closeModal(); R.closeMap(); Battle.cleanup(); beginLevel(+b.dataset.lvl); }));
}
function showSlots(mode) {
  const slots = listSaveSlots();
  const fmt = (ts) => new Date(ts).toLocaleString('zh-CN', { hour12: false });
  const cards = slots.map((s, i) => `<div class="slot ${s ? '' : 'empty'}">
      <div class="slot-info">${s ? `<b>槽位 ${i + 1}</b> · ${escapeHtml(s.playerName)} · 第 ${s.level} 关${s.inBattle ? ` 第 ${s.turn} 回合` : ''} · 战功 ${s.totalScore}<br><span class="muted small">${fmt(s.savedAt)}</span>` : `<b>槽位 ${i + 1}</b> <span class="muted">空</span>`}</div>
      <div class="slot-btns">
        ${mode === 'save' ? `<button class="primary-btn small" data-op="save" data-slot="${i + 1}">存到这里</button>` : `<button class="primary-btn small" data-op="load" data-slot="${i + 1}" ${s ? '' : 'disabled'}>读取</button>`}
        <button class="ghost-btn small" data-op="del" data-slot="${i + 1}" ${s ? '' : 'disabled'}>删除</button>
      </div></div>`).join('');
  openModal({ title: mode === 'save' ? '💾 存档' : '📂 读取存档', wide: true, body: `<div class="slots">${cards}</div>`, actions: [{ label: '关闭', onClick: closeModal }], dismissable: true });
  $$('[data-op]').forEach(b => b.addEventListener('click', () => {
    const slot = +b.dataset.slot, op = b.dataset.op;
    if (op === 'save') { if (!state.roster.length) return toast('没有可保存的进度'); saveToSlot(slot); toast('已存档'); showSlots('save'); }
    if (op === 'del') { deleteSlot(slot); showSlots(mode); }
    if (op === 'load') { const r = loadFromSlot(slot); if (!r.ok) return toast('读取失败'); closeModal(); saveGame(); R.closeMap(); Battle.cleanup(); resumeFromState(); }
  }));
}
function showHelp() {
  const terr = Object.values(TERRAIN).filter(t => t.id !== 'cliff').map(t => `<tr><td><span class="sw" style="background:${t.color}"></span>${t.name}</td><td>${t.def ? Math.round(t.def * 100) + '%' : '—'}</td><td>${t.cost.foot >= 99 ? '✕' : t.cost.foot}</td><td>${t.height || 0}</td><td>${t.hide ? '可埋伏' : ''}${t.shelter ? '避寒' : ''}${t.water ? '涉水' : ''}</td></tr>`).join('');
  const units = Object.values(UNIT_TYPES).filter(t => t.side === 'p').map(t => `<tr><td>${t.icon} ${t.name}</td><td>${t.men}</td><td>${t.mp}</td><td>${t.weapons.map(w => WEAPONS[w].name).join('、')}</td><td class="small">${t.desc}</td></tr>`).join('');
  const tacs = Object.values(TACTICS).map(t => `<li><b>${t.icon} ${t.name}</b>：${t.desc}</li>`).join('');
  openModal({ title: '📘 玩法说明', wide: true, cls: 'help', dismissable: true, body: `
    <h4>一回合怎么打</h4>
    <ul class="tips">
      <li>点一支己方部队：蓝格是能走到的地方，红框是能打的敌人。走完还能打一次，打完就不能走了。</li>
      <li>每支部队有<b>人数</b>（伤员不能作战，卫生队能治）、<b>士气</b>（低了打不动，被包围会掉）、<b>疲劳</b>（攻击 +5、急行军 +10，超过 50 战力下降，休息 −25）、<b>弹药</b>（步枪 1 发、冲锋枪 2 发，打光只能拼刺刀，运输队和补给点能补）。</li>
      <li>夜里志愿军攻击 +25%、敌军 −20%，敌机不出动；白天暴露在开阔地的部队会被空袭，树林和坑道里安全。</li>
      <li>居高临下 +20%；从多个方向包围敌人有加成；工事 壕沟 40% / 沙包 60% / 掩体 80%。</li>
      <li>消灭敌军有机会缴获美式武器；走到 🎁 拾取物资；战后在"整补"里分配。</li>
      <li>快捷键：N 下一支部队 · E 结束回合 · Esc 取消。鼠标滚轮/双指缩放地图，拖动平移。</li>
    </ul>
    <h4>地形</h4><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>地形</th><th>防御</th><th>徒步消耗</th><th>海拔</th><th></th></tr></thead><tbody>${terr}</tbody></table></div>
    <h4>我方兵种</h4><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>兵种</th><th>人数</th><th>行动</th><th>武器</th><th></th></tr></thead><tbody>${units}</tbody></table></div>
    <h4>策略</h4><ul class="tips">${tacs}</ul>`, actions: [{ label: '知道了', primary: true, onClick: closeModal }] });
}
