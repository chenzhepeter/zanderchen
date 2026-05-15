import {
  state, getPlayer, saveGame, loadGame, clearSave, hasSave, initNewGame,
  saveToSlot, loadFromSlot, deleteSlot, listSaveSlots, NUM_SLOTS,
  logPlayerAction, clearTurnActions,
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
} from './sim.js';
import { runAiTurn } from './ai.js';
import { buildMapSvg, drawMapContents } from './map.js';
import { computeCompetition, computeRecommendations } from './intel.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let currentTab = 'routes';
let cityTabSort = { col: 'region', dir: 'asc' };

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
      </nav>
      <section id="tab-body" class="tab-body"></section>
      <div class="end-turn-area">
        <button id="end-turn-btn" class="primary-btn big">结束季度 →</button>
      </div>
    </div>
    <div id="modal-root"></div>
    <div id="toast"></div>
  `;
  $('#end-turn-btn').addEventListener('click', onEndTurnConfirm);
  $('#menu-btn').addEventListener('click', openMenu);
  $$('.tab').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));
}

// ===== Start menu (centered, traditional layout) =====
function showStartMenu() {
  $('#start-screen').hidden = false;
  $('#game-screen').hidden = true;
  const root = $('#start-screen');
  root.innerHTML = `
    <div class="start-card centered">
      <h1 class="game-title">✈️ 航空霸业 Lite</h1>
      <p class="subtitle">2000 → 2030 · 30 年航线经营沙盘</p>
      <p class="hint">亲历 21 世纪初的航空业大事件：9/11、SARS、金融危机、火山灰、新冠、超音速复兴⋯</p>
      <div class="menu-buttons">
        <button class="primary-btn big" id="new-game-btn">🎮 开始新游戏</button>
        <button class="ghost-btn big" id="load-game-btn">📂 读取存档</button>
      </div>
    </div>
  `;
  $('#new-game-btn').addEventListener('click', showAirlinePicker);
  $('#load-game-btn').addEventListener('click', showLoadSlotsScreen);
}

function showAirlinePicker() {
  const root = $('#start-screen');
  root.innerHTML = `
    <div class="start-card centered">
      <h1 class="game-title">✈️ 选择航司</h1>
      <p class="hint">点选一家航司开始 2000 Q1。</p>
      <div class="airline-pick">
        ${AIRLINES.map(a => `
          <button class="airline-card" data-id="${a.id}" style="--c:${a.color}">
            <div class="flag">${flagOf(a.country)}</div>
            <div class="name">${a.nameZh}</div>
            <div class="hub">主基地 ${CITY_BY_ID[a.hubCity].nameZh} (${a.hubCity})</div>
            <div class="stats">
              <span>💰 $${a.initialCash}M</span>
              <span>✈️ ${a.initialFleet.reduce((s, f) => s + f.count, 0)} 架</span>
              <span>⭐ 声望 ${a.initialPrestige}</span>
            </div>
          </button>
        `).join('')}
      </div>
      <button class="ghost-btn" id="back-to-menu">← 返回</button>
    </div>
  `;
  $$('.airline-card', root).forEach(b => {
    b.addEventListener('click', () => {
      initNewGame(b.dataset.id);
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
  const autoSave = hasSave();
  root.innerHTML = `
    <div class="start-card centered">
      <h1 class="game-title">📂 读取存档</h1>
      <p class="hint">选择要读取的存档。共 ${NUM_SLOTS} 个手动槽位 + 1 个自动存档。</p>
      <div class="slot-list">
        ${autoSave ? `
          <div class="slot-card auto">
            <div class="slot-num">📌 自动</div>
            <div class="slot-info">${autoSaveLabel()}</div>
            <div class="slot-actions">
              <button class="primary-btn small" id="load-auto">继续</button>
            </div>
          </div>` : ''}
        ${slots.map((s, i) => slotCardHtml(s, i + 1, 'load')).join('')}
      </div>
      <button class="ghost-btn" id="back-to-menu">← 返回</button>
    </div>
  `;
  attachSlotHandlers(root, 'load');
  const autoBtn = $('#load-auto');
  if (autoBtn) autoBtn.addEventListener('click', () => {
    if (loadGame()) { showGameView(); toast('已读取自动存档'); }
  });
  $('#back-to-menu').addEventListener('click', showStartMenu);
}

function autoSaveLabel() {
  try {
    const raw = localStorage.getItem('airline.save');
    const p = JSON.parse(raw);
    const me = p.state.airlines?.find(a => a.id === p.state.playerId);
    const d = new Date(p.savedAt);
    return `<b>${escapeHtml(me?.nameZh || '?')}</b> · ${p.state.year} Q${p.state.quarter} · 保存于 ${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return '自动存档'; }
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
        if (loadFromSlot(slot)) {
          saveGame();
          if (mode === 'menu-load') closeModal();
          showGameView();
          toast(`已读取槽 ${slot}`);
        } else toast('读取失败');
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
      <p>你是 <b>${player.nameZh}</b> 的新任 CEO。本游戏共 <b>120 季度（2000 Q1 → 2030 Q4）</b>。</p>
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
      <div><span class="lbl">债务</span><span class="val">$${fmt(p.debt)}M</span></div>
      <div><span class="lbl">机队</span><span class="val">${p.aircraft.length}</span></div>
      <div><span class="lbl">航线</span><span class="val">${p.routes.length}</span></div>
      <div><span class="lbl">声望</span><span class="val">${Math.round(p.prestige)}</span></div>
      <div><span class="lbl">油价</span><span class="val">${state.fuelPrice.toFixed(2)}×</span></div>
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
  attachTabHandlers();
}

