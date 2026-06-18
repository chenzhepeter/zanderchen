// 城楼大战 · Tower Clash —— 全部数值与几何配置
// 所有坐标都基于虚拟分辨率 FIELD（渲染时再等比缩放到画布）

// 版本号：北京日期 + 当天提交序号（由 .githooks/pre-commit 自动更新）
export const APP_VERSION = '2026.6.18.5';

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
    key: 'infantry', name: '步兵', icon: '🛡️', cost: 2, unlock: 1,
    hp: 170, dmg: 32, atkCd: 1.0, range: 36, speed: 64, aggro: 160,
    squad: 2, kind: 'melee', radius: 13,
    skill: '结阵：身边有≥2名己方步兵时受伤 −25%',
    formation: { count: 2, radius: 70, reduce: 0.25 },
  },
  archer: {
    key: 'archer', name: '弓兵', icon: '🏹', cost: 3, unlock: 2,
    hp: 80, dmg: 23, atkCd: 0.9, range: 232, speed: 58, aggro: 268,
    squad: 2, kind: 'ranged', proj: 'arrow', projSpeed: 460, radius: 12,
    skill: '穿透箭：每第3箭贯穿直线上的多个敌人',
    pierceEvery: 3,
  },
  knight: {
    key: 'knight', name: '骑士', icon: '⚔️', cost: 5, unlock: 3,
    hp: 500, dmg: 60, atkCd: 1.2, range: 40, speed: 122, aggro: 150,
    squad: 1, kind: 'melee', radius: 16, trample: true, // 踩踏：不被友军挡速
    resist: { arrow: 0.6 }, // 重甲：免疫 60% 箭矢伤害
    skill: '冲锋：高速突进，不被友军减速；首次撞击双倍伤害并击退；重甲免疫大半箭矢',
    charge: { time: 1.6, mult: 2.0, knockback: 70 },
  },
  mage: {
    key: 'mage', name: '法师', icon: '🔮', cost: 6, unlock: 4,
    hp: 110, dmg: 40, atkCd: 1.5, range: 300, speed: 0, aggro: 320,
    squad: 1, kind: 'tower', proj: 'orb', projSpeed: 330, radius: 14,
    skill: '驻塔：治疗光环 +15HP/2s，法球远程范围伤害',
    aoe: 50,
    heal: { amount: 15, cd: 2.0, range: 178 },
  },
  dog: {
    key: 'dog', name: '狗', icon: '🐕', cost: 2, unlock: 1,
    hp: 90, dmg: 8, atkCd: 0.8, range: 30, speed: 132, aggro: 200,
    squad: 1, kind: 'melee', radius: 11,
    slow: { factor: 0.45, dur: 2.5 }, // 撕咬：命中后大幅减速
    skill: '撕咬：速度快、伤害低，命中后让敌人减速数秒',
  },
  block: {
    key: 'block', name: '路障', icon: '🧱', cost: 2, unlock: 1,
    hp: 700, dmg: 0, atkCd: 0, range: 0, speed: 0, aggro: 0,
    squad: 1, kind: 'block', radius: 19, place: 'ownRoad',
    skill: '部署在自家半场道路，阻挡双方前进，血厚需被摧毁',
  },
  cannon: {
    key: 'cannon', name: '炮手', icon: '💣', cost: 5, unlock: 5,
    hp: 95, dmg: 38, atkCd: 2.4, range: 240, speed: 34, aggro: 280,
    squad: 1, kind: 'ranged', proj: 'shell', projSpeed: 300, aoe: 62, radius: 14,
    skill: '推车炮手：低频抛物线远程，落点范围爆炸；移动慢、皮薄',
  },
  sniper: {
    key: 'sniper', name: '狙击手', icon: '🎯', cost: 6, unlock: 6,
    hp: 70, dmg: 9999, kind: 'sniper', radius: 13, place: 'keepTop',
    ability: { cd: 5 },
    skill: '驻主楼顶：每5秒点击锁定一名地面敌人秒杀（无法狙杀城楼上的人）',
  },
  catapult: {
    key: 'catapult', name: '投石机', icon: '🪨', cost: 7, unlock: 7,
    hp: 170, dmg: 130, kind: 'catapult', radius: 18, place: 'keepSide',
    aoe: 88, ability: { cd: 5 },
    skill: '建于主楼旁：每5秒点击轰炸任意地面，范围高伤（不能砸城楼）',
  },
};
export const UNIT_ORDER = ['infantry', 'dog', 'block', 'archer', 'knight', 'mage', 'cannon', 'sniper', 'catapult'];

// 建筑
export const TOWER = { hp: 1000, dmg: 25, atkCd: 1.0, range: 252, projSpeed: 500 };
export const KEEP = { hp: 2500, dmg: 35, atkCd: 0.9, range: 276, projSpeed: 520 };

// 威胁等级（仅强化电脑），t 为触发秒数。
// 共 10 级，每 20 秒升一级；前 3 级不双倍出兵，Lv4 起双倍。
// 曲线：Lv1 = regen 0.95 / 倍率 1.30，Lv10 = regen 0.76 / 倍率 1.52，中间线性插值。
export const THREAT = [
  { lv: 1, t: 0, regen: 0.95, hpMul: 1.30, dmgMul: 1.30, double: false },
  { lv: 2, t: 20, regen: 0.93, hpMul: 1.32, dmgMul: 1.32, double: false },
  { lv: 3, t: 40, regen: 0.91, hpMul: 1.35, dmgMul: 1.35, double: false },
  { lv: 4, t: 60, regen: 0.89, hpMul: 1.37, dmgMul: 1.37, double: true },
  { lv: 5, t: 80, regen: 0.87, hpMul: 1.40, dmgMul: 1.40, double: true },
  { lv: 6, t: 100, regen: 0.84, hpMul: 1.42, dmgMul: 1.42, double: true },
  { lv: 7, t: 120, regen: 0.82, hpMul: 1.45, dmgMul: 1.45, double: true },
  { lv: 8, t: 140, regen: 0.80, hpMul: 1.47, dmgMul: 1.47, double: true },
  { lv: 9, t: 160, regen: 0.78, hpMul: 1.50, dmgMul: 1.50, double: true },
  { lv: 10, t: 180, regen: 0.76, hpMul: 1.52, dmgMul: 1.52, double: true },
];

// 骷髅外观名（仅展示用）
export const SKELE_NAME = { infantry: '骷髅兵', archer: '骷髅弓手', knight: '骷髅骑士', mage: '巫妖' };
