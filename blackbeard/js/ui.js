// UI 外壳（仿《大航海时代2》）：港口主视野 / 近海航行视野 / 全球海图三层。
// 顶部信息条 + 底部指令栏 + 滑入式侧栏面板。
import {
  state, APP_VERSION, NUM_SLOTS, initNewGame, saveGame, loadGame, hasSave,
  saveToSlot, loadFromSlot, deleteSlot, listSaveSlots, addLog,
  shipStat, cargoUsed, fleetCrew, fleetSpeed, makeShip,
  addFame, totalFame, playerAtk, playerDef,
} from './state.js';
import { PORTS, PORT_BY_ID, NATIONS } from './data/ports.js';
import { GOODS, GOOD_BY_ID } from './data/goods.js';
import { SHIPS, SHIP_BY_ID, UPGRADES } from './data/ships.js';
import { OFFICERS, OFFICER_BY_ID } from './data/officers.js';
import { openTown, closeTown, refreshTown, townEntities } from './town.js';
import { openSail, closeSail, zoomSail, sailSpanDeg } from './sailview.js';
import { openChart, closeChart } from './worldmap.js';
import {
  FACILITIES, facTitle, renderFacility, registerRender, doFacilityAction,
  bindUI as bindFacilitiesUI,
} from './facilities.js';
import {
  advanceHours, passTimeAshore, setWaypoint, clearWaypoint, leavePort, enterPort, portInReach,
  dateStr, timeStr, grainOnBoard, waterCapacity, refillWater, monthlyWage, ensureNpcShips,
  nearestSeaPoint, MEET_NM, ENTER_PORT_NM,
} from './voyage.js';
import { marketList, buy, sell, fleetCargoTotal, fleetCargoSpace, monthlyMarketDrift, rollMarketEvents, effectsAt } from './trade.js';
import { windAt, distanceNm, bearing } from './geo.js';
import { seaAt } from './data/coast.js';
import { reveal, exploredRatio } from './fog.js';
import { onDayAdvanced, tryChapter, describeChapter, offerPardon, finalChoices, grantQAR } from './story.js';
import { startBattle } from './battle.js';
import {
  ensureQuests, syncMainQuests, checkAll, accept, acceptJob, offersAt, activeQuests, doneQuests,
  progressText, isActive, isDone, onBattleWin, onTalk, checkDeadlines, questById, dueText,
} from './quests.js';
import { QUEST_BY_ID } from './data/quests.js';
import { DISCOVERIES, KIND_NAME } from './data/discoveries.js';
import { foundCount, reportedCount, totalCount, unreported } from './discoveries.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
export function fmt(n) {
  if (typeof n !== 'number') return '0';
  if (Math.abs(n) >= 10000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n).toString();
}

let sidePanel = null;      // 'fleet'|'quests'|'log'|null
let townFacility = null;   // 港口内打开的设施
let sailing = false, sailRaf = 0, sailLast = 0, sailMul = 1;
// 上一次「有港口在入港半径内」的港口 id：抵港提示只在进入半径的那一刻弹，
// 否则刚出港时人还在半径里，一起航就被自己停下来。
let lastNearPort = null;

// ===== 模态 / 提示 =====
export function openModal({ title, body, actions = [], wide = false }) {
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
  $$('.modal-actions button', root).forEach((btn, i) => {
    btn.addEventListener('click', () => actions[i].onClick && actions[i].onClick());
  });
}
export function closeModal() { $('#modal-root').innerHTML = ''; }
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2000);
}

// ===== 启动 =====
// facilities.js 要用的那几件 UI 能力，开机时注入（与 story.js 同一套路，避免模块循环）
bindFacilitiesUI({
  toast, openModal, closeModal,
  acceptJob: (job) => {
    if (!acceptJob(job)) return toast('这条委托接不了。');
    toast('接下了委托：' + job.title);
    saveGame(); render();
  },
  // 设施里做完事统一走这个：存档 + 重绘面板
  after: () => { saveGame(); render(); },
});

export function boot() {
  $('#version').textContent = 'v' + APP_VERSION;
  $('#btn-new').addEventListener('click', () => { initNewGame(); saveGame(); showGame(); tryChapter(); });
  $('#btn-continue').addEventListener('click', () => {
    const r = loadGame();
    if (!r.ok) { toast(r.reason === 'version' ? '存档来自旧版本（v' + r.oldVersion + '），本次更新改动了存档结构，请开新局。' : '没有可用的存档。'); return; }
    showGame();
  });
  $('#btn-slots').addEventListener('click', () => showSlots('load'));
  $('#btn-continue').disabled = !hasSave();
  $('#tp-close').addEventListener('click', () => closeTownFacility());
  $('#chart-close').addEventListener('click', () => { closeChart(); $('#chart-view').classList.add('hidden'); });
  showStart();
}

function showStart() {
  stopSail();
  closeSail(); closeTown();
  $('#start-screen').hidden = false;
  $('#game-screen').hidden = true;
}

export function showGame() {
  $('#start-screen').hidden = true;
  $('#game-screen').hidden = false;
  ensureQuests(); syncMainQuests();
  reveal(state.position.lng, state.position.lat, 150);
  setView(state.atPort ? 'port' : 'sail');
}

// ===== 视图切换 =====
export function setView(v) {
  stopSail();
  state.view = v;
  closeTownFacility();
  closeSail(); closeTown();
  $('#view-port').classList.toggle('hidden', v !== 'port');
  $('#view-sail').classList.toggle('hidden', v !== 'sail');
  if (v === 'port' && state.atPort) {
    openTown(state.atPort, { onFacility: openTownFacility, onNpc: talkTo });
  } else if (v === 'sail') {
    ensureNpcShips();
    openSail({
      onWaypoint: (w) => {
        const r = setWaypoint(w.lng, w.lat);
        if (!r.ok) return toast(r.msg);
        render();
      },
      onPort: (p) => onSailPortTap(p),
      onShip: (s) => onShipTap(s),
      onBlocked: () => toast('那里是陆地。'),
    });
  }
  render();
}

export function render() {
  renderHud();
  renderCmd();
  if (sidePanel) renderSidePanel();
  if (townFacility) renderTownPanel();
}

