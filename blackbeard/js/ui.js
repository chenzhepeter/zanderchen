// UI：开始菜单 / 海图主界面 / 港口设施 / 存档槽位 / 模态与提示
// 复用 airline/js/ui.js 的核心组件：openModal({title,body,actions}) / toast / escapeHtml / fmt
import {
  state, APP_VERSION, NUM_SLOTS, initNewGame, saveGame, loadGame, hasSave,
  saveToSlot, loadFromSlot, deleteSlot, listSaveSlots, addLog,
  shipStat, cargoUsed, fleetCrew, fleetSpeed, makeShip,
} from './state.js';
import { PORTS, PORT_BY_ID, NATIONS } from './data/ports.js';
import { GOODS, GOOD_BY_ID } from './data/goods.js';
import { SHIPS, SHIP_BY_ID, UPGRADES } from './data/ships.js';
import { OFFICERS, OFFICER_BY_ID } from './data/officers.js';
import { initMap, drawPorts, drawRoute, clearRoute, setShip, zoomTo, pingAt } from './worldmap.js';
import { startVoyage, abortVoyage, advanceDay, planRoute, routeDistanceNm, dateStr } from './voyage.js';
import { marketList, buy, sell, fleetCargoTotal, fleetCargoSpace, monthlyMarketDrift } from './trade.js';
import { windAt, bearing, distanceNm } from './geo.js';
import { openTown, closeTown, refreshTown } from './town.js';
import {
  ensureQuests, syncMainQuests, checkAll, accept, offersAt, activeQuests, doneQuests,
  progressText, isActive, isDone, onBattleWin, onTalk,
} from './quests.js';
import { QUEST_BY_ID } from './data/quests.js';
import { STORY_NPCS } from './data/npcs.js';
import { waterCapacity, refillWater, grainOnBoard } from './voyage.js';
import { onDayAdvanced, tryChapter, describeChapter, offerPardon, finalChoices, grantQAR } from './story.js';
import { startBattle } from './battle.js';

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

let panel = 'map';
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
  $('#btn-new').addEventListener('click', () => {
    initNewGame();
    saveGame();
    showGame();
    tryChapter();
  });
  $('#btn-continue').addEventListener('click', () => {
    const r = loadGame();
    if (!r.ok) { toast(r.reason === 'version' ? '存档版本不兼容。' : '没有可用的存档。'); return; }
    showGame();
  });
  $('#btn-slots').addEventListener('click', () => showSlots('load'));
  $('#btn-continue').disabled = !hasSave();
  $('#town-leave').addEventListener('click', () => { closeTown(); panel = 'port'; render(); });
  showStart();
}

function showStart() {
  $('#start-screen').hidden = false;
  $('#game-screen').hidden = true;
}

let mapReady = false;
export function showGame() {
  $('#start-screen').hidden = true;
  $('#game-screen').hidden = false;
  if (!mapReady) {
    initMap($('#chart'), { onPortClick: onPortClick, onSeaClick: () => {} });
    mapReady = true;
  }
  ensureQuests();
  syncMainQuests();
  drawPorts(state);
  refreshMap();
  panel = state.atPort ? 'port' : 'map';
  render();
}

function refreshMap() {
  const v = state.voyage;
  if (v) { drawRoute(v.path); } else clearRoute();
  const hd = v && v.idx < v.path.length - 1 ? bearing(state.position, v.path[v.idx + 1]) : 0;
  setShip(state.position.lng, state.position.lat, hd, true);
}

// ===== 主渲染 =====
export function render() {
  renderHud();
  renderPanel();
  refreshMap();
}

function renderHud() {
  const p = state.player;
  const w = windAt(state.position.lng, state.position.lat, state.date.m);
  const where = state.atPort ? PORT_BY_ID[state.atPort].name : (state.voyage ? '航行中' : '海上');
  const grain = grainOnBoard();
  $('#hud').innerHTML = `
    <div class="hud-row">
      <span class="hud-date">📅 ${dateStr()}</span>
      <span class="hud-where">📍 ${where}</span>
      <span class="hud-gold">🪙 ${fmt(p.gold)}</span>
    </div>
    <div class="hud-row small">
      <span title="官方声望">🎖️ 声望 ${p.fame}</span>
      <span title="海盗恶名">🏴‍☠️ 恶名 ${p.infamy}</span>
      <span title="船员士气">😐 士气 ${Math.round(state.crewMorale)}</span>
      <span title="粮食（货舱里的粮食货物）"${grain <= 0 ? ' style="color:#ff9a8a"' : ''}>🌾 ${grain}</span>
      <span title="淡水（靠港免费补满）">💧 ${state.supplies.water}</span>
      <span title="风向">🌬️ ${w.name}</span>
    </div>`;
}

function navBtn(id, label) {
  return `<button class="nav-btn${panel === id ? ' active' : ''}" data-panel="${id}">${label}</button>`;
}

