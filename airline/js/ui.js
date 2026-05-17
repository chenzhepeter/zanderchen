import {
  state, getPlayer, saveGame, loadGame, hasSave, clearSave, initNewGame,
  saveToSlot, loadFromSlot, deleteSlot, listSaveSlots, NUM_SLOTS, APP_VERSION, SAVE_VERSION,
  DIFFICULTY,
  logPlayerAction, clearTurnActions, routeIsModified,
} from './state.js';
import { CITIES, CITY_BY_ID, distanceKm } from './data/cities.js';
import { AIRCRAFT, AIRCRAFT_BY_ID } from './data/aircraft.js';
import { AIRLINES } from './data/airlines.js';
import { EVENTS } from './data/events.js';
import {
  advanceQuarter, applyChoiceOption,
  buyAircraft, sellAircraft, openRoute, closeRoute,
  assignAircraftToRoute, setFare,
  applyForLanding, computeBreakEvenFare,
  cityRouteSlots, routesAtCity,
  fleetMaintDiscountInfo, describeEvent,
  quarterSeatCapacity,
  peekUpcomingEvents,
} from './sim.js';
import { runAiTurn, runAiChoicesForEvent } from './ai.js';
import { buildMapSvg, drawMapContents } from './map.js';
import { computeCompetition, computeRecommendations } from './intel.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let currentTab = 'routes';
let cityTabSort = { col: 'region', dir: 'asc' };
let routeTabSort = { col: 'pair', dir: 'asc' };  // pair / dist / profit / load / fare
let intelSelectedCompetitor = null;  // 选中的对手 airline id

// === 术语词典（点 (?) 时弹出解释，引用 sim.js 真实常量） ===
const GLOSSARY = {
  'breakeven': {
    title: '盈亏平衡价 (Break-even Fare)',
    body: '<p>每位乘客的票价至少要覆盖该航段的成本，才不亏损。</p><p><b>公式：</b><br>盈亏价 ≈ 距离 × 0.018 × 油价系数 + 25 + (起点星级 + 终点星级) × 2</p><p>第一项是每座油费 (0.03 升 × 60%平均载客 × 距离 × 当前油价)，第二项是固定服务+起降费。距离越长、油价越高、城市越大，盈亏价越高。</p><p><b>系统默认推荐 = 盈亏价 × 2.0（50% 毛利）</b>。</p>',
  },
  'loadFactor': {
    title: '载荷率 (Load Factor)',
    body: '<p>本季实际载客 ÷ 总运力。例如总座位 10000，载了 7500 人，载荷 75%。</p><p>载荷 &gt; 90% 通常意味着供不应求，可以涨价或加运力；载荷 &lt; 40% 意味着竞争太激烈或票价虚高。</p>',
  },
  'prestige': {
    title: '声望 (Prestige)',
    body: '<p>抽象的"品牌强度"，初始 50–70。声望越高，同条件下航线吸引力越强（公式里 prestigeBoost = 1 + (prestige - 50) × 0.0018）。</p><p>声望来自：事件选择 (9/11 投入安保 +5)、玩家行动（人道援助）、永久 prestigePerQuarter buff。空难类事件会减声望。</p>',
  },
  'marketShare': {
    title: '市场份额 (Market Share)',
    body: '<p>在同一城市对（如 PEK-LHR）上，多家航司共享一个固定大小的市场。每家拿走的份额 = 自家吸引力 ÷ 全部吸引力之和。</p><p>吸引力 = (运力 × 价格力 × 声望系数)<sup>1.6</sup>，详见"马太效应"。</p>',
  },
  'elasticity': {
    title: '价格弹性 (Price Elasticity, 指数 1.8)',
    body: '<p>价格力 = (基准票价 ÷ 当前票价)<sup>1.8</sup>。指数为 1.8 时，涨价 10% 价格力 ≈ ×0.84（损失约 16% 吸引力）；降价 10% 价格力 ≈ ×1.20（多 20% 吸引力）。</p><p><b>含义：高价对需求是指数级抑制，低价是指数级放大。</b></p>',
  },
  'matthew': {
    title: '马太效应 (Network Effects, 指数 1.6)',
    body: '<p>最终吸引力 = (运力 × 价格力 × 声望)<sup>1.6</sup>。指数 &gt; 1 意味着小优势被放大。</p><p>例：两家航司原始吸引力 100 vs 120。开根方放大后：100^1.6=1585，120^1.6=1990。份额从 45.5/54.5 变成 44.3/55.7 — 强者吃更多。</p>',
  },
  'distance': {
    title: '距离系数 (Distance Factor)',
    body: '<p>市场容量按距离分段缩放：&lt; 500km × 0.5（短途铁路替代）；500–1500km × 1.0；1500–5000km × 1.10（黄金距离）；5000–10000km × 0.95；&gt;10000km × 0.85（超远长程）。</p><p>含义：1500–5000km 的"中长航线"市场最大，性价比最高。</p>',
  },
  'season': {
    title: '季节性 (Seasonality)',
    body: '<p>Q2、Q3 (夏季旅游旺季)：×1.10；Q1、Q4 (淡季)：×0.92。所有航线统一应用。</p>',
  },
  'fuelMult': {
    title: '油价倍率',
    body: '<p>初始 1.00×。受事件影响：伊战 (+30%, 8季)、2008 油价峰 (+50%, 3季)、2014 油价崩 (×0.5, 8季)、俄乌冲突 (+40%, 6季)、SAF 强制令 (+8%, 永久)。多倍率叠乘。</p><p>每架飞机的油耗 fuelPerSeatKm 是固定的；油价倍率改变的是单位油费支出。</p>',
  },
};

function glossaryBtn(termKey) {
  return `<button class="term-help" data-term="${termKey}" type="button" aria-label="术语解释">?</button>`;
}

function showGlossary(termKey) {
  const g = GLOSSARY[termKey];
  if (!g) return;
  openModal({
    title: `📖 ${g.title}`,
    body: g.body,
    actions: [{ label: '了解了', primary: true, onClick: closeModal }],
  });
}

// 全局事件代理：任何 .term-help 点击都触发 glossary
document.addEventListener('click', e => {
  const t = e.target.closest('.term-help');
  if (t) { e.preventDefault(); showGlossary(t.dataset.term); }
});

export function bootUi() {
  buildShell();
  showStartMenu();
}

function buildShell() {
  const app = $('#app');
  app.innerHTML = `
    <div id="start-screen" class="screen"></div>
    <div id="game-screen" class="screen" hidden>
      <header id="top-bar" class="top-bar">
        <button id="menu-btn" class="menu-btn" aria-label="菜单">⚙️</button>
        <button id="end-turn-btn" class="primary-btn end-turn-top">结束季度 →</button>
        <button id="ff-btn" class="ghost-btn end-turn-top" title="若未来 2 季无事件、玩家本季未操作，则连续推进" hidden>⏩ 快进</button>
        <div id="hud" class="hud"></div>
      </header>
      <section id="map-wrap" class="map-wrap">
        <svg id="world-map" xmlns="http://www.w3.org/2000/svg"></svg>
      </section>
      <nav id="tabs" class="tabs">
        <button class="tab" data-tab="routes">航线</button>
        <button class="tab" data-tab="fleet">机队</button>
        <button class="tab" data-tab="cities">城市</button>
        <button class="tab" data-tab="finance">财报</button>
        <button class="tab" data-tab="leaderboard">排行</button>
        <button class="tab" data-tab="history">事件</button>
        <button class="tab" data-tab="intel">情报</button>
        <button class="tab" data-tab="strategy">策略</button>
      </nav>
      <section id="tab-body" class="tab-body"></section>
    </div>
    <div id="modal-root"></div>
    <div id="toast"></div>
  `;
  $('#end-turn-btn').addEventListener('click', onEndTurnConfirm);
  $('#menu-btn').addEventListener('click', openMenu);
  $('#ff-btn').addEventListener('click', onFastForward);
  $$('.tab').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));
}

// 快进按钮显隐 + 推进条件：未来 2 季无事件 + 上季玩家无操作 + 现金 > 5× 维护
function refreshFastForwardBtn() {
  const btn = $('#ff-btn');
  if (!btn) return;
  const p = getPlayer();
  if (!p || state.gameOver) { btn.hidden = true; return; }
  const upcoming = peekUpcomingEvents(state.year, state.quarter, 2);
  const noActions = (state.thisTurnActions || []).length === 0;
  const totalMaint = p.aircraft.reduce((s, a) => s + AIRCRAFT_BY_ID[a.modelId].maintenancePerQuarter, 0);
  const cashSafe = p.cash > 5 * Math.max(1, totalMaint);
  btn.hidden = !(upcoming.length === 0 && noActions && cashSafe);
}

function onFastForward() {
  // 最多连续推进 2 季，每次都重新评估条件
  let count = 0;
  while (count < 2) {
    const upcoming = peekUpcomingEvents(state.year, state.quarter, 1);
    if (upcoming.length > 0) break;
    const p = getPlayer();
    if (!p) break;
    const totalMaint = p.aircraft.reduce((s, a) => s + AIRCRAFT_BY_ID[a.modelId].maintenancePerQuarter, 0);
    if (p.cash <= 5 * Math.max(1, totalMaint)) break;
    clearTurnActions();
    const triggered = advanceQuarter(runAiTurn, runAiChoicesForEvent);
    count++;
    if (triggered.length > 0 || state.gameOver) break;
    if (p.cash < 0) break;
  }
  saveGame();
  rerender();
  if (count > 0) toast(`已快进 ${count} 季`);
}