// ===== 顶部信息条 =====
function renderHud() {
  const p = state.player;
  const w = windAt(state.position.lng, state.position.lat, state.date.m);
  const grain = grainOnBoard();
  const sea = seaAt(state.position.lng, state.position.lat);
  const where = state.atPort ? `⚓ ${PORT_BY_ID[state.atPort].name}` : `🌊 ${sea.name}`;
  const wage = monthlyWage();
  $('#hud').innerHTML = `
    <div class="hud-row">
      <span class="hud-date">📅 ${dateStr()}</span>
      <span class="hud-clock" title="船上的时间">🕐 ${timeStr()}</span>
      <span class="hud-where">${where}</span>
      <span class="hud-gold">🪙 ${fmt(p.gold)}</span>
      <span title="每月工资">💰 月薪 ${wage}</span>
    </div>
    <div class="hud-row small">
      <span title="冒险名声">🧭 ${p.fame.adventure}</span>
      <span title="交易名声">⚖️ ${p.fame.trade}</span>
      <span title="战斗名声">⚔️ ${p.fame.battle}</span>
      <span title="海盗恶名">🏴‍☠️ ${p.infamy}</span>
      <span title="船员 / 士气">👥 ${fleetCrew()} · 士气 ${Math.round(state.crewMorale)}</span>
      <span title="粮食（货舱）"${grain <= 0 ? ' style="color:#ff9a8a"' : ''}>🌾 ${grain}</span>
      <span title="淡水">💧 ${state.supplies.water}</span>
      <span title="风向">🌬️ ${w.name}</span>
      <span title="已探明海域">🗺️ ${(exploredRatio() * 100).toFixed(1)}%</span>
    </div>`;
}

// ===== 底部指令栏 =====
function renderCmd() {
  const c = $('#cmd');
  // 指令分组仿原版的 X 键菜单：航行动作在左，情报类在右，中间一道分隔
  const common = `
    <span class="cmd-sep"></span>
    <button class="cmd-btn" data-cmd="chart">🗺️ 海图</button>
    <button class="cmd-btn" data-cmd="fleet">⚓ 舰队</button>
    <button class="cmd-btn" data-cmd="quests">📋 任务${activeQuests().length ? ` (${activeQuests().length})` : ''}</button>
    <button class="cmd-btn" data-cmd="codex">🧭 图鉴${foundCount() ? ` (${foundCount()})` : ''}</button>
    <button class="cmd-btn" data-cmd="log">📜 日志</button>
    <button class="cmd-btn" data-cmd="menu">☰</button>`;

  if (state.view === 'port') {
    const p = PORT_BY_ID[state.atPort];
    c.innerHTML = `
      <button class="cmd-btn primary" data-cmd="sail">⛵ 出港</button>
      <span class="cmd-hint">${p ? p.name : ''} · 点建筑进设施，点人交谈</span>
      <span class="cmd-spacer"></span>${common}`;
  } else {
    const near = portInReach();
    const wp = state.waypoint;
    c.innerHTML = `
      <button class="cmd-btn primary" data-cmd="auto" ${!wp && !sailing ? 'disabled' : ''}>${sailing ? '⏸️ 停船' : '⛵ 起航'}</button>
      <button class="cmd-btn${sailing ? ' on' : ''}" data-cmd="speed">⏩ ${sailMul}×</button>
      <button class="cmd-btn" data-cmd="watch" title="在原地守候，时间照走">⏳ 守候 6 时</button>
      ${wp ? '<button class="cmd-btn" data-cmd="stop">⚓ 抛锚</button>' : ''}
      ${near ? `<button class="cmd-btn primary" data-cmd="enter" data-port="${near.id}">🏛️ 进入${near.name}</button>` : ''}
      <button class="cmd-btn" data-cmd="zoomin">🔍+</button>
      <button class="cmd-btn" data-cmd="zoomout">🔍−</button>
      <span class="cmd-hint">${sailing ? `航行中 · ${Math.round(fleetSpeed() * 0.55 * 24)} 浬/日` : wp ? '已定航点，点「起航」开船' : '点海面设定下一个航点'} · 视野 ${sailSpanDeg()}°</span>
      <span class="cmd-spacer"></span>${common}`;
  }
  $$('#cmd [data-cmd]').forEach(b => b.addEventListener('click', () => doCmd(b.dataset.cmd, b.dataset)));
}

function doCmd(cmd, ds) {
  if (cmd === 'sail') { const from = state.atPort; leavePort(); lastNearPort = from; setView('sail'); return; }
  if (cmd === 'auto') return toggleSail();
  if (cmd === 'speed') return cycleSpeed();
  if (cmd === 'watch') { stepHours(6); render(); return; }
  if (cmd === 'stop') { clearWaypoint(); setSailing(false); return; }
  if (cmd === 'enter') return doEnterPort(ds.port);
  if (cmd === 'zoomin') { zoomSail(-1); render(); return; }
  if (cmd === 'zoomout') { zoomSail(1); render(); return; }
  if (cmd === 'chart') { $('#chart-view').classList.remove('hidden'); openChart(); return; }
  if (cmd === 'menu') return showMenu();
  if (['fleet', 'quests', 'codex', 'log'].includes(cmd)) return openSidePanel(cmd);
}

// ===== 侧栏面板 =====
function openSidePanel(which) {
  if (sidePanel === which) return closeSidePanel();
  sidePanel = which;
  $('#panel').classList.remove('hidden');
  renderSidePanel();
}
function closeSidePanel() {
  sidePanel = null;
  $('#panel').classList.add('hidden');
}
function renderSidePanel() {
  const body = sidePanel === 'fleet' ? renderFleet()
    : sidePanel === 'quests' ? renderQuests()
      : sidePanel === 'codex' ? renderCodex()
        : renderLog();
  $('#panel').innerHTML = `
    <div class="panel-nav">
      <button class="nav-btn${sidePanel === 'fleet' ? ' active' : ''}" data-side="fleet">⚓ 舰队</button>
      <button class="nav-btn${sidePanel === 'quests' ? ' active' : ''}" data-side="quests">📋 任务</button>
      <button class="nav-btn${sidePanel === 'codex' ? ' active' : ''}" data-side="codex">🧭 图鉴</button>
      <button class="nav-btn${sidePanel === 'log' ? ' active' : ''}" data-side="log">📜 日志</button>
      <button class="nav-btn" data-side="close">✕</button>
    </div>
    <div class="panel-body">${storyCard()}${body}</div>`;
  $$('#panel [data-side]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.side === 'close') closeSidePanel();
    else { sidePanel = b.dataset.side; renderSidePanel(); }
  }));
  attachPanel($('#panel'));
}

// ===== 港口设施面板 =====
function openTownFacility(facId) {
  townFacility = facId;
  $('#town-panel').classList.remove('hidden');
  renderTownPanel();
}
function closeTownFacility() {
  if (townFacility) passTimeAshore();     // 原版规则：每次进出设施，时间往前走半小时到一个半小时
  townFacility = null;
  const el = $('#town-panel');
  if (el) el.classList.add('hidden');
}
// 老五家的渲染函数留在本文件，注册进设施表；新四家（银行/公会/道具屋/邸宅）写在 facilities.js。
registerRender('market', renderMarket);
registerRender('tavern', renderTavern);
registerRender('shipyard', renderShipyard);
registerRender('governor', renderGovernor);
registerRender('church', renderChurch);

function renderTownPanel() {
  const p = state.atPort ? PORT_BY_ID[state.atPort] : null;
  if (!p || !townFacility) return;
  $('#tp-title').textContent = facTitle(townFacility);
  $('#tp-body').innerHTML = renderFacility(townFacility, p);
  attachPanel($('#town-panel'));
}

