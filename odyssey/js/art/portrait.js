// 半身立绘：构件化组合（体型 / 斗篷 / 长袍 / 头发 / 胡须 / 头饰 / 表情）。
// 表情只用三个参数控制：眉角 brow、眼开合 eye、嘴形 mouth —— 换表情不用重画任何构件。
// 比例是 Q 版：头大身小，但五官按真实位置摆（眼睛在头的中线略下方），
// 否则会掉进"木偶脸"里。接口稳定：如需替换为 PNG 立绘，只改这个文件。
import { OUTLINE, PAL, poly, ellipse, shape, roundRect } from './common.js';

// brow 正=内端上扬(悲) 负=内端下压(怒)；eye 1=正常；mouth 正=笑 负=哭
const EMOTES = {
  calm:  { brow: 0.00, eye: 1.00, mouth: 0.12, tear: 0 },
  smile: { brow: -0.10, eye: 0.82, mouth: 1.00, tear: 0 },
  sad:   { brow: 0.40, eye: 0.74, mouth: -0.85, tear: 0 },
  angry: { brow: -0.62, eye: 1.06, mouth: -0.62, tear: 0 },
  shock: { brow: -0.14, eye: 1.38, mouth: -0.10, tear: 0, oMouth: true },
  sly:   { brow: -0.26, eye: 0.60, mouth: 0.72, tear: 0, wink: true },
  cry:   { brow: 0.46, eye: 0.52, mouth: -1.00, tear: 1 },
  weary: { brow: 0.22, eye: 0.46, mouth: -0.28, tear: 0 },
};
export const EMOTE_LIST = Object.keys(EMOTES);

// 半身像几何（scale=1）：底边在 y=0，头顶约在 y=-360
const HEAD_Y = -262;     // 头中心
const HEAD_RX = 52, HEAD_RY = 58;
const NECK_TOP = -212, SHOULDER_Y = -184;