function renderPanel() {
  const atPort = state.atPort ? PORT_BY_ID[state.atPort] : null;
  const nQ = activeQuests().length;
  let nav = navBtn('map', '🗺️ 海图') + navBtn('quests', `📋 任务${nQ ? ` (${nQ})` : ''}`)
    + navBtn('fleet', '⚓ 舰队') + navBtn('log', '📜 日志');
  if (atPort) {
    nav = navBtn('port', '🏛️ ' + atPort.name) + nav;
  }
  let body = '';
  if (panel === 'map') body = renderMapPanel();
  else if (panel === 'port') body = renderPortPanel(atPort);
  else if (panel === 'market') body = renderMarket(atPort);
  else if (panel === 'tavern') body = renderTavern(atPort);
  else if (panel === 'shipyard') body = renderShipyard(atPort);
  else if (panel === 'governor') body = renderGovernor(atPort);
  else if (panel === 'church') body = renderChurch(atPort);
  else if (panel === 'fleet') body = renderFleet();
  else if (panel === 'quests') body = renderQuests();
  else if (panel === 'log') body = renderLog();

  $('#panel').innerHTML = `<div class="panel-nav">${nav}
      <button class="nav-btn" data-act="menu">☰</button></div>
    <div class="panel-body">${storyCard()}${body}</div>`;
  attachPanel();
}

// 章节提示卡：显示当前目标；终章给出"三个抉择"入口
function storyCard() {
  if (state.gameOver) {
    return `<div class="card"><h3>🏁 本局已结束</h3>
      <p class="small muted">结局：${state.ending}。可从菜单开始新的航程。</p></div>`;
  }
  const ch = describeChapter(state.chapter);
  if (!ch) return '';
  const final = state.chapter >= 6;
  return `<div class="card">
    <h3>${ch.title}</h3>
    <p class="small">🎯 ${ch.goal}</p>
    ${final ? '<div class="btn-row"><button class="primary-btn" data-act="final">⚖️ 做出最终抉择</button></div>' : ''}
  </div>`;
}

function renderMapPanel() {
  const v = state.voyage;
  if (v) {
    const dest = PORT_BY_ID[v.destId];
    const left = routeDistanceNm(v.path.slice(v.idx));
    return `<div class="card">
      <h3>航行中 → ${dest.name}</h3>
      <p class="muted">已航行 ${v.days} 天，剩余约 ${fmt(left)} 海里。舰队航速 ${fleetSpeed().toFixed(1)} 节。</p>
      <div class="btn-row">
        <button class="primary-btn" data-act="day">⏭️ 航行一天</button>
        <button class="primary-btn" data-act="sail">${sailing ? '⏸️ 停止' : '⏩ 持续航行'}</button>
        <button class="ghost-btn" data-act="abort">⚓ 抛锚待命</button>
      </div>
    </div>${renderSupplyCard()}`;
  }
  if (state.atPort) {
    return `<div class="card"><h3>停泊于 ${PORT_BY_ID[state.atPort].name}</h3>
      <p class="muted">点击海图上的港口即可规划航线出航。</p></div>${renderSupplyCard()}`;
  }
  return `<div class="card"><h3>停在海上</h3>
    <p class="muted">点击海图上的港口设定新的目的地。</p>
    <div class="btn-row"><button class="primary-btn" data-act="day">⏭️ 等待一天</button></div>
    </div>${renderSupplyCard()}`;
}

function renderSupplyCard() {
  const crew = fleetCrew();
  const rate = Math.max(1, Math.round(crew / 20));
  const grain = grainOnBoard();
  const days = Math.floor(Math.min(grain, state.supplies.water) / rate);
  const cap = waterCapacity();
  return `<div class="card">
    <h3>补给</h3>
    <p>船员 ${crew} 人 · 每天消耗 ${rate} 粮 ${rate} 水 · 还够 <b>${days}</b> 天</p>
    <p class="small">🌾 粮食 <b${grain <= 0 ? ' class="bad"' : ''}>${grain}</b>
      <span class="muted">（在市场购买"粮食"货物，占货舱）</span></p>
    <div class="bar"><i style="width:${Math.min(100, state.supplies.water / cap * 100)}%"></i></div>
    <p class="small muted">💧 淡水 ${state.supplies.water}/${cap}（靠港自动补满，免费）</p>
    ${state.atPort ? '<div class="btn-row"><button class="ghost-btn" data-act="water">💧 补满淡水</button></div>' : ''}
  </div>`;
}

