// 交互：点击己方城楼/本方半场选出兵点；放置/瞄准模式下点击战场执行；键盘 1-9 出兵、↑↓ 换路、Esc 取消
import { UNIT_ORDER, LANES, FIELD } from './data/config.js';
import { toVirtual } from './render.js';
import { spawnPoint } from './combat.js';
import { resolveTap as gameResolveTap } from './game.js';

export function initInput(canvas, state, getView, ui) {
  function toWorld(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    // CSS 像素 → 画布后备缓冲（设备）像素，兼容 iPad 等高 DPR 屏
    const sx = rect.width ? canvas.width / rect.width : 1;
    const sy = rect.height ? canvas.height / rect.height : 1;
    return toVirtual(getView(), (cx - rect.left) * sx, (cy - rect.top) * sy);
  }

  function pickTower(v) {
    let best = null, bestd = 70;
    for (const b of state.buildings) {
      if (b.side !== 'player' || b.kind !== 'tower' || !b.alive) continue;
      const d = Math.hypot(b.x - v.x, (b.y - 30) - v.y);
      if (d < bestd) { bestd = d; best = b; }
    }
    if (best) { state.selectedLane = best.lane; return; }
    // 否则在本方半场按 y 就近选一条仍可出兵的路
    if (v.x < FIELD.W * 0.5) {
      let lane = -1, ld = Infinity;
      for (const l of LANES) {
        if (!spawnPoint(state, 'player', l.id)) continue;
        const d = Math.abs(l.y - v.y);
        if (d < ld) { ld = d; lane = l.id; }
      }
      if (lane >= 0) state.selectedLane = lane;
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    const v = toWorld(e.clientX, e.clientY);
    if (state.pendingAction) { gameResolveTap(state, v.x, v.y); return; }
    pickTower(v);
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key;
    if (k === 'Escape') { state.pendingAction = null; return; }
    if (k >= '1' && k <= '9') {
      const i = +k - 1;
      if (i < UNIT_ORDER.length) ui.trySpawn(UNIT_ORDER[i]);
    } else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
      state.selectedLane = Math.max(0, state.selectedLane - 1);
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
      state.selectedLane = Math.min(2, state.selectedLane + 1);
    }
  });
}
