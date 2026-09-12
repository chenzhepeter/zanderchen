// 分层程序化背景：天空渐变 → 光源 → 远景剪影 → 海 → 中景 → 前景。
// 每个场景一份 {palette, layers} spec，不用任何图片资源。
import { PAL, OUTLINE, poly, ellipse, shape, rng, roundRect } from './common.js';

export const W = 1200, H = 700;

// far / mid / fg 的可选值见下面各 draw* 函数
export const SCENES = {
  troy_burn:   { sky: ['#4a1f22', '#c1512f', '#e8a05c'], light: { t: 'sun', x: 0.72, y: 0.30, c: '#ffd98a' },
                 far: 'ruins', farC: '#3a2430', sea: null, ground: '#7a5236', fg: 'fire' },
  ship_day:    { sky: ['#5fa8d3', '#9fd0e8', '#dff0f7'], light: { t: 'sun', x: 0.24, y: 0.20, c: '#fff3c4' },
                 far: 'island', farC: '#3f5f6b', sea: PAL.sea, seaY: 0.56, fg: 'ship' },
  ship_storm:  { sky: ['#1a1f2e', '#2f3b52', '#54607a'], light: { t: 'none' }, rain: true,
                 far: 'none', sea: '#16283d', seaY: 0.50, waveAmp: 16, fg: 'ship' },
  ship_night:  { sky: ['#0d1526', '#1b2b45', '#2c4568'], light: { t: 'moon', x: 0.76, y: 0.22, c: '#e8eefc' }, stars: 90,
                 far: 'island', farC: '#16233a', sea: '#12243a', seaY: 0.58, fg: 'ship' },
  beach_day:   { sky: ['#6bb2d6', '#a9d8ea', '#e6f2f6'], light: { t: 'sun', x: 0.78, y: 0.18, c: '#fff3c4' },
                 far: 'hills', farC: '#5e7a4e', sea: PAL.sea, seaY: 0.52, ground: '#e0c48d', fg: 'rocks' },
  beach_dusk:  { sky: ['#3d2a4a', '#a5486a', '#e8a05c'], light: { t: 'sun', x: 0.18, y: 0.36, c: '#ffcf7a' },
                 far: 'hills', farC: '#3a2f42', sea: PAL.wine, seaY: 0.54, ground: '#8f6b4a', fg: 'rocks' },
  ismarus:     { sky: ['#4a2a2a', '#b3512f', '#e0975a'], light: { t: 'sun', x: 0.30, y: 0.30, c: '#ffd08a' },
                 far: 'town', farC: '#43303a', sea: null, ground: '#9a7048', fg: 'fire' },
  lotus_isle:  { sky: ['#7fc4a8', '#bfe3cd', '#f0f6e8'], light: { t: 'sun', x: 0.5, y: 0.16, c: '#fff8d0' },
                 far: 'palms', farC: '#4a7a5c', sea: '#2f7f8f', seaY: 0.55, ground: '#dcd08a', fg: 'lotus' },
  cave_in:     { sky: ['#120f18', '#231b26', '#3a2a2e'], light: { t: 'fire', x: 0.5, y: 0.62, c: '#ff9a4a' },
                 far: 'cave', farC: '#191320', sea: null, ground: '#3a2c2a', fg: 'flock' },
  cave_mouth:  { sky: ['#1a1524', '#2e2331', '#8a5a3a'], light: { t: 'sun', x: 0.5, y: 0.50, c: '#ffd08a' },
                 far: 'cavemouth', farC: '#140f1c', sea: null, ground: '#332624', fg: 'rocks' },
  aeolia:      { sky: ['#3f6fa8', '#8fc0dd', '#dcecf4'], light: { t: 'sun', x: 0.62, y: 0.20, c: '#fff3c4' },
                 far: 'wall', farC: '#7a6a8c', sea: PAL.sea, seaY: 0.60, fg: 'ship' },
  telepylos:   { sky: ['#2a3550', '#4c5f7e', '#8fa0b8'], light: { t: 'none' },
                 far: 'cliffs', farC: '#232c3f', sea: '#16283d', seaY: 0.58, fg: 'rocks' },
  aeaea_wood:  { sky: ['#2f4a38', '#5c8259', '#b9d2a4'], light: { t: 'sun', x: 0.3, y: 0.14, c: '#eaf6c8' },
                 far: 'forest', farC: '#243a2c', sea: null, ground: '#4a5c3a', fg: 'columns' },
  aeaea_hall:  { sky: ['#3a2438', '#6b3a52', '#c1512f'], light: { t: 'fire', x: 0.5, y: 0.4, c: '#ffb06a' },
                 far: 'temple', farC: '#2a1c2c', sea: null, ground: '#5c4038', fg: 'columns' },
  underworld:  { sky: ['#0a0d14', '#161d2c', '#2a2038'], light: { t: 'moon', x: 0.5, y: 0.24, c: '#8fa6c8' }, stars: 40,
                 far: 'asphodel', farC: '#101725', sea: '#0e1420', seaY: 0.66, fg: 'fire' },
  strait:      { sky: ['#2a2438', '#5c4a6a', '#c1723f'], light: { t: 'sun', x: 0.5, y: 0.34, c: '#ffb87a' },
                 far: 'strait', farC: '#241d30', sea: '#1d3450', seaY: 0.56, waveAmp: 12, fg: 'ship' },
  thrinacia:   { sky: ['#c98a3a', '#e8c46a', '#f5e3b0'], light: { t: 'sun', x: 0.5, y: 0.18, c: '#fffbe0' },
                 far: 'hills', farC: '#8a7a3a', sea: '#3f6f8a', seaY: 0.54, ground: '#c9a85e', fg: 'cattle' },
  ogygia:      { sky: ['#1b3a5c', '#3f7fa8', '#a8d8d0'], light: { t: 'moon', x: 0.22, y: 0.18, c: '#eef6ff' }, stars: 120,
                 far: 'island', farC: '#1b3a3a', sea: '#12283f', seaY: 0.60, fg: 'raft' },
  scheria:     { sky: ['#4a6fa8', '#8fb8d8', '#e2eef4'], light: { t: 'sun', x: 0.7, y: 0.18, c: '#fff3c4' },
                 far: 'palace', farC: '#6a6a8a', sea: PAL.sea, seaY: 0.62, ground: '#d8c9a0', fg: 'columns' },
  ithaca_shore:{ sky: ['#4f7fb0', '#9ec6dd', '#eaf3f7'], light: { t: 'sun', x: 0.3, y: 0.20, c: '#fff3c4' },
                 far: 'hills', farC: '#4a6b46', sea: PAL.sea, seaY: 0.56, ground: '#c9b184', fg: 'rocks' },
  megaron:     { sky: ['#2a1f2c', '#4a3240', '#7a4a3a'], light: { t: 'fire', x: 0.5, y: 0.44, c: '#ffb06a' },
                 far: 'temple', farC: '#1e1622', sea: null, ground: '#5c4436', fg: 'columns' },
  olive_room:  { sky: ['#241f33', '#3f3448', '#6b5a55'], light: { t: 'fire', x: 0.34, y: 0.42, c: '#ffc98a' },
                 far: 'temple', farC: '#1a1522', sea: null, ground: '#4a3a34', fg: 'olive' },
};

