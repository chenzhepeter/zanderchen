// 第一章 · 喀孔涅斯的教训
// 教学目标：卡牌战斗（气焰 / 破绽 / 非致命胜利）。
// 剧情目标：第一次死人不是因为怪物，是因为拿到东西之后不肯走。
// 三条路都会打一仗——区别在于你是在什么情况下打的。
export const SCRIPT = { id: 'ch01', nodes: {

  start: { bg: 'ismarus', who: null,
    text: `顺风把船队一路推到了色雷斯海岸。<br><br>
      伊斯马罗斯就在眼前——城墙不高，港口没有设防，仓库里堆着酒。`,
    next: 'n1' },

  n1: { who: 'eurylochus', emote: 'smile',
    text: `「船长，弟兄们打了十年仗。」<br><br>
      「上岸拿点补给不过分吧？酒、粮食、几头羊——拿了就走。」`,
    choices: [
      { label: '「拿了就走。我数到日落。」', next: 'raid', act: { supply: 20, kleos: 2 } },
      { label: '🜃 「绕过去。我们只取水。」', endureCost: 1, next: 'skip',
        act: { athena: 2, flags: ['ismarus_clean'] }, hint: '忍耐 −1' },
    ] },

  // ---- 干净路线：只取水 ----
  skip: { bg: 'beach_day', who: 'odysseus', emote: 'calm',
    text: `你下令绕过城，只在河口取水。<br><br>
      弟兄们没说话，但你听见有人在船尾骂了一句。<br><br>
      取水取到一半，山坡上出现了几个人影——喀孔涅斯人的哨兵。他们不知道你们只是路过。`,
    next: 'tut' },

  // ---- 劫掠路线 ----
  raid: { bg: 'ismarus', who: 'odysseus', emote: 'calm',
    text: `上岸很顺利。城里的人跑了，仓库门是敞开的。<br><br>
      你在日落前吹了号：<b>上船。</b><br><br>
      没有人动。`,
    next: 'n2' },

  n2: { who: 'crew', emote: 'smile', nameAs: '一个水手',
    text: `「船长，这儿有酒！好多酒！」<br><br>
      「再待一晚吧，就一晚——十年了，我们连一顿热的都没好好吃过。」`,
    choices: [
      { label: '🜃 「现在。全部上船。」（把所有人硬拖走）', endureCost: 2, next: 'obey',
        act: { athena: 2, kleos: 3, flags: ['ismarus_clean'] }, hint: '忍耐 −2' },
      { label: '「……那就一晚。」', next: 'stay', act: { supply: 10 } },
      { label: '「随你们。我先上船。」', next: 'stay', act: { supply: 5, hubris: 3 } },
    ] },

  obey: { bg: 'beach_dusk', who: 'eurylochus', emote: 'angry',
    text: `他们骂骂咧咧地上了船。有人把酒坛砸在沙滩上。<br><br>
      欧律洛科斯是最后一个走的：「船长，你太紧了。」<br><br>
      <i>你还不知道自己刚刚救了多少条人命。</i><br><br>
      解缆的时候，山坡上响起了马蹄声——跑掉的城里人搬来了内陆的亲戚。
      不过你们已经在水里了，他们只追上了断后的那一队。`,
    next: 'tut' },

  stay: { bg: 'beach_dusk', who: 'odysseus', emote: 'weary',
    text: `那一夜他们在沙滩上宰羊、喝酒、唱歌，唱到嗓子哑。<br><br>
      而跑掉的喀孔涅斯人去了内陆。他们那里有亲戚，很多亲戚，而且都会骑马。`,
    next: 'ambush' },

  ambush: { who: 'eurybates', emote: 'shock',
    text: `天还没亮，号角就响了。<br><br>
      「船长——！山坡上！全是人！」<br><br>
      <i>一半的人还醉着，找不到自己的矛。</i>`,
    next: 'tut' },

  // ---- 战斗教学 ----
  tut: { who: 'athena', emote: 'calm',
    text: `<i>雅典娜的声音只有你听得见。</i><br><br>
      「打之前，先看清楚两件事。」<br><br>
      「敌人有两条血：<b>❤️ 生命</b>和<b>💠 气焰</b>。<br>
      <b>红色的牌</b>打生命，<b>蓝色和绿色的牌</b>打气焰。」<br><br>
      「打光他的气焰，他会露出<b>破绽</b>——两个回合动不了，而且受到的伤害翻倍。」`,
    next: 'tut2' },

  tut2: { who: 'athena', emote: 'sly',
    text: `「所以你有两条路。」<br><br>
      「一条是把他的生命打光——他就死了。你会涨<b>傲慢</b>。」<br><br>
      「另一条是<b>反复打破他的气焰</b>。破够次数，他自己就退了。<br>
      你会涨<b>名声</b>，而且不涨傲慢。」<br><br>
      「你是多智的奥德修斯，不是阿喀琉斯。<b>大多数时候，第二条路更划算。</b>」`,
    next: 'battle' },

  battle: {
    battle: 'e_cicone', bg: 'beach_dusk',
    winNext: 'after_win', yieldNext: 'after_yield', loseNext: 'after_lose',
    killAct: { crew: -72, hubris: 6, kleos: 4, bie: 1, log: '伊斯马罗斯外的沙滩上，七十二个人没能回到船上。' },
    yieldAct: { crew: -40, kleos: 8, peitho: 1, athena: 1, log: '你把喀孔涅斯人喝退了，代价是四十个人。' },
    loseAct: { crew: -90, supply: -10, log: '沙滩上的那一夜，是这趟航程第一次真正的失败。' },
  },

  after_win: { bg: 'ship_day', who: 'odysseus', emote: 'sad',
    text: `按老规矩，开船前要点名，喊到谁的名字谁应一声。<br><br>
      今天早上，有七十二个名字没有人应。<br><br>
      <i>杀出来了。可这一仗本来就不该打。</i>`,
    next: 'lesson' },

  after_yield: { bg: 'ship_day', who: 'odysseus', emote: 'weary',
    text: `你没有下令追杀。你让人在沙滩上摆开阵型，然后喊话——<br>
      喊他们的城，喊他们的酒，喊你们已经拿够了、马上就走。<br><br>
      他们让开了一条路。<br><br>
      即便如此，还是有四十个人没能上船。`,
    next: 'lesson' },

  after_lose: { bg: 'ship_day', who: 'odysseus', emote: 'sad',
    text: `你被打倒在沙滩上，是欧律洛科斯把你拖回船的。<br><br>
      开船的时候，海滩上还躺着很多人。你不敢数。`,
    next: 'lesson' },

  lesson: { who: 'odysseus', emote: 'calm',
    hideChoices: true,
    text: `<i>这是这趟航程的第一课，而且是最贵的一课：</i><br><br>
      不是海怪，不是神明，不是风暴。<br>
      第一次死人，是因为<b>拿到了不该拿的东西之后不肯走</b>。<br><br>
      <i>接下来的十年，这件事会用各种形式再发生很多次。</i>`,
    act: { notes: ['n_kleos'] },
    next: 'storm' },

  storm: { bg: 'ship_storm', who: null,
    text: `离岸第三天，宙斯派来了北风。<br><br>
      帆被撕成三片，桅杆折了一根。九天九夜，海图上再也找不到自己在哪里。<br><br>
      第十天，前面出现了一片开着花的海岸。`,
    act: { supply: -12 },
    next: 'end' },

  end: { chapterEnd: true, text: '' },
} };