// ----- 航线 -----
function renderRoutes() {
  const p = getPlayer();
  const rows = p.routes.map(r => {
    const a = CITY_BY_ID[r.fromCity], b = CITY_BY_ID[r.toCity];
    const dist = distanceKm(a, b);
    const breakEven = computeBreakEvenFare(p, r);
    const fareMin = Math.max(20, Math.round(breakEven * 0.5));
    const fareMax = Math.max(fareMin + 50, Math.round(breakEven * 2.8));
    const bePct = ((breakEven - fareMin) / (fareMax - fareMin)) * 100;

    const curAc = r.aircraftUid ? p.aircraft.find(a => a.uid === r.aircraftUid) : null;
    const curAcModel = curAc ? AIRCRAFT_BY_ID[curAc.modelId] : null;

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
        return `<option value="${ac.uid}" ${isCur ? 'selected' : ''}>${m.name} · ${m.capacity}座${isCur ? '（当前）' : ''}</option>`;
      }).join('')}
    </select>`;

    return `
      <tr data-route="${r.id}">
        <td>
          <div class="route-name">${a.nameZh} — ${b.nameZh}</div>
          <div class="muted small">${dist} km · 盈亏价 $${breakEven}</div>
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
        <td><button class="mini r-close" data-route="${r.id}">关闭</button></td>
      </tr>`;
  }).join('');
  return `
    <div class="panel">
      <div class="panel-head">
        <h3>航线 (${p.routes.length})</h3>
        <button id="open-route-btn" class="primary-btn small">+ 开通新航线</button>
      </div>
      <div class="table-wrap"><table class="game-table routes-table">
        <thead><tr>
          <th>城市对</th>
          <th>票价（拖动）</th>
          <th>飞机</th>
          <th>载荷</th>
          <th>上季利润</th>
          <th></th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="6" class="muted">还没有航线，点右上方"开通新航线"。</td></tr>`}</tbody>
      </table></div>
      <p class="muted small">提示：每条航线对应 1 架飞机。要增加同城市对运力，可再开一条独立航线。同城市对多家航司同时在飞会显著降低载荷率。</p>
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
  const openBtn = $('#open-route-btn');
  if (openBtn) openBtn.addEventListener('click', openNewRouteDialog);
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
        return `<option value="${ac.uid}">${m.name} · ${m.capacity}座 · ${m.rangeKm}km</option>`;
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
  return `
    <div class="panel">
      <div class="panel-head">
        <h3>机队 (${p.aircraft.length})</h3>
        <button id="buy-aircraft-btn" class="primary-btn small">+ 购买飞机</button>
      </div>
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
      if (!confirm('确认出售？按折旧价回收。')) return;
      const ac = p.aircraft.find(a => a.uid === uid);
      const m = AIRCRAFT_BY_ID[ac.modelId];
      const r = sellAircraft(p, uid);
      if (r.ok) {
        toast(`已售出，回收 $${fmt(r.resale)}M`);
        logPlayerAction('sell', `出售 ${m.name}，回收 $${r.resale.toFixed(1)}M`);
        saveGame();
      }
      rerender();
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
      case 'size': return (a, b) => dir * (a.size - b.size);
      case 'demand': return (a, b) => dir * (a.baseDemand - b.baseDemand);
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
    return `
      <tr>
        <td><a href="#" class="city-link" data-id="${c.id}">${c.nameZh}</a> <span class="muted small">(${c.iata})</span></td>
        <td>${regionLabel(c.region)}</td>
        <td>${'★'.repeat(c.size)}</td>
        <td>${c.baseDemand}</td>
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
          ${headerCell('size', '规模')}
          ${headerCell('demand', '基础需求')}
          ${headerCell('status', '状态')}
        </tr></thead>
        <tbody>${trs}</tbody>
      </table></div>
      <p class="muted small">点击表头排序 · 点击城市名查看相关航线</p>
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
        ${regionLabel(c.region)} · 规模 ${'★'.repeat(c.size)} · 基础需求 ${c.baseDemand}
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
        <div class="fin-card neg"><span>债务利息</span><b>$${fmt(rep.interest)}M</b></div>
        <div class="fin-card big ${netProfit(rep) >= 0 ? 'pos' : 'neg'}"><span>净利润</span><b>$${fmt(netProfit(rep))}M</b></div>
      </div>
      <p class="muted">本季载客 ${Math.round(rep.passengers).toLocaleString()} 人次</p>
    </div>
  `;
}
function netProfit(r) {
  return r.revenue - r.fuel - r.landing - r.service - r.safety - r.maintenance - r.interest;
}

