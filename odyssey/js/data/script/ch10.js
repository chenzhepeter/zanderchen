// 第十章 · 卡吕普索与星海
// 全作的主题核心：神明给了他一个凡人拿不到的东西，而他拒绝了。
export const SCRIPT = { id: 'ch10', nodes: {

  start: { bg: 'ogygia', who: null,
    text: `俄古癸亚岛。<br><br>
      洞口爬满葡萄藤，四条泉水朝四个方向流出去，柏树上有鸟在筑巢。<br>
      这里没有冬天，没有战争，没有会死的东西。<br><br>
      女神卡吕普索把冲上沙滩的你捡了回去。`,
    next: 'years' },

  years: { who: 'odysseus', emote: 'weary',
    text: `<b>七年。</b><br><br>
      每天夜里我睡在洞里——不是因为想，是因为不得不。<br>
      每天白天我坐在海边那块石头上，朝着东边，哭。<br><br>
      <i>荷马原话：他坐在岸上，用眼泪、叹息和悲伤消磨自己的心，望着荒芜的大海。</i>`,
    act: { crew: 0, log: '在俄古癸亚岛上住了七年。' },
    next: 'offer' },

  offer: { bg: 'ogygia', who: 'calypso', emote: 'sad',
    text: `第七年的一天，她走过来在你旁边坐下。<br><br>
      「宙斯让我放你走。」<br><br>
      「不过在你走之前，我最后问一次。」<br><br>
      「留下来。我给你<b>不老，不死</b>。<br>
      你不会变成一个瘸腿的老头，不会有人抬着你去烧掉。<br>
      你会永远是现在这个样子，和我一起，在这座岛上。」`,
    next: 'compare' },

  compare: { who: 'calypso', emote: 'calm',
    text: `「而你要回去的那个地方是什么？」<br><br>
      「一座多石头的小岛，长不出麦子。<br>
      一个已经老了二十岁的女人。<br>
      一个不认得你的儿子。<br>
      还有——一屋子等着杀你的人。」<br><br>
      「你自己说，哪个更好？」`,
    choices: [
      { label: '「你说得都对。我留下。」', next: 'stay',
        act: { flags: ['stayedWithCalypso'] }, hint: '结局：不朽' },
      { label: '「女神，请别生气。我知道珀涅罗珀比不上你——她会老，会死。」', next: 'answer' },
    ] },

  answer: { who: 'odysseus', emote: 'calm',
    text: `「可我还是每天都想着回去。」<br><br>
      「就算神明再一次把我打碎在酒色的海上，我也扛得住——<br>
      我这颗心早就习惯了扛事。」<br><br>
      <i>——这是全诗最有名的一段回答。<br>
      他没有说伊塔卡更好。他承认了它更差。<br>
      <b>然后他还是选了它。</b></i>`,
    act: { kleos: 20, athena: 4, endureMax: 1, notes: ['n_nostos'],
           log: '卡吕普索提出让他不死不老，他拒绝了。' },
    next: 'raft' },

  stay: { bg: 'ogygia', who: 'calypso', emote: 'smile',
    text: `她笑了。<br><br>
      那天夜里的星星和前一天完全一样，和明天、和一百年后的每一天也完全一样。`,
    next: 'ending_immortal' },

  ending_immortal: { ending: 'IMMORTAL', text: '' },

  raft: { bg: 'ogygia', who: 'calypso', emote: 'sad',
    text: `她给了你一把双刃斧、一把锛子，带你去岛那头砍了二十棵干透的树。<br><br>
      第四天，木筏做好了。她给了你水、酒、干粮，还有一阵不伤人的风。<br><br>
      「让大熊座留在你的左手边。」<br><br>
      <i>她站在岸上，一直站到看不见为止。</i>`,
    next: 'puzzle' },

  puzzle: { puzzle: 'stars', okNext: 'sail_ok', failNext: 'sail_bad',
    okAct: { metis: 1, kleos: 10, notes: ['n_stars'] },
    failAct: { supply: -10, notes: ['n_stars'] } },

  sail_ok: { bg: 'ogygia', who: 'odysseus', emote: 'weary',
    text: `十七个昼夜。<br><br>
      我没有合过眼，眼睛一直盯着那七颗星。<br><br>
      第十八天，海面上出现了一块影子——像水上放着一面盾牌。`,
    next: 'poseidon' },

  sail_bad: { bg: 'ship_storm', who: 'odysseus', emote: 'weary',
    text: `方向偏了，多漂了好几天。水和干粮都见了底。<br><br>
      第二十二天，才终于看见陆地。`,
    next: 'poseidon' },

  poseidon: { bg: 'ship_storm', who: 'poseidon', emote: 'angry',
    text: `<i>波塞冬正好从埃塞俄比亚人的宴席上回来。<br>
      他从山顶上一眼看见了那只木筏。</i><br><br>
      「……居然快到了。」<br><br>
      他一叉子搅下去，四面的风一起撞过来。<br>
      木筏散了。`,
    next: 'veil' },

  veil: { bg: 'ship_storm', who: null,
    text: `你在水里泡了两天两夜。<br><br>
      第三天，一个海中的女神——伊诺——浮上来，把自己的头巾扔给你：<br><br>
      「把它缠在腰上，扔掉衣服，游。上岸之后把头巾扔回海里，别回头。」`,
    act: { relics: ['r_veil'] },
    next: 'shore' },

  shore: { bg: 'scheria', who: 'odysseus', emote: 'weary',
    text: `你抓着一块礁石爬上岸，手上的皮全留在了石头上。<br><br>
      你爬进河边的树丛，用落叶把自己埋起来，睡了过去。<br><br>
      <i>赤身裸体，满身盐渍，什么都没有了。<br>
      这就是"多智的奥德修斯"抵达淮阿喀亚人国土时的样子。</i>`,
    act: { supply: -20 },
    next: 'end' },

  end: { chapterEnd: true, text: '' },
} };
