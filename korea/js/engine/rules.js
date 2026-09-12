// 战斗规则：全部是纯函数，随机数由调用方传入（战斗里用带种子的 rng，回放可复现）。
// 设计依据（原版）：部队有人数，阵亡与受伤分开算；伤员不能打仗、拖慢速度、压士气与攻击；
// 疲劳（攻击 +5、急行军 +10）过高战力大跌；士气影响攻防；武器各有弹药消耗；工事 40/60/80%。
import { WEAPONS } from '../data/weapons.js';
import { UNIT_TYPES } from '../data/units.js';
import { FORT } from '../data/terrain.js';
import { XP_TABLE, levelForXp } from '../data/tactics.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const effMen = (u) => Math.max(0, u.men - u.wounded);
export const typeOf = (u) => UNIT_TYPES[u.type];

export function moraleMult(m) { return 0.6 + 0.4 * clamp(m, 0, 100) / 100; }
export function fatigueMult(f) { return f >= 90 ? 0.6 : f >= 75 ? 0.72 : f >= 50 ? 0.86 : 1; }
export function levelAtk(l) { return 1 + 0.06 * (l - 1); }
export function levelDef(l) { return 1 - 0.03 * (l - 1); }
export function fatigueLabel(f) { return f >= 90 ? '精疲力竭' : f >= 75 ? '极度疲劳' : f >= 50 ? '疲劳' : f >= 25 ? '略累' : '精神饱满'; }
export function moraleLabel(m) { return m >= 80 ? '高昂' : m >= 55 ? '稳定' : m >= 30 ? '动摇' : '崩溃'; }

// 部队当前武器；弹药不够就退到白刃
export function currentWeapon(u) {
  const id = u.weapons[u.weapon] || u.weapons[0];
  const w = WEAPONS[id] || WEAPONS.bayonet;
  if (w.ammo > 0 && u.ammo < w.ammo) return WEAPONS.bayonet;
  return w;
}
export function canFire(u, w, dist) {
  if (dist < w.rmin || dist > w.rmax) return false;
  if (w.ammo > 0 && u.ammo < w.ammo) return false;
  return true;
}
// 该部队对某个距离可用的最佳武器（AI 与反击用）：火力最高且够弹药
export function bestWeaponFor(u, dist, target) {
  let best = null, bestAtk = -1;
  const ids = [...u.weapons, 'bayonet'];
  for (const id of ids) {
    const w = WEAPONS[id];
    if (!w || !canFire(u, w, dist)) continue;
    const mult = target && typeOf(target).armor > 0.2 ? (w.vsArmor || 1) : (w.vsInf || 1);
    const a = w.atk * mult;
    if (a > bestAtk) { bestAtk = a; best = w; }
  }
  return best;
}

