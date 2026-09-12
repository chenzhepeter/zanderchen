// 「计谋」牌库。四色对应四维属性：
//   bie 武勇(红)  metis 智谋(蓝)  peitho 言辞(绿)  endure 忍耐(金)
// 外加三类特殊牌：companion 船员牌 / relic 神物牌 / wrath 神怒牌（诅咒）。
//
// 效果尽量用声明式字段表达，battle.js 统一解释；只有真正特殊的才挂 special 钩子。
// 字段：cost 锐气 / dmg 打生命 / hits 次数 / menos 打气焰 / block 格挡 / draw 抽牌
//      selfDmg 自伤 / bonusVsOpen 对破绽额外伤害 / thumosNext 下回合锐气
//      weakenNext 敌人下回合伤害减半 / forceTarget 强制敌人攻击你
//      regenBlock 本场每回合开始得格挡 / noDamageThisTurn 本回合免伤
//      nextCardFree 下一张牌免费 / untargetable 本回合不被选中
//      purge 本场移出一张手上的神怒牌 / purgePerm 永久移除牌组里一张神怒牌
//      kleos 战后名声 / exhaust 本场耗尽 / once 用后永久移出牌组

export const COLORS = {
  bie:    { name: '武勇', greek: 'βίη',        css: 'bie' },
  metis:  { name: '智谋', greek: 'μῆτις',      css: 'metis' },
  peitho: { name: '言辞', greek: 'πειθώ',      css: 'peitho' },
  endure: { name: '忍耐', greek: 'τλημοσύνη',  css: 'endure' },
  companion: { name: '同伴', greek: 'ἑταῖρος', css: 'companion' },
  relic:  { name: '神物', greek: 'δῶρον',      css: 'relic' },
  wrath:  { name: '神怒', greek: 'μῆνις',      css: 'wrath' },
};