// ===== Start menu (centered, traditional layout) =====
function showStartMenu() {
  $('#start-screen').hidden = false;
  $('#game-screen').hidden = true;
  const root = $('#start-screen');
  root.innerHTML = `
    <div class="start-card centered">
      <h1 class="game-title">✈️ 航空霸业 Lite</h1>
      <p class="subtitle">2000 → 2025 · 25 年航线经营沙盘</p>
      <p class="hint">亲历 21 世纪初的航空业大事件：9/11、SARS、金融危机、火山灰、新冠、俄乌冲突⋯</p>
      <div class="menu-buttons">
        ${hasSave() ? '<button class="primary-btn big" id="continue-btn">▶️ 继续上局</button>' : ''}
        <button class="${hasSave() ? 'ghost-btn' : 'primary-btn'} big" id="new-game-btn">🎮 开始新游戏</button>
        <button class="ghost-btn big" id="load-game-btn">📂 读取存档</button>
      </div>
      <div class="version-tag">v${APP_VERSION}</div>
    </div>
  `;
  const contBtn = $('#continue-btn');
  if (contBtn) {
    contBtn.addEventListener('click', () => {
      const res = loadGame();
      if (res && res.ok) { showGameView(); toast('已恢复上局'); }
      else if (res && res.reason === 'version') {
        toast(`存档版本不兼容（v${res.oldVersion}，当前 v${SAVE_VERSION}），请新开一局`);
      } else {
        toast('恢复失败：自动存档已损坏');
      }
    });
  }
  $('#new-game-btn').addEventListener('click', showAirlinePicker);
  $('#load-game-btn').addEventListener('click', showLoadSlotsScreen);
}

let selectedDifficulty = 'normal';

function showAirlinePicker() {
  const root = $('#start-screen');
  root.innerHTML = `
    <div class="start-card centered">
      <h1 class="game-title">✈️ 选择航司</h1>
      <p class="hint">先选难度，再点选一家航司开始 2000 Q1。</p>
      <div class="difficulty-pick">
        <span class="muted small">难度：</span>
        ${Object.entries(DIFFICULTY).map(([key, cfg]) => `
          <button class="diff-btn ${key === selectedDifficulty ? 'active' : ''}" data-diff="${key}" title="初始现金 ×${cfg.cashMult}, AI 上限 ${cfg.maxAiActions}/季">
            ${cfg.label}
          </button>
        `).join('')}
      </div>
      <div class="diff-summary muted small" id="diff-summary"></div>
      <div class="airline-pick">
        ${AIRLINES.map(a => `
          <button class="airline-card" data-id="${a.id}" style="--c:${a.color}">
            <div class="flag">${flagOf(a.country)}</div>
            <div class="name">${a.nameZh}</div>
            <div class="hub">主基地 ${CITY_BY_ID[a.hubCity].nameZh} (${a.hubCity})</div>
            <div class="stats">
              <span class="cash-stat" data-base="${a.initialCash}">💰 $${a.initialCash}M</span>
              <span>✈️ ${a.initialFleet.reduce((s, f) => s + f.count, 0)} 架</span>
              <span>⭐ 声望 ${a.initialPrestige}</span>
            </div>
          </button>
        `).join('')}
      </div>
      <button class="ghost-btn" id="back-to-menu">← 返回</button>
    </div>
  `;
  const refreshDiffUi = () => {
    $$('.diff-btn', root).forEach(b => b.classList.toggle('active', b.dataset.diff === selectedDifficulty));
    const cfg = DIFFICULTY[selectedDifficulty];
    $('#diff-summary').textContent = `初始现金 ×${cfg.cashMult} · 事件强度向 1.0 ${cfg.eventConverge >= 0 ? '收敛' : '放大'} ${Math.abs(Math.round(cfg.eventConverge * 100))}% · AI 每季最多 ${cfg.maxAiActions} 项动作 · AI 性格 ${cfg.aiDowngrade > 0 ? '降一档' : cfg.aiDowngrade < 0 ? '升一档' : '不变'}`;
    // 更新航司卡片的现金显示
    $$('.cash-stat', root).forEach(s => {
      const base = parseInt(s.dataset.base, 10);
      s.textContent = `💰 $${Math.round(base * cfg.cashMult)}M`;
    });
  };
  refreshDiffUi();
  $$('.diff-btn', root).forEach(b => {
    b.addEventListener('click', () => {
      selectedDifficulty = b.dataset.diff;
      refreshDiffUi();
    });
  });
  $$('.airline-card', root).forEach(b => {
    b.addEventListener('click', () => {
      initNewGame(b.dataset.id, selectedDifficulty);
      saveGame();
      showGameView();
      showTutorialModal();
    });
  });
  $('#back-to-menu').addEventListener('click', showStartMenu);
}

function showLoadSlotsScreen() {
  const root = $('#start-screen');
  const slots = listSaveSlots();
  root.innerHTML = `
    <div class="start-card centered">
      <h1 class="game-title">📂 读取存档</h1>
      <p class="hint">${NUM_SLOTS} 个手动槽位 — 选择要读取的存档。</p>
      <div class="slot-list">
        ${slots.map((s, i) => slotCardHtml(s, i + 1, 'load')).join('')}
      </div>
      <button class="ghost-btn" id="back-to-menu">← 返回</button>
    </div>
  `;
  attachSlotHandlers(root, 'load');
  $('#back-to-menu').addEventListener('click', showStartMenu);
}