// ===== 发现物图鉴 =====
function renderCodex() {
  const byKind = {};
  for (const d of DISCOVERIES) (byKind[d.kind] ||= []).push(d);
  const pending = unreported().length;
  return `
    <div class="card">
      <h3>🧭 航海日志 · 发现物</h3>
      <p class="big-row"><span>已发现</span><b>${foundCount()} / ${totalCount()}</b></p>
      <p class="big-row"><span>已上缴</span><b>${reportedCount()}</b></p>
      ${pending ? `<p class="small" style="color:#c9a24a">还有 <b>${pending}</b> 条没换成钱——去里斯本 / 阿姆斯特丹 / 伦敦的邸宅找收藏家。</p>`
      : '<p class="small muted">没有待上缴的记录。</p>'}
      <p class="small muted">驶近就算发现。带上望远镜能提前 35% 看到。</p>
    </div>
    ${Object.entries(byKind).map(([k, list]) => `<div class="card">
      <h3>${KIND_NAME[k]}（${list.filter(d => state.discoveries.found[d.id]).length}/${list.length}）</h3>
      ${list.map(d => {
        const got = state.discoveries.found[d.id];
        const rep = state.discoveries.reported[d.id];
        if (!got) return `<div class="codex-row locked"><b>？？？</b><span class="small muted">未发现</span></div>`;
        return `<div class="codex-row">
          <div><b>${d.name}</b> <span class="small muted">${d.nameEn}</span>
            <div class="small">${d.blurb}</div>
            <div class="small muted">${d.note}</div></div>
          <div class="cx-side small">${rep ? '<span class="good">已上缴</span>' : `🪙 ${fmt(d.reward)}`}<br>🧭 +${d.fame}</div>
        </div>`;
      }).join('')}
    </div>`).join('')}`;
}

// ===== 章节卡 =====
function storyCard() {
  if (state.gameOver) {
    return `<div class="card"><h3>🏁 本局已结束</h3>
      <p class="small muted">结局：${state.ending}。可从菜单开始新的航程。</p></div>`;
  }
  const ch = describeChapter(state.chapter);
  if (!ch) return '';
  return `<div class="card">
    <h3>${ch.title}</h3><p class="small">🎯 ${ch.goal}</p>
    ${state.chapter >= 6 ? '<div class="btn-row"><button class="primary-btn" data-act="final">⚖️ 做出最终抉择</button></div>' : ''}
  </div>`;
}

// ===== 市场 =====
function renderMarket(p) {
  // 当地行情与港口性质：都真真切切进了上面那张价目表
  const fx = effectsAt(p.id);
  const notes = [];
  if (p.pirateHaven) notes.push('🏴‍☠️ 海盗窝：这里不问货怎么来的，卖价上浮 18%。');
  if (p.stance === 'hostile') notes.push('⚠️ 敌视港：进出都要打点，买价 +10%、卖价折算后更低。');
  else if (p.stance === 'wary') notes.push('👁️ 戒备港：盘查得紧，买价 +4%。');
  for (const e of fx) {
    const g = GOOD_BY_ID[e.good];
    if (!g) continue;
    notes.push(`${e.mult > 1 ? '📈' : '📉'} ${g.name}行情：价格 ×${e.mult}（还剩 ${e.remaining} 个月）`);
  }
  const rows = marketList(p.id).map(m => {
    const own = fleetCargoTotal(m.good.id);
    return `<tr>
      <td>${m.good.icon} ${m.good.name}<span class="muted small"> ×${m.good.bulk}舱</span></td>
      <td class="num ${m.trend === 'cheap' ? 'good' : m.trend === 'dear' ? 'bad' : ''}">${m.buy}</td>
      <td class="num">${m.sell}</td>
      <td class="num muted">${m.stock}</td>
      <td class="num">${own || '—'}</td>
      <td class="acts">
        <button class="mini" data-buy="${m.good.id}" data-q="1">买1</button>
        <button class="mini" data-buy="${m.good.id}" data-q="10">买10</button>
        <button class="mini sell" data-sell="${m.good.id}" data-q="1">卖1</button>
        <button class="mini sell" data-sell="${m.good.id}" data-q="999">全卖</button>
      </td></tr>`;
  }).join('');
  return `<div class="card">
    <h3>🛒 ${p.name} · 市场</h3>
    <p class="muted small">舱位剩余 ${fleetCargoSpace()} ／ 金币 ${fmt(state.player.gold)}</p>
    ${notes.length ? `<div class="mkt-notes">${notes.map(n => `<div class="small">${n}</div>`).join('')}</div>` : ''}
    <table class="tbl"><thead><tr><th>货物</th><th>买入</th><th>卖出</th><th>库存</th><th>持有</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="small muted" style="margin-top:10px">🌾 <b>粮食就是口粮</b>：每 10 名船员每天吃 1 单位。💧 淡水靠港免费补满。</p>
  </div>`;
}

// ===== 酒馆：水手与伙伴都在这里招募 =====
function renderTavern(p) {
  const avail = OFFICERS.filter(o => o.recruitAt === p.id && (o.chapter || 0) <= state.chapter
    && !state.officers.includes(o.id) && o.role !== 'foe' && o.role !== 'npc');
  const hired = state.officers.map(id => OFFICER_BY_ID[id]).filter(Boolean);
  const offers = offersAt(p.id);
  const room = state.fleet.reduce((a, s) => a + (s.crewMax - s.crew), 0);
  const wage = monthlyWage();
  return `<div class="card">
      <h3>🍺 ${p.name} · 酒馆</h3>
      <p class="blurb">${rumorFor(p)}</p>
    </div>
    <div class="card"><h3>⚓ 招募水手</h3>
      <p class="small">现有船员 <b>${fleetCrew()}</b> 人 · 空位 ${room} · 士气 ${Math.round(state.crewMorale)}</p>
      <p class="small muted">签字费 20 金币/人，此后<b>每月按人头发薪</b>（水手 3 金/人，伙伴 60 金/人）。
        当前月薪合计 <b>${wage}</b> 金币。</p>
      <div class="btn-row">
        <button class="ghost-btn" data-crew="5" ${room < 5 ? 'disabled' : ''}>招 5 人（100）</button>
        <button class="ghost-btn" data-crew="20" ${room < 20 ? 'disabled' : ''}>招 20 人（400）</button>
        <button class="ghost-btn" data-crew="50" ${room < 50 ? 'disabled' : ''}>招 50 人（1000）</button>
        <button class="ghost-btn" data-act="rum">请一轮朗姆酒（士气 +12，300）</button>
      </div>
    </div>
    ${avail.length ? `<div class="card"><h3>🧭 可招募的伙伴</h3>${avail.map(o => `
      <div class="officer">
        <div><b>${o.name}</b> <span class="muted">${o.nameEn}</span> <span class="tag">${roleName(o.role)}</span></div>
        <p class="small">${escapeHtml(o.bio)}</p>
        <p class="small muted">加成：${bonusText(o.bonus)} · 月薪 60</p>
        <button class="primary-btn" data-hire="${o.id}">招募（${fmt(o.hireCost || 0)} 金币）</button>
      </div>`).join('')}</div>` : ''}
    ${hired.length ? `<div class="card"><h3>我的伙伴</h3>${hired.map(o =>
    `<div class="officer"><b>${o.name}</b> <span class="tag">${roleName(o.role)}</span>
       <p class="small muted">${bonusText(o.bonus)}</p></div>`).join('')}</div>` : ''}
    ${offers.length ? `<div class="card"><h3>📌 委托板</h3>
      ${offers.map(q => `<div class="quest">
        <div class="qhead"><span class="qkind side">支线</span><b>${q.title}</b></div>
        <p class="small" style="margin-top:5px">${escapeHtml(q.desc)}</p>
        <p class="small muted">委托人：${q.giverName || '本地人'} · 报酬 ${q.reward?.gold || 0} 金币</p>
        <button class="primary-btn" data-quest="${q.id}">接下委托</button>
      </div>`).join('')}</div>` : ''}`;
}
function roleName(r) {
  return { mate: '大副', gunner: '炮长', quartermaster: '舵手', surgeon: '船医', npc: '人物', foe: '宿敌' }[r] || r;
}
function bonusText(b) {
  if (!b) return '—';
  const n = { sailing: '航海', combat: '战斗', leadership: '统率', negotiation: '交涉', gunnery: '炮术', melee: '白刃', morale: '士气', speed: '航速', healing: '医术' };
  return Object.entries(b).map(([k, v]) => `${n[k] || k} ${v > 0 ? '+' : ''}${v}`).join('、');
}
function rumorFor(p) {
  const rumors = [
    '酒保压低嗓门：「西班牙珍宝船队下个月要在哈瓦那集结。」',
    '角落里的老水手说：「拿骚如今没有王法，想发财的都往那儿去。」',
    '一个断了手指的家伙嘟囔：「别去波士顿，那儿的绞刑架从不空着。」',
    '有人说，逆着信风走是傻子的干法——从非洲往西才是正道。',
    '「听说过黑胡子吗？」邻桌的人问你，「据说他把点燃的引信编进胡子里。」',
  ];
  return rumors[(p.id.charCodeAt(0) + state.date.m) % rumors.length];
}

