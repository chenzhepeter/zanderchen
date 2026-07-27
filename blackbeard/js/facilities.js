// 港口设施注册表。
// 以前加一个设施要同时改 town.js 的 FAC、ui.js 的 FAC_TITLE 和 renderTownPanel 的 map、
// 再去 attachPanel 里绑事件——四处同改。现在一处登记，三处都读这张表。
//
// 老四家（市场/酒馆/造船厂/总督府/医馆）的渲染函数仍住在 ui.js 里，
// 由 ui.js 在初始化时 registerRender 注册进来；本轮新增的四家直接写在这里。
import { state, addLog, addFame, playerAtk, playerDef, fleetCrew } from './state.js';
import { PORTS, PORT_BY_ID, NATIONS } from './data/ports.js';
import { EQUIPMENT, EQUIP_BY_ID, WEAPONS, ARMORS, stockFor } from './data/equipment.js';
import { generateJobs } from './data/guildjobs.js';
import { KIND_NAME } from './data/discoveries.js';
import {
  unreported, collectorAt, report, reportAll, foundCount, reportedCount, totalCount,
} from './discoveries.js';
import { DEPOSIT_RATE, LOAN_RATE, DEPOSIT_CAP } from './voyage.js';
import { distanceNm } from './geo.js';

// UI 依赖延迟注入，避免与 ui.js 形成模块循环（与 story.js 同一套路）
let UI = null;
export function bindUI(ui) { UI = ui; }

export const FACILITIES = {
  market: { icon: '🛒', name: '市场', color: '#b0894a' },
  tavern: { icon: '🍺', name: '酒馆', color: '#9c6b3f' },
  shipyard: { icon: '🔨', name: '造船厂', color: '#7a6a52' },
  shop: { icon: '⚔️', name: '道具屋', color: '#8a6a4a', render: renderShop },
  bank: { icon: '🏦', name: '银行', color: '#6a7a8a', render: renderBank },
  guild: { icon: '📜', name: '公会', color: '#a08a5e', render: renderGuild },
  mansion: { icon: '🏛️', name: '邸宅', color: '#9a8a7e', render: renderMansion },
  governor: { icon: '🏛️', name: '总督府', color: '#9a8a5e' },
  church: { icon: '⛪', name: '医馆', color: '#8a8a94' },
};

export function registerRender(id, fn) { if (FACILITIES[id]) FACILITIES[id].render = fn; }
export function facTitle(id) {
  const f = FACILITIES[id];
  return f ? `${f.icon} ${f.name}` : '';
}
export function renderFacility(id, port) {
  const f = FACILITIES[id];
  return f && f.render ? f.render(port) : '';
}

const fmt = n => (n || 0).toLocaleString('en-US');
const card = (title, body) => `<div class="card"><h3>${title}</h3>${body}</div>`;

// ===================== 银行 =====================
function renderBank(p) {
  const b = state.bank;
  const g = state.player.gold;
  const maxLoan = Math.max(0, 20000 - b.loan);
  return `
    ${card('🏦 ' + p.name + '银行', `
      <p class="small muted">存款月利 ${(DEPOSIT_RATE * 100).toFixed(0)}%（上限 ${fmt(DEPOSIT_CAP)}），借款月利 ${(LOAN_RATE * 100).toFixed(0)}%。
        利息在每月一日结算——借得越久，滚得越凶。</p>
      <p class="big-row"><span>随身金币</span><b>🪙 ${fmt(g)}</b></p>
      <p class="big-row"><span>存款</span><b class="good">${fmt(b.deposit)}</b></p>
      <p class="big-row"><span>欠款</span><b class="${b.loan ? 'bad' : ''}">${fmt(b.loan)}</b></p>`)}
    ${card('存取', `
      <div class="btn-row">
        ${[1000, 5000, 20000].map(n => `<button class="s-btn" data-fac="bank:deposit:${n}" ${g < n ? 'disabled' : ''}>存 ${fmt(n)}</button>`).join('')}
        <button class="s-btn" data-fac="bank:deposit:all" ${g <= 0 ? 'disabled' : ''}>全部存入</button>
      </div>
      <div class="btn-row">
        ${[1000, 5000, 20000].map(n => `<button class="s-btn" data-fac="bank:withdraw:${n}" ${b.deposit < n ? 'disabled' : ''}>取 ${fmt(n)}</button>`).join('')}
        <button class="s-btn" data-fac="bank:withdraw:all" ${b.deposit <= 0 ? 'disabled' : ''}>全部取出</button>
      </div>`)}
    ${card('借还', `
      <p class="small muted">借款上限 20,000。还不上不会让你输掉游戏——但银行会先动你的存款，再动你的人和船。</p>
      <div class="btn-row">
        ${[1000, 5000].map(n => `<button class="s-btn" data-fac="bank:borrow:${n}" ${maxLoan < n ? 'disabled' : ''}>借 ${fmt(n)}</button>`).join('')}
      </div>
      <div class="btn-row">
        ${[1000, 5000].map(n => `<button class="s-btn" data-fac="bank:repay:${n}" ${b.loan <= 0 || g < Math.min(n, b.loan) ? 'disabled' : ''}>还 ${fmt(n)}</button>`).join('')}
        <button class="s-btn" data-fac="bank:repay:all" ${b.loan <= 0 || g < b.loan ? 'disabled' : ''}>全部还清（${fmt(b.loan)}）</button>
      </div>`)}`;
}

