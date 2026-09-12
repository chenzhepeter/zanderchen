// 怪物/敌人的程序化卡通绘制。与 art/portrait.js 同一套语言：
// 平涂色块 + 深色粗描边 + 投影椭圆 + 受击闪白，风格照搬 towerclash/js/sprites.js。
import { OUTLINE, PAL, poly, ellipse, shape, softShadow, roundRect, rng } from './common.js';

// st: { hitFlash 0..1, open 是否破绽, dead, t }
export function drawMonster(ctx, art, x, baseY, scale = 1, st = {}) {
  const t = st.t || 0;
  const bob = Math.sin(t * 1.6) * 4;
  softShadow(ctx, x, baseY + 6, 90 * scale, 20 * scale);

  ctx.save();
  ctx.translate(x, baseY + bob);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (st.dead) { ctx.globalAlpha = Math.max(0, 1 - (st.deathT || 0)); ctx.rotate(1.2 * (st.deathT || 0)); }

  switch (art) {
    case 'cyclops': drawCyclops(ctx, t, st); break;
    case 'giant':   drawGiant(ctx, t, st); break;
    case 'beast':   drawBeast(ctx, t, st); break;
    case 'shade':   drawShade(ctx, t, st); break;
    case 'scylla':  drawScylla(ctx, t, st); break;
    case 'crowd':   drawCrowd(ctx, t, st); break;
    case 'robed':   drawHumanoid(ctx, t, st, { skin: '#c08a5a', cloth: '#f0d0e0', cloak: '#7fc4a8', hat: 'laurel' }); break;
    case 'noble':   drawHumanoid(ctx, t, st, { skin: '#e0b888', cloth: '#7a3b6a', cloak: '#d9a441', hat: 'laurel' }); break;
    default:        drawHumanoid(ctx, t, st, { skin: '#c98a58', cloth: '#8a7a5c', cloak: '#5a4a40', hat: 'helmet' });
  }

  // 破绽：金色裂纹环，一眼能看出「现在打他」
  if (st.open && !st.dead) {
    ctx.save();
    ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 4;
    ctx.globalAlpha = 0.55 + Math.sin(t * 8) * 0.35;
    ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 40;
    ctx.beginPath(); ctx.ellipse(0, -100, 128, 138, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // 受击闪白
  if (st.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = st.hitFlash * 0.62; ctx.fillStyle = '#fff';
    roundRect(ctx, -100, -230, 200, 240, 30); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ===== 通用人形（喀孔涅斯人 / 求婚者 / 食莲人）=====
function drawHumanoid(ctx, t, st, pal) {
  const sw = Math.sin(t * 2.2) * 5;
  // 腿
  for (const s of [-1, 1]) poly(ctx, [[s * 22 - 12, -60], [s * 22 + 12, -60], [s * 22 + 10 + s * sw, 0], [s * 22 - 10 + s * sw, 0]], '#5a4a40');
  // 身体
  poly(ctx, [[-46, -168], [46, -168], [58, -56], [-58, -56]], pal.cloth);
  if (pal.cloak) poly(ctx, [[-52, -170], [-30, -170], [-38, -50], [-64, -46]], pal.cloak);
  // 手臂 + 矛
  poly(ctx, [[-46, -158], [-64, -150], [-70, -70], [-52, -66]], pal.skin);
  poly(ctx, [[46, -158], [66, -152], [74, -76], [56, -70]], pal.skin);
  ctx.save(); ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(74, -180); ctx.lineTo(70, 10); ctx.stroke(); ctx.restore();
  poly(ctx, [[74, -180], [66, -206], [82, -206]], '#c9c4b4');
  // 头
  ellipse(ctx, 0, -196, 34, 38, pal.skin);
  for (const s of [-1, 1]) ellipse(ctx, s * 12, -200, 7, st.open ? 3 : 7, PAL.bone);
  if (pal.hat === 'helmet') {
    poly(ctx, [[-36, -190], [-36, -216], [0, -240], [36, -216], [36, -190], [24, -190], [24, -210], [-24, -210], [-24, -190]], '#b8843a');
    poly(ctx, [[-4, -238], [4, -238], [14, -272], [-14, -268]], PAL.terra);
  } else if (pal.hat === 'laurel') {
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + s * (0.3 + i * 0.32);
      ellipse(ctx, Math.cos(a) * 38, -200 + Math.sin(a) * 40, 9, 5, PAL.olive, OUTLINE, 1.8);
    }
  }
}

// ===== 独眼巨人 =====
function drawCyclops(ctx, t, st) {
  const breathe = Math.sin(t * 1.1) * 4;
  // 腿
  for (const s of [-1, 1]) poly(ctx, [[s * 40 - 26, -90], [s * 40 + 26, -90], [s * 40 + 24, 6], [s * 40 - 24, 6]], '#7a7248');
  // 躯干
  shape(ctx, () => {
    ctx.moveTo(-92, -244 - breathe);
    ctx.bezierCurveTo(-120, -160, -110, -110, -84, -84);
    ctx.lineTo(84, -84);
    ctx.bezierCurveTo(110, -110, 120, -160, 92, -244 - breathe);
    ctx.closePath();
  }, '#a8a06b');
  // 兽皮围裙
  poly(ctx, [[-70, -120], [70, -120], [80, -60], [-80, -60]], '#6b5a3a');
  // 手臂
  poly(ctx, [[-92, -232], [-128, -216], [-142, -96], [-104, -86]], '#a8a06b');
  poly(ctx, [[92, -232], [130, -218], [146, -100], [108, -88]], '#a8a06b');
  // 头
  ellipse(ctx, 0, -290 - breathe, 66, 62, '#a8a06b');
  // 乱发与胡子
  for (let i = -3; i <= 3; i++) poly(ctx, [[i * 18 - 10, -336 - breathe], [i * 18 + (i % 2 ? 12 : -14), -394 - breathe], [i * 18 + 10, -336 - breathe]], '#3a2a1c');
  shape(ctx, () => {
    ctx.moveTo(-58, -276 - breathe);
    ctx.bezierCurveTo(-62, -220, -30, -196, 0, -196);
    ctx.bezierCurveTo(30, -196, 62, -220, 58, -276 - breathe);
    ctx.closePath();
  }, '#3a2a1c');
  // 那只眼
  const blinded = st.open || st.blinded;
  if (blinded) {
    ctx.save(); ctx.strokeStyle = '#8a2a1a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-28, -320 - breathe); ctx.lineTo(28, -288 - breathe); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(28, -320 - breathe); ctx.lineTo(-28, -288 - breathe); ctx.stroke();
    ctx.restore();
  } else {
    ellipse(ctx, 0, -304 - breathe, 32, 28, PAL.bone);
    ellipse(ctx, Math.sin(t * 0.9) * 8, -304 - breathe, 14, 14, OUTLINE, null);
  }
}

// ===== 莱斯特律戈涅斯巨人 =====
function drawGiant(ctx, t, st) {
  const lift = Math.max(0, Math.sin(t * 1.4)) * 30;
  for (const s of [-1, 1]) poly(ctx, [[s * 34 - 22, -80], [s * 34 + 22, -80], [s * 34 + 20, 4], [s * 34 - 20, 4]], '#5a5a3a');
  poly(ctx, [[-80, -224], [80, -224], [96, -76], [-96, -76]], '#8a9a7a');
  poly(ctx, [[-60, -120], [60, -120], [66, -66], [-66, -66]], '#4a4230');
  ellipse(ctx, 0, -262, 50, 48, '#8a9a7a');
  for (let i = -2; i <= 2; i++) poly(ctx, [[i * 20 - 8, -298], [i * 20 + (i % 2 ? 10 : -12), -346], [i * 20 + 8, -298]], '#2a2a1a');
  for (const s of [-1, 1]) ellipse(ctx, s * 17, -268, 10, 9, PAL.bone);
  // 举起来的石头
  poly(ctx, [[-80, -222], [-124, -250 - lift], [-108, -300 - lift], [-70, -266]], '#8a9a7a');
  poly(ctx, [[80, -222], [126, -252 - lift], [110, -302 - lift], [72, -268]], '#8a9a7a');
  ctx.save(); ctx.translate(0, -lift);
  poly(ctx, [[-52, -330], [-16, -366], [40, -354], [56, -312], [16, -292], [-32, -300]], '#6b6458');
  ctx.restore();
}

// ===== 狼（喀耳刻的兽）=====
function drawBeast(ctx, t, st) {
  const sw = Math.sin(t * 3) * 5;
  for (const s of [-1, 1]) for (const dx of [-46, 40]) poly(ctx, [[dx + s * 6, -46], [dx + 14 + s * 6, -46], [dx + 12 + sw * s, 2], [dx - 2 + sw * s, 2]], '#6b6158');
  ellipse(ctx, 0, -78, 72, 44, '#8a8078');
  poly(ctx, [[60, -96], [104, -128], [122, -104], [96, -74], [62, -66]], '#8a8078');
  poly(ctx, [[86, -128], [82, -160], [102, -140]], '#8a8078');
  poly(ctx, [[108, -122], [116, -152], [124, -126]], '#8a8078');
  ellipse(ctx, 106, -104, 8, 7, st.open ? '#c1512f' : PAL.bone);
  poly(ctx, [[-66, -92], [-116, -128], [-104, -86]], '#8a8078');
  ctx.save(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(112, -88); ctx.lineTo(126, -84); ctx.stroke(); ctx.restore();
}

// ===== 亡魂 =====
function drawShade(ctx, t, st) {
  const fl = Math.sin(t * 2) * 8;
  ctx.save(); ctx.globalAlpha = 0.62;
  shape(ctx, () => {
    ctx.moveTo(-54, -220);
    ctx.bezierCurveTo(-80, -140, -70, -60, -40 + fl, -6);
    ctx.bezierCurveTo(-10, 12, 10, 12, 40 - fl, -6);
    ctx.bezierCurveTo(70, -60, 80, -140, 54, -220);
    ctx.closePath();
  }, '#8a90a8');
  ellipse(ctx, 0, -252, 40, 42, '#a8aec4');
  ctx.restore();
  for (const s of [-1, 1]) ellipse(ctx, s * 14, -256, 8, 12, '#2a2a3a', null);
  ctx.save(); ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, -224); ctx.quadraticCurveTo(0, -216, 12, -224); ctx.stroke();
  ctx.restore();
}

// ===== 斯库拉：六个头从上方探下来 =====
function drawScylla(ctx, t, st) {
  for (let i = 0; i < 6; i++) {
    const px = (i - 2.5) * 74;
    const reach = 40 + Math.sin(t * 1.7 + i * 1.1) * 34;
    ctx.save();
    ctx.strokeStyle = '#4a3a5a'; ctx.lineWidth = 26; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px * 0.5, -420);
    ctx.quadraticCurveTo(px * 0.9, -300 + reach, px, -170 + reach);
    ctx.stroke();
    ctx.restore();
    ellipse(ctx, px, -168 + reach, 30, 24, '#5c4a6e');
    poly(ctx, [[px - 26, -158 + reach], [px + 26, -158 + reach], [px + 18, -138 + reach], [px - 18, -138 + reach]], '#efe6d2');
    for (const s of [-1, 1]) ellipse(ctx, px + s * 12, -178 + reach, 7, 6, '#ffd24a', OUTLINE, 2);
  }
}

// ===== 求婚者群像 =====
function drawCrowd(ctx, t, st) {
  const r = rng(11);
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 78 + (r() - 0.5) * 20;
    const sc = 0.62 + r() * 0.22;
    const back = i % 2 === 0;
    ctx.save();
    ctx.translate(x, back ? -22 : 0);
    ctx.scale(sc, sc);
    if (back) ctx.globalAlpha = 0.75;
    drawHumanoid(ctx, t + i, st, {
      skin: ['#e0b888', '#d0a070', '#c98a58'][i % 3],
      cloth: ['#7a3b6a', '#8a6a90', '#5a4a60', '#6b5a8a'][i % 4],
      cloak: i % 3 === 0 ? '#d9a441' : null,
      hat: i % 3 === 0 ? 'laurel' : 'none',
    });
    ctx.restore();
  }
}

// 主角在战斗场景里的小人：四分之三背影，站在画面左侧。
// 背影也要有信息量——披风褶、举起的剑、格挡时的盾，都是战况的即时反馈。
export function drawHero(ctx, x, baseY, scale, st = {}) {
  const t = st.t || 0;
  const bob = Math.sin(t * 1.5) * 2.5;
  softShadow(ctx, x, baseY + 6, 62 * scale, 15 * scale);

  ctx.save();
  ctx.translate(x, baseY + bob);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // 腿
  for (const s of [-1, 1]) poly(ctx, [[s * 20 - 12, -64], [s * 20 + 12, -64], [s * 20 + 10, 4], [s * 20 - 10, 4]], '#5a4030');
  // 披风在最后面，比身体宽一圈
  shape(ctx, () => {
    ctx.moveTo(-52, -174);
    ctx.bezierCurveTo(-74, -120, -78, -50, -66, -34);
    ctx.lineTo(66, -34);
    ctx.bezierCurveTo(78, -50, 74, -120, 52, -174);
    ctx.closePath();
  }, '#5b2a3e');
  ctx.save(); ctx.strokeStyle = 'rgba(36,31,51,0.32)'; ctx.lineWidth = 2.4;
  for (const i of [-1, 0, 1]) {
    ctx.beginPath(); ctx.moveTo(i * 22, -168); ctx.quadraticCurveTo(i * 30, -100, i * 34, -38); ctx.stroke();
  }
  ctx.restore();
  // 身体（露在披风外的那一圈）
  poly(ctx, [[-40, -170], [40, -170], [50, -56], [-50, -56]], '#8c3a2a');
  // 左臂 + 盾（格挡时盾抬起来，一眼看得出这回合有护甲）
  const guard = st.block > 0;
  poly(ctx, [[-40, -160], [-62, -150], [-70, -84], [-50, -78]], '#d99a62');
  ctx.save();
  ctx.translate(-64, guard ? -128 : -96);
  ellipse(ctx, 0, 0, 30, 38, '#b8843a');
  ellipse(ctx, 0, 0, 12, 15, '#d9a441');
  ctx.restore();
  // 右臂 + 举起的剑
  const swing = Math.sin(t * 2.2) * 5;
  ctx.save();
  ctx.translate(48, -156);
  ctx.rotate(-0.35 + swing * 0.02);
  poly(ctx, [[-8, 0], [14, -6], [26, 66], [4, 72]], '#d99a62');
  poly(ctx, [[16, -8], [30, -12], [34, -70], [22, -74]], '#c9c4b4');    // 剑身
  poly(ctx, [[10, -4], [36, -10], [37, -2], [11, 4]], '#b8843a');       // 护手
  ctx.restore();
  // 头（后脑 + 卷发）
  ellipse(ctx, 4, -196, 33, 37, '#d99a62');
  for (let i = -2; i <= 2; i++) ellipse(ctx, 4 + i * 14, -214 + Math.abs(i) * 5, 14, 13, '#3a2418');
  for (let i = -1; i <= 1; i++) ellipse(ctx, 4 + i * 15, -184, 13, 12, '#3a2418');
  // 露出一点侧脸轮廓：让人知道这是个人，不是一团布
  ctx.save(); ctx.strokeStyle = 'rgba(36,31,51,0.42)'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(33, -206); ctx.quadraticCurveTo(41, -194, 33, -182); ctx.stroke();
  ctx.restore();

  if (st.hitFlash > 0) {
    ctx.save(); ctx.globalAlpha = st.hitFlash * 0.6; ctx.fillStyle = '#fff';
    roundRect(ctx, -70, -238, 145, 246, 26); ctx.fill(); ctx.restore();
  }
  ctx.restore();

  // 格挡数值：直接标在盾上，不用去顶栏找
  if (st.block > 0) {
    ctx.save();
    ctx.font = `700 ${Math.round(19 * scale)}px 'DM Sans', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5 * scale;
    const bx = x - 64 * scale, by = baseY - 128 * scale + bob;
    ctx.strokeText(String(st.block), bx, by);
    ctx.fillStyle = PAL.clayLt || '#f5e2c4';
    ctx.fillText(String(st.block), bx, by);
    ctx.restore();
  }
}
