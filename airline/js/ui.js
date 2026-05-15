import { state, getPlayer, saveGame, loadGame, clearSave, hasSave, initNewGame } from './state.js';
import { CITIES, CITY_BY_ID, distanceKm } from './data/cities.js';
import { AIRCRAFT, AIRCRAFT_BY_ID } from './data/aircraft.js';
import { AIRLINES } from './data/airlines.js';
import { EVENTS } from './data/events.js';
import {
  advanceQuarter, applyChoiceOption,
  buyAircraft, sellAircraft, openRoute, closeRoute,
  assignAircraftToRoute, setFare, setServiceLevel, setAdSpend,
  applyForLanding,
} from './sim.js';
import { runAiTurn } from './ai.js';
import { buildMapSvg, drawMapContents } from './map.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let currentTab = 'routes';

export function bootUi() {
  buildShell();
  // 启动: 优先尝试加载存档
  if (hasSave() && loadGame()) {
    showGameView();
  } else {
    showStartScreen();
  }
}

function buildShell() {
  const app = $('#app');
  app.innerHTML = `
    <div id="start-screen" class="screen"></div>
    <div id="game-screen" class="screen" hidden>
      <header id="hud" class="hud"></header>
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
      </nav>
      <section id="tab-body" class="tab-body"></section>
      <div id="action-bar" class="action-bar">
        <button id="end-turn-btn" class="primary-btn">结束季度 →</button>
        <button id="save-btn" class="ghost-btn">保存</button>
        <button id="menu-btn" class="ghost-btn">菜单</button>
      </div>
    </div>
    <div id="modal-root"></div>
    <div id="toast"></div>
  `;
  // 全局事件代理
  $('#end-turn-btn').addEventListener('click', onEndTurn);
  $('#save-btn').addEventListener('click', () => { saveGame(); toast('已保存'); });
  $('#menu-btn').addEventListener('click', openMenu);
  $$('.tab').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));
}

// ===== Start screen =====
function showStartScreen() {
  $('#start-screen').hidden = false;
  $('#game-screen').hidden = true;
  const root = $('#start-screen');
  root.innerHTML = `
    <div class="start-card">
      <h1>✈️ 航空霸业 Lite</h1>
      <p class="subtitle">2000 → 2030 · 30 年航线经营沙盘</p>
      <p class="hint">选一家航司接手，亲历 21 世纪初的航空业大事件：9/11、SARS、金融危机、火山灰、新冠、电动与超音速复兴……</p>
      <div class="airline-pick">
        ${AIRLINES.map(a => `
          <button class="airline-card" data-id="${a.id}" style="--c:${a.color}">
            <div class="flag">${flagOf(a.country)}</div>
            <div class="name">${a.nameZh}</div>
            <div class="hub">主基地 ${CITY_BY_ID[a.hubCity].nameZh} (${a.hubCity})</div>
            <div class="stats">
              <span>💰 $${a.initialCash}M</span>
              <span>✈️ ${a.initialFleet.reduce((s,f)=>s+f.count,0)} 架</span>
              <span>⭐ 声望 ${a.initialPrestige}</span>
            </div>
          </button>
        `).join('')}
      </div>
      ${hasSave() ? '<button id="continue-btn" class="ghost-btn">继续上次存档</button>' : ''}
    </div>
  `;
  $$('.airline-card', root).forEach(b => {
    b.addEventListener('click', () => {
      initNewGame(b.dataset.id);
      saveGame();
      showGameView();
      // 首次进入引导
      showTutorialModal();
    });
  });
  const cont = $('#continue-btn', root);
  if (cont) cont.addEventListener('click', () => { loadGame(); showGameView(); });
}

