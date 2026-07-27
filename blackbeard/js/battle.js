// 海战盘（照《大航海时代2》原版规格重做）
//
//   · 六角格盘面（轴向坐标 q,r；尖顶六边形，6 邻接）
//   · 船首向：帆船不能横move——只能朝船首及左右各一向前进，转向要花机动力
//   · 抢占上风：处在敌船上风侧 +1 机动 / +10% 命中，下风侧反之
//   · 分段射程：近(1) / 中(2–3) / 远(4–5)，命中与伤害逐段递减，各段有最优弹种
//   · 左右舷分别装填：打完一舷要等一回合才能再打那一舷；首尾方向只有威力很小的追击炮
//   · 監視：开战后可花一次指令看清敌方编成——在此之前敌舰数值是「？」
//
// 保留上一版比原版更好的两点：战场取自真实海域（含陆地），镜头随双方拉开自动延伸。
import { state, shipStat, addLog, makeShip, playerAtk, playerDef, addFame } from './state.js';
import { SHIP_BY_ID } from './data/ships.js';
import { OFFICER_BY_ID } from './data/officers.js';
import { windAt, isSea } from './geo.js';
import { startDuel } from './duel.js';

const TILE_DEG = 0.05;        // 每格约 3 海里
const NM_PER_TILE = 3;
const DISENGAGE = 8;          // 与最近敌舰超过此距离即可脱离接触
const MAX_RANGE = 5;
const PAD = 2.2;              // 镜头留白（格）

const AMMO = {
  round: { name: '实心弹', icon: '⚫', hull: 1.0, crew: 0.15, sail: 0, best: 'mid', desc: '破坏船体，中距离最准' },
  chain: { name: '链弹', icon: '⛓️', hull: 0.35, crew: 0.1, sail: 1.6, best: 'far', desc: '毁帆降速，远距离也能咬住对手' },
  grape: { name: '霰弹', icon: '🔴', hull: 0.2, crew: 1.0, sail: 0, best: 'near', desc: '杀伤船员，贴身时最狠，利于接舷' },
};

// 六向（尖顶六边形，轴向坐标）：按罗盘方位排序，正北在两向之间
//   0 东北 30° | 1 东 90° | 2 东南 150° | 3 西南 210° | 4 西 270° | 5 西北 330°
const DIRS = [[1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]];
const DIR_NAME = ['东北', '东', '东南', '西南', '西', '西北'];
const dirAngle = d => 30 + d * 60;

let B = null, onEndCb = null, canvas = null, ctx = null, mode = 'idle', raf = 0;

// ===== 六角格几何 =====
const SQ3 = Math.sqrt(3);
function hexDist(a, b) {
  const dq = a.q - b.q, dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}
// 轴向 → 平面（以格半径 1 为单位）
const hexX = (q, r) => SQ3 * (q + r / 2);
const hexY = (q, r) => 1.5 * r;
function pixToHex(x, y) {          // 平面 → 轴向（含立方取整）
  const q = (SQ3 / 3 * x - y / 3), r = (2 / 3 * y);
  let cx = q, cz = r, cy = -cx - cz;
  let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
  const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return { q: rx, r: rz };
}

export function startBattle(enc, onEnd) {
  onEndCb = onEnd;
  canvas = document.getElementById('bcanvas');
  ctx = canvas.getContext('2d');
  const wind = windAt(state.position.lng, state.position.lat, state.date.m);
  const origin = { lng: state.position.lng, lat: state.position.lat };

  B = {
    enc, wind, origin, land: new Map(), units: [], turn: 1, order: [], oi: 0,
    log: [], reach: [], captured: [], scouted: false,
  };

  // 初始间距取自海图上发起攻击时的实际距离：贴上去就是贴身战，远远发现就要先追
  const sepTiles = Math.max(1, Math.min(9, Math.round((enc.nm ?? 12) / NM_PER_TILE)));
  B.sep = sepTiles;

  // 玩家在西（船首朝东 dir 1），敌方在东（船首朝西 dir 4），两边合计正好隔开 sepTiles
  const wSide = Math.floor(sepTiles / 2), eSide = sepTiles - wSide;
  state.fleet.forEach((s, i) => {
    const st = shipStat(s);
    const pos = freeCell(-wSide, (i - (state.fleet.length - 1) / 2) * 2);
    B.units.push(mkUnit({
      id: 'p' + i, side: 'p', ref: s.uid, name: s.name, typeId: s.typeId,
      hull: s.hull, hullMax: st.hullMax, armor: st.armor, guns: st.guns,
      crew: s.crew, crewMax: s.crewMax, speed: st.speed,
      ...pos, heading: 1,
    }));
  });
  makeEnemies(enc).forEach((e, i) => {
    const pos = freeCell(eSide, (i - 1) * 2);
    B.units.push(mkUnit(Object.assign(e, { id: 'e' + i, side: 'e', ...pos, heading: 4 })));
  });

  pushLog('sys', `遭遇战开始 · ${wind.name} · 接敌距离约 ${enc.nm ?? 12} 海里（${sepTiles} 格）`);
  pushLog('sys', '敌方实力不明——用「👁️ 監視」看清对面的编成。');
  newRound();
  document.getElementById('battle').classList.remove('hidden');
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onTap);
  loop();
  step();
}

function mkUnit(o) {
  return Object.assign({
    ammo: 'round', moved: false, acted: false, alive: true, fled: false,
    mp: 0,                       // 本回合剩余机动力
    load: { port: true, star: true },   // 左舷 / 右舷是否已装填
  }, o);
}

