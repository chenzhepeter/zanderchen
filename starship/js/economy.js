import { DEFENDERS, ANGLES, SIDES, RECOMMENDED_COST, HEALTH_LEVELS } from './data/config.js';
import { SLOT_BY_ID, SLOTS, canUseSlot, troopPath } from './battlefield.js';
import { snapshot, emit } from './state.js';
export const occupied = (state, slotId, except = null) => state.defenders.some(u => u.id !== except && u.hp > 0 && (u.slotId === slotId || u.destination === slotId));
export const availableSlots = (state, kind, except = null) => SLOTS.filter(slot=>slot.kind===kind && canUseSlot(state,slot) && !occupied(state,slot.id,except));
const record = state => { state.history.push(snapshot(state)); if (state.history.length > 40) state.history.shift(); };
const pay = (s, cost) => { s.credits -= cost; s.stats.spent += cost; };
const fail = message => ({ ok: false, message });
export function buy(state, type, slotId) {
  const cfg = DEFENDERS[type], slot = SLOT_BY_ID[slotId];
  if (!['planning', 'combat', 'paused'].includes(state.phase)) return fail('当前无法购买部署');
  if (type === 'bomb') {
    if (state.credits < cfg.cost) return fail('军需点不足');
    if (state.phase === 'planning') record(state);
    pay(state, cfg.cost); state.bombs++; emit(state, 'build', '高爆炸弹已补充'); return { ok: true };
  }
  if (!cfg || !slot || cfg.slot !== slot.kind) return fail('请选择高亮的兼容部署位');
  if (cfg.unlock > state.roundIndex + 1) return fail(`第 ${cfg.unlock} 回合开放`);
  if (!canUseSlot(state,slot)) return fail('先重建这面墙，或部署到内环');
  if (occupied(state, slotId)) return fail('这个位置已有驻军');
  if (state.credits < cfg.cost) return fail('军需点不足');
  if (state.phase === 'planning') record(state);
  pay(state, cfg.cost);
  const entity = { id: `d${state.nextId++}`, type, slotId, side: slot.side, x: slot.x, y: slot.y, angle: ANGLES[slot.side] ?? 0 };
  state.defenders.push({ ...entity, hp: cfg.hp, maxHp: cfg.hp, cooldown: 0, level: 1, path: [], destination: null, damageDealt: 0, veteran: state.phase !== 'planning', deployTime: state.phase === 'planning' ? 0 : 1.5 });
  if (state.phase !== 'planning') state.effects.push({ type: 'deploy', x: slot.x, y: slot.y, life: 1.5, maxLife: 1.5 });
  emit(state, 'build', `${cfg.name}已部署`);
  return { ok: true, id: entity.id };
}
export function undo(state) {
  if (state.phase !== 'planning' || !state.history.length) return fail('没有可撤销的整备操作');
  const saved = state.history.pop(), history = state.history, checkpoint = state.checkpoint;
  Object.assign(state, saved, { history, checkpoint, events: [], effects: [] });
  return { ok: true };
}
export function repairWall(state, side) {
  if (state.phase !== 'planning' || !SIDES.includes(side)) return fail('只能在准备阶段修墙');
  const wall = state.walls[side], cost = wall.hp <= 0 ? 120 : 20;
  if (wall.hp >= wall.maxHp) return fail('这面墙已完好');
  if (state.credits < cost) return fail('军需点不足');
  record(state); pay(state, cost); wall.hp = wall.hp <= 0 ? 600 : Math.min(wall.maxHp, wall.hp + 200); wall.broken = false;
  return { ok: true };
}
export function repairCore(state) {
  if (state.phase !== 'planning') return fail('只能在准备阶段维修');
  if (state.coreRepaired) return fail('本次整备已维修过指挥中心');
  if (state.core.hp >= state.core.maxHp) return fail('指挥中心已完好');
  if (state.credits < 40) return fail('需要 40 军需点');
  record(state); pay(state, 40); state.core.hp = Math.min(state.core.maxHp, state.core.hp + 200); state.coreRepaired = true;
  return { ok: true };
}
export function repairDefender(state, id) {
  const u = state.defenders.find(u => u.id === id && u.hp > 0);
  if (state.phase !== 'planning' || !u) return fail('请选择可维修单位');
  if (u.hp >= u.maxHp) return fail('单位已满生命');
  const cost = Math.ceil(DEFENDERS[u.type].cost * 0.25);
  if (state.credits < cost) return fail('军需点不足');
  record(state); pay(state, cost); u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.5);
  return { ok: true };
}
export const upgradeCost = unit => Math.ceil(DEFENDERS[unit.type].cost * (unit.level === 1 ? 0.8 : 1.2));
export function upgradeBlockReason(state, unit) {
  if(!unit || unit.hp<=0)return '请选择存活的守军';
  if(!['planning','combat','paused'].includes(state.phase))return '当前阶段不能升级';
  if(unit.refitting && unit.deployTime>0)return '正在改装，完成后可继续升级';
  if(unit.level>=3)return '已达到 III 级';
  if(state.credits<upgradeCost(unit))return `军需不足，需要 ${upgradeCost(unit)} 点`;
  return '';
}
export function moveBlockReason(state, unit) {
  if(!unit || unit.hp<=0)return '请选择存活的守军';
  if(!['planning','combat','paused'].includes(state.phase))return '当前阶段不能移动';
  if(state.phase!=='planning' && !DEFENDERS[unit.type].mobile)return '固定武器仅在整备阶段搬迁';
  if(state.phase!=='planning' && unit.deployTime>0)return unit.refitting ? '改装完成后才能调动' : '增援部署完成后才能调动';
  if(state.phase!=='planning' && unit.path.length)return '正在调动，抵达后可再次移动';
  return '';
}
export function upgradeDefender(state, id) {
  const unit = state.defenders.find(u => u.id === id && u.hp > 0);
  const blocked=upgradeBlockReason(state,unit);if(blocked)return fail(blocked);
  const cost = upgradeCost(unit);
  if (state.credits < cost) return fail('升级所需军需点不足');
  if(state.phase==='planning')record(state); pay(state, cost);
  unit.level++; const maxHp = Math.round(DEFENDERS[unit.type].hp * HEALTH_LEVELS[unit.level - 1]);
  unit.hp += maxHp - unit.maxHp; unit.maxHp = maxHp;
  if(state.phase!=='planning') {unit.deployTime=Math.max(unit.deployTime||0,2);unit.refitting=true;unit.fire=0;unit.flameTime=0;unit.targetId=null;unit.status='改装中 · 暂停射击';}
  emit(state, 'build', `${DEFENDERS[unit.type].name}已升至 ${['I','II','III'][unit.level-1]} 级`);
  return {ok:true};
}
export function sell(state, id) {
  if (state.phase !== 'planning') return fail('只能在准备阶段拆除');
  const u = state.defenders.find(u => u.id === id && u.hp > 0);
  if (!u) return fail('单位已不存在');
  record(state);
  const invested = DEFENDERS[u.type].cost * (1 + (u.level > 1 ? 0.8 : 0) + (u.level > 2 ? 1.2 : 0));
  const refund = Math.floor(invested * (u.veteran ? 0.4 : 1));
  state.credits += refund; state.stats.spent -= refund;
  state.defenders = state.defenders.filter(d => d.id !== id);
  return { ok: true, refund };
}
export function relocate(state, id, slotId) {
  const u = state.defenders.find(u => u.id === id && u.hp > 0), slot = SLOT_BY_ID[slotId];
  if (!u || !slot || !['planning', 'combat', 'paused'].includes(state.phase)) return fail('当前无法调动');
  const blocked=moveBlockReason(state,u);if(blocked)return fail(blocked);
  if (DEFENDERS[u.type].slot !== slot.kind || occupied(state, slotId, u.id)) return fail('请选择空闲的兼容位置');
  if (u.slotId === slotId) return fail('已在该位置');
  if (!canUseSlot(state,slot)) return fail('目标墙体已失守，请回防内环');
  if (state.phase === 'planning') { record(state); Object.assign(u, { slotId, side: slot.side, x: slot.x, y: slot.y, angle: ANGLES[slot.side] ?? 0, path:[],destination:null }); }
  else { u.path = troopPath(u, slot); u.destination = slotId; }
  return { ok: true };
}
export function autoDeploy(state) {
  if (state.phase !== 'planning' || state.roundIndex !== 0 || state.defenders.length || state.credits < RECOMMENDED_COST) return fail('推荐布防用于全新第一回合，可先撤销已有操作');
  const before = snapshot(state), history = [...state.history];
  for (const side of SIDES) { buy(state, 'infantry', `${side}-infantry-1`); buy(state, 'machinegun', `${side}-heavy-0`); }
  for (const side of ['north', 'south']) buy(state, 'infantry', `${side}-infantry-0`);
  state.history = [...history, before];
  return { ok: true };
}
