// UI 外壳（仿《大航海时代2》）：港口主视野 / 近海航行视野 / 全球海图三层。
// 顶部信息条 + 底部指令栏 + 滑入式侧栏面板。
import {
  state, APP_VERSION, NUM_SLOTS, initNewGame, saveGame, loadGame, hasSave,
  saveToSlot, loadFromSlot, deleteSlot, listSaveSlots, addLog,
  shipStat, cargoUsed, fleetCrew, fleetSpeed, makeShip,
} from './state.js';
import { PORTS, PORT_BY_ID, NATIONS } from './data/ports.js';
import { GOODS, GOOD_BY_ID } from './data/goods.js';
import { SHIPS, SHIP_BY_ID, UPGRADES } from './data/ships.js';
import { OFFICERS, OFFICER_BY_ID } from './data/officers.js';
import { openTown, closeTown, refreshTown, townEntities } from './town.js';
import { openSail, closeSail, zoomSail, sailSpanDeg } from './sailview.js';
import { openChart, closeChart } from './worldmap.js';
import {
  advanceDay, setWaypoint, clearWaypoint, leavePort, enterPort, portInReach,
  dateStr, grainOnBoard, waterCapacity, refillWater, monthlyWage, ensureNpcShips,
  nearestSeaPoint, MEET_NM, ENTER_PORT_NM,
} from './voyage.js';
import { marketList, buy, sell, fleetCargoTotal, fleetCargoSpace, monthlyMarketDrift } from './trade.js';
import { windAt, distanceNm, bearing } from './geo.js';
import { seaAt } from './data/coast.js';
import { reveal, exploredRatio } from './fog.js';
import { onDayAdvanced, tryChapter, describeChapter, offerPardon, finalChoices, grantQAR } from './story.js';
import { startBattle } from './battle.js';
import {
  ensureQuests, syncMainQuests, checkAll, accept, offersAt, activeQuests, doneQuests,
  progressText, isActive, isDone, onBattleWin, onTalk,
} from './quests.js';
import { QUEST_BY_ID } from './data/quests.js';

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
let sailing = false, sailTimer = null;

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
export function boot() {
  $('#version').textContent = 'v' + APP_VERSION;
  $('#btn-new').addEventListener('click', () => { initNewGame(); saveGame(); showGame(); tryChapter(); });
  $('#btn-continue').addEventListener('click', () => {
    const r = loadGame();
    if (!r.ok) { toast(r.reason === 'version' ? '存档版本不兼容。' : '没有可用的存档。'); return; }
    showGame();
  });
  $('#btn-slots').addEventListener('click', () => showSlots('load'));
  $('#btn-continue').disabled = !hasSave();
  $('#tp-close').addEventListener('click', () => closeTownFacility());
  $('#chart-close').addEventListener('click', () => { closeChart(); $('#chart-view').classList.add('hidden'); });
  showStart();
}