function slotCardHtml(meta, slot, mode) {
  if (!meta) {
    return `<div class="slot-card empty">
      <div class="slot-num">槽 ${slot}</div>
      <div class="slot-info">空槽位</div>
      ${mode === 'save'
        ? `<button class="primary-btn small" data-slot="${slot}" data-act="save">保存到此</button>`
        : `<button class="ghost-btn small" disabled>无存档</button>`}
    </div>`;
  }
  const date = new Date(meta.savedAt);
  const dateStr = `${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `<div class="slot-card">
    <div class="slot-num">槽 ${slot}</div>
    <div class="slot-info">
      <b>${escapeHtml(meta.airlineName)}</b> · ${meta.year} Q${meta.quarter}<br>
      <span class="muted">航线 ${meta.routes} · 现金 $${meta.cash.toFixed(0)}M · 存于 ${dateStr}</span>
    </div>
    <div class="slot-actions">
      ${mode === 'save'
        ? `<button class="primary-btn small" data-slot="${slot}" data-act="save">覆盖</button>`
        : `<button class="primary-btn small" data-slot="${slot}" data-act="load">读取</button>`}
      <button class="ghost-btn small" data-slot="${slot}" data-act="delete">删除</button>
    </div>
  </div>`;
}

function attachSlotHandlers(root, mode) {
  $$('[data-act]', root).forEach(b => {
    b.addEventListener('click', () => {
      const slot = parseInt(b.dataset.slot, 10);
      const act = b.dataset.act;
      if (act === 'save') {
        saveToSlot(slot);
        toast(`已保存到槽 ${slot}`);
        if (mode === 'menu-save') showMenuSave();
        else showLoadSlotsScreen();
      } else if (act === 'load') {
        if (!confirm(`读取槽 ${slot} 的存档？当前未保存的进度将丢失。`)) return;
        const res = loadFromSlot(slot);
        if (res.ok) {
          saveGame();
          if (mode === 'menu-load') closeModal();
          showGameView();
          toast(`已读取槽 ${slot}`);
        } else if (res.reason === 'version') {
          toast(`存档版本不兼容（v${res.oldVersion}，当前需要 v${SAVE_VERSION}），请新开一局`);
        } else if (res.reason === 'empty') {
          toast('该槽位无存档');
        } else {
          toast('读取失败：存档损坏');
        }
      } else if (act === 'delete') {
        if (!confirm(`删除槽 ${slot} 的存档？`)) return;
        deleteSlot(slot);
        if (mode === 'menu-save') showMenuSave();
        else if (mode === 'menu-load') showMenuLoad();
        else showLoadSlotsScreen();
      }
    });
  });
}

function showGameView() {
  $('#start-screen').hidden = true;
  $('#game-screen').hidden = false;
  buildMapSvg($('#world-map'));
  rerender();
  if (state.pendingEvent) showEventChoice(state.pendingEvent);
  else if (state.pendingDialog) showQuarterReport();
}

function showTutorialModal() {
  const player = getPlayer();
  openModal({
    title: '欢迎来到航空霸业 Lite',
    body: `
      <p>你是 <b>${player.nameZh}</b> 的新任 CEO。本游戏共 <b>100 季度（2000 Q1 → 2025 Q4）</b>。</p>
      <ol style="padding-left:1.2em; line-height:1.7">
        <li>每条航线只挂 <b>一架飞机</b>，要更多运力就开多条航线（同城市对可重复）。</li>
        <li>票价用滑块调整：红 → 黄（盈亏平衡） → 绿（高利润）。默认 50% 毛利。</li>
        <li>载荷率受 价格、声望、和 <b>竞争</b> 影响 — 同城市对多家航司在飞时，每家都会显著掉载荷。</li>
        <li>左上 ⚙️ 菜单可保存/读取（5 槽位）或回到首页。</li>
      </ol>
    `,
    actions: [{ label: '开始游戏', primary: true, onClick: closeModal }],
  });
}

// ===== Render =====
export function rerender() {
  renderHud();
  drawMapContents($('#world-map'), { onCityClick: c => { setTab('cities'); showCityRoutes(c.id); } });
  renderTabs();
  renderTabBody();
  refreshFastForwardBtn();
}

function renderHud() {
  const p = getPlayer();
  $('#hud').innerHTML = `
    <div class="hud-left">
      <span class="qtag">${state.year} Q${state.quarter}</span>
      <span class="al-name" style="color:${p.color}">${p.nameZh}</span>
    </div>
    <div class="hud-stats">
      <div><span class="lbl">现金</span><span class="val">$${fmt(p.cash)}M</span></div>
      <div><span class="lbl">机队</span><span class="val">${p.aircraft.length}</span></div>
      <div><span class="lbl">航线</span><span class="val">${p.routes.length}</span></div>
      <div><span class="lbl">声望 ${glossaryBtn('prestige')}</span><span class="val">${Math.round(p.prestige)}</span></div>
      <div><span class="lbl">油价 ${glossaryBtn('fuelMult')}</span><span class="val">${state.fuelPrice.toFixed(2)}×</span></div>
    </div>
  `;
}

function renderTabs() {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === currentTab));
}
function setTab(tab) { currentTab = tab; renderTabs(); renderTabBody(); }

function renderTabBody() {
  const body = $('#tab-body');
  if (currentTab === 'routes') body.innerHTML = renderRoutes();
  else if (currentTab === 'fleet') body.innerHTML = renderFleet();
  else if (currentTab === 'cities') body.innerHTML = renderCities();
  else if (currentTab === 'finance') body.innerHTML = renderFinance();
  else if (currentTab === 'leaderboard') body.innerHTML = renderLeaderboard();
  else if (currentTab === 'history') body.innerHTML = renderHistory();
  else if (currentTab === 'intel') body.innerHTML = renderIntel();
  else if (currentTab === 'strategy') body.innerHTML = renderStrategy();
  attachTabHandlers();
}

// ----- 航线 -----
function renderRoutes() {
  const p = getPlayer();

  // 排序: 按城市名 / 距离 / 上季利润 / 载荷 / 票价
  const sortedRoutes = [...p.routes];
  const dir = routeTabSort.dir === 'desc' ? -1 : 1;
  sortedRoutes.sort((ra, rb) => {
    const a1 = CITY_BY_ID[ra.fromCity], b1 = CITY_BY_ID[ra.toCity];
    const a2 = CITY_BY_ID[rb.fromCity], b2 = CITY_BY_ID[rb.toCity];
    switch (routeTabSort.col) {
      case 'dist': return dir * (distanceKm(a1, b1) - distanceKm(a2, b2));
      case 'profit': return dir * ((ra.lastProfit || 0) - (rb.lastProfit || 0));
      case 'load': return dir * ((ra.lastLoadFactor || 0) - (rb.lastLoadFactor || 0));
      case 'fare': return dir * ((ra.fare || 0) - (rb.fare || 0));
      case 'pair':
      default:
        return dir * (a1.nameZh.localeCompare(a2.nameZh, 'zh') || b1.nameZh.localeCompare(b2.nameZh, 'zh'));
    }
  });

  const rows = sortedRoutes.map(r => {
    const a = CITY_BY_ID[r.fromCity], b = CITY_BY_ID[r.toCity];
    const dist = distanceKm(a, b);
    const breakEven = computeBreakEvenFare(p, r);
    const fareMin = Math.max(20, Math.round(breakEven * 0.4));
    const fareMax = Math.max(fareMin + 50, Math.round(breakEven * 5.0));
    const bePct = ((breakEven - fareMin) / (fareMax - fareMin)) * 100;

    const curAc = r.aircraftUid ? p.aircraft.find(a => a.uid === r.aircraftUid) : null;

    // 可换的飞机选项: 当前 + 闲置且航程足够
    const candidates = p.aircraft.filter(ac => {
      const m = AIRCRAFT_BY_ID[ac.modelId];
      if (m.rangeKm < dist) return false;
      if (ac.uid === r.aircraftUid) return true;
      return !ac.routeId && !ac.grounded;
    });

    const acSelect = `<select class="r-ac" data-route="${r.id}">
      <option value="" ${!curAc ? 'selected' : ''}>— 无飞机 —</option>
      ${candidates.map(ac => {
        const m = AIRCRAFT_BY_ID[ac.modelId];
        const isCur = ac.uid === r.aircraftUid;
        return `<option value="${ac.uid}" ${isCur ? 'selected' : ''}>${m.name} · ${m.capacity}座 · ${m.rangeKm}km${isCur ? '（当前）' : ''}</option>`;
      }).join('')}
    </select>`;

    const modified = routeIsModified(r);
    return `
      <tr data-route="${r.id}">
        <td>
          <a href="#" class="route-pair-link" data-from="${r.fromCity}" data-to="${r.toCity}">
            <div class="route-name">${a.nameZh} — ${b.nameZh}</div>
            <div class="muted small">${dist} km · 盈亏价 $${breakEven}</div>
          </a>
        </td>
        <td class="fare-cell">
          <div class="fare-slider-wrap" style="--be-pos:${bePct}%">
            <input type="range" class="fare-slider"
              min="${fareMin}" max="${fareMax}" value="${r.fare}" data-route="${r.id}" />
          </div>
          <div class="fare-label">
            <span class="fare-val">$${r.fare}</span>
            <span class="muted small">范围 $${fareMin}–${fareMax}</span>
          </div>
        </td>
        <td class="ac-cell">${acSelect}</td>
        <td>${r.lastLoadFactor ? (r.lastLoadFactor * 100).toFixed(0) + '%' : '—'}</td>
        <td class="${r.lastProfit >= 0 ? 'pos' : 'neg'}">$${fmt(r.lastProfit)}M</td>
        <td>
          <div class="route-actions">
            <button class="mini r-revert" data-route="${r.id}" ${modified ? '' : 'disabled'} title="还原本季度修改">↺ 还原</button>
            <button class="mini r-close" data-route="${r.id}">关闭</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  const sortBtn = (col, label) => {
    const active = routeTabSort.col === col;
    const arrow = active ? (routeTabSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<button class="mini r-sort-btn ${active ? 'active' : ''}" data-col="${col}">${label}${arrow}</button>`;
  };

  return `
    <div class="panel">
      <div class="panel-head">
        <h3>航线 (${p.routes.length})</h3>
        <button id="open-route-btn" class="primary-btn small">+ 开通新航线</button>
      </div>
      <div class="route-sort-bar">
        <span class="muted small">排序：</span>
        ${sortBtn('pair', '城市对')}
        ${sortBtn('dist', '距离')}
        ${sortBtn('profit', '利润')}
        ${sortBtn('load', '载荷')}
        ${sortBtn('fare', '票价')}
      </div>
      <div class="table-wrap"><table class="game-table routes-table">
        <thead><tr>
          <th>城市对</th>
          <th>票价（拖动）${glossaryBtn('breakeven')}</th>
          <th>飞机</th>
          <th>载荷 ${glossaryBtn('loadFactor')}</th>
          <th>上季利润</th>
          <th>操作</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="6" class="muted">还没有航线，点右上方"开通新航线"。</td></tr>`}</tbody>
      </table></div>
      <p class="muted small">提示：点击 <b>城市对</b> 名称查看该航段所有航司明细。同城市对可开多条航线增加运力，但多家航司同时在飞会显著降低载荷率。</p>
    </div>
  `;
}

function attachRouteHandlers() {
  const p = getPlayer();
  $$('.fare-slider').forEach(slider => {
    const rid = slider.dataset.route;
    const row = slider.closest('tr');
    const label = row.querySelector('.fare-val');
    slider.addEventListener('input', () => { label.textContent = '$' + slider.value; });
    slider.addEventListener('change', () => {
      const r = p.routes.find(x => x.id === rid);
      const oldFare = r.fare;
      setFare(p, rid, parseInt(slider.value, 10));
      logPlayerAction('fare', `调整 ${CITY_BY_ID[r.fromCity].iata}-${CITY_BY_ID[r.toCity].iata} 票价 $${oldFare} → $${r.fare}`);
      saveGame();
      rerender();  // 重新渲染以更新还原按钮启用状态
    });
  });
  $$('.r-ac').forEach(sel => {
    sel.addEventListener('change', () => {
      const rid = sel.dataset.route;
      const r = p.routes.find(x => x.id === rid);
      const newUid = sel.value || null;
      const res = assignAircraftToRoute(p, rid, newUid);
      if (!res.ok) { toast(res.msg); rerender(); return; }
      const desc = newUid
        ? `${CITY_BY_ID[r.fromCity].iata}-${CITY_BY_ID[r.toCity].iata} 换为 ${AIRCRAFT_BY_ID[p.aircraft.find(a => a.uid === newUid).modelId].name}`
        : `${CITY_BY_ID[r.fromCity].iata}-${CITY_BY_ID[r.toCity].iata} 卸下飞机`;
      logPlayerAction('assign', desc);
      saveGame();
      rerender();
    });
  });
  $$('.r-close').forEach(b => {
    b.addEventListener('click', () => {
      if (!confirm('关闭这条航线？飞机会变为闲置。')) return;
      const rid = b.dataset.route;
      const r = p.routes.find(x => x.id === rid);
      const desc = `${CITY_BY_ID[r.fromCity].iata}-${CITY_BY_ID[r.toCity].iata}`;
      closeRoute(p, rid);
      logPlayerAction('close', `关闭航线 ${desc}`);
      saveGame();
      rerender();
    });
  });
  $$('.r-revert').forEach(b => {
    if (b.disabled) return;
    b.addEventListener('click', () => {
      const rid = b.dataset.route;
      const r = p.routes.find(x => x.id === rid);
      if (!r || !r._committed) return;
      const targetUid = r._committed.aircraftUid;
      const sameAc = r.aircraftUid === targetUid;
      if (!sameAc) {
        const targetAc = targetUid ? p.aircraft.find(a => a.uid === targetUid) : null;
        if (targetUid && (!targetAc || (targetAc.routeId && targetAc.routeId !== r.id) || targetAc.grounded)) {
          toast(`原飞机已不可用，仅恢复票价`);
        } else {
          assignAircraftToRoute(p, r.id, targetUid);
        }
      }
      r.fare = r._committed.fare;
      logPlayerAction('revert', `还原 ${CITY_BY_ID[r.fromCity].iata}-${CITY_BY_ID[r.toCity].iata} 本季修改`);
      saveGame();
      rerender();
    });
  });
  const openBtn = $('#open-route-btn');
  if (openBtn) openBtn.addEventListener('click', openNewRouteDialog);
  $$('.r-sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.dataset.col;
      if (routeTabSort.col === col) {
        routeTabSort.dir = routeTabSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        routeTabSort.col = col;
        // 距离/利润/载荷/票价默认降序更直观，名称默认升序
        routeTabSort.dir = (col === 'pair') ? 'asc' : 'desc';
      }
      renderTabBody();
    });
  });
  $$('.route-pair-link').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      showRoutePairDetail(a.dataset.from, a.dataset.to);
    });
  });
}

