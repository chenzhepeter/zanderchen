// 策略效果实现。数据在 data/tactics.js；这里只管"用了会发生什么"。
// 调用方（battle.js）已经检查过冷却/疲劳/目标合法性，这里直接改状态并返回日志文本。
import { TACTICS } from '../data/tactics.js';
import { UNIT_TYPES } from '../data/units.js';
import { WEAPONS } from '../data/weapons.js';
import { FORT } from '../data/terrain.js';
import { key, manhattan, terrain } from './grid.js';
import { addMorale, addFatigue, addXp, typeOf } from './rules.js';

// 返回 { ok, msg, needsTarget? }。target: 部队 / {x,y} / 覆盖物。
export function canUseTactic(B, u, id, ctx) {
  const t = TACTICS[id];
  if (!t) return { ok: false, msg: '没有这个策略' };
  if (!u.tactics.includes(id)) return { ok: false, msg: '这支部队不会这个策略' };
  if ((u.cooldowns?.[id] || 0) > 0) return { ok: false, msg: `冷却中（还要 ${u.cooldowns[id]} 回合）` };
  if (t.night && !B.night) return { ok: false, msg: '只能在夜里使用' };
  if (t.fatigue && u.fatigue + t.fatigue > 100) return { ok: false, msg: '太累了，用不出来' };
  if (id === 'march') {
    if (u.moved) return { ok: false, msg: '移动之后不能再急行军' };
    if (u.fatigue > 70) return { ok: false, msg: '疲劳超过 70，跑不动了' };
    if (u.status?.march) return { ok: false, msg: '本回合已经急行军' };
  }
  if (id === 'ambush') {
    const tr = terrain(B.map, u.x, u.y);
    if (!(tr.hide || tr.height >= 1)) return { ok: false, msg: '只能在树林、丘陵或高山里埋伏' };
    if (u.status?.ambush) return { ok: false, msg: '已经在埋伏中' };
  }
  if (id === 'dig') {
    const cur = B.forts[u.y][u.x] || 0;
    const max = typeOf(u).engineer ? 3 : 1;
    if (cur >= max) return { ok: false, msg: cur >= 3 ? '已经是掩体了' : '这个兵种只能修壕沟，更高级的工事要靠工兵' };
    if (terrain(B.map, u.x, u.y).water) return { ok: false, msg: '水里没法修工事' };
  }
  if (id === 'mine') {
    if ((u.mines || 0) <= 0 && !u.items.includes('minekit')) return { ok: false, msg: '没有地雷了' };
  }
  if (id === 'bridge') {
    if ((u.bridges || 0) <= 0) return { ok: false, msg: '架桥器材用完了' };
  }
  if (id === 'tunnel') {
    const o = B.objs.get(key(u.x, u.y));
    if (!o || o.kind !== 'tunnel') return { ok: false, msg: '脚下没有坑道' };
  }
  if (id === 'burn' && (u.ammo < (t.ammo || 0))) return { ok: false, msg: '炸药不够了' };
  return { ok: true, needsTarget: t.target !== 'self' };
}

// 目标是否合法（给 UI 高亮用）
export function tacticTargets(B, u, id) {
  const t = TACTICS[id];
  const out = [];
  if (t.target === 'enemy') {
    for (const e of B.units) {
      if (e.side === u.side || e.alive === false || e.offmap) continue;
      if (e.status?.tunnel) continue;
      if (!B.vision.has(key(e.x, e.y)) && !e.status?.ambushRevealed) continue;
      if (manhattan(u, e) > t.range) continue;
      if (t.armorOnly && UNIT_TYPES[e.type].armor < 0.2) continue;
      out.push({ x: e.x, y: e.y, unit: e });
    }
  } else if (t.target === 'tile') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = u.x + dx, y = u.y + dy;
      if (x < 0 || y < 0 || x >= B.map.w || y >= B.map.h) continue;
      const tr = terrain(B.map, x, y);
      const occupied = B.units.some(o => o.alive !== false && !o.offmap && o.x === x && o.y === y);
      if (t.water) { if (tr.water && tr.id !== 'bridge') out.push({ x, y }); continue; }
      if (occupied || tr.water || B.objs.has(key(x, y))) continue;
      out.push({ x, y });
    }
  } else if (t.target === 'obj') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) {
      const x = u.x + dx, y = u.y + dy;
      const o = B.objs.get(key(x, y));
      if (o && o.kind === t.objKind && (o.kind !== 'mine' || o.owner !== u.side)) out.push({ x, y, obj: o });
    }
  }
  return out;
}

