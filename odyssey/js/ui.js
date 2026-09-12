// UI 外壳：开始菜单 / 顶部资源条 / 侧栏面板（牌组·同伴·记事本）/ 模态 / 存档界面 /
// 章节流程（章首 → VN → 战斗或谜题 → 章末结算 → 下一章）。
// 分工沿用仓库惯例：场景走 canvas，面板与文本走 DOM + innerHTML。
import {
  state, APP_VERSION, NUM_SLOTS, initNewGame, saveGame, loadGame, hasSave,
  saveToSlot, loadFromSlot, deleteSlot, listSaveSlots,
  loadChapterHead, chapterHeadInfo, addLog, aliveCompanions, isStarving,
} from './state.js';
import {
  bindUI as bindStoryUI, applyAct, startChapter, nextChapterNum,
  rewardChoices, takeReward, chapterSummary, finalEnding, wrathInDeck,
} from './story.js';
import { CHAPTERS, CHAPTER_BY_NUM, LAST_CHAPTER } from './data/chapters.js';
import { CARDS, COLORS } from './data/cards.js';
import { COMPANIONS } from './data/companions.js';
import { NOTES } from './data/notes.js';
import { ENDINGS } from './data/endings.js';
import { groupDeck } from './deck.js';
import { cardHTML, paintCardArts } from './art/card.js';
import { drawHeadshot } from './art/portrait.js';
import { charById } from './data/characters.js';
import * as VN from './vn.js';
import * as Battle from './battle.js';
import * as Puzzle from './puzzle.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ===== 模态 / 提示 =====
export function openModal({ title, body, actions = [], wide = false, dismissable = false }) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-mask"></div>
    <div class="modal${wide ? ' wide' : ''}">
      <h2>${title}</h2>
      <div class="modal-body">${body}</div>
      <div class="modal-actions">
        ${actions.map((a, i) => `<button class="${a.primary ? 'primary-btn' : 'ghost-btn'}" data-i="${i}">${a.label}</button>`).join('')}
      </div>
    </div>`;
  paintCardArts(root);
  $$('.modal-actions button', root).forEach((btn, i) => {
    btn.addEventListener('click', () => actions[i].onClick && actions[i].onClick());
  });
  if (dismissable) $('.modal-mask', root).addEventListener('click', closeModal);
}
export function closeModal() { $('#modal-root').innerHTML = ''; }

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

// ===== 资源变化演出 =====
// 逐条弹出，全部播完再回调——玩家必须看清自己刚刚付出了什么代价。
export function showEffects(fx, done) {
  const layer = $('#fx-layer');
  layer.innerHTML = '';
  let i = 0;
  const step = () => {
    if (i >= fx.length) {
      setTimeout(() => { layer.innerHTML = ''; done?.(); }, 520);
      return;
    }
    const f = fx[i++];
    const el = document.createElement('div');
    el.className = `fx-item ${f.good ? 'good' : 'bad'}${f.big ? ' big' : ''}`;
    el.innerHTML = `${f.icon} ${f.text}`;
    layer.appendChild(el);
    setTimeout(step, f.big ? 900 : 560);
  };
  step();
}

// ===== 顶部资源条 =====
export function refreshHud() {
  const ch = CHAPTER_BY_NUM[state.chapter];
  const p = state.player;
  const starve = isStarving();
  const w = wrathInDeck();
  // 一行章节名 + 一行资源。窄屏（iPad 竖屏）上第二行会自动换行，所以每个 chip 都尽量短。
  $('#hud').innerHTML = `
    <div class="hud-row hud-title"><span class="hud-ch">${ch ? ch.title : '尾声'}</span></div>
    <div class="hud-row small">
      <span class="hud-chip hud-crew" title="船员">⚓<b>${state.crew}</b></span>
      <span class="hud-chip" title="船">⛵<b>${state.ships}</b></span>
      <span class="hud-chip hud-supply" title="补给">🍞<b>${state.supply}</b>${starve ? '<i style="color:#e58a6a">饿</i>' : ''}</span>
      <span class="hud-chip hud-endure" title="忍耐">🜃<b>${p.endure}/${p.endureMax}</b></span>
      <span class="hud-chip hud-kleos" title="名声">🏛️<b>${state.kleos}</b></span>
      <span class="hud-chip hud-hubris" title="傲慢">👑<b>${state.hubris}</b>
        <span class="hud-bar"><i style="width:${Math.min(100, state.hubris)}%"></i></span></span>
      <span class="hud-chip" title="牌组">🃏<b>${state.deck.length}</b>${w ? `<i style="color:#c9a0e8">+${w}怒</i>` : ''}</span>
    </div>`;
}

// ===== 侧栏面板 =====
let panelOpen = null;
function closePanel() { $('#panel').classList.add('hidden'); panelOpen = null; }
function openPanel(kind) {
  if (panelOpen === kind) return closePanel();
  panelOpen = kind;
  const el = $('#panel');
  el.classList.remove('hidden');
  el.innerHTML = { deck: deckPanel, crew: crewPanel, journal: journalPanel }[kind]();
  paintCardArts(el);
  $('#panel-close', el)?.addEventListener('click', closePanel);
  $$('.note-item', el).forEach(b => b.addEventListener('click', () => {
    const n = NOTES[b.dataset.id];
    openModal({ title: `${n.icon} ${n.title}`, wide: true,
      body: `<div style="line-height:2.05">${n.text}</div>`,
      actions: [{ label: '合上', primary: true, onClick: closeModal }], dismissable: true });
  }));
}

function panelHead(title) {
  return `<div class="panel-head"><h2>${title}</h2><button class="ghost-btn small" id="panel-close">✕</button></div>`;
}

function deckPanel() {
  const groups = groupDeck(state.deck);
  const wrath = wrathInDeck();
  const lost = state.exiled.map(id => CARDS[id]).filter(Boolean);
  return `${panelHead('🃏 牌组')}
    <p class="muted">共 <b>${state.deck.length}</b> 张${wrath ? ` · 其中 <b style="color:#5b2a3e">${wrath}</b> 张神怒牌（占手牌，只能用金色的忍耐牌净化）` : ''}。
      每场战斗开局都会把整副牌洗开。</p>
    <div class="pill-row">${Object.entries(COLORS).map(([k, v]) =>
      `<span class="tag" style="background:var(--c-${k === 'companion' ? 'comp' : k},rgba(36,31,51,.1))">${v.name} ${v.greek}</span>`).join('')}</div>
    <h3>当前牌组</h3>
    <div class="card-grid-mini">
      ${groups.map(g => cardHTML(g.card, { count: g.n })).join('')}
    </div>
    ${lost.length ? `<h3>已经永远失去的</h3>
      <p class="muted">这些牌不会再回来了。</p>
      <div class="card-grid-mini" style="opacity:.55">${lost.map(c => cardHTML(c)).join('')}</div>` : ''}`;
}

function crewPanel() {
  return `${panelHead('⚓ 同伴')}
    <p class="muted">六百个人从特洛伊出发。有名字的只有四个——他们各是你牌组里的一张牌。
      他们死了，那张牌就永久移出牌组。</p>
    <div class="stat-line"><span>还活着的船员</span><b>${state.crew} 人</b></div>
    <div class="stat-line"><span>还剩下的船</span><b>${state.ships} 条</b></div>
    ${COMPANIONS.map(c => {
      const st = state.companions[c.id];
      const dead = st === 'dead';
      return `<h3>${c.icon} ${c.name}
        <span class="tag ${dead ? 'dead' : 'alive'}">${dead ? '已阵亡' : '在船上'}</span></h3>
        <p class="muted">${c.bio}</p>
        ${dead ? `<p class="muted" style="color:#8a3a2a">🕯️ ${c.death}</p>` : ''}
        <p class="muted" style="font-size:12.5px;opacity:.85">💡 保住他的条件：${c.savedIf}</p>`;
    }).join('')}`;
}

function journalPanel() {
  const got = Object.values(NOTES).filter(n => state.notes.includes(n.id));
  const rest = Object.values(NOTES).length - got.length;
  return `${panelHead('📖 记事本')}
    <h3>神话笔记（${got.length} / ${Object.values(NOTES).length}）</h3>
    <p class="muted">每走过一段路，就会记下一条真的东西。点开看全文。</p>
    ${got.map(n => `<button class="puz-opt note-item" data-id="${n.id}"
        style="color:var(--ink);background:rgba(36,31,51,.06);border-color:rgba(36,31,51,.25)">
        <b>${n.icon} ${n.title}</b></button>`).join('') || '<p class="muted">还没有记下任何东西。</p>'}
    ${rest ? `<p class="muted" style="margin-top:10px">还有 ${rest} 条没有解锁。</p>` : ''}
    ${state.prophecy.length ? `<h3>🕯️ 提瑞西阿斯的预言</h3>
      ${state.prophecy.map(p => `<p class="muted">${p}</p>`).join('')}` : ''}
    <h3>航海日志</h3>
    ${state.log.slice(0, 20).map(l => `<p class="muted">· ${escapeHtml(l.text)}</p>`).join('') || '<p class="muted">空的。</p>'}`;
}

// ===== 章节流程 =====
async function beginChapter(n) {
  closePanel();
  // 第 13 章是尾声：走 ep 脚本，脚本最后一个节点再交给结局判定
  if (n > LAST_CHAPTER) {
    state.chapter = n; saveGame(); refreshHud();
    return VN.openVN('ep');
  }
  startChapter(n);
  const ch = CHAPTER_BY_NUM[n];
  refreshHud();
  openModal({
    title: ch.title, wide: true,
    body: `<p class="muted" style="letter-spacing:.16em;font-size:12px;color:#8a7c68">${ch.place}</p>
      <div style="line-height:2.05;margin:12px 0 16px">${ch.intro}</div>
      <div style="background:rgba(36,31,51,.07);border-left:4px solid var(--terra);border-radius:0 8px 8px 0;padding:10px 14px">
        <b>本章目标</b><br>${ch.goal}</div>`,
    actions: [{ label: '开始 ▶', primary: true, onClick: () => { closeModal(); VN.openVN(ch.script); } }],
  });
}

function endChapter() {
  // 船员归零 / 傲慢满 100 是即死条件——不能拖到尾声才告诉玩家
  if (state.gameOver && state.ending) return showEnding(state.ending);
  const s = chapterSummary();
  const ch = CHAPTER_BY_NUM[state.chapter];
  const body = `
    <p class="muted" style="line-height:1.9">${ch?.note || ''}</p>
    <h3 style="margin:14px 0 8px;color:var(--terra2)">这一章之后</h3>
    <div class="stat-line"><span>⚓ 船员</span><b>${s.crew}</b></div>
    <div class="stat-line"><span>⛵ 船</span><b>${s.ships}</b></div>
    <div class="stat-line"><span>🍞 补给</span><b>${s.supply}</b></div>
    <div class="stat-line"><span>🏛️ 名声</span><b>${s.kleos}</b></div>
    <div class="stat-line"><span>👑 傲慢</span><b>${s.hubris}</b>　<span class="muted">（到 ${s.nextWrathAt} 会再混进一张神怒牌）</span></div>
    <div class="stat-line"><span>🃏 牌组</span><b>${s.deck} 张</b>${s.wrath ? `　<span style="color:#8a3a2a">神怒 ${s.wrath}</span>` : ''}</div>
    <div class="stat-line"><span>还在船上的同伴</span><b>${s.alive.join('、') || '一个也没有了'}</b></div>
    ${s.lost.length ? `<div class="stat-line"><span>已经失去的</span><b style="color:#8a3a2a">${s.lost.join('、')}</b></div>` : ''}`;
  openModal({
    title: `⚓ ${ch ? ch.title : ''} · 战利与代价`, wide: true, body,
    actions: [{ label: '挑一张计谋牌 ▶', primary: true, onClick: showReward }],
  });
}

function showReward() {
  const picks = rewardChoices();
  openModal({
    title: '🃏 这一路上你学到了什么', wide: true,
    body: `<p class="muted">三选一，加进牌组。牌组会跟着你走完全程。</p>
      <div class="card-grid-mini" style="margin-top:12px">${picks.map((c, i) =>
        cardHTML(c, { idx: i, cls: 'pickable' })).join('')}</div>`,
    actions: [],
  });
  $$('#modal-root .card').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      takeReward(el.dataset.card);
      closeModal();
      toast(`「${CARDS[el.dataset.card].name}」加入了牌组。`);
      refreshHud();
      beginChapter(nextChapterNum());
    });
  });
}

function showEnding(id) {
  if (!id || id === 'AUTO') id = finalEnding();
  const e = ENDINGS[id] || ENDINGS.ALONE;
  state.gameOver = true; state.ending = id; saveGame();
  VN.closeVN(); VN.stopLoop();
  closePanel();
  const s = chapterSummary();
  openModal({
    title: `${e.icon} ${e.title}`, wide: true,
    body: `<p class="muted" style="letter-spacing:.2em;font-size:12px">${e.kind}结局</p>
      <div style="line-height:2.1;margin:14px 0">${e.text}</div>
      <div style="background:rgba(36,31,51,.07);border-radius:10px;padding:12px 16px;margin-top:14px">
        <div class="stat-line"><span>带回伊塔卡的人</span><b>${s.crew}</b></div>
        <div class="stat-line"><span>🏛️ 名声</span><b>${s.kleos}</b></div>
        <div class="stat-line"><span>👑 傲慢</span><b>${s.hubris}</b></div>
        <div class="stat-line"><span>还活着的同伴</span><b>${s.alive.join('、') || '没有'}</b></div>
        <div class="stat-line"><span>📖 神话笔记</span><b>${state.notes.length} / ${Object.keys(NOTES).length}</b></div>
      </div>
      <p class="muted" style="margin-top:14px">📜 ${e.note}</p>`,
    actions: [
      { label: '回到标题', primary: true, onClick: () => { closeModal(); showStart(); } },
    ],
  });
}

// ===== VN 宿主：战斗 / 谜题 / 章末 =====
function hostStartBattle(node) {
  Battle.startBattle({
    enemyId: node.battle, bg: node.bg || state.scene,
    onDone: (res) => {
      $('#battle-screen').classList.add('hidden');
      const act = res.win ? (res.lethal ? node.killAct : node.yieldAct) : node.loseAct;
      // 非致命胜利的默认回报：少涨傲慢，多涨名声。杀掉则相反。
      const auto = res.win
        ? (res.lethal ? { hubris: 4, kleos: 3, bie: 0 } : { kleos: 6, athena: 1 })
        : { crew: -12, supply: -5 };
      const merged = { ...auto, ...(act || {}) };
      const fx = applyAct(merged);
      refreshHud();
      const goto = () => {
        const key = res.win ? (res.lethal ? (node.killNext || node.winNext) : (node.yieldNext || node.winNext)) : node.loseNext;
        VN.goto(key || node.winNext || node.next);
      };
      const def = res.enemy;
      openModal({
        title: res.win ? (res.lethal ? '⚔️ 你赢了' : '🕊️ 他退了') : '💀 你倒下了',
        body: `<div style="line-height:2">${res.win ? (res.lethal ? def.killText : (res.fled ? '你们脱离了。' : def.yieldText)) : '你被打倒在地。有人把你拖回了船上——代价是几个弟兄。'}</div>
          ${def.note ? `<p class="muted" style="margin-top:12px">📜 ${def.note}</p>` : ''}
          ${res.win && !res.lethal ? '<p class="muted" style="margin-top:10px">💡 不杀而胜：<b>名声更高，傲慢更低</b>。这一路上，这几乎总是更划算的那条路。</p>' : ''}`,
        actions: [{ label: '继续 ▶', primary: true, onClick: () => {
          closeModal();
          if (fx.length) showEffects(fx, goto); else goto();
        } }],
      });
    },
  });
}

function hostStartPuzzle(node) {
  Puzzle.startPuzzle({
    puzzleId: node.puzzle,
    onDone: (res) => {
      // 每个谜题自动落两个旗标，剧本里可以直接用条件分支引用，
      // 不用为每道题在节点上再配一遍。
      state.flags[`puzzle_${node.puzzle}_ok`] = !!res.ok;
      if (res.perfect) state.flags[`puzzle_${node.puzzle}_perfect`] = true;
      // 谜题自己算出来的奖励（讲述评级的赠礼、忠诚判断拉到的帮手）也一并结算
      const bonus = {};
      if (res.kleos) bonus.kleos = res.kleos;
      if (res.gift) bonus.supply = res.gift;
      if (res.allies) bonus.crew = res.allies;
      const act = res.ok ? node.okAct : node.failAct;
      const fx = [...applyAct(bonus), ...(act ? applyAct(act) : [])];
      refreshHud();
      const go = () => VN.goto((res.ok ? node.okNext : node.failNext) || node.okNext || node.next);
      if (fx.length) showEffects(fx, go); else go();
    },
  });
}

// ===== 存档界面 =====
function showSlots(mode) {
  const slots = listSaveSlots();
  const head = chapterHeadInfo();
  const body = `
    <p class="muted">${mode === 'save' ? '选一个位置存档。' : '选一个存档读取。'}</p>
    ${slots.map((s, i) => {
      const n = i + 1;
      if (!s) return `<div class="stat-line"><span>存档 ${n}</span>
        <span>${mode === 'save' ? `<button class="ghost-btn small" data-save="${n}">存入</button>` : '<i class="muted">空</i>'}</span></div>`;
      const ch = CHAPTER_BY_NUM[s.chapter];
      return `<div class="stat-line">
        <span><b>存档 ${n}</b>　${ch ? ch.title : '尾声'}　<i class="muted">⚓${s.crew} · 🃏${s.deck}</i></span>
        <span>
          ${mode === 'save' ? `<button class="ghost-btn small" data-save="${n}">覆盖</button>` : `<button class="ghost-btn small" data-load="${n}">读取</button>`}
          <button class="ghost-btn small" data-del="${n}">删</button>
        </span></div>`;
    }).join('')}
    ${head && mode === 'load' ? `<h3 style="margin-top:14px">章首档</h3>
      <p class="muted">每章开头会自动存一份，可以退回本章重打。战斗和谜题中途不能读档——
      这一作的难度全在跨章的资源连锁上，中途反悔就没意义了。</p>
      <div class="stat-line"><span><b>${CHAPTER_BY_NUM[head.chapter]?.title || ''}</b> 开头　<i class="muted">⚓${head.crew}</i></span>
        <span><button class="ghost-btn small" data-head="1">回到本章开头</button></span></div>` : ''}`;
  openModal({
    title: mode === 'save' ? '📂 存档' : '📂 读取', wide: true, body,
    actions: [{ label: '关闭', onClick: closeModal }], dismissable: true,
  });
  $$('#modal-root [data-save]').forEach(b => b.addEventListener('click', () => {
    saveToSlot(+b.dataset.save); closeModal(); toast('已存档。');
  }));
  $$('#modal-root [data-load]').forEach(b => b.addEventListener('click', () => {
    const r = loadFromSlot(+b.dataset.load);
    if (!r.ok) return toast(r.reason === 'version' ? '存档来自旧版本，读不了。' : '这个存档读不出来。');
    closeModal(); resumeFromState();
  }));
  $$('#modal-root [data-del]').forEach(b => b.addEventListener('click', () => {
    deleteSlot(+b.dataset.del); closeModal(); showSlots(mode);
  }));
  $$('#modal-root [data-head]').forEach(b => b.addEventListener('click', () => {
    const r = loadChapterHead();
    if (!r.ok) return toast('没有章首档。');
    closeModal(); beginChapter(state.chapter);
  }));
}

function showMenu() {
  openModal({
    title: '☰ 菜单', dismissable: true,
    body: `<p class="muted">当前：${CHAPTER_BY_NUM[state.chapter]?.title || '尾声'}</p>`,
    actions: [
      { label: '📂 存档', onClick: () => { closeModal(); showSlots('save'); } },
      { label: '📖 读取', onClick: () => { closeModal(); showSlots('load'); } },
      { label: '↩ 回到本章开头', onClick: () => {
        closeModal();
        const r = loadChapterHead();
        if (!r.ok) return toast('没有章首档。');
        beginChapter(state.chapter);
      } },
      { label: '🏠 回到标题', onClick: () => { closeModal(); showStart(); } },
      { label: '继续', primary: true, onClick: closeModal },
    ],
  });
}

// ===== 启动 =====
function showStart() {
  VN.closeVN(); VN.stopLoop();
  closePanel();
  $('#battle-screen').classList.add('hidden');
  $('#puzzle-screen').classList.add('hidden');
  $('#start-screen').hidden = false;
  $('#game-screen').hidden = true;
  $('#btn-continue').disabled = !hasSave();
}

function showGame() {
  $('#start-screen').hidden = true;
  $('#game-screen').hidden = false;
  refreshHud();
  VN.startLoop();
}

// 读档后回到正确的位置：有节点就跳回那个节点，否则从本章开头走
function resumeFromState() {
  showGame();
  if (state.gameOver && state.ending) return showEnding(state.ending);
  const ch = CHAPTER_BY_NUM[state.chapter];
  if (!ch) return showEnding(finalEnding());
  if (state.node) VN.openVN(ch.script, state.node).catch(() => beginChapter(state.chapter));
  else beginChapter(state.chapter);
}

export function boot() {
  $('#version').textContent = 'v' + APP_VERSION;
  bindStoryUI({ toast, openModal, closeModal });
  VN.bindHost({
    startBattle: hostStartBattle,
    startPuzzle: hostStartPuzzle,
    endChapter, showEnding, showEffects, refreshHud,
    missingChapter: (n) => openModal({
      title: '🚧 这一章还在建造中',
      body: `<p style="line-height:2">第 ${n} 章的剧本还没写完。<br>先跳到下一章继续。</p>`,
      actions: [{ label: '好', primary: true, onClick: () => { closeModal(); beginChapter(nextChapterNum()); } }],
    }),
  });
  Battle.bindHost({
    toast,
    showPile: (title, ids) => {
      const g = groupDeck(ids);
      openModal({ title, wide: true, dismissable: true,
        body: g.length ? `<div class="card-grid-mini">${g.map(x => cardHTML(x.card, { count: x.n })).join('')}</div>`
                       : '<p class="muted">空的。</p>',
        actions: [{ label: '关上', primary: true, onClick: closeModal }] });
    },
  });
  Puzzle.bindHost({ toast, openModal, closeModal });

  $('#btn-new').addEventListener('click', () => {
    initNewGame(); saveGame(); showGame(); beginChapter(0);
  });
  $('#btn-continue').addEventListener('click', () => {
    const r = loadGame();
    if (!r.ok) return toast(r.reason === 'version' ? '存档来自旧版本，读不了。请开新局。' : '没有可用的存档。');
    resumeFromState();
  });
  $('#btn-slots').addEventListener('click', () => showSlots('load'));
  $('#btn-deck').addEventListener('click', () => openPanel('deck'));
  $('#btn-crew').addEventListener('click', () => openPanel('crew'));
  $('#btn-journal').addEventListener('click', () => openPanel('journal'));
  $('#btn-menu').addEventListener('click', showMenu);

  // 点画面推进对话；点到 UI 上不算
  $('#game-screen').addEventListener('click', (ev) => {
    if (ev.target.closest('.vn-choice, .topbar, .panel, .modal, #hud')) return;
    VN.advance();
  });
  document.addEventListener('keydown', (ev) => {
    if ($('#game-screen').hidden) return;
    if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); VN.advance(); }
    if (ev.key === 'Escape') { closeModal(); closePanel(); }
  });

  showStart();
}
