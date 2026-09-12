// 第九章 · 太阳神的牛群
// 全船覆没点。欧律洛科斯在这一章死，除非调度谜题拿到满分。
export const SCRIPT = { id: 'ch09', nodes: {

  start: { bg: 'thrinacia', who: 'odysseus', emote: 'weary',
    text: `我把话说得很死：<b>不上岸，连夜绕过去。</b><br><br>
      我把提瑞西阿斯的原话背了一遍，把喀耳刻的原话也背了一遍。`,
    next: 'n1' },

  n1: { who: 'eurylochus', emote: 'angry',
    text: `「船长，你是铁打的。」<br><br>
      「我们不是。我们已经划了两天两夜，天要黑了，海上还会起风。<br>
      你要我们在黑夜里绕一座不认识的岛？」<br><br>
      「上岸睡一觉，天亮就走。我替所有人发誓：<b>一头牛都不碰。</b>」<br><br>
      <i>全船的人都在看着你。</i>`,
    choices: [
      { label: '🜃 「不。绕过去。今晚谁都不许上岸。」', endureCost: 3, next: 'bypass',
        if: { endure: 3 }, hint: '忍耐 −3 · 需要满 3 点忍耐' },
      { label: '「上岸。但每个人都要发誓。」', next: 'land', act: { peitho: 1 } },
      { label: '「随你们。」', next: 'land', act: { hubris: 5 } },
    ] },

  bypass: { bg: 'ship_night', who: 'odysseus', emote: 'weary',
    text: `我们在黑夜里绕过了那座岛。<br><br>
      风在半夜起来了，浪一次次盖过船舷，所有人一边舀水一边骂我。<br><br>
      天亮的时候，岛在船尾，很远了。没有人死。<br><br>
      <i>——这一夜你花光了全部的忍耐。<br>
      <b>而"什么都没发生"，就是这一路上最好的结果。</b></i>`,
    act: { supply: -15, crew: -4, kleos: 25, athena: 4, flags: ['skipped_cattle'],
           log: '你没有让任何人在特里那喀亚岛上上岸。' },
    next: 'zeus_ok' },

  zeus_ok: { bg: 'ship_day', who: 'odysseus', emote: 'calm',
    text: `第二天中午，天上没有一丝云。<br><br>
      <i>宙斯没有理由劈这条船。赫利俄斯也没有理由向他告状。<br>
      七群牛还在那座岛上慢慢走着，一头都没少。</i><br><br>
      <b>你把整整一船人从荷马写好的结局里拽了出来。</b>`,
    next: 'eury_check' },

  land: { bg: 'thrinacia', who: 'odysseus', emote: 'calm',
    text: `所有人都发了誓：只吃船上带的粮食，一头牛都不碰。<br><br>
      当天夜里，南风起来了。<br><br>
      <i>然后它刮了一个月。</i>`,
    next: 'puzzle' },

  puzzle: { puzzle: 'watch', okNext: 'held', failNext: 'broke',
    okAct: { kleos: 20, athena: 3, metis: 1, flags: ['cattle_safe'] },
    failAct: { hubris: 8 } },

  held: { bg: 'thrinacia', who: 'odysseus', emote: 'weary',
    text: `二十九天。七群牛一头没少。<br><br>
      第三十天早上，风向变了。<br><br>
      <i>你把所有人赶上船的时候，手是抖的。</i>`,
    act: { supply: -12 },
    next: 'eury_check' },

  broke: { bg: 'thrinacia', who: 'eurylochus', emote: 'angry',
    text: `我在山上祷告，睡着了。<br>
      醒过来的时候，风把烤肉的味道送到了山顶。<br><br>
      <i>欧律洛科斯站在火堆边，手里还拿着刀。</i><br><br>
      「船长，我说句实话。」<br>
      「所有死法里，<b>饿死是最难看的一种</b>。<br>
      要是回去了，我们给太阳神盖座庙。要是他现在就要弄死我们——<br>
      那我宁可一口气淹死，也不想在这个破岛上一天天瘦下去。」`,
    act: { crew: -0, log: '第二十九天，弟兄们杀了赫利俄斯的牛。' },
    next: 'omens' },

  omens: { bg: 'thrinacia', who: 'odysseus', emote: 'shock',
    text: `剥下来的牛皮在地上<b>自己爬</b>。<br>
      串在扦子上的肉，不管生的熟的，都在<b>叫</b>。<br><br>
      <i>他们吃了六天。<br>
      第七天，风停了。</i>`,
    act: { supply: 30, hubris: 10 },
    next: 'bolt' },

  bolt: { bg: 'ship_storm', who: null,
    text: `船离岸还不到一个时辰，天就黑了。<br><br>
      西风撞过来，两根缆一起断，桅杆倒下来砸碎了舵手的头骨。<br><br>
      然后宙斯的雷劈在了船身上。<br><br>
      <i>整条船像一只被摔在石头上的碗。</i>`,
    act: { ships: -1, crew: -30, log: '宙斯的雷劈碎了最后一条船。' },
    next: 'eury_check' },

  // 欧律洛科斯：只有二十九天满分撑住（或者根本没上岛）才救得下
  eury_check: {
    branch: [
      { if: { flag: 'skipped_cattle' }, next: 'eury_safe' },
      { if: { flag: 'puzzle_watch_perfect' }, next: 'eury_saved' },
    ],
    next: 'eury_lost' },

  eury_safe: { bg: 'ship_day', who: 'eurylochus', emote: 'weary',
    text: `绕过那座岛之后的第三天，他走过来，在你旁边坐下。<br><br>
      「船长。」<br>
      「那天晚上我骂了你很难听的话。」<br><br>
      「……不过船还在，人也还在。」<br><br>
      <i>他这一路上从来没有认过错。这是第一次，也是唯一一次。</i>`,
    act: { save: ['eurylochus'], kleos: 10 },
    next: 'raft' },

  eury_saved: { bg: 'ship_storm', who: 'eurylochus', emote: 'weary',
    text: `雷劈下来的时候，他正在解缆。<br><br>
      他被甩进了水里，然后又抓住了那根断掉的桅杆——<br>
      因为二十九天里，他一次都没有累垮过。<br><br>
      「船长！这边！」<br><br>
      <i>那二十九天的排班，救的是这一刻。</i>`,
    act: { save: ['eurylochus'], kleos: 16, athena: 2 },
    next: 'raft' },

  eury_lost: { who: 'odysseus', emote: 'cry',
    text: `雷劈下来的时候，他还在辩解。<br><br>
      「船长，我们已经三十天没有——」<br><br>
      话没说完。<br><br>
      <i>他是我妹夫。他是全船最能打的人，也是每一次带头违抗我命令的人。<br>
      他做过的每一件错事，理由都是"弟兄们受不了了"。<br><br>
      ——牌组永久失去「🛡️ 欧律洛科斯」。</i>`,
    act: { kill: ['eurylochus'] },
    next: 'raft' },

  raft: { bg: 'ship_storm', who: 'odysseus', emote: 'weary',
    text: `我把桅杆和龙骨用一根牛皮索捆在一起，骑了上去。<br><br>
      漂了九天九夜。<br><br>
      第十天夜里，浪把我扔上了一座岛的沙滩。`,
    act: { crew: -0, log: '九天九夜，抱着桅杆漂到了俄古癸亚岛。' },
    next: 'end' },

  end: { chapterEnd: true, text: '' },
} };