// 只读快照（UI 提示与自动化测试用）
export function battleSnapshot() {
  if (!B) return null;
  const cur = current();
  return {
    turn: B.turn, wind: B.wind.name, windDir: B.wind.dir, scouted: B.scouted,
    current: cur ? cur.id : null,
    units: B.units.filter(u => u.alive && !u.fled).map(u => ({
      id: u.id, side: u.side, name: u.name, cls: SHIP_BY_ID[u.typeId]?.name,
      q: u.q, r: u.r, heading: u.heading, headingName: DIR_NAME[u.heading],
      hull: Math.round(u.hull), hullMax: u.hullMax, crew: Math.round(u.crew),
      mp: +u.mp.toFixed(1), load: { ...u.load },
    })),
    log: B.log.slice(0, 6).map(l => l.m),
  };
}

// 测试/调试用：直接设定某舰状态（不影响正常玩法路径）
export function debugSetUnit(id, patch) {
  if (!B) return false;
  const u = B.units.find(x => x.id === id);
  if (!u) return false;
  Object.assign(u, patch);
  return true;
}
// 测试用：暴露内部裁决函数
export const _rules = {
  hexDist, rangeBand, broadsideOf, isWindward, movePoints, boardPower, computeReach, fire, board, sailCost, DIRS,
  units: () => (B ? B.units : []), get B() { return B; },
};

// ===== 世界 / 陆地 =====
function cellLL(q, r) {
  return { lng: B.origin.lng + hexX(q, r) * TILE_DEG, lat: B.origin.lat - hexY(q, r) * TILE_DEG };
}
function isLandCell(q, r) {
  const k = q + ',' + r;
  if (!B.land.has(k)) {
    const ll = cellLL(q, r);
    B.land.set(k, !isSea(ll.lng, ll.lat));
  }
  return B.land.get(k);
}
// 从建议位置向外一圈圈找一个不是陆地、也没被占的格
function freeCell(q0, r0) {
  const q = Math.round(q0), r = Math.round(r0);
  if (!isLandCell(q, r) && !occupied(q, r)) return { q, r };
  for (let rad = 1; rad < 14; rad++) {
    let cq = q + DIRS[4][0] * rad, cr = r + DIRS[4][1] * rad;   // 从西侧起点绕一圈
    for (let d = 0; d < 6; d++) {
      for (let i = 0; i < rad; i++) {
        if (!isLandCell(cq, cr) && !occupied(cq, cr)) return { q: cq, r: cr };
        cq += DIRS[d][0]; cr += DIRS[d][1];
      }
    }
  }
  return { q, r };
}

function makeEnemies(enc) {
  const out = [];
  const s = enc.strength || 1;
  const pool = enc.kind === 'patrol'
    ? (s >= 3 ? ['frigate', 'sloop'] : ['sloop', 'schooner'])
    : (s >= 2 ? ['fluyt', 'sloop'] : ['fluyt']);
  const n = Math.min(3, 1 + Math.floor(s / 2));
  for (let i = 0; i < n; i++) {
    const t = SHIP_BY_ID[pool[i % pool.length]];
    const k = 1 + state.chapter * 0.04;
    out.push({
      name: (enc.kind === 'patrol' ? '皇家' : '商船') + ' ' + t.name, typeId: t.id,
      hull: Math.round(t.hull * k), hullMax: Math.round(t.hull * k), armor: t.armor,
      guns: Math.round(t.guns * k), crew: Math.round(t.crewMax * 0.6), crewMax: t.crewMax,
      speed: t.speed, loot: Math.round((t.price || 3000) * 0.12),
      skill: 1 + Math.floor(s / 2),
    });
  }
  return out;
}

// ===== 回合调度 =====
function newRound() {
  B.units.forEach(u => {
    u.moved = false; u.acted = false;
    u.mp = movePoints(u);
    // 上回合打空的那一舷，这回合装填完毕
    if (u.reloading) { u.load[u.reloading] = true; u.reloading = null; }
  });
  B.order = B.units.filter(u => u.alive && !u.fled).sort((a, b) => b.speed - a.speed);
  B.oi = 0;
}
function current() { return B.order[B.oi]; }
const alive = side => B.units.filter(u => u.side === side && u.alive && !u.fled);

function step() {
  if (checkEnd()) return;
  let u = current();
  while (u && (!u.alive || u.fled)) { B.oi++; u = current(); }
  if (!u) { B.turn++; newRound(); return step(); }
  if (u.side === 'e') { mode = 'idle'; renderUI(); setTimeout(() => aiTurn(u), 420); }
  else { mode = 'idle'; computeReach(u); renderUI(); }
}
function endUnitTurn() { B.oi++; B.reach = []; mode = 'idle'; step(); }

function checkEnd() {
  if (!alive('p').length) { finish(false); return true; }
  if (!alive('e').length) { finish(true); return true; }
  return false;
}