function bankAct(op, arg) {
  const b = state.bank, P = state.player;
  const amt = arg === 'all'
    ? (op === 'deposit' ? P.gold : op === 'withdraw' ? b.deposit : b.loan)
    : +arg;
  if (!amt || amt <= 0) return UI.toast('数目不对。');
  if (op === 'deposit') {
    const room = DEPOSIT_CAP - b.deposit;
    const put = Math.min(amt, P.gold, room);
    if (put <= 0) return UI.toast(room <= 0 ? '存款已到上限。' : '金币不够。');
    P.gold -= put; b.deposit += put;
    UI.toast(`存入 ${fmt(put)} 金币。`);
  } else if (op === 'withdraw') {
    const take = Math.min(amt, b.deposit);
    if (take <= 0) return UI.toast('没有存款。');
    b.deposit -= take; P.gold += take;
    UI.toast(`取出 ${fmt(take)} 金币。`);
  } else if (op === 'borrow') {
    const room = 20000 - b.loan;
    const get = Math.min(amt, room);
    if (get <= 0) return UI.toast('已经借到上限了。');
    b.loan += get; P.gold += get;
    addLog(`向${PORT_BY_ID[state.atPort]?.name || ''}银行借了 ${fmt(get)} 金币。`);
    UI.toast(`借到 ${fmt(get)} 金币——记得利息是月息一分。`);
  } else if (op === 'repay') {
    const pay = Math.min(amt, b.loan, P.gold);
    if (pay <= 0) return UI.toast('还不上，或者本来就没欠。');
    b.loan -= pay; P.gold -= pay;
    UI.toast(b.loan ? `还了 ${fmt(pay)}，还欠 ${fmt(b.loan)}。` : '债还清了。');
  }
  UI.after();
}