// 点击城市对：弹窗显示该航段所有航司的航班明细
function showRoutePairDetail(fromCityId, toCityId) {
  const a = CITY_BY_ID[fromCityId], b = CITY_BY_ID[toCityId];
  if (!a || !b) return;
  const dist = distanceKm(a, b);
  const pairK = [fromCityId, toCityId].sort().join('_');
  // 收集所有航司在该城市对的航线
  const rows = [];
  let totalSeats = 0;
  for (const al of state.airlines) {
    for (const r of al.routes) {
      const k = [r.fromCity, r.toCity].sort().join('_');
      if (k !== pairK) continue;
      const seats = quarterSeatCapacity(al, r);
      totalSeats += seats;
      const ac = r.aircraftUid ? al.aircraft.find(x => x.uid === r.aircraftUid) : null;
      const acModel = ac ? AIRCRAFT_BY_ID[ac.modelId] : null;
      rows.push({ al, r, seats, acModel });
    }
  }
  // 按运力降序
  rows.sort((x, y) => y.seats - x.seats);
  const tbody = rows.length === 0
    ? '<tr><td colspan="6" class="muted">暂无任何航司运营此航段。</td></tr>'
    : rows.map(x => {
        const share = totalSeats > 0 ? Math.round(x.seats / totalSeats * 100) : 0;
        const profitCls = x.r.lastProfit >= 0 ? 'pos' : 'neg';
        const profitTxt = x.r.lastProfit ? `$${fmt(x.r.lastProfit)}M` : '—';
        const loadTxt = x.r.lastLoadFactor ? Math.round(x.r.lastLoadFactor * 100) + '%' : '—';
        return `<tr ${x.al.isPlayer ? 'class="me"' : ''}>
          <td><span class="dot" style="background:${x.al.color}"></span> ${x.al.nameShort}${x.al.isPlayer ? '（你）' : ''}</td>
          <td>${x.acModel ? x.acModel.name : '<span class="muted">无飞机</span>'}</td>
          <td>$${x.r.fare}</td>
          <td>${loadTxt}</td>
          <td>${x.seats.toLocaleString()} 座 <span class="muted small">(${share}%)</span></td>
          <td class="${profitCls}">${profitTxt}</td>
        </tr>`;
      }).join('');
  openModal({
    title: `${a.nameZh} ↔ ${b.nameZh} · 航段明细`,
    body: `
      <div class="muted small" style="margin-bottom:10px">
        距离 <b>${dist} km</b> · 在飞航司 ${rows.length} 家 · 当季总运力 ${totalSeats.toLocaleString()} 座
      </div>
      <div class="table-wrap"><table class="game-table">
        <thead><tr>
          <th>航司</th><th>机型</th><th>票价</th>
          <th>载荷</th><th>运力 / 份额</th><th>上季利润</th>
        </tr></thead>
        <tbody>${tbody}</tbody>
      </table></div>
      <p class="muted small" style="margin-top:8px">运力份额按 (座位 × 航班数) 计算；实际市场份额还会被价格弹性与声望放大。</p>
    `,
    actions: [{ label: '关闭', primary: true, onClick: closeModal }],
  });
}

function openNewRouteDialog() {
  const p = getPlayer();
  const rights = p.landingRights;
  if (rights.length < 2) { toast('至少需要 2 个着陆权'); return; }
  openModal({
    title: '开通新航线',
    body: `
      <div class="form-row"><label>起点</label>
        <select id="d-from">${rights.map(id => `<option value="${id}">${CITY_BY_ID[id].nameZh} (${id})</option>`).join('')}</select>
      </div>
      <div class="form-row"><label>终点</label>
        <select id="d-to">${rights.map(id => `<option value="${id}">${CITY_BY_ID[id].nameZh} (${id})</option>`).join('')}</select>
      </div>
      <div id="d-info" class="muted">选择起降城市后将显示距离与可用机型。</div>
      <div class="form-row"><label>飞机</label>
        <select id="d-aircraft"><option value="">先选择起降城市</option></select>
      </div>
    `,
    actions: [
      { label: '取消', onClick: closeModal },
      { label: '开通', primary: true, onClick: () => {
        const from = $('#d-from').value, to = $('#d-to').value;
        const acUid = $('#d-aircraft').value;
        if (!acUid) { toast('请选择一架空闲飞机'); return; }
        const res = openRoute(p, from, to, null, acUid);
        if (!res.ok) { toast(res.msg); return; }
        const ac = p.aircraft.find(a => a.uid === acUid);
        const m = AIRCRAFT_BY_ID[ac.modelId];
        logPlayerAction('open', `开通 ${from}-${to}，分配 ${m.name}`);
        saveGame();
        closeModal(); toast('已开通新航线'); rerender();
      } },
    ],
  });
  const syncAircraft = () => {
    const fromId = $('#d-from').value, toId = $('#d-to').value;
    const sel = $('#d-aircraft');
    const info = $('#d-info');
    if (!fromId || !toId || fromId === toId) {
      info.textContent = '请选择不同的两个城市';
      sel.innerHTML = '<option value="">先选择起降城市</option>';
      return;
    }
    const dist = distanceKm(CITY_BY_ID[fromId], CITY_BY_ID[toId]);
    info.innerHTML = `距离 <b>${dist} km</b>`;
    const idle = p.aircraft.filter(ac =>
      !ac.routeId && !ac.grounded && AIRCRAFT_BY_ID[ac.modelId].rangeKm >= dist);
    if (idle.length === 0) {
      sel.innerHTML = '<option value="">无符合航程的闲置飞机</option>';
      info.innerHTML += ` · <span class="warn">⚠️ 当前无空闲飞机能飞此距离，先到机队购买或释放飞机</span>`;
    } else {
      sel.innerHTML = idle.map(ac => {
        const m = AIRCRAFT_BY_ID[ac.modelId];
        return `<option value="${ac.uid}">${m.name} · ${m.capacity}座 · 航程 ${m.rangeKm}km</option>`;
      }).join('');
    }
  };
  $('#d-from').addEventListener('change', syncAircraft);
  $('#d-to').addEventListener('change', syncAircraft);
  syncAircraft();
}

