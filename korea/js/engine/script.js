// 关卡事件脚本：when（触发条件）→ do（效果）。所有条件都用 B（战斗单例）求值，效果通过 api 执行。
// 每个事件默认只触发一次；unless 字段指定一个旗标，旗标已置则跳过（用来做"保底增援"）。
import { manhattan } from './grid.js';

const inRect = (u, r) => u.x >= r.x0 && u.x <= r.x1 && u.y >= r.y0 && u.y <= r.y1;
const alive = (u) => u.alive !== false && !u.offmap;

export function evalWhen(B, when, trig) {
  if (when.turn != null) return trig.kind === 'turnStart' && B.turn === when.turn && (when.phase || 'p') === trig.phase;
  if (when.turnGte != null) return trig.kind === 'turnStart' && B.turn >= when.turnGte && (when.phase || 'p') === trig.phase;
  if (when.mineHit) return !!B.mineHit;
  if (when.unitDead) { const u = B.units.find(x => x.id === when.unitDead); return !!u && u.alive === false; }
  if (when.enemyAliveLte != null) return B.units.filter(u => u.side === 'e' && alive(u)).length <= when.enemyAliveLte;
  if (when.enemyDeadGte != null) return B.stats.enemyUnitsKilled >= when.enemyDeadGte;
  if (when.objOwner) { const o = findObj(B, when.objOwner.id); return !!o && o.owner === when.objOwner.owner; }
  if (when.objRecaptured) return trig.kind === 'objChange' && trig.obj.id === when.objRecaptured && trig.obj.owner === 'p' && !!trig.obj.lostBefore;
  if (when.enemyAdjacentObj) {
    const o = findObj(B, when.enemyAdjacentObj);
    return !!o && B.units.some(u => u.side === 'e' && alive(u) && manhattan(u, o) <= 1);
  }
  if (when.playerReach) return B.units.filter(u => u.side === 'p' && alive(u) && inRect(u, when.playerReach.rect)).length >= (when.playerReach.n || 1);
  if (when.flag) return !!B.flags[when.flag];
  return false;
}

export function findObj(B, id) {
  for (const o of B.objs.values()) if (o.id === id) return o;
  return null;
}

// 跑一遍所有未触发的事件。api 由 battle.js 提供（say/spawn/… 都在那里实现）。
export async function runEvents(B, trig, api) {
  for (const ev of B.level.events || []) {
    if (B.firedEvents.has(ev.id)) continue;
    if (ev.unless && B.flags[ev.unless]) { B.firedEvents.add(ev.id); continue; }
    if (!evalWhen(B, ev.when, trig)) continue;
    B.firedEvents.add(ev.id);
    for (const act of ev.do) await api.effect(act);
    if (B.phase === 'over') return;
  }
}
