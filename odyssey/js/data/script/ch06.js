// 第六章 · 喀耳刻之岛
// 首次可以永久移除神怒牌。埃尔佩诺耳在这一章死——除非你配药够快，并且肯花一点忍耐。
export const SCRIPT = { id: 'ch06', nodes: {

  start: { bg: 'aeaea_wood', who: null,
    text: `埃埃亚岛。你在山顶上看了一整天，只看见一处炊烟——林子深处，一座石头房子。<br><br>
      你把剩下的人分成两队，抓阄决定谁去。欧律洛科斯抓到了。`,
    next: 'n1' },

  n1: { who: 'eurylochus', emote: 'shock',
    text: `他一个人跑回来的，抖得说不出话。<br><br>
      「屋子外面有狼和狮子，可它们……它们像狗一样摇尾巴。」<br>
      「屋里有个女人在唱歌。她请他们进去吃东西。」<br>
      「我没进去。我躲在门外。」<br><br>
      「船长——<b>他们变成猪了。</b>」`,
    act: { crew: -0, log: '二十二个人在喀耳刻的屋子里变成了猪。' },
    next: 'n2' },

  n2: { bg: 'aeaea_wood', who: 'hermes', emote: 'sly',
    text: `<i>去的路上，一个年轻人拦住了你。他戴着一顶宽檐帽，脚上有一双奇怪的鞋。</i><br><br>
      「拿着这个。黑根白花，凡人很难挖出来——它叫<b>摩吕</b>。」<br><br>
      「她的药对你就不管用了。等她拿棍子敲你的时候，你拔剑扑上去。<br>
      她会请你上床——你要先让她<b>发一个大誓</b>，说不害你。」<br><br>
      <i>他说完就不见了。</i>`,
    act: { relics: ['r_moly'], notes: ['n_moly'], metis: 1 },
    next: 'puzzle' },

  puzzle: { puzzle: 'potion', okNext: 'hall', failNext: 'fight',
    okAct: { metis: 1 } },

  fight: { bg: 'aeaea_hall', who: 'odysseus', emote: 'angry',
    text: `方子没配出来。你把摩吕草直接嚼了，然后踹开了门。<br><br>
      屋子里的狼站了起来。`,
    next: 'battle' },

  battle: {
    battle: 'e_wolf', bg: 'aeaea_hall',
    yieldNext: 'hall', killNext: 'hall_killed', loseNext: 'hall',
    yieldAct: { kleos: 6, peitho: 1 },
    killAct: { hubris: 6, kleos: 2 },
  },

  hall_killed: { bg: 'aeaea_hall', who: 'circe', emote: 'sad',
    text: `狼倒下的时候，喀耳刻从织机后面站了起来，脸色很难看。<br><br>
      「那是你们的人。」<br><br>
      「我把他们变成了猪和狼。你刚才杀掉的那只，
      三天前还在你的船上划桨。」`,
    act: { crew: -1, hubris: 4 },
    next: 'oath' },

  hall: { bg: 'aeaea_hall', who: 'circe', emote: 'shock',
    text: `她把调好的酒递给你，你一口喝完。<br>
      然后她用棍子敲了敲你的肩膀：「去猪圈里跟你的同伴作伴吧。」<br><br>
      你没有变。<br><br>
      她后退了一步，杯子掉在地上。<br>
      「……你是奥德修斯。赫耳墨斯早就跟我说过，总有一天会来一个不怕我的药的人。」`,
    next: 'oath' },

  oath: { who: 'odysseus', emote: 'calm',
    text: `她请你坐下，请你留下。`,
    choices: [
      { label: '「先发誓。以众神的名义，发誓不害我和我的人。」', next: 'restore',
        act: { metis: 1, kleos: 6, athena: 1 } },
      { label: '「不必了。先把我的人变回来。」', next: 'restore', act: { hubris: 3 } },
    ] },

  restore: { bg: 'aeaea_hall', who: 'circe', emote: 'smile',
    text: `她拿药膏在每一头猪身上抹了一遍。<br><br>
      鬃毛落了下去，人站了起来——而且比变成猪之前<b>更年轻、更高、更好看</b>。<br><br>
      他们抱着你哭，哭得整座屋子都在响。喀耳刻站在旁边，也在擦眼睛。`,
    act: { crew: 22, supply: 30, log: '喀耳刻把二十二个人变了回来。' },
    next: 'year' },

  year: { bg: 'aeaea_hall', who: 'odysseus', emote: 'weary',
    text: `你们在她那里住了<b>整整一年</b>。<br><br>
      吃不完的肉，喝不完的酒，睡得着的夜。<br><br>
      <i>一年之后，是弟兄们来提醒我的：<br>
      「船长……你还想回家吗？」</i>`,
    next: 'shrine' },

  shrine: { who: 'circe', emote: 'calm',
    text: `临走前，她带你去了屋后的一处石台。<br><br>
      「你身上跟着东西。海里的那位在盯着你。」<br><br>
      「我可以替你洗掉一点——但是要拿东西换。」<br><br>
      <i>（这是全程仅有的三次<b>永久移除神怒牌</b>的机会之一。）</i>`,
    choices: [
      { label: '献上二十天的粮食。', next: 'purge', act: { supply: -20, removeCards: [] },
        hint: '永久移除一张神怒牌' },
      { label: '不换。粮食比什么都重要。', next: 'warn' },
    ] },

  purge: { who: 'circe', emote: 'calm',
    text: `她把粮食倒进火里，念了一段你听不懂的话。<br><br>
      <i>牌组里少了一张神怒牌。</i><br><br>
      「只能洗掉这一点。剩下的，你得自己扛。」`,
    act: { purgeWrath: 1 },
    next: 'warn' },

  warn: { bg: 'aeaea_wood', who: 'circe', emote: 'sad',
    text: `「你回不了家，除非先去问一个死人。」<br><br>
      「去大洋河的尽头，找先知<b>提瑞西阿斯</b>的魂。<br>
      挖一个坑，倒上蜜、奶、酒和水，撒大麦，割羊的喉咙。」<br><br>
      「亡魂闻到血都会围过来。<b>但只有喝到血的才能开口。</b><br>
      用你的剑拦住其他人——先让提瑞西阿斯喝。」`,
    act: { notes: ['n_nekyia'] },
    next: 'elpenor_check' },

  // 埃尔佩诺耳：配药一次通过（≤3 次）+ 花 1 点忍耐上屋顶，才救得下
  elpenor_check: { branch: [{ if: { flag: 'puzzle_potion_perfect' }, next: 'roof_offer' }], next: 'roof_none' },

  roof_offer: { bg: 'aeaea_hall', who: 'odysseus', emote: 'calm',
    text: `半夜启航前点人数，少了一个。<br><br>
      有人说：「埃尔佩诺耳喝多了，爬到屋顶上去凉快，睡着了。」<br><br>
      <i>号角一响，他会惊醒，会忘了自己在屋顶上。</i>`,
    choices: [
      { label: '🜃 亲自爬上屋顶，把他叫醒了再吹号。', endureCost: 1, next: 'saved',
        if: { endure: 1 }, hint: '忍耐 −1' },
      { label: '吹号。他会自己下来的。', next: 'fall' },
    ] },

  roof_none: { bg: 'aeaea_hall', who: null,
    text: `半夜启航。号角吹响的时候，屋顶上有个人猛地坐了起来。<br><br>
      他喝多了，忘了自己在屋顶上，也忘了梯子在哪一边。<br><br>
      他直接站起来往前走了一步。`,
    next: 'fall' },

  fall: { who: 'odysseus', emote: 'cry',
    text: `声音很轻。<br><br>
      他是全船最年轻的一个，不会打仗，不会掌舵，酒量还差。<br>
      他没有死在特洛伊城下，没有死在独眼巨人的洞里，也没有死在巨人的石头下。<br><br>
      <b>他从一个屋顶上摔了下来。</b><br><br>
      <i>——牌组永久失去「🍷 埃尔佩诺耳」。</i>`,
    act: { kill: ['elpenor'] },
    next: 'sail' },

  saved: { who: 'elpenor', emote: 'shock',
    text: `你爬上屋顶，把他摇醒。<br><br>
      他睁开眼，第一反应是往前走一步——你一把把他拽了回来。<br><br>
      他低头看了看下面，脸一下子白了。<br><br>
      「船长……我刚才差一点。」<br><br>
      <i>「差一点」这三个字，在这一路上很少出现。</i>`,
    act: { save: ['elpenor'], kleos: 12, athena: 2, log: '你把埃尔佩诺耳从喀耳刻的屋顶上叫了下来。' },
    next: 'sail' },

  sail: { bg: 'ship_night', who: null,
    text: `北风把船一路推向大洋河的尽头。<br><br>
      那里没有太阳，永远是雾。`,
    next: 'end' },

  end: { chapterEnd: true, text: '' },
} };
