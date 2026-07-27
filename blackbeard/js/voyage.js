// 航行（仿《大航海时代2》）：设定下一个航点后按日推进，沿途揭开迷雾、
// 生成并移动附近的 NPC 船只、消耗补给、按月发薪。不再"点城市自动到达"。
import { state, addLog, fleetSpeed, fleetCrew } from './state.js';
import {
  distanceNm, bearing, destPoint, windAt, windFactor, isSea, LAT_MIN, LAT_MAX,
} from './geo.js';
import { seaAt } from './data/coast.js';
import { PORTS, PORT_BY_ID } from './data/ports.js';
import { reveal } from './fog.js';

export const DAY_FACTOR = 0.72;       // 帆船不可能整日跑满船速
export const SIGHT_NM = 150;          // 桅顶视距（迷雾揭开半径）
// 入港判定距离：海岸线为 110m 精度，港口坐标常落在轮廓内侧，
// 锚地（最近可通航点）离港中心可能有二三十海里，半径要覆盖得住。
export const ENTER_PORT_NM = 45;
export const MEET_NM = 12;            // 与他船相遇的距离

// ===== 航点 =====
export function setWaypoint(lng, lat) {
  if (!isSea(lng, lat)) return { ok: false, msg: '那里是陆地。' };
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
  const want = 2 + Math.round((sea.danger || 1) * 0.8);
  let guard = 0;
  while (state.npcShips.length < want && guard++ < 40) {
    const brg = Math.random() * 360;
    const nm = 60 + Math.random() * 160;
    const p = destPoint(state.position, brg, nm);
    if (!isSea(p.lng, p.lat)) continue;
    const patrol = Math.random() < 0.25 + (state.player.infamy > 40 ? 0.2 : 0);
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

// ===== 按日推进 =====
export function advanceDay() {
  const crew = fleetCrew();
  const res = { events: [] };
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

  // 月初发薪
  if (state.date.m !== prevMonth) {
    const w = payWages();
    if (w) res.events.push(w);
    res.newMonth = true;
  }

  if (state.crewMorale <= 12 && Math.random() < 0.25) {
    res.events.push({ type: 'mutiny', msg: '士气崩溃——甲板下传来磨刀的声音。' });
  }

  // 位移：朝航点前进
  const wind = windAt(state.position.lng, state.position.lat, state.date.m);
  res.wind = wind;
  if (state.waypoint) {
    const course = bearing(state.position, state.waypoint);
    state.heading = course;
    let run = fleetSpeed() * 24 * DAY_FACTOR * windFactor(course, wind);
    res.nm = Math.round(run);
    const left = distanceNm(state.position, state.waypoint);
    if (run >= left) {
      state.position = { ...state.waypoint };
      state.waypoint = null;
      res.reachedWaypoint = true;
    } else {
      // 沿途绕开陆地：撞岸就试着偏转
      let moved = false;
      for (const off of [0, 20, -20, 40, -40, 60, -60, 90, -90]) {
        const cand = destPoint(state.position, course + off, run);
        if (isSea(cand.lng, cand.lat)) { state.position = cand; moved = true; break; }
      }
      if (!moved) { res.events.push({ type: 'blocked', msg: '前方是陆地，船只得停下来另寻航路。' }); state.waypoint = null; }
    }
    state.position.lat = Math.max(LAT_MIN + 1, Math.min(LAT_MAX - 1, state.position.lat));
  } else {
    res.nm = 0;
  }

  reveal(state.position.lng, state.position.lat, SIGHT_NM);
  moveNpcShips(1);

  // 相遇：有船贴到 MEET_NM 之内
  const near = nearestShip();
  if (near && near.nm <= MEET_NM) res.encounter = { ...near.ship, nm: near.nm };

  // 天气
  const sea = seaAt(state.position.lng, state.position.lat);
  if (state.waypoint && Math.random() < 0.035 + (sea.danger || 1) * 0.012) {
    res.weather = 'storm';
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