function showGameView() {
  $('#start-screen').hidden = true;
  $('#game-screen').hidden = false;
  buildMapSvg($('#world-map'));
  rerender();
  // 启动时若有 pendingEvent，弹出
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
        <li><b>地图</b>顶部是世界地图，蓝色弧线是你的航线，其它颜色是 3 家 AI 对手。</li>
        <li><b>标签页</b>从左到右：航线 / 机队 / 城市 / 财报 / 排行 / 事件历史。</li>
        <li>用 <b>城市</b> 标签申请着陆权，<b>航线</b> 标签开通新航线，<b>机队</b> 标签买飞机。</li>
        <li>点 <b>结束季度</b> 推进时间。每季都可能发生历史事件，留意决策弹窗。</li>
        <li>目标：到 2030 Q4 比 3 家对手积累更多的总资产 + 声望。</li>
      </ol>
    `,
    actions: [{ label: '开始游戏', primary: true, onClick: closeModal }],
  });
}

// ===== Render =====
export function rerender() {
  renderHud();
  drawMapContents($('#world-map'), { onCityClick: onCityClickMap });
  renderTabs();
  renderTabBody();
}

function renderHud() {
  const p = getPlayer();
  const hud = $('#hud');
  hud.innerHTML = `
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
function setTab(tab) {
  currentTab = tab;
  renderTabs();
  renderTabBody();
}

function renderTabBody() {
  const body = $('#tab-body');
  if (currentTab === 'routes') body.innerHTML = renderRoutes();
  else if (currentTab === 'fleet') body.innerHTML = renderFleet();
  else if (currentTab === 'cities') body.innerHTML = renderCities();
  else if (currentTab === 'finance') body.innerHTML = renderFinance();
  else if (currentTab === 'leaderboard') body.innerHTML = renderLeaderboard();
  else if (currentTab === 'history') body.innerHTML = renderHistory();
  attachTabHandlers();
}

// ----- 航线 -----
function renderRoutes() {
  const p = getPlayer();
  const rows = p.routes.map(r => {
    const a = CITY_BY_ID[r.fromCity], b = CITY_BY_ID[r.toCity];
    const dist = distanceKm(a, b);
    const assigned = r.assignedAircraft.length;
    return `
      <tr data-route="${r.id}">
        <td>${a.nameZh} — ${b.nameZh}<br><span class="muted">${dist} km</span></td>
        <td><input type="number" class="r-fare" min="20" value="${r.fare}" /></td>
        <td>
          <select class="r-svc">
            <option value="1" ${r.serviceLevel===1?'selected':''}>经济</option>
            <option value="2" ${r.serviceLevel===2?'selected':''}>标准</option>
            <option value="3" ${r.serviceLevel===3?'selected':''}>豪华</option>
          </select>
        </td>
        <td><input type="number" class="r-ad" min="0" step="0.5" value="${(r.adSpend/1e6).toFixed(1)}" title="百万美元" />M</td>
        <td>${assigned}</td>
        <td>${r.lastLoadFactor ? (r.lastLoadFactor*100).toFixed(0) + '%' : '—'}</td>
        <td class="${r.lastProfit>=0?'pos':'neg'}">$${fmt(r.lastProfit)}M</td>
        <td>
          <button class="mini r-save">保存</button>
          <button class="mini r-close">关闭</button>
        </td>
      </tr>`;
  }).join('');
  return `
    <div class="panel">
      <div class="panel-head">
        <h3>航线 (${p.routes.length})</h3>
        <button id="open-route-btn" class="primary-btn small">+ 开通新航线</button>
      </div>
      <div class="table-wrap"><table class="game-table">
        <thead><tr><th>城市对</th><th>票价 $</th><th>服务</th><th>广告</th><th>飞机</th><th>载荷</th><th>上季利润</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="8" class="muted">还没有航线，点右上方"开通新航线"。</td></tr>`}</tbody>
      </table></div>
    </div>
  `;
}

function attachRouteHandlers() {
  $$('#tab-body tr[data-route]').forEach(tr => {
    const id = tr.dataset.route;
    const p = getPlayer();
    tr.querySelector('.r-save').addEventListener('click', () => {
      const fare = parseFloat(tr.querySelector('.r-fare').value);
      const svc = parseInt(tr.querySelector('.r-svc').value, 10);
      const ad = parseFloat(tr.querySelector('.r-ad').value);
      setFare(p, id, fare);
      setServiceLevel(p, id, svc);
      setAdSpend(p, id, ad);
      toast('已保存航线设置');
      rerender();
    });
    tr.querySelector('.r-close').addEventListener('click', () => {
      if (!confirm('确认关闭这条航线？飞机会变为闲置。')) return;
      closeRoute(p, id);
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
      <div id="d-info" class="muted">选择起降城市后将显示距离。</div>
    `,
    actions: [
      { label: '取消', onClick: closeModal },
      { label: '开通', primary: true, onClick: () => {
          const from = $('#d-from').value, to = $('#d-to').value;
          const res = openRoute(p, from, to);
          if (!res.ok) { toast(res.msg); return; }
          closeModal(); toast('已开通新航线'); rerender();
      }},
    ],
  });
  const sync = () => {
    const a = CITY_BY_ID[$('#d-from').value];
    const b = CITY_BY_ID[$('#d-to').value];
    if (!a || !b || a.id === b.id) { $('#d-info').textContent = '请选择不同的两个城市'; return; }
    $('#d-info').innerHTML = `距离 <b>${distanceKm(a,b)} km</b> · 建议票价 $${Math.round(60+distanceKm(a,b)*0.08)}`;
  };
  $('#d-from').addEventListener('change', sync);
  $('#d-to').addEventListener('change', sync);
  sync();
}