export function applyTactic(B, u, id, target, api) {
  const t = TACTICS[id];
  addFatigue(u, t.fatigue || 0);
  if (t.cd) u.cooldowns[id] = t.cd + 1;      // 回合开始时 −1，所以 +1 才是"隔 cd 回合"
  let msg = '';
  const intel = 1 + 0.05 * (B.heroStats?.intel || 0);   // 原版：智力影响策略效果
  switch (id) {
    case 'decoy': {
      const e = target.unit;
      e.status.confused = 2;
      addMorale(e, -Math.round(8 * intel));
      msg = `${u.name} 对 ${e.name} 施放疑兵，敌军疑神疑鬼，2 回合内不敢进攻。`;
      break;
    }
    case 'ambush':
      u.status.ambush = true; u.status.ambushRevealed = false;
      msg = `${u.name} 在${terrain(B.map, u.x, u.y).name}里潜伏下来。`;
      break;
    case 'nightraid':
      u.status.nightraid = true;
      msg = `${u.name} 准备夜袭：本回合攻击 ×1.4，敌军反击减半。`;
      break;
    case 'march':
      u.status.march = true;
      u.mp = Math.ceil(u.mp * 1.5);
      msg = `${u.name} 急行军！本回合行动力 ${u.mp}。`;
      break;
    case 'rally': {
      let n = 0;
      for (const o of B.units) {
        if (o.side !== u.side || o.alive === false || o.offmap || manhattan(o, u) > t.range) continue;
        addMorale(o, Math.round(15 * intel)); addFatigue(o, -10); n++;
      }
      msg = `${u.name} 战前动员，${n} 支部队士气上升。`;
      break;
    }
    case 'scout':
      u.status.scout = true;
      api.recomputeVision();
      // 揭开视野内的地雷
      for (const o of B.objs.values()) if (o.kind === 'mine' && o.owner !== u.side && manhattan(o, u) <= 6) o.revealed = true;
      msg = `${u.name} 派出侦察兵，附近的情况看清楚了。`;
      break;
    case 'dig': {
      B.forts[u.y][u.x] = (B.forts[u.y][u.x] || 0) + 1;
      msg = `${u.name} 修好了${FORT[B.forts[u.y][u.x]].name}（防御 ${Math.round(FORT[B.forts[u.y][u.x]].def * 100)}%）。`;
      break;
    }
    case 'mine': {
      if ((u.mines || 0) > 0) u.mines--; else u.items.splice(u.items.indexOf('minekit'), 1);
      B.objs.set(key(target.x, target.y), { kind: 'mine', x: target.x, y: target.y, owner: u.side });
      msg = `${u.name} 在 (${target.x},${target.y}) 埋了一颗地雷。`;
      break;
    }
    case 'demine':
      B.objs.delete(key(target.x, target.y));
      msg = `${u.name} 排除了一颗地雷。`;
      break;
    case 'cutwire':
      B.objs.delete(key(target.x, target.y));
      msg = `${u.name} 剪开了铁丝网。`;
      break;
    case 'bridge': {
      u.bridges--;
      const row = B.map.rows[target.y];
      B.map.rows[target.y] = row.substring(0, target.x) + '#' + row.substring(target.x + 1);
      api.mapChanged();
      msg = `${u.name} 架起了浮桥。`;
      break;
    }
    case 'burn': {
      u.ammo -= t.ammo || 0;
      const e = target.unit;
      const res = api.directDamage(u, e, { atk: 30, vsArmor: 3.0, vsInf: 0.6, split: 0.6, name: '火攻', cls: 'at', ammo: 0, rmin: 1, rmax: 1 }, { noCounter: true });
      msg = `${u.name} 火攻 ${e.name}：${res.text}`;
      break;
    }
    case 'tunnel':
      u.status.tunnel = !u.status.tunnel;
      msg = u.status.tunnel ? `${u.name} 进入坑道，炮火打不到了。` : `${u.name} 冲出坑道！`;
      break;
  }
  addXp(u, t.xp || 0);
  return msg;
}
