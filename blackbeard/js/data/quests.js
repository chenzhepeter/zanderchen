// 任务表：主线（kind:'main'，随章节推进）与支线（kind:'side'，由 NPC 给出）
// objective 类型：
//   visit   {port}                 抵达某港
//   deliver {good, qty, port}      把货运到某港（自动交割）
//   defeat  {count, kind?}         海战获胜若干场（kind: merchant/patrol）
//   gold    {amount}               累积金币达到
//   talk    {npc}                  与某 NPC 对话
//   flag    {flag}                 某剧情旗标成立
export const QUESTS = [
  // ============ 主线 ============
  {
    id: 'q_main_prologue', kind: 'main', chapter: 0,
    title: '横渡大西洋', giverText: '"海雀号"的船长把航海日志摔在你面前。',
    desc: '跟着商船横渡大西洋，抵达任意一座美洲港口。西印度群岛的糖不会自己长脚过来。',
    objective: { type: 'visitAny', ports: ['NASSAU', 'PORTROYAL', 'BRIDGETOWN', 'CHARLESTON', 'HAVANA', 'BASSETERRE', 'FORTROYAL'] },
    reward: { gold: 300, exp: 10, skill: 'sailing' },
    doneText: '你第一次看见西印度群岛的绿色。老水手说，很多人到了这里就再也不想回英格兰了。',
  },
  {
    id: 'q_main_privateer', kind: 'main', chapter: 1,
    title: '国王的许可状',
    desc: '取得私掠许可状，然后在海上击败 3 艘船——这一切都是"合法"的。',
    objective: { type: 'multi', all: [{ type: 'flag', flag: 'privateer' }, { type: 'defeat', count: 3 }] },
    reward: { gold: 800, exp: 20, fame: { battle: 10 }, skill: 'combat' },
    doneText: '战争把抢劫变成了爱国。等战争结束，你会发现自己只剩下这一门手艺。',
  },
  {
    id: 'q_main_nassau', kind: 'main', chapter: 2,
    title: '投奔拿骚', giver: 'npc_hornigold',
    desc: '在拿骚找到本杰明·霍尼戈德，加入海盗共和国。',
    objective: { type: 'talk', npc: 'npc_hornigold' },
    reward: { gold: 500, exp: 15, infamy: 10, officer: 'hornigold' },
    doneText: '你在《海盗公约》上签了字。从这一刻起，你不再为任何国王工作。',
  },
  {
    id: 'q_main_qar', kind: 'main', chapter: 3,
    title: '安妮女王复仇号',
    desc: '在海上截获一艘大船，把它改装成你的旗舰。',
    objective: { type: 'flag', flag: 'hasQAR' },
    reward: { gold: 1200, exp: 30, infamy: 20 },
    doneText: '四十门炮。从今往后，看到这面旗的商船会直接投降——不必开一炮。',
  },
  {
    id: 'q_main_charleston', kind: 'main', chapter: 4,
    title: '封锁查尔斯顿', giver: 'npc_surgeon',
    desc: '封锁查尔斯顿港，逼这座城市交出一箱药品。船上的人在等它救命。',
    objective: { type: 'multi', all: [{ type: 'visit', port: 'CHARLESTON' }, { type: 'deliver', good: 'medicine', qty: 12, port: 'CHARLESTON' }] },
    reward: { gold: 1500, exp: 25, infamy: 25 },
    doneText: '一周之后你放走了所有人质，一个也没杀。有人说你是恶魔，可恶魔不会只要一箱药。',
  },
  {
    id: 'q_main_pardon', kind: 'main', chapter: 5,
    title: '赦免状', giver: 'npc_eden',
    desc: '前往巴斯镇，面见查尔斯·伊登总督，决定是否接受国王的赦免。',
    objective: { type: 'multi', any: [{ type: 'flag', flag: 'pardonAccepted' }, { type: 'flag', flag: 'refusedPardon' }] },
    reward: { gold: 0, exp: 20 },
    doneText: '笔放下了。无论签没签，从今天起，路只剩下三条。',
  },
  {
    id: 'q_main_rogers', kind: 'main', chapter: 6, giver: 'npc_rogers',
    title: '拿骚之战', require: { flag: 'refusedPardon' },
    desc: '伍兹·罗杰斯要收回拿骚。联合至少 3 位海盗船长，在恶名达到 60 之后与他决战。',
    objective: { type: 'flag', flag: 'beatRogers' },
    reward: { gold: 3000, exp: 50, infamy: 20 },
    doneText: '国王的舰队升起了白旗。历史在这里拐了个弯。',
  },

  // ============ 支线 ============
  {
    id: 'q_side_bonnet', kind: 'side', giver: 'npc_bonnet', port: 'BRIDGETOWN',
    title: '绅士海盗的学费',
    desc: '斯蒂德·邦尼特想跟着你学做海盗。带他见识一场真正的海战（获胜 1 场）。',
    objective: { type: 'defeat', count: 1 },
    reward: { gold: 900, exp: 15, officer: 'bonnet' },
    doneText: '邦尼特全程躲在桅杆后面，事后却兴奋得睡不着。「原来是这样！」他说。',
  },
  {
    id: 'q_side_hands', kind: 'side', giver: 'npc_hands', port: 'NASSAU',
    title: '话多的舵手',
    desc: '以色列·汉兹想上你的船。先带他去一趟托尔图加，看看他是不是真如自己吹的那样识路。',
    objective: { type: 'visit', port: 'TORTUGA' },
    reward: { gold: 400, exp: 12, officer: 'hands' },
    doneText: '他一路上说了三天的话，但确实一次也没走错水道。',
  },
  {
    id: 'q_side_rum', kind: 'side', port: 'PORTROYAL', giverName: '酒馆老板娘',
    title: '朗姆酒的生意',
    desc: '皇家港的酒馆老板娘要 20 桶朗姆酒——她付得起好价钱。',
    objective: { type: 'deliver', good: 'rum', qty: 20, port: 'PORTROYAL' },
    reward: { gold: 700, exp: 8, morale: 10 },
    doneText: '「痛快！」她把钱袋拍在柜台上，「以后有货只管来找我。」',
  },
  {
    id: 'q_side_medicine', kind: 'side', port: 'SANTIAGO', giverName: '修女',
    title: '瘟疫中的圣地亚哥',
    desc: '圣地亚哥爆发热病，修道院急需 10 单位药品——她们知道你是海盗，但顾不上了。',
    objective: { type: 'deliver', good: 'medicine', qty: 10, port: 'SANTIAGO' },
    reward: { gold: 1100, exp: 15, fame: { trade: 10, adventure: 5 } },
    doneText: '修女在你手背上画了个十字。「上帝不问船上挂什么旗。」',
  },
  {
    id: 'q_side_ivory', kind: 'side', port: 'AMSTERDAM', giverName: '荷兰批发商',
    title: '几内亚的象牙',
    desc: '阿姆斯特丹的批发商要 15 单位象牙。西非的港口有货——如果你敢跑那么远。',
    objective: { type: 'deliver', good: 'ivory', qty: 15, port: 'AMSTERDAM' },
    reward: { gold: 2200, exp: 20, fame: { trade: 18 }, skill: 'negotiation' },
    doneText: '「好货。」他数钱的手很快，「下次带更多来。」',
  },
  {
    id: 'q_side_silver', kind: 'side', port: 'TORTUGA', giverName: '独眼老海狼',
    title: '珍宝船队的传闻',
    desc: '老海狼说，只要你手里攒够 5000 金币，他就把珍宝船队的航线图卖给你。',
    objective: { type: 'gold', amount: 5000 },
    reward: { gold: -1500, exp: 25, infamy: 10, fame: { adventure: 12 }, item: 'i_treasureMap' },
    doneText: '他把一张油腻的羊皮纸推过来。「记住，看过这张图的人，一半死在海上。」',
  },
  {
    id: 'q_side_hunt', kind: 'side', port: 'BOSTON', giverName: '波士顿商会',
    title: '清剿海盗（？）',
    desc: '波士顿商会悬赏：击败 2 艘海上劫掠者。他们不知道委托的对象是谁。',
    objective: { type: 'defeat', count: 2, kind: 'patrol' },
    reward: { gold: 1400, exp: 18, fame: { battle: 20 }, infamy: -10 },
    doneText: '你领了赏金，商会主席还跟你握了手。整件事从头到尾都很荒唐。',
  },
  {
    id: 'q_side_home', kind: 'side', port: 'BRISTOL', giverName: '码头老工头',
    title: '故乡的来信',
    desc: '布里斯托尔的老工头认出了你。「回来看看吧，」他说，「带 30 单位烟草回来，让大伙儿知道你混出息了。」',
    objective: { type: 'deliver', good: 'tobacco', qty: 30, port: 'BRISTOL' },
    reward: { gold: 800, exp: 12, fame: { trade: 10 }, morale: 8 },
    doneText: '老工头分烟叶的时候手一直在抖。「小爱德华，」他说，「你娘要是还在就好了。」',
  },
];

export const QUEST_BY_ID = Object.fromEntries(QUESTS.map(q => [q.id, q]));