// ----- 机队 -----
function renderFleet() {
  const p = getPlayer();
  const rows = p.aircraft.map(ac => {
    const m = AIRCRAFT_BY_ID[ac.modelId];
    const route = ac.routeId ? p.routes.find(r => r.id === ac.routeId) : null;
    let routeLabel = '<span class="muted">闲置</span>';
    if (ac.grounded) {
      routeLabel = '<span class="bad">停飞</span>';
    } else if (route) {
      const a = CITY_BY_ID[route.fromCity], b = CITY_BY_ID[route.toCity];
      const dist = distanceKm(a, b);
      routeLabel = `${a.iata}—${b.iata} <span class="muted small">${dist}km</span>`;
    }
    return `
      <tr data-uid="${ac.uid}">
        <td>${m.name}<br><span class="muted small">${m.manufacturer}</span></td>
        <td>${m.capacity} 座<br><span class="muted small">航程 ${m.rangeKm}km</span></td>
        <td>${(ac.ageQuarters / 4).toFixed(1)} 年</td>
        <td>${routeLabel}</td>
        <td><button class="mini a-sell">售出</button></td>
      </tr>`;
  }).join('');

  // 机队制造商分布 + 折扣信息
  const brandCount = {};
  for (const ac of p.aircraft) {
    const b = AIRCRAFT_BY_ID[ac.modelId].manufacturer;
    brandCount[b] = (brandCount[b] || 0) + 1;
  }
  const brandList = Object.entries(brandCount).sort((a, b) => b[1] - a[1])
    .map(([b, n]) => `${b} ×${n}`).join(' · ') || '—';
  const totalMaintBase = p.aircraft.reduce((s, a) => s + AIRCRAFT_BY_ID[a.modelId].maintenancePerQuarter, 0);
  const dInfo = fleetMaintDiscountInfo(p);
  let discountHtml = '';
  if (dInfo.eligible) {
    const saved = totalMaintBase * dInfo.discount;
    discountHtml = `<div class="fleet-discount">
      <div style="font-size:22px">🎯</div>
      <div>
        <b>制造商折扣已启用：${dInfo.brand} 单一品牌 -${Math.round(dInfo.discount * 100)}% 维护费</b>
        <div class="muted small">每季节省约 $${saved.toFixed(1)}M（基准维护 $${totalMaintBase.toFixed(1)}M → 实际 $${(totalMaintBase - saved).toFixed(1)}M）</div>
      </div>
    </div>`;
  } else if (p.aircraft.length >= 2) {
    discountHtml = `<div class="fleet-discount miss">
      <div style="font-size:22px">💡</div>
      <div>
        <b>未触发制造商折扣</b>
        <div class="muted small">机队当前分布：${brandList}。统一为全 Boeing 或全 Airbus 机队可享 -10% 维护费折扣。</div>
      </div>
    </div>`;
  } else {
    discountHtml = `<div class="fleet-discount miss">
      <div style="font-size:22px">💡</div>
      <div>
        <b>提示：制造商折扣</b>
        <div class="muted small">机队全部统一为 Boeing 或 Airbus（至少 2 架）可获得 10% 维护费折扣。</div>
      </div>
    </div>`;
  }

  return `
    <div class="panel">
      <div class="panel-head">
        <h3>机队 (${p.aircraft.length})</h3>
        <button id="buy-aircraft-btn" class="primary-btn small">+ 购买飞机</button>
      </div>
      ${discountHtml}
      <div class="table-wrap"><table class="game-table">
        <thead><tr><th>机型</th><th>规格</th><th>机龄</th><th>当前任务</th><th>操作</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="muted">机队为空，先去购买飞机。</td></tr>'}</tbody>
      </table></div>
      <p class="muted small">飞机分配/调换在 <b>航线</b> 标签直接做。</p>
    </div>
  `;
}

function attachFleetHandlers() {
  const p = getPlayer();
  $$('#tab-body tr[data-uid]').forEach(tr => {
    const uid = tr.dataset.uid;
    tr.querySelector('.a-sell').addEventListener('click', () => {
      const ac = p.aircraft.find(a => a.uid === uid);
      if (!ac) return;
      const m = AIRCRAFT_BY_ID[ac.modelId];
      const yrs = ac.ageQuarters / 4;
      const estResale = Math.max(m.purchasePrice * 0.25, m.purchasePrice * Math.pow(0.95, yrs) * 0.7);
      openModal({
        title: `出售 ${m.name}？`,
        body: `
          <div class="sell-detail">
            <div><span class="lbl">机型</span><b>${m.name}</b></div>
            <div><span class="lbl">原价</span><b>$${m.purchasePrice}M</b></div>
            <div><span class="lbl">机龄</span><b>${yrs.toFixed(1)} 年</b></div>
            <div><span class="lbl pos">预计回收</span><b class="pos">$${estResale.toFixed(1)}M</b></div>
          </div>
          ${ac.routeId ? '<p class="warn small">⚠️ 这架飞机正在执飞，售出后该航线会变为无飞机。</p>' : ''}
        `,
        actions: [
          { label: '取消', onClick: closeModal },
          { label: '确认出售', primary: true, onClick: () => {
            const r = sellAircraft(p, uid);
            if (r.ok) {
              toast(`已售出，回收 $${fmt(r.resale)}M`);
              logPlayerAction('sell', `出售 ${m.name}，回收 $${r.resale.toFixed(1)}M`);
              saveGame();
            }
            closeModal();
            rerender();
          } },
        ],
      });
    });
  });
  const buyBtn = $('#buy-aircraft-btn');
  if (buyBtn) buyBtn.addEventListener('click', openBuyAircraftDialog);
}

function openBuyAircraftDialog() {
  const yr = state.year;
  const available = AIRCRAFT.filter(m => yr >= m.availableFrom && yr <= m.availableUntil);
  openModal({
    title: '购买飞机',
    body: `
      <div class="table-wrap"><table class="game-table">
        <thead><tr><th>机型</th><th>载量</th><th>航程</th><th>油耗</th><th>价格</th><th></th></tr></thead>
        <tbody>${available.map(m => `
          <tr>
            <td><b>${m.name}</b><br><span class="muted small">${m.manufacturer}</span></td>
            <td>${m.capacity}</td>
            <td>${m.rangeKm} km</td>
            <td>${m.fuelPerSeatKm.toFixed(3)} L/座km</td>
            <td>$${m.purchasePrice}M</td>
            <td><button class="mini buy-this" data-id="${m.id}">购买</button></td>
          </tr>`).join('')}</tbody>
      </table></div>
    `,
    actions: [{ label: '关闭', onClick: closeModal }],
  });
  $$('.buy-this').forEach(b => b.addEventListener('click', () => {
    const p = getPlayer();
    const m = AIRCRAFT_BY_ID[b.dataset.id];
    const r = buyAircraft(p, b.dataset.id);
    if (!r.ok) { toast(r.msg); return; }
    logPlayerAction('buy', `购入 ${m.name} ($${m.purchasePrice}M)`);
    saveGame();
    toast('已购买');
    rerender();
  }));
}

