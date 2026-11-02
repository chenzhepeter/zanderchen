import { WORLD as W, SIDES, SIDE_NAMES, ANGLES, DEFENDERS, BUGS } from './data/config.js';
import { SLOTS, wallSegments, ROCKS, canUseSlot } from './battlefield.js';
import { occupied } from './economy.js';
import { clamp } from './geometry.js';
import { drawBugModel, drawWeaponModel, drawEffectModel } from './art.js';

const TAU = Math.PI * 2;
function line(ctx, x1, y1, x2, y2, color, width = 0.1) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function circle(ctx, x, y, r, fill, stroke = null, width = 0.1) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); } }
function rect(ctx, x, y, w, h, fill, stroke = null) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.12; ctx.strokeRect(x, y, w, h); } }
function text(ctx, content, x, y, size = 1, color = '#dddcc1', align = 'center') { ctx.font = `500 ${size}px "SFMono-Regular", "PingFang SC", monospace`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(content, x, y); }
function makeTerrain() {
  const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 1080;
  const ctx = canvas.getContext('2d'); ctx.scale(12, 12);
  let seed = 42; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  rect(ctx, 0, 0, 120, 90, '#827451');
  for (let i = 0; i < 34; i++) { const y = i * 3; ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= 120; x += 3) ctx.lineTo(x, y + Math.sin(x * 0.075 + i * 0.8) * 2); ctx.strokeStyle = i % 2 ? '#ddd0a019' : '#333e301c'; ctx.lineWidth = 0.25; ctx.stroke(); }
  for (let i = 0; i < 110; i++) {
    const x = random() * 120, y = random() * 90, r = 4 + random() * 20;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, i % 2 ? '#a2956826' : '#403f2b26'); grad.addColorStop(1, '#82745100'); circle(ctx, x, y, r, grad);
  }
  for (let i = 0; i < 8000; i++) { const x = random() * 120, y = random() * 90; ctx.globalAlpha = 0.08 + random() * 0.12; rect(ctx, x, y, 0.05 + random() * 0.18, 0.04 + random() * 0.1, i % 2 ? '#e1cc8c' : '#242f21'); }
  ctx.globalAlpha = 1;
  for (let y = 6; y < 90; y += 6) line(ctx, 0, y, 120, y, '#eee0a507', 0.06);
  for (let x = 6; x < 120; x += 6) line(ctx, x, 0, x, 90, '#eee0a507', 0.06);
  for (let i = 0; i < 24; i++) {
    const side = i % 4;
    const x = side === 0 ? 20 + random() * 12 : side === 1 ? 88 + random() * 13 : random() * 120;
    const y = side === 0 || side === 1 ? 10 + random() * 70 : side === 2 ? 7 + random() * 9 : 75 + random() * 9;
    ctx.save(); ctx.translate(x, y); ctx.rotate(random() * TAU); ctx.scale(0.5 + random() * 1.6, 0.5 + random());
    ctx.beginPath(); ctx.moveTo(-1.5, -1); ctx.lineTo(0.6, -1.4); ctx.lineTo(1.7, -0.2); ctx.lineTo(1, 1.1); ctx.lineTo(-1, 1); ctx.closePath(); ctx.fillStyle = '#55583d'; ctx.fill(); line(ctx, -1.5, -1, 0.6, -1.4, '#a7a17b', 0.2); ctx.restore();
  }
  // 接近区的旧车辙、沙袋和枯草，不参与碰撞。
  ctx.setLineDash([0.5, 0.7]);
  for (const x of [48, 50, 70, 72]) line(ctx, x, 66, x + 1, 88, '#493f2e36', 0.14);
  ctx.setLineDash([]);
  for (const rock of ROCKS) {
    const { x, y, r } = rock;
    ctx.save(); ctx.translate(x, y); ctx.scale(r, r);
    ctx.fillStyle = '#28302555'; ctx.beginPath(); ctx.ellipse(0.6, 0.55, 1.2, 0.75, 0, 0, TAU); ctx.fill();
    const stone = ctx.createLinearGradient(-1, -1, 1, 1); stone.addColorStop(0, '#b3ac8b'); stone.addColorStop(0.45, '#777c60'); stone.addColorStop(1, '#3f503e');
    ctx.beginPath(); ctx.moveTo(-1, -0.3); ctx.lineTo(-0.5, -0.85); ctx.lineTo(0.4, -0.7); ctx.lineTo(1, 0.1); ctx.lineTo(0.55, 0.7); ctx.lineTo(-0.65, 0.6); ctx.closePath(); ctx.fillStyle = stone; ctx.fill();
    line(ctx, -0.5, -0.85, 0.2, 0, '#d4cbaa66', 0.05); line(ctx, 0.2, 0, 1, 0.1, '#364d3366', 0.08); ctx.restore();
  }
  return canvas;
}

