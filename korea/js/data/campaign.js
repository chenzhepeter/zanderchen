// 战役目录：10 关（志愿军经典战役，按时间顺序）。每关的地图/兵力/事件在 levels/Lxx.js 里，按需 import。
// 章节描述格式照搬 odyssey/js/data/chapters.js 的 { num, title, script, goal, intro, note }。
export const LEVELS = [
  { num: 1,  key: 'L01', title: '两水洞 · 旗开得胜', date: '1950年10月25日', place: '平安北道 温井—北镇公路' },
  { num: 2,  key: 'L02', title: '云山大捷',           date: '1950年11月1日',  place: '平安北道 云山' },
  { num: 3,  key: 'L03', title: '血战飞虎山',         date: '1950年11月4日',  place: '平安南道 飞虎山' },
  { num: 4,  key: 'L04', title: '三所里 · 松骨峰',    date: '1950年11月28日', place: '价川以南 三所里·龙源里' },
  { num: 5,  key: 'L05', title: '长津湖',             date: '1950年11月27日', place: '咸镜南道 长津湖 新兴里·小高岭' },
  { num: 6,  key: 'L06', title: '突破临津江 · 解放汉城', date: '1950年12月31日', place: '临津江南岸' },
  { num: 7,  key: 'L07', title: '血红的汉江',         date: '1951年1月25日',  place: '汉江南岸 白云山' },
  { num: 8,  key: 'L08', title: '铁原阻击',           date: '1951年5月30日',  place: '铁原 涟川 一线' },
  { num: 9,  key: 'L09', title: '上甘岭',             date: '1952年10月14日', place: '金化 五圣山 597.9·537.7 高地' },
  { num: 10, key: 'L10', title: '金城战役',           date: '1953年7月13日',  place: '金城以南 白虎团阵地' },
];
export const LEVEL_BY_NUM = Object.fromEntries(LEVELS.map(l => [l.num, l]));
export const LAST_LEVEL = 10;

export async function loadLevel(num) {
  const meta = LEVEL_BY_NUM[num];
  if (!meta) return null;
  const mod = await import(`./levels/${meta.key}.js`);
  return { ...meta, ...mod.LEVEL };
}

// 独立一师初始花名册（原版：主角兵种四选一 + 骑兵成天舒/傅国梓 + 特种兵岳纫/杜乐辉）
export function initialRoster(heroType, heroName) {
  const mk = (id, type, name, extra = {}) => ({ id, type, name, level: 1, xp: 0, ...extra });
  return [
    mk('hero', heroType, heroName, { hero: true, level: 2, xp: 50, tactics: ['decoy'] }),
    mk('hq', 'hq', '独立一师师部'),
    mk('cheng', 'cav', '成天舒·骑兵连', { named: 'cheng', tactics: ['decoy'] }),
    mk('fu', 'cav', '傅国梓·骑兵连', { named: 'fu', tactics: ['decoy'] }),
    mk('yue', 'spec', '岳纫·特种兵连', { named: 'yue', tactics: ['decoy'] }),
    mk('du', 'spec', '杜乐辉·特种兵连', { named: 'du', tactics: ['decoy'] }),
    mk('inf1', 'inf', '一团一营'),
    mk('inf2', 'inf', '一团二营'),
    mk('mg1', 'mg', '师机枪连'),
    mk('art1', 'art', '师炮兵连'),
    mk('eng1', 'eng', '师工兵连'),
    mk('med1', 'med', '师卫生队'),
    mk('sup1', 'sup', '师运输队'),
  ];
}