function finish(win) {
  if (!B) return;             // 迟到的定时器：战斗已经结算过了
  for (const u of B.units.filter(x => x.side === 'p')) {
    const s = state.fleet.find(f => f.uid === u.ref);
    if (!s) continue;
    s.hull = Math.max(8, Math.round(u.hull));
    s.crew = Math.max(1, Math.round(u.crew));
  }
  const loot = win ? B.units.filter(u => u.side === 'e').reduce((a, u) => a + (u.loot || 0), 0) : 0;
  const captured = [...B.captured];
  const wiped = !state.fleet.length;
  cleanup();
  for (const typeId of captured) {
    if (state.fleet.length >= 4) break;
    const sh = makeShip(typeId);
    sh.crew = Math.max(5, Math.round(SHIP_BY_ID[typeId].crewMax * 0.25));
    state.fleet.push(sh);
    addLog(`俘获一艘${SHIP_BY_ID[typeId].name}，编入舰队。`);
  }
  if (state.flagship >= state.fleet.length) state.flagship = 0;
  onEndCb && onEndCb({ win, loot, captured, wiped });
}

function cleanup() {
  document.getElementById('battle').classList.add('hidden');
  canvas.removeEventListener('pointerdown', onTap);
  window.removeEventListener('resize', resize);
  cancelAnimationFrame(raf);
  B = null; mode = 'idle';
}

// ===== 风与上风 =====
// wind.dir 是风「来自」的方位。顺风便宜、逆风昂贵。
function sailCost(dir) {
  const diff = Math.abs(((dirAngle(dir) - B.wind.dir + 540) % 360) - 180);
  if (diff > 135) return 1;      // 顺风
  if (diff > 65) return 1.5;     // 侧风
  return 2.4;                    // 抢风（逆风之字）
}
// 我在敌船的上风侧？——从敌船看向我的方位，落在风来的方向 ±60° 内
// 注意 sailCost 与这里共用的这个折角式子算出的是「180 − 夹角」：0 表示同向、180 表示反向。
export function isWindward(u, foe) {
  if (!foe) return false;
  const ang = bearingHex(foe, u);
  const diff = Math.abs(((ang - B.wind.dir + 540) % 360) - 180);
  return diff < 60;
}
function bearingHex(from, to) {
  const dx = hexX(to.q, to.r) - hexX(from.q, from.r);
  const dy = hexY(to.q, to.r) - hexY(from.q, from.r);
  return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
}

// ===== 机动 =====
function movePoints(u) {
  let mp = Math.max(3, Math.round(u.speed / 1.6));
  const nav = officerBonus('speed');
  if (u.side === 'p') mp += nav;
  if (B) {
    const foe = nearestFoe(u);
    if (foe && isWindward(u, foe)) mp += 1;            // 抢占上风：多一点机动
  }
  return mp;
}
function officerBonus(key) {
  let n = 0;
  for (const id of state.officers) n += OFFICER_BY_ID[id]?.bonus?.[key] || 0;
  return n;
}
function occupied(q, r) { return B && B.units.find(u => u.alive && !u.fled && u.q === q && u.r === r); }
function nearestFoe(u) {
  const foes = alive(u.side === 'p' ? 'e' : 'p');
  if (!foes.length) return null;
  return foes.reduce((a, b) => (hexDist(u, a) <= hexDist(u, b) ? a : b));
}
function nearestFoeDist(u) {
  const f = nearestFoe(u);
  return f ? hexDist(u, f) : Infinity;
}

const TURN_COST = 0.5;   // 转一档船首向

// 可达集：状态空间是 (q, r, heading)。只能朝船首及左右各一向前进。
function computeReach(u) {
  const budget = u.mp;
  const best = new Map();      // "q,r,h" -> cost
  const out = new Map();       // "q,r"   -> 最优到达方式
  const startK = `${u.q},${u.r},${u.heading}`;
  best.set(startK, 0);
  const q = [{ q: u.q, r: u.r, h: u.heading, cost: 0 }];
  while (q.length) {
    const cur = q.shift();
    // 原地转向
    for (const dh of [-1, 1]) {
      const nh = (cur.h + dh + 6) % 6;
      const nc = cur.cost + TURN_COST;
      if (nc > budget) continue;
      const k = `${cur.q},${cur.r},${nh}`;
      if (best.has(k) && best.get(k) <= nc) continue;
      best.set(k, nc);
      q.push({ q: cur.q, r: cur.r, h: nh, cost: nc });
    }
    // 前进：船首 ±1 向（横move 是划桨船才做得到的事）
    for (const dh of [-1, 0, 1]) {
      const d = (cur.h + dh + 6) % 6;
      const nq = cur.q + DIRS[d][0], nr = cur.r + DIRS[d][1];
      if (isLandCell(nq, nr) || occupied(nq, nr)) continue;
      const nc = cur.cost + sailCost(d) + (dh ? TURN_COST : 0);
      if (nc > budget) continue;
      const k = `${nq},${nr},${d}`;
      if (best.has(k) && best.get(k) <= nc) continue;
      best.set(k, nc);
      q.push({ q: nq, r: nr, h: d, cost: nc });
      const pk = `${nq},${nr}`;
      if (!out.has(pk) || out.get(pk).cost > nc) out.set(pk, { q: nq, r: nr, h: d, cost: nc });
    }
  }
  B.reach = [...out.values()];
  B.reachStates = best;
  return B.reach;
}

// ===== 射击 =====
// 分段射程
export function rangeBand(d) {
  if (d <= 1) return { band: 'near', name: '近', hit: 1.15, dmg: 1.25 };
  if (d <= 3) return { band: 'mid', name: '中', hit: 0.92, dmg: 1.0 };
  if (d <= MAX_RANGE) return { band: 'far', name: '远', hit: 0.62, dmg: 0.7 };
  return null;
}
// 目标落在哪一舷：'star' 右舷 / 'port' 左舷 / 'chase' 首尾（只有追击炮）
export function broadsideOf(att, tgt) {
  const ang = bearingHex(att, tgt);
  const rel = ((ang - dirAngle(att.heading)) % 360 + 360) % 360;   // 0 = 正前
  const off = Math.abs(((rel % 180) - 90));                        // 距正横的角差
  if (off > 55) return 'chase';
  return rel < 180 ? 'star' : 'port';
}
const SIDE_NAME = { star: '右舷', port: '左舷', chase: '首尾追击炮' };

