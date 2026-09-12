// 敌人。两条血：hp 生命 / menos 气焰。
// 红牌打 hp，蓝绿牌打 menos。气焰破了 → 破绽 2 回合（跳过意图、受伤翻倍）。
// 破气焰满 yieldAt 次而 hp 未清零 → 敌人屈服/退走 = 非致命胜利（更少傲慢，更多名声）。
//
// intent 类型：
//   attack  v 点伤害
//   heavy   蓄力（本回合不动），下回合 v 点重击
//   roar    削你 v 点格挡上限并让你下回合少抽一张
//   summon  召唤：气焰回复 v
//   guard   本回合受到的气焰伤害减半
export const ENEMIES = {
  e_cicone: {
    id: 'e_cicone', name: '喀孔涅斯的持矛人', icon: '🗡️', art: 'warrior',
    hp: 42, menos: 20, yieldAt: 2,
    intents: [{ type: 'attack', v: 7 }, { type: 'attack', v: 5 }, { type: 'guard' }],
    yieldText: '他们把矛头朝下插进沙里，退回了内陆的山坡。',
    killText: '海滩安静下来。你赢了——代价是这里再也没有人会给你食物。',
  },
  e_lotus: {
    id: 'e_lotus', name: '食莲人的守园者', icon: '🌺', art: 'robed',
    hp: 30, menos: 34, yieldAt: 2,
    intents: [{ type: 'roar', v: 4 }, { type: 'attack', v: 4 }, { type: 'summon', v: 8 }],
    yieldText: '他笑着让开了路：「你们要走就走吧。可惜。」',
    killText: '他倒下时手里还攥着一把莲花。你不太确定这算不算胜利。',
  },
  e_polyphemus: {
    id: 'e_polyphemus', name: '波吕斐摩斯', icon: '👁️', art: 'cyclops', boss: true,
    hp: 90, menos: 46, yieldAt: 3,
    intents: [
      { type: 'attack', v: 9 }, { type: 'heavy', v: 20 }, { type: 'roar', v: 5 },
      { type: 'attack', v: 11 }, { type: 'guard' },
    ],
    phase2At: 0.5,   // 血量过半后换更凶的意图表
    intents2: [{ type: 'heavy', v: 24 }, { type: 'attack', v: 13 }, { type: 'attack', v: 13 }],
    yieldText: '他坐倒在洞口，一只手捂着眼睛，另一只手在地上乱摸。他摸不到你了。',
    killText: '洞里安静得可怕。可堵住洞口的那块巨石，现在没有人搬得动了。',
    note: '原著里奥德修斯没有杀他——杀了就没人搬开洞口的石头。这是全诗最著名的一次「忍住」。',
  },
  e_laestry: {
    id: 'e_laestry', name: '莱斯特律戈涅斯的掷石者', icon: '🪨', art: 'giant',
    hp: 70, menos: 30, yieldAt: 3,
    intents: [{ type: 'attack', v: 12 }, { type: 'heavy', v: 22 }, { type: 'attack', v: 10 }],
    yieldText: '他扛起下一块石头时犹豫了——你趁这一瞬砍断了缆绳。',
    killText: '一个倒下了。崖上还有几十个。快跑。',
  },
  e_wolf: {
    id: 'e_wolf', name: '喀耳刻的狼', icon: '🐺', art: 'beast',
    hp: 34, menos: 18, yieldAt: 2,
    intents: [{ type: 'attack', v: 6 }, { type: 'attack', v: 8 }],
    yieldText: '狼低下头，用鼻子蹭了蹭你的手。它的眼睛太像人了。',
    killText: '它倒下时发出的声音，不像狼。',
  },
  e_shade: {
    id: 'e_shade', name: '不肯离去的亡魂', icon: '👻', art: 'shade',
    hp: 40, menos: 40, yieldAt: 2,
    intents: [{ type: 'roar', v: 6 }, { type: 'attack', v: 6 }, { type: 'summon', v: 10 }],
    yieldText: '它终于说出了自己的名字，然后散开了。',
    killText: '你不能杀死一个已经死了的东西。它只是暂时退开。',
  },
  e_scylla: {
    id: 'e_scylla', name: '斯库拉', icon: '🐙', art: 'scylla', boss: true, survival: 4,
    hp: 999, menos: 60, yieldAt: 99,
    intents: [{ type: 'attack', v: 10 }, { type: 'attack', v: 14 }, { type: 'heavy', v: 18 }],
    yieldText: '',
    killText: '你撑过去了。船还在，人少了六个。',
    note: '原著里斯库拉是不可战胜的——喀耳刻明说了：别打，快划过去。这一场只有「撑住」。',
  },
  e_mutineer: {
    id: 'e_mutineer', name: '饿疯了的船员', icon: '😰', art: 'warrior',
    hp: 36, menos: 44, yieldAt: 2,
    intents: [{ type: 'attack', v: 6 }, { type: 'roar', v: 5 }, { type: 'attack', v: 8 }],
    yieldText: '他松开了刀。「船长……我们已经三十天没吃东西了。」',
    killText: '你杀了自己的人。没有人再看你的眼睛。',
  },
  e_suitor: {
    id: 'e_suitor', name: '安提诺俄斯', icon: '🍷', art: 'noble',
    hp: 55, menos: 40, yieldAt: 3,
    intents: [{ type: 'attack', v: 9 }, { type: 'roar', v: 6 }, { type: 'attack', v: 12 }],
    yieldText: '他把酒杯放下，第一次认真看了看这个「乞丐」的脸。',
    killText: '第一箭。大厅里的笑声停了。',
  },
  e_suitors: {
    id: 'e_suitors', name: '大厅里的求婚者们', icon: '⚔️', art: 'crowd', boss: true,
    hp: 120, menos: 80, yieldAt: 4,
    intents: [
      { type: 'attack', v: 10 }, { type: 'summon', v: 14 }, { type: 'heavy', v: 22 },
      { type: 'roar', v: 6 }, { type: 'attack', v: 14 },
    ],
    phase2At: 0.45,
    intents2: [{ type: 'attack', v: 16 }, { type: 'heavy', v: 26 }, { type: 'attack', v: 14 }],
    yieldText: '弓弦还在响。一百多个人跪在地上——他们终于认出你是谁了。',
    killText: '大厅里只剩下你一个人站着。',
  },
};

export const enemyById = (id) => ENEMIES[id];
