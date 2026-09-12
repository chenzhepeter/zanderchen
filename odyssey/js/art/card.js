// 卡面：DOM 卡片（布局/hover/点击都免费）+ 内嵌小 canvas 插画。
// 基础牌用色带 + emoji；同伴牌画头像，神物/神怒牌画一幅小图。
import { COLORS } from '../data/cards.js';
import { CARD_TO_COMPANION, COMPANION_BY_ID } from '../data/companions.js';
import { charById } from '../data/characters.js';
import { drawHeadshot } from './portrait.js';
import { PAL, OUTLINE, poly, ellipse, shape, rng } from './common.js';

const ART_COLORS = { companion: true, relic: true, wrath: true };

export function cardHTML(card, opts = {}) {
  if (!card) return '';
  const { count = 0, idx = null, cls = '', cost = card.cost } = opts;
  const costTxt = card.unplayable ? '✕' : cost;
  return `<div class="card ${card.color} ${cls}" ${idx != null ? `data-i="${idx}"` : ''} data-card="${card.id}">
    <div class="card-top">
      <span class="card-cost">${costTxt}</span>
      <span class="card-name">${card.name}</span>
      <span class="card-icon">${card.icon}</span>
    </div>
    ${ART_COLORS[card.color] ? `<canvas class="card-art" width="240" height="112" data-art="${card.id}"></canvas>` : ''}
    <div class="card-text">${card.text}</div>
    ${count > 1 ? `<span class="card-count">×${count}</span>` : ''}
  </div>`;
}

// 把 root 里所有 canvas[data-art] 画出来。DOM 重建后调用一次即可。
export function paintCardArts(root = document) {
  root.querySelectorAll('canvas[data-art]').forEach(cv => {
    if (cv.dataset.painted === '1') return;
    const ctx = cv.getContext('2d');
    drawCardArt(ctx, cv.dataset.art, cv.width, cv.height);
    cv.dataset.painted = '1';
  });
}

export function drawCardArt(ctx, cardId, w, h) {
  ctx.clearRect(0, 0, w, h);
  const compId = CARD_TO_COMPANION[cardId];
  if (compId) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#d8c9e8'); g.addColorStop(1, '#b9a4d0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    drawHeadshot(ctx, charById(compId), w / 2, h / 2 + 4, h * 0.44, 'calm');
    return;
  }
  switch (cardId) {
    case 'r_moly':    return scene(ctx, w, h, '#cfe8d0', () => {
      ctx.save(); ctx.translate(w / 2, h * 0.86);
      ctx.strokeStyle = '#241f33'; ctx.lineWidth = 5; ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -h * 0.5); ctx.stroke();
      for (const s of [-1, 1]) ellipse(ctx, s * 16, -h * 0.36, 13, 8, '#3a2a1c');
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        ellipse(ctx, Math.cos(a) * 15, -h * 0.56 + Math.sin(a) * 15, 10, 7, '#fff');
      }
      ellipse(ctx, 0, -h * 0.56, 7, 7, '#d9a441');
      ctx.restore();
    });
    case 'r_windbag': return scene(ctx, w, h, '#cfe0f0', () => {
      ellipse(ctx, w / 2, h * 0.6, w * 0.22, h * 0.32, '#b08a5a');
      poly(ctx, [[w / 2 - 14, h * 0.26], [w / 2 + 14, h * 0.26], [w / 2 + 8, h * 0.36], [w / 2 - 8, h * 0.36]], '#d9a441');
      ctx.save(); ctx.strokeStyle = '#eef6ff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(w * 0.24, h * 0.3 + i * 16, 16, 0.4, 2.6); ctx.stroke();
      }
      ctx.restore();
    });
    case 'r_veil':    return scene(ctx, w, h, '#cfe8ec', () => {
      shape(ctx, () => {
        ctx.moveTo(w * 0.22, h * 0.9);
        ctx.bezierCurveTo(w * 0.12, h * 0.3, w * 0.88, h * 0.3, w * 0.78, h * 0.9);
        ctx.quadraticCurveTo(w * 0.5, h * 0.72, w * 0.22, h * 0.9);
        ctx.closePath();
      }, '#8fd0e8');
    });
    case 'r_mist':    return scene(ctx, w, h, '#dfe8ec', () => {
      ctx.save(); ctx.globalAlpha = 0.85;
      for (let i = 0; i < 5; i++) ellipse(ctx, w * (0.2 + i * 0.16), h * (0.4 + (i % 2) * 0.25), 30, 15, '#fff', null);
      ctx.restore();
      ellipse(ctx, w * 0.5, h * 0.5, 12, 12, '#9fd8c8');
    });
    case 'r_bow':     return scene(ctx, w, h, '#e8d8b8', () => {
      ctx.save(); ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(w * 0.62, h / 2, h * 0.36, 2.1, 4.2); ctx.stroke();
      ctx.strokeStyle = '#efe6d2'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w * 0.44, h * 0.18); ctx.lineTo(w * 0.44, h * 0.82); ctx.stroke();
      ctx.strokeStyle = '#241f33'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(w * 0.16, h / 2); ctx.lineTo(w * 0.58, h / 2); ctx.stroke();
      ctx.restore();
      poly(ctx, [[w * 0.58, h / 2 - 7], [w * 0.72, h / 2], [w * 0.58, h / 2 + 7]], '#c9c4b4');
    });
    case 'w_wave':    return scene(ctx, w, h, '#1b3a5c', () => {
      for (let b = 0; b < 3; b++) {
        ctx.save(); ctx.globalAlpha = 0.5 + b * 0.16; ctx.fillStyle = '#4a8ab0';
        ctx.beginPath(); ctx.moveTo(0, h * (0.4 + b * 0.18));
        for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h * (0.4 + b * 0.18) + Math.sin(x / 18 + b) * 7);
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      poly(ctx, [[w * 0.5, h * 0.1], [w * 0.44, h * 0.42], [w * 0.56, h * 0.42]], '#d9a441');
      for (const s of [-1, 1]) poly(ctx, [[w * 0.5 + s * 16, h * 0.14], [w * 0.5 + s * 16, h * 0.4], [w * 0.5 + s * 10, h * 0.4]], '#d9a441');
    });
    case 'w_sun':     return scene(ctx, w, h, '#c98a3a', () => {
      ctx.save(); ctx.strokeStyle = '#ffe8a0'; ctx.lineWidth = 4;
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(w / 2 + Math.cos(a) * 24, h / 2 + Math.sin(a) * 24);
        ctx.lineTo(w / 2 + Math.cos(a) * 44, h / 2 + Math.sin(a) * 44); ctx.stroke();
      }
      ctx.restore();
      ellipse(ctx, w / 2, h / 2, 22, 22, '#ffd24a');
    });
    case 'w_bolt':    return scene(ctx, w, h, '#2a2438', () => {
      poly(ctx, [[w * 0.54, h * 0.06], [w * 0.36, h * 0.52], [w * 0.5, h * 0.52],
                 [w * 0.42, h * 0.96], [w * 0.68, h * 0.42], [w * 0.52, h * 0.42], [w * 0.64, h * 0.06]], '#ffd24a');
    });
    default: {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#f0e2c8'); g.addColorStop(1, '#dcc79f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }
}

function scene(ctx, w, h, bg, draw) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, bg); g.addColorStop(1, shade(bg));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.lineJoin = 'round';
  draw();
}
function shade(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v) => Math.max(0, Math.round(v * 0.72));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