function fire(att, tgt) {
  const d = hexDist(att, tgt);
  const rb = rangeBand(d);
  if (!rb) return { ok: false, msg: `超出射程（最远 ${MAX_RANGE} 格）。` };
  const side = broadsideOf(att, tgt);
  if (side !== 'chase' && !att.load[side]) {
    return { ok: false, msg: `${SIDE_NAME[side]}还没装填好——转个向用另一舷，或等下一回合。` };
  }

  const am = AMMO[att.ammo];
  const skill = att.side === 'p' ? state.player.skills.combat : (att.skill || 1);
  const gunnery = att.side === 'p' ? officerBonus('gunnery') : 0;
  const windUp = isWindward(att, tgt) ? 1.10 : 0.94;               // 抢占上风：+10% 命中
  const ammoFit = am.best === rb.band ? 1.15 : 0.92;               // 弹种与距离段是否对路

  let hit = (0.80 + skill * 0.02 + gunnery * 0.03) * rb.hit * windUp * ammoFit;
  hit = Math.max(0.12, Math.min(0.95, hit));

  // 首尾追击炮只有两三门，威力很小；舷侧才是主力
  const broad = side === 'chase' ? 0.28 : 1.0;
  const salvo = Math.max(1, Math.round(att.guns / 4 * broad));

  let hulls = 0, crews = 0, sails = 0, hits = 0;
  for (let i = 0; i < salvo; i++) {
    if (Math.random() > hit) continue;
    hits++;
    const base = 9.5 * rb.dmg * (1 - Math.min(0.5, tgt.armor * 0.055));
    hulls += base * am.hull;
    crews += base * am.crew * 0.9;
    sails += am.sail * 0.35;
  }
  tgt.hull -= hulls;
  tgt.crew = Math.max(0, tgt.crew - Math.round(crews));
  if (sails) tgt.speed = Math.max(2, tgt.speed - sails);

  if (side !== 'chase') { att.load[side] = false; att.reloading = side; }   // 那一舷打空了

  pushLog(att.side,
    `${att.name} ${am.icon}${am.name} · ${SIDE_NAME[side]} · ${rb.name}距离${isWindward(att, tgt) ? ' · 上风' : ''} → ${tgt.name}：` +
    `命中 ${hits}/${salvo}，船体 −${Math.round(hulls)}，减员 ${Math.round(crews)}${sails ? '，帆索受损' : ''}`);

  if (tgt.hull <= 0) { tgt.alive = false; pushLog('sys', `💥 ${tgt.name} 沉没了！`); loseShipIfPlayer(tgt); }
  return { ok: true };
}

function loseShipIfPlayer(u) {
  if (u.side !== 'p') return;
  const i = state.fleet.findIndex(f => f.uid === u.ref);
  if (i >= 0) state.fleet.splice(i, 1);
}

// ===== 接舷 =====
// 兵力 = 士兵数 ×（1 + 戦闘Lv×0.08）× 装备加成 × 士气系数；旗舰另计主角攻防
export function boardPower(u, opts = {}) {
  const mine = u.side === 'p';
  const skill = mine ? state.player.skills.combat : (u.skill || 1);
  const morale = mine ? Math.max(0.6, Math.min(1.25, state.crewMorale / 70)) : 1.0;
  const melee = mine ? 1 + officerBonus('melee') * 0.05 : 1.0;
  let pow = u.crew * (1 + skill * 0.08) * morale * melee;
  if (opts.flagship) {
    // 主角亲自跳帮：攻防直接折成一支小队
    pow += playerAtk() * 1.6 + playerDef() * 0.8;
  }
  return pow;
}
const isPlayerFlag = u => u.side === 'p' && state.fleet[state.flagship] &&
  state.fleet[state.flagship].uid === u.ref;

// 决斗触发概率：基础 25%，旗舰对旗舰再 +25%，运每 10 点 +1%
function duelChance(att, tgt) {
  let p = 0.25;
  if (isPlayerFlag(att) || isPlayerFlag(tgt)) p += 0.25;
  p += state.player.luck / 1000;
  return Math.min(0.85, p);
}
// 可否主动提出决斗（原版门槛：我方水夫 + 運 ≥ 敌方水夫）
export function canChallenge(att, tgt) {
  return att.crew + state.player.luck >= tgt.crew;
}

