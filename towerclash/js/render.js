// 2.5D 场景渲染：背景→地面→三路→建筑→单位(y排序)→投射物→特效
import { FIELD, LANES, SIDES } from './data/config.js';
import { drawUnit, drawBuilding } from './sprites.js';
import { spawnPoint } from './combat.js';

// 计算 letterbox 视图（虚拟 1280x720 → 画布）
export function makeView(canvas) {
  const cw = canvas.width, ch = canvas.height;
  const scale = Math.min(cw / FIELD.W, ch / FIELD.H);
  const offsetX = (cw - FIELD.W * scale) / 2;
  const offsetY = (ch - FIELD.H * scale) / 2;
  return { scale, offsetX, offsetY };
}

// 画布坐标 → 虚拟坐标
export function toVirtual(view, cx, cy) {
  return { x: (cx - view.offsetX) / view.scale, y: (cy - view.offsetY) / view.scale };
}

export function draw(ctx, state, view) {
  const { scale, offsetX, offsetY } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = '#10131c';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  // 裁剪到战场
  ctx.beginPath(); ctx.rect(0, 0, FIELD.W, FIELD.H); ctx.clip();

  drawBackground(ctx, state);
  drawLanes(ctx, state);
  drawSelection(ctx, state);

  // 建筑 + 单位统一按 y 排序，形成正确遮挡
  const drawables = [];
  for (const b of state.buildings) drawables.push({ y: b.y, kind: 'b', ref: b });
  for (const u of state.units) drawables.push({ y: u.type === 'mage' ? u.y + 40 : u.y, kind: 'u', ref: u });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) {
    if (d.kind === 'b') drawBuilding(ctx, d.ref, state);
    else drawUnit(ctx, d.ref);
  }

  drawProjectiles(ctx, state);
  drawEffects(ctx, state);

  ctx.restore();
}

function drawBackground(ctx, state) {
  // 天空
  const sky = ctx.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, '#a8d4e6');
  sky.addColorStop(1, '#cfe8c9');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, FIELD.W, 150);
  // 草地（近大远小：上深下浅）
  const grass = ctx.createLinearGradient(0, 130, 0, FIELD.H);
  grass.addColorStop(0, '#79a05a');
  grass.addColorStop(0.5, '#8fb868');
  grass.addColorStop(1, '#a3cf78');
  ctx.fillStyle = grass;
  ctx.fillRect(0, 130, FIELD.W, FIELD.H - 130);

  // 中线河流装饰
  const cx = FIELD.W / 2;
  ctx.fillStyle = 'rgba(90,150,200,0.35)';
  ctx.beginPath();
  ctx.moveTo(cx - 26, 140);
  ctx.quadraticCurveTo(cx + 20, FIELD.H / 2, cx - 18, FIELD.H);
  ctx.lineTo(cx + 22, FIELD.H);
  ctx.quadraticCurveTo(cx + 60, FIELD.H / 2, cx + 18, 140);
  ctx.closePath(); ctx.fill();

  // 双方基地平台
  for (const side of ['player', 'enemy']) {
    const s = SIDES[side];
    const x = side === 'player' ? 0 : FIELD.W - 180;
    const g = ctx.createLinearGradient(x, 0, x + 180, 0);
    const col = side === 'player' ? 'rgba(63,127,214,0.10)' : 'rgba(157,75,208,0.10)';
    g.addColorStop(side === 'player' ? 0 : 1, col);
    g.addColorStop(side === 'player' ? 1 : 0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x, 130, 180, FIELD.H - 130);
  }
}

function drawLanes(ctx, state) {
  for (const lane of LANES) {
    const w = 40 * lane.scale;
    const x0 = SIDES.player.towerX, x1 = SIDES.enemy.towerX;
    ctx.strokeStyle = 'rgba(120,90,60,0.55)';
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, lane.y + 18 * lane.scale);
    ctx.lineTo(x1, lane.y + 18 * lane.scale);
    ctx.stroke();
    // 路面亮边
    ctx.strokeStyle = 'rgba(160,130,90,0.4)';
    ctx.lineWidth = w * 0.55;
    ctx.beginPath();
    ctx.moveTo(x0, lane.y + 18 * lane.scale);
    ctx.lineTo(x1, lane.y + 18 * lane.scale);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function drawSelection(ctx, state) {
  const pulse = 0.5 + Math.sin(state.time * 4) * 0.2;
  // 高亮存活的玩家城楼（可点击）
  for (const b of state.buildings) {
    if (b.side !== 'player' || b.kind !== 'tower' || !b.alive) continue;
    if (b.lane === state.selectedLane) continue;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 6, 30, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // 出兵标记：画在当前有效出兵点（存活城楼；三城楼全毁时为主楼）
  const sp = spawnPoint(state, 'player', state.selectedLane);
  if (sp) {
    const ly = LANES[sp.lane].y;
    ctx.save();
    ctx.strokeStyle = `rgba(255,221,77,${pulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(sp.x, ly + 6, 30, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,221,77,${pulse})`;
    ctx.font = 'bold 16px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sp.fromKeep ? '▼ 主楼出兵' : '▼ 出兵', sp.x, ly - (sp.fromKeep ? 130 : 96));
    ctx.restore();
  }
}

function drawProjectiles(ctx, state) {
  for (const p of state.projectiles) {
    ctx.save();
    if (p.kind === 'orb') {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
      g.addColorStop(0, '#fff'); g.addColorStop(0.4, p.side === 'enemy' ? '#c79bff' : '#9cc4ff');
      g.addColorStop(1, 'rgba(140,110,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
    } else if (p.pierce) {
      ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.shadowColor = '#9fe8ff'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.sign(p.vx) * 16, p.y);
      ctx.stroke();
    } else {
      const a = p.angle || 0;
      ctx.translate(p.x, p.y); ctx.rotate(a);
      ctx.strokeStyle = p.kind === 'bolt' ? '#e8d28a' : '#6b4a2a';
      ctx.lineWidth = p.kind === 'bolt' ? 3 : 2;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = '#cfd6e0';
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(2, -2); ctx.lineTo(2, 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawEffects(ctx, state) {
  for (const e of state.effects) {
    const k = e.t / e.life; // 0→1
    ctx.save();
    if (e.type === 'hit') {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.big ? '#ffd34d' : '#fff';
      ctx.lineWidth = 2;
      const r = (e.big ? 14 : 8) * (0.5 + k);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * r * 0.4, e.y + Math.sin(a) * r * 0.4);
        ctx.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r);
        ctx.stroke();
      }
    } else if (e.type === 'boom') {
      ctx.globalAlpha = 1 - k;
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * (0.4 + k));
      g.addColorStop(0, 'rgba(200,160,255,0.8)');
      g.addColorStop(1, 'rgba(140,90,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.4 + k), 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'heal') {
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.strokeStyle = '#7CFF8A'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.3 + k * 0.7), 0, Math.PI * 2); ctx.stroke();
    } else if (e.type === 'spawn') {
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 18 * (0.3 + k), 7 * (0.3 + k), 0, 0, Math.PI * 2); ctx.stroke();
    } else if (e.type === 'text') {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = e.color;
      ctx.font = 'bold 15px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.text, e.x, e.y + (e.vy || -30) * k);
    }
    ctx.restore();
  }
}
