// 回合制海战：战场是真实海域的一小块（含陆地），随双方拉开距离自动延伸；
// 风向修正移动、舷侧齐射、三种弹药、接舷夺船、脱离接触。
import { state, shipStat, addLog, makeShip } from './state.js';
import { SHIP_BY_ID } from './data/ships.js';
import { windAt, isSea } from './geo.js';
import { startDuel } from './duel.js';

const TILE_DEG = 0.05;        // 每格约 3 海里
const DISENGAGE = 7;          // 与最近敌舰超过此距离即可脱离接触
const PAD = 3;                // 镜头留白（格）

const AMMO = {
  round: { name: '实心弹', icon: '⚫', hull: 1.0, crew: 0.15, sail: 0, desc: '破坏船体' },
  chain: { name: '链弹', icon: '⛓️', hull: 0.35, crew: 0.1, sail: 1.6, desc: '毁帆降速' },
  grape: { name: '霰弹', icon: '🔴', hull: 0.2, crew: 1.0, sail: 0, desc: '杀伤船员，利于接舷' },
};
const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
const dirAngle = d => d * 45;

let B = null, onEndCb = null, canvas = null, ctx = null, mode = 'idle', raf = 0;

export function startBattle(enc, onEnd) {
  onEndCb = onEnd;
  canvas = document.getElementById('bcanvas');
  ctx = canvas.getContext('2d');
  const wind = windAt(state.position.lng, state.position.lat, state.date.m);
  const origin = { lng: state.position.lng, lat: state.position.lat };

  B = { enc, wind, origin, land: new Map(), units: [], turn: 1, order: [], oi: 0, log: [], reach: [], captured: [] };

  // 出生点：在原点附近找可通航格，玩家在西、敌方在东
  state.fleet.forEach((s, i) => {
    const st = shipStat(s);
    const pos = freeCell(-6, (i - (state.fleet.length - 1) / 2) * 2);
    B.units.push({
      id: 'p' + i, side: 'p', ref: s.uid, name: s.name, typeId: s.typeId,
      hull: s.hull, hullMax: st.hullMax, armor: st.armor, guns: st.guns,
      crew: s.crew, crewMax: s.crewMax, speed: st.speed,
      ...pos, heading: 2, ammo: 'round', moved: false, acted: false, alive: true, fled: false,
    });
  });
  makeEnemies(enc).forEach((e, i) => {
    const pos = freeCell(6, (i - 1) * 2);
    B.units.push(Object.assign(e, {
      id: 'e' + i, side: 'e', ...pos, heading: 6,
      ammo: 'round', moved: false, acted: false, alive: true, fled: false,
    }));
  });

  pushLog('sys', `遭遇战开始 · ${wind.name}`);
  newRound();
  document.getElementById('battle').classList.remove('hidden');
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onTap);
  loop();
  step();
}