// ----- 排行 -----
function renderLeaderboard() {
  const scored = state.airlines.map(al => ({
    al,
    score: al.cash - al.debt + al.aircraft.length * 30 + al.routes.length * 20 + al.prestige * 5,
  }));
  scored.sort((a, b) => b.score - a.score);
  return `
    <div class="panel">
      <h3>4 家航司排行</h3>
      <table class="game-table">
        <thead><tr><th>#</th><th>航司</th><th>现金</th><th>债务</th><th>机队</th><th>航线</th><th>声望</th><th>综合分</th></tr></thead>
        <tbody>${scored.map((s, i) => `
          <tr class="${s.al.isPlayer ? 'me' : ''}">
            <td>${i + 1}</td>
            <td><span class="dot" style="background:${s.al.color}"></span> ${s.al.nameZh}${s.al.isPlayer ? '（你）' : ''}${s.al.bankrupt ? ' <span class="bad">破产</span>' : ''}</td>
            <td>$${fmt(s.al.cash)}M</td>
            <td>$${fmt(s.al.debt)}M</td>
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
    return `<li><b>${ev.triggerYear} Q${ev.triggerQuarter}</b> · ${ev.nameZh}<br><span class="muted">${ev.descZh}</span></li>`;
  }).join('');
  return `<div class="panel"><h3>已发生事件</h3><ul class="event-list">${items}</ul></div>`;
}