// ===================== 道具屋 =====================
function renderShop(p) {
  const stock = stockFor(p);
  const eq = state.player.equipment;
  const w = EQUIP_BY_ID[eq.weapon], a = EQUIP_BY_ID[eq.armor];
  const row = (e) => {
    const owned = state.inventory.includes(e.id) || eq.weapon === e.id || eq.armor === e.id;
    return `<div class="shop-row">
      <div class="sr-main"><b>${e.name}</b> <span class="small muted">${e.nameEn}</span>
        <div class="small muted">${e.note}</div></div>
      <div class="sr-stat">${e.atk ? `🗡️ ${e.atk}` : e.def !== undefined ? `🛡️ ${e.def}` : '✨ 道具'}</div>
      <div class="sr-buy">
        <span class="small">🪙 ${fmt(e.price)}</span>
        <button class="s-btn" data-fac="shop:buy:${e.id}" ${state.player.gold < e.price || owned ? 'disabled' : ''}>${owned ? '已有' : '买'}</button>
      </div></div>`;
  };
  const mine = [...state.inventory].map(id => EQUIP_BY_ID[id]).filter(Boolean);
  return `
    ${card('⚔️ 现在的装备', `
      <p class="big-row"><span>武器</span><b>${w ? w.name : '赤手空拳'}${w ? ` <span class="small muted">🗡️ ${w.atk}</span>` : ''}</b></p>
      <p class="big-row"><span>铠甲</span><b>${a ? a.name : '布衣'}${a ? ` <span class="small muted">🛡️ ${a.def}</span>` : ''}</b></p>
      <p class="small muted">综合攻击 <b>${playerAtk()}</b> ／ 防御 <b>${playerDef()}</b>——决斗伤害与接舷战力都吃这两个数。</p>`)}
    ${card('出售的货色', `
      <p class="small muted">${p.size >= 5 ? '这么大的港口，什么都摆得出来。' : p.size >= 3 ? '中等规模的铺子，好东西得去大港找。' : '小地方，只有些糊口的家伙什。'}</p>
      ${stock.map(row).join('') || '<p class="small muted">今天没货。</p>'}`)}
    ${mine.length ? card('背包（卖价六折）', mine.map(e => `<div class="shop-row">
      <div class="sr-main"><b>${e.name}</b><div class="small muted">${e.note}</div></div>
      <div class="sr-stat">${e.atk ? `🗡️ ${e.atk}` : e.def !== undefined ? `🛡️ ${e.def}` : '✨'}</div>
      <div class="sr-buy">
        ${e.kind === 'weapon' || e.kind === 'armor'
        ? `<button class="s-btn" data-fac="shop:equip:${e.id}">装备</button>` : ''}
        <button class="s-btn" data-fac="shop:sell:${e.id}">卖 ${fmt(Math.round(e.price * 0.6))}</button>
      </div></div>`).join('')) : ''}`;
}

function shopAct(op, id) {
  const e = EQUIP_BY_ID[id];
  if (!e) return;
  const P = state.player;
  if (op === 'buy') {
    if (P.gold < e.price) return UI.toast('金币不足。');
    P.gold -= e.price;
    // 武器铠甲买了直接换上，换下来的进背包
    if (e.kind === 'weapon' || e.kind === 'armor') {
      const slot = e.kind === 'weapon' ? 'weapon' : 'armor';
      const old = P.equipment[slot];
      if (old) state.inventory.push(old);
      P.equipment[slot] = e.id;
      UI.toast(`买下${e.name}并换上了。`);
    } else {
      state.inventory.push(e.id);
      UI.toast(`买下${e.name}。`);
    }
    addLog(`在道具屋买了${e.name}。`);
  } else if (op === 'sell') {
    const i = state.inventory.indexOf(id);
    if (i < 0) return UI.toast('背包里没有。');
    state.inventory.splice(i, 1);
    P.gold += Math.round(e.price * 0.6);
    UI.toast(`卖掉${e.name}，得 ${fmt(Math.round(e.price * 0.6))} 金币。`);
  } else if (op === 'equip') {
    const slot = e.kind === 'weapon' ? 'weapon' : e.kind === 'armor' ? 'armor' : null;
    if (!slot) return UI.toast('这东西没法装备。');
    const i = state.inventory.indexOf(id);
    if (i < 0) return UI.toast('背包里没有。');
    state.inventory.splice(i, 1);
    const old = P.equipment[slot];
    if (old) state.inventory.push(old);
    P.equipment[slot] = id;
    UI.toast(`换上了${e.name}。`);
  }
  UI.after();
}

// ===================== 公会 =====================
// 委托每 15 天换一批；接过的从列表里去掉
function guildJobs(portId) {
  const ps = state.portState[portId];
  if (!ps) return [];
  const stamp = `${state.date.y}-${state.date.m}-${state.date.d < 16 ? 'a' : 'b'}`;
  if (!ps.jobs || ps.jobStamp !== stamp) {
    ps.jobs = generateJobs(portId, 4);
    ps.jobStamp = stamp;
  }
  const taken = new Set((state.quests?.active || []).map(a => a.id));
  const done = new Set(state.quests?.done || []);
  return ps.jobs.filter(j => !taken.has(j.id) && !done.has(j.id));
}