export const CARDS = {
  // ============ 起始基础牌 ============
  c_thrust: { id: 'c_thrust', name: '直刺', color: 'bie', cost: 1, icon: '🗡️',
    dmg: 6, text: '造成 <b>6</b> 点伤害。' },
  c_feint: { id: 'c_feint', name: '佯攻', color: 'metis', cost: 1, icon: '🌀',
    menos: 6, text: '削减 <b>6</b> 点气焰。' },
  c_hold: { id: 'c_hold', name: '稳住阵脚', color: 'endure', cost: 1, icon: '🛡️',
    block: 5, text: '获得 <b>5</b> 点格挡。' },
  c_rally: { id: 'c_rally', name: '一声令下', color: 'peitho', cost: 1, icon: '📣',
    menos: 4, block: 3, text: '削减 <b>4</b> 点气焰，获得 <b>3</b> 点格挡。' },

  // ============ 智谋 μῆτις（蓝）============
  c_sand: { id: 'c_sand', name: '撒沙迷眼', color: 'metis', cost: 1, icon: '🏖️',
    menos: 8, weakenNext: true, text: '削减 <b>8</b> 点气焰。敌人下回合的伤害减半。' },
  c_trip: { id: 'c_trip', name: '绊索', color: 'metis', cost: 1, icon: '🪢',
    menos: 6, draw: 1, text: '削减 <b>6</b> 点气焰，抽 <b>1</b> 张牌。' },
  c_disguise: { id: 'c_disguise', name: '乔装', color: 'metis', cost: 1, icon: '🧥',
    untargetable: true, exhaust: true, text: '本回合你不会被选为目标。<i>耗尽</i>' },
  c_readwind: { id: 'c_readwind', name: '读风', color: 'metis', cost: 0, icon: '🍃',
    draw: 2, text: '抽 <b>2</b> 张牌。' },
  c_terrain: { id: 'c_terrain', name: '借地形', color: 'metis', cost: 2, icon: '⛰️',
    menos: 14, text: '削减 <b>14</b> 点气焰。' },
  c_falsename: { id: 'c_falsename', name: '假名', color: 'metis', cost: 1, icon: '🎭',
    menos: 10, special: 'falsename', text: '削减 <b>10</b> 点气焰。本场战斗中，敌人每次进入破绽，你额外造成 <b>4</b> 点伤害。' },
  c_nightraid: { id: 'c_nightraid', name: '夜袭', color: 'metis', cost: 2, icon: '🌙',
    dmg: 8, menos: 8, text: '造成 <b>8</b> 点伤害，削减 <b>8</b> 点气焰。' },
  c_plan: { id: 'c_plan', name: '谋定', color: 'metis', cost: 0, icon: '📐',
    nextCardFree: true, exhaust: true, text: '本回合下一张牌费用为 <b>0</b>。<i>耗尽</i>' },

  // ============ 武勇 βίη（红）============
  c_heavy: { id: 'c_heavy', name: '重劈', color: 'bie', cost: 2, icon: '⚔️',
    dmg: 14, text: '造成 <b>14</b> 点伤害。' },
  c_shieldbash: { id: 'c_shieldbash', name: '盾击', color: 'bie', cost: 1, icon: '🛡️',
    dmg: 5, block: 5, text: '造成 <b>5</b> 点伤害，获得 <b>5</b> 点格挡。' },
  c_spear: { id: 'c_spear', name: '长枪突刺', color: 'bie', cost: 1, icon: '🔱',
    dmg: 7, bonusVsOpen: 8, text: '造成 <b>7</b> 点伤害；若敌人处于<b>破绽</b>，额外 <b>8</b> 点。' },
  c_volley: { id: 'c_volley', name: '齐射', color: 'bie', cost: 2, icon: '🏹',
    dmg: 6, hits: 3, text: '造成 <b>6</b> 点伤害，共 <b>3</b> 次。' },
  c_lastditch: { id: 'c_lastditch', name: '背水一击', color: 'bie', cost: 1, icon: '💢',
    dmg: 11, selfDmg: 2, text: '造成 <b>11</b> 点伤害，你受到 <b>2</b> 点伤害。' },
  c_bronze: { id: 'c_bronze', name: '青铜之怒', color: 'bie', cost: 3, icon: '🔥',
    dmg: 22, text: '造成 <b>22</b> 点伤害。' },

  // ============ 言辞 πειθώ（绿）============
  c_taunt: { id: 'c_taunt', name: '挑衅', color: 'peitho', cost: 1, icon: '👅',
    menos: 12, forceTarget: true, text: '削减 <b>12</b> 点气焰。敌人下回合必定攻击你。' },
  c_hearten: { id: 'c_hearten', name: '鼓舞', color: 'peitho', cost: 1, icon: '💪',
    block: 6, draw: 1, text: '获得 <b>6</b> 点格挡，抽 <b>1</b> 张牌。' },
  c_oath: { id: 'c_oath', name: '立誓', color: 'peitho', cost: 1, icon: '🤝',
    regenBlock: 3, text: '本场战斗中，每回合开始时获得 <b>3</b> 点格挡。' },
  c_parley: { id: 'c_parley', name: '交涉', color: 'peitho', cost: 2, icon: '🕊️',
    menos: 18, text: '削减 <b>18</b> 点气焰。' },
  c_songs: { id: 'c_songs', name: '歌颂', color: 'peitho', cost: 1, icon: '🎵',
    menos: 8, kleos: 2, text: '削减 <b>8</b> 点气焰。战斗结束后名声 <b>+2</b>。' },
  c_command: { id: 'c_command', name: '号令', color: 'peitho', cost: 0, icon: '📯',
    menos: 5, draw: 1, text: '削减 <b>5</b> 点气焰，抽 <b>1</b> 张牌。' },

  // ============ 忍耐 τλημοσύνη（金）============
  c_endure: { id: 'c_endure', name: '忍住', color: 'endure', cost: 1, icon: '🜃',
    block: 10, text: '获得 <b>10</b> 点格挡。' },
  c_purify: { id: 'c_purify', name: '净化', color: 'endure', cost: 1, icon: '💧',
    purge: 1, exhaust: true, text: '把手上一张<b>神怒牌</b>移出本场战斗。<i>耗尽</i>' },
  c_vow: { id: 'c_vow', name: '苦修之誓', color: 'endure', cost: 2, icon: '🕯️',
    purgePerm: 1, exhaust: true, text: '<b>永久</b>移除牌组里的一张神怒牌。<i>耗尽</i>' },
  c_brace: { id: 'c_brace', name: '蓄势', color: 'endure', cost: 1, icon: '⏳',
    block: 8, thumosNext: 1, text: '获得 <b>8</b> 点格挡，下回合锐气 <b>+1</b>。' },
  c_patience: { id: 'c_patience', name: '长夜', color: 'endure', cost: 0, icon: '🌌',
    block: 4, draw: 1, text: '获得 <b>4</b> 点格挡，抽 <b>1</b> 张牌。' },
  c_wait: { id: 'c_wait', name: '按兵不动', color: 'endure', cost: 2, icon: '🧘',
    noDamageThisTurn: true, text: '本回合结束时不受到任何伤害。' },

  // ============ 船员牌 ============
  // 他们死在剧情里时，这些牌会被永久移出牌组（exile），不可找回。
  co_eurylochus: { id: 'co_eurylochus', name: '欧律洛科斯', color: 'companion', cost: 2, icon: '🛡️',
    special: 'eurylochus',
    text: '获得 <b>8</b> 点格挡并造成 <b>6</b> 点伤害。<br>但若你本回合打出过<b>金色（忍耐）</b>牌，他会擅自行动——改为你受到 <b>4</b> 点伤害。' },
  co_perimedes: { id: 'co_perimedes', name: '珀里墨得斯', color: 'companion', cost: 2, icon: '🏹',
    dmg: 12, text: '造成 <b>12</b> 点伤害。他从不多问，也从不出错。' },
  co_elpenor: { id: 'co_elpenor', name: '埃尔佩诺耳', color: 'companion', cost: 0, icon: '🍷',
    draw: 2, thumosNext: -1, text: '抽 <b>2</b> 张牌。下回合锐气 <b>−1</b>——他又喝多了。' },
  co_eurybates: { id: 'co_eurybates', name: '欧吕巴忒斯', color: 'companion', cost: 1, icon: '📯',
    menos: 10, draw: 1, text: '削减 <b>10</b> 点气焰，抽 <b>1</b> 张牌。' },

  // ============ 神物牌 ============
  r_moly: { id: 'r_moly', name: '摩吕草', color: 'relic', cost: 0, icon: '🌿',
    block: 10, special: 'moly', exhaust: true,
    text: '获得 <b>10</b> 点格挡，并免疫本场下一次<b>变形/控制</b>。<i>耗尽</i>' },
  r_windbag: { id: 'r_windbag', name: '风袋', color: 'relic', cost: 1, icon: '🌬️',
    special: 'windbag', once: true,
    text: '立刻脱离战斗（不获得战利品）。<i>用后永久失去</i>' },
  r_veil: { id: 'r_veil', name: '伊诺的头巾', color: 'relic', cost: 0, icon: '🧣',
    special: 'veil', exhaust: true,
    text: '本场战斗中你若倒下，改为回复到 <b>12</b> 点生命。<i>耗尽</i>' },
  r_mist: { id: 'r_mist', name: '雅典娜的迷雾', color: 'relic', cost: 1, icon: '🌫️',
    special: 'mist', exhaust: true,
    text: '敌人本回合的意图作废。<i>耗尽</i>' },
  r_bow: { id: 'r_bow', name: '阿尔戈斯之弓', color: 'relic', cost: 2, icon: '🏹',
    special: 'bow',
    text: '消耗 <b>1</b> 支箭矢：造成 <b>20</b> 点伤害并立刻击破气焰。没有箭时打不出。' },

  // ============ 神怒牌（诅咒）============
  // 无法主动打出，占手牌。只能靠金牌净化，或在三个地点用代价永久移除。
  w_wave: { id: 'w_wave', name: '波塞冬的浪', color: 'wrath', cost: 99, icon: '🌊',
    unplayable: true, endTurnDmg: 4,
    text: '<b>无法打出。</b>回合结束时若它还在你手上，你受到 <b>4</b> 点伤害。' },
  w_sun: { id: 'w_sun', name: '赫利俄斯的烈日', color: 'wrath', cost: 99, icon: '☀️',
    unplayable: true, onDrawThumos: -1,
    text: '<b>无法打出。</b>抽到它时，本回合锐气 <b>−1</b>。' },
  w_bolt: { id: 'w_bolt', name: '宙斯的雷', color: 'wrath', cost: 99, icon: '⚡',
    unplayable: true, endTurnDiscard: 1,
    text: '<b>无法打出。</b>回合结束时若它还在你手上，随机弃掉一张手牌。' },
};

