// 城楼大战 · Tower Clash —— 全部数值与几何配置
// 所有坐标都基于虚拟分辨率 FIELD（渲染时再等比缩放到画布）

export const FIELD = { W: 1280, H: 720 };

// 三条路：上/中/下。y 为路中心线，scale 为 2.5D 纵深缩放（越靠下越大）
export const LANES = [
  { id: 0, name: '上', y: 232, scale: 0.82 },
  { id: 1, name: '中', y: 372, scale: 1.0 },
  { id: 2, name: '下', y: 520, scale: 1.18 },
];

// 双方：dir 为部队前进方向（玩家向右 +1，骷髅向左 -1）
export const SIDES = {
  player: { dir: +1, towerX: 246, keepX: 104, color: '#3f7fd6', flag: '#9cc4ff', name: '玩家' },
  enemy: { dir: -1, towerX: 1034, keepX: 1176, color: '#9d4bd0', flag: '#e0b3ff', name: '骷髅' },
};

// 能量经济
export const ECONOMY = {
  start: 5,
  max: 10,
  playerRegen: 1.0, // 每多少秒回 +1
};

// 四大兵种
//  speed: 虚拟 px/秒  range: 攻击距离  aggro: 索敌半径(x)
export const UNITS = {
  infantry: {
    key: 'infantry', name: '步兵', icon: '🛡️', cost: 2,
    hp: 170, dmg: 32, atkCd: 1.0, range: 36, speed: 64, aggro: 160,
    squad: 2, kind: 'melee', radius: 13,
    skill: '结阵：身边有≥2名己方步兵时受伤 −25%',
    formation: { count: 2, radius: 70, reduce: 0.25 },
  },
  archer: {
    key: 'archer', name: '弓兵', icon: '🏹', cost: 3,
    hp: 80, dmg: 23, atkCd: 0.9, range: 232, speed: 58, aggro: 268,
    squad: 2, kind: 'ranged', proj: 'arrow', projSpeed: 460, radius: 12,
    skill: '穿透箭：每第3箭贯穿直线上的多个敌人',
    pierceEvery: 3,
  },
  knight: {
    key: 'knight', name: '骑士', icon: '⚔️', cost: 5,
    hp: 500, dmg: 60, atkCd: 1.2, range: 40, speed: 88, aggro: 150,
    squad: 1, kind: 'melee', radius: 16,
    resist: { arrow: 0.6 }, // 重甲：免疫 60% 箭矢伤害
    skill: '冲锋：直行2秒后首次撞击双倍伤害并击退；重甲免疫大半箭矢',
    charge: { time: 2.0, mult: 2.0, knockback: 64 },
  },
  mage: {
    key: 'mage', name: '法师', icon: '🔮', cost: 6,
    hp: 110, dmg: 40, atkCd: 1.5, range: 300, speed: 0, aggro: 320,
    squad: 1, kind: 'tower', proj: 'orb', projSpeed: 330, radius: 14,
    skill: '驻塔：治疗光环 +15HP/2s，法球远程范围伤害',
    aoe: 50,
    heal: { amount: 15, cd: 2.0, range: 178 },
  },
};
export const UNIT_ORDER = ['infantry', 'archer', 'knight', 'mage'];

// 建筑
export const TOWER = { hp: 1000, dmg: 25, atkCd: 1.0, range: 252, projSpeed: 500 };
export const KEEP = { hp: 2500, dmg: 35, atkCd: 0.9, range: 276, projSpeed: 520 };

// 威胁等级（仅强化电脑），t 为触发秒数
export const THREAT = [
  { lv: 1, t: 0, regen: 1.4, hpMul: 1.0, dmgMul: 1.0, double: false },
  { lv: 2, t: 45, regen: 1.2, hpMul: 1.0, dmgMul: 1.0, double: false },
  { lv: 3, t: 90, regen: 1.0, hpMul: 1.1, dmgMul: 1.0, double: false },
  { lv: 4, t: 135, regen: 0.9, hpMul: 1.2, dmgMul: 1.2, double: false },
  { lv: 5, t: 180, regen: 0.8, hpMul: 1.25, dmgMul: 1.25, double: true },
];

// 骷髅外观名（仅展示用）
export const SKELE_NAME = { infantry: '骷髅兵', archer: '骷髅弓手', knight: '骷髅骑士', mage: '巫妖' };
