// 交互：canvas 点击按 x 半场归属（左→玩家1/player，右→玩家2/enemy）；
// 有放置/瞄准待办则执行，否则就近选路。键盘服务玩家1（1-9 出兵 / ↑↓ 换路 / Esc 取消）。
import { UNIT_ORDER, LANES, FIELD } from './data/config.js';
import { toVirtual } from './render.js';
import { spawnPoint } from './combat.js';
import { resolveTap } from './game.js';

export function initInput(canvas, state, getView, ui) {
  function toWorld(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width ? canvas.width / rect.width : 1;   // CSS→设备像素，兼容高 DPR
    const sy = rect.height ? canvas.height / rect.height : 1;
    return toVirtual(getView(), (cx - rect.left) * sx, (cy - rect.top) * sy);
  }

  function pickTower(side, v) {
    let best = null, bestd = 80;
    for (const b of state.buildings) {
      if (b.side !== side || !b.alive) continue;
      if (b.kind !== 'tower' && b.kind !== 'keep') continue;
      const d = Math.hypot(b.x - v.x, (b.y - 30) - v.y);
      if (d < bestd) { bestd = d; best = b; }
    }
    // 点城楼→该路；点主楼→中路（中路城楼没了可从主楼出兵）
    if (best) { state.selected[side] = best.kind === 'keep' ? 1 : best.lane; return; }
    // 城楼被毁时按 y 就近选一条仍可出兵的路
    let lane = -1, ld = Infinity;
    for (const l of LANES) {
      if (!spawnPoint(state, side, l.id)) continue;
      const d = Math.abs(l.y - v.y);
      if (d < ld) { ld = d; lane = l.id; }
    }
    if (lane >= 0) state.selected[side] = lane;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!state.started || state.over) return;
    const v = toWorld(e.clientX, e.clientY);
    const side = v.x < FIELD.W / 2 ? 'player' : 'enemy';
    // PvE 下右半场不归玩家操作
    if (side === 'enemy' && state.controllers.enemy !== 'human') return;
    if (state.pending[side]) { resolveTap(state, side, v.x, v.y); return; }
    pickTower(side, v);
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key;
    if (k === 'Escape') { state.pending.player = null; state.pending.enemy = null; return; }
    if (k >= '1' && k <= '9') {
      const i = +k - 1;
      if (i < UNIT_ORDER.length) ui.trySpawnPlayer(UNIT_ORDER[i]);
    } else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
      state.selected.player = Math.max(0, state.selected.player - 1);
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
      state.selected.player = Math.min(2, state.selected.player + 1);
    }
  });
}