export class Renderer {
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.terrain = makeTerrain(); this.view = { scale: 1, ox: 0, oy: 0 }; this.zoom = 1.15; this.camera = { x: 60, y: 45 }; this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; this.resize(); }
  resize() {
    const box = this.canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, box.width); this.height = Math.max(1, box.height); this.dpr = dpr;
    this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr);
    this.updateView();
  }
  updateView() {
    const scale = Math.min(this.width / 120, this.height / 90) * this.zoom;
    const halfW = this.width / (2 * scale), halfH = this.height / (2 * scale);
    this.camera.x = halfW >= 60 ? 60 : clamp(this.camera.x, halfW, 120 - halfW);
    this.camera.y = halfH >= 45 ? 45 : clamp(this.camera.y, halfH, 90 - halfH);
    this.view = { scale, ox: this.width / 2 - this.camera.x * scale, oy: this.height / 2 - this.camera.y * scale };
  }
  setZoom(value) { this.zoom = clamp(value, 1, 2.5); if (this.zoom === 1) this.camera = { x: 60, y: 45 }; this.updateView(); }
  pan(dx, dy) { this.camera.x -= dx / this.view.scale; this.camera.y -= dy / this.view.scale; this.updateView(); }
  toWorld(clientX, clientY) { const box = this.canvas.getBoundingClientRect(); return { x: (clientX - box.left - this.view.ox) / this.view.scale, y: (clientY - box.top - this.view.oy) / this.view.scale }; }
  draw(state, ui, seconds) {
    const ctx = this.ctx, v = this.view;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, this.width, this.height);
    ctx.drawImage(this.terrain, 0, 0, this.width, this.height);
    ctx.save(); const shake = this.reducedMotion ? 0 : (state.shake || 0) * 2.8; ctx.translate(v.ox + Math.sin(seconds * 79) * shake, v.oy + Math.cos(seconds * 91) * shake); ctx.scale(v.scale, v.scale);
    ctx.beginPath(); ctx.rect(0, 0, 120, 90); ctx.clip(); ctx.drawImage(this.terrain, 0, 0, 120, 90);
    this.drawApproaches(ctx, state, seconds); this.drawBase(ctx, state, seconds);
    for (const e of state.effects) if (e.type === 'scorch') drawEffectModel(ctx, e);
    for (const e of state.effects) if (e.type === 'corpse') this.drawBug(ctx, { type: e.bug, x: e.x, y: e.y, angle: e.angle, walk: 0, hp: 1 }, 0, clamp(e.life / 3, 0, 0.4));
    this.drawSlots(ctx, state, ui, seconds);

    const selected = ui.selection?.kind === 'unit' ? state.defenders.find(u => u.id === ui.selection.id && u.hp > 0) : null;
    if (selected) this.drawRange(ctx, selected);
    if (ui.showRanges) for (const u of state.defenders) if (u.hp > 0 && u !== selected) this.drawRange(ctx, u, true);
    if (ui.pending?.mode === 'buy' && ui.hoverSlot) { const cfg = DEFENDERS[ui.pending.type]; if (cfg.range) this.drawRange(ctx, { ...ui.hoverSlot, type: ui.pending.type, side: ui.hoverSlot.side }); }
    for (const u of state.defenders) if (u.hp > 0) this.drawDefender(ctx, u, selected === u, seconds);
    for (const e of state.enemies) if (!BUGS[e.type].air) this.drawBug(ctx, e, seconds);
    for (const e of state.enemies) if (BUGS[e.type].air) this.drawBug(ctx, e, seconds);
    this.drawProjectiles(ctx, state); this.drawEffects(ctx, state);
    if (ui.pending?.mode === 'bomb') this.drawBombAim(ctx, state, ui.pointerWorld || { x: 60, y: 19 }, seconds);
    if (state.focusId) { const e = state.enemies.find(e => e.id === state.focusId); if (e) { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(seconds * 0.5); for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); line(ctx, -1.7, -2.2, -2.2, -2.2, '#f1b87b', 0.18); line(ctx, -2.2, -2.2, -2.2, -1.7, '#f1b87b', 0.18); } ctx.restore(); } }
    if (state.phase === 'resupply' || state.phase === 'victory') this.drawTransport(ctx, seconds);
    ctx.restore();
    // 轻微边缘阴影，保持地图中央和部署位明亮。
    const shade = ctx.createRadialGradient(this.width / 2, this.height / 2, this.height * 0.28, this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.7);
    shade.addColorStop(0, '#10180c00'); shade.addColorStop(1, '#10180c42'); ctx.fillStyle = shade; ctx.fillRect(0, 0, this.width, this.height);
  }
  drawApproaches(ctx, state, seconds) {
    const labels = [{ side: 'north', x: 60, y: 10 }, { side: 'south', x: 60, y: 78 }, { side: 'west', x: 17, y: 45 }, { side: 'east', x: 103, y: 45 }];
    for (const p of labels) {
      const count = state.enemies.filter(e => e.side === p.side).length;
      const danger = count > 0;
      ctx.save(); ctx.translate(p.x, p.y);
      text(ctx, `${SIDE_NAMES[p.side]} / ${p.side.toUpperCase()}`, 0, 0, 0.9, danger ? '#f3d6a1' : '#eee4c0a0');
      if (danger) text(ctx, `${count} 接近中`, 0, 1.9, 0.9, '#ecd29c');
      ctx.translate(0, p.side === 'south' ? -3.5 : p.side === 'north' ? 3.5 : 0);
      if (p.side === 'west') ctx.translate(7, 0); if (p.side === 'east') ctx.translate(-7, 0);
      ctx.rotate(ANGLES[p.side] + Math.PI / 2);
      for (let i = 0; i < 2; i++) { const alpha = danger ? 0.4 + Math.sin(seconds * 3 - i) * 0.15 : 0.15; line(ctx, -0.7, 0.3 + i * 0.7, 0, 1 + i * 0.7, `rgba(238,216,154,${alpha})`, 0.15); line(ctx, 0, 1 + i * 0.7, 0.7, 0.3 + i * 0.7, `rgba(238,216,154,${alpha})`, 0.15); }
      ctx.restore();
    }
  }
  drawBase(ctx, state, seconds) {
    rect(ctx, 39.2, 29.6, 44, 34, '#14201788'); const floor = ctx.createLinearGradient(38, 28, 82, 62); floor.addColorStop(0, '#929987'); floor.addColorStop(1, '#68745f'); rect(ctx, 38, 28, 44, 34, floor);
    for (let x = 40; x < 82; x += 4) line(ctx, x, 29, x, 61, '#454e3718', 0.09);
    for (let y = 30; y < 62; y += 4) line(ctx, 39, y, 81, y, '#454e3718', 0.09);
    ctx.setLineDash([0.65, 0.55]); ctx.strokeStyle = '#d5d0a65c'; ctx.lineWidth = 0.13; ctx.strokeRect(43, 33, 34, 24); ctx.setLineDash([]);
    circle(ctx, 70.8, 45, 4.6, '#737c6735', '#d5d6b56b', 0.15); text(ctx, 'H', 70.8, 45, 3.7, '#c8cbaa85');
    for (const p of [{ x: 48, y: 49.5 }, { x: 49, y: 40.5 }, { x: 68, y: 55.8 }, { x: 51, y: 55.8 }]) { rect(ctx, p.x, p.y, 2, 1.3, '#5a674f', '#b3b69b66'); line(ctx, p.x + 0.3, p.y, p.x + 0.3, p.y + 1.3, '#394831', 0.15); }
    // 围墙、基座与中央通讯建筑。
    for (const s of wallSegments(state.walls)) {
      line(ctx, s.x1 + 0.65, s.y1 + 1.0, s.x2 + 0.65, s.y2 + 1.0, '#1f2c2288', 3.1);
      line(ctx, s.x1, s.y1, s.x2, s.y2, '#3c4c3c', 2.5); line(ctx, s.x1 - 0.1, s.y1 - 0.35, s.x2 - 0.1, s.y2 - 0.35, state.walls[s.side].hit > 0 ? '#e0b97b' : '#a8ad93', 1.7);
      const length = Math.hypot(s.x2 - s.x1, s.y2 - s.y1); for (let d = 1; d < length; d += 3) { const x = s.x1 + (s.x2 - s.x1) * d / length, y = s.y1 + (s.y2 - s.y1) * d / length; circle(ctx, x - 0.2, y - 0.5, 0.1, '#e1dbb5'); line(ctx, x - 0.3, y - 0.7, x + 0.3, y + 0.2, '#58624a', 0.08); }
      line(ctx, s.x1, s.y1 - 0.15, s.x2, s.y2 - 0.15, '#d8d7b7', 0.12);
    }
    for (const side of SIDES) {
      const wall = state.walls[side];
      const p = { north: [60, 26], south: [60, 64], east: [84, 45], west: [36, 45] }[side];
      if (wall.hp > 0 && wall.hp < wall.maxHp * 0.35) { for (let i = 0; i < 3; i++) { const x = p[0] + (i - 1) * 1.4, y = p[1] - (seconds * 0.35 + i * 0.6) % 2; circle(ctx, x, y, 0.6 + Math.sin(seconds + i) * 0.1, '#31372a55'); } }
      if (!wall.hp) { for (let i = 0; i < 7; i++) rect(ctx, p[0] - 2 + (i * 1.1) % 4, p[1] - 1 + (i * 0.7) % 2, 0.7, 0.5, i % 2 ? '#5e6149' : '#a39a76'); text(ctx, '缺口', p[0], p[1], 0.8, '#f4bf84'); }
      else { const horizontal = side === 'north' || side === 'south'; const len = 5, value = wall.hp / wall.maxHp; if (horizontal) { rect(ctx, p[0] - len / 2, p[1], len, 0.25, '#393e2e'); rect(ctx, p[0] - len / 2, p[1], len * value, 0.25, value > 0.3 ? '#becb91' : '#e1a76d'); } }
    }
    for (const x of [38, 82]) for (const y of [28, 62]) { rect(ctx, x - 1.3, y - 1.3, 2.6, 2.6, '#606c55', '#c0c1a0'); rect(ctx, x - 0.8, y - 0.8, 1.6, 1.6, '#858d74'); }
    rect(ctx, 55.5, 40.7, 10, 10, '#3f4937aa'); rect(ctx, 55, 40, 10, 10, state.core.hit > 0 ? '#82765b' : '#56654c', '#d2cda25c');
    rect(ctx, 55.7, 40.7, 8.6, 5.5, '#6e7f61'); for (let x = 56; x < 64; x += 0.8) line(ctx, x, 41, x, 45.8, '#46594166', 0.15);
    rect(ctx, 57.4, 47.3, 5.2, 1.5, '#32442e', '#8a9e7577'); rect(ctx, 55, 48.8, 1.6, 0.7, '#c0a75b'); rect(ctx, 63.4, 48.8, 1.6, 0.7, '#c0a75b');
    text(ctx, 'COMMS 07', 60, 44.3, 0.75, '#e0e0bf'); text(ctx, '指挥中心', 60, 51.4, 0.85, '#263e27');
    circle(ctx, 62.9, 42.1, 0.7, '#d1d0ac', '#526147'); line(ctx, 62.9, 42.1, 63.4, 40.4, '#d9d5b9', 0.13);
    const hp = state.core.hp / state.core.maxHp; rect(ctx, 56, 52.5, 8, 0.3, '#46543c'); rect(ctx, 56, 52.5, 8 * hp, 0.3, hp > 0.3 ? '#d3d7a0' : '#f1a56b');
  }
  drawSlots(ctx, state, ui, seconds) {
    for (const slot of SLOTS) {
      const pending = ui.pending;
      const cfg = pending?.mode === 'buy' ? DEFENDERS[pending.type] : pending?.mode === 'move' ? DEFENDERS[state.defenders.find(u => u.id === pending.id)?.type] : null;
      const active = cfg && !(pending?.mode==='move' && state.defenders.find(u=>u.id===pending.id)?.slotId===slot.id) && cfg.slot === slot.kind && !occupied(state, slot.id, pending.id) && canUseSlot(state,slot);
      if (occupied(state, slot.id) && !active) continue;
      const color = active ? '#e8ce85' : '#2c432a77';
      if (slot.kind === 'cannon') { circle(ctx,slot.x,slot.y,1.5,active?'#d1b56a20':null,color,active?0.2:0.12); circle(ctx,slot.x,slot.y,1.1,null,color,0.08); }
      else if (slot.kind === 'heavy') { ctx.strokeStyle = color; ctx.lineWidth = active ? 0.2 : 0.12; ctx.setLineDash(active ? [] : [0.3, 0.3]); ctx.strokeRect(slot.x - 1.2, slot.y - 1.2, 2.4, 2.4); ctx.setLineDash([]); }
      else { circle(ctx, slot.x, slot.y, slot.kind === 'air' ? 1.5 : 1, active ? '#d1b56a18' : null, color, active ? 0.2 : 0.12); }
      if (active) { text(ctx, slot.kind==='cannon'?'炮':'+', slot.x, slot.y, 1.2, color); if (ui.hoverSlot?.id === slot.id) circle(ctx, slot.x, slot.y, 2 + Math.sin(seconds * 4) * 0.15, null, '#ffe0a2', 0.15); }
    }
  }
  drawRange(ctx, unit, faint = false) {
    const cfg = DEFENDERS[unit.type]; if (!cfg.range) return;
    const base = unit.type==='flamethrower' ? unit.angle ?? ANGLES[unit.side] ?? 0 : ANGLES[unit.side] ?? 0, arc=cfg.flameArc || cfg.arc;
    ctx.save(); ctx.beginPath(); ctx.moveTo(unit.x, unit.y); ctx.arc(unit.x, unit.y, cfg.range, base - arc / 2, base + arc / 2); ctx.closePath(); ctx.fillStyle = faint ? '#e7d78a07' : '#e7d78a11'; ctx.fill(); ctx.strokeStyle = faint ? '#e2d09c25' : '#e2d09c88'; ctx.lineWidth = 0.13; ctx.setLineDash([0.5, 0.5]); ctx.stroke(); ctx.restore();
  }
  drawDefender(ctx, u, selected, seconds) {
    if (selected) { circle(ctx, u.x, u.y, 2.2, '#e0c87812', '#efd69b', 0.16); if (u.path.length) { ctx.save(); ctx.setLineDash([0.5, 0.5]); ctx.strokeStyle = '#e9d58d'; ctx.lineWidth = 0.15; ctx.beginPath(); ctx.moveTo(u.x, u.y); for (const p of u.path) ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.restore(); } }
    drawWeaponModel(ctx, u, seconds);
    if(u.level>1)text(ctx,['I','II','III'][u.level-1],u.x,u.y+2.7,0.7,'#f4d99b');
    if (u.hp < u.maxHp || selected) { rect(ctx, u.x - 1.6, u.y + 2, 3.2, 0.25, '#213220'); rect(ctx, u.x - 1.6, u.y + 2, 3.2 * u.hp / u.maxHp, 0.25, u.hp > u.maxHp * 0.3 ? '#d4d5a0' : '#e9a578'); }
    if (u.hit > 0) circle(ctx, u.x, u.y, 1.4, '#e6b47c44');
    if (['sam', 'cannon'].includes(u.type) && u.cooldown > 0) { ctx.beginPath(); ctx.arc(u.x, u.y, 1.8, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - u.cooldown / DEFENDERS[u.type].cooldown)); ctx.strokeStyle = '#e2cca181'; ctx.lineWidth = 0.15; ctx.stroke(); }
  }
  drawBug(ctx, e, seconds, opacity = 1) { drawBugModel(ctx, e, seconds, opacity); }
  drawProjectiles(ctx, state) {
    for (const p of state.projectiles) {
      const k = Math.min(1, p.time / Math.max(0.01, p.duration)), height = p.kind === 'shell' || p.kind === 'bomb' ? Math.sin(k * Math.PI) * (p.kind === 'bomb' ? 8 : 5) : p.air || p.kind === 'missile' ? 1.1 : 0;
      const angle = Math.atan2(p.ty - p.y, p.tx - p.x);
      if (p.kind === 'bullet') {
        const dx = Math.cos(angle), dy = Math.sin(angle);
        line(ctx, p.x - dx * 2.7, p.y - dy * 2.7 - height, p.x, p.y - height, '#f3b95b80', 0.17);
        line(ctx, p.x - dx * 1.3, p.y - dy * 1.3 - height, p.x, p.y - height, '#fff0b9', 0.09);
      } else if (p.kind === 'missile') {
        const trail = p.trail || [];
        for (let i = 1; i < trail.length; i++) line(ctx, trail[i - 1].x, trail[i - 1].y - 1.1, trail[i].x, trail[i].y - 1.1, `rgba(222,222,195,${i / trail.length * 0.6})`, 0.15 + (1 - i / trail.length) * 0.25);
        ctx.save(); ctx.translate(p.x, p.y - height); ctx.rotate(angle); rect(ctx, -0.5, -0.12, 0.8, 0.24, '#d7e1c9'); circle(ctx, -0.6, 0, 0.35, '#ffe7a6'); ctx.restore();
      } else {
        circle(ctx, p.x + 0.3, p.y + 0.4, 0.35, '#1c2b2566');
        const trail = p.trail || [];
        for (let i = 0; i < trail.length; i++) { const oldK = Math.max(0, k - (trail.length - i) / 60 / p.duration), oldH = Math.sin(oldK * Math.PI) * (p.kind === 'bomb' ? 8 : 5); circle(ctx, trail[i].x, trail[i].y - oldH, 0.09 + i * 0.013, p.kind === 'bomb' ? '#f3bf7377' : '#efd1a777'); }
        ctx.save(); ctx.translate(p.x, p.y - height); ctx.rotate(p.time * (p.kind === 'bomb' ? 9 : 3));
        if (p.kind === 'bomb') { circle(ctx, 0, 0, 0.44, '#253329', '#c6b480', 0.1); rect(ctx, -0.12, -0.45, 0.24, 0.2, '#c2b18a'); circle(ctx, 0.12, -0.55, 0.13, '#ffe8a4'); }
        else { circle(ctx, 0, 0, 0.26, '#ffefb0', '#896a32', 0.07); }
        ctx.restore();
      }
    }
  }
  drawBombAim(ctx, state, target, seconds) {
    const cfg = DEFENDERS.bomb, valid = state.bombs > 0 && state.bombCooldown <= 0 && target.x >= 0 && target.x <= 120 && target.y >= 0 && target.y <= 90 && Math.hypot(target.x - 60, target.y - 45) <= cfg.range;
    const color = valid ? '#ffd08e' : '#d58b73';
    ctx.save(); ctx.setLineDash([0.5, 0.35]); ctx.lineDashOffset = -seconds * 2;
    circle(ctx, target.x, target.y, cfg.splash, valid ? '#eda54e22' : '#cf77551a', color, 0.16);
    const origin = state.defenders.filter(u => u.type === 'infantry' && u.hp > 0).sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0] || { x: 60, y: 45 };
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.quadraticCurveTo((origin.x + target.x) / 2, Math.min(origin.y, target.y) - 8, target.x, target.y); ctx.strokeStyle = color; ctx.lineWidth = 0.12; ctx.stroke(); ctx.setLineDash([]);
    line(ctx, target.x - 1, target.y, target.x + 1, target.y, color, 0.15); line(ctx, target.x, target.y - 1, target.x, target.y + 1, color, 0.15);
    text(ctx, '炸弹落点', target.x, target.y + cfg.splash + 1.4, 0.9, color); ctx.restore();
  }
  drawEffects(ctx, state) { for (const e of state.effects) if (!['corpse', 'scorch'].includes(e.type)) drawEffectModel(ctx, e); }
  drawTransport(ctx, seconds) {
    ctx.save(); ctx.translate(60, 44 + Math.sin(seconds * 1.7) * 0.4); circle(ctx, 0.8, 2.8, 4.5, '#24352133');
    rect(ctx, -7, -1, 14, 2, '#4e6654', '#a8b99b'); rect(ctx, -2.2, -4.5, 4.4, 9, '#829b7d', '#ccd0aa'); rect(ctx, -1.5, -4, 3, 2, '#344e45');
    for (const x of [-5, 5]) { rect(ctx, x - 1, -1.7, 2, 3.4, '#526b5b', '#adbfa2'); circle(ctx, x, 2, 0.65, '#ecd99e66'); }
    text(ctx, 'SUPPLY', 0, 0.4, 0.7, '#dae1bf'); ctx.restore();
  }
}