// ===== 任务日志 =====
function renderQuests() {
  const act = activeQuests(), done = doneQuests();
  const card = (q, isDoneQ) => `
    <div class="quest${isDoneQ ? ' qdone' : ''}">
      <div class="qhead"><span class="qkind ${q.kind}">${q.kind === 'main' ? '主线' : '支线'}</span>
        <b>${q.title}</b>${isDoneQ ? ' ✅' : ''}</div>
      <p class="small" style="margin-top:5px">${escapeHtml(q.desc)}</p>
      ${isDoneQ ? (q.doneText ? `<p class="qprog">「${escapeHtml(q.doneText)}」</p>` : '')
      : `<div class="qprog">${progressText(q)}</div>`}
    </div>`;
  return `<div class="card">
      <h3>📋 进行中（${act.length}）</h3>
      ${act.length ? act.map(q => card(q, false)).join('') : '<p class="muted small">暂无任务。去城镇里找人聊聊——头顶有 <b>!</b> 的人有活儿给你。</p>'}
    </div>
    ${done.length ? `<div class="card"><h3>✅ 已完成（${done.length}）</h3>${done.map(q => card(q, true)).join('')}</div>` : ''}`;
}

function renderPortPanel(p) {
  if (!p) return '';
  const n = NATIONS[p.nation];
  const prod = p.produces.map(g => GOOD_BY_ID[g].icon + GOOD_BY_ID[g].name).join('、') || '—';
  const want = p.wants.map(g => GOOD_BY_ID[g].icon + GOOD_BY_ID[g].name).join('、') || '—';
  const fac = {
    market: ['🛒 市场', 'market'], tavern: ['🍺 酒馆', 'tavern'],
    shipyard: ['🔨 造船厂', 'shipyard'], governor: ['🏛️ 总督府', 'governor'],
    church: ['⛪ 医馆', 'church'],
  };
  const btns = p.facilities.map(f => `<button class="fac-btn" data-panel="${fac[f][1]}">${fac[f][0]}</button>`).join('');
  const offers = offersAt(p.id).length;
  return `<div class="card">
      <h3>🏘️ 上岸走走</h3>
      <p class="muted small">在${p.name}的街区里散步：和人交谈、逛设施。${offers ? `<b class="good">这里有 ${offers} 个委托在等人接。</b>` : ''}</p>
      <div class="btn-row"><button class="primary-btn" data-act="town">🚶 进入城镇</button></div>
    </div>
    <div class="card port-head">
      <h3>${p.name} <span class="muted">${p.nameEn}</span></h3>
      <p class="tags"><span class="tag">${n.flag} ${n.name}</span>
        <span class="tag">规模 ${'★'.repeat(p.size)}</span>
        <span class="tag stance-${p.stance}">${stanceLabel(p.stance)}</span></p>
      <p class="blurb">${escapeHtml(p.blurb)}</p>
      <p class="small"><b>特产：</b>${prod}<br><b>需求：</b>${want}</p>
    </div>
    <div class="fac-grid">${btns}</div>
    <div class="card"><h3>出航</h3>
      <p class="muted small">在海图上点选目的港，或从下表直接起航。</p>
      <div class="dest-list">${nearbyPortList(p)}</div>
    </div>`;
}

function stanceLabel(s) {
  return { friendly: '对海盗友善', neutral: '中立', wary: '警惕', hostile: '敌视海盗' }[s] || s;
}

function nearbyPortList(from) {
  const list = PORTS.filter(p => p.id !== from.id)
    .map(p => ({ p, d: distanceNm({ lng: from.lng, lat: from.lat }, { lng: p.lng, lat: p.lat }) }))
    .sort((a, b) => a.d - b.d).slice(0, 8);
  return list.map(({ p, d }) => {
    const known = state.discovered.includes(p.id);
    return `<button class="dest-btn" data-sail="${p.id}">
      <span>${p.name} <span class="muted">${NATIONS[p.nation].flag}${known ? '' : ' · 未到访'}</span></span>
      <span class="muted">${fmt(d)} 浬</span></button>`;
  }).join('');
}

