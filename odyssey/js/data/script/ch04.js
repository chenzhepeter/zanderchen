// 第四章 · 风神的袋子
// 全诗离家最近的一次，也是摔得最惨的一次。这一章没有敌人，敌人是"九天没睡"和"人心"。
export const SCRIPT = { id: 'ch04', nodes: {

  start: { bg: 'aeolia', who: null,
    text: `埃俄利亚是一座浮岛，四周绕着一圈青铜的墙。<br><br>
      风神埃俄罗斯留你们住了整整一个月，天天问特洛伊的事，听得津津有味。`,
    act: { supply: 25 },
    next: 'n1' },

  n1: { who: 'aeolus', emote: 'smile',
    text: `临走那天，他扛来一只九岁公牛皮做的袋子，用银绳把口扎死。<br><br>
      「所有会把你吹偏的风，都在这里面了。」<br>
      「我只放西风出来送你——它会一路把你推到伊塔卡。」<br><br>
      「记住：<b>别打开。</b>」`,
    act: { relics: ['r_windbag'], notes: [] },
    next: 'n2' },

  n2: { bg: 'ship_day', who: 'odysseus', emote: 'calm',
    text: `九天九夜，西风没有停过一刻。<br><br>
      我没有把舵交给任何人。九天，我一直站在这里。<br><br>
      <i>第九天傍晚，前面出现了陆地的轮廓。<br>
      岸上有火光——那是牧人在烧灌木。<br><br>
      是伊塔卡。近得能看见人。</i>`,
    next: 'n3' },

  n3: { who: 'eurylochus', emote: 'calm',
    text: `「船长，你去睡吧。」<br><br>
      「就剩这么点路了，我盯着。你九天没合眼了。」<br><br>
      <i>而底舱里，有人正在小声说着那只袋子。</i>`,
    next: 'puzzle' },

  puzzle: { puzzle: 'rumor', okNext: 'solved', failNext: 'unsolved',
    okAct: { metis: 1, peitho: 1, flags: ['rumor_solved'] },
    failAct: { hubris: 3 } },

  solved: { who: 'odysseus', emote: 'weary',
    text: `谣言按住了。可你还是九天没睡。<br><br>
      眼皮已经不听使唤了。`,
    choices: [
      { label: '🜃 站到岸上再睡。（花光忍耐，硬撑最后一夜）', endureCost: 2, next: 'awake',
        if: { endure: 2 }, hint: '忍耐 −2' },
      { label: '把舵交给欧律洛科斯，去睡。', next: 'sleep' },
    ] },

  unsolved: { who: 'odysseus', emote: 'weary',
    text: `你没找出源头，那句话还在船上传。<br><br>
      而你的眼皮已经不听使唤了。`,
    next: 'sleep' },

  sleep: { bg: 'ship_night', who: null,
    text: `你倒在船尾，睡得像块石头。<br><br>
      底舱里的人凑到一起：<br>
      「凭什么他一个人拿？我们跟他出生入死十年，回去两手空空。」<br>
      「就看一眼。」<br><br>
      <i>银绳解开了。</i>`,
    next: 'burst' },

  awake: { bg: 'ship_night', who: 'odysseus', emote: 'weary',
    text: `你把绳子绑在自己手腕上，坐在袋子旁边，睁着眼睛熬到天亮。<br><br>
      有人在半夜摸过来，看见你还醒着，又退了回去。<br><br>
      <i>但第二天正午，你还是撑不住了。<br>
      你只睡了一炷香的工夫。</i><br><br>
      而这一炷香，够他们把银绳解开一个角。`,
    act: { flags: ['bag_partial'] },
    next: 'burst' },

  burst: { bg: 'ship_storm', who: 'odysseus', emote: 'shock',
    text: `所有的风一起冲了出来。<br><br>
      船像一片叶子一样被抛起来，帆撕了，人扑在甲板上抓着任何抓得住的东西。<br><br>
      <i>你醒过来，第一眼看见的是——<b>伊塔卡在远去</b>。</i>`,
    next: 'blown' },

  blown: { who: 'odysseus', emote: 'sad',
    choices: [
      { label: '跳进海里。就这样算了。', next: 'give_up', act: { hubris: 5 } },
      { label: '🜃 蒙住头，躺在甲板上，什么也不做。', endureCost: 1, next: 'endure_it',
        act: { athena: 2, metis: 1 }, hint: '忍耐 −1' },
    ],
    text: `<i>荷马在这里写了一句很奇怪的话：<br>
      奥德修斯醒来后，认真考虑了跳海。</i><br><br>
      九天不睡，九天掌舵，看见了家门口的火光——<br>
      然后被自己人一夜之间送回了原点。`,
    },

  give_up: { who: 'eurylochus', emote: 'shock',
    text: `你翻过船舷的时候，是欧律洛科斯抓住了你的腰带。<br><br>
      「船长！你死了我们怎么办！」<br><br>
      <i>你被拖回甲板上。全船都看见了。</i><br><br>
      <i>——傲慢 +5。<br>
      不是因为你太骄傲，而是因为你让所有人看见你放弃了。</i>`,
    next: 'back' },

  endure_it: { who: 'odysseus', emote: 'weary',
    text: `我把斗篷蒙在头上，在甲板上躺了下来。<br><br>
      不喊，不骂，不问是谁解开的绳子。<br><br>
      <i>——这是 πολύτλας，「承受了很多的」。<br>
      荷马给奥德修斯的第二个固定称号，就是这个。<br>
      它说的不是能打，是能扛。</i>`,
    act: { endureMax: 1, log: '风袋被打开那天，你蒙着头在甲板上躺了一整天。' },
    next: 'back' },

  back: { bg: 'aeolia', who: 'aeolus', emote: 'angry',
    text: `风把你们原样吹回了埃俄利亚。<br><br>
      你又一次站在那道青铜墙下面。埃俄罗斯从门里看着你，脸色变了。<br><br>
      「滚。」<br><br>
      「所有神明里最遭恨的那种人，我不能帮。<br>
      你能被吹回来，说明有神在跟你过不去。<b>滚。</b>」`,
    next: 'end_pick' },

  end_pick: { bg: 'ship_day', who: 'odysseus', emote: 'weary',
    text: `门在你面前关上了。<br><br>
      接下来的六天六夜，没有一丝风。六百个人靠桨往前划。<br><br>
      <i>第七天，前面出现了一个几乎完美的港湾。</i>`,
    act: { supply: -18, crew: -0 },
    next: 'end' },

  end: { chapterEnd: true, text: '' },
} };
