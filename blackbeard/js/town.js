// 城镇小地图：按港口程序化生成街区，玩家可走动，点建筑进设施、点 NPC 对话。
// 布局由 portId 哈希决定 → 每个港口固定且各不相同，但无需手工摆 31 张图。
import { state } from './state.js';
import { PORT_BY_ID, NATIONS } from './data/ports.js';
import { STORY_NPCS, NPC_ARCHETYPES, archetypeLine } from './data/npcs.js';
import { GOOD_BY_ID } from './data/goods.js';
import { offersAt, isActive, isDone } from './quests.js';

const W = 1200, H = 700;
const FAC = {
  market: { icon: '🛒', name: '市场', color: '#b0894a' },
  tavern: { icon: '🍺', name: '酒馆', color: '#9c6b3f' },
  shipyard: { icon: '🔨', name: '造船厂', color: '#7a6a52' },
  governor: { icon: '🏛️', name: '总督府', color: '#9a8a5e' },
  church: { icon: '⛪', name: '医馆', color: '#8a8a94' },
};

let canvas, ctx, T = null, cb = {}, raf = 0;

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); };

export function openTown(portId, callbacks) {
  cb = callbacks || {};
  const port = PORT_BY_ID[portId];
  canvas = document.getElementById('tcanvas');
  ctx = canvas.getContext('2d');
  T = buildTown(port);
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onTap);
  loop();
}

export function closeTown() {
  cancelAnimationFrame(raf);
  if (canvas) {
    canvas.removeEventListener('pointerdown', onTap);
    window.removeEventListener('resize', resize);
  }
  T = null;
}

export function refreshTown() {
  if (T) T.npcs = placeNpcs(T.port, T.seed, T.buildings);
}

// 只读快照：当前城镇里的人与建筑（供 UI 提示与自动化测试使用）
export function townEntities() {
  if (!T) return null;
  return {
    npcs: T.npcs.map(n => ({ id: n.id, name: n.name, kind: n.kind, x: n.x, y: n.y })),
    buildings: T.buildings.map(b => ({ id: b.id, name: b.name, x: b.x, y: b.y, w: b.w, h: b.h })),
    player: { x: T.player.x, y: T.player.y },
  };
}

function buildTown(port) {
  const seed = hash(port.id);
  const buildings = [];
  const facs = port.facilities || [];
  facs.forEach((f, i) => {
    const row = i % 2;                       // 街道两侧交错排列
    const x = 285 + i * 172 + ((seed >> (i * 2)) % 26);
    const y = row === 0 ? 168 : 452;
    buildings.push({
      id: f, ...FAC[f], x, y, w: 148, h: 104,
      doorX: x + 74, doorY: row === 0 ? y + 104 + 22 : y - 22,
    });
  });
  return {
    port, seed, buildings,
    npcs: placeNpcs(port, seed, buildings),
    player: { x: 150, y: 352, tx: 150, ty: 352, face: 1, step: 0 },
    hint: '',
  };
}

function placeNpcs(port, seed, buildings) {
  const list = [];
  // ① 具名剧情 NPC
  for (const n of STORY_NPCS) {
    if (n.port !== port.id) continue;
    if (n.minChapter && state.chapter < n.minChapter) continue;
    if (n.requireFlag && !state.flags[n.requireFlag]) continue;
    list.push({ ...n, kind: 'story' });
  }
  // ② 通用原型：按港口规模放 2-4 个
  const count = Math.min(4, 2 + (port.size >> 1));
  for (let i = 0; i < count; i++) {
    const arch = NPC_ARCHETYPES[(seed + i * 7) % NPC_ARCHETYPES.length];
    list.push({
      ...arch, id: `${arch.id}_${port.id}_${i}`, kind: 'flavor', archId: arch.id,
      line: archetypeLine(arch, {
        seed: seed + i, portName: port.name,
        rumorPort: '哈瓦那', dangerPort: '波士顿',
        good: GOOD_BY_ID[port.produces[0]]?.name || '货物',
      }),
    });
  }
  // 放置：沿街道两侧的空位
  const spots = [
    [250, 352], [430, 330], [610, 372], [790, 330], [960, 360], [1080, 352],
    [360, 300], [540, 404], [720, 300], [890, 404],
  ];
  list.forEach((n, i) => {
    const s = spots[(i + (seed % 3)) % spots.length];
    n.x = s[0] + ((seed >> i) % 24) - 12;
    n.y = s[1] + ((seed >> (i + 3)) % 20) - 10;
    n.bob = (seed + i * 13) % 100 / 100;
  });
  return list;
}

