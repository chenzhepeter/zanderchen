// 策略表。原版每个兵种能学到不同策略（疑兵、埋伏、火攻……），施放效果受主角"智力"影响。
// 这里只放描述与参数，具体效果在 engine/tactics.js 里实现。
// target: self 自身 / enemy 敌方部队 / tile 空格 / obj 覆盖物；range 施放距离；cd 冷却回合。
export const TACTICS = {
  decoy:     { id: 'decoy',     name: '疑兵',   icon: '🎭', target: 'enemy', range: 3, fatigue: 4, cd: 1, xp: 12,
               desc: '虚张声势，让 3 格内一支敌军 2 回合内不敢进攻、士气下降。原版"疑兵流"就是靠它刷经验。' },
  ambush:    { id: 'ambush',    name: '埋伏',   icon: '🌲', target: 'self', range: 0, fatigue: 0, cd: 0, xp: 4,
               desc: '在树林/丘陵/高山里潜伏：敌军走到身边才发现你；埋伏中首次攻击 ×1.5 且不吃反击。移动后解除。' },
  nightraid: { id: 'nightraid', name: '夜袭',   icon: '🌙', target: 'self', range: 0, fatigue: 8, cd: 2, xp: 6, night: true,
               desc: '只能在夜里用：本回合攻击 ×1.4，敌军反击减半。志愿军的看家本领。' },
  march:     { id: 'march',     name: '急行军', icon: '🏃', target: 'self', range: 0, fatigue: 10, cd: 0, xp: 3,
               desc: '本回合行动力 +50%，疲劳 +10（疲劳超过 70 时不能用）。三所里就是这么抢到的。' },
  rally:     { id: 'rally',     name: '动员',   icon: '📣', target: 'self', range: 2, fatigue: 0, cd: 3, xp: 5,
               desc: '2 格内友军士气 +15、疲劳 −10。' },
  scout:     { id: 'scout',     name: '侦察',   icon: '🔭', target: 'self', range: 0, fatigue: 3, cd: 1, xp: 3,
               desc: '本回合视野扩大到 6 格，并揭开附近的地雷与埋伏。' },
  dig:       { id: 'dig',       name: '构筑',   icon: '⛏️', target: 'self', range: 0, fatigue: 6, cd: 0, xp: 3,
               desc: '在脚下修一级工事（壕沟 40% → 沙包 60% → 掩体 80%）。步兵只能修壕沟，工兵能修到掩体。' },
  mine:      { id: 'mine',      name: '埋雷',   icon: '💣', target: 'tile', range: 1, fatigue: 3, cd: 0, xp: 3,
               desc: '在相邻空格埋一颗地雷。工兵每关自带 3 颗，其他兵种需要"地雷"物品。' },
  demine:    { id: 'demine',    name: '排雷',   icon: '🧹', target: 'obj', range: 1, fatigue: 3, cd: 0, xp: 4, objKind: 'mine',
               desc: '拆掉相邻的敌方地雷。' },
  cutwire:   { id: 'cutwire',   name: '破障',   icon: '✂️', target: 'obj', range: 1, fatigue: 5, cd: 0, xp: 4, objKind: 'wire',
               desc: '剪开相邻的铁丝网。' },
  bridge:    { id: 'bridge',    name: '架桥',   icon: '🌉', target: 'tile', range: 1, fatigue: 8, cd: 0, xp: 6, water: true,
               desc: '在相邻河面上架一座浮桥（每关最多 2 座）。' },
  burn:      { id: 'burn',      name: '火攻',   icon: '🔥', target: 'enemy', range: 1, fatigue: 8, cd: 0, xp: 8, ammo: 2, armorOnly: true,
               desc: '特种兵贴近用炸药包和燃烧瓶打装甲目标，对坦克特别有效。' },
  tunnel:    { id: 'tunnel',    name: '坑道',   icon: '🕳️', target: 'self', range: 0, fatigue: 0, cd: 0, xp: 0,
               desc: '进入/离开脚下的坑道。坑道里不怕炮击与空袭，但也不能开火。' },
};

// 经验等级：每升 1 级攻击 +6%、防御 +3%，并按兵种解锁武器与策略。
export const XP_TABLE = [0, 50, 120, 220, 350, 520, 730, 980, 1270, 1600];
export const MAX_LEVEL = XP_TABLE.length;
export function levelForXp(xp) {
  let l = 1;
  for (let i = 1; i < XP_TABLE.length; i++) if (xp >= XP_TABLE[i]) l = i + 1;
  return l;
}