// ----- 机队 -----
function renderFleet() {
  const p = getPlayer();
  const rows = p.aircraft.map(ac => {
    const m = AIRCRAFT_BY_ID[ac.modelId];
    const route = ac.routeId ? p.routes.find(r => r.id === ac.routeId) : null;
    const routeLabel = route ? `${CITY_BY_ID[route.fromCity].iata}—${CITY_BY_ID[route.toCity].iata}` : '闲置';
    return `
      <tr data-uid="${ac.uid}">
        <td>${m.name}<br><span class="muted">${m.manufacturer}</span></td>
        <td>${m.capacity} 座 · ${m.rangeKm} km</td>
        <td>${(ac.ageQuarters/4).toFixed(1)} 年</td>
        <td>${ac.grounded ? '<span class="bad">停飞</span>' : routeLabel}</td>
        <td>
          <select class="a-assign">
            <option value="">— 闲置 —</option>
            ${p.routes.map(r => `<option value="${r.id}" ${r.id===ac.routeId?'selected':''}>${CITY_BY_ID[r.fromCity].iata}—${CITY_BY_ID[r.toCity].iata}</option>`).join('')}
          </select>
          <button class="mini a-apply">分配</button>
          <button class="mini a-sell">售出</button>
        </td>
      </tr>`;
  }).join('');
  return `
    <div class="panel">
      <div class="panel-head">
        <h3>机队 (${p.aircraft.length})</h3>
        <button id="buy-aircraft-btn" class="primary-btn small">+ 购买飞机</button>
      </div>
      <div class="table-wrap"><table class="game-table">
        <thead><tr><th>机型</th><th>规格</th><th>机龄</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="muted">机队为空，先去购买飞机。</td></tr>'}</tbody>
      </table></div>
    </div>
  `;
}

