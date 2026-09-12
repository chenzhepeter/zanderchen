// 第八章 · 塞壬与双头险
// 全诗唯一一次，"最优解"被明明白白告诉了主角——而最优解是牺牲六个人。
// 珀里墨得斯在这一章死，除非你手上有神物牌并且肯花两点忍耐。
export const SCRIPT = { id: 'ch08', nodes: {

  start: { bg: 'ship_day', who: 'circe', emote: 'calm',
    text: `临走前喀耳刻把两件事讲得很细。<br><br>
      「先是塞壬。给所有人的耳朵塞蜡。你要是非听不可，就让他们把你绑在桅杆上——
      而且交代好：你越是叫他们松绑，他们越要多绑几道。」`,
    act: { notes: ['n_siren'] },
    next: 'n1' },

  n1: { who: 'circe', emote: 'sad',
    text: `「过了塞壬是海峡。<br><br>
      左边崖上住着<b>斯库拉</b>，六个头，十二只脚。她会叼走<b>六个人</b>。<br>
      右边是<b>卡律布狄斯</b>，一天吞吐三次海水，会把整条船吸下去。」<br><br>
      「<b>贴着斯库拉那边走。</b>丢六个人，总比丢全船好。」<br><br>
      「还有——<b>别跟她打</b>。她是不死的。你打不过。<br>
      你要是停下来打，她会再来一趟，再叼走六个。」`,
    next: 'puzzle' },

  puzzle: { puzzle: 'siren', okNext: 'strait', failNext: 'strait',
    okAct: { kleos: 10, metis: 1, endureMax: 1 },
    failAct: { crew: -4, supply: -5 } },

  strait: { bg: 'strait', who: 'odysseus', emote: 'weary',
    text: `海峡到了。<br><br>
      右边的水在打旋，一圈一圈往下陷，能看见旋涡底下黑色的沙。<br>
      左边的崖高得看不见顶，崖腰上有个洞，洞里什么也看不见。<br><br>
      <i>喀耳刻说过要贴左边走。她也说过别跟斯库拉打。</i>`,
    next: 'tell' },

  tell: { who: 'eurylochus', emote: 'shock',
    text: `「船长，崖上那个洞里……有东西在动。」<br><br>
      「你得跟弟兄们说清楚。他们有权知道自己在往哪儿划。」`,
    choices: [
      { label: '「什么都别说。让他们只管划。」', next: 'silent_row',
        act: { metis: 1 }, hint: '原著里他就是这么做的' },
      { label: '「告诉他们。六个人会死，但船能过去。」', next: 'told',
        act: { peitho: 1, kleos: 5, hubris: 2 } },
    ] },

  silent_row: { who: 'odysseus', emote: 'sad',
    text: `我没有告诉他们斯库拉的事。<br><br>
      我要是说了，他们会丢下桨躲进舱里——那样船就停了，
      而停在这个海峡里，是全船一起死。<br><br>
      <i>荷马写到这里的时候，让奥德修斯自己承认了一句：<br>
      喀耳刻还说过"别穿铠甲"，而我穿了，还提着两支长矛站在船头。<br>
      <b>我想跟她打一场。</b></i>`,
    next: 'armor' },

  told: { who: 'crew', emote: 'shock', nameAs: '桨手们',
    text: `你说完之后，甲板上安静了很久。<br><br>
      然后有人问：「船长，是哪六个？」<br><br>
      你答不上来。没有人答得上来。<br><br>
      <i>他们还是把桨插进了水里。<br>
      ——名声 +5。傲慢 +2。你说了真话，可这不代表你替他们做的决定就轻了。</i>`,
    next: 'armor' },

  armor: { bg: 'strait', who: 'odysseus', emote: 'angry',
    text: `你站在船头。<br><br>
      崖上的洞口开始有东西探出来。`,
    choices: [
      { label: '⚔️ 提矛迎上去。（原著里他就是这么干的，而且没有用）', next: 'battle',
        act: { hubris: 6, bie: 1 } },
      { label: '🜃 放下矛，回到舵边，只管让船跑起来。', endureCost: 2, next: 'run',
        if: { endure: 2 }, hint: '忍耐 −2 · 喀耳刻说过：别打' },
    ] },

  battle: {
    battle: 'e_scylla', bg: 'strait',
    winNext: 'toll', yieldNext: 'toll', loseNext: 'toll',
    winAct: { kleos: 6 },
    loseAct: { crew: -3 },
  },

  run: { bg: 'strait', who: 'odysseus', emote: 'weary',
    text: `你把矛扔在甲板上，跑回舵边。<br><br>
      「划！别抬头！谁都别抬头！」<br><br>
      <i>你听见了上面的声音，但你没有看。你一眼都没有看。</i>`,
    act: { athena: 3, metis: 1, flags: ['scylla_ran'] },
    next: 'toll' },

  toll: { bg: 'strait', who: 'odysseus', emote: 'cry',
    text: `六只手从上面伸下来。<br><br>
      他们被提到半空的时候，还在喊我的名字。<br><br>
      <i>——这是我这一路上，看过的最惨的一幕。荷马原话如此。</i>`,
    act: { crew: -6, log: '斯库拉叼走了六个人。他们在半空中喊的是船长的名字。' },
    next: 'peri_check' },

  // 珀里墨得斯：手上有神物牌 + 肯花两点忍耐把他按在桨位上，才救得下
  peri_check: { branch: [{ if: { anyRelic: true, endure: 2 }, next: 'peri_offer' }], next: 'peri_lost' },

  peri_offer: { who: 'perimedes', emote: 'shock',
    text: `第七只手伸了下来，抓向桨位上的珀里墨得斯。<br><br>
      <i>你手上还有神的东西。</i>`,
    choices: [
      { label: '🜃 扑过去把他按进舱口，用神物挡住那只手。', endureCost: 2, next: 'peri_saved',
        if: { anyRelic: true }, hint: '忍耐 −2 · 消耗一次神物的庇护' },
      { label: '你来不及了。', next: 'peri_lost' },
    ] },

  peri_saved: { who: 'perimedes', emote: 'weary',
    text: `你整个人压在他身上，把他按进了舱口。<br><br>
      那只手抓空了，在甲板上刮出六道白痕，然后缩了回去。<br><br>
      珀里墨得斯躺在舱里，看着你，半天说了一句：<br>
      「……船长，你压着我肋骨了。」<br><br>
      <i>他这一路说过的话，加起来不超过十句。</i>`,
    act: { save: ['perimedes'], kleos: 14, athena: 2, log: '斯库拉的第七只手抓空了。珀里墨得斯还活着。' },
    next: 'after' },

  peri_lost: { who: 'odysseus', emote: 'cry',
    text: `六个人里，有一个是珀里墨得斯。<br><br>
      他没有喊。他从来不喊。<br><br>
      <i>——牌组永久失去「🏹 珀里墨得斯」。</i>`,
    act: { kill: ['perimedes'] },
    next: 'after' },

  after: { bg: 'ship_day', who: 'odysseus', emote: 'weary',
    text: `海峡过去了。船还在。<br><br>
      <i>喀耳刻说的是对的：这已经是最好的结果。</i><br><br>
      <b>可"最好的结果"这几个字，从今天起我再也说不出口了。</b>`,
    next: 'island' },

  island: { bg: 'thrinacia', who: 'odysseus', emote: 'shock',
    text: `前面出现了一座岛。风把牛叫的声音送了过来。<br><br>
      <i>提瑞西阿斯说过这座岛。喀耳刻也说过。<br>
      两个人说的是同一句话：<b>别上岸。</b></i>`,
    next: 'end' },

  end: { chapterEnd: true, text: '' },
} };
