import { BUGS, DEFENDERS } from './data/config.js';
import { vrand } from './effects.js';
const TAU = Math.PI * 2;
const line = (c, ax, ay, bx, by, color, width) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); };
function oval(c, x, y, rx, ry, fill, stroke, width = 0.08) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } }
function material(c, x, y, radius, light, mid, dark) { const g = c.createRadialGradient(x - radius * 0.3, y - radius * 0.4, 0, x, y, radius); g.addColorStop(0, light); g.addColorStop(0.55, mid); g.addColorStop(1, dark); return g; }

export function drawBugModel(c, e, seconds, opacity = 1) {
  const cfg = BUGS[e.type], armor = e.type === 'armor', air = cfg.air, dead = opacity < 1;
  const scale = armor ? 1.8 : e.type === 'runner' ? 0.83 : 1.12;
  const step = e.walk || 0, attack = e.attackFlash > 0 ? Math.sin((1 - e.attackFlash / 0.32) * Math.PI) : 0;
  const bob = dead ? 0 : Math.sin(step * 2) * 0.055;
  c.save(); c.globalAlpha = opacity;
  oval(c, e.x + (air ? 0.9 : 0.35), e.y + (air ? 1.4 : 0.42), scale * 1.2, scale * 0.65, '#1720175e');
  c.translate(e.x, e.y - (air ? 1.1 + Math.sin(seconds * 5 + (e.variant || 0) * 7) * 0.15 : 0));
  c.rotate(e.angle || 0); if (air) c.scale(1, 1 - Math.min(0.25, Math.abs(e.bank || 0) * 0.25)); c.scale(scale, scale); c.translate(attack * 0.3, bob);
  // 昆虫的三组关节腿使用错相步态，落脚点跟随真实位移。
  c.lineCap = 'round';
  for (let i = 0; i < 3; i++) for (const sign of [-1, 1]) {
    const phase = step * 2.3 + i * 2.09 + (sign > 0 ? Math.PI : 0);
    const swing = dead ? -0.3 : air ? Math.sin(seconds*5+i)*0.04 : Math.sin(phase) * 0.27;
    const hipX = -0.75 + i * 0.57, kneeX = hipX - 0.3 + swing, kneeY = sign * (air ? 0.55 : 0.96 + Math.cos(phase) * 0.08);
    const footX = hipX + (i - 1) * 0.43 - swing, footY = sign * (dead ? 0.8 : air ? 0.75 : 1.45);
    line(c, hipX, sign * 0.28, kneeX, kneeY, '#1d271c', armor ? 0.3 : 0.19);
    line(c, hipX, sign * 0.28 - 0.03, kneeX, kneeY - 0.03, armor ? '#8a9271' : '#81744b', armor ? 0.15 : 0.09);
    oval(c, kneeX, kneeY, 0.12, 0.12, '#a59664', '#293321', 0.04);
    line(c, kneeX, kneeY, footX, footY, '#2a3120', armor ? 0.19 : 0.12);
    line(c, footX, footY, footX + 0.17, footY + sign * 0.12, '#c5b789', 0.08);
  }
  if (air) {
    const flap = Math.sin(seconds * 37 + (e.variant || 0) * 13), width = 1.3 + Math.abs(flap) * 1.2;
    for (const sign of [-1, 1]) {
      c.fillStyle = '#c4bf8a4d'; c.strokeStyle = '#5b6544b3'; c.lineWidth = 0.06;
      c.beginPath(); c.moveTo(0.4, sign * 0.25); c.bezierCurveTo(-0.4, sign * width, -1.4, sign * (width + 0.35), -1.8, sign * 0.9); c.lineTo(-0.8, 0); c.closePath(); c.fill(); c.stroke();
      for (let j = 0; j < 4; j++) line(c, 0.1, sign * 0.2, -0.3 - j * 0.38, sign * (width - j * 0.23), '#d0cc9a61', 0.04);
    }
  }
  if (e.burnTime > 0 && !dead) { c.save(); c.globalCompositeOperation='screen'; oval(c,0,0,1.8,1.1,material(c,0,0,1.8,'#ffad55aa','#ff771c44','#ff4a0000')); c.restore(); }
  const flesh = e.hit > 0 ? '#c9bf8a' : armor ? '#8a9675' : e.type === 'runner' ? '#b49a57' : '#9b8852';
  oval(c, -0.6, 0, 0.95, 0.52, material(c, -0.6, 0, 1, flesh, cfg.color, '#202b1b'), '#202a1c', 0.12);
  for (let i = 0; i < (armor ? 5 : 4); i++) {
    const x = -1.25 + i * 0.37;
    c.beginPath(); c.moveTo(x + 0.13, -0.43); c.quadraticCurveTo(x + 0.39, 0, x + 0.13, 0.43); c.strokeStyle = armor ? '#b4b99588' : '#d2bb7a66'; c.lineWidth = armor ? 0.13 : 0.07; c.stroke();
  }
  oval(c, 0.25, 0, 0.5, 0.43, material(c, 0.25, 0, 0.6, '#b7ad79', cfg.color, '#26301d'), '#20291c', 0.09);
  oval(c, 0.73, 0, 0.37, 0.3, material(c, 0.73, 0, 0.4, '#a9a477', '#424c2b', '#1c291a'), '#20291c');
  for (const sign of [-1, 1]) {
    oval(c, 0.9, sign * 0.18, 0.09, 0.06, dead ? '#6c682f' : '#f7b654');
    const open = 0.15 + attack * 0.2;
    line(c, 0.93, sign * open, 1.43, sign * (0.5 + attack * 0.18), '#b9b38b', armor ? 0.19 : 0.13);
    line(c, 1.43, sign * (0.5 + attack * 0.18), 1.65 + attack * 0.15, sign * 0.11, '#ddd0a2', armor ? 0.16 : 0.09);
    line(c, 0.75, sign * 0.22, 1.17, sign * 0.67, '#495331', 0.055);
  }
  if (armor) for (let i = 0; i < 3; i++) { c.fillStyle = '#b2b58b'; c.beginPath(); c.moveTo(-1.1 + i * 0.47, -0.42); c.lineTo(-0.95 + i * 0.47, -0.75); c.lineTo(-0.72 + i * 0.47, -0.38); c.fill(); }
  c.restore();
  if (armor && e.hp < e.maxHp && !dead) { c.fillStyle = '#202e22'; c.fillRect(e.x - 2.2, e.y + 2.6, 4.4, 0.3); c.fillStyle = '#e4ad65'; c.fillRect(e.x - 2.2, e.y + 2.6, 4.4 * e.hp / e.maxHp, 0.3); }
}