function meetsFameReq(req) {
  if (!req) return true;
  const f = state.player.fame;
  for (const k in req) if ((f[k] || 0) < req[k]) return false;
  return true;
}
const FAME_LABEL = { adventure: '冒险', trade: '交易', battle: '战斗' };

function renderGuild(p) {
  const jobs = guildJobs(p.id);
  const unknown = PORTS.filter(q => !state.discovered.includes(q.id) && !q.anchorageOnly);
  return `
    ${card('📜 ' + p.name + '商会', `
      <p class="small muted">公会的老人翻着名册：「活儿有的是，看你够不够格。」</p>
      <p class="small">你的名声：🧭 冒险 ${state.player.fame.adventure} ／ ⚖️ 交易 ${state.player.fame.trade} ／ ⚔️ 战斗 ${state.player.fame.battle}</p>`)}
    ${card('可接委托', jobs.length ? jobs.map(j => {
      const ok = meetsFameReq(j.fameReq);
      const req = Object.entries(j.fameReq || {}).map(([k, v]) => `${FAME_LABEL[k]} ${v}`).join('・');
      return `<div class="job-row ${ok ? '' : 'locked'}">
        <div class="jr-main"><b>${j.title}</b>
          <div class="small">${j.desc}</div>
          <div class="small muted">报酬 🪙 ${fmt(j.reward.gold)} · 期限 ${j.deadlineMonths} 个月 · 门槛 ${req || '无'}
            ${j.failPenalty ? ' · 逾期扣名声' : ''}</div></div>
        <button class="s-btn" data-fac="guild:take:${j.id}" ${ok ? '' : 'disabled'}>${ok ? '接下' : '名声不够'}</button>
      </div>`;
    }).join('') : '<p class="small muted">名册上暂时是空的，过些天再来。</p>')}
    ${card('情报', `
      <div class="btn-row">
        <button class="s-btn" data-fac="guild:intel:0" ${state.player.gold < 100 ? 'disabled' : ''}>🌍 国情报（100 金）</button>
        <button class="s-btn" data-fac="guild:locate:0" ${state.player.gold < 1200 || !unknown.length ? 'disabled' : ''}>
          🗺️ 港口位置（1,200 金）${unknown.length ? '' : ' · 都探明了'}</button>
      </div>
      <p class="small muted">买港口位置会在海图上点亮一处你还没去过的港——迷雾里凭空多出一个坐标。</p>`)}`;
}

function guildAct(op, arg, p) {
  if (op === 'take') {
    const j = guildJobs(state.atPort).find(x => x.id === arg);
    if (!j) return UI.toast('这条委托已经没了。');
    if (!meetsFameReq(j.fameReq)) return UI.toast('名声不够，老人摇了摇头。');
    UI.acceptJob(j);
    return;
  }
  if (op === 'intel') {
    if (state.player.gold < 100) return UI.toast('金币不足。');
    state.player.gold -= 100;
    const n = NATIONS[p.nation];
    const rivals = PORTS.filter(q => q.nation !== p.nation && state.discovered.includes(q.id)).length;
    UI.openModal({
      title: '🌍 国情报',
      body: `<p>「${n?.name || p.nation}如今的行情么……」老人压低了声音。</p>
        <ul class="small">
          <li>本港态度：<b>${p.stance === 'hostile' ? '敌视——进出都要小心' : p.stance === 'wary' ? '戒备——盘查得紧' : '友善'}</b></li>
          <li>本港规模 ${p.size}／5，主要出产：${(p.produces || []).join('、') || '无'}</li>
          <li>你在此地的通缉度：${state.player.infamy}${state.player.infamy > 50 ? '——他们已经在念你的名字了' : ''}</li>
          <li>你已探明 ${state.discovered.length} 处港口，其中 ${rivals} 处属于别国。</li>
        </ul>`,
      actions: [{ label: '知道了', primary: true, onClick: () => { UI.closeModal(); UI.after(); } }],
    });
    return;
  }
  if (op === 'locate') {
    if (state.player.gold < 1200) return UI.toast('金币不足。');
    const unknown = PORTS.filter(q => !state.discovered.includes(q.id) && !q.anchorageOnly);
    if (!unknown.length) return UI.toast('海图上已经没有空白的港了。');
    // 优先给最近的，钱花得有用
    unknown.sort((a, b) => distanceNm(state.position, a) - distanceNm(state.position, b));
    const target = unknown[0];
    state.player.gold -= 1200;
    state.discovered.push(target.id);
    addLog(`从公会买到了${target.name}的位置。`);
    UI.openModal({
      title: '🗺️ 港口位置',
      body: `<p>老人从抽屉里抽出一张纸条，上面只有几个数字。</p>
        <p><b>${target.name}</b>（${NATIONS[target.nation]?.name || target.nation}）——
          经 ${target.lng.toFixed(1)}°、纬 ${target.lat.toFixed(1)}°，
          离你现在的位置约 <b>${Math.round(distanceNm(state.position, target))}</b> 海里。</p>
        <p class="small muted">它已经画在你的海图上了。</p>`,
      actions: [{ label: '收好', primary: true, onClick: () => { UI.closeModal(); UI.after(); } }],
    });
  }
}