// ===== 市场 =====
function renderMarket(p) {
  if (!p) return '';
  const rows = marketList(p.id).map(m => {
    const own = fleetCargoTotal(m.good.id);
    return `<tr>
      <td>${m.good.icon} ${m.good.name}</td>
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
    <p class="small muted" style="margin-top:10px">🌾 <b>粮食就是船上的口粮</b>：每天按船员数消耗，断粮士气会暴跌。
      💧 淡水靠港免费补满，不占货舱。</p>
  </div>`;
}

// ===== 酒馆 =====
function renderTavern(p) {
  if (!p) return '';
  const avail = OFFICERS.filter(o => o.recruitAt === p.id && o.chapter <= state.chapter
    && !state.officers.includes(o.id));
  const hired = state.officers.map(id => OFFICER_BY_ID[id]).filter(Boolean);
  const rumor = rumorFor(p);
  const offers = offersAt(p.id);
  return `<div class="card">
      <h3>🍺 ${p.name} · 酒馆</h3>
      <p class="blurb">${rumor}</p>
    </div>
    ${offers.length ? `<div class="card"><h3>📌 委托板</h3>
      ${offers.map(q => `<div class="quest">
        <div class="qhead"><span class="qkind side">支线</span><b>${q.title}</b></div>
        <p class="small" style="margin-top:5px">${escapeHtml(q.desc)}</p>
        <p class="small muted">委托人：${q.giverName || '本地人'}　·　报酬 ${q.reward?.gold || 0} 金币</p>
        <button class="primary-btn" data-quest="${q.id}">接下委托</button>
      </div>`).join('')}</div>` : ''}
    <div class="card"><h3>招募船员</h3>
      <p class="muted small">当前船员 ${fleetCrew()} 人，士气 ${Math.round(state.crewMorale)}</p>
      <div class="btn-row">
        <button class="ghost-btn" data-crew="10">招募 10 人（200）</button>
        <button class="ghost-btn" data-crew="30">招募 30 人（600）</button>
        <button class="ghost-btn" data-act="rum">请全船喝一轮朗姆酒（士气 +12，300）</button>
      </div>
    </div>
    ${avail.length ? `<div class="card"><h3>可招募的伙伴</h3>${avail.map(o => `
      <div class="officer">
        <div><b>${o.name}</b> <span class="muted">${o.nameEn}</span></div>
        <p class="small">${escapeHtml(o.bio)}</p>
        <button class="primary-btn" data-hire="${o.id}">招募（${fmt(o.hireCost)} 金币）</button>
      </div>`).join('')}</div>` : ''}
    ${hired.length ? `<div class="card"><h3>我的伙伴</h3>${hired.map(o => `
      <div class="officer"><b>${o.name}</b><p class="small muted">${escapeHtml(o.bio)}</p></div>`).join('')}</div>` : ''}`;
}

function rumorFor(p) {
  const rumors = [
    `酒保压低嗓门：「西班牙珍宝船队下个月要在${PORT_BY_ID.HAVANA.name}集结。」`,
    `角落里的老水手说：「${PORT_BY_ID.NASSAU.name}如今没有王法，想发财的都往那儿去。」`,
    `一个断了手指的家伙嘟囔：「别去${PORT_BY_ID.BOSTON.name}，那儿的绞刑架从不空着。」`,
    `有人说，逆着信风走是傻子的干法——从非洲往西才是正道。`,
    `「听说过黑胡子吗？」邻桌的人问你，「据说他把点燃的引信编进胡子里。」`,
  ];
  return rumors[(p.id.charCodeAt(0) + state.date.m) % rumors.length];
}

// ===== 造船厂 =====
function renderShipyard(p) {
  if (!p) return '';
  const ships = state.fleet.map((s, i) => {
    const st = shipStat(s);
    const dmg = st.hullMax - s.hull;
    const cost = Math.round(dmg * 12);
    return `<div class="ship-row">
      <div><b>${s.name}</b> <span class="muted">${SHIP_BY_ID[s.typeId].name}</span></div>
      <div class="bar"><i style="width:${s.hull / st.hullMax * 100}%"></i></div>
      <p class="small muted">耐久 ${Math.round(s.hull)}/${st.hullMax} · 炮 ${st.guns} · 装甲 ${st.armor} · 航速 ${st.speed.toFixed(1)} · 舱 ${cargoUsed(s)}/${st.cargoMax} · 船员 ${s.crew}/${s.crewMax}</p>
      ${dmg > 0 ? `<button class="mini" data-repair="${i}">修理（${cost} 金币）</button>` : '<span class="small good">状态良好</span>'}
      <div class="up-row">${UPGRADES.map(u => `
        <button class="mini" data-up="${u.id}" data-ship="${i}" ${(s.upgrades[u.id] || 0) >= u.max ? 'disabled' : ''}>
          ${u.icon}${u.name} ${s.upgrades[u.id] || 0}/${u.max}（${fmt(u.price)}）</button>`).join('')}</div>
    </div>`;
  }).join('');
  const buy = SHIPS.filter(s => !s.story && s.price > 0).map(s => `
    <div class="ship-row">
      <div><b>${s.name}</b> <span class="muted">${s.nameEn}</span></div>
      <p class="small muted">耐久 ${s.hull} · 炮 ${s.guns} · 装甲 ${s.armor} · 航速 ${s.speed} · 舱 ${s.cargo} · 船员上限 ${s.crewMax}</p>
      <p class="small">${escapeHtml(s.note)}</p>
      <button class="primary-btn" data-buyship="${s.id}" ${state.player.gold < s.price || state.fleet.length >= 4 ? 'disabled' : ''}>购买（${fmt(s.price)}）</button>
    </div>`).join('');
  return `<div class="card"><h3>🔨 ${p.name} · 造船厂</h3>
      <p class="muted small">舰队上限 4 艘，当前 ${state.fleet.length} 艘。金币 ${fmt(state.player.gold)}</p>${ships}</div>
    <div class="card"><h3>购置新船</h3>${buy}</div>`;
}

// ===== 总督府 =====
function renderGovernor(p) {
  if (!p) return '';
  const hostile = p.stance === 'hostile' && state.player.infamy > 30;
  // 第五章：巴斯镇的赦免状（三线分歧点）
  const pardonHere = p.id === 'BATH' && state.chapter >= 5
    && !state.flags.pardonAccepted && !state.flags.refusedPardon;
  return `<div class="card">
    <h3>🏛️ ${p.name} · 总督府</h3>
    ${hostile
      ? `<p class="blurb">卫兵拦住了你。「总督不见海盗。」——你的恶名（${state.player.infamy}）在这里太响亮了。</p>`
      : `<p class="blurb">总督的书记官抬了抬眼镜：「有何贵干？」</p>
         <div class="btn-row">
           ${pardonHere ? '<button class="primary-btn" data-act="pardon">📜 面见伊登总督（赦免状）</button>' : ''}
           <button class="ghost-btn" data-act="letter">申请私掠许可状（500 金币，声望 +5）</button>
           <button class="ghost-btn" data-act="bounty">查看悬赏布告</button>
         </div>`}
  </div>`;
}

// ===== 医馆 =====
function renderChurch(p) {
  if (!p) return '';
  const hurt = state.player.hpMax - state.player.hp;
  const healCost = Math.max(0, Math.round(hurt * 8));
  return `<div class="card">
      <h3>⛪ ${p.name} · 医馆</h3>
      <p class="blurb">修士放下手里的研钵：「伤口要洗干净，酒不能代替药——虽然你们没人听。」</p>
      <p class="small">你的体力 ${state.player.hp}/${state.player.hpMax}　·　船员士气 ${Math.round(state.crewMorale)}</p>
      <div class="btn-row">
        <button class="primary-btn" data-act="heal" ${hurt <= 0 ? 'disabled' : ''}>
          🩹 治疗伤势${hurt > 0 ? `（${healCost} 金币）` : '（无伤）'}</button>
        <button class="ghost-btn" data-act="tend">💊 医治病号（400 金币，士气 +15）</button>
      </div>
    </div>`;
}

// ===== 舰队 / 日志 =====
function renderFleet() {
  const p = state.player;
  const sk = p.skills;
  return `<div class="card">
      <h3>船长 · ${p.name}</h3>
      <p class="small">体力 ${p.hp}/${p.hpMax} · 经验 ${p.exp}</p>
      <p class="small">⚓ 航海 ${sk.sailing} ｜ ⚔️ 战斗 ${sk.combat} ｜ 🎖️ 统率 ${sk.leadership} ｜ 💬 交涉 ${sk.negotiation}</p>
      <p class="small muted">声望 ${p.fame} ／ 恶名 ${p.infamy} —— 两者决定各港对你的态度与最终的归宿。</p>
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

function renderLog() {
  return `<div class="card"><h3>📜 航海日志</h3>
    ${state.log.length ? state.log.map(l =>
    `<p class="logline"><span class="muted">${l.date.y}.${l.date.m}.${l.date.d}</span> ${escapeHtml(l.text)}</p>`).join('')
      : '<p class="muted">还没有记录。</p>'}</div>`;
}

// ===== 事件绑定 =====
function attachPanel() {
  $$('[data-panel]').forEach(b => b.addEventListener('click', () => { panel = b.dataset.panel; render(); }));
  $$('[data-sail]').forEach(b => b.addEventListener('click', () => doSail(b.dataset.sail)));
  $$('[data-buy]').forEach(b => b.addEventListener('click', () => {
    const r = buy(state.atPort, b.dataset.buy, +b.dataset.q); toast(r.msg); saveGame(); afterQuestTick();
  }));
  $$('[data-sell]').forEach(b => b.addEventListener('click', () => {
    const r = sell(state.atPort, b.dataset.sell, +b.dataset.q); toast(r.msg); saveGame(); afterQuestTick();
  }));
  $$('[data-crew]').forEach(b => b.addEventListener('click', () => hireCrew(+b.dataset.crew)));
  $$('[data-hire]').forEach(b => b.addEventListener('click', () => hireOfficer(b.dataset.hire)));
  $$('[data-quest]').forEach(b => b.addEventListener('click', () => {
    const q = QUEST_BY_ID[b.dataset.quest];
    if (accept(b.dataset.quest)) { toast(`接下委托：${q.title}`); saveGame(); afterQuestTick(); }
  }));
  $$('[data-repair]').forEach(b => b.addEventListener('click', () => repairShip(+b.dataset.repair)));
  $$('[data-up]').forEach(b => b.addEventListener('click', () => upgradeShip(+b.dataset.ship, b.dataset.up)));
  $$('[data-buyship]').forEach(b => b.addEventListener('click', () => buyShip(b.dataset.buyship)));
  $$('[data-flag]').forEach(b => b.addEventListener('click', () => { state.flagship = +b.dataset.flag; saveGame(); render(); }));
  $$('[data-act]').forEach(b => b.addEventListener('click', () => doAct(b.dataset.act)));
}

function doAct(a) {
  if (a === 'town') enterTown();
  else if (a === 'water') { refillWater(); toast('淡水已补满。'); saveGame(); render(); }
  else if (a === 'pardon') offerPardon();
  else if (a === 'final') finalChoices();
  else if (a === 'day') stepDay();
  else if (a === 'sail') toggleSail();
  else if (a === 'abort') { abortVoyage(); sailing = false; render(); }
  else if (a === 'menu') showMenu();
  else if (a === 'rum') {
    if (state.player.gold < 300) return toast('金币不足。');
    state.player.gold -= 300; state.crewMorale = Math.min(100, state.crewMorale + 12);
    toast('全船欢呼！士气提升。'); saveGame(); render();
  } else if (a === 'letter') {
    if (state.player.gold < 500) return toast('金币不足。');
    state.player.gold -= 500; state.player.fame += 5; state.flags.privateer = true;
    addLog('取得私掠许可状——从此劫掠敌国船只是"合法"的。');
    toast('获得私掠许可状。'); saveGame(); render();
  } else if (a === 'heal') {
    const hurt = state.player.hpMax - state.player.hp;
    const cost = Math.round(hurt * 8);
    if (hurt <= 0) return toast('你没有伤。');
    if (state.player.gold < cost) return toast('金币不足。');
    state.player.gold -= cost; state.player.hp = state.player.hpMax;
    toast('伤口包扎好了。'); saveGame(); render();
  } else if (a === 'tend') {
    if (state.player.gold < 400) return toast('金币不足。');
    state.player.gold -= 400; state.crewMorale = Math.min(100, state.crewMorale + 15);
    toast('病号们缓过来了，士气回升。'); saveGame(); render();
  } else if (a === 'bounty') {
    openModal({
      title: '悬赏布告',
      body: `<p>各殖民地总督对海盗的悬赏：</p><ul>
        <li>查尔斯·瓦恩 —— 100 英镑</li>
        <li>"棉布杰克"拉克姆 —— 80 英镑</li>
        <li><b>爱德华·蒂奇（黑胡子）—— ${Math.max(20, state.player.infamy * 3)} 英镑</b></li></ul>
        <p class="muted small">你的名字排在上面，说明这份事业干得不错——也说明有人正在磨刀。</p>`,
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
  toast(`招募 ${take} 名船员。`); saveGame(); render();
}

function hireOfficer(id) {
  const o = OFFICER_BY_ID[id];
  if (state.player.gold < o.hireCost) return toast('金币不足。');
  state.player.gold -= o.hireCost;
  state.officers.push(id);
  if (o.bonus) {
    for (const k in o.bonus) {
      if (k === 'morale') state.crewMorale = Math.min(100, state.crewMorale + o.bonus[k]);
      else if (state.player.skills[k] !== undefined) state.player.skills[k] += o.bonus[k];
    }
  }
  addLog(`${o.name} 加入了你的船。`);
  toast(`${o.name} 加入！`); saveGame(); render();
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

// ===== 城镇与对话 =====
function enterTown() {
  if (!state.atPort) return toast('得先靠港。');
  openTown(state.atPort, {
    onFacility: (facId) => { closeTown(); panel = facId; render(); },
    onNpc: (n) => talkTo(n),
  });
}

function talkTo(n) {
  if (n.kind === 'flavor') {
    openModal({
      title: n.name,
      body: `<div class="dlg-text">${n.line}</div>`,
      actions: [{ label: '走开', primary: true, onClick: closeModal }],
    });
    return;
  }
  showDialogNode(n, 'start');
}

function showDialogNode(n, key) {
  const node = n.dialog[key];
  if (!node) { closeModal(); return; }
  const actions = (node.choices || []).map(c => ({
    label: c.label,
    onClick: () => {
      if (c.next) showDialogNode(n, c.next);
      else if (c.act) runDialogAct(n, c.act);
      else closeModal();
    },
  }));
  if (!actions.length) actions.push({
    label: '（继续）', primary: true, onClick: () => runDialogAct(n, node.act),
  });
  openModal({
    title: n.name, wide: true,
    body: `<div class="dlg-npc">${n.name}</div><div class="dlg-text">${node.text}</div>`,
    actions,
  });
}

function runDialogAct(n, act) {
  closeModal();
  onTalk(n.id);
  if (act) {
    if (act.type === 'quest') {
      const q = QUEST_BY_ID[act.id];
      if (q && !isActive(act.id) && !isDone(act.id)) {
        accept(act.id);
        openModal({
          title: '接受任务',
          body: `<div class="dlg-quest"><b>${q.kind === 'main' ? '【主线】' : '【支线】'}${q.title}</b>
            <p style="margin-top:6px">${escapeHtml(q.desc)}</p></div>`,
          actions: [{ label: '好', primary: true, onClick: () => { closeModal(); afterQuestTick(); } }],
        });
        saveGame();
        return;
      }
    } else if (act.type === 'panel') { panel = act.panel; }
    else if (act.type === 'flag') { state.flags[act.flag] = true; }
  }
  afterQuestTick();
  saveGame();
  if (document.getElementById('town').classList.contains('hidden')) render();
  else refreshTown();
}

// 每次可能改变任务进度后调用：结算完成的任务并弹窗。返回本次完成的任务数（0 表示无中断）
function afterQuestTick() {
  const finished = checkAll();
  const n = finished.length;
  if (!n) { render(); return 0; }
  const showNext = () => {
    const f = finished.shift();
    if (!f) { render(); return; }
    openModal({
      title: `✅ 完成${f.quest.kind === 'main' ? '主线' : '支线'}任务`,
      wide: true,
      body: `<div class="story"><b>${f.quest.title}</b>
        <p style="margin-top:8px">${escapeHtml(f.quest.doneText || '')}</p>
        <p class="goal">🎁 奖励：${f.rewards.join('、') || '—'}</p></div>`,
      actions: [{ label: '继续', primary: true, onClick: () => { closeModal(); showNext(); } }],
    });
  };
  showNext();
  return n;
}

// ===== 航行 =====
function onPortClick(p) {
  if (state.atPort === p.id) { panel = 'port'; render(); return; }
  const known = state.discovered.includes(p.id);
  const path = planRoute(state.position, { lng: p.lng, lat: p.lat });
  const d = path ? routeDistanceNm(path) : null;
  const days = d ? Math.max(1, Math.round(d / (fleetSpeed() * 24))) : '?';
  openModal({
    title: known ? p.name : '未探明的港口',
    body: known
      ? `<p>${escapeHtml(p.blurb)}</p>
         <p class="small"><b>${NATIONS[p.nation].flag} ${NATIONS[p.nation].name}</b> · ${stanceLabel(p.stance)}</p>
         <p>航程约 <b>${d ? fmt(d) : '—'}</b> 海里，预计 <b>${days}</b> 天。</p>`
      : `<p>海图上只有一个模糊的标记。要去看看吗？</p><p>航程约 <b>${d ? fmt(d) : '—'}</b> 海里。</p>`,
    actions: [
      { label: '起航', primary: true, onClick: () => { closeModal(); doSail(p.id); } },
      { label: '再看看', onClick: closeModal },
    ],
  });
}

function doSail(portId) {
  if (state.atPort === portId) { panel = 'port'; render(); return; }
  const r = startVoyage(portId);
  if (!r.ok) return toast(r.msg);
  panel = 'map';
  zoomTo(state.position.lng, state.position.lat, 2.0);
  saveGame(); render();
}

function toggleSail() {
  sailing = !sailing;
  render();
  if (sailing) loopSail();
}
function loopSail() {
  clearTimeout(sailTimer);
  if (!sailing || !state.voyage) { sailing = false; render(); return; }
  const stop = stepDay();
  if (stop) { sailing = false; render(); return; }
  sailTimer = setTimeout(loopSail, 420);
}

// 返回 true 表示需要中断连续航行
function stepDay() {
  const prevMonth = state.date.m;
  const res = advanceDay();
  if (state.date.m !== prevMonth) monthlyMarketDrift();

  let interrupt = false;
  for (const e of res.events) {
    if (e.type === 'mutiny') { interrupt = true; showMutiny(); }
    else toast(e.msg);
  }
  if (res.arrived) {
    interrupt = true;
    panel = 'port';
    zoomTo(state.position.lng, state.position.lat, 2.6);
  }
  if (res.encounter) { interrupt = true; showEncounter(res.encounter); }

  const chap = onDayAdvanced();
  if (chap) interrupt = true;

  // 抵港/推进可能完成任务（afterQuestTick 内部会结算并负责重绘）
  if (afterQuestTick()) interrupt = true;

  saveGame();
  return interrupt;
}

// ===== 遭遇 =====
function showEncounter(enc) {
  pingAt(state.position.lng, state.position.lat);
  if (enc.kind === 'storm') {
    const dmg = 8 + Math.round(Math.random() * 18);
    for (const s of state.fleet) s.hull = Math.max(10, s.hull - dmg);
    state.crewMorale -= 5;
    addLog('遭遇风暴，船体受损。');
    return openModal({
      title: '🌊 风暴',
      body: `<p>乌云压到桅顶，浪头一个接一个砸上甲板。你下令收帆，船在浪谷里挣扎了整整一夜。</p>
             <p class="bad">全舰队耐久 −${dmg}，士气 −5。</p>`,
      actions: [{ label: '挺过去了', primary: true, onClick: () => { closeModal(); saveGame(); render(); } }],
    });
  }
  if (enc.kind === 'derelict') {
    const gold = 120 + Math.round(Math.random() * 400);
    return openModal({
      title: '🛶 漂流船',
      body: `<p>一艘没有旗帜的船在浪里打转，甲板上空无一人。</p>`,
      actions: [
        { label: `登船搜查（可能有 ${gold} 金币）`, primary: true, onClick: () => {
          closeModal();
          if (Math.random() < 0.25) {
            state.crewMorale -= 8;
            addLog('漂流船上有疫病，船员染疾。');
            toast('船上有疫病！士气 −8');
          } else {
            state.player.gold += gold;
            addLog(`从漂流船上搜得 ${gold} 金币。`);
            toast(`搜得 ${gold} 金币。`);
          }
          saveGame(); render();
        } },
        { label: '绕开它', onClick: () => { closeModal(); render(); } },
      ],
    });
  }
  if (enc.kind === 'island') {
    return openModal({
      title: '🏝️ 无名小岛',
      body: `<p>海图上没有标注的小岛。淡水看起来还算干净。</p>`,
      actions: [
        { label: '补充淡水（+25）', primary: true, onClick: () => {
          closeModal(); state.supplies.water = Math.min(400, state.supplies.water + 25);
          toast('补充了淡水。'); saveGame(); render();
        } },
        { label: '继续航行', onClick: () => { closeModal(); render(); } },
      ],
    });
  }
  // 商船 / 巡逻舰 → 海战
  const isPatrol = enc.kind === 'patrol';
  openModal({
    title: isPatrol ? '⚔️ 巡逻舰' : '💰 商船',
    body: isPatrol
      ? `<p>桅顶传来喊声：「军舰！挂着战旗，正朝我们来！」</p>`
      : `<p>了望手大喊：「右舷有船！吃水很深——满载的！」</p>`,
    actions: [
      { label: isPatrol ? '迎战' : '追击并接舷', primary: true, onClick: () => { closeModal(); enterBattle(enc); } },
      { label: '扯满帆逃走', onClick: () => {
        closeModal();
        const esc = Math.random() < 0.55 + state.player.skills.sailing * 0.05;
        if (esc) { toast('甩掉了对方。'); addLog('避开了一场遭遇。'); }
        else { const d = 15; for (const s of state.fleet) s.hull = Math.max(5, s.hull - d); toast('被追上并挨了一轮炮击！'); }
        saveGame(); render();
      } },
    ],
  });
}

function enterBattle(enc) {
  startBattle(enc, (result) => {
    // result: {win, loot, sunk, captured}
    if (result.win) {
      onBattleWin(enc.kind);
      state.player.gold += result.loot || 0;
      state.player.exp += 10;
      if (enc.kind === 'merchant') state.player.infamy += 3;
      if (enc.kind === 'patrol') { state.player.infamy += 5; state.player.fame -= 2; }
      state.flags.wins = (state.flags.wins || 0) + 1;
      addLog(`海战获胜，缴获 ${result.loot || 0} 金币。`);
      setTimeout(afterQuestTick, 60);
      // 第三章：夺取法国大船 → 安妮女王复仇号
      if (state.chapter >= 3 && !state.flags.hasQAR) {
        grantQAR();
        openModal({
          title: '安妮女王复仇号',
          wide: true,
          body: `<div class="story"><p>这艘法国船有三百吨重，货舱能塞下四十门炮。弟兄们问要不要卖掉换钱。</p>
            <p>你说：<b>不卖。</b></p>
            <p>三周后，它挂上了新的名字——<b>安妮女王复仇号</b>。从今往后，看到这面旗的商船会直接投降。</p>
            <p class="hist">📖 史料：真实的 La Concorde 于 1717 年 11 月 28 日被夺，改装后配 40 门炮。</p></div>`,
          actions: [{ label: '升起黑旗', primary: true, onClick: () => { closeModal(); render(); } }],
        });
      }
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
    body: `<p>船员围在主桅下，为首的那个把弯刀插在甲板上：「船长，我们要吃饭。」</p>`,
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
        if (win) { state.crewMorale += 22; state.player.infamy += 4; toast('你震住了他们。'); addLog('以铁腕压下了一场哗变。'); }
        else {
          const lost = Math.round(fleetCrew() * 0.3);
          let left = lost;
          for (const s of state.fleet) { const t = Math.min(s.crew, left); s.crew -= t; left -= t; }
          state.crewMorale = 40;
          toast(`一场混战，损失 ${lost} 名船员。`);
        }
        saveGame(); render();
      } },
    ],
  });
}

// ===== 菜单 / 存档 =====
function showMenu() {
  openModal({
    title: '菜单',
    body: `<p class="muted small">版本 v${APP_VERSION}</p>`,
    actions: [
      { label: '💾 保存到槽位', primary: true, onClick: () => { closeModal(); showSlots('save'); } },
      { label: '📂 读取存档', onClick: () => { closeModal(); showSlots('load'); } },
      { label: '🏠 返回主菜单', onClick: () => { closeModal(); sailing = false; showStart(); } },
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
      <button class="mini danger" data-slot="${i}" data-op="del">删除</button>
    </span></div>`;
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

// 供 story.js 调用
export function refresh() { render(); }
export { panel };
