// 航行：海域网格 A* 寻路（不穿越陆地）、按日推进、补给消耗、遭遇判定
import { state, addLog, fleetSpeed, fleetCrew } from './state.js';
import { isSea, distanceNm, bearing, windAt, windFactor, LNG_MIN, LNG_MAX, LAT_MIN, LAT_MAX } from './geo.js';
import { seaAt } from './data/coast.js';
import { PORT_BY_ID } from './data/ports.js';

// ===== 海域网格（1° 分辨率）=====
const STEP = 1;
const COLS = Math.round((LNG_MAX - LNG_MIN) / STEP) + 1;
const ROWS = Math.round((LAT_MAX - LAT_MIN) / STEP) + 1;
let SEA = null;

function buildGrid() {
  SEA = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      SEA[r * COLS + c] = isSea(LNG_MIN + c * STEP, LAT_MIN + r * STEP) ? 1 : 0;
    }
  }
}
const cellOf = (lng, lat) => ({
  c: Math.round((lng - LNG_MIN) / STEP),
  r: Math.round((lat - LAT_MIN) / STEP),
});
const llOf = (c, r) => ({ lng: LNG_MIN + c * STEP, lat: LAT_MIN + r * STEP });
const inGrid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
const isSeaCell = (c, r) => inGrid(c, r) && SEA[r * COLS + c] === 1;

// 港口在岸上：取最近的可通航格作为出入口
function nearestSeaCell(lng, lat, maxR = 6) {
  if (!SEA) buildGrid();
  const { c, r } = cellOf(lng, lat);
  if (isSeaCell(c, r)) return { c, r };
  for (let rad = 1; rad <= maxR; rad++) {
    for (let dc = -rad; dc <= rad; dc++) {
      for (let dr = -rad; dr <= rad; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
        if (isSeaCell(c + dc, r + dr)) return { c: c + dc, r: r + dr };
      }
    }
  }
  return null;
}

// ===== A* =====
export function planRoute(from, to) {
  if (!SEA) buildGrid();
  const s = nearestSeaCell(from.lng, from.lat);
  const g = nearestSeaCell(to.lng, to.lat);
  if (!s || !g) return null;

  const key = (c, r) => r * COLS + c;
  const open = new Map();       // key -> {c,r,g,f}
  const came = new Map();
  const gScore = new Map();
  const h = (c, r) => distanceNm(llOf(c, r), llOf(g.c, g.r));

  const startK = key(s.c, s.r);
  gScore.set(startK, 0);
  open.set(startK, { c: s.c, r: s.r, f: h(s.c, s.r) });

  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let guard = 0;
  while (open.size && guard++ < 60000) {
    let bestK = null, best = null;
    for (const [k, v] of open) if (!best || v.f < best.f) { best = v; bestK = k; }
    open.delete(bestK);
    if (best.c === g.c && best.r === g.r) {
      // 回溯
      const cells = [];
      let k = bestK;
      while (k !== undefined) { const c = k % COLS, r = (k - c) / COLS; cells.unshift({ c, r }); k = came.get(k); }
      return simplify([from, ...cells.map(x => llOf(x.c, x.r)), to]);
    }
    for (const [dc, dr] of NB) {
      const nc = best.c + dc, nr = best.r + dr;
      if (!isSeaCell(nc, nr)) continue;
      // 禁止斜穿陆角
      if (dc && dr && (!isSeaCell(best.c + dc, best.r) || !isSeaCell(best.c, best.r + dr))) continue;
      const step = distanceNm(llOf(best.c, best.r), llOf(nc, nr));
      const ng = (gScore.get(key(best.c, best.r)) ?? Infinity) + step;
      const nk = key(nc, nr);
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        came.set(nk, key(best.c, best.r));
        open.set(nk, { c: nc, r: nr, f: ng + h(nc, nr) });
      }
    }
  }
  return null;
}

