// 航行（仿《大航海时代2》）：设定下一个航点后按日推进，沿途揭开迷雾、
// 生成并移动附近的 NPC 船只、消耗补给、按月发薪。不再"点城市自动到达"。
import { state, addLog, fleetSpeed, fleetCrew } from './state.js';
import {
  distanceNm, bearing, destPoint, windAt, windFactor, isSea, LAT_MIN, LAT_MAX,
} from './geo.js';
import { seaAt } from './data/coast.js';
import { PORTS, PORT_BY_ID } from './data/ports.js';
import { SHIP_BY_ID } from './data/ships.js';
import { GOOD_BY_ID } from './data/goods.js';
import { reveal } from './fog.js';
import { checkDiscoveries } from './discoveries.js';
import { OFFICER_BY_ID } from './data/officers.js';

// 帆船不可能整日跑满船速。0.55 是照史实标定的：
// 布里斯托尔→托尔图加 3734 海里，慢船约 51 天、快船约 27 天，中位 ~38 天。
export const DAY_FACTOR = 0.55;
export const SIGHT_NM = 150;          // 桅顶视距（迷雾揭开半径）
// 入港判定距离：海岸线为 110m 精度，港口坐标常落在轮廓内侧，
// 锚地（最近可通航点）离港中心可能有二三十海里，半径要覆盖得住。
export const ENTER_PORT_NM = 45;
export const MEET_NM = 12;            // 与他船相遇的距离

const BLOCKED = { type: 'blocked', msg: '前方是陆地，绕不过去——船停下来另寻航路。' };
let noProgress = 0;                   // 连续贴岸横move的小时数（不入存档，读档后归零）

// ===== 航点 =====
export function setWaypoint(lng, lat) {
  if (!isSea(lng, lat)) return { ok: false, msg: '那里是陆地。' };
  noProgress = 0;
  state.waypoint = { lng, lat };
  state.heading = bearing(state.position, state.waypoint);
  state.atPort = null;
  return { ok: true };
}
export function clearWaypoint() { state.waypoint = null; }

// 找离给定点最近的可通航水域。港口在粗精度海岸线上常常"落在陆上"，
// 出港/入港都要靠它把船放到真正的海面上。
export function nearestSeaPoint(from, maxNm = 260) {
  if (isSea(from.lng, from.lat)) return { ...from };
  for (let nm = 5; nm <= maxNm; nm += 5) {
    for (let b = 0; b < 360; b += 10) {
      const t = destPoint(from, b, nm);
      if (isSea(t.lng, t.lat)) return t;
    }
  }
  return null;
}

export function leavePort() {
  const p = state.atPort ? PORT_BY_ID[state.atPort] : null;
  state.atPort = null;
  state.waypoint = null;
  if (p) addLog(`离开${p.name}，驶向外海。`);
  const sea = nearestSeaPoint(state.position);
  if (sea) {
    state.heading = bearing(state.position, sea) || state.heading || 270;
    state.position = sea;
  }
  ensureNpcShips();
  reveal(state.position.lng, state.position.lat, SIGHT_NM);
}

