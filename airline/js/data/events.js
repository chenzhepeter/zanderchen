// 18 个历史事件，按 triggerYear+triggerQuarter 触发
// effects: 数组，类型见 sim.js applyEventEffects
//   - { kind: 'demand', scope: 'global'|'region:asia'|'country:US'|'cityPair:[A,B]', mult, durationQuarters }
//   - { kind: 'fuel', mult, durationQuarters }
//   - { kind: 'fleetGround', modelIds: [...], durationQuarters }
//   - { kind: 'unlock', modelId }
//   - { kind: 'cost', scope: 'global', addPerSeat, durationQuarters }   // 安保 / 保险持续成本
//   - { kind: 'prestige', delta, target: 'all'|'random' }
//   - { kind: 'fuelDistance', regions: [...], mult, durationQuarters }  // 绕飞，影响某区域的距离系数
// choice: { prompt, options: [{ label, costCash?, applyEffects?: [...], note? }] }

export const EVENTS = [
  {
    id: 'ev_911',
    triggerYear: 2001, triggerQuarter: 3,
    nameZh: '9/11 恐怖袭击',
    descZh: '美国本土遭受劫机袭击，全球航空业陷入信任危机，乘客大幅减少。',
    effects: [
      { kind: 'demand', scope: 'global', mult: 0.70, durationQuarters: 4 },
      { kind: 'demand', scope: 'country:US', mult: 0.50, durationQuarters: 4 },
      { kind: 'cost', scope: 'global', addPerSeat: 8, durationQuarters: 999 },
    ],
    choice: {
      prompt: '是否额外投入 5 亿美元加强机队安保？',
      options: [
        { label: '投入 5 亿（声望 +5，安保事故概率降低）', costCash: 500, applyEffects: [{ kind: 'prestige', delta: 5, target: 'self' }] },
        { label: '不投入', applyEffects: [] },
      ]
    },
  },
  {
    id: 'ev_sars',
    triggerYear: 2003, triggerQuarter: 1,
    nameZh: 'SARS 暴发',
    descZh: '非典在中港台扩散，亚洲航线骤减。',
    effects: [
      { kind: 'demand', scope: 'region:asia', mult: 0.55, durationQuarters: 2 },
    ],
  },
  {
    id: 'ev_iraq',
    triggerYear: 2003, triggerQuarter: 2,
    nameZh: '伊拉克战争',
    descZh: '中东局势紧张，国际油价飙涨。',
    effects: [
      { kind: 'fuel', mult: 1.30, durationQuarters: 8 },
    ],
  },
  {
    id: 'ev_a380',
    triggerYear: 2008, triggerQuarter: 1,
    nameZh: '空客 A380 进入商业运营',
    descZh: '世界上最大的客机投入运营，开启巨型客机时代。',
    effects: [
      { kind: 'unlock', modelId: 'A380' },
    ],
  },
  {
    id: 'ev_gfc',
    triggerYear: 2008, triggerQuarter: 3,
    nameZh: '全球金融危机',
    descZh: '雷曼兄弟倒闭，全球商务旅行萎缩。',
    effects: [
      { kind: 'demand', scope: 'global', mult: 0.80, durationQuarters: 4 },
    ],
  },
  {
    id: 'ev_volcano',
    triggerYear: 2010, triggerQuarter: 2,
    nameZh: '冰岛火山喷发',
    descZh: '埃亚菲亚德拉冰川火山喷发，欧洲领空大面积关闭。',
    effects: [
      { kind: 'demand', scope: 'region:europe', mult: 0.20, durationQuarters: 1 },
    ],
  },
  {
    id: 'ev_japan_311',
    triggerYear: 2011, triggerQuarter: 1,
    nameZh: '日本东北 3·11 地震',
    descZh: '9.0 级大地震引发海啸与福岛核事故，日本航线受重创。',
    effects: [
      { kind: 'demand', scope: 'country:JP', mult: 0.50, durationQuarters: 2 },
    ],
  },
  {
    id: 'ev_787',
    triggerYear: 2011, triggerQuarter: 4,
    nameZh: '波音 787 投入运营',
    descZh: '梦想客机以复合材料和高燃油效率引领新一代远程双发。',
    effects: [
      { kind: 'unlock', modelId: '787' },
    ],
  },
  {
    id: 'ev_787_ground',
    triggerYear: 2013, triggerQuarter: 1,
    nameZh: '波音 787 电池故障停飞',
    descZh: 'FAA 下令全球停飞 787 调查锂电池故障。',
    effects: [
      { kind: 'fleetGround', modelIds: ['787'], durationQuarters: 1 },
    ],
  },
  {
    id: 'ev_mh370',
    triggerYear: 2014, triggerQuarter: 1,
    nameZh: 'MH370 失联与 MH17 击落',
    descZh: '本年度连续发生两起重大马航事件，业界哗然。',
    effects: [
      { kind: 'prestige', delta: -10, target: 'random' },
    ],
  },
  {
    id: 'ev_oil_crash',
    triggerYear: 2014, triggerQuarter: 3,
    nameZh: '国际油价崩盘',
    descZh: '页岩油革命与 OPEC 增产导致油价腰斩。',
    effects: [
      { kind: 'fuel', mult: 0.50, durationQuarters: 8 },
    ],
  },
  {
    id: 'ev_max',
    triggerYear: 2019, triggerQuarter: 1,
    nameZh: '波音 737 MAX 全球停飞',
    descZh: '埃航与狮航连续两起空难，737 MAX 被全球停飞调查。',
    effects: [
      { kind: 'fleetGround', modelIds: ['737MAX'], durationQuarters: 6 },
    ],
  },
  {
    id: 'ev_covid',
    triggerYear: 2020, triggerQuarter: 1,
    nameZh: '新冠肺炎全球大流行',
    descZh: '边境关闭、隔离政策、商旅停摆，民航迎来史无前例的危机。',
    effects: [
      { kind: 'demand', scope: 'global', mult: 0.25, durationQuarters: 2 },
      { kind: 'demand', scope: 'global', mult: 0.45, durationQuarters: 2, startOffset: 2 },
      { kind: 'demand', scope: 'global', mult: 0.65, durationQuarters: 2, startOffset: 4 },
      { kind: 'demand', scope: 'global', mult: 0.85, durationQuarters: 2, startOffset: 6 },
    ],
    choice: {
      prompt: '政府提供低息救助贷款 — 是否申请？',
      options: [
        { label: '申请 20 亿低息贷款（增加债务，但避免破产）', applyEffects: [{ kind: 'cashGrant', amount: 2000, debtAdd: 2000 }] },
        { label: '婉拒，自力更生（声望 +10）', applyEffects: [{ kind: 'prestige', delta: 10, target: 'self' }] },
      ]
    },
  },
  {
    id: 'ev_ukraine',
    triggerYear: 2022, triggerQuarter: 1,
    nameZh: '俄乌冲突',
    descZh: '俄罗斯领空对多数航司关闭，欧亚航线需绕飞，燃油消耗大增；俄罗斯航线急剧萎缩。',
    effects: [
      { kind: 'fuel', mult: 1.40, durationQuarters: 6 },
      { kind: 'fuelDistance', regions: ['europe','asia'], mult: 1.20, durationQuarters: 999 },
      { kind: 'demand', scope: 'country:RU', mult: 0.40, durationQuarters: 12 },
    ],
  },
  {
    id: 'ev_redsea',
    triggerYear: 2023, triggerQuarter: 4,
    nameZh: '红海危机',
    descZh: '胡塞武装袭击商船与航班，中东航线乘客信心受挫。',
    effects: [
      { kind: 'demand', scope: 'region:mideast', mult: 0.80, durationQuarters: 4 },
    ],
  },
  {
    id: 'ev_c919',
    triggerYear: 2023, triggerQuarter: 2,
    nameZh: '商飞 C919 投入运营',
    descZh: '中国自主研发的窄体客机进入商业运营。',
    effects: [
      { kind: 'unlock', modelId: 'C919' },
    ],
  },
  {
    id: 'ev_es19',
    triggerYear: 2026, triggerQuarter: 1,
    nameZh: '电动支线机 ES-19 服役',
    descZh: 'Heart Aerospace 19 座纯电动飞机投入运营，开启零碳支线时代。',
    effects: [
      { kind: 'unlock', modelId: 'ES19' },
    ],
  },
  {
    id: 'ev_saf',
    triggerYear: 2027, triggerQuarter: 1,
    nameZh: '可持续航空燃料强制法规',
    descZh: '欧美强制掺混 SAF，燃油成本上升。',
    effects: [
      { kind: 'fuel', mult: 1.15, durationQuarters: 999 },
    ],
    choice: {
      prompt: '是否申请"绿色舰队认证"？',
      options: [
        { label: '申请（一次性 8 亿，永久声望 +1/季）', costCash: 800, applyEffects: [{ kind: 'prestigePerQuarter', delta: 1 }] },
        { label: '暂不申请', applyEffects: [] },
      ]
    },
  },
  {
    id: 'ev_overture',
    triggerYear: 2029, triggerQuarter: 1,
    nameZh: 'Boom Overture 超音速服役',
    descZh: '超音速客机时隔 26 年再度商业运营，开启豪华长程市场。',
    effects: [
      { kind: 'unlock', modelId: 'OVTR' },
    ],
  },
];
