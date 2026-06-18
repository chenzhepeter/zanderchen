// 程序化矢量 sprite：兵种角色（行走/攻击/受击/死亡动画）+ 城楼/主楼
// 接口稳定：如需替换为 PNG 图集，只改这里的绘制实现即可。
import { LANES, SIDES } from './data/config.js';

// 调色板：人类阵营 vs 骷髅阵营
function palette(side, type) {
  if (side === 'enemy') {
    return { bone: '#e9e7db', dark: '#33304a', accent: '#a85fd6', glow: '#c79bff', plume: '#b06fe0', skel: true };
  }
  const base = { skin: '#f1c79f', dark: '#2d3340', skel: false };
  if (type === 'infantry') return { ...base, armor: '#7c8a98', accent: '#3f7fd6', cloth: '#3f7fd6' };
  if (type === 'archer') return { ...base, armor: '#6f7e8c', accent: '#7cc24a', cloth: '#54743f' };
  if (type === 'knight') return { ...base, armor: '#9aa3b0', accent: '#3f7fd6', plume: '#e0556f' };
  return { ...base, armor: '#3f5bd6', accent: '#7aa8ff', cloth: '#3247b8', glow: '#9cc4ff' };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const OUTLINE = '#241f33';

// ============ 单位 ============
const SIZE_MUL = { knight: 1.22, mage: 1.02, dog: 0.92, block: 1.05, cannon: 1.08, sniper: 1.0, catapult: 1.16 };

export function drawUnit(ctx, u) {
  const lane = LANES[u.lane];
  const sizeMul = SIZE_MUL[u.type] || 1.0;
  const sc = lane.scale * sizeMul;
  const pal = palette(u.side, u.type);
  const dead = u.state === 'dead';

  // 阴影
  ctx.save();
  ctx.globalAlpha = dead ? Math.max(0, 1 - u.deathT) * 0.35 : 0.32;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(u.x, u.y + 2, 16 * sc, 6 * sc, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 队伍颜色光环（敌我辨识）
  if (!dead) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = u.side === 'player' ? 'rgba(79,155,255,0.85)' : 'rgba(193,120,240,0.9)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + 3, 15 * sc, 5.5 * sc, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.scale(sc * (u.facing < 0 ? -1 : 1), sc);

  if (dead) {
    const k = Math.min(1, u.deathT / 1.0);
    ctx.globalAlpha = 1 - k;
    ctx.rotate((Math.PI / 2.2) * k);
    ctx.translate(0, 6 * k);
  }

  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';

  switch (u.type) {
    case 'mage': drawMage(ctx, u, pal); break;
    case 'dog': drawDog(ctx, u, pal); break;
    case 'block': drawBlock(ctx, u, pal); break;
    case 'cannon': drawCannon(ctx, u, pal); break;
    case 'sniper': drawSniper(ctx, u, pal); break;
    case 'catapult': drawCatapult(ctx, u, pal); break;
    default: drawWarrior(ctx, u, pal);
  }

  // 受击闪白
  if (u.hitFlash > 0) {
    ctx.globalAlpha = u.hitFlash * 0.6;
    ctx.fillStyle = '#fff';
    roundRect(ctx, -12, -42, 24, 44, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (!dead) drawHealthBar(ctx, u.x, u.y - 46 * sc, 26 * sc, u.hp / u.maxHp, u.side);
}

// 通用战士骨架（步兵/弓兵/骑士），武器随类型不同
function drawWarrior(ctx, u, pal) {
  const t = u.animTime;
  const moving = u.state === 'march';
  const ph = u.walkPhase;
  const swing = moving ? Math.sin(ph) : 0;
  const bob = moving ? Math.abs(Math.sin(ph)) * 2 : Math.sin(t * 2) * 0.6;
  const atk = u.attackAnim; // 1→0
  const skel = pal.skel;
  const limb = skel ? pal.bone : pal.armor;
  const skin = skel ? pal.bone : pal.skin;

  ctx.translate(0, -bob);

  // 腿
  ctx.strokeStyle = OUTLINE; ctx.fillStyle = skel ? pal.dark : '#3a4250';
  for (const s of [-1, 1]) {
    const off = s * swing * 5;
    ctx.save();
    ctx.translate(s * 4, -10);
    ctx.rotate(off * 0.06);
    roundRect(ctx, -3, 0, 6, 12, 3); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // 躯干
  ctx.fillStyle = limb;
  roundRect(ctx, -9, -30, 18, 22, 6); ctx.fill(); ctx.stroke();
  // 胸甲点缀
  ctx.fillStyle = pal.accent || pal.dark;
  roundRect(ctx, -6, -27, 12, 7, 3); ctx.fill();
  if (skel) { // 肋骨
    ctx.strokeStyle = pal.dark; ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-6, -25 + i * 4); ctx.lineTo(6, -25 + i * 4); ctx.stroke(); }
    ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE;
  }

  // 后臂
  ctx.fillStyle = limb;
  ctx.save(); ctx.translate(-7, -26); ctx.rotate(-0.3 - swing * 0.2);
  roundRect(ctx, -3, 0, 6, 13, 3); ctx.fill(); ctx.stroke(); ctx.restore();

  // 头
  drawHead(ctx, pal, skin, 0, -38);

  // 前臂 + 武器
  const armAng = -0.4 + swing * 0.2 - atk * 1.5;
  ctx.save();
  ctx.translate(7, -26);
  ctx.rotate(armAng);
  ctx.fillStyle = limb;
  roundRect(ctx, -3, 0, 6, 13, 3); ctx.fill(); ctx.stroke();
  // 手 / 武器挂在前臂末端
  ctx.translate(0, 12);
  if (u.type === 'archer') drawBow(ctx, pal, atk);
  else if (u.type === 'knight') drawGreatSword(ctx, pal, atk);
  else drawSwordShield(ctx, pal, atk);
  ctx.restore();

  // 骑士披风/盔缨在头顶
  if (u.type === 'knight') {
    ctx.fillStyle = pal.plume || '#e0556f';
    ctx.beginPath();
    ctx.moveTo(0, -46); ctx.quadraticCurveTo(6, -52, 2, -56);
    ctx.quadraticCurveTo(0, -50, -2, -46); ctx.fill();
  }
}

function drawHead(ctx, pal, skin, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = skin; ctx.strokeStyle = OUTLINE;
  ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (pal.skel) {
    // 眼窝 + 鼻
    ctx.fillStyle = pal.dark;
    ctx.beginPath(); ctx.arc(-2.4, -0.5, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2.4, -0.5, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(-1.2, 3); ctx.lineTo(1.2, 3); ctx.fill();
  } else {
    // 头盔顶檐
    ctx.fillStyle = pal.armor || '#7c8a98';
    ctx.beginPath(); ctx.arc(0, -1, 6.8, Math.PI, 0); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawSwordShield(ctx, pal, atk) {
  // 剑
  ctx.save();
  ctx.rotate(-0.2);
  ctx.strokeStyle = OUTLINE; ctx.fillStyle = '#dfe6ef';
  roundRect(ctx, -1.5, -16, 3, 16, 1.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.accent || '#8a6b3f';
  roundRect(ctx, -4, -1, 8, 3, 1); ctx.fill(); // 护手
  ctx.restore();
  // 圆盾（挂在手前）
  ctx.save(); ctx.translate(-6, 2);
  ctx.fillStyle = pal.accent || '#3f7fd6'; ctx.strokeStyle = OUTLINE;
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawGreatSword(ctx, pal, atk) {
  ctx.save();
  ctx.rotate(-0.1);
  ctx.strokeStyle = OUTLINE; ctx.fillStyle = '#e7edf5';
  roundRect(ctx, -2.2, -26, 4.4, 26, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.accent || '#caa24a';
  roundRect(ctx, -6, -2, 12, 3.5, 1.5); ctx.fill(); ctx.stroke();
  roundRect(ctx, -1.5, 1, 3, 6, 1); ctx.fill();
  ctx.restore();
}

function drawBow(ctx, pal, atk) {
  ctx.save();
  ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(0, -2, 12, -1.1, 1.1); ctx.stroke();
  // 弦
  ctx.strokeStyle = '#efe8d6'; ctx.lineWidth = 1;
  const pull = atk * 4;
  ctx.beginPath();
  ctx.moveTo(Math.cos(-1.1) * 12, -2 + Math.sin(-1.1) * 12);
  ctx.lineTo(-pull, -2);
  ctx.lineTo(Math.cos(1.1) * 12, -2 + Math.sin(1.1) * 12);
  ctx.stroke();
  ctx.restore();
}

function drawMage(ctx, u, pal) {
  const t = u.animTime;
  const float = Math.sin(t * 2) * 1.5;
  const atk = u.attackAnim;
  ctx.translate(0, -float);
  // 长袍
  ctx.fillStyle = pal.armor; ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.moveTo(-11, -2); ctx.lineTo(-7, -30);
  ctx.quadraticCurveTo(0, -36, 7, -30); ctx.lineTo(11, -2);
  ctx.quadraticCurveTo(0, 2, -11, -2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.accent;
  roundRect(ctx, -3, -30, 6, 28, 2); ctx.fill();
  // 头 + 尖帽
  drawHead(ctx, pal, pal.skel ? pal.bone : pal.skin, 0, -38);
  ctx.fillStyle = pal.skel ? pal.dark : pal.armor; ctx.strokeStyle = OUTLINE;
  ctx.beginPath(); ctx.moveTo(-8, -40); ctx.lineTo(8, -40); ctx.lineTo(1, -58); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.glow || pal.accent;
  ctx.beginPath(); ctx.arc(1, -58, 2.2, 0, Math.PI * 2); ctx.fill();
  // 法杖 + 法球
  ctx.save();
  ctx.translate(8, -22); ctx.rotate(-0.2 - atk * 0.6);
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -16); ctx.stroke();
  const glow = pal.glow || pal.accent;
  const r = 4 + Math.sin(t * 5) * 0.8 + atk * 2;
  const grad = ctx.createRadialGradient(0, -18, 0, 0, -18, r + 3);
  grad.addColorStop(0, '#fff'); grad.addColorStop(0.5, glow); grad.addColorStop(1, 'rgba(150,120,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, -18, r + 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawDog(ctx, u, pal) {
  const skel = pal.skel;
  const body = skel ? pal.bone : (u.side === 'player' ? '#9c6b3f' : '#8a7f9c');
  const sw = u.state === 'march' ? Math.sin(u.walkPhase) * 4 : 0;
  ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE; ctx.fillStyle = body;
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * 6, -6); ctx.rotate(s * sw * 0.04);
    roundRect(ctx, -2, 0, 4, 8, 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  roundRect(ctx, -11, -16, 22, 11, 5); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(-11, -13); ctx.quadraticCurveTo(-18, -16, -15, -22); ctx.stroke();
  ctx.lineWidth = 2; ctx.fillStyle = body;
  roundRect(ctx, 7, -22, 11, 10, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9, -22); ctx.lineTo(8, -27); ctx.lineTo(13, -23); ctx.fill(); ctx.stroke();
  ctx.fillStyle = skel ? pal.dark : '#241f33';
  ctx.beginPath(); ctx.arc(15, -18, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(18, -16, 1.6, 0, Math.PI * 2); ctx.fill();
}

function drawBlock(ctx, u, pal) {
  // 罗马拒马 / 削尖木栅（cheval de frise）
  const team = u.side === 'player' ? '#3f7fd6' : '#a85fd6';
  const wood = '#8a5a2b', woodD = '#5e3f24';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // 中央横梁
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  ctx.fillStyle = woodD;
  roundRect(ctx, -20, -11, 40, 6, 2); ctx.fill(); ctx.stroke();
  // 交叉削尖木桩（X 形）
  ctx.strokeStyle = wood; ctx.lineWidth = 5;
  for (const cx of [-13, 0, 13]) {
    ctx.beginPath(); ctx.moveTo(cx - 9, -1); ctx.lineTo(cx + 9, -24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 9, -1); ctx.lineTo(cx - 9, -24); ctx.stroke();
  }
  // 尖头描边点缀
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.4;
  for (const cx of [-13, 0, 13]) {
    ctx.beginPath(); ctx.moveTo(cx - 9, -24); ctx.lineTo(cx - 7, -27); ctx.moveTo(cx + 9, -24); ctx.lineTo(cx + 7, -27); ctx.stroke();
  }
  // 队伍小旗
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -32); ctx.stroke();
  ctx.fillStyle = team;
  ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(11, -29.5); ctx.lineTo(0, -27); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawCannon(ctx, u, pal) {
  const skel = pal.skel;
  const metal = skel ? pal.bone : '#5a5f6b';
  ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE;
  ctx.fillStyle = '#3a2f25';
  for (const wx of [-7, 7]) { ctx.beginPath(); ctx.arc(wx, -5, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.save(); ctx.translate(0, -12); ctx.rotate(-0.5);
  ctx.fillStyle = metal; roundRect(ctx, -4, -6, 22, 10, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1c1a22'; ctx.beginPath(); ctx.arc(18, -1, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = skel ? pal.bone : '#6f7e8c';
  roundRect(ctx, -17, -20, 9, 14, 4); ctx.fill(); ctx.stroke();
  drawHead(ctx, pal, skel ? pal.bone : pal.skin, -12, -24);
}

function drawSniper(ctx, u, pal) {
  const skel = pal.skel;
  const cloth = skel ? pal.dark : '#3c4a3a';
  ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE;
  ctx.fillStyle = cloth;
  roundRect(ctx, -7, -26, 15, 22, 6); ctx.fill(); ctx.stroke();
  drawHead(ctx, pal, skel ? pal.bone : pal.skin, 0, -32);
  ctx.save(); ctx.translate(4, -24); ctx.rotate(-0.08);
  ctx.strokeStyle = '#23252e'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(26, -2); ctx.stroke();
  ctx.fillStyle = '#23252e'; roundRect(ctx, 6, -6, 7, 3, 1); ctx.fill();
  ctx.restore();
}

function drawCatapult(ctx, u, pal) {
  ctx.lineWidth = 2.2; ctx.strokeStyle = OUTLINE;
  const wood = '#7a5230';
  ctx.fillStyle = wood;
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.lineTo(12, -6); ctx.lineTo(-12, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2f25';
  for (const wx of [-12, 12]) { ctx.beginPath(); ctx.arc(wx, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = wood; roundRect(ctx, -3, -26, 6, 22, 2); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(0, -24); ctx.rotate(-0.7);
  ctx.fillStyle = '#8a6038'; roundRect(ctx, -2, -2, 26, 5, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9a9aa2'; ctx.beginPath(); ctx.arc(24, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// ============ 血条 ============
export function drawHealthBar(ctx, x, y, w, ratio, side) {
  const h = 4;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, x - w / 2 - 1, y - 1, w + 2, h + 2, 2); ctx.fill();
  ctx.fillStyle = side === 'player' ? '#4fd06a' : '#e0556f';
  roundRect(ctx, x - w / 2, y, Math.max(0, w * ratio), h, 2); ctx.fill();
  ctx.restore();
}

// ============ 建筑 ============
export function drawBuilding(ctx, b, state) {
  if (b.kind === 'keep') drawKeep(ctx, b, state);
  else drawTower(ctx, b, state);
}

function towerColors(side) {
  return side === 'player'
    ? { stone: '#8d9aa8', stoneDark: '#6c7886', roof: '#3f7fd6', flag: '#9cc4ff' }
    : { stone: '#7a7488', stoneDark: '#5b566b', roof: '#a85fd6', flag: '#d9b6ff' };
}

function drawTower(ctx, b, state) {
  const c = towerColors(b.side);
  ctx.save();
  ctx.translate(b.x, b.y);
  // 地基阴影
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(0, 6, 30, 9, 0, 0, Math.PI * 2); ctx.fill();

  if (!b.alive) { drawRubble(ctx, 0, 0, c); ctx.restore(); drawBuildingBar(ctx, b); return; }

  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  // 塔身
  ctx.fillStyle = c.stone;
  roundRect(ctx, -20, -64, 40, 70, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.stoneDark;
  roundRect(ctx, 6, -64, 14, 70, 6); ctx.fill();
  // 砖纹
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-20, -64 + i * 17); ctx.lineTo(20, -64 + i * 17); ctx.stroke(); }
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  // 城垛
  ctx.fillStyle = c.stoneDark;
  for (let i = -2; i <= 2; i++) { roundRect(ctx, i * 8 - 3, -74, 6, 12, 1); ctx.fill(); ctx.stroke(); }
  // 门
  ctx.fillStyle = '#2c2436';
  roundRect(ctx, -7, -20, 14, 20, 4); ctx.fill();
  // 旗
  drawFlag(ctx, 0, -74, c, state.time);
  // 受损裂纹/冒烟
  const dmg = 1 - b.hp / b.maxHp;
  if (dmg > 0.4) drawCracks(ctx, -16, -58, 32, 50, dmg);
  if (b.flash > 0) { ctx.fillStyle = `rgba(255,80,80,${b.flash * 0.4})`; roundRect(ctx, -20, -64, 40, 70, 6); ctx.fill(); }
  ctx.restore();

  // 驻塔法师画在塔顶（由 render 在单位层统一处理）
  drawBuildingBar(ctx, b);
}

function drawKeep(ctx, b, state) {
  const c = towerColors(b.side);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 10, 42, 12, 0, 0, Math.PI * 2); ctx.fill();

  if (!b.alive) { drawRubble(ctx, 0, 0, c, 1.5); ctx.restore(); drawBuildingBar(ctx, b); return; }

  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.4;
  // 主体
  ctx.fillStyle = c.stone;
  roundRect(ctx, -34, -96, 68, 106, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.stoneDark; roundRect(ctx, 10, -96, 24, 106, 8); ctx.fill();
  // 两翼塔
  for (const s of [-1, 1]) {
    ctx.fillStyle = c.stone;
    roundRect(ctx, s * 34 - 11, -84, 22, 92, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.roof;
    ctx.beginPath(); ctx.moveTo(s * 34 - 13, -84); ctx.lineTo(s * 34 + 13, -84); ctx.lineTo(s * 34, -104); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  // 砖纹
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-34, -96 + i * 17); ctx.lineTo(34, -96 + i * 17); ctx.stroke(); }
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.4;
  // 城垛
  ctx.fillStyle = c.stoneDark;
  for (let i = -3; i <= 3; i++) { roundRect(ctx, i * 9 - 3.5, -108, 7, 14, 1); ctx.fill(); ctx.stroke(); }
  // 大门
  ctx.fillStyle = '#241c2e';
  ctx.beginPath(); ctx.moveTo(-12, 8); ctx.lineTo(-12, -16); ctx.arc(0, -16, 12, Math.PI, 0); ctx.lineTo(12, 8); ctx.fill();
  // 主旗
  drawFlag(ctx, 0, -118, c, state.time, 1.4);
  const dmg = 1 - b.hp / b.maxHp;
  if (dmg > 0.35) drawCracks(ctx, -30, -90, 60, 90, dmg);
  if (b.flash > 0) { ctx.fillStyle = `rgba(255,80,80,${b.flash * 0.4})`; roundRect(ctx, -34, -96, 68, 106, 8); ctx.fill(); }
  ctx.restore();

  drawBuildingBar(ctx, b);
}

function drawFlag(ctx, x, y, c, time, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -16); ctx.stroke();
  const w = 2 + Math.sin(time * 4) * 1.5;
  ctx.fillStyle = c.flag;
  ctx.beginPath();
  ctx.moveTo(0, -16); ctx.lineTo(16, -13 + w); ctx.lineTo(0, -8); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawCracks(ctx, x, y, w, h, dmg) {
  ctx.save();
  ctx.strokeStyle = `rgba(20,15,30,${Math.min(0.7, dmg)})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y); ctx.lineTo(x + w * 0.4, y + h * 0.4); ctx.lineTo(x + w * 0.25, y + h * 0.7);
  ctx.moveTo(x + w * 0.7, y + h * 0.2); ctx.lineTo(x + w * 0.6, y + h * 0.6); ctx.lineTo(x + w * 0.72, y + h);
  ctx.stroke();
  ctx.restore();
}

function drawRubble(ctx, x, y, c, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = c.stoneDark; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  for (const p of [[-18, -4, 14], [2, -2, 16], [-4, -14, 12], [16, -8, 10]]) {
    roundRect(ctx, p[0], p[1] - p[2], p[2], p[2], 3); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawBuildingBar(ctx, b) {
  const w = b.kind === 'keep' ? 70 : 46;
  const y = b.kind === 'keep' ? b.y - 128 : b.y - 86;
  if (!b.alive) return;
  drawHealthBar(ctx, b.x, y, w, b.hp / b.maxHp, b.side);
}