// 视野内可入港的港口
export function portInReach() {
  let best = null, bd = ENTER_PORT_NM;
  for (const p of PORTS) {
    const d = distanceNm(state.position, p);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function enterPort(portId) {
  const p = PORT_BY_ID[portId];
  if (!p) return { ok: false, msg: '没有这个港口。' };
  if (distanceNm(state.position, p) > ENTER_PORT_NM) return { ok: false, msg: '离港口还太远。' };
  state.position = { lng: p.lng, lat: p.lat };
  state.atPort = p.id;
  state.waypoint = null;
  state.npcShips = [];
  refillWater();
  const isNew = !state.discovered.includes(p.id);
  if (isNew) state.discovered.push(p.id);
  reveal(p.lng, p.lat, SIGHT_NM);
  addLog(`进入${p.name}港。`);
  return { ok: true, isNew, port: p };
}

// ===== NPC 船只（近海视野里能看见的其他船）=====
export function ensureNpcShips() {
  if (!state.npcShips) state.npcShips = [];
  const sea = seaAt(state.position.lng, state.position.lat);
  const here = PORT_BY_ID[state.atPort];
  const want = 2 + Math.round((sea.danger || 1) * 0.8);
  // 海域的 patrol 强度直接决定这片水里军舰的比例：佛罗里达海峡与北美东岸最凶，
  // 南大西洋几乎见不到官船。海盗窝附近官船也不敢来。
  let patrolShare = 0.12 + (sea.patrol || 1) * 0.11;
  if (state.player.infamy > 40) patrolShare += 0.18;      // 恶名在身，缉私船盯上你
  if (here?.pirateHaven) patrolShare = 0.02;              // 拿骚、托尔图加这种地方
  let guard = 0;
  while (state.npcShips.length < want && guard++ < 40) {
    const brg = Math.random() * 360;
    const nm = 60 + Math.random() * 160;
    const p = destPoint(state.position, brg, nm);
    if (!isSea(p.lng, p.lat)) continue;
    const patrol = Math.random() < patrolShare;
    state.npcShips.push({
      id: 'n' + Math.random().toString(36).slice(2, 8),
      kind: patrol ? 'patrol' : 'merchant',
      lng: p.lng, lat: p.lat,
      heading: Math.random() * 360,
      speed: patrol ? 8 : 6,
      strength: patrol ? 1 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 2),
    });
  }
}

function moveNpcShips(days = 1) {
  const out = [];
  for (const s of state.npcShips || []) {
    // 巡逻舰在你恶名高时会主动靠过来
    if (s.kind === 'patrol' && state.player.infamy > 40) {
      s.heading = bearing(s, state.position);
    } else if (Math.random() < 0.35) {
      s.heading = (s.heading + (Math.random() * 80 - 40) + 360) % 360;
    }
    let nxt = destPoint(s, s.heading, s.speed * 24 * DAY_FACTOR * days);
    if (!isSea(nxt.lng, nxt.lat)) {
      s.heading = (s.heading + 120) % 360;
      nxt = destPoint(s, s.heading, s.speed * 12 * days);
    }
    if (isSea(nxt.lng, nxt.lat)) { s.lng = nxt.lng; s.lat = nxt.lat; }
    // 跑太远的移出视野，之后再补新的
    if (distanceNm(state.position, s) < 420) out.push(s);
  }
  state.npcShips = out;
  ensureNpcShips();
}

// 距离最近的他船（用于遭遇；返回的距离决定海战初始间隔）
export function nearestShip() {
  let best = null, bd = Infinity;
  for (const s of state.npcShips || []) {
    const d = distanceNm(state.position, s);
    if (d < bd) { bd = d; best = s; }
  }
  return best ? { ship: best, nm: bd } : null;
}

// ===== 按小时推进（航行时时间实时流逝）=====
// 位移、迷雾、NPC、遭遇按小时连续结算；补给/士气/月薪这类重结算只在跨 0 点时跑一次。
export function advanceHours(hours) {
  const res = { events: [], nm: 0, hours, dayRolled: 0 };
  if (state.gameOver) return res;

  const wind = windAt(state.position.lng, state.position.lat, state.date.m);
  res.wind = wind;

  // --- 位移 ---
  if (state.waypoint) {
    const course = bearing(state.position, state.waypoint);
    state.heading = course;
    let run = fleetSpeed() * hours * DAY_FACTOR * windFactor(course, wind);
    const left = distanceNm(state.position, state.waypoint);
    if (run >= left) {
      state.position = { ...state.waypoint };
      state.waypoint = null;
      res.reachedWaypoint = true;
      res.nm = left;
    } else {
      // 沿途绕开陆地。按小时推进后步长很小，若只取「第一个是海的偏转」，
      // 船会贴着海岸来回蹭而永远到不了——所以要在所有可行偏转里挑真正靠近航点的那个。
      let best = null;
      for (const off of [0, 15, -15, 30, -30, 45, -45, 60, -60, 75, -75, 90, -90]) {
        const cand = destPoint(state.position, course + off, run);
        if (!isSea(cand.lng, cand.lat)) continue;
        const nd = distanceNm(cand, state.waypoint);
        if (!best || nd < best.nd) best = { cand, nd, off };
        if (off === 0) break;                       // 直行可走就直行
      }
      if (best && best.nd < left) {
        state.position = best.cand;
        state.heading = (course + best.off + 360) % 360;
        res.nm = run;
        noProgress = 0;
      } else if (best) {
        // 只能横着挪：允许一阵子，指望绕过海角；久了就判定此路不通
        state.position = best.cand;
        state.heading = (course + best.off + 360) % 360;
        res.nm = run;
        noProgress += hours;
        if (noProgress > 18) { res.events.push(BLOCKED); state.waypoint = null; noProgress = 0; }
      } else {
        res.events.push(BLOCKED);
        state.waypoint = null;
        noProgress = 0;
      }
    }
    state.position.lat = Math.max(LAT_MIN + 1, Math.min(LAT_MAX - 1, state.position.lat));
  }

  // --- 时钟 ---
  const d = state.date;
  d.h = (d.h ?? 8) + hours;
  while (d.h >= 24) { d.h -= 24; res.dayRolled++; }
  for (let i = 0; i < res.dayRolled; i++) dayTick(res);

  // --- 视野 / 发现物 / 他船 / 遭遇 ---
  reveal(state.position.lng, state.position.lat, SIGHT_NM);
  const found = checkDiscoveries();
  if (found.length) res.discovered = found;
  moveNpcShips(hours / 24);
  const near = nearestShip();
  if (near && near.nm <= MEET_NM) res.encounter = { ...near.ship, nm: near.nm };

  // --- 天气（按小时折算）---
  const sea = seaAt(state.position.lng, state.position.lat);
  if (state.waypoint && Math.random() < (0.035 + (sea.danger || 1) * 0.012) * (hours / 24)) {
    res.weather = 'storm';
  }
  return res;
}

// 在港/进设施时也要走时间：原版是每次退出设施推进 0.5–1.5 小时
export function passTimeAshore() {
  const h = [0.5, 1.0, 1.5][(Math.random() * 3) | 0];
  const res = { events: [], dayRolled: 0 };
  const d = state.date;
  d.h = (d.h ?? 8) + h;
  while (d.h >= 24) { d.h -= 24; res.dayRolled++; }
  for (let i = 0; i < res.dayRolled; i++) dayTick(res);
  return res;
}

// 兼容旧调用：整日推进
export function advanceDay() { return advanceHours(24); }

// ===== 日结算（只在跨 0 点时跑）=====
function dayTick(res) {
  const crew = fleetCrew();
  const prevMonth = state.date.m;
  tickDate();

  // 补给：粮食来自货舱，淡水靠港补满
  const rate = Math.max(1, Math.ceil(crew / 10));
  state.supplies.water = Math.max(0, state.supplies.water - rate);
  const ate = eatGrain(rate);
  if (ate < rate || state.supplies.water <= 0) {
    state.crewMorale -= 6;
    res.events.push({
      type: 'starve',
      msg: ate < rate ? '粮食吃光了，船员开始啃缆绳上的皮革。' : '淡水见底，喉咙里像塞了沙子。',
    });
  } else if (state.crewMorale < 100) {
    state.crewMorale = Math.min(100, state.crewMorale + 0.5);
  }
  state.crewMorale = Math.max(0, Math.min(100, state.crewMorale));

  // 月初：先计息，再发薪，最后看还不还得起
  if (state.date.m !== prevMonth) {
    const i = accrueInterest();
    if (i) res.events.push(i);
    const w = payWages();
    if (w) res.events.push(w);
    res.newMonth = true;
  }
  const b = checkBankruptcy();
  if (b) res.events.push(b);

  if (state.crewMorale <= 12 && Math.random() < 0.25) {
    res.events.push({ type: 'mutiny', msg: '士气崩溃——甲板下传来磨刀的声音。' });
  }
  return res;
}

// ===== 工资 =====
export function monthlyWage() {
  const crew = fleetCrew();
  const officers = (state.officers || []).length;
  return crew * 3 + officers * 60;         // 每名水手 3 金/月，伙伴 60 金/月
}
function payWages() {
  const due = monthlyWage();
  if (due <= 0) return null;
  if (state.player.gold >= due) {
    state.player.gold -= due;
    addLog(`月初发薪：支付 ${due} 金币（船员 ${fleetCrew()} 人）。`);
    state.crewMorale = Math.min(100, state.crewMorale + 2);
    return { type: 'wage', msg: `发放月薪 ${due} 金币。` };
  }
  // 发不出工资：士气暴跌 + 逃亡
  state.crewMorale -= 22;
  let flee = Math.max(1, Math.round(fleetCrew() * 0.12));
  const lost = flee;
  for (const s of state.fleet) {
    const t = Math.min(s.crew - 1, flee);
    if (t > 0) { s.crew -= t; flee -= t; }
    if (flee <= 0) break;
  }
  addLog(`发不出月薪，${lost} 名船员趁夜溜了。`);
  return { type: 'wageFail', msg: `付不出 ${due} 金币的月薪！士气暴跌，${lost} 人逃亡。` };
}

// ===== 银行 =====
export const DEPOSIT_RATE = 0.03;     // 存款月利 3%
export const LOAN_RATE = 0.10;        // 借款月利 10%
export const DEPOSIT_CAP = 1000000;   // 存款上限 100 万

function accrueInterest() {
  const b = state.bank;
  if (!b) return null;
  const bits = [];
  if (b.deposit > 0) {
    const gain = Math.floor(b.deposit * DEPOSIT_RATE);
    b.deposit = Math.min(DEPOSIT_CAP, b.deposit + gain);
    if (gain) bits.push(`存款生息 +${gain}`);
  }
  if (b.loan > 0) {
    const owe = Math.ceil(b.loan * LOAN_RATE);
    b.loan += owe;
    bits.push(`借款利息 +${owe}（现欠 ${b.loan}）`);
  }
  if (!bits.length) return null;
  addLog('银行月结：' + bits.join('，') + '。');
  return { type: 'interest', msg: '银行月结：' + bits.join('，') + '。' };
}

// 破产不结束游戏——按原版的路数，先赔钱，再赔人，最后赔船，旗舰给你留着。
export function checkBankruptcy() {
  if (state.player.gold >= 0) return null;
  const steps = [];

  // 1) 先动存款
  if (state.bank.deposit > 0) {
    const take = Math.min(state.bank.deposit, -state.player.gold);
    state.bank.deposit -= take;
    state.player.gold += take;
    steps.push(`从存款里划走 ${take} 金币抵账`);
  }
  // 2) 贱卖船上的货（六折甩给码头上的二道贩子）
  if (state.player.gold < 0) {
    let got = 0;
    for (const s of state.fleet) {
      for (const id in (s.cargo || {})) {
        if (id === 'grain') continue;                 // 粮食留着，不然直接饿死
        got += Math.round((GOOD_BY_ID[id]?.basePrice || 50) * s.cargo[id] * 0.6);
        delete s.cargo[id];
      }
    }
    if (got) { state.player.gold += got; steps.push(`货舱被搬空，贱卖抵了 ${got} 金币`); }
  }
  // 3) 伙伴离队——发不出钱，忠诚最低的先走。这不换钱，是纯损失。
  while (state.player.gold < 0 && state.officers.length) {
    const worst = [...state.officers].sort(
      (a, b) => (OFFICER_BY_ID[a]?.loyalty ?? 50) - (OFFICER_BY_ID[b]?.loyalty ?? 50))[0];
    state.officers = state.officers.filter(o => o !== worst);
    steps.push(`${OFFICER_BY_ID[worst]?.name || '一位伙伴'}收拾东西下了船`);
    if (state.officers.length === 0) break;
  }
  // 4) 水手成批逃亡——同样不换钱
  if (state.player.gold < 0) {
    let lost = 0;
    for (const s of state.fleet) {
      const go = Math.floor(s.crew * 0.35);
      if (go > 0 && s.crew - go >= 1) { s.crew -= go; lost += go; }
    }
    if (lost) {
      state.crewMorale = Math.max(0, state.crewMorale - 15);
      steps.push(`${lost} 名水手连夜跑光`);
    }
  }
  // 5) 债主扣船抵债——旗舰不动
  while (state.player.gold < 0 && state.fleet.length > 1) {
    let idx = -1, worst = Infinity;
    state.fleet.forEach((s, i) => {
      if (i === state.flagship) return;
      const v = SHIP_BY_ID[s.typeId]?.price || 2000;
      if (v < worst) { worst = v; idx = i; }
    });
    if (idx < 0) break;
    const gone = state.fleet.splice(idx, 1)[0];
    if (state.flagship > idx) state.flagship--;
    state.player.gold += Math.round((SHIP_BY_ID[gone.typeId]?.price || 2000) * 0.5);
    steps.push(`${gone.name} 被债主拖走抵债`);
  }
  // 还不够就赖着——账面归零，但债照记在心里
  if (state.player.gold < 0) {
    steps.push('剩下的账，债主说他会记着');
    state.player.gold = 0;
  }
  if (!steps.length) return null;
  const msg = '付不出账了：' + steps.join('；') + '。';
  addLog(msg);
  return { type: 'bankrupt', msg };
}

// ===== 补给 =====
export function waterCapacity() { return Math.max(60, fleetCrew() * 3); }
export function refillWater() { state.supplies.water = waterCapacity(); }
function eatGrain(need) {
  let left = need;
  for (const s of state.fleet) {
    const have = s.cargo.grain || 0;
    if (!have) continue;
    const take = Math.min(have, left);
    s.cargo.grain = have - take;
    if (!s.cargo.grain) delete s.cargo.grain;
    left -= take;
    if (left <= 0) break;
  }
  return need - left;
}
export function grainOnBoard() {
  return state.fleet.reduce((a, s) => a + (s.cargo.grain || 0), 0);
}

// ===== 日期与时钟 =====
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function tickDate() {
  const d = state.date;
  d.d++;
  if (d.d > DAYS_IN_MONTH[d.m - 1]) { d.d = 1; d.m++; }
  if (d.m > 12) { d.m = 1; d.y++; }
}
export function dateStr() {
  const d = state.date;
  return `${d.y} 年 ${d.m} 月 ${d.d} 日`;
}
// 半小时精度的时钟，仿原版常驻显示
export function timeStr() {
  const h = state.date.h ?? 0;
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
export function dateTimeStr() { return `${dateStr()} ${timeStr()}`; }