function showStart() {
  sailing = false;
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
      <span class="hud-where">${where}</span>
      <span class="hud-gold">🪙 ${fmt(p.gold)}</span>
      <span title="每月工资">💰 月薪 ${wage}</span>
    </div>
    <div class="hud-row small">
      <span title="官方声望">🎖️ ${p.fame}</span>
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
  const common = `
    <button class="cmd-btn" data-cmd="chart">🗺️ 海图</button>
    <button class="cmd-btn" data-cmd="fleet">⚓ 舰队</button>
    <button class="cmd-btn" data-cmd="quests">📋 任务${activeQuests().length ? ` (${activeQuests().length})` : ''}</button>
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
    c.innerHTML = `
      <button class="cmd-btn primary" data-cmd="day">⏭️ 航行一天</button>
      <button class="cmd-btn" data-cmd="auto">${sailing ? '⏸️ 停止' : '⏩ 连续航行'}</button>
      ${state.waypoint ? '<button class="cmd-btn" data-cmd="stop">⚓ 抛锚</button>' : ''}
      ${near ? `<button class="cmd-btn primary" data-cmd="enter" data-port="${near.id}">🏛️ 进入${near.name}</button>` : ''}
      <button class="cmd-btn" data-cmd="zoomin">🔍+</button>
      <button class="cmd-btn" data-cmd="zoomout">🔍−</button>
      <span class="cmd-hint">${state.waypoint ? '航行中：点海面可改航向' : '点海面设定下一个航点'} · 视野 ${sailSpanDeg()}°</span>
      <span class="cmd-spacer"></span>${common}`;
  }
  $$('#cmd [data-cmd]').forEach(b => b.addEventListener('click', () => doCmd(b.dataset.cmd, b.dataset)));
}

function doCmd(cmd, ds) {
  if (cmd === 'sail') { leavePort(); setView('sail'); return; }
  if (cmd === 'day') return stepDay();
  if (cmd === 'auto') return toggleSail();
  if (cmd === 'stop') { clearWaypoint(); sailing = false; render(); return; }
  if (cmd === 'enter') return doEnterPort(ds.port);
  if (cmd === 'zoomin') { zoomSail(-1); render(); return; }
  if (cmd === 'zoomout') { zoomSail(1); render(); return; }
  if (cmd === 'chart') { $('#chart-view').classList.remove('hidden'); openChart(); return; }
  if (cmd === 'menu') return showMenu();
  if (['fleet', 'quests', 'log'].includes(cmd)) return openSidePanel(cmd);
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
      : renderLog();
  $('#panel').innerHTML = `
    <div class="panel-nav">
      <button class="nav-btn${sidePanel === 'fleet' ? ' active' : ''}" data-side="fleet">⚓ 舰队</button>
      <button class="nav-btn${sidePanel === 'quests' ? ' active' : ''}" data-side="quests">📋 任务</button>
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
  townFacility = null;
  const el = $('#town-panel');
  if (el) el.classList.add('hidden');
}
const FAC_TITLE = {
  market: '🛒 市场', tavern: '🍺 酒馆', shipyard: '🔨 造船厂',
  governor: '🏛️ 总督府', church: '⛪ 医馆',
};
function renderTownPanel() {
  const p = state.atPort ? PORT_BY_ID[state.atPort] : null;
  if (!p || !townFacility) return;
  const map = {
    market: renderMarket, tavern: renderTavern, shipyard: renderShipyard,
    governor: renderGovernor, church: renderChurch,
  };
  $('#tp-title').textContent = FAC_TITLE[townFacility] || '';
  $('#tp-body').innerHTML = (map[townFacility] || (() => ''))(p);
  attachPanel($('#town-panel'));
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
  const buyList = SHIPS.filter(s => !s.story && s.price > 0).map(s => `
    <div class="ship-row">
      <div><b>${s.name}</b> <span class="muted">${s.nameEn}</span></div>
      <p class="small muted">耐久 ${s.hull} · 炮 ${s.guns} · 装甲 ${s.armor} · 航速 ${s.speed} · 舱 ${s.cargo} · 船员上限 ${s.crewMax}</p>
      <p class="small">${escapeHtml(s.note)}</p>
      <button class="primary-btn" data-buyship="${s.id}" ${state.player.gold < s.price || state.fleet.length >= 4 ? 'disabled' : ''}>购买（${fmt(s.price)}）</button>
    </div>`).join('');
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
function renderChurch(p) {
  const hurt = state.player.hpMax - state.player.hp;
  const healCost = Math.max(0, Math.round(hurt * 8));
  return `<div class="card">
      <h3>⛪ ${p.name} · 医馆</h3>
      <p class="blurb">修士放下研钵：「伤口要洗干净，酒不能代替药——虽然你们没人听。」</p>
      <p class="small">体力 ${state.player.hp}/${state.player.hpMax} · 船员士气 ${Math.round(state.crewMorale)}</p>
      <div class="btn-row">
        <button class="primary-btn" data-act="heal" ${hurt <= 0 ? 'disabled' : ''}>🩹 治疗${hurt > 0 ? `（${healCost}）` : '（无伤）'}</button>
        <button class="ghost-btn" data-act="tend">💊 医治病号（400，士气 +15）</button>
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
      <p class="small muted">声望 ${p.fame} ／ 恶名 ${p.infamy} · 月薪支出 ${monthlyWage()}</p>
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
    state.player.gold -= 500; state.player.fame += 5; state.flags.privateer = true;
    addLog('取得私掠许可状。'); toast('获得私掠许可状。'); saveGame(); afterQuestTick();
  } else if (a === 'heal') {
    const hurt = state.player.hpMax - state.player.hp, cost = Math.round(hurt * 8);
    if (hurt <= 0) return toast('你没有伤。');
    if (state.player.gold < cost) return toast('金币不足。');
    state.player.gold -= cost; state.player.hp = state.player.hpMax;
    toast('伤口包扎好了。'); saveGame(); render();
  } else if (a === 'tend') {
    if (state.player.gold < 400) return toast('金币不足。');
    state.player.gold -= 400; state.crewMorale = Math.min(100, state.crewMorale + 15);
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

function afterQuestTick() {
  const finished = checkAll();
  const n = finished.length;
  if (!n) { render(); return 0; }
  const showNext = () => {
    const f = finished.shift();
    if (!f) { render(); return; }
    openModal({ title: `✅ 完成${f.quest.kind === 'main' ? '主线' : '支线'}任务`, wide: true,
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
  sailing = false;
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

function toggleSail() {
  sailing = !sailing;
  render();
  if (sailing) loopSail();
}
function loopSail() {
  clearTimeout(sailTimer);
  if (!sailing) { render(); return; }
  if (stepDay()) { sailing = false; render(); return; }
  sailTimer = setTimeout(loopSail, 380);
}

// 返回 true 表示需要中断连续航行
function stepDay() {
  if (state.gameOver) return true;
  const prevMonth = state.date.m;
  const res = advanceDay();
  if (state.date.m !== prevMonth) monthlyMarketDrift();

  let interrupt = false;
  for (const e of res.events) {
    if (e.type === 'mutiny') { interrupt = true; showMutiny(); }
    else if (e.type === 'wageFail') { interrupt = true; toast(e.msg); }
    else toast(e.msg);
  }
  if (res.reachedWaypoint) { interrupt = true; toast('已到达航点。'); }
  if (res.weather === 'storm') { interrupt = true; return showStorm(), true; }
  if (res.encounter) { interrupt = true; showEncounter(res.encounter); }

  const near = portInReach();
  if (near && !state.atPort && !res.encounter) {
    interrupt = true;
    toast(`已抵达${near.name}外海，可以入港。`);
  }
  if (onDayAdvanced()) interrupt = true;
  if (afterQuestTick()) interrupt = true;
  saveGame();
  render();
  return interrupt;
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
      if (enc.kind === 'merchant') state.player.infamy += 3;
      if (enc.kind === 'patrol') { state.player.infamy += 5; state.player.fame -= 2; }
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
      if (!r.ok) return toast(r.reason === 'version' ? '存档版本不兼容。' : '存档损坏或为空。');
      closeModal(); showGame(); toast('读取成功。');
    }
  }));
}

export function refresh() { render(); }