// ===== 造船厂 =====
function renderShipyard(p) {
  const ships = state.fleet.map((s, i) => {
    const st = shipStat(s);
    const dmg = st.hullMax - s.hull;
    const cost = Math.round(dmg * 12);
    return `<div class="ship-row">
      <div><b>${s.name}</b> <span class="muted">${SHIP_BY_ID[s.typeId].name}</span>${i === state.flagship ? ' <span class="tag">旗舰</span>' : ''}</div>
      <div class="bar"><i style="width:${s.hull / st.hullMax * 100}%"></i></div>
      <p class="small muted">耐久 ${Math.round(s.hull)}/${st.hullMax} · 炮 ${st.guns} · 装甲 ${st.armor} · 航速 ${st.speed.toFixed(1)} · 舱 ${cargoUsed(s)}/${st.cargoMax} · 船员 ${s.crew}/${s.crewMax}</p>
      ${dmg > 0 ? `<button class="mini" data-repair="${i}">🔧 修理（${cost} 金币）</button>` : '<span class="small good">状态良好</span>'}
      ${i !== state.flagship ? `<button class="mini" data-flag="${i}">设为旗舰</button>` : ''}
      <div class="up-row">${UPGRADES.map(u => `
        <button class="mini" data-up="${u.id}" data-ship="${i}" ${(s.upgrades[u.id] || 0) >= u.max ? 'disabled' : ''}>
          ${u.icon}${u.name} ${s.upgrades[u.id] || 0}/${u.max}（${fmt(u.price)}）</button>`).join('')}</div>
    </div>`;
  }).join('');
  const CLS_NAME = { light: '轻型（快、舱小，适合抢劫与跑单帮）', medium: '中型（攻守均衡）', heavy: '重型（慢而硬，正面硬碰）' };
  const byCls = {};
  for (const s of SHIPS) { if (s.story || s.price <= 0) continue; (byCls[s.cls || 'medium'] ||= []).push(s); }
  const buyList = ['light', 'medium', 'heavy'].filter(c => byCls[c]).map(c =>
    `<p class="small muted" style="margin:10px 0 4px">${CLS_NAME[c]}</p>` + byCls[c].map(s => `
    <div class="ship-row">
      <div><b>${s.name}</b> <span class="muted">${s.nameEn}</span></div>
      <p class="small muted">耐久 ${s.hull} · 炮 ${s.guns} · 装甲 ${s.armor} · 航速 ${s.speed} · 舱 ${s.cargo} · 船员上限 ${s.crewMax}</p>
      <p class="small">${escapeHtml(s.note)}</p>
      <button class="primary-btn" data-buyship="${s.id}" ${state.player.gold < s.price || state.fleet.length >= 4 ? 'disabled' : ''}>购买（${fmt(s.price)}）</button>
    </div>`).join('')).join('');
  return `<div class="card"><h3>🔨 ${p.name} · 造船厂</h3>
      <p class="muted small">舰队 ${state.fleet.length}/4 · 金币 ${fmt(state.player.gold)}</p>${ships}</div>
    <div class="card"><h3>购置新船</h3>${buyList}</div>`;
}

// ===== 总督府 / 医馆 =====
function renderGovernor(p) {
  const hostile = p.stance === 'hostile' && state.player.infamy > 30;
  const pardonHere = p.id === 'BATH' && state.chapter >= 5
    && !state.flags.pardonAccepted && !state.flags.refusedPardon;
  return `<div class="card">
    <h3>🏛️ ${p.name} · 总督府</h3>
    ${hostile
      ? `<p class="blurb">卫兵拦住了你。「总督不见海盗。」——你的恶名（${state.player.infamy}）在这里太响亮了。</p>`
      : `<p class="blurb">总督的书记官抬了抬眼镜：「有何贵干？」</p>
         <div class="btn-row">
           ${pardonHere ? '<button class="primary-btn" data-act="pardon">📜 面见伊登总督（赦免状）</button>' : ''}
           <button class="ghost-btn" data-act="letter">申请私掠许可状（500，声望 +5）</button>
           <button class="ghost-btn" data-act="bounty">查看悬赏布告</button>
         </div>`}
  </div>`;
}
// 船上有船医（healing 加成）就便宜：自己人先处理过，修士只用收个尾
export function healDiscount() {
  let h = 0;
  for (const id of state.officers) h += OFFICER_BY_ID[id]?.bonus?.healing || 0;
  return Math.max(0.4, 1 - h * 0.12);
}
function renderChurch(p) {
  const hurt = state.player.hpMax - state.player.hp;
  const dsc = healDiscount();
  const healCost = Math.max(0, Math.round(hurt * 8 * dsc));
  const tendCost = Math.round(400 * dsc);
  return `<div class="card">
      <h3>⛪ ${p.name} · 医馆</h3>
      <p class="blurb">修士放下研钵：「伤口要洗干净，酒不能代替药——虽然你们没人听。」</p>
      <p class="small">体力 ${state.player.hp}/${state.player.hpMax} · 船员士气 ${Math.round(state.crewMorale)}</p>
      ${dsc < 1 ? `<p class="small good">船上有船医，诊金打 ${(dsc * 10).toFixed(1)} 折。</p>` : ''}
      <div class="btn-row">
        <button class="primary-btn" data-act="heal" ${hurt <= 0 ? 'disabled' : ''}>🩹 治疗${hurt > 0 ? `（${healCost}）` : '（无伤）'}</button>
        <button class="ghost-btn" data-act="tend">💊 医治病号（${tendCost}，士气 +15）</button>
      </div>
    </div>`;
}