// ===================== 邸宅（收藏家 + 图鉴）=====================
function renderMansion(p) {
  const c = collectorAt(p.id);
  const pending = unreported();
  const total = pending.reduce((a, d) => a + Math.round(d.reward * (c?.bonus || 1)), 0);
  return `
    ${card('🏛️ ' + p.name + '邸宅', c
      ? `<p><b>${c.name}</b></p><p class="small">${c.blurb}</p>
         <p class="small muted">他按行情出价：本处收购价为标准的 ${(c.bonus * 100).toFixed(0)}%。</p>`
      : '<p class="small muted">屋子里只有仆人在擦银器。收藏家在里斯本、阿姆斯特丹和伦敦——那三处才收发现物。</p>')}
    ${card('航海日志', `
      <p class="big-row"><span>已发现</span><b>${foundCount()} / ${totalCount()}</b></p>
      <p class="big-row"><span>已上缴</span><b>${reportedCount()}</b></p>
      ${c && pending.length ? `<div class="btn-row"><button class="s-btn primary" data-fac="mansion:all:0">全部上缴（${pending.length} 条 · 约 🪙 ${fmt(total)}）</button></div>` : ''}`)}
    ${pending.length ? card('待上缴', pending.map(d => `<div class="shop-row">
      <div class="sr-main"><b>${d.name}</b> <span class="small muted">${KIND_NAME[d.kind]}</span>
        <div class="small muted">${d.blurb}</div></div>
      <div class="sr-stat small">🧭 +${d.fame}</div>
      <div class="sr-buy"><span class="small">🪙 ${fmt(Math.round(d.reward * (c?.bonus || 1)))}</span>
        ${c ? `<button class="s-btn" data-fac="mansion:one:${d.id}">上缴</button>` : ''}</div>
    </div>`).join('')) : card('待上缴', '<p class="small muted">没有新的见闻可以呈报。出海去吧。</p>')}`;
}

function mansionAct(op, arg) {
  if (op === 'one') {
    const r = report(arg, state.atPort);
    UI.toast(r.msg);
  } else if (op === 'all') {
    const r = reportAll(state.atPort);
    if (!r.n) return UI.toast('没有可上缴的记录。');
    UI.toast(`上缴 ${r.n} 条，得 ${fmt(r.gold)} 金币，冒险名声 +${r.fame}。`);
  }
  UI.after();
}

// ===================== 统一动作入口 =====================
// 面板里所有按钮都写成 data-fac="设施:操作:参数"，ui.js 一处转发过来。
export function doFacilityAction(spec) {
  const [fac, op, ...rest] = spec.split(':');
  const arg = rest.join(':');
  const p = state.atPort ? PORT_BY_ID[state.atPort] : null;
  if (!p) return;
  if (fac === 'bank') return bankAct(op, arg);
  if (fac === 'shop') return shopAct(op, arg);
  if (fac === 'guild') return guildAct(op, arg, p);
  if (fac === 'mansion') return mansionAct(op, arg);
}
