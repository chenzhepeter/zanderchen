// 建筑：城楼 ×3 + 主楼 ×1（每方），含箭塔反击
import { LANES, SIDES, TOWER, KEEP } from './data/config.js';
import { nextId, spawnProjectile, nearestEnemyUnitInRange } from './combat.js';

export function createBuildings(state) {
  const list = [];
  for (const side of ['player', 'enemy']) {
    const s = SIDES[side];
    // 三城楼
    for (const lane of LANES) {
      list.push({
        id: nextId(), side, kind: 'tower', lane: lane.id,
        x: s.towerX, y: lane.y,
        hp: TOWER.hp, maxHp: TOWER.hp, cfg: TOWER,
        atkTimer: 0, alive: true, flash: 0, mage: null,
      });
    }
    // 主楼（三城楼后方居中）
    list.push({
      id: nextId(), side, kind: 'keep', lane: 1,
      x: s.keepX, y: LANES[1].y,
      hp: KEEP.hp, maxHp: KEEP.hp, cfg: KEEP,
      atkTimer: 0, alive: true, flash: 0, mage: null,
    });
  }
  return list;
}

export function updateBuildings(state, dt) {
  for (const b of state.buildings) {
    if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 4);
    if (!b.alive) continue;
    b.atkTimer = Math.max(0, b.atkTimer - dt);
    if (b.atkTimer <= 0) {
      const t = nearestEnemyUnitInRange(state, b.side, b.x, b.y, b.cfg.range);
      if (t) {
        b.atkTimer = b.cfg.atkCd;
        b.fireAnim = 1;
        spawnProjectile(state, {
          kind: 'bolt', side: b.side, x: b.x, y: b.y - 46,
          target: t, isBuilding: false, speed: b.cfg.projSpeed,
          dmg: b.cfg.dmg, lane: t.lane,
        });
      }
    }
    if (b.fireAnim > 0) b.fireAnim = Math.max(0, b.fireAnim - dt * 3);
  }
}

export function keepOf(state, side) {
  return state.buildings.find(b => b.side === side && b.kind === 'keep');
}
