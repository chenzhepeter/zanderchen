// 武器表。原版：步枪每发耗 1 弹药、冲锋枪 2；武器可随时切换、可缴获美械；有面杀伤武器。
// atk 是"火力指数"，最终伤亡 = 火力 × 人数比 × 士气/疲劳 × 地形 × 昼夜 … 见 engine/rules.js。
// rmin/rmax 射程（曼哈顿距离）；ammo 每次攻击消耗；area 1 = 目标四邻也吃 40% 伤害；
// indirect 曲射：不受反击、命中工事打折；split 阵亡占伤亡的比例（其余为受伤）；
// vsArmor / vsInf 对装甲 / 对步兵的倍率；counter 反击倍率（默认 0.8）。

export const WEAPONS = {
  bayonet:  { id: 'bayonet',  name: '白刃', atk: 6,  rmin: 1, rmax: 1, ammo: 0, split: 0.40, vsArmor: 0.02, cls: 'melee', desc: '没弹药时也能拼刺刀' },
  rifle:    { id: 'rifle',    name: '步枪', atk: 10, rmin: 1, rmax: 1, ammo: 1, split: 0.35, vsArmor: 0.05, cls: 'rifle', desc: '省弹药，什么兵种都能用' },
  carbine:  { id: 'carbine',  name: 'M1卡宾枪', atk: 12, rmin: 1, rmax: 1, ammo: 1, split: 0.35, vsArmor: 0.05, cls: 'rifle', captured: true, desc: '缴获的美式卡宾枪' },
  smg:      { id: 'smg',      name: '冲锋枪', atk: 14, rmin: 1, rmax: 1, ammo: 2, split: 0.35, vsArmor: 0.05, vsInf: 1.1, cls: 'smg', desc: '近战凶猛，但每次打 2 发弹药' },
  thompson: { id: 'thompson', name: '汤姆逊冲锋枪', atk: 16, rmin: 1, rmax: 1, ammo: 2, split: 0.35, vsArmor: 0.05, vsInf: 1.1, cls: 'smg', captured: true, desc: '缴获的美式冲锋枪' },
  grenade:  { id: 'grenade',  name: '手榴弹', atk: 13, rmin: 1, rmax: 1, ammo: 1, split: 0.45, vsArmor: 0.15, cls: 'grenade', desc: '对工事里的敌人有效' },
  atgren:   { id: 'atgren',   name: '反坦克手雷', atk: 22, rmin: 1, rmax: 1, ammo: 2, split: 0.50, vsArmor: 2.6, vsInf: 0.5, cls: 'at', desc: '特种兵贴身打坦克' },
  bazooka:  { id: 'bazooka',  name: '巴祖卡火箭筒', atk: 26, rmin: 1, rmax: 2, ammo: 2, split: 0.50, vsArmor: 3.0, vsInf: 0.5, cls: 'at', captured: true, desc: '缴获的美式火箭筒，专打装甲' },
  lmg:      { id: 'lmg',      name: '轻机枪', atk: 15, rmin: 1, rmax: 2, ammo: 2, split: 0.40, vsArmor: 0.05, cls: 'mg', counter: 1.0, desc: '两格射程' },
  hmg:      { id: 'hmg',      name: '重机枪', atk: 20, rmin: 1, rmax: 2, ammo: 2, split: 0.40, vsArmor: 0.08, cls: 'mg', counter: 1.15, desc: '守阵地的好东西，反击特别狠' },
  m1919:    { id: 'm1919',    name: '勃朗宁机枪', atk: 22, rmin: 1, rmax: 2, ammo: 2, split: 0.40, vsArmor: 0.08, cls: 'mg', counter: 1.15, captured: true, desc: '缴获的美式重机枪' },
  mortar:   { id: 'mortar',   name: '迫击炮', atk: 18, rmin: 2, rmax: 3, ammo: 3, split: 0.50, vsArmor: 0.30, area: 1, indirect: true, cls: 'arty', desc: '曲射，隔着两格打，不吃反击' },
  mtngun:   { id: 'mtngun',   name: '山炮', atk: 24, rmin: 2, rmax: 4, ammo: 3, split: 0.55, vsArmor: 0.50, area: 1, indirect: true, cls: 'arty', desc: '志愿军的主力火炮' },
  howitzer: { id: 'howitzer', name: '105榴弹炮', atk: 28, rmin: 2, rmax: 5, ammo: 3, split: 0.55, vsArmor: 0.60, area: 1, indirect: true, cls: 'arty', desc: '美军炮兵的家伙' },
  rocket:   { id: 'rocket',   name: '喀秋莎火箭炮', atk: 44, rmin: 3, rmax: 6, ammo: 6, split: 0.60, vsArmor: 0.80, area: 1, areaMult: 0.7, indirect: true, cls: 'arty', desc: '一次齐射覆盖一片，弹药很少' },
  tankgun:  { id: 'tankgun',  name: '坦克炮', atk: 26, rmin: 1, rmax: 2, ammo: 2, split: 0.50, vsArmor: 1.5, vsInf: 0.8, cls: 'gun', desc: '' },
  tankmg:   { id: 'tankmg',   name: '车载机枪', atk: 16, rmin: 1, rmax: 1, ammo: 1, split: 0.40, vsArmor: 0.05, cls: 'mg', desc: '' },
  aamg:     { id: 'aamg',     name: '高射机枪', atk: 14, rmin: 1, rmax: 2, ammo: 2, split: 0.40, vsArmor: 0.10, cls: 'mg', aa: true, desc: '能对空射击，压制敌机' },
  pistol:   { id: 'pistol',   name: '手枪', atk: 5,  rmin: 1, rmax: 1, ammo: 1, split: 0.30, vsArmor: 0.02, cls: 'rifle', desc: '' },
  m1rifle:  { id: 'm1rifle',  name: 'M1步枪', atk: 11, rmin: 1, rmax: 1, ammo: 1, split: 0.35, vsArmor: 0.05, cls: 'rifle', desc: '' },
};

export const WEAPON_LIST = Object.values(WEAPONS);
