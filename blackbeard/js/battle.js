// 回合制网格海战：12×9 海图、风向修正、舷侧射击、三种弹药、接舷与俘获、敌方 AI
import { state, shipStat, addLog, makeShip } from './state.js';
import { SHIP_BY_ID } from './data/ships.js';
import { windAt } from './geo.js';
import { startDuel } from './duel.js';

const COLS = 12, ROWS = 9, TILE = 96;
const FIELD_W = COLS * TILE, FIELD_H = ROWS * TILE;

const AMMO = {
  round: { name: '实心弹', icon: '⚫', hull: 1.0, crew: 0.15, sail: 0, desc: '破坏船体' },
  chain: { name: '链弹', icon: '⛓️', hull: 0.35, crew: 0.1, sail: 1.6, desc: '毁帆降速' },
  grape: { name: '霰弹', icon: '🔴', hull: 0.2, crew: 1.0, sail: 0, desc: '杀伤船员，利于接舷' },
};

let B = null;          // 当前战斗
let onEndCb = null;
let ctx = null, canvas = null;
let mode = 'idle';     // idle | move | fire | board

export function startBattle(enc, onEnd) {
  onEndCb = onEnd;
  canvas = document.getElementById('bcanvas');
  ctx = canvas.getContext('2d');
  const wind = windAt(state.position.lng, state.position.lat, state.date.m);

  const units = [];
  state.fleet.forEach((s, i) => {
    const st = shipStat(s);
    units.push({
      id: 'p' + i, side: 'p', ref: i, name: s.name, typeId: s.typeId,
      hull: s.hull, hullMax: st.hullMax, armor: st.armor, guns: st.guns,
      crew: s.crew, crewMax: s.crewMax, speed: st.speed,
      c: 1, r: 2 + i * 2, heading: 2, ammo: 'round', moved: false, acted: false, alive: true, fled: false,
    });
  });
  makeEnemies(enc).forEach((e, i) => {
    units.push(Object.assign(e, {
      id: 'e' + i, side: 'e', c: COLS - 2, r: 2 + i * 2, heading: 6,
      ammo: 'round', moved: false, acted: false, alive: true, fled: false,
    }));
  });

  B = { units, wind, turn: 1, order: [], oi: 0, enc, sel: null, reach: [], log: [] };
  newRound();
  document.getElementById('battle').classList.remove('hidden');
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onTap);
  loop();
  step();
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
    // 敌方随剧情章节小幅变强
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

function step() {
  if (checkEnd()) return;
  let u = current();
  // 跳过已阵亡/逃离
  while (u && (!u.alive || u.fled)) { B.oi++; u = current(); }
  if (!u) { B.turn++; newRound(); return step(); }
  B.sel = u;
  if (u.side === 'e') { setTimeout(() => { aiTurn(u); }, 420); mode = 'idle'; }
  else { mode = 'idle'; computeReach(u); }
  renderUI();
}

function endUnitTurn() {
  B.oi++;
  B.reach = [];
  step();
}

function checkEnd() {
  const pAlive = B.units.some(u => u.side === 'p' && u.alive && !u.fled);
  const eAlive = B.units.some(u => u.side === 'e' && u.alive && !u.fled);
  if (eAlive && pAlive) return false;
  finish(!eAlive);
  return true;
}

function finish(win) {
  // 回写玩家船只状态
  B.units.filter(u => u.side === 'p' && u.ref !== undefined).forEach(u => {
    const s = state.fleet[u.ref];
    if (!s) return;
    s.hull = u.alive ? Math.max(8, Math.round(u.hull)) : Math.max(8, Math.round(u.hullMax * 0.15));
    s.crew = Math.max(3, Math.round(u.crew));
  });
  const loot = win ? B.units.filter(u => u.side === 'e').reduce((a, u) => a + (u.loot || 0), 0) : 0;
  const captured = B.captured || null;
  cleanup();
  if (captured && state.fleet.length < 4) {
    state.fleet.push(makeShip(captured));
    addLog(`俘获一艘${SHIP_BY_ID[captured].name}，编入舰队。`);
  }
  onEndCb && onEndCb({ win, loot, captured });
}

