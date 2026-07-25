// 城镇 NPC 与对话
// 两类：① 具名剧情 NPC（固定港口、推动主支线）② 通用原型（每港随机点缀，说本地风物与传闻）
// 对话节点：{ text, choices?:[{label, next?, act?}] }；act 由 town/quests 解释执行

export const STORY_NPCS = [
  {
    id: 'npc_hornigold', name: '本杰明·霍尼戈德', port: 'NASSAU', role: 'pirate',
    look: { coat: '#5a4b8c', hat: true },
    minChapter: 2,
    dialog: {
      start: {
        text: '「你就是那个从布里斯托尔来的小子？会看海图的那个。」他把朗姆酒推过来一杯，「拿骚不问你从哪来，只问你敢不敢。」',
        choices: [
          { label: '「我敢。」', next: 'join' },
          { label: '「这里真的没有王法？」', next: 'law' },
        ],
      },
      law: {
        text: '「法？」他笑了，「我们有公约：伤残有补偿，赃物按份分，船长打仗时说了算，其余时候投票。比国王的法公道多了。」',
        choices: [{ label: '「那我签。」', next: 'join' }],
      },
      join: {
        text: '「好。记住我的规矩——我们不抢英国船。」他顿了顿，「有人不同意，早晚会为这个赶我下台。」',
        act: { type: 'quest', id: 'q_main_nassau' },
      },
    },
  },
  {
    id: 'npc_eden', name: '查尔斯·伊登总督', port: 'BATH', role: 'gov',
    look: { coat: '#7a5f2e', hat: true },
    minChapter: 5,
    dialog: {
      start: {
        text: '总督把一张纸推到桌子中央，又推过来一支笔。「国王的赦免。签了，过去的事一笔勾销。」他没有看你的眼睛。',
        choices: [
          { label: '（去总督府正式办理）', act: { type: 'panel', panel: 'governor' } },
          { label: '「您为什么帮我？」', next: 'why' },
        ],
      },
      why: {
        text: '「北卡罗来纳很穷，蒂奇先生。」他终于抬起头，「穷地方需要……活跃的商业。」',
        choices: [{ label: '（明白了）', act: { type: 'close' } }],
      },
    },
  },
  {
    id: 'npc_mary', name: '玛丽·奥蒙德', port: 'BATH', role: 'lady',
    look: { coat: '#8c5570', hat: false },
    minChapter: 5,
    dialog: {
      start: {
        text: '她在院子里晾烟叶，头也不抬：「你就是那个胡子里插引信的人？」',
        choices: [
          { label: '「传闻而已。」', next: 'truth' },
          { label: '「你不怕我？」', next: 'fear' },
        ],
      },
      truth: { text: '「我猜也是。」她把最后一片烟叶挂上去，「真那么可怕的人，不会站在别人家院子外面不敢进来。」', act: { type: 'flag', flag: 'metMary' } },
      fear: { text: '「怕。」她说，「但巴斯镇每个人都怕点什么。怕收成、怕税、怕冬天。你只是新来的那一样。」', act: { type: 'flag', flag: 'metMary' } },
    },
  },
  {
    id: 'npc_bonnet', name: '斯蒂德·邦尼特', port: 'BRIDGETOWN', role: 'pirate',
    look: { coat: '#b08b3f', hat: true },
    minChapter: 4,
    dialog: {
      start: {
        text: '一个穿着讲究睡袍的绅士正对着航海书发愁：「请问……三角帆和纵帆，究竟哪个是哪个？」',
        choices: [
          { label: '「你连这都不懂就出海？」', next: 'why' },
          { label: '（耐心给他讲一遍）', next: 'teach' },
        ],
      },
      why: { text: '「我给水手发工资！」他委屈地说，「而且我实在受不了家里那位了。」', choices: [{ label: '（叹气）', next: 'teach' }] },
      teach: {
        text: '他把你的话一字不落记在本子上，然后抬头：「先生，能不能……让我跟着你的船队？我出钱。」',
        act: { type: 'quest', id: 'q_side_bonnet' },
      },
    },
  },
  {
    id: 'npc_maynard', name: '罗伯特·梅纳德中尉', port: 'CHARLESTON', role: 'navy',
    look: { coat: '#2f4a7a', hat: true },
    minChapter: 4,
    dialog: {
      start: {
        text: '一名皇家海军军官正在核对补给单。他抬眼看了你很久，久到你确信他认出了你。<br>「先生，」他说，「弗吉尼亚的斯波茨伍德总督最近很关心外滩群岛的水文。」',
        choices: [
          { label: '「关我什么事。」', next: 'end' },
          { label: '「他该关心的是别的。」', next: 'end' },
        ],
      },
      end: { text: '他点点头，把单子折好放进怀里。「总有一天，先生。总有一天。」', act: { type: 'flag', flag: 'metMaynard' } },
    },
  },
  {
    id: 'npc_surgeon', name: '船医·霍华德', port: 'CHARLESTON', role: 'doctor',
    look: { coat: '#4a6b5a', hat: false },
    minChapter: 4,
    dialog: {
      start: {
        text: '药铺后堂，一个瘦削的人正在称量汞粉。「城里的药快没了，」他说，「病的人比药多。」',
        act: { type: 'quest', id: 'q_main_charleston' },
      },
    },
  },
  {
    id: 'npc_hands', name: '以色列·汉兹', port: 'NASSAU', role: 'pirate',
    look: { coat: '#6b4a2e', hat: true },
    minChapter: 3,
    dialog: {
      start: {
        text: '「舵手？我干过。」他把烟斗磕了磕，「不过我有个毛病——话多。你要是受不了，现在就说。」',
        choices: [
          { label: '「话多没关系，别背叛我。」', next: 'loyal' },
          { label: '「我受不了。」', next: 'no' },
        ],
      },
      loyal: { text: '「背叛？」他咧嘴，「船长，在这行当里，背叛的人活不过第二个月。我可是打算活很久的。」', act: { type: 'quest', id: 'q_side_hands' } },
      no: { text: '「那真可惜。」他重新点上烟斗，「你会回来找我的。」', act: { type: 'close' } },
    },
  },
  {
    id: 'npc_rogers', name: '伍兹·罗杰斯总督', port: 'NASSAU', role: 'gov',
    look: { coat: '#8c2f22', hat: true },
    minChapter: 6, requireFlag: 'refusedPardon',
    dialog: {
      start: {
        text: '新总督站在他刚刚修好的炮台上：「我给过所有人机会。」他把赦免状卷起来，「你选了另一条路，蒂奇先生。那就按另一条路的规矩来。」',
        act: { type: 'quest', id: 'q_main_rogers' },
      },
    },
  },
];