function board(att, tgt, opts = {}) {
  if (hexDist(att, tgt) > 1) return { ok: false, msg: '必须贴到相邻格才能接舷。' };
  const flag = isPlayerFlag(att);

  const resolve = (bonus = 0) => {
    const aPow = boardPower(att, { flagship: flag }) * (1 + bonus);
    const bPow = boardPower(tgt, { flagship: isPlayerFlag(tgt) });
    const ratio = aPow / (aPow + bPow);
    const win = Math.random() < ratio;
    const winner = win ? att : tgt, loser = win ? tgt : att;
    const wPow = win ? aPow : bPow, lPow = win ? bPow : aPow;

    // 伤亡按战力比：势均力敌就是一场血战，碾压则几乎无损
    const lossFrac = Math.min(0.6, 0.12 + 0.42 * (lPow / (wPow + lPow)));
    winner.crew = Math.max(1, Math.round(winner.crew * (1 - lossFrac)));
    loser.alive = false;
    pushLog(winner.side,
      `🪝 ${winner.name} 跳帮夺下了 ${loser.name}！（战力 ${Math.round(win ? aPow : bPow)} vs ${Math.round(win ? bPow : aPow)}，自损 ${Math.round(lossFrac * 100)}%）`);

    if (loser.side === 'p') {
      loseShipIfPlayer(loser);
      const left = alive('p');
      if (!left.length) {
        pushLog('sys', '⚑ 舰队全灭——你被俘了。');
        renderUI(); setTimeout(() => finish(false), 700); return;
      }
      pushLog('sys', `指挥转移到 ${left[0].name}。`);
    } else {
      B.captured.push(loser.typeId);
      addFame('battle', 4);
    }
    att.acted = true; att.moved = true; att.mp = 0;
    renderUI();
    if (!checkEnd()) endUnitTurn();
  };

  // 决斗按概率触发；玩家主动挑战（opts.challenge）则必定发生
  const wantDuel = opts.challenge || Math.random() < duelChance(att, tgt);
  if (wantDuel && (att.side === 'p' || tgt.side === 'p')) {
    pushLog('sys', opts.challenge
      ? '你在跳板上喊出了对方船长的名字——甲板让开一条路。'
      : '混战里两位船长撞在了一起，周围的人自动退开。');
    startDuel({
      foeName: tgt.name + ' 船长',
      foeSkill: Math.max(1, Math.round(tgt.crew / 25)),
      onEnd: (res) => resolve(res === 'win' ? 0.8 : res === 'lose' ? -0.4 : 0),
    });
    return { ok: true, deferred: true };
  }
  resolve();
  return { ok: true };
}

function pushLog(kind, m) { B.log.unshift({ kind, m }); if (B.log.length > 30) B.log.length = 30; }

// ===== 監視（侦察）=====
function scout() {
  B.scouted = true;
  const foes = alive('e');
  pushLog('sys', '👁️ 监视：' + foes.map(f =>
    `${f.name}（${SHIP_BY_ID[f.typeId]?.name}）船体 ${Math.round(f.hull)}/${f.hullMax} · 炮 ${f.guns} · 船员 ${Math.round(f.crew)} · 航速 ${f.speed.toFixed(1)}`).join('；'));
  const myCrew = alive('p').reduce((a, u) => a + u.crew, 0);
  const foeCrew = foes.reduce((a, u) => a + u.crew, 0);
  pushLog('sys', `我方水手 ${Math.round(myCrew)} 对 ${Math.round(foeCrew)}——` +
    (myCrew >= foeCrew * 1.2 ? '人数占优，接舷有利。' : myCrew * 1.2 < foeCrew ? '人数吃亏，别轻易跳帮。' : '人数相当，接舷是场血战。'));
}