// ----- 情报 -----
function renderIntel() {
  const recent = state.intelLog.slice().reverse();
  const comp = computeCompetition();
  const recs = computeRecommendations();

  let html = `<div class="panel"><h3>📰 对手最近动态</h3>`;
  if (recent.length === 0) {
    html += `<p class="muted">还没有情报数据。结束一回合后这里会汇总对手在该季度采取的行动。</p>`;
  } else {
    for (const entry of recent.slice(0, 4)) {
      html += `<div class="intel-quarter"><h4>${entry.year} Q${entry.quarter}</h4>`;
      if (entry.items.length === 0) {
        html += `<p class="muted">对手按兵不动。</p>`;
      } else {
        const byAirline = {};
        for (const it of entry.items) (byAirline[it.airlineId] = byAirline[it.airlineId] || []).push(it);
        html += `<ul class="intel-list">`;
        for (const [aid, items] of Object.entries(byAirline)) {
          const al = state.airlines.find(a => a.id === aid);
          if (!al || al.isPlayer) continue;
          const descs = items.map(it => escapeHtml(it.desc)).join('；');
          html += `<li><span class="dot" style="background:${al.color}"></span><b>${al.nameShort}</b>：${descs}</li>`;
        }
        html += `</ul>`;
      }
      html += `</div>`;
    }
  }
  html += `</div>`;

  html += `<div class="panel"><h3>🎯 航线竞争快照</h3>`;
  if (comp.length === 0) {
    html += `<p class="muted">还没有航线。</p>`;
  } else {
    html += `<div class="table-wrap"><table class="game-table">
      <thead><tr><th>航线</th><th>你的份额</th><th>对手</th></tr></thead><tbody>`;
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
    for (const r of recs) html += `<li class="rec rec-${r.severity}"><span class="rec-icon">${r.icon}</span><span>${escapeHtml(r.text)}</span></li>`;
    html += `</ul>`;
  }
  html += `</div>`;

  return html;
}

function attachTabHandlers() {
  if (currentTab === 'routes') attachRouteHandlers();
  else if (currentTab === 'fleet') attachFleetHandlers();
  else if (currentTab === 'cities') attachCitiesHandlers();
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
  const triggered = advanceQuarter(runAiTurn);
  state.pendingDialog = { type: 'quarter', triggered: triggered.map(e => e.id) };
  saveGame();
  const choiceEv = triggered.find(e => e.choice);
  if (choiceEv) {
    state.pendingEvent = choiceEv.id;
    saveGame();
    showEventChoice(choiceEv.id);
    return;
  }
  showQuarterReport();
}

function showQuarterReport() {
  const p = getPlayer();
  const rep = state.lastQuarterReports[p.id];
  if (state.gameOver) { showEndGame(); return; }
  if (!rep) { rerender(); return; }
  const triggeredIds = state.pendingDialog?.triggered || [];
  const events = triggeredIds.map(id => EVENTS.find(e => e.id === id)).filter(Boolean);
  openModal({
    title: `${state.year} Q${state.quarter} · 新季度开局`,
    body: `
      <div class="report-summary">
        <div><span class="lbl">上季净利润</span><b class="${netProfit(rep) >= 0 ? 'pos' : 'neg'}">$${fmt(netProfit(rep))}M</b></div>
        <div><span class="lbl">载客</span><b>${Math.round(rep.passengers).toLocaleString()}</b></div>
        <div><span class="lbl">现金</span><b>$${fmt(p.cash)}M</b></div>
      </div>
      ${events.length === 0 ? '<p class="muted">本季无重大行业事件。</p>' :
      '<h4 style="margin-top:1em">本季事件：</h4><ul>' +
      events.map(e => `<li><b>${e.nameZh}</b><br><span class="muted">${e.descZh}</span></li>`).join('') +
      '</ul>'}
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
  openModal({
    title: `📰 ${ev.triggerYear} Q${ev.triggerQuarter} · ${ev.nameZh}`,
    body: `<p>${ev.descZh}</p><p><b>${ev.choice.prompt}</b></p>`,
    actions: ev.choice.options.map(opt => ({
      label: opt.label,
      onClick: () => {
        applyChoiceOption(opt, p);
        state.pendingEvent = null;
        saveGame();
        closeModal();
        showQuarterReport();
      },
    })),
  });
}

function showEndGame() {
  const scored = state.airlines.map(al => ({
    al,
    score: al.cash - al.debt + al.aircraft.length * 30 + al.routes.length * 20 + al.prestige * 5,
  }));
  scored.sort((a, b) => b.score - a.score);
  const me = scored.find(s => s.al.isPlayer);
  const rank = scored.indexOf(me) + 1;
  openModal({
    title: '🏆 2030 Q4 · 30 年终局',
    body: `
      <h3 style="margin:0 0 .5em">你最终排名 第 ${rank} 名</h3>
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
    `,
    actions: [
      { label: '回到首页', onClick: () => { clearSave(); closeModal(); showStartMenu(); } },
      { label: '再玩一局', primary: true, onClick: () => { clearSave(); closeModal(); showAirlinePicker(); } },
    ],
  });
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
