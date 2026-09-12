// 第 2 关 云山大捷（1950.11.1，39军对美军骑兵第1师第8团的第一次交手；夜袭、包围、缴获大批美械）
export const LEVEL = {
  turns: 12, startTime: 'night', weather: 'clear', air: 1, par: 700,
  intro: `云山是清川江以北的一座小城。11 月 1 日黄昏，我 39 军原以为守城的是南朝鲜军，攻进去才发现
    对面换成了美军骑兵第 1 师第 8 团——美国陆军资格最老的部队。<br><br>
    这是志愿军和美军的第一次交手。夜色是我们的，天亮以后，天上就是他们的。`,
  situation: `敌：美骑 1 师第 8 团主力据守云山城（地图中央的城镇），有坦克、炮兵和团部；城南公路通往龙山洞，是他们唯一的退路。<br>
    我：39 军 116 师由北面突击，独立一师由西北面参加攻城。第 8 回合天亮前后，敌人会开始沿东南公路撤退。`,
  goal: '攻占云山（占领城内要点），并在敌人撤出战场前尽量把他们留下：地图上剩余敌军 ≤ 3，且逃出战场的敌军不超过 2 支。',
  tips: ['夜里志愿军攻击 +25%，美军 −20%，多用夜袭；白天敌机会空袭暴露在开阔地的部队。', '消灭美军后有机会缴获卡宾枪、汤姆逊冲锋枪，整补时可以分给部队。', '先派骑兵绕到东南公路上堵退路。'],
  note: '云山之战是志愿军与美军的首次交战，美骑 1 师第 8 团遭受重创；志愿军缴获了不少美式武器和车辆。',
  map: [
    'hhh....=....hhhMMhhh....',
    'hh.....=.....hhhhh......',
    '......f=..ff........hh..',
    '....f..=TTTTT.......hhh.',
    '.......=TTTTT.....hhMMh.',
    '..f....=TTTTT=====..hhh.',
    '..ff...=TTTT......=...h.',
    '...f...=...........=....',
    '~~.....=..hh........=...',
    '.~~~...=..hhh........=..',
    '...~~..=...hh.........=.',
    '....~~.=...............=',
    '.....~~=...............=',
    '......~#~..ff..........=',
    'hh.....=~~...ff.........',
    'hhh....=.~~.............',
  ],
  objs: [
    { kind: 'flag', id: 'yunsan', name: '云山城', x: 11, y: 4, owner: 'e' },
    { kind: 'exit', x: 23, y: 11, owner: 'e' }, { kind: 'exit', x: 23, y: 12, owner: 'e' }, { kind: 'exit', x: 23, y: 13, owner: 'e' },
    { kind: 'treasure', x: 3, y: 14, item: 'apple', name: '老乡的苹果' },
  ],
  forts: [{ x: 9, y: 3, level: 1 }, { x: 12, y: 3, level: 1 }, { x: 9, y: 5, level: 1 }, { x: 12, y: 5, level: 1 }],
  deploy: [{ x0: 0, y0: 0, x1: 6, y1: 2 }, { x0: 0, y0: 3, x1: 3, y1: 9 }],
  maxDeploy: 9, reserved: [],
  allies: [
    { id: 'a1', type: 'inf', name: '116师347团1营', x: 14, y: 0, level: 2 },
    { id: 'a2', type: 'inf', name: '116师347团2营', x: 16, y: 1, level: 2 },
    { id: 'a3', type: 'mg',  name: '116师机枪连', x: 18, y: 2, level: 2 },
  ],
  enemies: [
    { id: 'e1', type: 'us_inf', name: '美骑8团1营A连', x: 9, y: 3, stance: 'hold' },
    { id: 'e2', type: 'us_inf', name: '美骑8团1营B连', x: 12, y: 3, stance: 'hold' },
    { id: 'e3', type: 'us_inf', name: '美骑8团2营E连', x: 9, y: 5, stance: 'hold' },
    { id: 'e4', type: 'us_inf', name: '美骑8团2营F连', x: 12, y: 5, stance: 'hold' },
    { id: 'e5', type: 'us_mg',  name: '美骑8团机枪连', x: 10, y: 4, stance: 'hold' },
    { id: 'e6', type: 'us_hq',  name: '美骑8团团部', x: 11, y: 4, stance: 'hold' },
    { id: 'e7', type: 'us_tank', name: '美70坦克营1排', x: 13, y: 4, stance: 'hold' },
    { id: 'e8', type: 'us_tank', name: '美70坦克营2排', x: 8, y: 6, stance: 'hold' },
    { id: 'e9', type: 'us_art', name: '美99炮兵营A连', x: 11, y: 6, stance: 'hold' },
    { id: 'e10', type: 'us_truck', name: '美骑8团车队', x: 12, y: 6, stance: 'hold' },
  ],
  win: { all: [{ type: 'objOwner', id: 'yunsan', owner: 'p' }, { type: 'enemyAliveLte', n: 3 }] },
  lose: [{ type: 'escapedGte', n: 3 }, { type: 'heroDead' }, { type: 'hqDead' }, { type: 'turnLimit' }],
  events: [
    { id: 'start', when: { turn: 1, phase: 'p' }, do: [{ type: 'say', lines: [
      { who: 'peng', text: '云山守敌是美军骑 1 师，不是南朝鲜军。不要怕——他们的坦克和飞机在夜里没有用武之地。' },
      { who: 'player', text: '天黑就是我们的白天。先派骑兵堵住东南公路，主力从北、西两面夜袭进城。' },
      { who: 'yue', text: '特种兵连请求打头阵，他们的坦克交给我们的炸药包。' },
    ] }] },
    { id: 'firstkill', when: { enemyDeadGte: 1 }, do: [{ type: 'say', lines: [
      { who: 'narrator', text: '美军丢下了成堆的装备。消灭敌军后有机会缴获武器和口粮，战后在"整补"里分配给部队。' },
    ] }] },
    { id: 'retreat', when: { turn: 8, phase: 'e' }, do: [
      { type: 'stance', ids: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10'], stance: 'flee' },
      { type: 'say', lines: [{ who: 'cheng', text: '师长，敌人开始沿东南公路突围了！骑兵连在公路上等着他们。' }] },
    ] },
  ],
};