function cleanup() {
  document.getElementById('battle').classList.add('hidden');
  canvas.removeEventListener('pointerdown', onTap);
  window.removeEventListener('resize', resize);
  B = null; mode = 'idle';
}

// ===== 规则 =====
const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]; // N,NE,E,SE,S,SW,W,NW
const dirAngle = d => d * 45;

function moveCost(dir) {
  // 风"吹向"角度 → 顺风便宜、逆风昂贵
  const diff = Math.abs(((dirAngle(dir) - B.wind.dir + 540) % 360) - 180); // 180=顺风
  if (diff > 135) return 1;      // 顺风
  if (diff > 65) return 1.5;     // 横风
  return 2.2;                     // 逆风（抢风航行）
}
function movePoints(u) {
  return Math.max(2, Math.round(u.speed / 2.2));
}
function occupied(c, r) { return B.units.find(u => u.alive && !u.fled && u.c === c && u.r === r); }

function computeReach(u) {
  const mp = movePoints(u);
  const seen = new Map([[u.c + ',' + u.r, 0]]);
  const out = [];
  const q = [{ c: u.c, r: u.r, cost: 0 }];
  while (q.length) {
    const cur = q.shift();
    for (let d = 0; d < 8; d++) {
      const nc = cur.c + DIRS[d][0], nr = cur.r + DIRS[d][1];
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      if (occupied(nc, nr)) continue;
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

function dist(a, b) { return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)); }

// 舷侧判定：目标相对本舰朝向在 60°~120° → 侧舷齐射
function facingMult(att, tgt) {
  const dx = tgt.c - att.c, dy = tgt.r - att.r;
  const ang = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  const rel = Math.abs(((ang - dirAngle(att.heading) + 540) % 360) - 180);  // 0=正后,180=正前
  const off = Math.abs(rel - 90);
  if (off <= 32) return 1.65;    // 侧舷
  if (off <= 58) return 1.0;
  return 0.55;                    // 首尾指向，只有追击炮
}

function fire(att, tgt) {
  const d = dist(att, tgt);
  if (d > 4) return { ok: false, msg: '超出射程。' };
  const am = AMMO[att.ammo];
  const skill = att.side === 'p' ? state.player.skills.combat : 1;
  let hit = 0.82 - d * 0.09 + skill * 0.02;
  hit = Math.max(0.2, Math.min(0.95, hit));
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
  const msg = `${att.name} 以${am.name}齐射 → ${tgt.name}：船体 −${Math.round(hulls)}，船员 −${Math.round(crews)}${sails ? '，帆索受损' : ''}`;
  pushLog(msg);
  if (tgt.hull <= 0) { tgt.alive = false; pushLog(`${tgt.name} 沉没了！`); }
  return { ok: true };
}

function board(att, tgt) {
  if (dist(att, tgt) > 1) return { ok: false, msg: '必须贴到相邻格才能接舷。' };
  // 玩家旗舰接舷 → 进入决斗；其余自动结算
  const isFlag = att.side === 'p' && att.ref === state.flagship;
  const resolve = (bonus = 0) => {
    const aPow = att.crew * (1 + (att.side === 'p' ? state.player.skills.combat * 0.08 : 0)) * (1 + bonus);
    const bPow = tgt.crew * 1.0;
    const win = aPow > bPow * (0.8 + Math.random() * 0.4);
    if (win) {
      const lost = Math.round(att.crew * 0.18);
      att.crew = Math.max(1, att.crew - lost);
      tgt.crew = 0;
      // 残血船可俘获
      if (tgt.hull < tgt.hullMax * 0.55 || tgt.crew <= 0) {
        tgt.alive = false;
        B.captured = tgt.typeId;
        pushLog(`夺下了 ${tgt.name}！`);
      }
    } else {
      const lost = Math.round(att.crew * 0.3);
      att.crew = Math.max(1, att.crew - lost);
      pushLog(`接舷失败，${att.name} 折损 ${lost} 人。`);
    }
    att.acted = true; att.moved = true;
    renderUI(); endUnitTurn();
  };
  if (isFlag) {
    startDuel({
      foeName: tgt.name + ' 船长',
      foeHp: 60 + tgt.crew * 0.2,
      onEnd: (won) => { resolve(won ? 0.6 : -0.3); },
    });
    return { ok: true, deferred: true };
  }
  resolve();
  return { ok: true };
}

function pushLog(m) { B.log.unshift(m); if (B.log.length > 6) B.log.length = 6; }

// ===== 敌方 AI =====
function aiTurn(u) {
  const foes = B.units.filter(x => x.side === 'p' && x.alive && !x.fled);
  if (!foes.length) return endUnitTurn();
  const tgt = foes.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b));

  // 商船是猎物不是对手：被打残或死伤过半就投降（战斗立即结束，货归你）
  if (B.enc.kind === 'merchant' && (u.hull < u.hullMax * 0.45 || u.crew < u.crewMax * 0.35)) {
    u.alive = false; u.surrendered = true;
    B.captured = B.captured || u.typeId;
    pushLog(`${u.name} 降下了旗帜——他们投降了！`);
    renderUI();
    if (checkEnd()) return;
    return endUnitTurn();
  }

  // 商船优先逃向海图边缘，只在被咬住时还击
  if (B.enc.kind === 'merchant') {
    computeReach(u);
    let far = null, best = -1;
    for (const t of B.reach) {
      const d = Math.max(Math.abs(t.c - tgt.c), Math.abs(t.r - tgt.r));
      const edge = Math.min(t.c, COLS - 1 - t.c, t.r, ROWS - 1 - t.r);
      const score = d * 2 - edge;
      if (score > best) { best = score; far = t; }
    }
    if (far) { u.c = far.c; u.r = far.r; u.heading = far.dir ?? u.heading; }
    u.moved = true;
    if (dist(u, tgt) <= 3) { u.ammo = 'round'; fire(u, tgt); }
    u.acted = true;
    renderUI();
    return setTimeout(endUnitTurn, 220);
  }

  // 靠近到能舷侧开火的位置
  computeReach(u);
  let best = null, bestScore = -1e9;
  const cand = [{ c: u.c, r: u.r, dir: u.heading, cost: 0 }, ...B.reach];
  for (const t of cand) {
    const probe = { ...u, c: t.c, r: t.r, heading: t.dir ?? u.heading };
    const d = dist(probe, tgt);
    if (d > 4) continue;
    const score = facingMult(probe, tgt) * 10 - d * 1.2;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  if (best && (best.c !== u.c || best.r !== u.r)) {
    u.c = best.c; u.r = best.r; u.heading = best.dir ?? u.heading;
  }
  u.moved = true;

  const d = dist(u, tgt);
  if (d <= 1 && u.crew > tgt.crew * 1.35) {
    const res = board(u, tgt);
    if (res.deferred) return;
    return;
  }
  if (d <= 4) {
    // 血少时打船员准备接舷，否则打船体
    u.ammo = (tgt.crew < u.crew * 0.6) ? 'round' : (Math.random() < 0.35 ? 'grape' : 'round');
    fire(u, tgt);
  }
  u.acted = true;
  renderUI();
  setTimeout(endUnitTurn, 260);
}

