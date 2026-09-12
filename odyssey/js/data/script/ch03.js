// 第三章 · 独眼巨人波吕斐摩斯
// 全作的枢纽：最著名的一次「忍住」和最著名的一次「没忍住」发生在同一章。
// 这里第一次引入傲慢——而涨傲慢的那个动作，同时也是涨名声的那个动作。
export const SCRIPT = { id: 'ch03', nodes: {

  start: { bg: 'beach_day', who: null,
    text: `一座没有人耕种的岛。野山羊多得站着不动就能打到。<br><br>
      山坡上有个洞，洞口用月桂枝围了个栏。里面堆着奶酪，栏里关着羊羔，
      桶里的奶还是温的。<br><br>
      <i>你带了十二个人和一皮袋马戎的烈酒进去。</i>`,
    next: 'n1' },

  n1: { bg: 'cave_in', who: 'eurylochus', emote: 'shock',
    text: `「船长，拿了就走。」<br><br>
      「奶酪、羊羔、能扛的都扛上，天黑前回船。这地方不对劲——这些羊太大了。」`,
    choices: [
      { label: '🜃 「不。等主人回来。」（客人有权得到一份赠礼）', endureCost: 1, next: 'wait',
        act: { hubris: 8, kleos: 5, notes: ['n_xenia'] },
        hint: '这一次，"忍耐"是错的' },
      { label: '「扛上就走。」', next: 'flee', act: { supply: 15, athena: 1 } },
    ] },

  flee: { bg: 'cave_mouth', who: 'odysseus', emote: 'calm',
    text: `你们扛着奶酪往洞口跑。<br><br>
      跑到一半，地在震。<br><br>
      <i>他回来了。而他手里那块石头，二十二辆四轮大车都拉不动。</i>`,
    next: 'blocked' },

  wait: { bg: 'cave_in', who: 'odysseus', emote: 'sly',
    text: `「按规矩，主人见了客人，要给一份赠礼。」<br><br>
      你在洞里坐了下来，让人生了火，烤了一块奶酪。<br><br>
      <i>——傲慢 +8，名声 +5。<br>
      这一次，你花掉的忍耐买来的是一个坏结果。<br>
      <b>「忍住」不总是对的。难的地方在于分清什么时候该忍。</b></i>`,
    next: 'blocked' },

  blocked: { bg: 'cave_in', who: 'polyphemus', emote: 'calm',
    text: `他赶着羊群进来，然后回身搬起那块石头，把洞口堵上了。<br><br>
      直到这时他才看见你们。<br><br>
      「陌生人。你们是谁？做买卖的，还是抢东西的？」`,
    next: 'xenia' },

  xenia: { who: 'odysseus', emote: 'calm',
    text: `你把该说的话说了：我们是从特洛伊回家的希腊人，风把我们吹到这儿。<br>
      按<b>宙斯</b>的规矩，客人该受到款待。`,
    next: 'eat' },

  eat: { who: 'polyphemus', emote: 'sly',
    text: `他大笑起来。<br><br>
      「库克罗普斯不怕宙斯。我们比神强壮。」<br><br>
      <i>然后他伸手抓起两个人，像捏小狗一样把他们摔在地上。</i><br><br>
      「这就是我的款待。」`,
    act: { crew: -2, log: '洞里，两个人被波吕斐摩斯当场杀了。' },
    next: 'sword' },

  sword: { who: 'odysseus', emote: 'angry',
    text: `你的手已经摸到了剑柄。他就睡在那儿，肚子起伏，你知道该往哪儿捅。`,
    choices: [
      { label: '现在就杀了他。', next: 'stop' },
      { label: '🜃 松开手。先想清楚。', endureCost: 1, next: 'stop2', act: { athena: 2, metis: 1 } },
    ] },

  stop: { who: 'odysseus', emote: 'shock',
    text: `剑抽出来一半，你停住了。<br><br>
      <i>洞口那块石头。</i><br><br>
      他死了，谁来搬开它？<br>
      你们十一个人会和一具尸体一起，被封在这个山洞里慢慢饿死。`,
    next: 'plan' },

  stop2: { who: 'odysseus', emote: 'calm',
    text: `你把手从剑柄上松开了。<br><br>
      <i>那块石头。他死了，就没有人搬得动它。</i><br><br>
      要活着出去，他就必须活着，而且必须能走路——<br>
      <b>但他不能看得见。</b>`,
    next: 'plan' },

  plan: { bg: 'cave_in', who: 'odysseus', emote: 'sly',
    text: `洞里有一根橄榄木的棍子，粗得像一根桅杆。<br><br>
      你让人削尖了它的一头，在火里烤硬，藏进羊粪堆里。<br><br>
      然后你端起那皮袋酒，走到他面前。<br><br>
      「客人也该回赠主人。尝尝这个。」`,
    next: 'puzzle' },

  puzzle: { puzzle: 'outis', okNext: 'battle', failNext: 'battle',
    okAct: { metis: 1, flags: ['said_outis'], notes: ['n_outis'] },
    failAct: { hubris: 4 } },

  battle: {
    battle: 'e_polyphemus', bg: 'cave_in',
    yieldNext: 'blinded', killNext: 'trapped', loseNext: 'blinded',
    yieldAct: { kleos: 20, metis: 1, athena: 2, log: '你烧瞎了波吕斐摩斯的那只眼睛。' },
    killAct: { crew: -60, hubris: 15, kleos: 8, log: '你杀了波吕斐摩斯——然后发现没有人搬得开洞口的石头。' },
    loseAct: { crew: -4 },
  },

  trapped: { bg: 'cave_in', who: 'odysseus', emote: 'sad',
    text: `他死了。<br><br>
      然后你们花了十九天，用剑、用石头、用手，一点一点在洞壁上抠出一条缝。<br><br>
      爬出去的时候，六十个人留在了里面。<br><br>
      <i>你赢了这一仗，却输掉了整整两条船的人。<br>
      <b>「打赢」和「解决问题」不是一回事。</b></i>`,
    next: 'escape' },

  blinded: { bg: 'cave_in', who: 'polyphemus', emote: 'shock',
    text: `他捂着眼睛，撞在洞壁上，嚎得整座山都在响。<br><br>
      外面很快传来别的库克罗普斯的声音：<br>
      「波吕斐摩斯！出什么事了？<b>谁在害你？</b>」`,
    next: 'nobody' },

  nobody: { who: 'polyphemus', emote: 'angry',
    hideIf: null,
    text: `他吼了回去：<br><br>
      「<b>没有人</b>在害我！<b>没有人</b>！」<br><br>
      <i>洞外沉默了一会儿。</i><br><br>
      「……那你自己在那儿叫什么？八成是宙斯让你病了。自己祷告去吧。」<br><br>
      <i>脚步声走远了。</i>`,
    act: { kleos: 12, notes: ['n_outis'] },
    next: 'escape' },

  escape: { bg: 'cave_mouth', who: 'odysseus', emote: 'calm',
    text: `天亮时他要放羊出去吃草。他坐在洞口，用手摸每一只走出去的羊的背。<br><br>
      <i>他摸得到背，摸不到肚子。</i>`,
    choices: [
      { label: '把每个人绑在三只羊中间，自己抓住最大那只公羊的肚子。', next: 'out_ok',
        act: { metis: 1, kleos: 5 } },
      { label: '等他打开洞口，一起冲出去。', next: 'out_bad', act: { crew: -8, hubris: 3 } },
      { label: '披上羊皮，学羊走路。', next: 'out_bad', act: { crew: -6 } },
    ] },

  out_ok: { bg: 'beach_day', who: 'odysseus', emote: 'smile',
    text: `最大的那只公羊走得最慢。<br><br>
      他停下来，摸着它的背说：「我的好羊，你从前总是第一个出去的。<br>
      你也在为你主人的眼睛难过吗？」<br><br>
      <i>他的手就停在离你半尺的地方。</i><br><br>
      羊走出了洞口。你松开手，滚进草里。`,
    next: 'shore' },

  out_bad: { bg: 'beach_day', who: 'odysseus', emote: 'sad',
    text: `他听见了脚步声，把石头往回一推。<br><br>
      挤出去的人少了几个。`,
    next: 'shore' },

  shore: { bg: 'ship_day', who: 'eurylochus', emote: 'shock',
    text: `船离岸了。所有人都在拼命划桨。<br><br>
      岸上那个巨大的影子还在乱摸乱撞。<br><br>
      <i>你站起来，走到船尾。欧律洛科斯一把抓住你：<br>
      「船长——别喊。求你了，别喊。」</i>`,
    next: 'THE_CHOICE' },

  THE_CHOICE: { who: 'odysseus', emote: 'sly',
    text: `<i>十年了。</i><br><br>
      十年打仗，一匹木马，一座城，还有刚刚那个山洞——<br>
      而没有一个人知道这些是谁干的。<br><br>
      <b>如果没有人知道，那这一切还算数吗？</b>`,
    choices: [
      { label: '「记住！弄瞎你的是伊塔卡的奥德修斯，拉厄耳忒斯之子！」', next: 'shout',
        act: { kleos: 30, hubris: 30, poseidon: 4 },
        hint: '名声 +30，傲慢 +30' },
      { label: '🜃 什么都不说。转身回到桨边。', endureCost: 2, next: 'silent',
        act: { kleos: 8, athena: 4, metis: 1 },
        hint: '忍耐 −2 · 名声只有 +8' },
    ] },

  shout: { bg: 'ship_storm', who: 'polyphemus', emote: 'angry',
    text: `他愣住了。然后他笑了——笑得很难听。<br><br>
      「原来是你。有个预言家跟我说过会有个叫奥德修斯的人来弄瞎我。<br>
      我一直以为来的会是个巨人。」<br><br>
      他跪下来，朝着海举起双手：<br><br>
      「父亲，波塞冬。如果我真是你的儿子——<br>
      <b>让他回不了家。<br>
      就算命里注定他要回去，也让他回得又晚又惨，
      死光所有同伴，坐着别人的船回去，回去后还有一屋子麻烦等着他。</b>」`,
    act: { log: '你向波吕斐摩斯报出了真名。波塞冬听见了他的祷告。' },
    next: 'after_shout' },

  after_shout: { who: 'odysseus', emote: 'calm',
    text: `海面开始不对劲。<br><br>
      <i>你刚刚同时做成了两件事：<br>
      让这个故事有了主角的名字——<b>κλέος，不朽的名声</b>。<br>
      也让海神知道了该恨谁。</i><br><br>
      <i>这两件事，是同一句话。</i>`,
    next: 'end' },

  silent: { bg: 'ship_day', who: 'odysseus', emote: 'weary',
    text: `你张了张嘴，然后闭上了。<br><br>
      你走回自己的桨边，坐下，开始划。<br><br>
      岸上的嚎叫渐渐听不见了。没有人知道刚才发生了什么，
      也没有人会把这件事编成歌传下去。<br><br>
      <i>——忍耐 −2。名声只涨了一点点。<br>
      而波塞冬始终不知道该恨谁。</i>`,
    act: { flags: ['kept_silent'], log: '你没有报出自己的名字。海面很安静。' },
    next: 'end' },

  end: { chapterEnd: true, text: '' },
} };