export function drawWeaponModel(c, u, seconds) {
  c.save(); c.translate(u.x, u.y);
  oval(c, 0.4, 0.5, u.type === 'infantry' ? 1.6 : 1.7, 0.85, '#17231966');
  c.rotate(u.angle); const flash = u.fire > 0;
  if (u.type === 'infantry' || u.type === 'flamethrower') {
    const flame = u.type === 'flamethrower';
    const positions = flame ? [{x:0,y:0}] : [{ x: 0.3, y: 0 }, { x: -0.65, y: -0.8 }, { x: -0.65, y: 0.8 }];
    for (const [i, p] of positions.entries()) {
      const stride = u.path.length ? Math.sin(seconds * 13 + i * 2) * 0.15 : 0;
      line(c, p.x - 0.35, p.y - 0.15, p.x - 0.73 + stride, p.y - 0.26, '#26342a', 0.22);
      line(c, p.x - 0.35, p.y + 0.15, p.x - 0.73 - stride, p.y + 0.26, '#26342a', 0.22);
      oval(c, p.x, p.y, 0.52, 0.38, material(c, p.x, p.y, 0.6, '#a5ad8a', '#5b7156', '#253b2b'), '#273729');
      line(c, p.x + 0.05, p.y - 0.25, p.x + 0.45, p.y - 0.15, '#abb491', 0.17);
      line(c, p.x + 0.05, p.y + 0.25, p.x + 0.45, p.y + 0.1, '#7f8c6b', 0.17);
      line(c, p.x + 0.18, p.y, p.x + 1.02, p.y, '#1a281f', 0.14);
      line(c, p.x + 0.48, p.y - 0.04, p.x + 0.9, p.y - 0.04, '#bcc0a7', 0.045);
      oval(c, p.x - 0.15, p.y, 0.26, 0.27, material(c, p.x, p.y, 0.4, '#b8c0a3', '#6e8661', '#30452f'), '#374930', 0.07);
      if (flame) {
        for (const y of [-0.33,0.33]) oval(c,-0.63,y,0.42,0.22,material(c,-0.63,y,0.5,'#d8b27b','#8a6f43','#3f4430'),'#313b2a');
        c.beginPath();c.moveTo(-0.7,0.4);c.quadraticCurveTo(0.1,1,0.65,0.12);c.strokeStyle='#403c24';c.lineWidth=0.12;c.stroke();
        if(u.flameTime>0)drawFlameJet(c,u,seconds);
      }
      if (flash && !flame) muzzle(c, p.x + 1.17, p.y, 0.45, seconds + i);
    }
  } else {
    oval(c, 0, 0, 1.5, 1.25, '#414f40', '#b4ae8b', 0.16);
    for (const sign of [-1, 1]) { c.fillStyle = '#394635'; c.fillRect(-1.1, sign > 0 ? 0.75 : -1.05, 2.2, 0.3); }
    const recoil = flash ? 0.22 : 0;
    if (u.type === 'sam') {
      c.fillStyle = '#6c7e67'; c.fillRect(-1, -0.85, 2, 1.7); c.strokeStyle = '#b9c2a5'; c.lineWidth = 0.08; c.strokeRect(-1, -0.85, 2, 1.7);
      for (const y of [-0.52, 0.25]) { c.fillStyle = '#c4c7b1'; c.fillRect(-0.65, y, 2.15, 0.34); c.fillStyle = '#3a5146'; c.fillRect(1.1, y, 0.4, 0.34); }
      oval(c, -1, 0.93, 0.45, 0.3, '#94ada0', '#c6d3b8'); line(c, -1, 0.93, -0.9, 1.8, '#a3c2a8', 0.06);
    } else {
      c.fillStyle = material(c, 0, 0, 1.6, '#a4ad8e', '#74836b', '#354b39'); c.fillRect(-0.9, -0.7, 1.8, 1.4);
      c.strokeStyle = '#c5c5a4'; c.lineWidth = 0.08; c.strokeRect(-0.9, -0.7, 1.8, 1.4);
      const barrel = u.type === 'cannon' ? 2.5 : 2.1, width = u.type === 'cannon' ? 0.43 : 0.18;
      c.fillStyle = '#273a2b'; c.fillRect(0.2 - recoil, -width / 2, barrel, width);
      line(c, 0.5, -width / 2, barrel - recoil, -width / 2, '#bdc3a3', 0.06);
      if (u.type === 'machinegun') { oval(c, -0.95, 0, 0.4, 0.35, '#9eac80', '#36482f'); c.fillStyle = '#ad9653'; for (let j = 0; j < 4; j++) c.fillRect(-0.1 + j * 0.13, 0.68 + Math.sin(j) * 0.05, 0.08, 0.14); }
      else { oval(c, -0.3, -0.35, 0.3, 0.2, '#495f49'); c.fillStyle = '#b1b899'; c.fillRect(-0.5, -0.5, 0.4, 0.08); }
      if (flash) muzzle(c, barrel + 0.45, 0, u.type === 'cannon' ? 1.25 : 0.7, seconds);
    }
  }
  c.restore();
  if (u.deployTime > 0) { c.save(); c.strokeStyle = '#b8dbcc'; c.lineWidth = 0.17; c.setLineDash([0.3, 0.3]); c.strokeRect(u.x - 2, u.y - 2, 4, 4); c.restore(); }
}
function drawFlameJet(c,unit,seconds) {
  const cfg=DEFENDERS.flamethrower, phase=seconds*22+(Number(unit.id.slice(1))||0);
  c.save();
  const glow=c.createLinearGradient(0.7,0,cfg.range,0);
  glow.addColorStop(0,'#fff1b6e0');glow.addColorStop(0.2,'#ffb435c0');glow.addColorStop(0.7,'#ff6412a0');glow.addColorStop(1,'#a1310000');
  c.globalCompositeOperation='screen';c.fillStyle=glow;c.beginPath();c.moveTo(0.9,0);
  c.arc(0,0,cfg.range,-cfg.flameArc/2,cfg.flameArc/2);c.closePath();c.fill();
  c.globalCompositeOperation='source-over';
  for(let i=0;i<7;i++) {
    const angle=(i/6-0.5)*cfg.flameArc+Math.sin(phase+i)*0.045;
    const reach=cfg.range*(0.78+Math.sin(phase*0.7+i*2)*0.14), x=Math.cos(angle)*reach,y=Math.sin(angle)*reach, width=0.45+reach*0.1;
    c.beginPath();c.moveTo(0.95,-0.12);c.bezierCurveTo(x*0.4,y*0.25-width,x*0.78,y-width,x,y);
    c.bezierCurveTo(x*0.8,y+width,x*0.35,y*0.3+width,0.95,0.12);c.closePath();c.fillStyle=glow;c.fill();
  }
  c.globalCompositeOperation='screen';
  oval(c,1.3,0,1.1,0.35,material(c,1.3,0,1.2,'#fffce4','#ffe474bb','#ff900000'));
  for(let i=0;i<9;i++) {
    const t=((seconds*2+i*0.137)%1), angle=Math.sin(i*7.3)*cfg.flameArc*0.45;
    oval(c,1+t*8*Math.cos(angle),t*8*Math.sin(angle),0.07+0.07*t,0.06,'#ffda69');
  }
  c.restore();
}
function muzzle(c, x, y, size, seconds) {
  c.save(); c.globalCompositeOperation = 'screen';
  oval(c, x, y, size * 1.6, size * 0.8, material(c, x, y, size * 1.6, '#fff4cdee', '#ffa52a77', '#ff8b0000'));
  c.fillStyle = '#fff2bd'; c.beginPath(); c.moveTo(x - size * 0.3, y - size * 0.15); c.lineTo(x + size, y); c.lineTo(x - size * 0.3, y + size * 0.15); c.lineTo(x, y); c.fill(); c.restore();
}

