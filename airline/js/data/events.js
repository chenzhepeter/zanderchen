// 45 个历史事件，跨 2000–2029，平均每 ~3 季度一次
// 触发条件: triggerYear + triggerQuarter
// effects: 见 sim.js 的 applyEventEffects
//   - { kind: 'demand', scope: 'global'|'region:asia'|'country:US'|'cityPair:[A,B]', mult, durationQuarters, startOffset? }
//   - { kind: 'fuel', mult, durationQuarters }
//   - { kind: 'fleetGround', modelIds: [...], durationQuarters }
//   - { kind: 'unlock', modelId }
//   - { kind: 'cost', scope: 'global', addPerSeat, durationQuarters }
//   - { kind: 'prestige', delta, target: 'all'|'random'|'self' }
//   - { kind: 'fuelDistance', regions: [...], mult, durationQuarters }
// choice: 见 sim.js 的 applyChoiceOption

export const EVENTS = [
  // ============== 2000 ==============
  {
    id: 'ev_concorde_crash',
    triggerYear: 2000, triggerQuarter: 3,
    nameZh: '协和号空难',
    descZh: '法航 AF4590 协和客机起飞失事，超音速时代蒙阴影。',
    effects: [
      { kind: 'prestige', delta: -3, target: 'all' },
    ],
  },

  // ============== 2001 ==============
  {
    id: 'ev_911',
    triggerYear: 2001, triggerQuarter: 3,
    nameZh: '9/11 恐怖袭击',
    descZh: '美国本土遭劫机袭击，全球航空业陷入信任危机，乘客大幅减少。',
    effects: [
      { kind: 'demand', scope: 'global', mult: 0.70, durationQuarters: 4 },
      { kind: 'demand', scope: 'country:US', mult: 0.50, durationQuarters: 4 },
      { kind: 'cost', scope: 'global', addPerSeat: 8, durationQuarters: 999 },
    ],
    choice: {
      prompt: '是否额外投入 5 亿美元加强机队安保？',
      options: [
        { label: '投入 5 亿（声望 +5）', costCash: 500, applyEffects: [{ kind: 'prestige', delta: 5, target: 'self' }] },
        { label: '不投入', applyEffects: [] },
      ],
    },
  },

  // ============== 2002 ==============
  {
    id: 'ev_alliance_2002',
    triggerYear: 2002, triggerQuarter: 3,
    nameZh: '航空联盟整合潮',
    descZh: 'Star Alliance 与 SkyTeam 扩张，中型航司开始抱团取暖。',
    effects: [
      { kind: 'prestige', delta: 2, target: 'all' },
    ],
  },

  // ============== 2003 ==============
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
    id: 'ev_concorde_retire',
    triggerYear: 2003, triggerQuarter: 4,
    nameZh: '协和号退役',
    descZh: '英航与法航协和客机商业运营终结，超音速暂别民航。',
    effects: [],
  },

  // ============== 2005 ==============
  {
    id: 'ev_katrina',
    triggerYear: 2005, triggerQuarter: 3,
    nameZh: '飓风卡特里娜',
    descZh: '5 级飓风重创美国南部，新奥尔良瘫痪，美国航线短期受挫。',
    effects: [
      { kind: 'demand', scope: 'country:US', mult: 0.80, durationQuarters: 1 },
    ],
  },

  // ============== 2006 ==============
  {
    id: 'ev_liquid_bomb',
    triggerYear: 2006, triggerQuarter: 3,
    nameZh: '伦敦液体炸弹案',
    descZh: '跨大西洋航班液体炸弹阴谋被破获，全球开始严格液体安检。',
    effects: [
      { kind: 'demand', scope: 'region:europe', mult: 0.90, durationQuarters: 2 },
      { kind: 'cost', scope: 'global', addPerSeat: 2, durationQuarters: 999 },
    ],
  },

  // ============== 2007 ==============
  {
    id: 'ev_subprime',
    triggerYear: 2007, triggerQuarter: 3,
    nameZh: '次贷危机征兆',
    descZh: '美国房贷市场出现裂痕，金融业开始动荡，商务旅行预算缩水。',
    effects: [
      { kind: 'demand', scope: 'country:US', mult: 0.92, durationQuarters: 3 },
    ],
  },

  // ============== 2008 ==============
  {
    id: 'ev_a380',
    triggerYear: 2008, triggerQuarter: 1,
    nameZh: '空客 A380 进入商业运营',
    descZh: '世界上最大的客机开始服役，开启巨型客机时代。',
    effects: [
      { kind: 'unlock', modelId: 'A380' },
    ],
  },
  {
    id: 'ev_oil_147',
    triggerYear: 2008, triggerQuarter: 2,
    nameZh: '油价飙至历史高位',
    descZh: '布伦特原油创下 $147/桶 历史纪录，航司燃油成本暴涨。',
    effects: [
      { kind: 'fuel', mult: 1.50, durationQuarters: 3 },
    ],
    choice: {
      prompt: '是否签订高位燃油对冲合约？',
      options: [
        { label: '签订（锁定 3 季高价，但避开后续波动）', applyEffects: [] },
        { label: '不签，赌油价下行（推荐）', applyEffects: [] },
      ],
    },
  },
  {
    id: 'ev_beijing_olympics',
    triggerYear: 2008, triggerQuarter: 3,
    nameZh: '北京奥运会',
    descZh: '北京举办夏季奥运会，亚洲旅客激增。',
    effects: [
      { kind: 'demand', scope: 'country:CN', mult: 1.35, durationQuarters: 1 },
    ],
  },
  {
    id: 'ev_gfc',
    triggerYear: 2008, triggerQuarter: 4,
    nameZh: '雷曼倒闭 · 全球金融危机',
    descZh: '雷曼兄弟破产引爆系统性危机，全球商务旅行萎缩。',
    effects: [
      { kind: 'demand', scope: 'global', mult: 0.78, durationQuarters: 4 },
    ],
  },

  // ============== 2009 ==============
  {
    id: 'ev_af447',
    triggerYear: 2009, triggerQuarter: 2,
    nameZh: '法航 AF447 失事',
    descZh: '里约-巴黎航班坠入大西洋，气象与皮托管故障调查震动业界。',
    effects: [
      { kind: 'prestige', delta: -8, target: 'random' },
    ],
  },
  {
    id: 'ev_h1n1',
    triggerYear: 2009, triggerQuarter: 3,
    nameZh: '甲型 H1N1 流感',
    descZh: '猪流感在全球蔓延，跨境旅行受限。',
    effects: [
      { kind: 'demand', scope: 'global', mult: 0.88, durationQuarters: 2 },
    ],
  },

  // ============== 2010 ==============
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
    id: 'ev_us_merger',
    triggerYear: 2010, triggerQuarter: 3,
    nameZh: '美国航司并购潮',
    descZh: '美联航与大陆航空合并，达美吞下西北，美国天空格局重塑。',
    effects: [
      { kind: 'demand', scope: 'country:US', mult: 1.05, durationQuarters: 4 },
    ],
  },

  // ============== 2011 ==============
  {
    id: 'ev_arab_spring',
    triggerYear: 2011, triggerQuarter: 1,
    nameZh: '阿拉伯之春',
    descZh: '突尼斯、埃及、利比亚相继爆发抗议，中东与北非旅行受冲击。',
    effects: [
      { kind: 'demand', scope: 'region:mideast', mult: 0.75, durationQuarters: 3 },
      { kind: 'demand', scope: 'country:EG', mult: 0.50, durationQuarters: 4 },
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

  // ============== 2012 ==============
  {
    id: 'ev_london_olympics',
    triggerYear: 2012, triggerQuarter: 3,
    nameZh: '伦敦奥运会',
    descZh: '伦敦举办夏季奥运会，欧洲枢纽客流爆棚。',
    effects: [
      { kind: 'demand', scope: 'country:GB', mult: 1.40, durationQuarters: 1 },
    ],
  },
  {
    id: 'ev_sandy',
    triggerYear: 2012, triggerQuarter: 4,
    nameZh: '飓风 Sandy 重创纽约',
    descZh: 'JFK 与 EWR 关闭多日，东海岸航班大面积取消。',
    effects: [
      { kind: 'demand', scope: 'country:US', mult: 0.85, durationQuarters: 1 },
    ],
  },

  // ============== 2013 ==============
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
    id: 'ev_haiyan',
    triggerYear: 2013, triggerQuarter: 4,
    nameZh: '超强台风海燕',
    descZh: '海燕横扫菲律宾，造成严重伤亡，东南亚航线短期受挫。',
    effects: [
      { kind: 'demand', scope: 'country:TH', mult: 0.85, durationQuarters: 1 },
    ],
  },

  // ============== 2014 ==============
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
    id: 'ev_brazil_wc',
    triggerYear: 2014, triggerQuarter: 2,
    nameZh: '巴西世界杯',
    descZh: '世界杯吸引全球球迷涌入南美，圣保罗航线供不应求。',
    effects: [
      { kind: 'demand', scope: 'country:BR', mult: 1.45, durationQuarters: 1 },
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

  // ============== 2015 ==============
  {
    id: 'ev_germanwings',
    triggerYear: 2015, triggerQuarter: 1,
    nameZh: '德国之翼 9525 坠机',
    descZh: '副驾驶蓄意撞山，欧洲航司启动驾驶舱双人值守新规。',
    effects: [
      { kind: 'prestige', delta: -5, target: 'random' },
      { kind: 'cost', scope: 'region:europe', addPerSeat: 1, durationQuarters: 999 },
    ],
  },

  // ============== 2016 ==============
  {
    id: 'ev_brussels',
    triggerYear: 2016, triggerQuarter: 1,
    nameZh: '布鲁塞尔机场袭击',
    descZh: '欧洲心脏地带遭恐袭，欧洲航线信心受挫。',
    effects: [
      { kind: 'demand', scope: 'region:europe', mult: 0.85, durationQuarters: 2 },
    ],
  },
  {
    id: 'ev_rio_olympics',
    triggerYear: 2016, triggerQuarter: 3,
    nameZh: '里约奥运会',
    descZh: '南美首次办奥运，巴西旅游业短暂繁荣。',
    effects: [
      { kind: 'demand', scope: 'country:BR', mult: 1.35, durationQuarters: 1 },
    ],
  },

  // ============== 2017 ==============
  {
    id: 'ev_qatar_blockade',
    triggerYear: 2017, triggerQuarter: 2,
    nameZh: '卡塔尔外交断交危机',
    descZh: '沙特等四国与卡塔尔断交，海湾上空开放但飞行需绕飞。',
    effects: [
      { kind: 'fuel', mult: 1.10, durationQuarters: 4 },
      { kind: 'demand', scope: 'region:mideast', mult: 0.92, durationQuarters: 4 },
    ],
  },
  {
    id: 'ev_irma_maria',
    triggerYear: 2017, triggerQuarter: 3,
    nameZh: '飓风 Irma 与 Maria',
    descZh: '加勒比连环飓风重创北美东海岸与中美洲。',
    effects: [
      { kind: 'demand', scope: 'country:US', mult: 0.90, durationQuarters: 1 },
      { kind: 'demand', scope: 'country:MX', mult: 0.85, durationQuarters: 1 },
    ],
  },

  // ============== 2018 ==============
  {
    id: 'ev_russia_wc',
    triggerYear: 2018, triggerQuarter: 2,
    nameZh: '俄罗斯世界杯',
    descZh: '俄罗斯举办世界杯，莫斯科航线短期火爆。',
    effects: [
      { kind: 'demand', scope: 'country:RU', mult: 1.40, durationQuarters: 1 },
    ],
  },
  {
    id: 'ev_brexit_deadline',
    triggerYear: 2018, triggerQuarter: 4,
    nameZh: '英国脱欧公投阴霾',
    descZh: '脱欧过渡条款迟迟未定，伦敦欧洲枢纽地位不稳。',
    effects: [
      { kind: 'demand', scope: 'country:GB', mult: 0.92, durationQuarters: 4 },
    ],
  },

  // ============== 2019 ==============
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
    id: 'ev_hk_protests',
    triggerYear: 2019, triggerQuarter: 3,
    nameZh: '香港社会运动',
    descZh: '长达数月的抗议导致 HKG 航班大量取消，游客锐减。',
    effects: [
      { kind: 'demand', scope: 'country:HK', mult: 0.55, durationQuarters: 3 },
    ],
  },

  // ============== 2020 ==============
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
      prompt: '政府提供一次性救助补贴 — 是否申请？',
      options: [
        { label: '申请 $1000M 救助补贴（避免破产）', applyEffects: [{ kind: 'cashGrant', amount: 1000 }] },
        { label: '婉拒，自力更生（声望 +10）', applyEffects: [{ kind: 'prestige', delta: 10, target: 'self' }] },
      ],
    },
  },

  // ============== 2021 ==============
  {
    id: 'ev_vaccine',
    triggerYear: 2021, triggerQuarter: 2,
    nameZh: '疫苗推广 · 复苏曙光',
    descZh: '主要国家疫苗接种推进，国际旅行限制逐步放宽。',
    effects: [
      { kind: 'demand', scope: 'global', mult: 1.15, durationQuarters: 4 },
    ],
  },

  // ============== 2022 ==============
  {
    id: 'ev_ukraine',
    triggerYear: 2022, triggerQuarter: 1,
    nameZh: '俄乌冲突',
    descZh: '俄罗斯领空对多数航司关闭，欧亚航线需绕飞；俄罗斯航线急剧萎缩。',
    effects: [
      { kind: 'fuel', mult: 1.40, durationQuarters: 6 },
      { kind: 'fuelDistance', regions: ['europe', 'asia'], mult: 1.20, durationQuarters: 999 },
      { kind: 'demand', scope: 'country:RU', mult: 0.40, durationQuarters: 12 },
    ],
  },
  {
    id: 'ev_qatar_wc',
    triggerYear: 2022, triggerQuarter: 4,
    nameZh: '卡塔尔世界杯',
    descZh: '中东首次举办世界杯，迪拜中转客流爆发。',
    effects: [
      { kind: 'demand', scope: 'region:mideast', mult: 1.35, durationQuarters: 1 },
    ],
  },

  // ============== 2023 ==============
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
    id: 'ev_redsea',
    triggerYear: 2023, triggerQuarter: 4,
    nameZh: '红海危机',
    descZh: '胡塞武装袭击商船与航班，中东航线乘客信心受挫。',
    effects: [
      { kind: 'demand', scope: 'region:mideast', mult: 0.80, durationQuarters: 4 },
    ],
  },

  // ============== 2024 ==============
  {
    id: 'ev_max9_door',
    triggerYear: 2024, triggerQuarter: 1,
    nameZh: '波音 737 MAX 9 舱门脱落',
    descZh: '阿拉斯加航空空中失压，FAA 暂停 MAX 9 一个月。',
    effects: [
      { kind: 'fleetGround', modelIds: ['737MAX'], durationQuarters: 1 },
      { kind: 'prestige', delta: -3, target: 'all' },
    ],
  },
  {
    id: 'ev_paris_olympics',
    triggerYear: 2024, triggerQuarter: 3,
    nameZh: '巴黎奥运会',
    descZh: '巴黎举办奥运，欧洲航线全面火爆。',
    effects: [
      { kind: 'demand', scope: 'country:FR', mult: 1.45, durationQuarters: 1 },
      { kind: 'demand', scope: 'region:europe', mult: 1.15, durationQuarters: 1 },
    ],
  },

  // ============== 2025 ==============
  {
    id: 'ev_aerocyber',
    triggerYear: 2025, triggerQuarter: 2,
    nameZh: '全球航司网络攻击',
    descZh: '多家航司订座系统遭勒索软件攻击，IT 安全投入飙升。',
    effects: [
      { kind: 'cost', scope: 'global', addPerSeat: 3, durationQuarters: 999 },
      { kind: 'prestige', delta: -2, target: 'all' },
    ],
  },

];