// 只读快照（UI 提示与自动化测试用）
export function battleSnapshot() {
  if (!B) return null;
  return {
    turn: B.turn, wind: B.wind.name,
    current: current() ? current().id : null,
    units: B.units.filter(u => u.alive && !u.fled).map(u => ({
      id: u.id, side: u.side, name: u.name, cls: SHIP_BY_ID[u.typeId]?.name,
      c: u.c, r: u.r, hull: Math.round(u.hull), hullMax: u.hullMax, crew: Math.round(u.crew),
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

// ===== 世界 / 陆地 =====
function cellLL(c, r) {
  return { lng: B.origin.lng + c * TILE_DEG, lat: B.origin.lat - r * TILE_DEG };
}
function isLandCell(c, r) {
  const k = c + ',' + r;
  if (!B.land.has(k)) {
    const ll = cellLL(c, r);
    B.land.set(k, !isSea(ll.lng, ll.lat));
  }
  return B.land.get(k);
}
// 从建议位置向外找一个不是陆地、也没被占的格
function freeCell(c0, r0) {
  for (let rad = 0; rad < 14; rad++) {
    for (let dc = -rad; dc <= rad; dc++) {
      for (let dr = -rad; dr <= rad; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
        const c = Math.round(c0 + dc), r = Math.round(r0 + dr);
        if (!isLandCell(c, r) && !occupied(c, r)) return { c, r };
      }
    }
  }
  return { c: Math.round(c0), r: Math.round(r0) };
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
    });
  }
  return out;
}

// ===== 回合调度 =====
function newRound() {
  B.units.forEach(u => { u.moved = false; u.acted = false; });
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
  // 回写玩家船只（按 uid 匹配；战斗中损失的船已从 state.fleet 移除）
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

// ===== 规则 =====
function moveCost(dir) {
  const diff = Math.abs(((dirAngle(dir) - B.wind.dir + 540) % 360) - 180);
  if (diff > 135) return 1;
  if (diff > 65) return 1.5;
  return 2.2;
}
const movePoints = u => Math.max(2, Math.round(u.speed / 2.2));
function occupied(c, r) { return B && B.units.find(u => u.alive && !u.fled && u.c === c && u.r === r); }
const dist = (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
function nearestFoeDist(u) {
  const foes = alive(u.side === 'p' ? 'e' : 'p');
  return foes.length ? Math.min(...foes.map(f => dist(u, f))) : Infinity;
}

function computeReach(u) {
  const mp = movePoints(u);
  const seen = new Map([[u.c + ',' + u.r, 0]]);
  const out = [];
  const q = [{ c: u.c, r: u.r, cost: 0 }];
  while (q.length) {
    const cur = q.shift();
    for (let d = 0; d < 8; d++) {
      const nc = cur.c + DIRS[d][0], nr = cur.r + DIRS[d][1];
      if (isLandCell(nc, nr) || occupied(nc, nr)) continue;
      const nCost = cur.cost + moveCost(d);
      if (nCost > mp) continue;
      const k = nc + ',' + nr;
      if (seen.has(k) && seen.get(k) <= nCost) continue;
      seen.set(k, nCost);
      out.push({ c: nc, r: nr, cost: nCost, dir: d });
      q.push({ c: nc, r: nr, cost: nCost });
    }
  }
  B.reach = out;
}

function facingMult(att, tgt) {
  const ang = (Math.atan2(tgt.c - att.c, -(tgt.r - att.r)) * 180 / Math.PI + 360) % 360;
  const rel = Math.abs(((ang - dirAngle(att.heading) + 540) % 360) - 180);
  const off = Math.abs(rel - 90);
  if (off <= 32) return 1.65;   // 侧舷齐射
  if (off <= 58) return 1.0;
  return 0.55;                   // 首尾指向
}

function fire(att, tgt) {
  const d = dist(att, tgt);
  if (d > 4) return { ok: false, msg: '超出射程。' };
  const am = AMMO[att.ammo];
  const skill = att.side === 'p' ? state.player.skills.combat : 1;
  const hit = Math.max(0.2, Math.min(0.95, 0.82 - d * 0.09 + skill * 0.02));
  const salvo = Math.max(1, Math.round(att.guns / 4));
  let hulls = 0, crews = 0, sails = 0;
  for (let i = 0; i < salvo; i++) {
    if (Math.random() > hit) continue;
    const base = 9.5 * facingMult(att, tgt) * (1 - Math.min(0.5, tgt.armor * 0.055));
    hulls += base * am.hull;
    crews += base * am.crew * 0.9;
    sails += am.sail * 0.35;
  }
  tgt.hull -= hulls;
  tgt.crew = Math.max(0, tgt.crew - Math.round(crews));
  if (sails) tgt.speed = Math.max(2, tgt.speed - sails);
  pushLog(att.side, `${att.name} ${am.icon}${am.name}齐射 → ${tgt.name}：船体 −${Math.round(hulls)}，减员 ${Math.round(crews)}${sails ? '，帆索受损' : ''}`);
  if (tgt.hull <= 0) { tgt.alive = false; pushLog('sys', `💥 ${tgt.name} 沉没了！`); loseShipIfPlayer(tgt); }
  return { ok: true };
}

// 玩家船沉没 / 被夺 → 从舰队移除
function loseShipIfPlayer(u) {
  if (u.side !== 'p') return;
  const i = state.fleet.findIndex(f => f.uid === u.ref);
  if (i >= 0) state.fleet.splice(i, 1);
}

// ===== 接舷：胜者直接夺船 =====
function board(att, tgt) {
  if (dist(att, tgt) > 1) return { ok: false, msg: '必须贴到相邻格才能接舷。' };
  const isFlag = att.side === 'p' && state.fleet[state.flagship] &&
    state.fleet[state.flagship].uid === att.ref;

  const resolve = (bonus = 0) => {
    const aPow = att.crew * (1 + (att.side === 'p' ? state.player.skills.combat * 0.08 : 0)) * (1 + bonus);
    const bPow = tgt.crew * (1 + (tgt.side === 'p' ? state.player.skills.combat * 0.08 : 0));
    const win = aPow > bPow * (0.8 + Math.random() * 0.4);
    const loser = win ? tgt : att;
    const winner = win ? att : tgt;

    winner.crew = Math.max(1, Math.round(winner.crew * 0.82));
    loser.alive = false;
    pushLog(winner.side, `🪝 ${winner.name} 跳帮夺下了 ${loser.name}！`);

    if (loser.side === 'p') {
      loseShipIfPlayer(loser);
      const left = alive('p');
      if (!left.length) {
        pushLog('sys', '⚑ 舰队全灭——你被俘了。');
        renderUI(); setTimeout(() => finish(false), 700); return;
      }
      pushLog('sys', `指挥转移到 ${left[0].name}。`);
    } else {
      B.captured.push(loser.typeId);   // 夺来的船战后编入舰队
    }
    att.acted = true; att.moved = true;
    renderUI();
    if (!checkEnd()) endUnitTurn();
  };

  // 玩家旗舰接舷 → 打一场决斗，胜负影响跳帮结果
  if (isFlag) {
    startDuel({
      foeName: tgt.name + ' 船长',
      foeHp: 60 + tgt.crew * 0.2,
      onEnd: (won) => resolve(won ? 0.8 : -0.4),
    });
    return { ok: true, deferred: true };
  }
  resolve();
  return { ok: true };
}

function pushLog(kind, m) { B.log.unshift({ kind, m }); if (B.log.length > 30) B.log.length = 30; }

// ===== 敌方 AI =====
function aiTurn(u) {
  if (!B) return;
  const foes = alive('p');
  if (!foes.length) return endUnitTurn();
  const tgt = foes.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b));

  // 商船：残破就投降
  if (B.enc.kind === 'merchant' && (u.hull < u.hullMax * 0.45 || u.crew < u.crewMax * 0.35)) {
    u.alive = false;
    B.captured.push(u.typeId);
    pushLog('sys', `🏳️ ${u.name} 降下了旗帜——他们投降了！`);
    renderUI();
    if (!checkEnd()) endUnitTurn();
    return;
  }
  // 商船：拼命逃
  if (B.enc.kind === 'merchant') {
    computeReach(u);
    let far = null, best = -1;
    for (const t of B.reach) {
      const d = Math.max(Math.abs(t.c - tgt.c), Math.abs(t.r - tgt.r));
      if (d > best) { best = d; far = t; }
    }
    if (far) { u.c = far.c; u.r = far.r; u.heading = far.dir ?? u.heading; }
    u.moved = true;
    if (dist(u, tgt) <= 3) fire(u, tgt);
    u.acted = true;
    renderUI();
    return setTimeout(() => { if (B) endUnitTurn(); }, 240);
  }

  computeReach(u);
  let best = null, bestScore = -1e9;
  for (const t of [{ c: u.c, r: u.r, dir: u.heading }, ...B.reach]) {
    const probe = { ...u, c: t.c, r: t.r, heading: t.dir ?? u.heading };
    const d = dist(probe, tgt);
    if (d > 4) continue;
    const score = facingMult(probe, tgt) * 10 - d * 1.2;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  if (best && (best.c !== u.c || best.r !== u.r)) { u.c = best.c; u.r = best.r; u.heading = best.dir ?? u.heading; }
  u.moved = true;

  const d = dist(u, tgt);
  if (d <= 1 && u.crew > tgt.crew * 1.35) { board(u, tgt); return; }
  if (d <= 4) {
    u.ammo = (tgt.crew < u.crew * 0.6) ? 'round' : (Math.random() < 0.35 ? 'grape' : 'round');
    fire(u, tgt);
  }
  u.acted = true;
  renderUI();
  setTimeout(() => { if (B) { if (!checkEnd()) endUnitTurn(); } }, 260);
}

// ===== 镜头（战场随双方拉开自动延伸）=====
function camera() {
  const us = B.units.filter(u => u.alive && !u.fled);
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  for (const u of us) {
    c0 = Math.min(c0, u.c); c1 = Math.max(c1, u.c);
    r0 = Math.min(r0, u.r); r1 = Math.max(r1, u.r);
  }
  c0 -= PAD; c1 += PAD; r0 -= PAD; r1 += PAD;
  const cols = Math.max(10, c1 - c0 + 1), rows = Math.max(7, r1 - r0 + 1);
  const cw = canvas.width, ch = canvas.height;
  const tile = Math.min(cw / cols, ch / rows);
  return { c0, r0, cols, rows, tile, ox: (cw - cols * tile) / 2, oy: (ch - rows * tile) / 2 };
}
const toScreen = (cam, c, r) => ({ x: cam.ox + (c - cam.c0) * cam.tile, y: cam.oy + (r - cam.r0) * cam.tile });

// ===== 输入 =====
function onTap(e) {
  const u = current();
  if (!B || !u || u.side !== 'p') return;
  const cam = camera();
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
  const c = Math.floor((sx - cam.ox) / cam.tile) + cam.c0;
  const r = Math.floor((sy - cam.oy) / cam.tile) + cam.r0;
  const hit = occupied(c, r);

  if (mode === 'move' && !u.moved) {
    const t = B.reach.find(x => x.c === c && x.r === r);
    if (!t) return;
    u.c = c; u.r = r; u.heading = t.dir; u.moved = true;
    B.reach = []; mode = 'idle'; renderUI();
  } else if (mode === 'fire' && !u.acted) {
    if (!hit || hit.side !== 'e') return;
    if (!fire(u, hit).ok) return;
    u.acted = true; mode = 'idle'; renderUI();
    setTimeout(() => { if (B && !checkEnd()) endUnitTurn(); }, 320);
  } else if (mode === 'board' && !u.acted) {
    if (!hit || hit.side !== 'e') return;
    board(u, hit);
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

function draw() {
  const cam = camera(), T = cam.tile;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#4f7b8e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 海面 + 陆地
  for (let r = cam.r0; r < cam.r0 + cam.rows; r++) {
    for (let c = cam.c0; c < cam.c0 + cam.cols; c++) {
      const p = toScreen(cam, c, r);
      if (isLandCell(c, r)) {
        ctx.fillStyle = '#cbb98a';
        ctx.fillRect(p.x, p.y, T + 1, T + 1);
        ctx.fillStyle = 'rgba(120,100,60,.18)';
        ctx.fillRect(p.x + T * 0.15, p.y + T * 0.15, T * 0.7, T * 0.7);
      } else {
        ctx.fillStyle = ((c + r) & 1) ? '#5b869a' : '#547f93';
        ctx.fillRect(p.x, p.y, T + 1, T + 1);
      }
    }
  }
  // 网格
  ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
  for (let c = cam.c0; c <= cam.c0 + cam.cols; c++) {
    const p = toScreen(cam, c, cam.r0);
    ctx.beginPath(); ctx.moveTo(p.x, cam.oy); ctx.lineTo(p.x, cam.oy + cam.rows * T); ctx.stroke();
  }
  for (let r = cam.r0; r <= cam.r0 + cam.rows; r++) {
    const p = toScreen(cam, cam.c0, r);
    ctx.beginPath(); ctx.moveTo(cam.ox, p.y); ctx.lineTo(cam.ox + cam.cols * T, p.y); ctx.stroke();
  }

  if (mode === 'move') {
    for (const t of B.reach) {
      const p = toScreen(cam, t.c, t.r);
      ctx.fillStyle = 'rgba(120,230,150,.30)';
      ctx.fillRect(p.x + 2, p.y + 2, T - 4, T - 4);
    }
  }
  if (mode === 'fire' || mode === 'board') {
    const u = current();
    for (const e of alive('e')) {
      const d = dist(u, e);
      if (mode === 'fire' ? d > 4 : d > 1) continue;
      const p = toScreen(cam, e.c, e.r);
      ctx.strokeStyle = mode === 'fire' ? '#ffd34d' : '#ff7a5a';
      ctx.lineWidth = 3;
      ctx.strokeRect(p.x + 3, p.y + 3, T - 6, T - 6);
    }
  }

  for (const u of B.units) if (u.alive && !u.fled) drawShip(u, cam);
  drawWind();
}

function drawShip(u, cam) {
  const p = toScreen(cam, u.c, u.r), T = cam.tile;
  const cx = p.x + T / 2, cy = p.y + T / 2;
  const s = T / 96;
  const cur = current();
  ctx.save();
  ctx.translate(cx, cy);
  if (cur && cur.id === u.id) {
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, T * 0.42, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.save();
  ctx.scale(s, s);
  ctx.rotate(dirAngle(u.heading) * Math.PI / 180);
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
  ctx.restore();

  // 血条
  const w = T * 0.52, hp = Math.max(0, u.hull / u.hullMax);
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(-w / 2 - 1, -T * 0.45 - 1, w + 2, 7);
  ctx.fillStyle = u.side === 'p' ? '#4fd06a' : '#e0556f';
  ctx.fillRect(-w / 2, -T * 0.45, w * hp, 5);
  // 舰级 + 船员
  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.max(10, T * 0.15)}px "DM Sans", sans-serif`;
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,20,26,.85)';
  const cls = SHIP_BY_ID[u.typeId]?.name || '';
  ctx.strokeText(cls, 0, T * 0.36); ctx.fillStyle = '#fff'; ctx.fillText(cls, 0, T * 0.36);
  ctx.font = `${Math.max(9, T * 0.13)}px "DM Sans", sans-serif`;
  ctx.strokeText(`👥${Math.round(u.crew)}`, 0, T * 0.5);
  ctx.fillStyle = '#ffe9a8'; ctx.fillText(`👥${Math.round(u.crew)}`, 0, T * 0.5);
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
  const far = u && u.side === 'p' ? nearestFoeDist(u) : 0;

  info.innerHTML = `
    <div class="brow">
      <span class="btag">第 ${B.turn} 回合</span>
      <span class="btag me">我方 ${mine.length}</span>
      <span class="btag foe">敌方 ${foes.length}</span>
      <span class="btag">🌬️ ${B.wind.name}</span>
      ${u && u.side === 'p' ? `<span class="btag">与最近敌舰 ${far === Infinity ? '—' : far + ' 格'}</span>` : ''}
    </div>
    ${u ? `<div class="bcur ${u.side === 'p' ? 'me' : 'foe'}">
        ${u.side === 'p' ? '▶' : '✦'} <b>${u.name}</b>
        <span class="bcls">${SHIP_BY_ID[u.typeId]?.name || ''}</span>
        <span class="bstat">🛡️${Math.round(u.hull)}/${u.hullMax} · 💣${u.guns} · 👥${Math.round(u.crew)} · ⛵${u.speed.toFixed(1)}</span>
        ${u.side === 'p' ? `<span class="bstat">移动力 ${movePoints(u)}${u.moved ? '（已移动）' : ''}${u.acted ? '（已行动）' : ''}</span>` : '<span class="bstat">敌方行动中…</span>'}
      </div>` : ''}
    <div class="blog">${B.log.slice(0, 5).map(l =>
    `<div class="ll ${l.kind === 'p' ? 'me' : l.kind === 'e' ? 'foe' : 'sys'}">${l.m}</div>`).join('')}</div>`;

  if (!u || u.side !== 'p') { acts.innerHTML = ''; return; }
  const canDisengage = far >= DISENGAGE;
  const adj = foes.some(f => dist(u, f) <= 1);
  acts.innerHTML = `
    <button class="bbtn${mode === 'move' ? ' on' : ''}" data-b="move" ${u.moved ? 'disabled' : ''}>🧭 移动</button>
    <button class="bbtn${mode === 'fire' ? ' on' : ''}" data-b="fire" ${u.acted ? 'disabled' : ''}>💥 炮击</button>
    <button class="bbtn${mode === 'board' ? ' on' : ''}" data-b="board" ${u.acted || !adj ? 'disabled' : ''}>🪝 接舷夺船</button>
    <button class="bbtn" data-b="repair" ${u.acted ? 'disabled' : ''}>🔧 抢修</button>
    <button class="bbtn ${canDisengage ? 'flee-ok' : ''}" data-b="flee">🏳️ ${canDisengage ? '脱离接触' : '撤退'}</button>
    <button class="bbtn end" data-b="end">⏭️ 结束回合</button>
    <div class="ammo-row">${Object.entries(AMMO).map(([k, a]) =>
    `<button class="bbtn ammo${u.ammo === k ? ' on' : ''}" data-ammo="${k}" title="${a.desc}">${a.icon}${a.name}</button>`).join('')}
      <span class="ammo-tip">${AMMO[u.ammo].desc}${canDisengage ? '　·　已拉开距离，可以随时脱离' : ''}</span></div>`;
  [...acts.querySelectorAll('[data-b]')].forEach(b => b.addEventListener('click', () => doBtn(b.dataset.b)));
  [...acts.querySelectorAll('[data-ammo]')].forEach(b => b.addEventListener('click', () => { current().ammo = b.dataset.ammo; renderUI(); }));
}

function doBtn(a) {
  const u = current();
  if (!u || u.side !== 'p') return;
  if (a === 'move') { mode = mode === 'move' ? 'idle' : 'move'; computeReach(u); }
  else if (a === 'fire') mode = mode === 'fire' ? 'idle' : 'fire';
  else if (a === 'board') mode = mode === 'board' ? 'idle' : 'board';
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