// ----- 城市 -----
function renderCities() {
  const p = getPlayer();
  const rights = new Set(p.landingRights);
  const queued = new Set(state.landingApplications.filter(a => a.airlineId === p.id).map(a => a.cityId));

  const rows = [...CITIES];
  const sortFn = (() => {
    const dir = cityTabSort.dir === 'desc' ? -1 : 1;
    switch (cityTabSort.col) {
      case 'name': return (a, b) => dir * a.nameZh.localeCompare(b.nameZh, 'zh');
      case 'region': return (a, b) => dir * (regionLabel(a.region).localeCompare(regionLabel(b.region), 'zh') || a.iata.localeCompare(b.iata));
      case 'stars': return (a, b) => dir * (a.size - b.size);
      case 'slots': return (a, b) => {
        const ua = routesAtCity(a.id) / cityRouteSlots(a);
        const ub = routesAtCity(b.id) / cityRouteSlots(b);
        return dir * (ua - ub);
      };
      case 'status': return (a, b) => {
        const sa = rights.has(a.id) ? 0 : queued.has(a.id) ? 1 : 2;
        const sb = rights.has(b.id) ? 0 : queued.has(b.id) ? 1 : 2;
        return dir * (sa - sb);
      };
      default: return () => 0;
    }
  })();
  rows.sort(sortFn);

  const headerCell = (col, label) => {
    const active = cityTabSort.col === col;
    const arrow = active ? (cityTabSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="sortable" data-col="${col}">${label}${arrow}</th>`;
  };

  const trs = rows.map(c => {
    const status = rights.has(c.id) ? '<span class="pos">✓ 已拥有</span>'
      : queued.has(c.id) ? `<span class="warn">审批中</span>`
        : `<button class="mini apply-btn" data-id="${c.id}">申请</button>`;
    const slots = cityRouteSlots(c);
    const used = routesAtCity(c.id);
    const slotCls = used >= slots ? 'bad' : used >= slots * 0.8 ? 'warn' : '';
    return `
      <tr>
        <td><a href="#" class="city-link" data-id="${c.id}">${c.nameZh}</a> <span class="muted small">(${c.iata})</span></td>
        <td>${regionLabel(c.region)}</td>
        <td><span class="stars">${'★'.repeat(c.size)}</span></td>
        <td><span class="${slotCls}">${used} / ${slots}</span></td>
        <td>${status}</td>
      </tr>`;
  }).join('');

  return `
    <div class="panel">
      <div class="panel-head"><h3>城市与着陆权</h3>
        <span class="muted">已拥有 ${p.landingRights.length} / ${CITIES.length}</span>
      </div>
      <div class="table-wrap"><table class="game-table">
        <thead><tr>
          ${headerCell('name', '城市')}
          ${headerCell('region', '区域')}
          ${headerCell('stars', '星级')}
          ${headerCell('slots', '航线槽位')}
          ${headerCell('status', '状态')}
        </tr></thead>
        <tbody>${trs}</tbody>
      </table></div>
      <p class="muted small">点击表头排序 · 点击城市名查看相关航线 · 星级 3★/4★/5★ 分别支持 6/8/12 条航线槽位，且对应不同市场需求</p>
    </div>
  `;
}

function attachCitiesHandlers() {
  $$('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (cityTabSort.col === col) cityTabSort.dir = cityTabSort.dir === 'asc' ? 'desc' : 'asc';
      else { cityTabSort.col = col; cityTabSort.dir = 'asc'; }
      renderTabBody();
    });
  });
  $$('.apply-btn').forEach(b => b.addEventListener('click', () => {
    const p = getPlayer();
    const city = CITY_BY_ID[b.dataset.id];
    const r = applyForLanding(p, b.dataset.id);
    if (!r.ok) { toast(r.msg); return; }
    toast(`已申请，需 ${r.eta} 季审批`);
    logPlayerAction('landing', `申请 ${city.nameZh} 着陆权（${r.eta} 季审批）`);
    saveGame();
    rerender();
  }));
  $$('.city-link').forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault();
    showCityRoutes(a.dataset.id);
  }));
}

function showCityRoutes(cityId) {
  const c = CITY_BY_ID[cityId];
  if (!c) return;
  const rows = [];
  for (const al of state.airlines) {
    for (const r of al.routes) {
      if (r.fromCity !== cityId && r.toCity !== cityId) continue;
      const other = CITY_BY_ID[r.fromCity === cityId ? r.toCity : r.fromCity];
      const dist = distanceKm(c, other);
      const acModel = r.aircraftUid
        ? AIRCRAFT_BY_ID[al.aircraft.find(a => a.uid === r.aircraftUid)?.modelId]?.name
        : null;
      rows.push({ al, other, dist, acModel, route: r });
    }
  }
  rows.sort((a, b) => a.al.id.localeCompare(b.al.id) || a.dist - b.dist);
  openModal({
    title: `${c.nameZh} (${c.iata}) 相关航线`,
    body: `
      <div class="muted small" style="margin-bottom:8px">
        ${regionLabel(c.region)} · <span class="stars">${'★'.repeat(c.size)}</span> · ${routesAtCity(c.id)}/${cityRouteSlots(c)} 槽位
      </div>
      ${rows.length === 0 ? '<p class="muted">目前无任何航司在此城市运营。</p>' : `
        <div class="table-wrap"><table class="game-table">
          <thead><tr><th>航司</th><th>目的地</th><th>距离</th><th>机型</th><th>载荷</th></tr></thead>
          <tbody>${rows.map(x => `
            <tr ${x.al.isPlayer ? 'class="me"' : ''}>
              <td><span class="dot" style="background:${x.al.color}"></span> ${x.al.nameShort}${x.al.isPlayer ? '（你）' : ''}</td>
              <td>${x.other.nameZh} (${x.other.iata})</td>
              <td>${x.dist}km</td>
              <td>${x.acModel || '<span class="muted">无</span>'}</td>
              <td>${x.route.lastLoadFactor ? Math.round(x.route.lastLoadFactor * 100) + '%' : '—'}</td>
            </tr>`).join('')}</tbody>
        </table></div>
      `}
    `,
    actions: [{ label: '关闭', primary: true, onClick: closeModal }],
  });
}

// ----- 财报 -----
function renderFinance() {
  const p = getPlayer();
  const rep = state.lastQuarterReports[p.id];
  if (!rep) return `<div class="panel"><h3>财报</h3><p class="muted">先结束一个季度查看数据。</p></div>`;
  return `
    <div class="panel">
      <h3>${state.year} Q${state.quarter} · 上季度损益</h3>
      <div class="finance-grid">
        <div class="fin-card pos"><span>营业收入</span><b>$${fmt(rep.revenue)}M</b></div>
        <div class="fin-card neg"><span>燃油</span><b>$${fmt(rep.fuel)}M</b></div>
        <div class="fin-card neg"><span>着陆费</span><b>$${fmt(rep.landing)}M</b></div>
        <div class="fin-card neg"><span>客舱服务</span><b>$${fmt(rep.service)}M</b></div>
        <div class="fin-card neg"><span>安保 / 合规</span><b>$${fmt(rep.safety)}M</b></div>
        <div class="fin-card neg"><span>机队维护</span><b>$${fmt(rep.maintenance)}M</b></div>
        <div class="fin-card big ${netProfit(rep) >= 0 ? 'pos' : 'neg'}"><span>净利润</span><b>$${fmt(netProfit(rep))}M</b></div>
      </div>
      <p class="muted">本季载客 ${Math.round(rep.passengers).toLocaleString()} 人次</p>
    </div>
  `;
}
function netProfit(r) {
  return r.revenue - r.fuel - r.landing - r.service - r.safety - r.maintenance;
}

// ----- 排行 -----
function renderLeaderboard() {
  const scored = state.airlines.map(al => ({
    al,
    score: al.cash + al.aircraft.length * 30 + al.routes.length * 20 + al.prestige * 5,
  }));
  scored.sort((a, b) => b.score - a.score);
  return `
    <div class="panel">
      <h3>4 家航司排行</h3>
      <table class="game-table">
        <thead><tr><th>#</th><th>航司</th><th>现金</th><th>机队</th><th>航线</th><th>声望</th><th>综合分</th></tr></thead>
        <tbody>${scored.map((s, i) => `
          <tr class="${s.al.isPlayer ? 'me' : ''}">
            <td>${i + 1}</td>
            <td><span class="dot" style="background:${s.al.color}"></span> ${s.al.nameZh}${s.al.isPlayer ? '（你）' : ''}${s.al.bankrupt ? ' <span class="bad">破产</span>' : ''}</td>
            <td>$${fmt(s.al.cash)}M</td>
            <td>${s.al.aircraft.length}</td>
            <td>${s.al.routes.length}</td>
            <td>${Math.round(s.al.prestige)}</td>
            <td><b>${Math.round(s.score)}</b></td>
          </tr>`).join('')}</tbody>
      </table>
    </div>
  `;
}

// ----- 事件历史 -----
function renderHistory() {
  if (state.eventLog.length === 0) return `<div class="panel"><h3>事件历史</h3><p class="muted">还没有事件发生。</p></div>`;
  const items = state.eventLog.map(id => {
    const ev = EVENTS.find(e => e.id === id);
    if (!ev) return '';
    const impacts = describeEvent(ev);
    const impactList = impacts.length === 0
      ? '<ul class="event-impact"><li class="neutral">无机制性影响（仅剧情）</li></ul>'
      : `<ul class="event-impact">${impacts.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
    return `<li>
      <b>${ev.triggerYear} Q${ev.triggerQuarter}</b> · ${ev.nameZh}<br>
      <span class="muted">${ev.descZh}</span>
      ${impactList}
    </li>`;
  }).join('');
  return `<div class="panel">
    <h3>已发生事件 (${state.eventLog.length})</h3>
    <p class="muted small">每条事件下方列出其对游戏的具体机制影响。</p>
    <ul class="event-list">${items}</ul>
  </div>`;
}

// ----- 情报 (对手概况) -----
function renderIntel() {
  const competitors = state.airlines.filter(a => !a.isPlayer);
  if (!intelSelectedCompetitor || !competitors.find(a => a.id === intelSelectedCompetitor)) {
    intelSelectedCompetitor = competitors[0]?.id;
  }
  const sel = state.airlines.find(a => a.id === intelSelectedCompetitor);

  let html = `<div class="panel">
    <h3>📰 对手航司情报</h3>
    <div class="competitor-tabs">
      ${competitors.map(al => `
        <button class="comp-tab ${al.id === intelSelectedCompetitor ? 'active' : ''}" data-aid="${al.id}">
          <span class="dot" style="background:${al.color}"></span>
          <span>${al.nameZh}</span>
        </button>
      `).join('')}
    </div>`;

  if (sel) {
    const totalCap = sel.aircraft.reduce((s, a) => s + AIRCRAFT_BY_ID[a.modelId].capacity, 0);
    html += `
      <div class="competitor-stats">
        <div><span class="lbl">现金</span><b>$${fmt(sel.cash)}M</b></div>
        <div><span class="lbl">机队规模</span><b>${sel.aircraft.length} 架 / ${totalCap} 座</b></div>
        <div><span class="lbl">航线数</span><b>${sel.routes.length}</b></div>
        <div><span class="lbl">声望</span><b>${Math.round(sel.prestige)}</b></div>
        <div><span class="lbl">主基地</span><b>${CITY_BY_ID[sel.hubCity].nameZh} (${sel.hubCity})</b></div>
        ${sel.bankrupt ? '<div class="bad" style="grid-column:1/-1">⚠️ 已破产</div>' : ''}
      </div>
      <h4 style="margin:14px 0 6px">机型分布</h4>
      <div class="muted small">${aircraftBreakdown(sel)}</div>
      <h4 style="margin:14px 0 6px">航线列表 (${sel.routes.length})</h4>
      <div class="table-wrap"><table class="game-table">
        <thead><tr><th>航线</th><th>距离</th><th>机型</th><th>票价</th><th>载荷</th></tr></thead>
        <tbody>${sel.routes.map(r => {
          const a = CITY_BY_ID[r.fromCity], b = CITY_BY_ID[r.toCity];
          const acm = r.aircraftUid ? AIRCRAFT_BY_ID[sel.aircraft.find(x => x.uid === r.aircraftUid)?.modelId]?.name : '<span class="muted">无</span>';
          return `<tr>
            <td>${a.iata}-${b.iata} <span class="muted small">${a.nameZh}-${b.nameZh}</span></td>
            <td>${distanceKm(a, b)}km</td>
            <td>${acm}</td>
            <td>$${r.fare}</td>
            <td>${r.lastLoadFactor ? Math.round(r.lastLoadFactor * 100) + '%' : '—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <h4 style="margin:14px 0 6px">最近 4 季度动作</h4>
      ${renderCompetitorRecentActions(sel.id)}
    `;
  }
  html += `</div>`;
  return html;
}

function aircraftBreakdown(al) {
  const counts = {};
  for (const ac of al.aircraft) {
    const m = AIRCRAFT_BY_ID[ac.modelId];
    counts[m.name] = (counts[m.name] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `${name} ×${n}`).join(' · ') || '无';
}

function renderCompetitorRecentActions(airlineId) {
  const entries = state.intelLog.slice().reverse().slice(0, 4);
  if (entries.length === 0) return '<p class="muted">无近期动作</p>';
  const filtered = entries.map(e => ({
    year: e.year, quarter: e.quarter,
    items: e.items.filter(it => it.airlineId === airlineId),
  })).filter(e => e.items.length > 0);
  if (filtered.length === 0) return '<p class="muted">该对手近期按兵不动</p>';
  return filtered.map(e => `
    <div class="intel-quarter">
      <h4>${e.year} Q${e.quarter}</h4>
      <ul class="intel-list">${e.items.map(it => `<li>${escapeHtml(it.desc)}</li>`).join('')}</ul>
    </div>
  `).join('');
}

// ----- 策略 (竞争快照 + 建议) -----
function renderStrategy() {
  const comp = computeCompetition();
  const recs = computeRecommendations();

  let html = `<div class="panel"><h3>🎯 航线竞争快照</h3>
    <p class="muted small">市场份额由 <b>价格弹性 ${glossaryBtn('elasticity')}</b> 与 <b>马太效应 ${glossaryBtn('matthew')}</b> 决定。点 ? 看公式。</p>`;
  if (comp.length === 0) {
    html += `<p class="muted">还没有航线。</p>`;
  } else {
    html += `<div class="table-wrap"><table class="game-table">
      <thead><tr><th>航线</th><th>你的份额 ${glossaryBtn('marketShare')}</th><th>对手</th></tr></thead><tbody>`;
    for (const c of comp) {
      const a = CITY_BY_ID[c.route.fromCity], b = CITY_BY_ID[c.route.toCity];
      const shareCls = c.myShare >= 0.7 ? 'pos' : c.myShare >= 0.4 ? '' : 'warn';
      const oppText = c.opponents.length === 0
        ? '<span class="muted">独占</span>'
        : c.opponents.map(o => `<span class="dot" style="background:${o.color}"></span>${o.name}`).join(' ');
      html += `<tr><td>${a.nameZh}-${b.nameZh}</td><td><span class="${shareCls}">${Math.round(c.myShare * 100)}%</span></td><td>${oppText}</td></tr>`;
    }
    html += `</tbody></table></div>`;
  }
  html += `</div>`;

  html += `<div class="panel"><h3>💡 本季建议</h3>`;
  if (recs.length === 0) {
    html += `<p class="muted">运营平稳，暂无紧迫建议。</p>`;
  } else {
    html += `<ul class="rec-list">`;
    for (const r of recs) html += `<li class="rec rec-${r.severity}">
      <span class="rec-icon">${r.icon}</span>
      <div class="rec-body">
        <div class="rec-text">${escapeHtml(r.text)}</div>
        ${r.reason ? `<div class="rec-reason"><span class="rec-why">为什么：</span>${escapeHtml(r.reason)}</div>` : ''}
      </div>
    </li>`;
    html += `</ul>`;
  }
  html += `</div>`;
  return html;
}

function attachTabHandlers() {
  if (currentTab === 'routes') attachRouteHandlers();
  else if (currentTab === 'fleet') attachFleetHandlers();
  else if (currentTab === 'cities') attachCitiesHandlers();
  else if (currentTab === 'intel') {
    $$('.comp-tab').forEach(b => b.addEventListener('click', () => {
      intelSelectedCompetitor = b.dataset.aid;
      renderTabBody();
    }));
  }
}

// ===== 结束季度 =====
function onEndTurnConfirm() {
  if (state.gameOver) { showEndGame(); return; }
  const actions = state.thisTurnActions || [];
  const summary = actions.length === 0
    ? '<p class="muted">本季度你还没有做任何操作。</p>'
    : `<p>本季度你执行了以下 <b>${actions.length}</b> 个操作：</p>
       <ul class="action-list">${actions.map(a => `<li>${escapeHtml(a.desc)}</li>`).join('')}</ul>`;
  openModal({
    title: `${state.year} Q${state.quarter} · 结束季度？`,
    body: `${summary}
      <p class="muted small" style="margin-top:.8em">确认后会推进到下一季度，AI 行动 + 历史事件依次结算。</p>`,
    actions: [
      { label: '继续本季操作', onClick: closeModal },
      { label: '确认结束 →', primary: true, onClick: () => { closeModal(); doEndTurn(); } },
    ],
  });
}

function doEndTurn() {
  clearTurnActions();
  const triggered = advanceQuarter(runAiTurn, runAiChoicesForEvent);
  state.pendingDialog = { type: 'quarter', triggered: triggered.map(e => e.id) };
  saveGame();
  const choiceEv = triggered.find(e => e.choice);
  if (choiceEv) {
    state.pendingEvent = choiceEv.id;
    saveGame();
    showEventChoice(choiceEv.id);
    return;
  }
  // 玩家现金告急 → 强制出售飞机
  const player = getPlayer();
  if (player && player.cash < 0 && !player.bankrupt) {
    showForceSellModal();
    return;
  }
  showQuarterReport();
}

// 现金 < 0 时强制玩家出售飞机
function showForceSellModal() {
  const p = getPlayer();
  if (!p) return;
  if (p.aircraft.length === 0) {
    p.bankrupt = true;
    state.gameOver = true;
    saveGame();
    showBankruptcyModal();
    return;
  }
  const renderModal = () => {
    const rows = p.aircraft.map(ac => {
      const m = AIRCRAFT_BY_ID[ac.modelId];
      const yrs = ac.ageQuarters / 4;
      const estResale = Math.max(m.purchasePrice * 0.25, m.purchasePrice * Math.pow(0.95, yrs) * 0.7);
      const route = ac.routeId ? p.routes.find(r => r.id === ac.routeId) : null;
      const routeLabel = route
        ? `${CITY_BY_ID[route.fromCity].iata}-${CITY_BY_ID[route.toCity].iata}`
        : '闲置';
      return `<tr>
        <td>${m.name}</td>
        <td>${yrs.toFixed(1)} 年</td>
        <td>${routeLabel}</td>
        <td class="pos">$${estResale.toFixed(1)}M</td>
        <td><button class="primary-btn small force-sell-btn" data-uid="${ac.uid}">出售</button></td>
      </tr>`;
    }).join('');
    openModal({
      title: '⚠️ 现金告急 — 必须出售飞机',
      body: `
        <p class="bad" style="font-size:16px;font-weight:600">
          当前现金 $${p.cash.toFixed(1)}M
        </p>
        <p class="muted small">现金已为负数。请出售飞机直到现金回正。若无机可卖将宣告破产。</p>
        <div class="table-wrap"><table class="game-table">
          <thead><tr><th>机型</th><th>机龄</th><th>当前任务</th><th>预计回收</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      `,
      actions: [],  // 不允许关闭
    });
    $$('.force-sell-btn').forEach(b => {
      b.addEventListener('click', () => {
        const uid = b.dataset.uid;
        const ac = p.aircraft.find(a => a.uid === uid);
        if (!ac) return;
        const m = AIRCRAFT_BY_ID[ac.modelId];
        const r = sellAircraft(p, uid);
        if (!r.ok) return;
        logPlayerAction('forcesell', `紧急出售 ${m.name}，回收 $${r.resale.toFixed(1)}M`);
        saveGame();
        if (p.cash >= 0) {
          closeModal();
          rerender();
          showQuarterReport();
        } else if (p.aircraft.length === 0) {
          p.bankrupt = true;
          state.gameOver = true;
          saveGame();
          closeModal();
          showBankruptcyModal();
        } else {
          renderModal();  // 继续选
        }
      });
    });
  };
  renderModal();
}

function showBankruptcyModal() {
  openModal({
    title: '💀 公司破产',
    body: `
      <p>你的公司已资不抵债，无机可卖、无以为继。</p>
      <p class="muted">在 ${state.year} Q${state.quarter}，<b>${getPlayer().nameZh}</b> 宣告破产，游戏结束。</p>
    `,
    actions: [
      { label: '回到首页', onClick: () => { clearSave(); closeModal(); showStartMenu(); } },
      { label: '再玩一局', primary: true, onClick: () => { clearSave(); closeModal(); showAirlinePicker(); } },
    ],
  });
}

function showQuarterReport() {
  const p = getPlayer();
  const rep = state.lastQuarterReports[p.id];
  if (state.gameOver) { showEndGame(); return; }
  if (!rep) { rerender(); return; }
  const triggeredIds = state.pendingDialog?.triggered || [];
  const events = triggeredIds.map(id => EVENTS.find(e => e.id === id)).filter(Boolean);
  const eventBlock = events.length === 0
    ? '<p class="muted">本季无重大行业事件。</p>'
    : '<h4 style="margin-top:1em">本季事件及游戏影响：</h4>'
      + events.map(e => {
          const impacts = describeEvent(e);
          const impactList = impacts.length === 0
            ? '<ul class="event-impact"><li class="neutral">无机制性影响（仅剧情）</li></ul>'
            : `<ul class="event-impact">${impacts.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
          return `<div style="margin:10px 0 12px;padding:10px 12px;background:#f8fafc;border-radius:8px;border-left:3px solid var(--primary)">
            <b>📰 ${e.nameZh}</b>
            <div class="muted small" style="margin:4px 0">${e.descZh}</div>
            ${impactList}
          </div>`;
        }).join('');
  openModal({
    title: `${state.year} Q${state.quarter} · 新季度开局`,
    body: `
      <div class="report-summary">
        <div><span class="lbl">上季净利润</span><b class="${netProfit(rep) >= 0 ? 'pos' : 'neg'}">$${fmt(netProfit(rep))}M</b></div>
        <div><span class="lbl">载客</span><b>${Math.round(rep.passengers).toLocaleString()}</b></div>
        <div><span class="lbl">现金</span><b>$${fmt(p.cash)}M</b></div>
      </div>
      ${eventBlock}
    `,
    actions: [{
      label: '继续', primary: true, onClick: () => {
        state.pendingDialog = null; saveGame(); closeModal(); rerender();
      },
    }],
  });
}

function showEventChoice(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev || !ev.choice) { state.pendingEvent = null; return; }
  const p = getPlayer();
  const impacts = describeEvent(ev);
  const impactList = impacts.length === 0
    ? ''
    : `<h4 style="margin:.8em 0 .4em">事件影响</h4><ul class="event-impact">${impacts.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
  openModal({
    title: `📰 ${ev.triggerYear} Q${ev.triggerQuarter} · ${ev.nameZh}`,
    body: `<p>${ev.descZh}</p>${impactList}<p><b>${ev.choice.prompt}</b></p>`,
    actions: ev.choice.options.map(opt => ({
      label: opt.label,
      onClick: () => {
        applyChoiceOption(opt, p);
        state.pendingEvent = null;
        saveGame();
        closeModal();
        if (p.cash < 0 && !p.bankrupt) { showForceSellModal(); return; }
        showQuarterReport();
      },
    })),
  });
}

function showEndGame() {
  const scored = state.airlines.map(al => ({
    al,
    score: al.cash + al.aircraft.length * 30 + al.routes.length * 20 + al.prestige * 5,
  }));
  scored.sort((a, b) => b.score - a.score);
  const me = scored.find(s => s.al.isPlayer);
  const rank = scored.indexOf(me) + 1;

  // === 计算 5 个分项奖 ===
  const awards = computeAwards();
  const playerWins = awards.filter(a => a.winner && a.winner.id === me.al.id);

  openModal({
    title: '🏆 2025 Q4 · 25 年终局',
    body: `
      <h3 style="margin:0 0 .5em">你最终排名 第 ${rank} 名 · 获得 ${playerWins.length} 个分项奖</h3>
      <table class="game-table">
        <thead><tr><th>#</th><th>航司</th><th>综合分</th><th>现金</th><th>机队</th><th>声望</th></tr></thead>
        <tbody>${scored.map((s, i) => `
          <tr class="${s.al.isPlayer ? 'me' : ''}">
            <td>${i + 1}</td>
            <td><span class="dot" style="background:${s.al.color}"></span> ${s.al.nameZh}</td>
            <td><b>${Math.round(s.score)}</b></td>
            <td>$${fmt(s.al.cash)}M</td>
            <td>${s.al.aircraft.length}</td>
            <td>${Math.round(s.al.prestige)}</td>
          </tr>`).join('')}</tbody>
      </table>

      <h3 style="margin:1em 0 .5em">🎖️ 分项奖</h3>
      <div class="awards-grid">
        ${awards.map(aw => `
          <div class="award-card ${aw.winner && aw.winner.id === me.al.id ? 'mine' : ''}">
            <div class="award-icon">${aw.icon}</div>
            <div class="award-info">
              <div class="award-name">${aw.name}</div>
              <div class="award-winner">
                ${aw.winner
                  ? `<span class="dot" style="background:${aw.winner.color}"></span> <b>${aw.winner.nameShort}</b> · ${aw.statText}`
                  : '<span class="muted">无人达成</span>'}
              </div>
              <div class="award-desc muted small">${aw.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `,
    actions: [
      { label: '回到首页', onClick: () => { clearSave(); closeModal(); showStartMenu(); } },
      { label: '再玩一局', primary: true, onClick: () => { clearSave(); closeModal(); showAirlinePicker(); } },
    ],
  });
}

// 计算 5 个分项奖
function computeAwards() {
  const valid = state.airlines.filter(a => !a.bankrupt && state.careerStats[a.id]);
  const award = (key, name, icon, desc, scoreFn, fmtFn) => {
    let best = null, bestScore = -Infinity, bestStats = null;
    for (const al of valid) {
      const cs = state.careerStats[al.id];
      const s = scoreFn(cs, al);
      if (s !== null && s > bestScore) { bestScore = s; best = al; bestStats = cs; }
    }
    return { key, name, icon, desc, winner: best, statText: best ? fmtFn(bestScore, bestStats) : '—' };
  };
  return [
    award('profit', '利润王', '🏆', '累计净利润最高',
      cs => cs.totalProfit,
      v => `累计 $${fmt(v)}M 净利`),
    award('network', '网络帝国', '🌐', '航线数 × 拥有城市数 最高',
      (cs, al) => al.routes.length * new Set(al.routes.flatMap(r => [r.fromCity, r.toCity])).size,
      v => `${v} 网络分`),
    award('green', '绿色先锋', '🌱', '单位载客油耗最低（节能效率）',
      (cs) => cs.totalSeatKm > 0 ? -(cs.totalFuelLiters / cs.totalSeatKm) : null,
      (v, cs) => `每座公里 ${(cs.totalFuelLiters / cs.totalSeatKm).toFixed(3)} L`),
    award('prestige', '奢华品牌', '⭐', '终局声望最高',
      (cs, al) => al.prestige,
      v => `声望 ${Math.round(v)}`),
    award('load', '准时大师', '🛬', '全程平均载荷率最高',
      cs => cs.lfCount > 0 ? cs.lfSum / cs.lfCount : null,
      v => `均载荷 ${Math.round(v * 100)}%`),
  ];
}

// ===== 菜单 (三档: 保存 / 读取 / 回到首页) =====
function openMenu() {
  openModal({
    title: '⚙️ 游戏菜单',
    body: `
      <div class="menu-buttons">
        <button class="primary-btn big" id="menu-save">💾 保存游戏</button>
        <button class="primary-btn big" id="menu-load">📂 读取存档</button>
        <button class="ghost-btn big" id="menu-home">🏠 回到首页</button>
      </div>
    `,
    actions: [{ label: '关闭', primary: true, onClick: closeModal }],
  });
  $('#menu-save').addEventListener('click', showMenuSave);
  $('#menu-load').addEventListener('click', showMenuLoad);
  $('#menu-home').addEventListener('click', () => {
    if (!confirm('回到首页将保留当前自动存档与所有手动存档，确定？')) return;
    closeModal();
    showStartMenu();
  });
}

function showMenuSave() {
  const slots = listSaveSlots();
  openModal({
    title: '💾 保存到槽位',
    body: `<div class="slot-list">${slots.map((s, i) => slotCardHtml(s, i + 1, 'save')).join('')}</div>`,
    actions: [
      { label: '← 返回菜单', onClick: openMenu },
      { label: '关闭', primary: true, onClick: closeModal },
    ],
  });
  attachSlotHandlers($('.modal'), 'menu-save');
}

function showMenuLoad() {
  const slots = listSaveSlots();
  openModal({
    title: '📂 读取存档',
    body: `<div class="slot-list">${slots.map((s, i) => slotCardHtml(s, i + 1, 'load')).join('')}</div>`,
    actions: [
      { label: '← 返回菜单', onClick: openMenu },
      { label: '关闭', primary: true, onClick: closeModal },
    ],
  });
  attachSlotHandlers($('.modal'), 'menu-load');
}

// ===== Modal / Toast =====
function openModal({ title, body, actions = [] }) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-mask"></div>
    <div class="modal">
      <h2>${title}</h2>
      <div class="modal-body">${body}</div>
      <div class="modal-actions">
        ${actions.map((a, i) => `<button class="${a.primary ? 'primary-btn' : 'ghost-btn'}" data-i="${i}">${a.label}</button>`).join('')}
      </div>
    </div>
  `;
  $$('.modal-actions button', root).forEach((btn, i) => {
    btn.addEventListener('click', () => actions[i].onClick && actions[i].onClick());
  });
}
function closeModal() { $('#modal-root').innerHTML = ''; }
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

function fmt(n) {
  if (typeof n !== 'number') return '0';
  if (Math.abs(n) >= 10000) return (n / 1000).toFixed(1) + 'k';
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 1) return n.toFixed(1);
  return n.toFixed(2);
}
function flagOf(country) {
  const map = {
    CN: '🇨🇳', US: '🇺🇸', DE: '🇩🇪', SG: '🇸🇬', JP: '🇯🇵', HK: '🇭🇰', KR: '🇰🇷',
    TH: '🇹🇭', IN: '🇮🇳', AE: '🇦🇪', GB: '🇬🇧', FR: '🇫🇷', NL: '🇳🇱', AU: '🇦🇺', BR: '🇧🇷',
    RU: '🇷🇺', TR: '🇹🇷', MX: '🇲🇽', EG: '🇪🇬', ZA: '🇿🇦', CA: '🇨🇦', AR: '🇦🇷', CO: '🇨🇴',
  };
  return map[country] || '🏳️';
}
function regionLabel(r) {
  return {
    asia: '亚洲', europe: '欧洲', namerica: '北美', samerica: '南美',
    mideast: '中东', oceania: '大洋洲', africa: '非洲',
  }[r] || r;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
