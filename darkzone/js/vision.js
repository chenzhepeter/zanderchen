// vision.js — 三层战争迷雾、视野锥墙体裁剪、可见性判定
import { RULESET as C } from './config.js';
import { D2R, angDiff, raycast, segIntersectsRect, dist } from './geom.js';
import { LOW_BLOCKERS, regionAt } from './level.js';

// ---------------- 三层迷雾 ----------------
export class FogOfWar {
  constructor() {
    this.cs = C.RENDER.fogCell;
    this.gw = Math.round(C.MAP_W / this.cs);
    this.gh = Math.round(C.MAP_H / this.cs);
    // 0=未探索 1=记忆区 2=当前可见
    this.cells = new Uint8Array(this.gw * this.gh);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.gw;
    this.canvas.height = this.gh;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(this.gw, this.gh);
  }

  reset() {
    this.cells.fill(0);
  }

  update(origin, angle, halfDeg, range, segs) {
    const { cells, gw, gh, cs } = this;
    for (let i = 0; i < cells.length; i++) if (cells[i] === 2) cells[i] = 1;

    const mark = (wx, wy) => {
      const gx = Math.floor(wx / cs);
      const gy = Math.floor(wy / cs);
      if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return;
      cells[gy * gw + gx] = 2;
    };

    const half = halfDeg * D2R;
    const step = C.RENDER.coneStepDeg * D2R;
    // 主扇形
    for (let a = -half; a <= half + 0.0001; a += step) {
      const dir = angle + a;
      const dx = Math.cos(dir);
      const dy = Math.sin(dir);
      const t = raycast(origin.x, origin.y, dx, dy, segs, range);
      const steps = Math.ceil(t / cs);
      for (let i = 0; i <= steps; i++) {
        const d = Math.min(i * cs, t);
        mark(origin.x + dx * d, origin.y + dy * d);
      }
    }
    // 身后微光
    const glow = C.PLAYER_VISION.behindGlow;
    for (let gx = -glow; gx <= glow; gx += cs) {
      for (let gy = -glow; gy <= glow; gy += cs) {
        if (gx * gx + gy * gy <= glow * glow) mark(origin.x + gx, origin.y + gy);
      }
    }
  }

  // 渲染为世界坐标贴图（48×30m）
  render(ctx) {
    const { img, cells, gw, gh } = this;
    for (let i = 0; i < cells.length; i++) {
      const v = cells[i];
      const o = i * 4;
      if (v === 0) {
        img.data[o] = 3; img.data[o + 1] = 4; img.data[o + 2] = 7; img.data[o + 3] = 255;
      } else if (v === 1) {
        img.data[o] = 4; img.data[o + 1] = 5; img.data[o + 2] = 9; img.data[o + 3] = 215;
      } else {
        img.data[o + 3] = 0;
      }
    }
    this.ctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.canvas, 0, 0, C.MAP_W, C.MAP_H);
    ctx.restore();
  }
}

// ---------------- 视野锥（被墙体裁剪的多边形） ----------------
export function conePolygon(origin, angle, halfDeg, range, segs) {
  const half = halfDeg * D2R;
  const step = C.RENDER.coneStepDeg * D2R;
  const pts = [{ x: origin.x, y: origin.y }];
  for (let a = -half; a <= half + 0.0001; a += step) {
    const dir = angle + a;
    const dx = Math.cos(dir);
    const dy = Math.sin(dir);
    const t = raycast(origin.x, origin.y, dx, dy, segs, range);
    pts.push({ x: origin.x + dx * t, y: origin.y + dy * t });
  }
  return pts;
}

// ---------------- 敌人对玩家的可见性 ----------------
// 返回 { seen, gain, d }
export function guardVision(guard, player, lightState, segs, blockedCheck) {
  if (player.hidden) return { seen: false, gain: 0, d: 999 };
  const d = dist(guard.x, guard.y, player.x, player.y);

  // 光照：取玩家所在区域
  const region = regionAt(player.x, player.y);
  let light = 'bright';
  if (region) {
    if (region.light === 'dim') light = 'dim';
    else light = lightState[region.id] ? 'bright' : 'dark';
  }
  const v = C.GUARD_VISION;
  const table = v[light];

  // 识别距离
  const isCrouch = player.stance === 'crouch';
  const isStill = player.speedNow < 0.3;
  let range = table.base;
  if (isCrouch) range = isStill ? table.crouchStill : table.crouch;
  if (d > range) return { seen: false, gain: 0, d };

  // 角度
  if (angDiff(Math.atan2(player.y - guard.y, player.x - guard.x), guard.angle) > v.halfAngle * D2R) {
    return { seen: false, gain: 0, d };
  }

  // 墙体遮挡
  if (blockedCheck(guard.x, guard.y, player.x, player.y)) return { seen: false, gain: 0, d };

  // 积累速率
  let gain = C.ALERT_GAIN.exposedBright;
  if (light === 'dark') gain = C.ALERT_GAIN.exposedDark;
  else if (isCrouch && hasHalfCover(guard, player)) gain = C.ALERT_GAIN.halfCover;
  if (d > 7) gain = Math.min(gain, C.ALERT_GAIN.farGlimpse);

  return { seen: true, gain, d, light };
}

// 蹲伏时，玩家与敌人之间有半高遮挡 → 半身遮挡
export function hasHalfCover(guard, player) {
  if (player.stance !== 'crouch') return false;
  for (const r of LOW_BLOCKERS) {
    if (segIntersectsRect(guard.x, guard.y, player.x, player.y, r)) return true;
  }
  return false;
}