// ===== 敌方 AI =====
function aiTurn(u) {
  if (!B) return;
  const foes = alive('p');
  if (!foes.length) return endUnitTurn();
  const tgt = foes.reduce((a, b) => (hexDist(u, a) <= hexDist(u, b) ? a : b));

  // 商船：残破就投降
  if (B.enc.kind === 'merchant' && (u.hull < u.hullMax * 0.45 || u.crew < u.crewMax * 0.35)) {
    u.alive = false;
    B.captured.push(u.typeId);
    pushLog('sys', `🏳️ ${u.name} 降下了旗帜——他们投降了！`);
    renderUI();
    if (!checkEnd()) endUnitTurn();
    return;
  }
  computeReach(u);

  // 商船：拼命朝下风跑
  if (B.enc.kind === 'merchant') {
    let far = null, best = -1;
    for (const t of B.reach) {
      const d = hexDist(t, tgt);
      if (d > best) { best = d; far = t; }
    }
    if (far) { u.q = far.q; u.r = far.r; u.heading = far.h; }
    u.moved = true;
    const rb = rangeBand(hexDist(u, tgt));
    if (rb) fire(u, tgt);
    u.acted = true;
    renderUI();
    return setTimeout(() => { if (B) endUnitTurn(); }, 240);
  }

  // 战斗舰：找一个能用装填好的那一舷、且距离段合适的位置
  let best = null, bestScore = -1e9;
  for (const t of [{ q: u.q, r: u.r, h: u.heading, cost: 0 }, ...B.reach]) {
    const probe = { ...u, q: t.q, r: t.r, heading: t.h };
    const d = hexDist(probe, tgt);
    const rb = rangeBand(d);
    if (!rb) continue;
    const side = broadsideOf(probe, tgt);
    let score = rb.hit * rb.dmg * 12;
    if (side === 'chase') score -= 9;                       // 首尾对敌是最差的姿态
    else if (!u.load[side]) score -= 6;                     // 那一舷空着
    if (isWindward(probe, tgt)) score += 4;                 // 抢上风
    if (u.crew > tgt.crew * 1.35 && d <= 1) score += 8;     // 人多就想跳帮
    score -= t.cost * 0.3;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  if (best && (best.q !== u.q || best.r !== u.r || best.h !== u.heading)) {
    u.q = best.q; u.r = best.r; u.heading = best.h; u.mp -= best.cost || 0;
  }
  u.moved = true;

  const d = hexDist(u, tgt);
  if (d <= 1 && u.crew > tgt.crew * 1.35) { board(u, tgt); return; }
  const rb = rangeBand(d);
  if (rb) {
    // 按距离段挑弹种；对手人少就直接砸船体
    u.ammo = rb.band === 'near' ? (tgt.crew > u.crew * 0.7 ? 'grape' : 'round')
      : rb.band === 'far' ? 'chain' : 'round';
    fire(u, tgt);
  }
  u.acted = true;
  renderUI();
  setTimeout(() => { if (B) { if (!checkEnd()) endUnitTurn(); } }, 260);
}

// ===== 镜头（战场随双方拉开自动延伸）=====
function camera() {
  const us = B.units.filter(u => u.alive && !u.fled);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const u of us) {
    const x = hexX(u.q, u.r), y = hexY(u.q, u.r);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  x0 -= PAD * SQ3; x1 += PAD * SQ3; y0 -= PAD * 1.5; y1 += PAD * 1.5;
  const w = Math.max(10 * SQ3, x1 - x0), h = Math.max(9, y1 - y0);
  const size = Math.min(canvas.width / w, canvas.height / h);   // 一格的外接圆半径（像素）
  return { x0, y0, size, ox: (canvas.width - w * size) / 2, oy: (canvas.height - h * size) / 2, w, h };
}
const toScreen = (cam, q, r) => ({
  x: cam.ox + (hexX(q, r) - cam.x0) * cam.size,
  y: cam.oy + (hexY(q, r) - cam.y0) * cam.size,
});
function screenToHex(cam, sx, sy) {
  return pixToHex((sx - cam.ox) / cam.size + cam.x0, (sy - cam.oy) / cam.size + cam.y0);
}
// 屏幕上可见的格范围（多画一圈免得边上露底）
function visibleCells(cam) {
  const out = [];
  const r0 = Math.floor(cam.y0 / 1.5) - 1, r1 = Math.ceil((cam.y0 + cam.h) / 1.5) + 1;
  for (let r = r0; r <= r1; r++) {
    const qc = (cam.x0 / SQ3) - r / 2;
    const q0 = Math.floor(qc) - 1, q1 = Math.ceil(qc + cam.w / SQ3) + 1;
    for (let q = q0; q <= q1; q++) out.push({ q, r });
  }
  return out;
}

// ===== 输入 =====
function onTap(e) {
  const u = current();
  if (!B || !u || u.side !== 'p') return;
  const cam = camera();
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
  const { q, r } = screenToHex(cam, sx, sy);
  const hit = occupied(q, r);

  if (mode === 'move') {
    const t = B.reach.find(x => x.q === q && x.r === r);
    if (!t) return;
    u.q = q; u.r = r; u.heading = t.h; u.mp = Math.max(0, u.mp - t.cost);
    u.moved = true;
    if (u.mp >= 1) computeReach(u); else { B.reach = []; mode = 'idle'; }
    renderUI();
  } else if (mode === 'fire' && !u.acted) {
    if (!hit || hit.side !== 'e') return;
    const r2 = fire(u, hit);
    if (!r2.ok) { pushLog('sys', r2.msg); renderUI(); return; }
    u.acted = true; mode = 'idle'; renderUI();
    setTimeout(() => { if (B && !checkEnd()) endUnitTurn(); }, 320);
  } else if ((mode === 'board' || mode === 'challenge') && !u.acted) {
    if (!hit || hit.side !== 'e') return;
    board(u, hit, { challenge: mode === 'challenge' });
  }
}

// ===== 渲染 =====
function resize() {
  if (!canvas) return;
  const wrap = canvas.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(wrap.clientWidth * dpr);
  canvas.height = Math.round(wrap.clientHeight * dpr);
  canvas.style.width = wrap.clientWidth + 'px';
  canvas.style.height = wrap.clientHeight + 'px';
}
function loop() { if (!B) return; draw(); raf = requestAnimationFrame(loop); }

function hexPath(cx, cy, s) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);      // 尖顶：顶点朝上
    const x = cx + s * Math.cos(a), y = cy + s * Math.sin(a);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function draw() {
  const cam = camera(), S = cam.size;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#4f7b8e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 海面 + 陆地
  for (const { q, r } of visibleCells(cam)) {
    const p = toScreen(cam, q, r);
    if (p.x < -S * 2 || p.x > canvas.width + S * 2 || p.y < -S * 2 || p.y > canvas.height + S * 2) continue;
    hexPath(p.x, p.y, S);
    if (isLandCell(q, r)) {
      ctx.fillStyle = '#cbb98a'; ctx.fill();
      ctx.fillStyle = 'rgba(120,100,60,.18)';
      hexPath(p.x, p.y, S * 0.7); ctx.fill();
    } else {
      ctx.fillStyle = ((q * 2 + r) % 3 === 0) ? '#5b869a' : '#547f93'; ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
    hexPath(p.x, p.y, S); ctx.stroke();
  }

  const u = current();
  if (mode === 'move' && u && u.side === 'p') {
    for (const t of B.reach) {
      const p = toScreen(cam, t.q, t.r);
      hexPath(p.x, p.y, S * 0.88);
      ctx.fillStyle = 'rgba(120,230,150,.28)'; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.font = `${Math.max(9, S * 0.28)}px "DM Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('▲' + DIR_NAME[t.h], p.x, p.y + S * 0.55);
    }
  }
  if ((mode === 'fire' || mode === 'board' || mode === 'challenge') && u && u.side === 'p') {
    for (const e of alive('e')) {
      const d = hexDist(u, e);
      if (mode === 'fire' ? !rangeBand(d) : d > 1) continue;
      const p = toScreen(cam, e.q, e.r);
      hexPath(p.x, p.y, S * 0.9);
      ctx.strokeStyle = mode === 'fire' ? '#ffd34d' : '#ff7a5a';
      ctx.lineWidth = 3; ctx.stroke();
      if (mode === 'fire') {
        const side = broadsideOf(u, e), rb = rangeBand(d);
        ctx.fillStyle = side === 'chase' ? '#ffb0a0' : u.load[side] ? '#d6ffd0' : '#ffb0a0';
        ctx.font = `bold ${Math.max(9, S * 0.26)}px "DM Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${rb.name}·${SIDE_NAME[side]}${side !== 'chase' && !u.load[side] ? '(空)' : ''}`, p.x, p.y - S * 0.72);
      }
    }
  }

  for (const x of B.units) if (x.alive && !x.fled) drawShip(x, cam);
  drawWind();
}