// NPC 头顶标记：! 可接任务 / ? 剧情可推进
function npcMark(n) {
  if (n.kind !== 'story') return '';
  const q = questOfNpc(n.id);
  if (q && !isActive(q.id) && !isDone(q.id)) return '!';
  if (q && isActive(q.id)) return '?';
  return state.flags['talked_' + n.id] ? '' : '?';
}
function questOfNpc(npcId) {
  const acts = [];
  const n = STORY_NPCS.find(x => x.id === npcId);
  if (!n) return null;
  const scan = (node) => {
    if (!node) return;
    if (node.act?.type === 'quest') acts.push(node.act.id);
    (node.choices || []).forEach(c => { if (c.act?.type === 'quest') acts.push(c.act.id); if (c.next) scan(n.dialog[c.next]); });
  };
  Object.values(n.dialog).forEach(scan);
  return acts.length ? { id: acts[0] } : null;
}

// ===== 交互 =====
function toField(e) {
  const r = canvas.getBoundingClientRect();
  const s = Math.min(r.width / W, r.height / H);
  return { x: (e.clientX - r.left - (r.width - W * s) / 2) / s, y: (e.clientY - r.top - (r.height - H * s) / 2) / s };
}

function onTap(e) {
  if (!T) return;
  const p = toField(e);
  // 命中 NPC
  for (const n of T.npcs) {
    if (Math.hypot(n.x - p.x, n.y - p.y) < 34) {
      T.player.tx = n.x; T.player.ty = n.y + 40;
      T.pending = { type: 'npc', n };
      return;
    }
  }
  // 命中建筑
  for (const b of T.buildings) {
    if (p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h) {
      T.player.tx = b.doorX; T.player.ty = b.doorY;
      T.pending = { type: 'fac', b };
      return;
    }
  }
  // 空地：走过去
  T.player.tx = Math.max(60, Math.min(W - 60, p.x));
  T.player.ty = Math.max(120, Math.min(H - 60, p.y));
  T.pending = null;
}

