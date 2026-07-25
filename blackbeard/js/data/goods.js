// 货物表：basePrice 为世界基准价（枚金币/单位），各港按产出/需求偏移
export const GOODS = [
  { id: 'grain', name: '粮食', icon: '🌾', basePrice: 12, bulk: 1, note: '船上口粮，也可贩运' },
  { id: 'timber', name: '木材', icon: '🪵', basePrice: 18, bulk: 2, note: '造船与修理的根本' },
  { id: 'sugar', name: '蔗糖', icon: '🍬', basePrice: 34, bulk: 1, note: '加勒比的白色黄金' },
  { id: 'rum', name: '朗姆酒', icon: '🥃', basePrice: 48, bulk: 1, note: '水手的命根子，提振士气' },
  { id: 'tobacco', name: '烟草', icon: '🚬', basePrice: 56, bulk: 1, note: '弗吉尼亚与卡罗来纳的财源' },
  { id: 'cocoa', name: '可可', icon: '🍫', basePrice: 62, bulk: 1, note: '西属美洲的珍品' },
  { id: 'coffee', name: '咖啡', icon: '☕', basePrice: 70, bulk: 1, note: '欧洲咖啡馆的新宠' },
  { id: 'cotton', name: '棉花', icon: '🧵', basePrice: 44, bulk: 2, note: '纺织业的原料' },
  { id: 'indigo', name: '靛蓝', icon: '🟦', basePrice: 88, bulk: 1, note: '染料之王，体积小价值高' },
  { id: 'spice', name: '香料', icon: '🌶️', basePrice: 130, bulk: 1, note: '东方来的奢侈品' },
  { id: 'ivory', name: '象牙', icon: '🦴', basePrice: 150, bulk: 1, note: '几内亚湾的贵重货' },
  { id: 'gunpowder', name: '火药', icon: '💥', basePrice: 96, bulk: 2, note: '战斗补给，多数总督管制' },
  { id: 'medicine', name: '药品', icon: '💊', basePrice: 180, bulk: 1, note: '稀缺救命物资' },
  { id: 'silver', name: '白银', icon: '🪙', basePrice: 260, bulk: 1, note: '西班牙珍宝船队的货物' },
];

export const GOOD_BY_ID = Object.fromEntries(GOODS.map(g => [g.id, g]));