// ===== 舰队 / 任务 / 日志 =====
function renderFleet() {
  const p = state.player, sk = p.skills;
  return `<div class="card">
      <h3>船长 · ${p.name}</h3>
      <p class="small">体力 ${p.hp}/${p.hpMax} · 经验 ${p.exp}</p>
      <p class="small">⚓ 航海 ${sk.sailing} ｜ ⚔️ 战斗 ${sk.combat} ｜ 🎖️ 统率 ${sk.leadership} ｜ 💬 交涉 ${sk.negotiation}</p>
      <p class="small">🗡️ 攻击 ${playerAtk()} ｜ 🛡️ 防御 ${playerDef()} ｜ 🍀 运 ${p.luck}</p>
      <p class="small muted">名声：冒险 ${p.fame.adventure} ／ 交易 ${p.fame.trade} ／ 战斗 ${p.fame.battle}</p>
      <p class="small muted">恶名 ${p.infamy} · 月薪支出 ${monthlyWage()}</p>
    </div>
    <div class="card"><h3>舰队（${state.fleet.length}/4）</h3>
    ${state.fleet.map((s, i) => {
      const st = shipStat(s);
      const cargo = Object.entries(s.cargo).map(([g, q]) => `${GOOD_BY_ID[g].icon}${q}`).join(' ') || '空舱';
      return `<div class="ship-row">
        <div><b>${s.name}</b> <span class="muted">${SHIP_BY_ID[s.typeId].name}</span>${i === state.flagship ? ' <span class="tag">旗舰</span>' : ''}</div>
        <div class="bar"><i style="width:${s.hull / st.hullMax * 100}%"></i></div>
        <p class="small muted">耐久 ${Math.round(s.hull)}/${st.hullMax} · 炮 ${st.guns} · 船员 ${s.crew} · 载货 ${cargoUsed(s)}/${st.cargoMax}</p>
        <p class="small">${cargo}</p>
        ${i !== state.flagship ? `<button class="mini" data-flag="${i}">设为旗舰</button>` : ''}
      </div>`;
    }).join('')}</div>`;
}
function renderQuests() {
  const act = activeQuests(), done = doneQuests();
  const card = (q, d) => `<div class="quest${d ? ' qdone' : ''}">
      <div class="qhead"><span class="qkind ${q.kind}">${q.kind === 'main' ? '主线' : '支线'}</span><b>${q.title}</b>${d ? ' ✅' : ''}</div>
      <p class="small" style="margin-top:5px">${escapeHtml(q.desc)}</p>
      ${d ? (q.doneText ? `<p class="qprog">「${escapeHtml(q.doneText)}」</p>` : '') : `<div class="qprog">${progressText(q)}</div>`}
    </div>`;
  return `<div class="card"><h3>📋 进行中（${act.length}）</h3>
      ${act.length ? act.map(q => card(q, false)).join('') : '<p class="muted small">暂无任务。去酒馆看看委托板，或找头顶有 <b>!</b> 的人聊聊。</p>'}</div>
    ${done.length ? `<div class="card"><h3>✅ 已完成（${done.length}）</h3>${done.map(q => card(q, true)).join('')}</div>` : ''}`;
}
function renderLog() {
  return `<div class="card"><h3>📜 航海日志</h3>
    ${state.log.length ? state.log.map(l =>
    `<p class="logline"><span class="muted">${l.date.y}.${l.date.m}.${l.date.d}</span> ${escapeHtml(l.text)}</p>`).join('')
      : '<p class="muted">还没有记录。</p>'}</div>`;
}

// ===== 绑定（作用域化）=====
function attachPanel(root = document) {
  const q = (sel) => [...root.querySelectorAll(sel)];
  q('[data-buy]').forEach(b => b.addEventListener('click', () => {
    const r = buy(state.atPort, b.dataset.buy, +b.dataset.q); toast(r.msg); saveGame(); afterQuestTick();
  }));
  q('[data-sell]').forEach(b => b.addEventListener('click', () => {
    const r = sell(state.atPort, b.dataset.sell, +b.dataset.q); toast(r.msg); saveGame(); afterQuestTick();
  }));
  q('[data-crew]').forEach(b => b.addEventListener('click', () => hireCrew(+b.dataset.crew)));
  q('[data-hire]').forEach(b => b.addEventListener('click', () => hireOfficer(b.dataset.hire)));
  q('[data-repair]').forEach(b => b.addEventListener('click', () => repairShip(+b.dataset.repair)));
  q('[data-up]').forEach(b => b.addEventListener('click', () => upgradeShip(+b.dataset.ship, b.dataset.up)));
  q('[data-buyship]').forEach(b => b.addEventListener('click', () => buyShip(b.dataset.buyship)));
  q('[data-flag]').forEach(b => b.addEventListener('click', () => { state.flagship = +b.dataset.flag; saveGame(); render(); }));
  q('[data-quest]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.quest;
    if (accept(id)) { toast('接下了委托：' + QUEST_BY_ID[id].title); saveGame(); render(); }
  }));
  q('[data-act]').forEach(b => b.addEventListener('click', () => doAct(b.dataset.act)));
  // 新设施的按钮一律写成 data-fac="设施:操作:参数"，转给 facilities.js
  q('[data-fac]').forEach(b => b.addEventListener('click', () => doFacilityAction(b.dataset.fac)));
}

function doAct(a) {
  if (a === 'final') return finalChoices();
  if (a === 'pardon') return offerPardon();
  if (a === 'rum') {
    if (state.player.gold < 300) return toast('金币不足。');
    state.player.gold -= 300; state.crewMorale = Math.min(100, state.crewMorale + 12);
    toast('全船欢呼！'); saveGame(); render();
  } else if (a === 'letter') {
    if (state.player.gold < 500) return toast('金币不足。');
    state.player.gold -= 500; addFame('battle', 5); state.flags.privateer = true;
    addLog('取得私掠许可状。'); toast('获得私掠许可状。'); saveGame(); afterQuestTick();
  } else if (a === 'heal') {
    const hurt = state.player.hpMax - state.player.hp, cost = Math.round(hurt * 8 * healDiscount());
    if (hurt <= 0) return toast('你没有伤。');
    if (state.player.gold < cost) return toast('金币不足。');
    state.player.gold -= cost; state.player.hp = state.player.hpMax;
    toast('伤口包扎好了。'); saveGame(); render();
  } else if (a === 'tend') {
    const cost = Math.round(400 * healDiscount());
    if (state.player.gold < cost) return toast('金币不足。');
    state.player.gold -= cost; state.crewMorale = Math.min(100, state.crewMorale + 15);
    toast('病号们缓过来了。'); saveGame(); render();
  } else if (a === 'bounty') {
    openModal({
      title: '悬赏布告',
      body: `<p>各殖民地总督对海盗的悬赏：</p><ul>
        <li>查尔斯·瓦恩 —— 100 英镑</li><li>"棉布杰克"拉克姆 —— 80 英镑</li>
        <li><b>爱德华·蒂奇（黑胡子）—— ${Math.max(20, state.player.infamy * 3)} 英镑</b></li></ul>`,
      actions: [{ label: '知道了', primary: true, onClick: closeModal }],
    });
  }
}

