// 序章 · 木马与归途
// 教学目标：VN 操作、四维属性、「忍耐」是花掉来「不做某事」的资源、牌组的存在。
export const SCRIPT = { id: 'ch00', nodes: {

  start: { bg: 'troy_burn', who: null,
    text: `第十年的秋天。<br><br>特洛伊烧起来了。<br><br>
      不是被攻城槌撞开的，不是被云梯翻过去的——是被一匹木马，和一个主意。`,
    next: 'n1' },

  n1: { who: 'odysseus', emote: 'weary',
    text: `十年。<br><br>我离开伊塔卡的时候，忒勒马科斯还在襁褓里。现在他应该会跑了，会说话了，
      也许已经在问他母亲：我父亲长什么样。<br><br>而我连他长什么样都不知道。`,
    next: 'n2' },

  n2: { bg: 'troy_burn', who: 'odysseus', emote: 'calm', right: 'athena', rightEmote: 'calm',
    text: `<i>火光后面站着一个人。她的甲胄不反光——不是因为暗，是因为她不想让它反光。</i>`,
    next: 'n3' },

  n3: { who: null, right: 'athena', nameAs: '雅典娜',
    text: `「木马是好主意，奥德修斯。」<br><br>
      「不过我今天来，不是为了夸你。」<br>
      「你要记住一件事：从今天起，你不再是攻城的人了，你是<b>回家的人</b>。」`,
    next: 'n4' },

  n4: { who: 'athena', emote: 'calm', right: null,
    text: `「攻城靠的是<b>武勇</b>，回家靠的是别的东西。」<br><br>
      「一路上你会有四样东西可用：<br>
      <b>🔵 智谋</b>——想出别人想不到的办法。<br>
      <b>🔴 武勇</b>——你已经很擅长了。<br>
      <b>🟢 言辞</b>——让别人愿意听你说话。<br>
      <b>🟡 忍耐</b>——这个最难。」`,
    next: 'n5' },

  n5: { who: 'athena', emote: 'sly',
    text: `「忍耐不是挨打。忍耐是：明明可以说话，你不说；明明可以动手，你不动。」<br><br>
      「你这一路会遇到很多次<b>什么都不做才是对的</b>的时刻。<br>
      到时候你会看见带着 <b>🜃</b> 记号的选项——那些都要花掉你的忍耐。」<br><br>
      「而你会发现，你的忍耐从来都不够用。」`,
    next: 'n6' },

  n6: { who: 'odysseus', emote: 'sly',
    text: `我笑了一下。<br><br>
      「女神，我用一匹木马拿下了一座打了十年都打不下的城。二十天，我就能到家。」`,
    choices: [
      { label: '「这一路能有多难？」', next: 'n7a',
        act: { hubris: 5, kleos: 3 }, hint: '得意会同时涨名声和傲慢' },
      { label: '🜃 把话咽回去，什么也不说。', next: 'n7b', endureCost: 1,
        act: { athena: 2 }, hint: '忍耐 −1' },
    ] },

  n7a: { who: 'athena', emote: 'sad',
    text: `她没有笑。<br><br>
      「奥德修斯，你记住你刚才这句话。」<br><br>
      「我会在你想起它的那一天，再来找你。」<br><br>
      <i>——傲慢 +5。名声 +3。<br>
      名声让你被人传唱，傲慢让神明记住你。它们常常是同一句话带来的。</i>`,
    next: 'n8' },

  n7b: { who: 'athena', emote: 'smile',
    text: `她看了你很久。<br><br>
      「……你学得比我想的快。」<br><br>
      <i>——雅典娜的眷顾 +2。<br>
      你刚刚花掉了一点忍耐，换来的是「什么都没发生」。这一路上，这经常就是最好的结果。</i>`,
    next: 'n8' },

  n8: { bg: 'ismarus', who: 'odysseus', emote: 'calm', right: null,
    text: `<i>天亮了。海滩上停着十二条船，六百个人正在把战利品搬上去。</i><br><br>
      不过在开船之前，还有一件事没定：木马里那十二个位置，最后一批人该怎么排。`,
    next: 'n9' },

  n9: { who: 'eurylochus', emote: 'calm',
    text: `欧律洛科斯扛着一捆矛走过来。<br><br>
      「船长，弟兄们在争。都想上第一条船，都想站你旁边。」<br>
      「你得自己排。」`,
    next: 'horse' },

  horse: { puzzle: 'horse', okNext: 'n10', failNext: 'n10' },

  n10: { bg: 'ship_day', who: 'odysseus', emote: 'smile', right: null,
    text: `<i>十二条船，六百个人，风从东南来，正好推着我们往西走。</i><br><br>
      伊塔卡在两千海里外。二十天就到。`,
    act: { notes: ['n_ship'] },
    next: 'n11' },

  n11: { who: 'eurybates', emote: 'smile',
    text: `传令官欧吕巴忒斯站在船头，把号角吹了三声。<br><br>
      「回家咯——！」<br><br>
      <i>六百个人一起喊了起来。海鸥被惊得飞起来一大片。</i>`,
    next: 'n12' },

  n12: { who: 'odysseus', emote: 'calm',
    text: `<i>你有四个从特洛伊起就跟着你的人。在这一路上，他们会是你手里最好的几张牌。</i><br><br>
      <b>🛡️ 欧律洛科斯</b>——最能打，也最不听话。<br>
      <b>🏹 珀里墨得斯</b>——话最少，从不出错。<br>
      <b>🍷 埃尔佩诺耳</b>——最年轻，什么都不太行，但大家都喜欢他。<br>
      <b>📯 欧吕巴忒斯</b>——记得每一个人的名字。`,
    next: 'n13' },

  n13: { who: null,
    text: `<i>随时可以按右上角的 <b>🃏 牌组</b> 看看你手里有什么。<br>
      每一个有名字的同伴，都是牌组里的一张牌。<br><br>
      <b>他们死了，那张牌就永远没有了。</b></i>`,
    next: 'end' },

  end: { chapterEnd: true, text: '' },
} };