export function drawScene(ctx, id, t = 0) {
  const s = SCENES[id] || SCENES.ship_day;
  const seaY = (s.seaY || 0.6) * H;
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  // ---- 天空 ----
  const g = ctx.createLinearGradient(0, 0, 0, s.sea ? seaY : H);
  const stops = s.sky;
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  if (s.stars) drawStars(ctx, s.stars, seaY, id);
  drawLight(ctx, s.light, t);
  if (s.far && s.far !== 'none') drawFar(ctx, s.far, s.farC, s.sea ? seaY : H * 0.82, id);
  if (s.sea) drawSea(ctx, s.sea, seaY, t, s.waveAmp || 7);
  else if (s.ground) drawGround(ctx, s.ground, H * 0.72);
  if (s.sea && s.ground) drawGround(ctx, s.ground, H * 0.80);
  if (s.rain) drawRain(ctx, t);
  if (s.fg && s.fg !== 'none') drawFg(ctx, s.fg, s, t, id);

  // 陶器风的暗角，把中间的文字与立绘衬出来
  const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.30, W / 2, H * 0.5, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(20,14,26,0.42)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ===== 光源 =====
function drawLight(ctx, l, t) {
  if (!l || l.t === 'none') return;
  const x = l.x * W, y = l.y * H;
  const r = l.t === 'fire' ? 150 : 60;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
  g.addColorStop(0, rgba(l.c, 0.95));
  g.addColorStop(0.18, rgba(l.c, 0.45));
  g.addColorStop(0.55, rgba(l.c, 0.12));
  g.addColorStop(1, rgba(l.c, 0));
  ctx.save(); ctx.globalAlpha = l.t === 'fire' ? 0.55 + Math.sin(t * 3) * 0.08 : 0.7;
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (l.t === 'sun' || l.t === 'moon') {
    ctx.save(); ctx.globalAlpha = 0.95;
    ctx.fillStyle = l.c; ctx.beginPath(); ctx.arc(x, y, l.t === 'moon' ? 34 : 40, 0, Math.PI * 2); ctx.fill();
    if (l.t === 'moon') {   // 缺角做成弦月
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(x + 16, y - 8, 30, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawStars(ctx, n, maxY, seed) {
  const r = rng(hash(seed));
  ctx.save(); ctx.fillStyle = '#fff';
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * maxY * 0.9;
    ctx.globalAlpha = 0.35 + r() * 0.65;
    ctx.beginPath(); ctx.arc(x, y, r() * 1.6 + 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ===== 远景剪影 =====
function drawFar(ctx, kind, color, baseY, seed) {
  const r = rng(hash(seed + kind));
  ctx.save();
  const c = color || '#2a2a3a';
  switch (kind) {
    case 'island': case 'hills': {
      for (let k = 0; k < 3; k++) {
        const cx = (0.15 + k * 0.35) * W + r() * 90;
        const w = 200 + r() * 260, h = 70 + r() * 90;
        ctx.globalAlpha = 0.95 - k * 0.10;
        poly(ctx, [[cx - w / 2, baseY], [cx - w * 0.22, baseY - h], [cx + w * 0.1, baseY - h * 0.7],
                   [cx + w * 0.3, baseY - h * 1.1], [cx + w / 2, baseY]], c, null);
      }
      break;
    }
    case 'cliffs': case 'strait': {
      ctx.globalAlpha = 0.95;
      poly(ctx, [[-20, baseY], [-20, H * 0.02], [W * 0.20, H * 0.05], [W * 0.30, baseY]], c, null);
      poly(ctx, [[W + 20, baseY], [W + 20, H * 0.02], [W * 0.80, H * 0.04], [W * 0.70, baseY]], c, null);
      break;
    }
    case 'ruins': case 'town': {
      for (let k = 0; k < 9; k++) {
        const x = 60 + k * 130 + r() * 30, w = 70 + r() * 50, h = 90 + r() * 130;
        ctx.globalAlpha = 1;
        poly(ctx, [[x, baseY], [x, baseY - h], [x + w, baseY - h * (kind === 'ruins' ? 0.6 + r() * 0.5 : 1)], [x + w, baseY]], c, null);
        if (kind === 'town') poly(ctx, [[x - 8, baseY - h], [x + w / 2, baseY - h - 26], [x + w + 8, baseY - h]], c, null);
      }
      break;
    }
    case 'temple': case 'palace': {
      const bx = W * 0.5, bw = 620, top = baseY - 250;
      ctx.globalAlpha = 0.92;
      poly(ctx, [[bx - bw / 2 - 30, top], [bx, top - 90], [bx + bw / 2 + 30, top]], c, null);
      for (let i = 0; i < 7; i++) {
        const x = bx - bw / 2 + 26 + i * (bw - 52) / 6;
        poly(ctx, [[x - 20, baseY], [x - 16, top], [x + 16, top], [x + 20, baseY]], c, null);
      }
      break;
    }
    case 'forest': case 'palms': {
      for (let k = 0; k < 14; k++) {
        const x = r() * W, h = 120 + r() * 160;
        ctx.globalAlpha = 0.8;
        if (kind === 'palms') {
          poly(ctx, [[x - 6, baseY], [x - 2, baseY - h], [x + 4, baseY - h], [x + 8, baseY]], c, null);
          for (let f = 0; f < 5; f++) {
            const a = -Math.PI / 2 + (f - 2) * 0.5;
            poly(ctx, [[x + 1, baseY - h], [x + 1 + Math.cos(a) * 70, baseY - h + Math.sin(a) * 46],
                       [x + 1 + Math.cos(a) * 60, baseY - h + Math.sin(a) * 30]], c, null);
          }
        } else {
          poly(ctx, [[x - 40, baseY], [x, baseY - h], [x + 40, baseY]], c, null);
        }
      }
      break;
    }
    case 'wall': {
      ctx.globalAlpha = 0.9;
      poly(ctx, [[W * 0.1, baseY], [W * 0.1, baseY - 190], [W * 0.9, baseY - 190], [W * 0.9, baseY]], c, null);
      for (let i = 0; i < 14; i++) {
        const x = W * 0.1 + i * (W * 0.8 / 14);
        poly(ctx, [[x, baseY - 190], [x, baseY - 222], [x + 34, baseY - 222], [x + 34, baseY - 190]], c, null);
      }
      break;
    }
    case 'cave': {
      ctx.globalAlpha = 1;
      for (let i = 0; i < 12; i++) {   // 钟乳石
        const x = i * (W / 11), h = 60 + r() * 130;
        poly(ctx, [[x - 32, -4], [x + 32, -4], [x, h]], c, null);
      }
      break;
    }
    case 'cavemouth': {
      ctx.globalAlpha = 1;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.moveTo(W * 0.5, H * 0.86);
      ctx.bezierCurveTo(W * 0.20, H * 0.86, W * 0.24, H * 0.18, W * 0.5, H * 0.18);
      ctx.bezierCurveTo(W * 0.76, H * 0.18, W * 0.80, H * 0.86, W * 0.5, H * 0.86);
      ctx.fill('evenodd');
      break;
    }
    case 'asphodel': {
      ctx.globalAlpha = 0.5; ctx.strokeStyle = c; ctx.lineWidth = 2;
      for (let k = 0; k < 90; k++) {
        const x = r() * W, y = baseY - r() * 150;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 8, y - 20 - r() * 24); ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

// ===== 海 =====
function drawSea(ctx, color, y, t, amp) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, H);
  g.addColorStop(0, color);
  g.addColorStop(1, shadeHex(color, -0.35));
  ctx.fillStyle = g; ctx.fillRect(0, y, W, H - y);
  // 多条相位差正弦波带，滚动出海浪
  for (let b = 0; b < 7; b++) {
    const by = y + 14 + b * ((H - y) / 7);
    const ph = t * (0.5 + b * 0.16) + b * 1.7;
    const a = amp * (0.35 + b * 0.14);
    ctx.globalAlpha = 0.13 + b * 0.02;
    ctx.fillStyle = '#eaf4ff';
    ctx.beginPath(); ctx.moveTo(0, by);
    for (let x = 0; x <= W; x += 24) ctx.lineTo(x, by + Math.sin(x / 130 + ph) * a);
    ctx.lineTo(W, by + 7); ctx.lineTo(0, by + 7); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(0, y);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x / 100 + t) * (amp * 0.4));
  ctx.stroke();
  ctx.restore();
}

function drawGround(ctx, color, y) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, H);
  g.addColorStop(0, color); g.addColorStop(1, shadeHex(color, -0.4));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, y + 14);
  for (let x = 0; x <= W; x += 60) ctx.quadraticCurveTo(x + 30, y + (x % 120 ? 2 : 24), x + 60, y + 14);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawRain(ctx, t) {
  ctx.save(); ctx.strokeStyle = 'rgba(200,220,255,0.42)'; ctx.lineWidth = 1.6;
  const r = rng(7);
  for (let i = 0; i < 160; i++) {
    const x = (r() * W + t * 220) % W, y = (r() * H + t * 900) % H;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 9, y + 26); ctx.stroke();
  }
  ctx.restore();
}

// ===== 前景 =====
function drawFg(ctx, kind, s, t, seed) {
  const r = rng(hash(seed + kind));
  ctx.save();
  switch (kind) {
    case 'ship': {   // 船舷 + 一排桨，撑住画面下缘
      const y = H - 92 + Math.sin(t * 1.1) * 7;
      poly(ctx, [[-40, H + 40], [-40, y + 26], [W * 0.5, y], [W + 40, y + 26], [W + 40, H + 40]], '#7a4a2a');
      poly(ctx, [[-40, y + 26], [W * 0.5, y], [W + 40, y + 26], [W + 40, y + 46], [W * 0.5, y + 20], [-40, y + 46]], '#a3663a');
      for (let i = 0; i < 9; i++) {
        const x = 70 + i * 135, ph = Math.sin(t * 1.6 + i * 0.4) * 10;
        poly(ctx, [[x, y + 40], [x + 26, y + 40], [x + 62, H + 30 + ph], [x + 34, H + 30 + ph]], '#8a5a34');
      }
      break;
    }
    case 'raft': {
      const y = H - 70 + Math.sin(t * 1.4) * 12;
      for (let i = 0; i < 9; i++) poly(ctx, [[W * 0.18 + i * 84, y], [W * 0.18 + i * 84 + 76, y - 6],
        [W * 0.18 + i * 84 + 76, H + 20], [W * 0.18 + i * 84, H + 20]], i % 2 ? '#8a5a34' : '#7a4a2a');
      break;
    }
    case 'rocks': {
      for (let i = 0; i < 6; i++) {
        const x = r() * W, w = 90 + r() * 150, h = 50 + r() * 90;
        poly(ctx, [[x - w / 2, H + 20], [x - w * 0.3, H - h], [x + w * 0.1, H - h * 0.7],
                   [x + w * 0.36, H - h * 1.05], [x + w / 2, H + 20]], '#4a3f42');
      }
      break;
    }
    case 'columns': {   // 前景廊柱：把画面框成室内
      for (const x of [W * 0.06, W * 0.94]) {
        poly(ctx, [[x - 46, H + 20], [x - 38, 40], [x + 38, 40], [x + 46, H + 20]], '#d8c7a4');
        poly(ctx, [[x - 58, 40], [x - 58, -6], [x + 58, -6], [x + 58, 40]], '#c4b08c');
        for (let i = 0; i < 5; i++) {
          ctx.strokeStyle = 'rgba(36,31,51,0.30)'; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.moveTo(x - 30 + i * 15, 46); ctx.lineTo(x - 34 + i * 17, H + 20); ctx.stroke();
        }
      }
      break;
    }
    case 'fire': {   // 篝火 / 祭坛火
      const fx = (s.light?.x || 0.5) * W, fy = H - 90;
      poly(ctx, [[fx - 70, H + 10], [fx - 46, fy + 22], [fx + 46, fy + 22], [fx + 70, H + 10]], '#4a3a34');
      for (let i = 0; i < 5; i++) {
        const a = 0.7 + Math.sin(t * 5 + i) * 0.3, hgt = 60 + i * 12 + Math.sin(t * 6 + i * 2) * 18;
        ctx.globalAlpha = a * 0.8;
        poly(ctx, [[fx - 30 + i * 15, fy + 20], [fx - 22 + i * 15, fy + 20 - hgt], [fx - 14 + i * 15, fy + 20]],
          i % 2 ? '#ffb04a' : '#ff7a2a', null);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'flock': {   // 洞里的羊群
      for (let i = 0; i < 7; i++) {
        const x = 90 + i * 165 + r() * 30, y = H - 60 - r() * 30, sc = 0.8 + r() * 0.4;
        ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
        ellipse(ctx, 0, 0, 46, 30, '#efe6d2');
        ellipse(ctx, 40, -16, 17, 14, '#d8cbb0');
        poly(ctx, [[-28, 26], [-22, 26], [-22, 46], [-28, 46]], '#c4b08c');
        poly(ctx, [[24, 26], [30, 26], [30, 46], [24, 46]], '#c4b08c');
        ctx.restore();
      }
      break;
    }
    case 'cattle': {
      for (let i = 0; i < 4; i++) {
        const x = 140 + i * 300, y = H - 120 - r() * 40, sc = 0.9 + r() * 0.3;
        ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
        ellipse(ctx, 0, 0, 66, 38, '#e8dcc0');
        ellipse(ctx, 58, -22, 22, 18, '#d8c8a4');
        poly(ctx, [[46, -36], [40, -54], [52, -40]], '#efe6d2');
        poly(ctx, [[70, -36], [76, -54], [64, -40]], '#efe6d2');
        for (const lx of [-40, -14, 20, 44]) poly(ctx, [[lx, 32], [lx + 11, 32], [lx + 11, 62], [lx, 62]], '#c4b08c');
        ctx.restore();
      }
      break;
    }
    case 'lotus': {
      for (let i = 0; i < 12; i++) {
        const x = r() * W, y = H - 20 - r() * 90, sc = 0.6 + r() * 0.7;
        ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
        for (let p = 0; p < 6; p++) {
          const a = p * Math.PI / 3;
          poly(ctx, [[0, 0], [Math.cos(a) * 20 - 8, Math.sin(a) * 20], [Math.cos(a) * 30, Math.sin(a) * 30],
                     [Math.cos(a) * 20 + 8, Math.sin(a) * 20]], '#f0d0e0');
        }
        ellipse(ctx, 0, 0, 8, 8, '#e8c46a');
        ctx.restore();
      }
      break;
    }
    case 'olive': {
      const x = W * 0.78;
      poly(ctx, [[x - 26, H + 20], [x - 14, H - 250], [x + 14, H - 250], [x + 26, H + 20]], '#5c4632');
      for (let i = 0; i < 10; i++) {
        const a = r() * Math.PI * 2, d = 40 + r() * 90;
        ellipse(ctx, x + Math.cos(a) * d, H - 270 + Math.sin(a) * d * 0.6, 40 + r() * 30, 26 + r() * 18, '#6b7f4a');
      }
      break;
    }
  }
  ctx.restore();
}

// ===== 小工具 =====
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) { h ^= String(str).charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rgba(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function shadeHex(hex, amt) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