// 去掉共线冗余点，让航线画出来更像手绘航路
function simplify(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    const b1 = bearing(a, b), b2 = bearing(b, c);
    if (Math.abs(((b1 - b2 + 540) % 360) - 180) < 172) out.push(b);   // 方位有明显变化才保留
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function routeDistanceNm(path) {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += distanceNm(path[i - 1], path[i]);
  return d;
}

// ===== 出航 =====
export function startVoyage(destPortId) {
  const dest = PORT_BY_ID[destPortId];
  if (!dest) return { ok: false, msg: '没有这个港口。' };
  const path = planRoute(state.position, { lng: dest.lng, lat: dest.lat });
  if (!path) return { ok: false, msg: '找不到通往那里的航路。' };
  state.voyage = { path, idx: 0, destId: destPortId, days: 0, legDone: 0 };
  state.atPort = null;
  addLog(`起锚，目标：${dest.name}。航程约 ${routeDistanceNm(path)} 海里。`);
  return { ok: true, path };
}

export function abortVoyage() {
  state.voyage = null;
  addLog('改变主意，下令抛锚待命。');
}

// ===== 按日推进 =====
// 返回 { arrived?, portId?, encounter?, msg }
export function advanceDay() {
  const v = state.voyage;
  const crew = fleetCrew();
  const res = { events: [] };

  // 时钟
  tickDate();
  if (v) v.days++;

  // 补给消耗（每 20 名船员每天各耗 1 单位）
  //  · 淡水：到港自动补满（免费），海上逐日消耗
  //  · 粮食：就是货舱里的「粮食」货物，需在市场购买
  // 只在海上消耗：靠港期间船员在岸上吃住，不啃船上的存粮
  const rate = Math.max(1, Math.round(crew / 20));
  if (!state.atPort) {
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
  } else if (state.crewMorale < 100) {
    state.crewMorale = Math.min(100, state.crewMorale + 1.5);   // 靠港休整，士气回升更快
  }
  state.crewMorale = Math.max(0, Math.min(100, state.crewMorale));

  // 哗变判定
  if (state.crewMorale <= 12 && Math.random() < 0.25) {
    res.events.push({ type: 'mutiny', msg: '士气崩溃——甲板下传来磨刀的声音。' });
  }

  if (!v) return res;

  // 航行位移。DAY_FACTOR：帆船不可能整日跑满船速（换舷、夜航减帆、洋流），
  // 取 0.72 让横渡大西洋约 20-25 天，既贴近史实又不至于让玩家点太多次。
  const DAY_FACTOR = 0.72;
  const wind = windAt(state.position.lng, state.position.lat, state.date.m);
  let remain = fleetSpeed() * 24 * DAY_FACTOR * windFactor(courseNow(), wind);   // 海里/天
  res.wind = wind;
  res.nm = Math.round(remain);

  while (remain > 0 && v.idx < v.path.length - 1) {
    const cur = state.position, next = v.path[v.idx + 1];
    const seg = distanceNm(cur, next);
    const left = seg - v.legDone;
    if (remain >= left) {
      remain -= left;
      state.position = { ...next };
      v.idx++; v.legDone = 0;
    } else {
      // 沿当前航段按已走比例线性插值
      v.legDone += remain;
      const t = v.legDone / seg;
      const p0 = v.path[v.idx];
      state.position = {
        lng: p0.lng + (next.lng - p0.lng) * t,
        lat: p0.lat + (next.lat - p0.lat) * t,
      };
      remain = 0;
    }
  }

  // 抵达
  if (v.idx >= v.path.length - 1) {
    const p = PORT_BY_ID[v.destId];
    state.position = { lng: p.lng, lat: p.lat };
    state.atPort = p.id;
    state.voyage = null;
    refillWater();
    res.events.push({ type: 'water', msg: '靠港补足了淡水。' });
    if (!state.discovered.includes(p.id)) {
      state.discovered.push(p.id);
      res.events.push({ type: 'discover', msg: `发现新港口：${p.name}！` });
    }
    addLog(`抵达 ${p.name}。`);
    res.arrived = p.id;
    return res;
  }

  // 遭遇判定
  const sea = seaAt(state.position.lng, state.position.lat);
  const p = 0.06 + sea.danger * 0.035;
  if (Math.random() < p) res.encounter = rollEncounter(sea);
  return res;
}

// 淡水按船员规模自动补满（靠港免费）
export function waterCapacity() {
  return Math.max(60, fleetCrew() * 3);
}
export function refillWater() {
  state.supplies.water = waterCapacity();
}

// 从货舱吃掉粮食，返回实际吃到的数量
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

function courseNow() {
  const v = state.voyage;
  if (!v || v.idx >= v.path.length - 1) return 0;
  return bearing(state.position, v.path[v.idx + 1]);
}

function rollEncounter(sea) {
  const r = Math.random();
  const infamous = state.player.infamy > 40;
  if (r < 0.12) return { kind: 'storm', sea: sea.id, name: '风暴' };
  if (r < 0.24) return { kind: 'derelict', sea: sea.id, name: '漂流船' };
  if (r < 0.34) return { kind: 'island', sea: sea.id, name: '无名小岛' };
  if (r < 0.5 + (infamous ? 0.15 : 0)) {
    return { kind: 'patrol', sea: sea.id, name: '巡逻舰', strength: sea.patrol };
  }
  return { kind: 'merchant', sea: sea.id, name: '商船', strength: Math.max(1, sea.danger - 1) };
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
