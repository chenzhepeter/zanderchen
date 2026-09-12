// 第七章 · 冥府招魂
// 全作的情绪高点，也是唯一一章没有战斗。这里拿到的预言是后面几章真实可用的提示。
export const SCRIPT = { id: 'ch07', nodes: {

  start: { bg: 'underworld', who: null,
    text: `大洋河的尽头，是奇美里奥伊人的国土。<br><br>
      这里从来没有太阳。早上没有，中午没有，晚上也没有。<br>
      终年是雾。`,
    next: 'n1' },

  n1: { who: 'odysseus', emote: 'calm',
    text: `我照她说的做：<br>
      挖一个一肘见方的坑，绕着坑倒了蜜、奶、甜酒和水，撒上白大麦，<br>
      然后割开了两只黑羊的喉咙。<br><br>
      <i>黑血流进坑里的那一刻，我听见了脚步声。<br>
      很多很多脚步声。</i>`,
    next: 'n2' },

  n2: { bg: 'underworld', who: 'odysseus', emote: 'shock',
    text: `新娘、少年、老人、刚哭过的姑娘，还有胸甲上还带着血的战士——<br>
      从四面八方涌过来，围着那个坑，喊叫着伸出手。<br><br>
      <i>我拔出剑，横在坑口。</i>`,
    next: 'puzzle' },

  puzzle: { puzzle: 'nekyia', okNext: 'after_ok', failNext: 'after_bad',
    okAct: { metis: 1, prophecy: [
      '提瑞西阿斯：特里那喀亚岛上的牛是赫利俄斯的。一头都不能碰。',
      '阿伽门农：回家那天不要张扬。悄悄地靠岸。',
    ] },
    failAct: { prophecy: ['提瑞西阿斯只说了一半：「……牛。别碰那些牛。」'] } },

  after_ok: { bg: 'underworld', who: 'tiresias', emote: 'calm',
    text: `「多智的奥德修斯，你来找的是甜蜜的归乡。<br>
      而有一位神让它变得很苦——<b>波塞冬</b>，因为你弄瞎了他的儿子。」<br><br>
      「你还是能回去的。但要看你能不能管住你自己，和你的人。」`,
    act: { notes: ['n_nekyia'] },
    next: 'mother' },

  after_bad: { bg: 'underworld', who: 'tiresias', emote: 'weary',
    text: `坑里的血不多了。他喝了一口，抬起那双看不见的眼睛。<br><br>
      「……牛。别碰那些牛。」<br><br>
      然后他就散开了。`,
    next: 'mother' },

  mother: { bg: 'underworld', who: 'anticlea', emote: 'sad',
    text: `<i>接着走过来的那个魂，我认得。</i><br><br>
      「儿子，你怎么会活着到这儿来？」<br><br>
      「母亲——我离家的时候你还好好的。」<br><br>
      「不是病，也不是箭。」她说，<br>
      「是想你想的。是<b>你</b>，是你的主意，是你的好脾气——把我的命拿走了。」`,
    next: 'hug' },

  hug: { who: 'odysseus', emote: 'cry',
    text: `我伸手去抱她。<br><br>
      抱了个空。<br><br>
      我又伸手。又是空的。<br><br>
      第三次的时候，她说：「别抱了。人烧过之后就只剩下这个了——<br>
      它像梦一样，一伸手就飞走。」<br><br>
      <i>——这是全诗里最短的一段，也是最疼的一段。</i>`,
    act: { kleos: 8, endureMax: 1, log: '在冥府见到了母亲。她是想他想死的。' },
    next: 'aias' },

  aias: { bg: 'underworld', who: 'odysseus', emote: 'weary',
    text: `<i>还有一个魂站在远处，一直没有过来。</i><br><br>
      是埃阿斯。当年阿喀琉斯的那副铠甲，评给了我，没评给他。<br>
      他当天夜里就自杀了。<br><br>
      他站在那儿，背对着我。`,
    choices: [
      { label: '🜃 走过去，为那副铠甲道歉。', endureCost: 1, next: 'aias_ok',
        act: { kleos: 12, athena: 2, peitho: 1 }, hint: '忍耐 −1' },
      { label: '让他去吧。事情已经过去了。', next: 'aias_no', act: { hubris: 3 } },
    ] },

  aias_ok: { who: 'odysseus', emote: 'sad',
    text: `「埃阿斯。<br>
      那副铠甲害死了你。希腊人为它失去了一座高塔——我们为你哭得比为阿喀琉斯还久。<br>
      要怪就怪宙斯。他恨我们这支队伍。<br><br>
      过来，听我说完。」<br><br>
      <i>他没有回答。他转身走回黑暗里去了。<br>
      但他走之前，停了一下。</i>`,
    act: { log: '在冥府向埃阿斯道了歉。他没有回答，但他停了一下。' },
    next: 'leave' },

  aias_no: { who: 'odysseus', emote: 'calm',
    text: `你没有过去。<br><br>
      他也一直没有转身。`,
    next: 'leave' },

  leave: { bg: 'underworld', who: 'odysseus', emote: 'shock',
    text: `越来越多的亡魂涌过来，喊声连成一片。<br><br>
      <i>我忽然怕了——怕珀耳塞福涅把戈耳工的头也放出来。</i><br><br>
      我跑回船上，喊所有人砍断缆绳。<br>
      大洋河的水流把我们一路送回了阳光下面。`,
    act: { supply: -10 },
    next: 'end' },

  end: { chapterEnd: true, text: '' },
} };