function hireCrew(n) {
  const cost = n * 20;
  if (state.player.gold < cost) return toast('金币不足。');
  const room = state.fleet.reduce((a, s) => a + (s.crewMax - s.crew), 0);
  if (room <= 0) return toast('船上已经站不下人了。');
  const take = Math.min(n, room);
  state.player.gold -= take * 20;
  let left = take;
  for (const s of state.fleet) {
    const r = Math.min(s.crewMax - s.crew, left);
    s.crew += r; left -= r;
    if (left <= 0) break;
  }
  toast(`招募 ${take} 名船员（今后每月 ${take * 3} 金币薪水）。`);
  saveGame(); render();
}
function hireOfficer(id) {
  const o = OFFICER_BY_ID[id];
  if (state.player.gold < (o.hireCost || 0)) return toast('金币不足。');
  state.player.gold -= (o.hireCost || 0);
  state.officers.push(id);
  if (o.bonus) for (const k in o.bonus) {
    if (k === 'morale') state.crewMorale = Math.min(100, state.crewMorale + o.bonus[k]);
    else if (state.player.skills[k] !== undefined) state.player.skills[k] += o.bonus[k];
  }
  addLog(`${o.name} 加入了你的船。`);
  toast(`${o.name} 加入！月薪 60 金币。`);
  saveGame(); afterQuestTick();
}
function repairShip(i) {
  const s = state.fleet[i], st = shipStat(s);
  const cost = Math.round((st.hullMax - s.hull) * 12);
  if (state.player.gold < cost) return toast('金币不足。');
  state.player.gold -= cost; s.hull = st.hullMax;
  toast('修理完毕。'); saveGame(); render();
}
function upgradeShip(i, upId) {
  const s = state.fleet[i], u = UPGRADES.find(x => x.id === upId);
  if ((s.upgrades[upId] || 0) >= u.max) return toast('已达改装上限。');
  if (state.player.gold < u.price) return toast('金币不足。');
  state.player.gold -= u.price;
  s.upgrades[upId] = (s.upgrades[upId] || 0) + 1;
  if (upId === 'plating') s.hull += 30;
  toast(`${u.name}完成。`); saveGame(); render();
}
function buyShip(typeId) {
  const t = SHIP_BY_ID[typeId];
  if (state.fleet.length >= 4) return toast('舰队已满（4 艘）。');
  if (state.player.gold < t.price) return toast('金币不足。');
  state.player.gold -= t.price;
  state.fleet.push(makeShip(typeId));
  addLog(`购入一艘${t.name}。`);
  toast(`${t.name} 入列。`); saveGame(); render();
}

// ===== 港口 NPC 对话 =====
function talkTo(n) {
  if (n.kind === 'flavor') {
    return openModal({ title: n.name, body: `<div class="dlg-text">${n.line}</div>`,
      actions: [{ label: '走开', primary: true, onClick: closeModal }] });
  }
  showDialogNode(n, 'start');
}
function showDialogNode(n, key) {
  const node = n.dialog[key];
  if (!node) return closeModal();
  const actions = (node.choices || []).map(c => ({
    label: c.label,
    onClick: () => { c.next ? showDialogNode(n, c.next) : (c.act ? runDialogAct(n, c.act) : closeModal()); },
  }));
  if (!actions.length) actions.push({ label: '（继续）', primary: true, onClick: () => runDialogAct(n, node.act) });
  openModal({ title: n.name, wide: true,
    body: `<div class="dlg-npc">${n.name}</div><div class="dlg-text">${node.text}</div>`, actions });
}
function runDialogAct(n, act) {
  closeModal();
  onTalk(n.id);
  if (act) {
    if (act.type === 'quest') {
      const q = QUEST_BY_ID[act.id];
      if (q && !isActive(act.id) && !isDone(act.id)) {
        accept(act.id);
        openModal({ title: '接受任务',
          body: `<div class="dlg-quest"><b>${q.kind === 'main' ? '【主线】' : '【支线】'}${q.title}</b>
            <p style="margin-top:6px">${escapeHtml(q.desc)}</p></div>`,
          actions: [{ label: '好', primary: true, onClick: () => { closeModal(); afterQuestTick(); } }] });
        saveGame(); return;
      }
    } else if (act.type === 'panel') openTownFacility(act.panel);
    else if (act.type === 'flag') state.flags[act.flag] = true;
  }
  afterQuestTick();
  saveGame();
  refreshTown();
}

const KIND_WORD = (k) => ({ main: '主线', side: '支线', job: '公会' }[k] || '支线');

function afterQuestTick() {
  // 先清逾期的委托，再判完成——过期的就不该再算完成了
  const expired = checkDeadlines();
  for (const q of expired) toast(`委托逾期作废：${q.title}`);
  const finished = checkAll();
  const n = finished.length;
  if (!n) { render(); return 0; }
  const showNext = () => {
    const f = finished.shift();
    if (!f) { render(); return; }
    openModal({ title: `✅ 完成${KIND_WORD(f.quest.kind)}任务`, wide: true,
      body: `<div class="story"><b>${f.quest.title}</b>
        <p style="margin-top:8px">${escapeHtml(f.quest.doneText || '')}</p>
        <p class="goal">🎁 奖励：${f.rewards.join('、') || '—'}</p></div>`,
      actions: [{ label: '继续', primary: true, onClick: () => { closeModal(); showNext(); } }] });
  };
  showNext();
  return n;
}

// ===== 航行 =====
function onSailPortTap(p) {
  const d = distanceNm(state.position, p);
  const known = state.discovered.includes(p.id);
  openModal({
    title: known ? p.name : '未探明的港口',
    body: `${known ? `<p>${escapeHtml(p.blurb)}</p><p class="small"><b>${NATIONS[p.nation].flag} ${NATIONS[p.nation].name}</b></p>` : '<p>远远看见一片桅杆。</p>'}
      <p>距离 <b>${d}</b> 海里。${d <= ENTER_PORT_NM ? '已在可入港范围内。' : '需要先航行过去。'}</p>`,
    actions: [
      d <= ENTER_PORT_NM
        ? { label: '进入港口', primary: true, onClick: () => { closeModal(); doEnterPort(p.id); } }
        : {
          label: '驶向该港', primary: true, onClick: () => {
            closeModal();
            // 港口坐标常落在粗精度海岸线内侧，把航点放到它外面的锚地水域
            const approach = nearestSeaPoint({ lng: p.lng, lat: p.lat }) || { lng: p.lng, lat: p.lat };
            const r = setWaypoint(approach.lng, approach.lat);
            if (!r.ok) return toast(r.msg);
            render();
          },
        },
      { label: '取消', onClick: closeModal },
    ],
  });
}

