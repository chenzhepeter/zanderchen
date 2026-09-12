// 第 9 关 上甘岭（1952.10.14–11.25，15军、12军在597.9和537.7高地反复争夺43天；坑道战；黄继光）
export const LEVEL = {
  turns: 15, startTime: 'day', weather: 'clear', air: 3, par: 1000,
  intro: `1952 年 10 月 14 日凌晨，美军三百多门大炮对着五圣山前两个不到四平方公里的小山头开火。
    上甘岭战役开始了。<br><br>
    白天，表面阵地在炮火里一遍遍换手；夜里，志愿军从坑道里钻出来，把山头再夺回来。
    43 天，597.9 和 537.7 高地上打出了一个新词：坑道战。`,
  situation: `敌：美 7 师、南朝鲜军第 2 师，每个白天都会发起新的攻击波，炮兵和飞机的火力是我们的几十倍。<br>
    我：15 军 45 师守两个高地。高地北坡各有一条坑道——白天进坑道躲炮击和空袭，夜里出坑道反击。坑道被敌人占领即告失败。第 8 回合 12 军会来换防。`,
  goal: '坚守到第 15 回合结束，两个高地的表面阵地至少保住一处，且两条坑道都不能被敌人占领。',
  tips: ['白天：部队走进坑道格用策略"坑道"躲起来，炮打不到、飞机炸不着。', '夜里出坑道，把丢了的山头夺回来。', '高射机枪连能把 2 格内的空袭赶跑一半。'],
  note: '上甘岭战役是抗美援朝阵地防御战的标志性战役，黄继光在 597.9 高地用身体堵住了敌人的机枪射孔。',
  map: [
    '........................',
    '...ff............ff.....',
    '..fff......v.....fff....',
    '.......=======..........',
    '....hh.=.....=..hhh.....',
    '...hhh.=.....=.hhhhh....',
    '...hhhh=.....=hhhhhh....',
    '..hhMhh......hhhMhhh....',
    '..hhhhh......hhhhhhh....',
    '...hhh........hhhhh.....',
    '....h..........hh.......',
    '........................',
    '.....ff.........ff......',
    '....fff........fff......',
    '.....=........=....v....',
    '.....=........=.........',
  ],
  objs: [
    { kind: 'flag', id: 'f1', name: '597.9高地', x: 4, y: 7, owner: 'p' },
    { kind: 'flag', id: 'f2', name: '537.7高地', x: 16, y: 7, owner: 'p' },
    { kind: 'tunnel', id: 'tun1', name: '597.9坑道', x: 4, y: 5, owner: 'p' },
    { kind: 'tunnel', id: 'tun2', name: '537.7坑道', x: 17, y: 5, owner: 'p' },
    { kind: 'depot', x: 11, y: 2, owner: 'p', name: '后方补给点' },
    { kind: 'treasure', x: 19, y: 14, item: 'ammobox', name: '敌军弹药' },
  ],
  forts: [{ x: 4, y: 7, level: 3 }, { x: 16, y: 7, level: 3 }, { x: 3, y: 8, level: 2 }, { x: 5, y: 8, level: 2 }, { x: 15, y: 8, level: 2 }, { x: 17, y: 8, level: 2 }, { x: 4, y: 5, level: 3 }, { x: 17, y: 5, level: 3 }],
  deploy: [{ x0: 0, y0: 2, x1: 23, y1: 9 }],
  maxDeploy: 10, reserved: [],
  allies: [
    { id: 'a1', type: 'inf', name: '45师135团1营', x: 4, y: 7, level: 3 },
    { id: 'a2', type: 'inf', name: '45师135团2营', x: 16, y: 7, level: 3 },
    { id: 'a3', type: 'mg',  name: '45师机枪连', x: 3, y: 8, level: 3 },
    { id: 'a4', type: 'med', name: '45师卫生队', x: 5, y: 5, level: 2 },
    { id: 'a5', type: 'aa',  name: '15军高射机枪连', x: 10, y: 5, level: 2 },
  ],
  enemies: [
    { id: 'e1', type: 'us_inf', name: '美7师31团一部', x: 4, y: 15, stance: 'objective', target: 'f1' },
    { id: 'e2', type: 'us_inf', name: '美7师31团一部', x: 6, y: 15, stance: 'objective', target: 'f1' },
    { id: 'e3', type: 'rok_inf', name: '韩2师32团一部', x: 15, y: 15, stance: 'objective', target: 'f2' },
    { id: 'e4', type: 'rok_inf', name: '韩2师32团一部', x: 18, y: 15, stance: 'objective', target: 'f2' },
    { id: 'e5', type: 'us_art', name: '美军炮兵连', x: 9, y: 15, stance: 'hold' },
    { id: 'e6', type: 'us_art', name: '美军炮兵连', x: 12, y: 15, stance: 'hold' },
    { id: 'e7', type: 'us_art', name: '美军炮兵连', x: 21, y: 15, stance: 'hold' },
  ],
  win: { all: [{ type: 'turnLimit' }, { type: 'flagsOwnedGte', ids: ['f1', 'f2'], owner: 'p', n: 1 }, { type: 'objOwner', id: 'tun1', owner: 'p' }, { type: 'objOwner', id: 'tun2', owner: 'p' }] },
  lose: [{ type: 'objOwner', id: 'tun1', owner: 'e' }, { type: 'objOwner', id: 'tun2', owner: 'e' }, { type: 'heroDead' }, { type: 'hqDead' }],
  events: [
    { id: 'start', when: { turn: 1, phase: 'p' }, do: [{ type: 'say', lines: [
      { who: 'qin', text: '上甘岭打的是意志。白天他们的炮把山头削掉一层，我们就在坑道里等；天一黑，山头还是我们的。' },
      { who: 'player', text: '各部队记住：白天进坑道，夜里出坑道。坑道口一定要留人守住。' },
    ] }] },
    { id: 'wave2', when: { turn: 5, phase: 'e' }, do: [
      { type: 'spawn', units: [
        { id: 'e8', type: 'us_inf', name: '美7师17团一部', x: 3, y: 15, stance: 'objective', target: 'f1' },
        { id: 'e9', type: 'us_mg', name: '美7师机枪连', x: 7, y: 15, stance: 'objective', target: 'f1' },
        { id: 'e10', type: 'rok_inf', name: '韩2师17团一部', x: 17, y: 15, stance: 'objective', target: 'f2' },
        { id: 'e11', type: 'us_sherman', name: '美军坦克排', x: 14, y: 14, stance: 'objective', target: 'f2' },
      ] },
    ] },
    { id: 'relief', when: { turn: 8, phase: 'p' }, do: [
      { type: 'spawn', units: [
        { id: 'a6', type: 'inf', name: '12军31师91团1营', x: 8, y: 0, level: 4, side: 'p' },
        { id: 'a7', type: 'inf', name: '12军31师91团2营', x: 14, y: 0, level: 4, side: 'p' },
      ] },
      { type: 'say', lines: [{ who: 'qin', text: '12 军上来了！换下打残的部队，夜里把两个山头都拿回来。' }] },
    ] },
    { id: 'wave3', when: { turn: 9, phase: 'e' }, do: [
      { type: 'spawn', units: [
        { id: 'e12', type: 'us_inf', name: '美7师32团一部', x: 5, y: 15, stance: 'objective', target: 'f1' },
        { id: 'e13', type: 'rok_inf', name: '韩2师31团一部', x: 16, y: 15, stance: 'objective', target: 'f2' },
        { id: 'e14', type: 'rok_inf', name: '韩2师31团一部', x: 19, y: 15, stance: 'objective', target: 'f2' },
      ] },
    ] },
    { id: 'huang', when: { objRecaptured: 'f1' }, do: [{ type: 'say', lines: [
      { who: 'narrator', text: '10 月 19 日夜，反击 597.9 高地时，通信员黄继光在弹药打光后扑向敌人的机枪火力点，用身体堵住了射孔。' },
      { who: 'huang', text: '让我去。' },
    ] }] },
    { id: 'wave4', when: { turn: 13, phase: 'e' }, do: [
      { type: 'spawn', units: [
        { id: 'e15', type: 'us_inf', name: '美7师一部', x: 4, y: 15, stance: 'objective', target: 'f1' },
        { id: 'e16', type: 'rok_inf', name: '韩2师一部', x: 17, y: 15, stance: 'objective', target: 'f2' },
      ] },
      { type: 'say', lines: [{ who: 'zhengwei', text: '最后一波了。守住坑道，天亮以后这一仗就结束了。' }] },
    ] },
  ],
};
