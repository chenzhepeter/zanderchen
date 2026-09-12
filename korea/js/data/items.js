// 物品表。原版有 苹果、人参 等补给品用来恢复疲劳度；这里加上急救包/弹药箱/罐头/棉衣。
// use: 对部队自身使用；effect 由 engine/battle.js 的 useItem 解释。
export const ITEMS = {
  apple:   { id: 'apple',   name: '苹果',   icon: '🍎', desc: '疲劳 −20', effect: { fatigue: -20 } },
  ginseng: { id: 'ginseng', name: '人参',   icon: '🌿', desc: '疲劳 −60，士气 +10', effect: { fatigue: -60, morale: 10 } },
  can:     { id: 'can',     name: '罐头',   icon: '🥫', desc: '士气 +12，疲劳 −10（缴获的美军口粮）', effect: { fatigue: -10, morale: 12 } },
  medkit:  { id: 'medkit',  name: '急救包', icon: '🩹', desc: '治愈本队 15 名伤员', effect: { heal: 15 } },
  ammobox: { id: 'ammobox', name: '弹药箱', icon: '📦', desc: '弹药 +25', effect: { ammo: 25 } },
  cotton:  { id: 'cotton',  name: '棉衣',   icon: '🧥', desc: '装备后不受严寒冻伤（长津湖）', effect: { gear: 'cotton' } },
  minekit: { id: 'minekit', name: '地雷',   icon: '💣', desc: '可在相邻空格埋一颗地雷', effect: { mines: 1 } },
};

// 装备（占"装具"栏）：原版有 野战靴、马、车 等提高机动/防御的交通工具。
export const GEAR = {
  boots:  { id: 'boots',  name: '野战靴', icon: '🥾', desc: '行动力 +1', mp: 1 },
  horse:  { id: 'horse',  name: '军马',   icon: '🐎', desc: '行动力 +2（不能上高山）', mp: 2, noMountain: true },
  truck:  { id: 'truck',  name: '卡车',   icon: '🚚', desc: '在公路上行动力 +3，离开公路无加成', mp: 0, roadMp: 3 },
  cotton: { id: 'cotton', name: '棉衣',   icon: '🧥', desc: '不受严寒冻伤', mp: 0, warm: true },
};