function doEnterPort(portId) {
  const r = enterPort(portId);
  if (!r.ok) return toast(r.msg);
  stopSail();
  if (r.isNew) toast(`发现新港口：${r.port.name}！`);
  saveGame();
  setView('port');
  afterQuestTick();
}

function onShipTap(s) {
  const d = distanceNm(state.position, s);
  if (d > MEET_NM * 2) {
    return openModal({
      title: s.kind === 'patrol' ? '远处的巡逻舰' : '远处的商船',
      body: `<p>距离 <b>${d}</b> 海里，还够不着。要追上去吗？</p>`,
      actions: [
        { label: '追过去', primary: true, onClick: () => { closeModal(); setWaypoint(s.lng, s.lat); render(); } },
        { label: '不理会', onClick: closeModal },
      ],
    });
  }
  showEncounter({ ...s, nm: d });
}

// ===== 实时航行 =====
// 起航后时钟自行流逝、船逐帧前进；遇事（遭遇/风暴/抵港/到达航点）自动停船。
const SEC_PER_GAME_HOUR = 0.30;       // 1 倍速下，一个游戏小时约合 0.3 秒真实时间
const SPEEDS = [1, 2, 4];

// 只停表，不重绘（供切视图/开新局这类自己会重绘的路径调用）
function stopSail() {
  sailing = false;
  if (sailRaf) { cancelAnimationFrame(sailRaf); sailRaf = 0; }
}
function setSailing(on) {
  sailing = on;
  if (sailing) { sailLast = 0; sailRaf = requestAnimationFrame(loopSail); }
  else if (sailRaf) { cancelAnimationFrame(sailRaf); sailRaf = 0; }
  render();
}
function toggleSail() {
  if (!sailing && !state.waypoint) return toast('先点海面定一个航点，再起航。');
  setSailing(!sailing);
}
function cycleSpeed() {
  sailMul = SPEEDS[(SPEEDS.indexOf(sailMul) + 1) % SPEEDS.length];
  render();
}

// 时钟跟的是真实时间，不是帧数——帧率低（后台标签页、老 iPad）也不该把航程拖慢。
// 但一帧要补的时间可能很长，必须切成小步走，否则船会一步跨过海角或错过遭遇。
const MAX_CATCHUP_SEC = 1.0;    // 一帧最多补 1 秒真实时间，防止切后台回来跳好几天
const MAX_CHUNK_HOURS = 2;      // 每小步最多 2 游戏小时

function loopSail(ts) {
  if (!sailing) return;
  if (!sailLast) sailLast = ts;
  const dtReal = Math.min(MAX_CATCHUP_SEC, (ts - sailLast) / 1000);
  sailLast = ts;
  let hours = (dtReal / SEC_PER_GAME_HOUR) * sailMul;
  while (hours > 0) {
    const chunk = Math.min(MAX_CHUNK_HOURS, hours);
    hours -= chunk;
    if (stepHours(chunk)) { setSailing(false); return; }
  }
  renderHud();
  renderCmd();
  sailRaf = requestAnimationFrame(loopSail);
}

// 返回 true 表示需要停船
function stepHours(hours) {
  if (state.gameOver) return true;
  const prevMonth = state.date.m;
  const res = advanceHours(hours);
  if (state.date.m !== prevMonth) {
    monthlyMarketDrift();
    for (const n of rollMarketEvents()) { addLog('行情：' + n); toast('📰 ' + n); }
  }

  let interrupt = false;
  for (const e of res.events) {
    if (e.type === 'mutiny') { interrupt = true; showMutiny(); }
    else if (e.type === 'wageFail') { interrupt = true; toast(e.msg); }
    else toast(e.msg);
  }
  // 发现物：停船弹窗，这是原版探险线最有仪式感的一刻
  if (res.discovered) {
    interrupt = true;
    showDiscovery(res.discovered);
  }
  if (res.reachedWaypoint) { interrupt = true; toast('已到达航点。'); }
  if (res.weather === 'storm') { interrupt = true; return showStorm(), true; }
  if (res.encounter) { interrupt = true; showEncounter(res.encounter); }

  const near = portInReach();
  const nearId = near ? near.id : null;
  if (nearId !== lastNearPort) {
    if (near && !state.atPort && !res.encounter) {
      interrupt = true;
      toast(`已抵达${near.name}外海，可以入港。`);
    }
    lastNearPort = nearId;
  }
  // 日结算才跑剧情/任务判定与存档——每帧跑一次太贵，也没有意义
  if (res.dayRolled) {
    if (onDayAdvanced()) interrupt = true;
    if (afterQuestTick()) interrupt = true;
    saveGame();
  }
  if (interrupt) { saveGame(); render(); }
  return interrupt;
}

function showDiscovery(list) {
  const queue = [...list];
  const next = () => {
    const d = queue.shift();
    if (!d) { saveGame(); render(); return; }
    openModal({
      title: `🧭 发现了${KIND_NAME[d.kind]}`, wide: true,
      body: `<div class="story">
        <h2 style="margin-bottom:4px">${d.name}</h2>
        <p class="small muted">${d.nameEn}</p>
        <p style="margin-top:10px">${d.blurb}</p>
        <p class="small muted">${d.note}</p>
        <p class="goal">记进了航海日志。上缴给收藏家可换约 🪙 ${fmt(d.reward)} 与冒险名声 +${d.fame}。</p>
        <p class="small muted">收藏家在里斯本、阿姆斯特丹、伦敦的邸宅里。</p>
      </div>`,
      actions: [{ label: '记下来', primary: true, onClick: () => { closeModal(); next(); } }],
    });
  };
  next();
}

function showStorm() {
  const dmg = 8 + Math.round(Math.random() * 18);
  for (const s of state.fleet) s.hull = Math.max(10, s.hull - dmg);
  state.crewMorale -= 5;
  addLog('遭遇风暴，船体受损。');
  openModal({
    title: '🌊 风暴',
    body: `<p>乌云压到桅顶，浪头一个接一个砸上甲板。你下令收帆，船在浪谷里挣扎了整整一夜。</p>
           <p class="bad">全舰队耐久 −${dmg}，士气 −5。</p>`,
    actions: [{ label: '挺过去了', primary: true, onClick: () => { closeModal(); saveGame(); render(); } }],
  });
}