// 起始牌组 10 张
export const STARTER_DECK = [
  'c_thrust', 'c_thrust', 'c_thrust', 'c_thrust',
  'c_feint', 'c_feint', 'c_feint',
  'c_hold', 'c_hold',
  'c_rally',
];

// 神怒牌按傲慢档次依次发放
export const WRATH_ORDER = ['w_wave', 'w_sun', 'w_bolt', 'w_wave'];

// 每章末「战利与代价」的 3 选 1 奖励池
export const REWARD_POOL = {
  0:  ['c_readwind', 'c_shieldbash', 'c_patience'],
  1:  ['c_heavy', 'c_trip', 'c_hearten'],
  2:  ['c_parley', 'c_endure', 'c_sand'],
  3:  ['c_falsename', 'c_spear', 'c_taunt'],
  4:  ['c_brace', 'c_command', 'c_lastditch'],
  5:  ['c_terrain', 'c_oath', 'c_purify'],
  6:  ['c_nightraid', 'c_disguise', 'c_hearten'],
  7:  ['c_plan', 'c_wait', 'c_songs'],
  8:  ['c_volley', 'c_parley', 'c_endure'],
  9:  ['c_bronze', 'c_terrain', 'c_brace'],
  10: ['c_plan', 'c_oath', 'c_purify'],
  11: ['c_bronze', 'c_falsename', 'c_wait'],
  12: ['c_heavy', 'c_volley', 'c_endure'],
};

export const cardById = (id) => CARDS[id];
export const isWrath = (id) => CARDS[id]?.color === 'wrath';
