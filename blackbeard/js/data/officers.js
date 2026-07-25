// 历史人物：可招募伙伴与宿敌。bonus 加成作用于玩家/舰队
// role: mate大副 / gunner炮长 / quartermaster舵手 / surgeon船医 / foe宿敌 / npc剧情
export const OFFICERS = [
  {
    id: 'hornigold', name: '本杰明·霍尼戈德', nameEn: 'Benjamin Hornigold', role: 'mate',
    recruitAt: 'NASSAU', chapter: 2, hireCost: 0,
    bonus: { leadership: 2, morale: 8 },
    bio: '拿骚海盗共和国的元老，蒂奇的引路人。他有条不成文的规矩：绝不劫掠英国船——这后来害得他众叛亲离。',
  },
  {
    id: 'hands', name: '以色列·汉兹', nameEn: 'Israel Hands', role: 'quartermaster',
    recruitAt: 'NASSAU', chapter: 3, hireCost: 600,
    bonus: { sailing: 2, speed: 0.4 },
    bio: '蒂奇最信任的大副。传说黑胡子有次在船舱里无故朝桌下开枪，打瘸了他的膝盖，只说了句"不时杀个把人，他们才记得我是谁"。',
  },
  {
    id: 'caesar', name: '黑凯撒', nameEn: 'Black Caesar', role: 'gunner',
    recruitAt: 'OCRACOKE', chapter: 3, hireCost: 800,
    bonus: { gunnery: 3, melee: 2 },
    bio: '从奴隶船上逃出来的非洲酋长，佛罗里达礁岛群的老海狼。据说他曾用一条小艇诱骗整船商人上钩。',
  },
  {
    id: 'bonnet', name: '斯蒂德·邦尼特', nameEn: 'Stede Bonnet', role: 'mate',
    recruitAt: 'BRIDGETOWN', chapter: 4, hireCost: 1200,
    bonus: { negotiation: 3, leadership: -1 },
    bio: '巴巴多斯的富有庄园主，为躲避妻子的唠叨买了条船去当海盗——他甚至给水手发工资。人称"绅士海盗"，是史上最不称职的船长。',
  },
  {
    id: 'vane', name: '查尔斯·瓦恩', nameEn: 'Charles Vane', role: 'gunner',
    recruitAt: 'NASSAU', chapter: 4, hireCost: 1500, ally: true,
    bonus: { gunnery: 2, melee: 3, morale: -5 },
    bio: '最顽固的海盗船长，宁愿放火烧船也不肯接受国王的赦免。凶狠、贪婪、不可信——但打起仗来没人比他更疯。',
  },
  {
    id: 'rackham', name: '"棉布杰克"拉克姆', nameEn: 'Calico Jack Rackham', role: 'quartermaster',
    recruitAt: 'NASSAU', chapter: 4, hireCost: 1000, ally: true,
    bonus: { sailing: 1, negotiation: 2 },
    bio: '爱穿印花棉布衣裳的花花公子，那面骷髅配交叉弯刀的旗子就是他设计的。',
  },
  {
    id: 'surgeon', name: '船医·霍华德', nameEn: 'Surgeon Howard', role: 'surgeon',
    recruitAt: 'PORTROYAL', chapter: 2, hireCost: 900,
    bonus: { healing: 3 },
    bio: '被强征上船的外科医生。蒂奇封锁查尔斯顿要的那箱药，正是为了他的药柜。',
  },
  // ===== 剧情 NPC / 宿敌 =====
  {
    id: 'eden', name: '查尔斯·伊登总督', nameEn: 'Gov. Charles Eden', role: 'npc',
    at: 'BATH',
    bio: '北卡罗来纳总督。他签发了蒂奇的赦免状，也有人说他分了赃——从没有人能证明。',
  },
  {
    id: 'rogers', name: '伍兹·罗杰斯总督', nameEn: 'Gov. Woodes Rogers', role: 'foe',
    at: 'NASSAU', chapter: 5,
    bio: '前私掠船长，1718 年带着国王的赦免状和几艘军舰来到拿骚，誓言"驱逐海盗，恢复商业"。他做到了——除非有人拦住他。',
  },
  {
    id: 'maynard', name: '罗伯特·梅纳德中尉', nameEn: 'Lt. Robert Maynard', role: 'foe',
    at: 'OCRACOKE', chapter: 7,
    bio: '弗吉尼亚总督斯波茨伍德派出的军官。他把水兵藏在舱底，让蒂奇误以为甲板上只剩几个人——这个陷阱要了黑胡子的命。',
  },
  {
    id: 'mary', name: '玛丽·奥蒙德', nameEn: 'Mary Ormond', role: 'npc',
    at: 'BATH', chapter: 6,
    bio: '巴斯镇种植园主的女儿。史载蒂奇曾与她成婚——那是他离"普通人的日子"最近的一次。',
  },
];

export const OFFICER_BY_ID = Object.fromEntries(OFFICERS.map(o => [o.id, o]));