function showEncounter(enc) {
  const isPatrol = enc.kind === 'patrol';
  openModal({
    title: isPatrol ? '⚔️ 巡逻舰' : '💰 商船',
    body: `<p>${isPatrol ? '桅顶传来喊声：「军舰！挂着战旗，正朝我们来！」' : '了望手大喊：「右舷有船！吃水很深——满载的！」'}</p>
      <p class="small muted">相距 <b>${enc.nm}</b> 海里——${enc.nm <= 4 ? '几乎是贴着舷了' : enc.nm <= 8 ? '很近' : '还有一段距离'}。
        开战时双方的初始间隔就取决于这个距离。</p>`,
    actions: [
      { label: isPatrol ? '迎战' : '追击并接舷', primary: true, onClick: () => { closeModal(); enterBattle(enc); } },
      { label: '扯满帆避开', onClick: () => {
        closeModal();
        state.npcShips = (state.npcShips || []).filter(s => s.id !== enc.id);
        const esc = Math.random() < 0.55 + state.player.skills.sailing * 0.05;
        if (esc) { toast('甩掉了对方。'); addLog('避开了一场遭遇。'); }
        else { for (const s of state.fleet) s.hull = Math.max(5, s.hull - 15); toast('被追上并挨了一轮炮击！'); }
        saveGame(); render();
      } },
    ],
  });
}

function enterBattle(enc) {
  startBattle(enc, (result) => {
    state.npcShips = (state.npcShips || []).filter(s => s.id !== enc.id);
    if (result.win) {
      onBattleWin(enc.kind);
      state.player.gold += result.loot || 0;
      state.player.exp += 10;
      // 战斗名声人人可得；抢商船涨恶名，打巡逻舰涨得更多
      addFame('battle', enc.kind === 'patrol' ? 8 : 4);
      if (enc.kind === 'merchant') state.player.infamy += 3;
      if (enc.kind === 'patrol') state.player.infamy += 5;
      addLog(`海战获胜，缴获 ${result.loot || 0} 金币。`);
      if (state.chapter >= 3 && !state.flags.hasQAR) {
        grantQAR();
        openModal({ title: '安妮女王复仇号', wide: true,
          body: `<div class="story"><p>这艘船三百吨重，货舱能塞下四十门炮。弟兄们问要不要卖掉换钱。</p>
            <p>你说：<b>不卖。</b></p><p>三周后，它挂上了新名字——<b>安妮女王复仇号</b>。</p></div>`,
          actions: [{ label: '升起黑旗', primary: true, onClick: () => { closeModal(); render(); } }] });
      }
      setTimeout(afterQuestTick, 60);
    } else if (result.wiped) {
      state.gameOver = true; state.ending = 'lost';
      addLog('舰队全灭。海上再没有属于你的甲板。');
      saveGame();
      openModal({ title: '💀 舰队全灭', wide: true,
        body: `<div class="story"><p>最后一条船在你脚下沉下去。海水没过甲板的时候，你还抓着舵轮。</p>
          <p class="muted">没有船的船长，什么都不是。</p></div>`,
        actions: [{ label: '回到主菜单', primary: true, onClick: () => { closeModal(); showStart(); } }] });
      return;
    } else {
      state.crewMorale -= 10;
      addLog('海战失利，狼狈脱离。');
    }
    saveGame(); render();
  });
}

function showMutiny() {
  openModal({
    title: '🔪 哗变',
    body: `<p>船员围在主桅下，为首的把弯刀插在甲板上：「船长，我们要吃饭，还要工钱。」</p>`,
    actions: [
      { label: '分发金币安抚（500）', primary: true, onClick: () => {
        closeModal();
        if (state.player.gold >= 500) { state.player.gold -= 500; state.crewMorale += 30; toast('风波平息。'); }
        else { state.crewMorale += 5; toast('你拿不出钱——他们更愤怒了。'); }
        saveGame(); render();
      } },
      { label: '拔枪镇压', onClick: () => {
        closeModal();
        const win = Math.random() < 0.4 + state.player.skills.leadership * 0.08;
        if (win) { state.crewMorale += 22; state.player.infamy += 4; toast('你震住了他们。'); }
        else {
          const lost = Math.round(fleetCrew() * 0.3);
          let left = lost;
          for (const s of state.fleet) { const t = Math.min(s.crew - 1, left); if (t > 0) { s.crew -= t; left -= t; } }
          state.crewMorale = 40; toast(`一场混战，损失 ${lost} 名船员。`);
        }
        saveGame(); render();
      } },
    ],
  });
}

// ===== 菜单 / 存档 =====
function showMenu() {
  openModal({
    title: '菜单', body: `<p class="muted small">版本 v${APP_VERSION}</p>`,
    actions: [
      { label: '💾 保存到槽位', primary: true, onClick: () => { closeModal(); showSlots('save'); } },
      { label: '📂 读取存档', onClick: () => { closeModal(); showSlots('load'); } },
      { label: '🏠 返回主菜单', onClick: () => { closeModal(); showStart(); } },
      { label: '关闭', onClick: closeModal },
    ],
  });
}
function slotCardHtml(meta, i, mode) {
  if (!meta) {
    return `<div class="slot empty"><b>存档位 ${i}</b><span class="muted">（空）</span>
      ${mode === 'save' ? `<button class="mini" data-slot="${i}" data-op="save">保存</button>` : ''}</div>`;
  }
  const d = new Date(meta.savedAt);
  const when = `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const where = PORT_BY_ID[meta.where]?.name || '海上';
  return `<div class="slot"><b>存档位 ${i}</b>
    <span class="small">${meta.date.y}.${meta.date.m}.${meta.date.d} · 第 ${meta.chapter} 章 · ${where}</span>
    <span class="small muted">🪙${fmt(meta.gold)} 🎖️${meta.fame} 🏴‍☠️${meta.infamy} ⚓${meta.ships} 艘 · ${when}</span>
    <span class="slot-acts">
      ${mode === 'save' ? `<button class="mini" data-slot="${i}" data-op="save">覆盖</button>` : `<button class="mini" data-slot="${i}" data-op="load">读取</button>`}
      <button class="mini danger" data-slot="${i}" data-op="del">删除</button></span></div>`;
}
function showSlots(mode) {
  const metas = listSaveSlots();
  openModal({
    title: mode === 'save' ? '保存游戏' : '读取存档',
    body: `<div class="slots">${metas.map((m, i) => slotCardHtml(m, i + 1, mode)).join('')}</div>`,
    actions: [{ label: '关闭', onClick: closeModal }],
  });
  $$('[data-slot]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.slot, op = b.dataset.op;
    if (op === 'save') { saveToSlot(i); toast(`已保存到存档位 ${i}`); showSlots('save'); }
    else if (op === 'del') { deleteSlot(i); showSlots(mode); }
    else {
      const r = loadFromSlot(i);
      if (!r.ok) return toast(r.reason === 'version' ? '存档来自旧版本（v' + r.oldVersion + '），请开新局。' : '存档损坏或为空。');
      closeModal(); showGame(); toast('读取成功。');
    }
  }));
}

export function refresh() { render(); }
