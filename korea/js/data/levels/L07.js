// 第 7 关 血红的汉江（1951.1.25–2.15，第四次战役：50军在汉江南岸顶住美军坦克、飞机、大炮五十天）
export const LEVEL = {
  turns: 12, startTime: 'day', weather: 'clear', air: 2, par: 850,
  intro: `1951 年 1 月底，美军发起反攻。曾泽生的 50 军在汉江南岸的白云山、帽落山一线摆开阵地，
    面对的是美军和英军的坦克、重炮和整天不断的飞机。<br><br>
    没有制空权，没有多少炮，靠的是工事、夜晚和一个连一个连地顶上去。汉江的水，那五十天里是红的。`,
  situation: `敌：美 25 师、英 27 旅，有坦克、榴弹炮和飞机，从南面一波一波进攻三处山头。<br>
    我：50 军 148 师守白云山，独立一师守中央和东侧。后面就是结冰的汉江，退无可退。`,
  goal: '坚守到第 12 回合结束，三处要点（白云山、帽落山、兄弟峰）至少保住一处。三处全部失守即告失败。',
  tips: ['白天进坑道式工事里挨炮、修工事；夜里出去反击、把丢掉的山头夺回来。', '卫生队贴着前线放，伤员治好了就能再上。', '坦克进不了高山——把阵地设在山上。'],
  note: '50 军是由原国民党第 60 军起义改编而来，汉江南岸阻击战打出了"白云山团"的番号。',
  map: [
    '~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~#~~~~~~~~~~~~',
    '.........v.=............',
    '...........=......ff....',
    '..hh.......=.....fff....',
    '.hhhh....hhh=....hhh....',
    '.hhMh...hhMhh=..hhhhh...',
    '..hhh...hhhh.=.hhMhh....',
    '...h.....hh..=..hhh.....',
    '.............=..........',
    '.....ff......=....ff....',
    '....fff......=...fff....',
    '.....f...v...=..........',
    '......====...=......v...',
    '.....=.......=======....',
    '.....=..............=...',
  ],
  objs: [
    { kind: 'flag', id: 'baiyun', name: '白云山', x: 3, y: 6, owner: 'p' },
    { kind: 'flag', id: 'maoluo', name: '帽落山', x: 10, y: 6, owner: 'p' },
    { kind: 'flag', id: 'xiongdi', name: '兄弟峰', x: 17, y: 7, owner: 'p' },
    { kind: 'depot', x: 9, y: 2, owner: 'p', name: '江边渡口补给点' },
    { kind: 'treasure', x: 20, y: 12, item: 'medkit', name: '老乡送来的药' },
  ],
  forts: [{ x: 3, y: 6, level: 2 }, { x: 10, y: 6, level: 2 }, { x: 17, y: 7, level: 2 }, { x: 2, y: 7, level: 1 }, { x: 4, y: 7, level: 1 }, { x: 9, y: 7, level: 1 }, { x: 11, y: 7, level: 1 }, { x: 16, y: 8, level: 1 }, { x: 18, y: 8, level: 1 }],
  deploy: [{ x0: 0, y0: 2, x1: 23, y1: 8 }],
  maxDeploy: 10, reserved: [],
  allies: [
    { id: 'a1', type: 'inf', name: '148师442团1营', x: 3, y: 6, level: 3 },
    { id: 'a2', type: 'inf', name: '148师442团2营', x: 2, y: 7, level: 3 },
    { id: 'a3', type: 'mg',  name: '148师机枪连', x: 4, y: 7, level: 2 },
  ],
  enemies: [
    { id: 'e1', type: 'us_inf', name: '美25师24团一部', x: 3, y: 15, stance: 'objective', target: 'baiyun' },
    { id: 'e2', type: 'us_inf', name: '美25师35团一部', x: 10, y: 15, stance: 'objective', target: 'maoluo' },
    { id: 'e3', type: 'uk_inf', name: '英27旅一部', x: 17, y: 15, stance: 'objective', target: 'xiongdi' },
    { id: 'e4', type: 'us_tank', name: '美89坦克营一部', x: 12, y: 14, stance: 'objective', target: 'maoluo' },
    { id: 'e5', type: 'us_art', name: '美军炮兵连', x: 6, y: 15, stance: 'hold' },
    { id: 'e6', type: 'us_art', name: '美军炮兵连', x: 15, y: 15, stance: 'hold' },
    { id: 'e7', type: 'us_mg', name: '美25师机枪连', x: 13, y: 15, stance: 'objective', target: 'maoluo' },
  ],
  win: { all: [{ type: 'turnLimit' }, { type: 'flagsOwnedGte', ids: ['baiyun', 'maoluo', 'xiongdi'], owner: 'p', n: 1 }] },
  lose: [{ type: 'flagsOwnedGte', ids: ['baiyun', 'maoluo', 'xiongdi'], owner: 'e', n: 3 }, { type: 'heroDead' }, { type: 'hqDead' }],
  events: [
    { id: 'start', when: { turn: 1, phase: 'p' }, do: [{ type: 'say', lines: [
      { who: 'zeng', text: '50 军没有退路，汉江就在背后。白天他们炮打飞机炸，我们躲在工事里；晚上，山头是我们的。' },
      { who: 'player', text: '各连白天不要在开阔地上动，进工事。卫生队跟上一线，伤员治好了再上。' },
    ] }] },
    { id: 'wave2', when: { turn: 4, phase: 'e' }, do: [
      { type: 'spawn', units: [
        { id: 'e8', type: 'us_inf', name: '美25师27团一部', x: 8, y: 15, stance: 'objective', target: 'maoluo' },
        { id: 'e9', type: 'us_sherman', name: '美军坦克排', x: 19, y: 15, stance: 'objective', target: 'xiongdi' },
        { id: 'e10', type: 'uk_inf', name: '英27旅一部', x: 21, y: 14, stance: 'objective', target: 'xiongdi' },
      ] },
    ] },
    { id: 'wave3', when: { turn: 8, phase: 'e' }, do: [
      { type: 'spawn', units: [
        { id: 'e11', type: 'us_inf', name: '美3师一部', x: 5, y: 15, stance: 'objective', target: 'baiyun' },
        { id: 'e12', type: 'us_inf', name: '美3师一部', x: 11, y: 15, stance: 'objective', target: 'maoluo' },
        { id: 'e13', type: 'us_tank', name: '美军坦克排', x: 2, y: 15, stance: 'objective', target: 'baiyun' },
      ] },
      { type: 'say', lines: [{ who: 'zeng', text: '白云山团打得好！再顶四个回合，后续部队就上来换防了。' }] },
    ] },
  ],
};