function drawShip(u, cam) {
  const p = toScreen(cam, u.q, u.r), S = cam.size;
  const s = S / 62;
  const cur = current();
  ctx.save();
  ctx.translate(p.x, p.y);
  if (cur && cur.id === u.id) {
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3;
    hexPath(0, 0, S * 0.92); ctx.stroke();
  }
  // 船首向指示：从中心朝船首拉一条短线
  ctx.save();
  ctx.rotate(dirAngle(u.heading) * Math.PI / 180);
  ctx.strokeStyle = u.side === 'p' ? 'rgba(150,220,255,.9)' : 'rgba(255,170,150,.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -S * 0.35); ctx.lineTo(0, -S * 0.86); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-S * 0.1, -S * 0.72); ctx.lineTo(0, -S * 0.88); ctx.lineTo(S * 0.1, -S * 0.72); ctx.stroke();

  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(2, 4, 24, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = u.side === 'p' ? '#2f5fa8' : '#8c2f22';
  ctx.strokeStyle = '#241f33'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -30); ctx.quadraticCurveTo(14, -6, 11, 20);
  ctx.lineTo(-11, 20); ctx.quadraticCurveTo(-14, -6, 0, -30);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f2ead6';
  ctx.beginPath(); ctx.ellipse(0, -6, 9, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 12, 6, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 左右舷装填指示（红点=打空了）
  for (const [side, sx] of [['port', -15], ['star', 15]]) {
    ctx.fillStyle = u.load[side] ? '#7fe08a' : '#e0556f';
    ctx.beginPath(); ctx.arc(sx, 0, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  const w = S * 0.9, hp = Math.max(0, u.hull / u.hullMax);
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(-w / 2 - 1, -S * 0.62 - 1, w + 2, 7);
  ctx.fillStyle = u.side === 'p' ? '#4fd06a' : '#e0556f';
  ctx.fillRect(-w / 2, -S * 0.62, w * hp, 5);

  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.max(10, S * 0.26)}px "DM Sans", sans-serif`;
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,20,26,.85)';
  const cls = SHIP_BY_ID[u.typeId]?.name || '';
  ctx.strokeText(cls, 0, S * 0.62); ctx.fillStyle = '#fff'; ctx.fillText(cls, 0, S * 0.62);
  // 未监视前，敌舰的人数是个问号
  const crewTxt = (u.side === 'e' && !B.scouted) ? '👥？' : `👥${Math.round(u.crew)}`;
  ctx.font = `${Math.max(9, S * 0.22)}px "DM Sans", sans-serif`;
  ctx.strokeText(crewTxt, 0, S * 0.85);
  ctx.fillStyle = '#ffe9a8'; ctx.fillText(crewTxt, 0, S * 0.85);
  ctx.restore();
}

function drawWind() {
  const R = Math.min(46, canvas.width * 0.05);
  ctx.save();
  ctx.translate(canvas.width - R - 22, R + 22);
  ctx.fillStyle = 'rgba(12,20,26,.6)';
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.rotate(B.wind.dir * Math.PI / 180);
  ctx.fillStyle = '#ffe9a8'; ctx.strokeStyle = '#241f33'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -R * 0.62); ctx.lineTo(R * 0.22, R * 0.16); ctx.lineTo(0, 0); ctx.lineTo(-R * 0.22, R * 0.16);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.max(11, R * 0.3)}px "DM Sans", sans-serif`;
  ctx.fillText(B.wind.name, 0, R + 18);
  ctx.restore();
}

// ===== HTML 操作栏 =====
function renderUI() {
  if (!B) return;
  const u = current();
  const info = document.getElementById('binfo');
  const acts = document.getElementById('bactions');
  const mine = alive('p'), foes = alive('e');
  const foe = u && u.side === 'p' ? nearestFoe(u) : null;
  const far = foe ? hexDist(u, foe) : Infinity;
  const rb = foe ? rangeBand(far) : null;
  const side = foe ? broadsideOf(u, foe) : null;

  info.innerHTML = `
    <div class="brow">
      <span class="btag">第 ${B.turn} 回合</span>
      <span class="btag me">我方 ${mine.length}</span>
      <span class="btag foe">敌方 ${foes.length}</span>
      <span class="btag">🌬️ ${B.wind.name}</span>
      ${foe ? `<span class="btag">距敌 ${far} 格（${far * NM_PER_TILE} 海里）${rb ? ' · ' + rb.name + '距离' : ' · 射程外'}</span>` : ''}
      ${foe && isWindward(u, foe) ? '<span class="btag win">⛵ 占上风</span>' : foe ? '<span class="btag lose">下风</span>' : ''}
    </div>
    ${u ? `<div class="bcur ${u.side === 'p' ? 'me' : 'foe'}">
        ${u.side === 'p' ? '▶' : '✦'} <b>${u.name}</b>
        <span class="bcls">${SHIP_BY_ID[u.typeId]?.name || ''}</span>
        <span class="bstat">🛡️${Math.round(u.hull)}/${u.hullMax} · 💣${u.guns} · 👥${Math.round(u.crew)} · ⛵${u.speed.toFixed(1)}</span>
        ${u.side === 'p' ? `<span class="bstat">船首 ${DIR_NAME[u.heading]} · 机动 ${u.mp.toFixed(1)}／${movePoints(u)} · 左舷${u.load.port ? '已装填' : '空'}／右舷${u.load.star ? '已装填' : '空'}${side ? ' · 对敌在' + SIDE_NAME[side] : ''}</span>`
      : '<span class="bstat">敌方行动中…</span>'}
      </div>` : ''}
    <div class="blog">${B.log.slice(0, 5).map(l =>
    `<div class="ll ${l.kind === 'p' ? 'me' : l.kind === 'e' ? 'foe' : 'sys'}">${l.m}</div>`).join('')}</div>`;

  if (!u || u.side !== 'p') { acts.innerHTML = ''; return; }
  const canDisengage = far >= DISENGAGE;
  const adj = foes.some(f => hexDist(u, f) <= 1);
  const adjFoe = foes.find(f => hexDist(u, f) <= 1);
  const canChal = adjFoe && canChallenge(u, adjFoe);
  acts.innerHTML = `
    <button class="bbtn${mode === 'move' ? ' on' : ''}" data-b="move" ${u.mp < 1 ? 'disabled' : ''}>🧭 机动 ${u.mp.toFixed(1)}</button>
    <button class="bbtn${mode === 'fire' ? ' on' : ''}" data-b="fire" ${u.acted ? 'disabled' : ''}>💥 炮击</button>
    <button class="bbtn${mode === 'board' ? ' on' : ''}" data-b="board" ${u.acted || !adj ? 'disabled' : ''}>🪝 接舷</button>
    <button class="bbtn${mode === 'challenge' ? ' on' : ''}" data-b="challenge" ${u.acted || !canChal ? 'disabled' : ''}
      title="${adjFoe && !canChal ? '我方水手 + 运 要不少于对方，才敢喊出这句话' : '点名单挑对方船长'}">⚔️ 挑战船长</button>
    <button class="bbtn" data-b="scout" ${B.scouted ? 'disabled' : ''}>👁️ 監視</button>
    <button class="bbtn" data-b="repair" ${u.acted ? 'disabled' : ''}>🔧 抢修</button>
    <button class="bbtn ${canDisengage ? 'flee-ok' : ''}" data-b="flee">🏳️ ${canDisengage ? '脱离接触' : '撤退'}</button>
    <button class="bbtn end" data-b="end">⏭️ 结束回合</button>
    <div class="ammo-row">${Object.entries(AMMO).map(([k, a]) =>
    `<button class="bbtn ammo${u.ammo === k ? ' on' : ''}" data-ammo="${k}" title="${a.desc}">${a.icon}${a.name}</button>`).join('')}
      <span class="ammo-tip">${AMMO[u.ammo].desc}${rb && AMMO[u.ammo].best === rb.band ? '　·　<b>正合当前距离</b>' : ''}${canDisengage ? '　·　已拉开距离，可以随时脱离' : ''}</span></div>`;
  [...acts.querySelectorAll('[data-b]')].forEach(b => b.addEventListener('click', () => doBtn(b.dataset.b)));
  [...acts.querySelectorAll('[data-ammo]')].forEach(b => b.addEventListener('click', () => { current().ammo = b.dataset.ammo; renderUI(); }));
}

function doBtn(a) {
  if (!B) return;
  const u = current();
  if (!u || u.side !== 'p') return;
  if (a === 'move') { mode = mode === 'move' ? 'idle' : 'move'; computeReach(u); }
  else if (a === 'fire') mode = mode === 'fire' ? 'idle' : 'fire';
  else if (a === 'board') mode = mode === 'board' ? 'idle' : 'board';
  else if (a === 'challenge') mode = mode === 'challenge' ? 'idle' : 'challenge';
  else if (a === 'scout') { scout(); mode = 'idle'; }
  else if (a === 'repair') {
    u.hull = Math.min(u.hullMax, u.hull + 18 + u.crew * 0.05);
    pushLog('p', `🔧 ${u.name} 抢修船体。`);
    u.acted = true; renderUI(); return endUnitTurn();
  } else if (a === 'flee') {
    if (nearestFoeDist(u) >= DISENGAGE) {
      u.fled = true;
      pushLog('sys', `🏳️ ${u.name} 已拉开距离，脱离接触。`);
      renderUI();
      if (!checkEnd()) endUnitTurn();
      return;
    }
    pushLog('sys', `敌舰仍咬在 ${nearestFoeDist(u)} 格内——先甩开到 ${DISENGAGE} 格外才能脱离。`);
  } else if (a === 'end') return endUnitTurn();
  renderUI();
}

// 测试用：以玩家身份执行一个指令
export function debugAct(a) { doBtn(a); }