// ===== 输入 =====
function toField(e) {
  const r = canvas.getBoundingClientRect();
  const scale = Math.min(r.width / FIELD_W, r.height / FIELD_H);
  const ox = (r.width - FIELD_W * scale) / 2, oy = (r.height - FIELD_H * scale) / 2;
  return { x: (e.clientX - r.left - ox) / scale, y: (e.clientY - r.top - oy) / scale };
}

function onTap(e) {
  const u = current();
  if (!B || !u || u.side !== 'p') return;
  const f = toField(e);
  const c = Math.floor(f.x / TILE), r = Math.floor(f.y / TILE);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
  const hit = occupied(c, r);

  if (mode === 'move' && !u.moved) {
    const t = B.reach.find(x => x.c === c && x.r === r);
    if (!t) return;
    u.c = c; u.r = r; u.heading = t.dir;
    u.moved = true; mode = 'idle';
    B.reach = [];
    renderUI();
    return;
  }
  if (mode === 'fire' && !u.acted) {
    if (!hit || hit.side !== 'e') return;
    const res = fire(u, hit);
    if (!res.ok) return;
    u.acted = true; mode = 'idle';
    renderUI();
    setTimeout(() => { if (B) endUnitTurn(); }, 320);
    return;
  }
  if (mode === 'board' && !u.acted) {
    if (!hit || hit.side !== 'e') return;
    const res = board(u, hit);
    if (!res.ok) return;
    if (!res.deferred) { renderUI(); }
    return;
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

function loop() {
  if (!B) return;
  draw();
  requestAnimationFrame(loop);
}

function draw() {
  const cw = canvas.width, ch = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const scale = Math.min(cw / FIELD_W, ch / FIELD_H);
  ctx.translate((cw - FIELD_W * scale) / 2, (ch - FIELD_H * scale) / 2);
  ctx.scale(scale, scale);

  // 海面
  const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  g.addColorStop(0, '#7fa8b8'); g.addColorStop(1, '#4f7b8e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * TILE, 0); ctx.lineTo(c * TILE, FIELD_H); ctx.stroke(); }
  for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * TILE); ctx.lineTo(FIELD_W, r * TILE); ctx.stroke(); }

  // 可达格
  if (mode === 'move') {
    for (const t of B.reach) {
      ctx.fillStyle = 'rgba(120,220,150,0.28)';
      ctx.fillRect(t.c * TILE + 3, t.r * TILE + 3, TILE - 6, TILE - 6);
    }
  }
  // 可射击目标
  if (mode === 'fire' || mode === 'board') {
    const u = current();
    for (const e of B.units.filter(x => x.side === 'e' && x.alive && !x.fled)) {
      const d = dist(u, e);
      const ok = mode === 'fire' ? d <= 4 : d <= 1;
      if (!ok) continue;
      ctx.strokeStyle = mode === 'fire' ? '#ffd34d' : '#ff7a5a';
      ctx.lineWidth = 3;
      ctx.strokeRect(e.c * TILE + 4, e.r * TILE + 4, TILE - 8, TILE - 8);
    }
  }

  for (const u of B.units) if (u.alive && !u.fled) drawShip(u);

  // 风向标
  drawWind();
}

function drawShip(u) {
  const x = u.c * TILE + TILE / 2, y = u.r * TILE + TILE / 2;
  const cur = current();
  ctx.save();
  ctx.translate(x, y);
  if (cur && cur.id === u.id) {
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, TILE * 0.42, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.save();
  ctx.rotate(dirAngle(u.heading) * Math.PI / 180);
  const col = u.side === 'p' ? '#2f5fa8' : '#8c2f22';
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(2, 4, 24, 12, 0, 0, Math.PI * 2); ctx.fill();
  // 船体
  ctx.fillStyle = col; ctx.strokeStyle = '#241f33'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -30); ctx.quadraticCurveTo(14, -6, 11, 20);
  ctx.lineTo(-11, 20); ctx.quadraticCurveTo(-14, -6, 0, -30);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 帆
  ctx.fillStyle = '#f2ead6';
  ctx.beginPath(); ctx.ellipse(0, -6, 9, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 12, 6, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  // 血条
  const w = 46, hp = Math.max(0, u.hull / u.hullMax);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-w / 2 - 1, -TILE * 0.46 - 1, w + 2, 7);
  ctx.fillStyle = u.side === 'p' ? '#4fd06a' : '#e0556f';
  ctx.fillRect(-w / 2, -TILE * 0.46, w * hp, 5);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px DM Sans, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`👥${Math.round(u.crew)}`, 0, TILE * 0.46);
  ctx.restore();
}