function attachFleetHandlers() {
  const p = getPlayer();
  $$('#tab-body tr[data-uid]').forEach(tr => {
    const uid = tr.dataset.uid;
    tr.querySelector('.a-apply').addEventListener('click', () => {
      const rid = tr.querySelector('.a-assign').value || null;
      const res = assignAircraftToRoute(p, uid, rid);
      if (!res.ok) { toast(res.msg); return; }
      toast(rid ? '已分配' : '已设为闲置'); rerender();
    });
    tr.querySelector('.a-sell').addEventListener('click', () => {
      if (!confirm('确认出售？将按折旧价回收。')) return;
      const r = sellAircraft(p, uid);
      if (r.ok) toast(`已售出，回收 $${fmt(r.resale)}M`);
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
            <td><b>${m.name}</b><br><span class="muted">${m.manufacturer}</span></td>
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
    const r = buyAircraft(p, b.dataset.id);
    if (!r.ok) { toast(r.msg); return; }
    toast('已购买，新飞机已加入机队'); rerender();
  }));
}

// ----- 城市 -----
function renderCities() {
  const p = getPlayer();
  const rights = new Set(p.landingRights);
  const queued = new Set(state.landingApplications.filter(a=>a.airlineId===p.id).map(a=>a.cityId));
  const rows = CITIES.map(c => {
    const status = rights.has(c.id) ? '<span class="pos">✓ 已拥有</span>' :
                   queued.has(c.id) ? `<span class="warn">审批中</span>` :
                   `<button class="mini apply-btn" data-id="${c.id}">申请</button>`;
    return `
      <tr>
        <td>${c.nameZh} <span class="muted">(${c.iata})</span></td>
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
        <thead><tr><th>城市</th><th>区域</th><th>规模</th><th>基础需求</th><th>状态</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="muted small">申请着陆权需要 1–4 季审批，根据城市规模收取申请费。</p>
    </div>
  `;
}

function attachCitiesHandlers() {
  $$('.apply-btn').forEach(b => b.addEventListener('click', () => {
    const p = getPlayer();
    const r = applyForLanding(p, b.dataset.id);
    if (!r.ok) { toast(r.msg); return; }
    toast(`申请已提交，需 ${r.eta} 季审批，费用 $${r.fee}M`); rerender();
  }));
}

function onCityClickMap(c) {
  setTab('cities');
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
        <div class="fin-card neg"><span>广告</span><b>$${fmt(rep.ad)}M</b></div>
        <div class="fin-card neg"><span>安保 / 合规</span><b>$${fmt(rep.safety)}M</b></div>
        <div class="fin-card neg"><span>机队维护</span><b>$${fmt(rep.maintenance)}M</b></div>
        <div class="fin-card neg"><span>债务利息</span><b>$${fmt(rep.interest)}M</b></div>
        <div class="fin-card big ${netProfit(rep)>=0?'pos':'neg'}"><span>净利润</span><b>$${fmt(netProfit(rep))}M</b></div>
      </div>
      <p class="muted">本季载客 ${Math.round(rep.passengers).toLocaleString()} 人次</p>
    </div>
  `;
}

function netProfit(r) {
  return r.revenue - r.fuel - r.landing - r.service - r.ad - r.safety - r.maintenance - r.interest;
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
        <tbody>
          ${scored.map((s, i) => `
            <tr class="${s.al.isPlayer ? 'me' : ''}">
              <td>${i+1}</td>
              <td><span class="dot" style="background:${s.al.color}"></span> ${s.al.nameZh}${s.al.isPlayer?'（你）':''}${s.al.bankrupt?' <span class="bad">破产</span>':''}</td>
              <td>$${fmt(s.al.cash)}M</td>
              <td>$${fmt(s.al.debt)}M</td>
              <td>${s.al.aircraft.length}</td>
              <td>${s.al.routes.length}</td>
              <td>${Math.round(s.al.prestige)}</td>
              <td><b>${Math.round(s.score)}</b></td>
            </tr>
          `).join('')}
        </tbody>
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

// ----- handlers 路由 -----
function attachTabHandlers() {
  if (currentTab === 'routes') attachRouteHandlers();
  else if (currentTab === 'fleet') attachFleetHandlers();
  else if (currentTab === 'cities') attachCitiesHandlers();
}

// ===== 回合 =====
function onEndTurn() {
  if (state.gameOver) { showEndGame(); return; }
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
  if (!rep) { rerender(); return; }
  const triggeredIds = state.pendingDialog?.triggered || [];
  const events = triggeredIds.map(id => EVENTS.find(e=>e.id===id)).filter(Boolean);
  if (state.gameOver) { showEndGame(); return; }
  openModal({
    title: `${state.year} Q${state.quarter} · 新季度开局`,
    body: `
      <div class="report-summary">
        <div><span class="lbl">上季净利润</span><b class="${netProfit(rep)>=0?'pos':'neg'}">$${fmt(netProfit(rep))}M</b></div>
        <div><span class="lbl">载客</span><b>${Math.round(rep.passengers).toLocaleString()}</b></div>
        <div><span class="lbl">现金</span><b>$${fmt(p.cash)}M</b></div>
      </div>
      ${events.length === 0 ? '<p class="muted">本季无重大行业事件。</p>' :
        '<h4 style="margin-top:1em">本季事件：</h4><ul>' +
        events.map(e => `<li><b>${e.nameZh}</b><br><span class="muted">${e.descZh}</span></li>`).join('') +
        '</ul>'}
    `,
    actions: [{ label: '继续', primary: true, onClick: () => {
      state.pendingDialog = null; saveGame(); closeModal(); rerender();
    } }],
  });
}

function showEventChoice(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev || !ev.choice) { state.pendingEvent = null; return; }
  const p = getPlayer();
  openModal({
    title: `📰 ${ev.triggerYear} Q${ev.triggerQuarter} · ${ev.nameZh}`,
    body: `
      <p>${ev.descZh}</p>
      <p><b>${ev.choice.prompt}</b></p>
    `,
    actions: ev.choice.options.map(opt => ({
      label: opt.label,
      onClick: () => {
        applyChoiceOption(opt, p);
        state.pendingEvent = null;
        saveGame();
        closeModal();
        // pendingDialog 已在 onEndTurn 中包含本季所有触发事件
        showQuarterReport();
      }
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
        <tbody>${scored.map((s,i)=>`
          <tr class="${s.al.isPlayer?'me':''}">
            <td>${i+1}</td>
            <td><span class="dot" style="background:${s.al.color}"></span> ${s.al.nameZh}</td>
            <td><b>${Math.round(s.score)}</b></td>
            <td>$${fmt(s.al.cash)}M</td>
            <td>${s.al.aircraft.length}</td>
            <td>${Math.round(s.al.prestige)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <h4 style="margin-top:1em">30 年经历的事件：</h4>
      <ul style="max-height:200px;overflow:auto">${state.eventLog.map(id => {
        const e = EVENTS.find(x=>x.id===id);
        return e ? `<li>${e.triggerYear} Q${e.triggerQuarter} · ${e.nameZh}</li>` : '';
      }).join('')}</ul>
    `,
    actions: [
      { label: '回到主页', onClick: () => { clearSave(); location.href = '../index.html'; } },
      { label: '再玩一局', primary: true, onClick: () => { clearSave(); closeModal(); showStartScreen(); } },
    ],
  });
}

function openMenu() {
  openModal({
    title: '游戏菜单',
    body: '<p class="muted">选择操作</p>',
    actions: [
      { label: '保存进度', onClick: () => { saveGame(); toast('已保存'); closeModal(); } },
      { label: '放弃并开新游戏', onClick: () => {
        if (!confirm('放弃当前进度并开始新游戏？')) return;
        clearSave(); closeModal(); showStartScreen();
      }},
      { label: '关闭', primary: true, onClick: closeModal },
    ],
  });
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
        ${actions.map((a,i) => `<button class="${a.primary?'primary-btn':'ghost-btn'}" data-i="${i}">${a.label}</button>`).join('')}
      </div>
    </div>
  `;
  $$('.modal-actions button', root).forEach((btn, i) => {
    btn.addEventListener('click', () => actions[i].onClick && actions[i].onClick());
  });
}
function closeModal() {
  $('#modal-root').innerHTML = '';
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

// ===== utils =====
function fmt(n) {
  if (typeof n !== 'number') return '0';
  if (Math.abs(n) >= 10000) return (n/1000).toFixed(1) + 'k';
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 1) return n.toFixed(1);
  return n.toFixed(2);
}
function flagOf(country) {
  const map = { CN:'🇨🇳', US:'🇺🇸', DE:'🇩🇪', SG:'🇸🇬', JP:'🇯🇵', HK:'🇭🇰', KR:'🇰🇷',
                TH:'🇹🇭', IN:'🇮🇳', AE:'🇦🇪', GB:'🇬🇧', FR:'🇫🇷', NL:'🇳🇱', AU:'🇦🇺', BR:'🇧🇷' };
  return map[country] || '🏳️';
}
function regionLabel(r) {
  return { asia:'亚洲', europe:'欧洲', namerica:'北美', samerica:'南美',
           mideast:'中东', oceania:'大洋洲', africa:'非洲' }[r] || r;
}