function update(dt) {
  const P = T.player;
  const dx = P.tx - P.x, dy = P.ty - P.y;
  const d = Math.hypot(dx, dy);
  if (d > 2) {
    const sp = 260 * dt;
    P.x += dx / d * Math.min(sp, d);
    P.y += dy / d * Math.min(sp, d);
    P.face = dx >= 0 ? 1 : -1;
    P.step += dt * 9;
  } else if (T.pending) {
    const pend = T.pending; T.pending = null;
    if (pend.type === 'npc') cb.onNpc && cb.onNpc(pend.n);
    else if (pend.type === 'fac') cb.onFacility && cb.onFacility(pend.b.id);
  }
  // 提示
  T.hint = '';
  for (const b of T.buildings) {
    if (Math.hypot(b.doorX - P.x, b.doorY - P.y) < 60) T.hint = `${b.icon} ${b.name}`;
  }
  for (const n of T.npcs) {
    if (Math.hypot(n.x - P.x, n.y - P.y) < 55) T.hint = `💬 ${n.name}`;
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

let last = 0;
function loop(ts = 0) {
  if (!T) return;
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts;
  update(dt);
  draw(ts / 1000);
  raf = requestAnimationFrame(loop);
}

function draw(t) {
  const cw = canvas.width, ch = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const s = Math.min(cw / W, ch / H);
  ctx.translate((cw - W * s) / 2, (ch - H * s) / 2);
  ctx.scale(s, s);

  // 地面
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#d9c89a'); g.addColorStop(1, '#c9b586');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // 海与码头
  ctx.fillStyle = '#8fb4c4';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(112, 0);
  for (let y = 0; y <= H; y += 24) ctx.lineTo(112 + Math.sin(y / 40 + t) * 6, y);
  ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8a6f45';
  ctx.fillRect(108, 300, 96, 104);                       // 栈桥
  for (let i = 0; i < 5; i++) ctx.fillRect(112 + i * 20, 300, 3, 104);
  // 停泊的自家船
  drawMoored(60, 250);

  // 街道
  ctx.fillStyle = '#bda878';
  ctx.fillRect(180, 296, W - 220, 92);
  ctx.strokeStyle = 'rgba(90,70,40,.25)'; ctx.lineWidth = 2;
  for (let x = 200; x < W - 40; x += 34) {
    ctx.beginPath(); ctx.moveTo(x, 296); ctx.lineTo(x - 10, 388); ctx.stroke();
  }

  // 建筑
  for (const b of T.buildings) drawBuilding(b);

  // NPC 与玩家按 y 排序
  const ents = [...T.npcs.map(n => ({ y: n.y, f: () => drawNpc(n, t) })), { y: T.player.y, f: () => drawPlayer(T.player) }];
  ents.sort((a, b) => a.y - b.y).forEach(e => e.f());

  // 提示条
  if (T.hint) {
    ctx.fillStyle = 'rgba(30,24,15,.82)';
    const w = 30 + T.hint.length * 15;
    ctx.fillRect(W / 2 - w / 2, H - 52, w, 34);
    ctx.fillStyle = '#f0e2bd'; ctx.font = 'bold 17px "Noto Serif SC", serif'; ctx.textAlign = 'center';
    ctx.fillText(T.hint, W / 2, H - 29);
  }
}

function drawMoored(x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#6b4a2e'; ctx.strokeStyle = '#3a2f1c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(0, 16, 26, 0); ctx.lineTo(20, -10); ctx.lineTo(-20, -10); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -62); ctx.stroke();
  ctx.fillStyle = '#f2ead6';
  ctx.beginPath(); ctx.ellipse(0, -36, 13, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawBuilding(b) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  ctx.fillRect(b.x + 6, b.y + b.h - 6, b.w, 12);
  // 墙
  ctx.fillStyle = '#efe3c4'; ctx.strokeStyle = '#5c4a2e'; ctx.lineWidth = 2.5;
  ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeRect(b.x, b.y, b.w, b.h);
  // 屋顶
  ctx.fillStyle = b.color;
  ctx.beginPath(); ctx.moveTo(b.x - 12, b.y); ctx.lineTo(b.x + b.w + 12, b.y);
  ctx.lineTo(b.x + b.w - 14, b.y - 32); ctx.lineTo(b.x + 14, b.y - 32); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 门窗
  ctx.fillStyle = '#4a3a24';
  ctx.fillRect(b.x + b.w / 2 - 17, b.y + b.h - 44, 34, 44);
  ctx.fillStyle = '#a8c4cf';
  ctx.fillRect(b.x + 18, b.y + 22, 26, 24); ctx.fillRect(b.x + b.w - 44, b.y + 22, 26, 24);
  ctx.strokeRect(b.x + 18, b.y + 22, 26, 24); ctx.strokeRect(b.x + b.w - 44, b.y + 22, 26, 24);
  // 招牌
  ctx.fillStyle = '#3a2f1c';
  ctx.font = '26px serif'; ctx.textAlign = 'center';
  ctx.fillText(b.icon, b.x + b.w / 2, b.y - 8);
  ctx.font = 'bold 15px "Noto Serif SC", serif';
  ctx.fillStyle = '#f3e7c8'; ctx.strokeStyle = '#3a2f1c'; ctx.lineWidth = 3;
  ctx.strokeText(b.name, b.x + b.w / 2, b.y + b.h + 20);
  ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h + 20);
  ctx.restore();
}

function figure(x, y, coat, hat, face, step, scale = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(face * scale, scale);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(0, 2, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  const sw = Math.sin(step) * 4;
  ctx.strokeStyle = '#3a2f1c'; ctx.lineWidth = 2; ctx.fillStyle = '#3f3524';
  ctx.fillRect(-6 + sw * 0.4, -14, 5, 14); ctx.fillRect(2 - sw * 0.4, -14, 5, 14);
  ctx.fillStyle = coat;
  ctx.beginPath(); ctx.moveTo(-10, -14); ctx.lineTo(-8, -40); ctx.lineTo(8, -40); ctx.lineTo(10, -14); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f1c79f';
  ctx.beginPath(); ctx.arc(0, -47, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (hat) {
    ctx.fillStyle = '#2b2419';
    ctx.beginPath(); ctx.ellipse(0, -53, 15, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -58, 8, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawNpc(n, t) {
  const bob = Math.sin(t * 1.6 + n.bob * 6) * 1.5;
  figure(n.x, n.y + bob, n.look?.coat || '#7a6a4a', !!n.look?.hat, 1, 0, 0.95);
  // 名牌
  ctx.font = '13px "Noto Serif SC", serif'; ctx.textAlign = 'center';
  ctx.strokeStyle = '#f3e7c8'; ctx.lineWidth = 3; ctx.fillStyle = '#3a2f1c';
  ctx.strokeText(n.name, n.x, n.y + 20); ctx.fillText(n.name, n.x, n.y + 20);
  const mk = npcMark(n);
  if (mk) {
    ctx.font = 'bold 26px serif';
    ctx.fillStyle = mk === '!' ? '#d8a01a' : '#8c2f22';
    ctx.strokeStyle = '#f3e7c8'; ctx.lineWidth = 4;
    ctx.strokeText(mk, n.x, n.y - 66 + Math.sin(t * 3) * 3);
    ctx.fillText(mk, n.x, n.y - 66 + Math.sin(t * 3) * 3);
  }
}

function drawPlayer(P) {
  figure(P.x, P.y, '#2f3a5c', true, P.face, P.step, 1.05);
  ctx.font = '13px "Noto Serif SC", serif'; ctx.textAlign = 'center';
  ctx.strokeStyle = '#f3e7c8'; ctx.lineWidth = 3; ctx.fillStyle = '#8c2f22';
  ctx.strokeText('蒂奇', P.x, P.y + 20); ctx.fillText('蒂奇', P.x, P.y + 20);
}
