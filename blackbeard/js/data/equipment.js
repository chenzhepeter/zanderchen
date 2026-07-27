// 装备与道具（道具屋出售，也可能从事件/缴获中获得）
// 与市场货物分开：货物论舱位买卖，装备论件。
// atk/def 直接参与决斗伤害与接舷战力计算。

export const WEAPONS = [
  { id: 'w_dagger', kind: 'weapon', name: '短匕首', nameEn: 'Dagger', atk: 4, price: 120, rarity: 1, note: '藏在靴筒里的最后手段。' },
  { id: 'w_cutlass', kind: 'weapon', name: '水手弯刀', nameEn: 'Cutlass', atk: 10, price: 480, rarity: 1, note: '甲板上最顺手的家伙，短、宽、砍得动缆绳。' },
  { id: 'w_sabre', kind: 'weapon', name: '军刀', nameEn: 'Sabre', atk: 15, price: 1400, rarity: 2, note: '骑兵的弯刃，劈砍势大。' },
  { id: 'w_rapier', kind: 'weapon', name: '西洋剑', nameEn: 'Rapier', atk: 18, price: 2600, rarity: 2, note: '细长的刺剑，快得像蛇信子。' },
  { id: 'w_broadsword', kind: 'weapon', name: '阔剑', nameEn: 'Broadsword', atk: 24, price: 5200, rarity: 3, note: '双手挥的重剑，一下能劈开胸甲。' },
  { id: 'w_boarding_axe', kind: 'weapon', name: '接舷斧', nameEn: 'Boarding Axe', atk: 28, price: 8800, rarity: 3, note: '本是砍断缆索的工具，砍人也很称手。' },
  { id: 'w_damascus', kind: 'weapon', name: '大马士革弯刀', nameEn: 'Damascus Scimitar', atk: 36, price: 19000, rarity: 4, note: '刃上有水波纹，据说能削断落在上面的丝巾。' },
];

export const ARMORS = [
  { id: 'a_none', kind: 'armor', name: '布衣', nameEn: 'Sailor Cloth', def: 0, price: 0, rarity: 0, note: '什么也挡不住，但至少凉快。' },
  { id: 'a_leather', kind: 'armor', name: '皮甲', nameEn: 'Leather Jerkin', def: 5, price: 380, rarity: 1, note: '厚牛皮，挡得住划伤。' },
  { id: 'a_padded', kind: 'armor', name: '缀甲背心', nameEn: 'Padded Vest', def: 9, price: 1100, rarity: 1, note: '棉絮夹铁片，闷热但管用。' },
  { id: 'a_chain', kind: 'armor', name: '锁子甲', nameEn: 'Chain Mail', def: 15, price: 3200, rarity: 2, note: '铁环相扣，怕刺不怕砍。' },
  { id: 'a_cuirass', kind: 'armor', name: '胸甲', nameEn: 'Cuirass', def: 22, price: 7400, rarity: 3, note: '整块锻铁，落水时也能把人拖下去。' },
  { id: 'a_halfplate', kind: 'armor', name: '半身甲', nameEn: 'Half Plate', def: 30, price: 16500, rarity: 4, note: '军官的行头，穿上就别想爬桅杆了。' },
];

// 功能道具：部分接现有 reward.item 死数据
export const ITEMS = [
  { id: 'i_sextant', kind: 'item', name: '六分仪', nameEn: 'Sextant', price: 3400, rarity: 2, effect: 'nav', note: '测太阳高度定纬度——航行更不容易偏航。' },
  { id: 'i_spyglass', kind: 'item', name: '望远镜', nameEn: 'Spyglass', price: 1800, rarity: 2, effect: 'sight', note: '桅顶视距更远，能提前看见帆影与陆地。' },
  { id: 'i_medchest', kind: 'item', name: '药箱', nameEn: 'Medicine Chest', price: 2200, rarity: 2, effect: 'heal', note: '船上有药，伤病好得快。' },
  { id: 'i_treasureMap', kind: 'item', name: '珍宝海图', nameEn: 'Treasure Map', price: 0, rarity: 4, effect: 'treasure', note: '油腻的羊皮纸，标着西班牙珍宝船队的航路。' },
  { id: 'i_charts', kind: 'item', name: '海图集', nameEn: 'Chart Portfolio', price: 5000, rarity: 3, effect: 'chart', note: '别人测绘好的海岸线，省去自己一寸寸摸。' },
];

export const EQUIPMENT = [...WEAPONS, ...ARMORS, ...ITEMS];
export const EQUIP_BY_ID = Object.fromEntries(EQUIPMENT.map(e => [e.id, e]));

// 道具屋按港口规模与稀有度供货：大港才有好货
export function stockFor(port) {
  const maxRarity = port.size >= 5 ? 4 : port.size >= 4 ? 3 : port.size >= 3 ? 2 : 1;
  return EQUIPMENT.filter(e => e.price > 0 && e.rarity <= maxRarity && e.id !== 'a_none');
}

// 事件掉落：按稀有度加权随机（越稀有越难出）
export function rollDrop(maxRarity = 3) {
  const pool = [...WEAPONS, ...ARMORS].filter(e => e.rarity >= 1 && e.rarity <= maxRarity);
  const weights = pool.map(e => 1 / (e.rarity * e.rarity));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[0];
}
