// 交互：点击己方城楼/本方半场选为出兵点；键盘快捷键（1-4 出兵，↑↓ 换路）
import { UNIT_ORDER, LANES, FIELD } from './data/config.js';
import { toVirtual } from './render.js';
import { spawnPoint } from './combat.js';

export function initInput(canvas, state, getView, ui) {
  function pickTower(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    // CSS 像素 → 画布后备缓冲（设备）像素，兼容 iPad 等高 DPR 屏
    const sx = rect.width ? canvas.width / rect.width : 1;
    const sy = rect.height ? canvas.height / rect.height : 1;
    const v = toVirtual(getView(), (cx - rect.left) * sx, (cy - rect.top) * sy);
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
    pickTower(e.clientX, e.clientY);
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key;
    if (k >= '1' && k <= '4') {
      ui.trySpawn(UNIT_ORDER[+k - 1]);
    } else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
      state.selectedLane = Math.max(0, state.selectedLane - 1);
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
      state.selectedLane = Math.min(2, state.selectedLane + 1);
    }
  });
}