function drawWind() {
  ctx.save();
  ctx.translate(FIELD_W - 62, 62);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(20,30,40,0.45)';
  ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(B.wind.dir * Math.PI / 180);
  ctx.fillStyle = '#ffe9a8'; ctx.strokeStyle = '#241f33'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(9, 6); ctx.lineTo(0, 0); ctx.lineTo(-9, 6);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px DM Sans, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(B.wind.name, FIELD_W - 62, 118);
}

// ===== HTML 操作栏 =====
function renderUI() {
  if (!B) return;
  const u = current();
  const info = document.getElementById('binfo');
  const acts = document.getElementById('bactions');
  const mine = B.units.filter(x => x.side === 'p' && x.alive && !x.fled).length;
  const foes = B.units.filter(x => x.side === 'e' && x.alive && !x.fled).length;
  info.innerHTML = `<div class="brow"><b>第 ${B.turn} 回合</b> · 我方 ${mine} 艘 / 敌方 ${foes} 艘 · 🌬️ ${B.wind.name}</div>
    ${u ? `<div class="brow">当前：<b class="${u.side === 'p' ? 'me' : 'foe'}">${u.name}</b>
      ${u.side === 'p' ? `（移动力 ${movePoints(u)}${u.moved ? ' · 已移动' : ''}${u.acted ? ' · 已行动' : ''}）` : '（敌方行动中…）'}</div>` : ''}
    <div class="blog">${B.log.map(l => `<div>${l}</div>`).join('')}</div>`;

  if (!u || u.side !== 'p') { acts.innerHTML = ''; return; }
  const ammoBtns = Object.entries(AMMO).map(([k, a]) =>
    `<button class="bbtn ammo${u.ammo === k ? ' on' : ''}" data-ammo="${k}" title="${a.desc}">${a.icon}${a.name}</button>`).join('');
  acts.innerHTML = `
    <button class="bbtn${mode === 'move' ? ' on' : ''}" data-b="move" ${u.moved ? 'disabled' : ''}>🧭 移动</button>
    <button class="bbtn${mode === 'fire' ? ' on' : ''}" data-b="fire" ${u.acted ? 'disabled' : ''}>💥 炮击</button>
    <button class="bbtn${mode === 'board' ? ' on' : ''}" data-b="board" ${u.acted ? 'disabled' : ''}>🪝 接舷</button>
    <button class="bbtn" data-b="repair" ${u.acted ? 'disabled' : ''}>🔧 抢修</button>
    <button class="bbtn" data-b="flee">🏳️ 撤退</button>
    <button class="bbtn end" data-b="end">⏭️ 结束</button>
    <div class="ammo-row">${ammoBtns}</div>`;
  [...acts.querySelectorAll('[data-b]')].forEach(b => b.addEventListener('click', () => doBtn(b.dataset.b)));
  [...acts.querySelectorAll('[data-ammo]')].forEach(b => b.addEventListener('click', () => {
    current().ammo = b.dataset.ammo; renderUI();
  }));
}

function doBtn(a) {
  const u = current();
  if (!u || u.side !== 'p') return;
  if (a === 'move') { mode = mode === 'move' ? 'idle' : 'move'; computeReach(u); }
  else if (a === 'fire') mode = mode === 'fire' ? 'idle' : 'fire';
  else if (a === 'board') mode = mode === 'board' ? 'idle' : 'board';
  else if (a === 'repair') {
    u.hull = Math.min(u.hullMax, u.hull + 18 + u.crew * 0.05);
    pushLog(`${u.name} 抢修船体。`);
    u.acted = true; mode = 'idle'; renderUI(); return endUnitTurn();
  } else if (a === 'flee') {
    if (u.c <= 0 || u.c >= COLS - 1 || u.r <= 0 || u.r >= ROWS - 1) {
      u.fled = true; pushLog(`${u.name} 脱离战场。`);
      mode = 'idle'; renderUI(); return endUnitTurn();
    }
    pushLog('必须驶到海图边缘才能脱离。');
  } else if (a === 'end') { mode = 'idle'; return endUnitTurn(); }
  renderUI();
}