// 通用原型：每个港口随机放 2-4 个，台词按港口/国籍/年代替换
export const NPC_ARCHETYPES = [
  {
    id: 'harbormaster', name: '港务长', role: 'official', look: { coat: '#5b6b7a', hat: true },
    lines: [
      '「停泊费按吨算，别想蒙混过去。」他抖了抖账本，「{port}的规矩就是这样。」',
      '「风向这两天不对，」港务长说，「要走趁早。」',
      '「你这船……」他打量了一下，「吃水这么浅，是跑近海的吧？」',
    ],
  },
  {
    id: 'drunk', name: '醉汉水手', role: 'sailor', look: { coat: '#7a6a4a', hat: false },
    lines: [
      '「我跟你说……」他打了个酒嗝，「西班牙人的珍宝船队，每年这个时候都在{rumorPort}集结。」',
      '「别去{dangerPort}！」他抓住你的袖子，「那儿的绞刑架从来没空过。」',
      '「我见过黑胡子。」他神秘兮兮地说，「他有六把手枪，胡子里点着火。」（他显然不知道你是谁。）',
    ],
  },
  {
    id: 'merchant', name: '商人', role: 'trader', look: { coat: '#8c7a3f', hat: true },
    lines: [
      '「{good}？这地方多得是，便宜。」他压低声音，「但运到北边去，能卖三倍价钱。」',
      '「战争一起，什么都涨。」他搓着手，「火药、药品、粮食——尤其是粮食。」',
      '「荷兰人不问货从哪来。」他挤挤眼，「你懂我意思。」',
    ],
  },
  {
    id: 'priest', name: '修士', role: 'priest', look: { coat: '#4a4a52', hat: false },
    lines: [
      '「海会带走人，孩子。」他划了个十字，「也会带回来一些不该回来的东西。」',
      '「我们这儿收留过不少水手，」修士说，「大多数没能活到还愿。」',
      '「你的手在抖。」他看着你，「是酒，还是别的什么？」',
    ],
  },
  {
    id: 'kid', name: '码头的孩子', role: 'kid', look: { coat: '#6b8c5a', hat: false },
    lines: [
      '「先生！先生！」小孩追着你跑，「你的船去过多远的地方？」',
      '「我长大了也要当水手！」他挥着一根木棍，「像那些故事里一样！」',
      '「他们说海的那边还是海。」小孩皱着眉，「那到底哪里是尽头呀？」',
    ],
  },
  {
    id: 'shipwright', name: '船匠', role: 'worker', look: { coat: '#6b5330', hat: false },
    lines: [
      '「你那舵杆快裂了，」他头也不抬，「别等它在浪里断给你看。」',
      '「好橡木现在难找。」船匠叹气，「都被海军征去了。」',
      '「加铁皮？可以。」他敲敲船板，「但船会变重，跑不快。你自己选。」',
    ],
  },
];

export function archetypeLine(arch, ctx) {
  const line = arch.lines[(ctx.seed + arch.lines.length) % arch.lines.length];
  return line
    .replace('{port}', ctx.portName)
    .replace('{rumorPort}', ctx.rumorPort)
    .replace('{dangerPort}', ctx.dangerPort)
    .replace('{good}', ctx.good);
}