export function drawPortrait(ctx, spec, cx, baseY, scale = 1, emote = 'calm', t = 0) {
  if (!spec) return;
  const e = EMOTES[emote] || EMOTES.calm;
  const sc = scale * (spec.scale || 1);
  const breathe = Math.sin(t * 1.3) * 1.8;

  ctx.save();
  ctx.translate(cx, baseY + breathe);
  ctx.scale(sc, sc);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (spec.ghost) ctx.globalAlpha = 0.74;

  if (spec.glow) {
    const g = ctx.createRadialGradient(0, HEAD_Y, 30, 0, HEAD_Y + 40, 230);
    g.addColorStop(0, spec.glow); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.globalAlpha = 0.26; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, HEAD_Y + 40, 230, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  const broad = spec.frame !== 'slim';
  const sh = broad ? 104 : 84;     // 肩宽（半）
  const hip = broad ? 126 : 104;   // 下摆宽（半）
  const helm = spec.head === 'helmet';

  drawBody(ctx, spec, sh, hip);
  if (!helm) drawHairBack(ctx, spec);
  drawHead(ctx, spec);
  drawFace(ctx, spec, e, t);
  if (spec.beard && !helm) drawBeard(ctx, spec);
  else if (spec.beard) drawBeard(ctx, spec, true);
  if (!helm) drawHairFront(ctx, spec);
  drawHeadwear(ctx, spec);

  ctx.restore();
}

// ===== 身体：圆肩剪影 + 领口 + 衣褶 =====
function drawBody(ctx, spec, sh, hip) {
  if (spec.cloak) {
    shape(ctx, () => {
      ctx.moveTo(-sh - 14, SHOULDER_Y + 12);
      ctx.quadraticCurveTo(-sh - 26, SHOULDER_Y - 8, -sh + 6, SHOULDER_Y - 14);
      ctx.lineTo(sh - 6, SHOULDER_Y - 14);
      ctx.quadraticCurveTo(sh + 26, SHOULDER_Y - 8, sh + 14, SHOULDER_Y + 12);
      ctx.lineTo(hip + 32, 6); ctx.lineTo(-hip - 32, 6);
      ctx.closePath();
    }, spec.cloak);
  }
  // 长袍：肩头是圆的，不是切角的梯形
  shape(ctx, () => {
    ctx.moveTo(-sh, SHOULDER_Y + 16);
    ctx.quadraticCurveTo(-sh + 4, SHOULDER_Y - 16, -30, NECK_TOP + 22);
    ctx.lineTo(30, NECK_TOP + 22);
    ctx.quadraticCurveTo(sh - 4, SHOULDER_Y - 16, sh, SHOULDER_Y + 16);
    ctx.lineTo(hip, 6); ctx.lineTo(-hip, 6);
    ctx.closePath();
  }, spec.cloth);
  // 领口
  shape(ctx, () => {
    ctx.moveTo(-30, NECK_TOP + 22);
    ctx.quadraticCurveTo(0, NECK_TOP + 50, 30, NECK_TOP + 22);
  }, null, 'rgba(36,31,51,0.42)', 3);
  // 衣褶
  ctx.save(); ctx.strokeStyle = 'rgba(36,31,51,0.26)'; ctx.lineWidth = 2.4;
  for (const i of [-1.5, -0.6, 0.6, 1.5]) {
    ctx.beginPath();
    ctx.moveTo(i * sh * 0.42, SHOULDER_Y + 30);
    ctx.quadraticCurveTo(i * hip * 0.46, -80, i * hip * 0.52, 2);
    ctx.stroke();
  }
  ctx.restore();
  // 脖子（画在长袍之上，让下巴与领口之间有过渡）
  poly(ctx, [[-21, NECK_TOP - 22], [21, NECK_TOP - 22], [24, NECK_TOP + 26], [-24, NECK_TOP + 26]], spec.skin);
}

function drawHead(ctx, spec) {
  const hy = HEAD_Y;
  shape(ctx, () => {
    ctx.moveTo(-HEAD_RX, hy - 6);
    ctx.bezierCurveTo(-HEAD_RX, hy - HEAD_RY - 8, HEAD_RX, hy - HEAD_RY - 8, HEAD_RX, hy - 6);
    ctx.bezierCurveTo(HEAD_RX, hy + 36, HEAD_RX * 0.52, hy + HEAD_RY, 0, hy + HEAD_RY);
    ctx.bezierCurveTo(-HEAD_RX * 0.52, hy + HEAD_RY, -HEAD_RX, hy + 36, -HEAD_RX, hy - 6);
    ctx.closePath();
  }, spec.skin);
  ellipse(ctx, -HEAD_RX - 1, hy + 6, 8, 13, spec.skin);
  ellipse(ctx, HEAD_RX + 1, hy + 6, 8, 13, spec.skin);
}

// ===== 五官 =====
function drawFace(ctx, spec, e, t) {
  const hy = HEAD_Y;
  const eyeY = hy + 6;            // 眼睛在头的中线略下方——这一条决定了脸像不像人
  const eyeDx = 20;

  if (spec.cyclops) {
    ellipse(ctx, 0, eyeY - 4, 29, 25 * e.eye, PAL.bone);
    ellipse(ctx, 0, eyeY - 4, 12, 12, OUTLINE, null);
    ellipse(ctx, -5, eyeY - 10, 4, 4, '#fff', null);
    ctx.save(); ctx.strokeStyle = spec.hairC; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-32, eyeY - 36 + e.brow * 14); ctx.quadraticCurveTo(0, eyeY - 46, 32, eyeY - 36 - e.brow * 14);
    ctx.stroke(); ctx.restore();
    drawMouth(ctx, e, 1.25);
    return;
  }

  for (const s of [-1, 1]) {
    const closed = (e.wink && s < 0) || e.eye < 0.28;
    if (closed) {
      ctx.save(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s * eyeDx - 11, eyeY);
      ctx.quadraticCurveTo(s * eyeDx, eyeY + 6, s * eyeDx + 11, eyeY);
      ctx.stroke(); ctx.restore();
    } else {
      const ry = 8.4 * e.eye;
      ellipse(ctx, s * eyeDx, eyeY, 10.5, ry, PAL.bone, OUTLINE, 2.2);
      if (!spec.blind) {
        ellipse(ctx, s * eyeDx + s * 1.2, eyeY + ry * 0.12, 4.6, Math.min(4.6, ry * 0.72), OUTLINE, null);
        ellipse(ctx, s * eyeDx - 1.6, eyeY - ry * 0.34, 1.9, 1.9, '#fff', null);   // 高光：眼睛立刻活了
      }
      // 上眼睑：一条压在眼球上的短弧，让眼神有方向
      ctx.save(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(s * eyeDx, eyeY, 10.5, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.restore();
    }
    // 眉：内端随 brow 升降，比原来细，离眼睛更近
    ctx.save();
    ctx.strokeStyle = spec.hairC || OUTLINE; ctx.lineWidth = 3.8; ctx.lineCap = 'round';
    const inner = eyeY - 19 + e.brow * 8, outer = eyeY - 21 - e.brow * 3;
    ctx.beginPath();
    ctx.moveTo(s * (eyeDx - 12), inner);
    ctx.quadraticCurveTo(s * eyeDx, outer - 3.5, s * (eyeDx + 12), outer + 1);
    ctx.stroke(); ctx.restore();
  }

  // 鼻：一条侧勾，陶画的招牌笔法
  ctx.save(); ctx.strokeStyle = 'rgba(36,31,51,0.5)'; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(1, eyeY + 6); ctx.quadraticCurveTo(7, eyeY + 20, -2, eyeY + 23); ctx.stroke();
  ctx.restore();

  drawMouth(ctx, e, 1);

  if (e.tear) {
    ctx.save(); ctx.fillStyle = '#8fd0f0'; ctx.globalAlpha = 0.9;
    const dy = (t * 55) % 42;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(s * eyeDx, eyeY + 13 + dy, 3.6, 6.4, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawMouth(ctx, e, k) {
  const my = HEAD_Y + 38;
  ctx.save(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3.2 * k; ctx.lineCap = 'round';
  if (e.oMouth) {
    ctx.fillStyle = '#7a2a2a';
    ctx.beginPath(); ctx.ellipse(0, my + 3, 9.5 * k, 13 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-14 * k, my);
    ctx.quadraticCurveTo(0, my + e.mouth * 10 * k, 14 * k, my);
    ctx.stroke();
    if (e.mouth > 0.6) {   // 笑：补一条下唇，才不像一根线
      ctx.lineWidth = 2.2 * k; ctx.strokeStyle = 'rgba(36,31,51,0.35)';
      ctx.beginPath();
      ctx.moveTo(-9 * k, my + 3); ctx.quadraticCurveTo(0, my + e.mouth * 13 * k, 9 * k, my + 3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBeard(ctx, spec, short = false) {
  const hy = HEAD_Y, bot = short ? hy + 84 : hy + 100;
  shape(ctx, () => {
    ctx.moveTo(-HEAD_RX + 2, hy + 12);
    ctx.bezierCurveTo(-HEAD_RX - 4, hy + 58, -28, bot, 0, bot);
    ctx.bezierCurveTo(28, bot, HEAD_RX + 4, hy + 58, HEAD_RX - 2, hy + 12);
    ctx.bezierCurveTo(30, hy + 44, -30, hy + 44, -HEAD_RX + 2, hy + 12);
    ctx.closePath();
  }, spec.hairC);
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.20)'; ctx.lineWidth = 2.2;
  for (const i of [-1, 0, 1]) { ctx.beginPath(); ctx.arc(i * 18, hy + 60, 12, 0.25, Math.PI - 0.25); ctx.stroke(); }
  ctx.restore();
  // 上唇的两撇
  shape(ctx, () => {
    ctx.moveTo(-20, hy + 30); ctx.quadraticCurveTo(0, hy + 26, 20, hy + 30);
    ctx.quadraticCurveTo(0, hy + 38, -20, hy + 30); ctx.closePath();
  }, spec.hairC);
}

// ===== 头发 =====
function drawHairBack(ctx, spec) {
  const hy = HEAD_Y, c = spec.hairC;
  if (spec.hair === 'bald') return;
  if (spec.hair === 'long') {
    shape(ctx, () => {
      ctx.moveTo(-HEAD_RX - 6, hy - 24);
      ctx.bezierCurveTo(-HEAD_RX - 26, hy + 40, -HEAD_RX - 20, hy + 120, -HEAD_RX - 4, hy + 132);
      ctx.lineTo(-30, hy + 104);
      ctx.lineTo(30, hy + 104);
      ctx.lineTo(HEAD_RX + 4, hy + 132);
      ctx.bezierCurveTo(HEAD_RX + 20, hy + 120, HEAD_RX + 26, hy + 40, HEAD_RX + 6, hy - 24);
      ctx.closePath();
    }, c);
  } else if (spec.hair === 'bun') {
    ellipse(ctx, 0, hy - HEAD_RY - 16, 27, 21, c);
    shape(ctx, () => {
      ctx.moveTo(-HEAD_RX - 4, hy - 18);
      ctx.quadraticCurveTo(-HEAD_RX - 12, hy + 40, -34, hy + 56);
      ctx.lineTo(34, hy + 56);
      ctx.quadraticCurveTo(HEAD_RX + 12, hy + 40, HEAD_RX + 4, hy - 18);
      ctx.closePath();
    }, c);
  } else if (spec.hair === 'wild') {
    for (let i = 0; i < 13; i++) {
      const a = Math.PI + i * Math.PI / 12;
      const r1 = 46, r2 = 76 + (i % 3) * 14;
      poly(ctx, [
        [Math.cos(a) * r1, hy - 4 + Math.sin(a) * r1 * 1.05],
        [Math.cos(a + 0.08) * r2, hy - 4 + Math.sin(a + 0.08) * r2 * 1.05],
        [Math.cos(a + 0.26) * r1, hy - 4 + Math.sin(a + 0.26) * r1 * 1.05],
      ], c);
    }
  }
}

function drawHairFront(ctx, spec) {
  const hy = HEAD_Y, c = spec.hairC;
  if (spec.hair === 'bald') return;
  // 所有发型共用一顶"颅顶帽"，保证发际线自然
  shape(ctx, () => {
    ctx.moveTo(-HEAD_RX - 2, hy - 4);
    ctx.bezierCurveTo(-HEAD_RX - 2, hy - HEAD_RY - 12, HEAD_RX + 2, hy - HEAD_RY - 12, HEAD_RX + 2, hy - 4);
    ctx.quadraticCurveTo(HEAD_RX - 6, hy - 20, 26, hy - 26);
    ctx.quadraticCurveTo(0, hy - 34, -26, hy - 26);
    ctx.quadraticCurveTo(-HEAD_RX + 6, hy - 20, -HEAD_RX - 2, hy - 4);
    ctx.closePath();
  }, c);
  if (spec.hair === 'curls') {
    for (let i = -3; i <= 3; i++) {
      const x = i * 16, y = hy - HEAD_RY - 4 + Math.abs(i) * 7;
      ellipse(ctx, x, y, 13, 12, c);
    }
  } else if (spec.hair === 'wild') {
    for (let i = -3; i <= 3; i++)
      poly(ctx, [[i * 15 - 9, hy - 44], [i * 15 + (i % 2 ? 11 : -13), hy - 96], [i * 15 + 9, hy - 44]], c);
  }
  // 鬓角
  for (const s of [-1, 1]) poly(ctx, [[s * (HEAD_RX - 2), hy - 12], [s * (HEAD_RX + 4), hy + 22], [s * (HEAD_RX - 12), hy + 6]], c);
}

// ===== 头饰 =====
function drawHeadwear(ctx, spec) {
  const hy = HEAD_Y;
  switch (spec.head) {
    case 'helmet': {   // 科林斯盔：碗形盔体 + 护鼻 + 颊片 + 马鬃冠
      shape(ctx, () => {
        ctx.moveTo(-HEAD_RX - 6, hy - 2);
        ctx.bezierCurveTo(-HEAD_RX - 8, hy - HEAD_RY - 22, HEAD_RX + 8, hy - HEAD_RY - 22, HEAD_RX + 6, hy - 2);
        ctx.lineTo(HEAD_RX + 6, hy - 18);
        ctx.lineTo(-HEAD_RX - 6, hy - 18);
        ctx.closePath();
      }, '#c08e42');
      for (const s of [-1, 1]) {   // 颊片：只挡住脸的外侧，不遮五官
        poly(ctx, [[s * (HEAD_RX + 6), hy - 18], [s * (HEAD_RX + 4), hy + 44],
                   [s * (HEAD_RX - 14), hy + 30], [s * (HEAD_RX - 10), hy - 18]], '#c08e42');
      }
      poly(ctx, [[-5, hy - 20], [5, hy - 20], [4, hy + 22], [-4, hy + 22]], '#c08e42');   // 护鼻
      ctx.save(); ctx.strokeStyle = 'rgba(36,31,51,.35)'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-HEAD_RX - 5, hy - 24); ctx.lineTo(HEAD_RX + 5, hy - 24); ctx.stroke();
      ctx.restore();
      shape(ctx, () => {   // 马鬃冠
        ctx.moveTo(-8, hy - HEAD_RY - 18);
        ctx.bezierCurveTo(0, hy - HEAD_RY - 76, 34, hy - HEAD_RY - 72, 44, hy - HEAD_RY - 30);
        ctx.bezierCurveTo(48, hy - HEAD_RY + 16, 34, hy - HEAD_RY + 24, 30, hy - HEAD_RY + 6);
        ctx.bezierCurveTo(26, hy - HEAD_RY - 34, 10, hy - HEAD_RY - 30, -8, hy - HEAD_RY - 18);
        ctx.closePath();
      }, PAL.terra);
      break;
    }
    case 'laurel':
      for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + s * (0.26 + i * 0.29);
        ctx.save();
        ctx.translate(Math.cos(a) * (HEAD_RX + 4), hy - 4 + Math.sin(a) * (HEAD_RY + 4));
        ctx.rotate(a + Math.PI / 2);
        ellipse(ctx, 0, 0, 13, 6.5, PAL.olive, OUTLINE, 2);
        ctx.restore();
      }
      break;
    case 'band':
      shape(ctx, () => {
        ctx.moveTo(-HEAD_RX - 3, hy - 16);
        ctx.quadraticCurveTo(0, hy - 34, HEAD_RX + 3, hy - 16);
        ctx.lineTo(HEAD_RX + 3, hy - 2);
        ctx.quadraticCurveTo(0, hy - 20, -HEAD_RX - 3, hy - 2);
        ctx.closePath();
      }, PAL.bronze);
      break;
    case 'crown':
      poly(ctx, [[-HEAD_RX, hy - 18], [HEAD_RX, hy - 18], [HEAD_RX, hy - 40],
                 [HEAD_RX * 0.6, hy - 26], [HEAD_RX * 0.3, hy - 52], [0, hy - 28],
                 [-HEAD_RX * 0.3, hy - 52], [-HEAD_RX * 0.6, hy - 26], [-HEAD_RX, hy - 40]], PAL.bronze);
      break;
    case 'veil':
      shape(ctx, () => {
        ctx.moveTo(-HEAD_RX - 14, hy + 92);
        ctx.bezierCurveTo(-HEAD_RX - 26, hy - 40, -20, hy - HEAD_RY - 18, 0, hy - HEAD_RY - 18);
        ctx.bezierCurveTo(20, hy - HEAD_RY - 18, HEAD_RX + 26, hy - 40, HEAD_RX + 14, hy + 92);
        ctx.lineTo(HEAD_RX - 2, hy + 86);
        ctx.bezierCurveTo(HEAD_RX + 8, hy - 32, 16, hy - HEAD_RY - 2, 0, hy - HEAD_RY - 2);
        ctx.bezierCurveTo(-16, hy - HEAD_RY - 2, -HEAD_RX - 8, hy - 32, -HEAD_RX + 2, hy + 86);
        ctx.closePath();
      }, '#efe6d2');
      break;
    case 'hood':
      shape(ctx, () => {
        ctx.moveTo(-HEAD_RX - 18, hy + 100);
        ctx.bezierCurveTo(-HEAD_RX - 30, hy - 50, -24, hy - HEAD_RY - 26, 0, hy - HEAD_RY - 26);
        ctx.bezierCurveTo(24, hy - HEAD_RY - 26, HEAD_RX + 30, hy - 50, HEAD_RX + 18, hy + 100);
        ctx.lineTo(HEAD_RX, hy + 92);
        ctx.bezierCurveTo(HEAD_RX + 6, hy - 26, 18, hy - HEAD_RY + 4, 0, hy - HEAD_RY + 4);
        ctx.bezierCurveTo(-18, hy - HEAD_RY + 4, -HEAD_RX - 6, hy - 26, -HEAD_RX, hy + 92);
        ctx.closePath();
      }, '#5a5248');
      break;
    case 'petasos':
      ellipse(ctx, 0, hy - HEAD_RY + 6, 80, 14, '#dfe8ec');
      ellipse(ctx, 0, hy - HEAD_RY - 12, 38, 22, '#dfe8ec');
      for (const s of [-1, 1]) poly(ctx, [[s * 72, hy - HEAD_RY], [s * 102, hy - HEAD_RY - 26], [s * 74, hy - HEAD_RY + 12]], '#fff');
      break;
  }
}

// 小头像：图鉴、卡面、战斗队列里用
export function drawHeadshot(ctx, spec, cx, cy, r, emote = 'calm') {
  if (!spec) return;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = PAL.clay; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  const s = r / 74;
  drawPortrait(ctx, spec, cx, cy + 292 * s, s, emote, 0);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
