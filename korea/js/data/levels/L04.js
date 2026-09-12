// 第 4 关 三所里·松骨峰（1950.11.27–30，第二次战役：38军113师14小时急行军72.5公里抢占三所里，堵住美军南逃）
export const LEVEL = {
  turns: 12, startTime: 'day', weather: 'clear', air: 2, par: 800,
  intro: `第二次战役打响。38 军 113 师接到命令：一夜之间穿插到三所里，把美军第 2 师、第 25 师和土耳其旅的退路堵死。
    14 个小时，72.5 公里山路，部队跑步前进，到达时敌人的车队离三所里只差几分钟。<br><br>
    随后在龙源里、松骨峰，一个连顶住了美军整整一天的冲击。彭德怀在嘉奖电里写下"三十八军万岁"。`,
  situation: `敌：美 2 师、土耳其旅的车队和坦克正从北面（军隅里方向）沿公路向南撤退，一心只想逃出战场，被堵住时才会拼命。<br>
    我：113 师在东侧山地，需要先用"急行军"抢到三所里和龙源里两个路口，再顶住敌人的冲击。`,
  goal: '在第 12 回合结束前，逃出战场（从南边缘出口离开）的敌军不能超过 3 支。第 4 回合前占领三所里能让敌人一头撞上阵地。',
  tips: ['急行军：本回合行动力 +50%，疲劳 +10。抢路口时值得。', '逃跑的敌人不会主动进攻，堵在公路上的部队记得修工事。', '敌人的车队是缴获大户，坦克交给特种兵。'],
  note: '三所里、龙源里和松骨峰阻击战是第二次战役的关键；松骨峰 3 连的故事后来写成了《谁是最可爱的人》。',
  map: [
    'hh....=......hhh........',
    'hhh...=.......hh...ff...',
    '.hh...=........h....ff..',
    '..h...=.................',
    '......=....ff...........',
    '...ff.=...fff....hh.....',
    '..ff..=..hhh......hh....',
    '......=..hMh...hh.......',
    '.....=...hhh...hhh......',
    '....=..........hh.......',
    '....=..ff...............',
    '...=....ff....hh........',
    '...=..........hhh...ff..',
    '...=...v.......hh...f...',
    '..=....=======v.........',
    '..=...........=.........',
  ],
  objs: [
    { kind: 'flag', id: 'sansori', name: '三所里', x: 7, y: 13, owner: 'e' },
    { kind: 'flag', id: 'longyuan', name: '龙源里', x: 14, y: 14, owner: 'e' },
    { kind: 'flag', id: 'songgu', name: '松骨峰', x: 10, y: 7, owner: 'e' },
    { kind: 'exit', x: 2, y: 15, owner: 'e' }, { kind: 'exit', x: 1, y: 15, owner: 'e' }, { kind: 'exit', x: 3, y: 15, owner: 'e' },
    { kind: 'exit', x: 14, y: 15, owner: 'e' }, { kind: 'exit', x: 13, y: 15, owner: 'e' }, { kind: 'exit', x: 15, y: 15, owner: 'e' },
    { kind: 'treasure', x: 20, y: 12, item: 'apple', name: '路边的苹果' },
  ],
  forts: [],
  deploy: [{ x0: 19, y0: 3, x1: 23, y1: 10 }],
  maxDeploy: 9, reserved: [],
  allies: [
    { id: 'a1', type: 'inf', name: '113师337团1营', x: 22, y: 6, level: 2 },
    { id: 'a2', type: 'inf', name: '113师337团2营', x: 22, y: 8, level: 2 },
    { id: 'a3', type: 'inf', name: '335团3连', x: 21, y: 4, level: 3, morale: 95 },
  ],
  enemies: [
    { id: 'e1', type: 'us_truck', name: '美2师车队', x: 6, y: 0, stance: 'flee', target: 'exit' },
    { id: 'e2', type: 'us_inf', name: '美2师9团一部', x: 6, y: 1, stance: 'flee', target: 'exit' },
    { id: 'e3', type: 'us_tank', name: '美72坦克营一部', x: 6, y: 2, stance: 'flee', target: 'exit' },
    { id: 'e4', type: 'us_inf', name: '美2师38团一部', x: 5, y: 0, stance: 'flee', target: 'exit' },
  ],
  win: { all: [{ type: 'turnLimit' }, { type: 'escapedLte', n: 3 }] },
  lose: [{ type: 'escapedGte', n: 4 }, { type: 'heroDead' }, { type: 'hqDead' }],
  events: [
    { id: 'start', when: { turn: 1, phase: 'p' }, do: [{ type: 'say', lines: [
      { who: 'liang', text: '113 师，天亮以前必须到三所里！敌人的车队已经上路了，晚到一步，这一仗就白打了。' },
      { who: 'player', text: '全师急行军！骑兵连先去龙源里，步兵抢三所里，松骨峰留给 335 团 3 连。' },
      { who: 'narrator', text: '提示：选中部队后使用策略"急行军"，本回合行动力增加一半。' },
    ] }] },
    { id: 'songgu', when: { enemyAdjacentObj: 'songgu' }, do: [{ type: 'say', lines: [
      { who: 'narrator', text: '松骨峰。3 连在这座小山上打退了美军一次又一次的冲锋，子弹打光就用刺刀和石头。' },
      { who: 'zhengwei', text: '告诉 3 连：山在人在。' },
    ] }] },
    { id: 'wave1', when: { turn: 3, phase: 'e' }, do: [
      { type: 'spawn', units: [
        { id: 'e5', type: 'tk_inf', name: '土耳其旅一部', x: 7, y: 0, stance: 'flee', target: 'exit' },
        { id: 'e6', type: 'us_truck', name: '美25师车队', x: 6, y: 0, stance: 'flee', target: 'exit' },
        { id: 'e7', type: 'us_art', name: '美2师炮兵一部', x: 5, y: 0, stance: 'flee', target: 'exit' },
        { id: 'e8', type: 'us_inf', name: '美2师23团一部', x: 8, y: 0, stance: 'flee', target: 'exit' },
      ] },
      { type: 'say', lines: [{ who: 'fu', text: '军隅里方向又下来一批，有炮兵和车队。' }] },
    ] },
    { id: 'wave2', when: { turn: 6, phase: 'e' }, do: [
      { type: 'spawn', units: [
        { id: 'e9', type: 'us_inf', name: '美25师24团一部', x: 6, y: 0, stance: 'flee', target: 'exit' },
        { id: 'e10', type: 'us_sherman', name: '美军坦克排', x: 7, y: 0, stance: 'flee', target: 'exit' },
        { id: 'e11', type: 'tk_inf', name: '土耳其旅一部', x: 5, y: 0, stance: 'flee', target: 'exit' },
      ] },
      { type: 'say', lines: [{ who: 'cheng', text: '北面又来了一批，还有坦克！' }] },
    ] },
    { id: 'peng', when: { turn: 10, phase: 'p' }, do: [{ type: 'say', lines: [
      { who: 'peng', text: '再顶两个回合！38 军打得好，等这一仗打完，我给你们发嘉奖电。' },
    ] }] },
  ],
};