export function drawEffectModel(c, e) {
  const k = Math.max(0, Math.min(1, 1 - e.life / e.maxLife)), seed = e.seed || 37;
  c.save();
  if (e.type === 'scorch') {
    c.globalAlpha = Math.min(0.38, e.life / 10); oval(c, e.x, e.y, e.radius * 1.4, e.radius * 0.8, material(c, e.x, e.y, e.radius * 1.5, '#1f241cdd', '#302e2266', '#302e2200'));
  } else if (e.type === 'blast') {
    if (k < 0.72) {
      c.globalAlpha = (1 - k / 0.72) * 0.9;
      const glow = e.radius * (0.75 + k * 1.3);
      c.globalCompositeOperation = 'screen';
      oval(c, e.x, e.y, glow, glow * 0.75, material(c, e.x, e.y, glow, '#ffb34fbb', '#ed6b2044', '#bd3d0000'));
      c.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 7; i++) {
        const angle = vrand(seed, i + 70) * TAU, spread = e.radius * k * 1.25;
        const x = e.x + Math.cos(angle) * spread, y = e.y + Math.sin(angle) * spread * 0.65 - k;
        const r = e.radius * (0.23 + k * 0.5) * (0.8 + vrand(seed, i + 90) * 0.4);
        oval(c, x, y, r, r * 0.85, material(c, x, y, r, '#fff0b2', '#ff8414e8', '#b5330000'));
      }
    }
    c.globalCompositeOperation = 'screen';
    if (k < 0.3) {
      const radius = e.radius * (0.25 + k * 1.4), alpha = 1 - k / 0.3;
      c.globalAlpha = alpha;
      oval(c, e.x, e.y, radius * 1.4, radius, material(c, e.x, e.y, radius * 1.4, '#fff4caff', '#ff9d2888', '#ff4a0000'));
      oval(c, e.x, e.y, radius * 0.7, radius * 0.55, '#fff3c8');
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = (1 - k) * 0.7;
    c.beginPath(); c.ellipse(e.x, e.y, e.radius * (0.4 + k * 1.8), e.radius * (0.25 + k * 0.9), 0, 0, TAU); c.strokeStyle = '#d6c295'; c.lineWidth = 0.18 * (1 - k); c.stroke();
    for (let i = 0; i < 22; i++) {
      const angle = vrand(seed, i) * TAU, speed = (0.4 + vrand(seed, i + 30) * 1.1) * e.radius;
      const x = e.x + Math.cos(angle) * speed * k * 2, y = e.y + Math.sin(angle) * speed * k * 1.5 + k * k * 2;
      line(c, x, y, x - Math.cos(angle) * 0.6 * (1 - k), y - Math.sin(angle) * 0.6 * (1 - k), i % 3 ? '#ffca74' : '#393f2b', i % 3 ? 0.12 : 0.25);
    }
  } else if (e.type === 'smoke') {
    for (let i = 0; i < 5; i++) {
      const r = e.radius * (0.3 + k * 1.3), x = e.x + (vrand(seed, i) - 0.5) * e.radius + k * 2.4, y = e.y - k * (2.3 + i * 0.3) + (vrand(seed, i + 9) - 0.5) * e.radius * 0.4;
      c.globalAlpha = (1 - k) * 0.2; oval(c, x, y, r, r * 0.7, material(c, x, y, r, '#c3b18c', '#54554a', '#44493e00'));
    }
  } else if (e.type === 'impact') {
    c.globalAlpha = 1 - k;
    for (let i = 0; i < 5; i++) { const angle = vrand(seed, i) * TAU, d = k * (0.6 + vrand(seed, i + 8) * 1.2); line(c, e.x + Math.cos(angle) * d, e.y + Math.sin(angle) * d, e.x + Math.cos(angle) * (d + 0.3), e.y + Math.sin(angle) * (d + 0.3), e.armored ? '#f6d18a' : '#a5b26b', 0.11 * (1 - k)); }
  } else if (e.type === 'reward') {
    c.globalAlpha = Math.min(1, e.life * 2); c.font = '600 1.1px monospace'; c.textAlign = 'center'; c.fillStyle = '#ffe3a0'; c.shadowColor = '#24301c'; c.shadowBlur = 2; c.fillText(`+${e.amount}`, e.x, e.y - 1.7 - k * 2.5);
  } else if (e.type === 'deploy') {
    c.globalAlpha = (1 - k) * 0.6; c.strokeStyle = '#b2e0c5'; c.lineWidth = 0.12; c.beginPath(); c.arc(e.x, e.y, 1 + k * 3, 0, TAU); c.stroke();
  }
  c.restore();
}