// ctx: { night, attackerHeight, defenderHeight, terrainDef, fortLevel, flank, ambush, nightraid,
//        isCounter, counterMult, protagonist(统帅), intel(智力), defTunnel, snow, attackerSide }
// 返回 { cas, killed, wounded, detail }
export function resolveAttack(att, def, w, ctx, rand) {
  const at = typeOf(att), dt = typeOf(def);
  const ratio = clamp(effMen(att) / at.men, 0.1, 1);
  let mult = Math.pow(ratio, 0.7);
  mult *= levelAtk(att.level) * moraleMult(att.morale) * fatigueMult(att.fatigue);
  const detail = [];
  const h = (ctx.attackerHeight || 0) - (ctx.defenderHeight || 0);
  if (h > 0) { mult *= 1.2; detail.push('居高临下 +20%'); }
  else if (h < 0) { mult *= 0.9; detail.push('仰攻 −10%'); }
  if (ctx.night) {
    if (att.side === 'p') { mult *= 1.25; detail.push('夜战 +25%'); }
    else { mult *= (at.faction === 'rok' ? 0.9 : 0.8); detail.push('敌军夜间 −20%'); }
  }
  if (ctx.ambush) { mult *= 1.5; detail.push('伏击 ×1.5'); }
  if (ctx.nightraid) { mult *= 1.4; detail.push('夜袭 ×1.4'); }
  if (ctx.flank > 1 && !w.indirect) { const f = Math.min(0.45, 0.15 * (ctx.flank - 1)); mult *= 1 + f; detail.push(`包围 +${Math.round(f * 100)}%`); }
  if (ctx.protagonist) { mult *= 1 + 0.04 * ctx.protagonist; detail.push('统帅加成'); }
  if (ctx.isCounter) { mult *= (ctx.counterMult ?? (w.counter || 0.8)); detail.push('反击'); }
  const armored = dt.armor > 0.2;
  const matchup = armored ? (w.vsArmor ?? 1) : (w.vsInf ?? 1);
  mult *= matchup;
  if (armored && matchup < 0.5) detail.push('对装甲无力');
  // 防御端
  let defRed = 1 - (ctx.terrainDef || 0);
  const fort = FORT[ctx.fortLevel || 0].def * (w.indirect ? 0.75 : 1) * (w.cls === 'grenade' ? 0.6 : 1);
  defRed *= 1 - fort;
  if (ctx.defTunnel) defRed *= 0.35;
  defRed *= 1 - dt.armor * (armored ? 0.4 : 0);    // 装甲本身再减一点（倍率已经压过了）
  defRed *= levelDef(def.level);
  if (def.morale < 30) { defRed *= 1.25; detail.push('敌军动摇'); }
  if (def.status?.confused) { defRed *= 1.15; }
  let dmg = w.atk * mult * defRed * (0.85 + 0.3 * rand());
  // 换算成人数：人数多的部队吃的绝对伤亡也多一点（火力覆盖）
  const scale = 2.2 * clamp(dt.men / 100, 0.5, 1.3);
  let cas = Math.round(dmg * scale);
  cas = Math.min(cas, effMen(def));
  if (cas < 1 && rand() < 0.5) cas = 1;
  let killed = Math.round(cas * w.split);
  if (ctx.snow && def.side === 'p') killed = Math.min(cas, killed + Math.round(cas * 0.1));
  const wounded = cas - killed;
  return { cas, killed, wounded, detail, dmg };
}

export function applyCasualties(u, killed, wounded) {
  u.men = Math.max(0, u.men - killed);
  u.wounded = Math.min(u.men, u.wounded + wounded);
  u.lostKilled = (u.lostKilled || 0) + killed;
  u.lostWounded = (u.lostWounded || 0) + wounded;
  return effMen(u) <= Math.max(3, typeOf(u).men * 0.08);   // 有效兵力见底 → 溃散
}

export function addMorale(u, n) { u.morale = clamp(u.morale + n, 0, 100); }
export function addFatigue(u, n) { u.fatigue = clamp(u.fatigue + n, 0, 100); }

// 经验：返回升级次数（0 表示没升）
export function addXp(u, n) {
  const before = u.level;
  u.xp += Math.max(0, Math.round(n));
  u.level = Math.max(u.level, levelForXp(u.xp));
  return u.level - before;
}
export function xpToNext(u) {
  const next = XP_TABLE[u.level];
  return next == null ? null : next - u.xp;
}

// 升级解锁：把该等级及以下的解锁项合并进部队（幂等）
export function applyUnlocks(u) {
  const t = typeOf(u);
  const got = { weapons: [], tactics: [], gear: [] };
  if (!t.unlocks) return got;
  for (const lvl of Object.keys(t.unlocks)) {
    if (u.level < +lvl) continue;
    const un = t.unlocks[lvl];
    for (const w of un.weapons || []) if (!u.weapons.includes(w) && !(u.armory || []).includes(w)) { u.weapons.push(w); got.weapons.push(w); }
    for (const tc of un.tactics || []) if (!u.tactics.includes(tc)) { u.tactics.push(tc); got.tactics.push(tc); }
    for (const g of un.gear || []) if (!u.gear.includes(g)) { u.gear.push(g); got.gear.push(g); }
  }
  return got;
}

// AI 估值：一支部队"值多少"
export function unitValue(u) {
  const t = typeOf(u);
  let v = effMen(u) * (t.vehicle ? 4 : 1) * (1 + 0.1 * u.level);
  if (t.hq) v *= 3;
  if (t.artillery) v *= 1.6;
  if (t.supply || t.convoy) v *= 1.4;
  return v;
}

// 关卡评分
export function scoreLevel({ killed, captured, ownKilled, turnsUsed, turnLimit, objectives, preserved }) {
  const s = killed * 1 + captured * 6 + objectives * 120 + Math.max(0, turnLimit - turnsUsed) * 15 - ownKilled * 2 + (preserved || 0) * 40;
  return Math.max(0, Math.round(s));
}
export function rankForScore(score, par) {
  if (score >= par * 1.3) return '甲';
  if (score >= par * 0.8) return '乙';
  return '丙';
}
