// 地形表：ASCII 地图里一个字符 = 一格地形。
// 原版《决战朝鲜》的地形有 平原/公路/丘陵/高山/河流/树林 + 海拔，人工建筑有 铁丝网/壕沟/沙包/掩体。
// 这里把"地形"与"工事/障碍/标记"分成两层：地形是底图（本文件），工事等是覆盖物（见 levels 的 objs）。
// 机动类型 mobility：foot 徒步 / horse 骑兵 / wheel 轮式（卡车、运输队）/ track 履带（坦克）。
// 移动消耗 X 表示不可通行。

export const IMPASSABLE = 99;

export const TERRAIN = {
  '.': { id: 'plain',    name: '平原', def: 0.00, height: 0, vision: 0, cost: { foot: 1, horse: 1, wheel: 1, track: 1 }, color: '#8fa86a' },
  '=': { id: 'road',     name: '公路', def: -0.10, height: 0, vision: 0, cost: { foot: 1, horse: 1, wheel: 1, track: 1 }, color: '#b9a888', road: true },
  'h': { id: 'hill',     name: '丘陵', def: 0.20, height: 1, vision: 1, cost: { foot: 2, horse: 2, wheel: 3, track: 2 }, color: '#a4a06c' },
  'M': { id: 'mountain', name: '高山', def: 0.35, height: 2, vision: 2, cost: { foot: 3, horse: 4, wheel: IMPASSABLE, track: IMPASSABLE }, color: '#8d8a7a' },
  'f': { id: 'forest',   name: '树林', def: 0.25, height: 0, vision: 0, cost: { foot: 2, horse: 2, wheel: 3, track: 3 }, color: '#5f8a4e', hide: true },
  '~': { id: 'river',    name: '河流', def: -0.20, height: -1, vision: 0, cost: { foot: 3, horse: 3, wheel: IMPASSABLE, track: IMPASSABLE }, color: '#5f8fb8', water: true },
  '#': { id: 'bridge',   name: '桥梁', def: -0.10, height: 0, vision: 0, cost: { foot: 1, horse: 1, wheel: 1, track: 1 }, color: '#a08a6a', road: true },
  'v': { id: 'village',  name: '村庄', def: 0.15, height: 0, vision: 0, cost: { foot: 1, horse: 1, wheel: 1, track: 1 }, color: '#c2a878', shelter: true },
  'T': { id: 'town',     name: '城镇', def: 0.30, height: 0, vision: 0, cost: { foot: 1, horse: 1, wheel: 1, track: 1 }, color: '#b09a8a', shelter: true },
  '*': { id: 'snow',     name: '雪原', def: 0.00, height: 0, vision: 0, cost: { foot: 2, horse: 2, wheel: 3, track: 2 }, color: '#e6ebee' },
  '%': { id: 'ice',      name: '冰河', def: -0.15, height: -1, vision: 0, cost: { foot: 2, horse: 3, wheel: IMPASSABLE, track: IMPASSABLE }, color: '#bcd3e0', water: true },
  'S': { id: 'snowhill', name: '雪山', def: 0.30, height: 2, vision: 2, cost: { foot: 3, horse: 4, wheel: IMPASSABLE, track: IMPASSABLE }, color: '#c9cfd2' },
  '^': { id: 'cliff',    name: '绝壁', def: 0, height: 3, vision: 0, cost: { foot: IMPASSABLE, horse: IMPASSABLE, wheel: IMPASSABLE, track: IMPASSABLE }, color: '#5a5650' },
};

export function terrainAt(map, x, y) {
  const row = map.rows[y];
  return TERRAIN[row ? row[x] : undefined] || TERRAIN['.'];
}

// 工事三级：原版数值 壕沟 40% / 沙包 60% / 掩体 80%
export const FORT = [
  { id: 0, name: '无', def: 0 },
  { id: 1, name: '壕沟', def: 0.40 },
  { id: 2, name: '沙包', def: 0.60 },
  { id: 3, name: '掩体', def: 0.80 },
];

// 覆盖物（objs）：种类 → 显示信息。owner 'p'/'e' 表示归属（地雷、目标点）。
export const OBJ_KINDS = {
  wire:     { name: '铁丝网', icon: '🛜', desc: '徒步通过多耗 2 点行动力，骑兵不能通过；工兵可拆除' },
  mine:     { name: '地雷', icon: '💣', desc: '敌军踏入即触发，造成伤亡并停止移动；对己方不可见' },
  tunnel:   { name: '坑道', icon: '🕳️', desc: '部队可进入坑道躲避炮击与空袭，只有邻格步兵能强攻' },
  depot:    { name: '补给点', icon: '📦', desc: '停在此处或相邻的部队每回合补充弹药' },
  flag:     { name: '要点', icon: '🚩', desc: '部队停在此处即可占领' },
  treasure: { name: '缴获品', icon: '🎁', desc: '部队走到这里可以拾取' },
  exit:     { name: '出口', icon: '🏁', desc: '敌军由此逃离战场 / 己方由此撤退' },
  deploy:   { name: '部署区', icon: '▫️', desc: '开战前可在此布置部队' },
};
