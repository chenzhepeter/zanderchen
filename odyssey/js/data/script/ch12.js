// 第十二章 · 伊塔卡 · 乞丐与弓
// 分级处理：原著在这一章屠杀了 108 个求婚者并绞死 12 名女仆。
// 本作把它改成「审判与驱逐」——非致命路线是主推路线，绞刑段落完全不做，
// 演出走剪影与尘土，不做血腥描写。
export const SCRIPT = { id: 'ch12', nodes: {

  start: { bg: 'ithaca_shore', who: 'odysseus', emote: 'shock',
    text: `你在沙滩上醒过来，身边堆着淮阿喀亚人留下的铜鼎和金杯。<br><br>
      岛上起着雾，什么都认不出来。<br><br>
      <i>二十年了。你甚至一度以为他们把你放错了地方。</i>`,
    next: 'athena' },

  athena: { bg: 'ithaca_shore', who: 'athena', emote: 'sly',
    text: `<i>一个牧羊的少年从雾里走出来，然后变成了她。</i><br><br>
      「你还是老样子——连见了我都要先编一个假身份。」<br><br>
      「我们两个是一路人：<b>你是凡人里最会想办法的，我是神里最会想办法的。</b>」`,
    act: { athena: 3, kleos: 5 },
    next: 'plan' },

  plan: { who: 'athena', emote: 'calm',
    text: `「你家里有一百零八个人，天天吃你的牛、喝你的酒，逼你妻子改嫁。」<br><br>
      「你要是现在冲进去报名字，他们会当场把你剁了。」<br><br>
      「所以——先当几天乞丐。<br>
      <b>看清楚这屋子里谁还讲规矩，再动手。</b>」`,
    choices: [
      { label: '🜃 「好。我先看几天。」', endureCost: 2, next: 'disguise',
        if: { endure: 2 }, act: { metis: 1, athena: 2 }, hint: '忍耐 −2' },
      { label: '「二十年了。我今天就要进那个门。」', next: 'rush', act: { hubris: 10, bie: 1 } },
    ] },

  rush: { bg: 'megaron', who: 'odysseus', emote: 'angry',
    text: `你提着剑直接走进了大厅。<br><br>
      一百零八个人一起站了起来。<br><br>
      <i>雅典娜在你背后叹了一口气。</i>`,
    act: { crew: -0, log: '他没有伪装就走进了自己的家。' },
    next: 'final_battle' },

  disguise: { bg: 'ithaca_shore', who: 'odysseus_b', emote: 'weary',
    text: `她碰了你一下。<br><br>
      皮肤皱了，头发白了，眼睛浑了，身上只剩一件破斗篷和一只讨饭的袋子。<br><br>
      <i>连你自己都认不出镜子里的人。</i>`,
    next: 'dog' },

  dog: { bg: 'megaron', who: 'odysseus_b', emote: 'cry',
    text: `院子门口的粪堆上趴着一条老狗，浑身是虱子，站都站不起来。<br><br>
      <b>阿尔戈斯。</b>你出海那年它刚会跑。<br><br>
      它听见你的声音，抬了抬耳朵，摇了摇尾巴，努力想爬过来。<br>
      它没爬起来。<br><br>
      <i>它认出你的那一刻，死了。<br>
      而你不能过去，不能出声——你转过头，用袖子擦了一下眼睛。</i>`,
    act: { kleos: 8, log: '老狗阿尔戈斯认出了他，然后死了。' },
    next: 'puzzle1' },

  puzzle1: { puzzle: 'loyalty', okNext: 'allies', failNext: 'alone',
    okAct: { metis: 1, peitho: 1, kleos: 10, flags: ['has_allies'] },
    failAct: { hubris: 3 } },

  allies: { bg: 'megaron', who: 'eumaeus', emote: 'shock',
    text: `夜里你把猪倌和牧牛人叫到院子里，撩起裤腿给他们看膝盖上那道疤。<br><br>
      两个人一起跪了下去，抱着你的手哭。<br><br>
      「主人……我们等了二十年。」<br><br>
      <i>你让他们做两件事：<b>把大厅的门锁上，把武器全部收走。</b>」`,
    act: { arrows: 6, athena: 2 },
    next: 'penelope' },

  alone: { bg: 'megaron', who: 'odysseus_b', emote: 'weary',
    text: `你看错了几个人。<br><br>
      有的该信的没信，有的不该信的信了。明天这一场，帮手不多。`,
    next: 'penelope' },

  penelope: { bg: 'megaron', who: 'penelope', emote: 'sad',
    text: `女主人请这个"客人"坐下，问他从哪里来，见没见过她丈夫。<br><br>
      <i>你编了一个很长的故事，编得滴水不漏。<br>
      她听着听着就哭了——荷马说：她的眼泪像春天融化的雪。<br><br>
      而你坐在她面前，眼睛一动不动，「像角，像铁」。</i>`,
    choices: [
      { label: '🜃 继续编。现在说出来，她会藏不住表情。', endureCost: 1, next: 'hold',
        act: { metis: 1, athena: 2, kleos: 8 }, hint: '忍耐 −1' },
      { label: '告诉她。二十年了。', next: 'tell_her', act: { hubris: 5 } },
    ] },

  hold: { who: 'penelope', emote: 'weary',
    text: `你什么也没说。<br><br>
      她擦干眼泪，说：「明天我要办一场比赛。」<br><br>
      「谁能给我丈夫那张弓上弦，再一箭穿过十二把斧子，我就跟谁走。」<br><br>
      <i>她织了三年寿衣拖时间，白天织，晚上拆。<br>
      现在她想出了另一个办法——一个只有<b>一个人</b>能通过的考试。</i>`,
    act: { notes: ['n_penelope'] },
    next: 'puzzle2' },

  tell_her: { who: 'penelope', emote: 'shock',
    text: `她盯着你看了很久，然后摇了摇头。<br><br>
      「这二十年里，来过很多个说自己是他的人。」<br><br>
      <i>她转身走了。<br>
      第二天她还是宣布了那场比赛——但她已经心神不宁，
      而屋子里有人看出了不对劲。</i>`,
    act: { notes: ['n_penelope'] },
    next: 'puzzle2' },

  puzzle2: { puzzle: 'bow', okNext: 'stood', failNext: 'stood',
    okAct: { bie: 1, metis: 1, kleos: 20, arrows: 6, notes: ['n_bow'] },
    failAct: { kleos: 6, notes: ['n_bow'] } },

  stood: { bg: 'megaron', who: 'odysseus', emote: 'angry',
    text: `你从座位上站起来，把剩下的箭倒在脚边。<br><br>
      破斗篷落在地上。<br><br>
      「你们说这个家没有主人了。」<br><br>
      「你们吃了我三年的牛，喝了我三年的酒，逼了我妻子三年——<br>
      <b>你们既不怕神，也不怕人。</b>」`,
    next: 'ultimatum' },

  ultimatum: { who: 'antinous', emote: 'shock',
    text: `安提诺俄斯手里的酒杯掉了。<br><br>
      「……这不可能。他早死在海上了。」<br><br>
      <i>门锁上了。武器收走了。一百零八个人，和一张弓。</i>`,
    choices: [
      { label: '🜃 「我给你们一次机会。赔清楚，然后滚出这座岛。」', endureCost: 1, next: 'offer',
        act: { peitho: 1, kleos: 15, athena: 3 }, hint: '忍耐 −1 · 非致命路线' },
      { label: '「一个都别想走。」', next: 'final_battle', act: { hubris: 12, bie: 1 } },
    ] },

  offer: { who: 'antinous', emote: 'angry',
    text: `大厅里没有人动。<br><br>
      然后安提诺俄斯笑了：「一个老头，一张弓。弟兄们，他一次只能射一个。」<br><br>
      <i>他喊了一声，所有人一起扑了上来。</i><br><br>
      <b>你给过他们机会了。</b>`,
    act: { flags: ['offered_mercy'] },
    next: 'final_battle' },

  final_battle: {
    battle: 'e_suitors', bg: 'megaron',
    yieldNext: 'yielded', killNext: 'killed', loseNext: 'yielded',
    yieldAct: { kleos: 30, peitho: 1, athena: 4 },
    killAct: { kleos: 20, hubris: 15, bie: 1 },
    loseAct: { crew: -2 },
  },

  yielded: { bg: 'megaron', who: 'odysseus', emote: 'weary',
    text: `弓弦还在响。<br><br>
      大厅里的人一个一个跪了下去——不是被打倒的，是认出来了。<br><br>
      <i>你让人把他们赶出了院子。带走的只有他们自己的衣服。<br><br>
      <b>这一间厅堂没有变成屠宰场。</b><br>
      而在原著里，它变成了。</i>`,
    act: { log: '大厅里的求婚者被赶了出去。没有人死。' },
    next: 'athena_peace' },

  killed: { bg: 'megaron', who: 'odysseus', emote: 'angry',
    text: `打完的时候，大厅里只剩你一个人站着。<br><br>
      <i>荷马在这里写的是：他浑身是血和土，像一头刚吃完牛的狮子。</i><br><br>
      老乳母欧律克勒娅走进来，看见这一屋子，正要欢呼——<br><br>
      你拦住了她：<br>
      「老人家，心里高兴就行了，别喊出来。<br>
      <b>对着死人欢呼，是不敬。</b>」`,
    act: { hubris: 5, log: '大厅里的一百零八个求婚者，一个都没有走出去。' },
    next: 'athena_peace' },

  athena_peace: { bg: 'megaron', who: 'athena', emote: 'calm',
    text: `第二天，被赶走（或被抬走）的那些人的父兄提着武器上了山。<br><br>
      两边刚要撞上，一道雷劈在了他们中间的地上。<br><br>
      「<b>伊塔卡人，住手。</b>」<br><br>
      「够了。别再流血了。」<br><br>
      <i>——全诗的最后一页，是雅典娜叫停了一场复仇。</i>`,
    act: { kleos: 10 },
    next: 'bed' },

  bed: { bg: 'olive_room', who: 'penelope', emote: 'calm',
    text: `她坐在火边，隔着一整间屋子看着你，一句话也不说。<br><br>
      忒勒马科斯急了：「母亲，你怎么这么硬心肠？」<br><br>
      她说：「如果他真是他，我们两个之间有些记号，是别人不知道的。」<br><br>
      然后她转向女仆：<br>
      「欧律克勒娅，把主人的那张床<b>搬到卧室外面</b>来，给他铺好。」`,
    next: 'test' },

  test: { who: 'odysseus', emote: 'shock',
    choices: [
      { label: '「谁能搬得动它？那张床的一条腿，是一棵还长在地里的橄榄树。」', next: 'recognize',
        act: { kleos: 20, notes: ['n_penelope'] } },
      { label: '「好，那就搬吧。」', next: 'failed_test', act: { hubris: 8 } },
    ],
    text: `<i>你跳了起来。</i><br><br>
      那张床是你自己凿的。当年院子里长着一棵橄榄树，你没有砍它——<br>
      你把树冠削掉，就着<b>还活着的树根</b>凿成了床腿，再围着它盖起了整间卧室。<br><br>
      <b>那张床搬不动。除非有人砍断了树根。</b>` },

  failed_test: { who: 'penelope', emote: 'sad',
    text: `她的脸沉了下去。<br><br>
      「……你不知道那张床。」<br><br>
      <i>你反应过来的时候已经晚了。<br>
      她还是接受了你——但你们之间，从此有了一道很细的裂缝。</i>`,
    next: 'end' },

  recognize: { who: 'penelope', emote: 'cry',
    text: `她的膝盖软了。<br><br>
      她跑过来抱住你的脖子，哭得说不出话，很久很久都不肯松手。<br><br>
      「别怪我。我怕了二十年——怕有人拿这些话来骗我。<br>
      可这张床的事，只有你、我，和一个老女仆知道。」<br><br>
      <i>荷马写她抱住他的时候，用的比喻是：<br>
      <b>像一个泅了很久终于摸到陆地的人，看见岸的那一刻。</b><br><br>
      ——而在这个比喻里，看见岸的是<b>她</b>。</i>`,
    act: { kleos: 25, log: '橄榄树床。二十年之后，珀涅罗珀认出了他。' },
    next: 'end' },

  end: { chapterEnd: true, text: '' },
} };
