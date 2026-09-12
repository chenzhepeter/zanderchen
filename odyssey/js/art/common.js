// 程序化矢量绘制的公共图元。
// 接口稳定：如需替换为 PNG 图集，只改各 art/*.js 里的绘制实现即可。
// 视觉母题：古希腊红绘陶器 —— 赤陶底 + 黑色粗描边 + 平涂色块，天然适合 canvas 图元。

export const OUTLINE = '#241f33';      // 与 towerclash/js/sprites.js 的 OUTLINE 保持一致
export const PAL = {
  terra:  '#c1512f',   // 赤陶红
  terra2: '#a33f22',
  clay:   '#e8c9a0',   // 陶土底
  clayLt: '#f5e2c4',
  ink:    '#241f33',
  sea:    '#1b3a5c',
  seaLt:  '#2d5b85',
  wine:   '#5b2a3e',   // 酒色的海
  bronze: '#d9a441',
  olive:  '#6b7f4a',
  bone:   '#efe6d2',
  shadow: 'rgba(36,31,51,0.28)',
};

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 平涂 + 描边一次做完，全局统一线宽与圆角接头
export function shape(ctx, path, fill, stroke = OUTLINE, lw = 2.6) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  path();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

export function ellipse(ctx, x, y, rx, ry, fill, stroke = OUTLINE, lw = 2.6) {
  shape(ctx, () => ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2), fill, stroke, lw);
}

export function poly(ctx, pts, fill, stroke = OUTLINE, lw = 2.6) {
  shape(ctx, () => {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }, fill, stroke, lw);
}

export function softShadow(ctx, x, y, rx, ry) {
  ctx.save();
  ctx.fillStyle = PAL.shadow;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// 陶器风格的回纹装饰带（meander / Greek key），用在面板与场景边框上
export function meander(ctx, x, y, w, unit = 10, color = PAL.ink, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.6, unit * 0.22);
  ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  const u = unit;
  for (let i = 0; x + i * u * 4 + u * 4 <= x + w; i++) {
    const bx = x + i * u * 4;
    ctx.beginPath();
    ctx.moveTo(bx, y + u * 2);
    ctx.lineTo(bx, y);
    ctx.lineTo(bx + u * 3, y);
    ctx.lineTo(bx + u * 3, y + u * 2);
    ctx.lineTo(bx + u, y + u * 2);
    ctx.lineTo(bx + u, y + u);
    ctx.lineTo(bx + u * 2, y + u);
    ctx.stroke();
  }
  ctx.restore();
}

// 带描边的文字：场景里的地名、人物名牌都用它，保证任何底色上都读得清
export function outlinedText(ctx, text, x, y, size, fill = PAL.clayLt, stroke = OUTLINE, align = 'center') {
  ctx.save();
  ctx.font = `700 ${size}px 'Noto Serif SC', Georgia, serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke; ctx.lineWidth = size * 0.28;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// 确定性伪随机：同一个场景每次进入都长一样，不会闪烁
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// DPR 感知 + letterbox 虚拟分辨率（照搬 towerclash/js/render.js 的 makeView / toVirtual）
export function fitCanvas(canvas, W, H) { return fit(canvas, W, H, Math.min); }

// cover：按较大的比例缩放，画面永远填满视口（多出来的部分裁掉）。
// 背景是程序化画的，裁掉边缘不心疼；换来的是在 iPad 竖屏 / 手机上不会缩成一条窄带。
// 返回值里的 vx0/vx1/vy0/vy1 是「当前可见的那块虚拟矩形」——
// 立绘与战斗单位按它定位，才不会被裁到画面外。
export function fitCover(canvas, W, H) { return fit(canvas, W, H, Math.max); }

function fit(canvas, W, H, pick) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1;
  const bw = Math.round(cw * dpr), bh = Math.round(ch * dpr);
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  const ctx = canvas.getContext('2d');
  const s = pick(cw / W, ch / H);
  const ox = (cw - W * s) / 2, oy = (ch - H * s) / 2;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  return {
    ctx, scale: s, ox, oy, cw, ch,
    vx0: -ox / s, vx1: (cw - ox) / s,
    vy0: -oy / s, vy1: (ch - oy) / s,
    toVX: (cssX) => (cssX - ox) / s,
    toVY: (cssY) => (cssY - oy) / s,
  };
}

// 屏幕坐标 → 虚拟坐标（点击命中用）
export function toVirtual(view, clientX, clientY, rect) {
  return { x: (clientX - rect.left - view.ox) / view.scale, y: (clientY - rect.top - view.oy) / view.scale };
}
