// 第 1 关 两水洞·旗开得胜（1950.10.25，志愿军入朝第一仗：40军118师在温井—北镇公路伏击南朝鲜军第6师）
// 关卡文件格式（所有关卡通用）：
//   map      24×16 ASCII 地形（字符含义见 data/terrain.js）
//   objs     覆盖物：flag 要点 / mine 地雷 / wire 铁丝网 / depot 补给点 / treasure 缴获品 / exit 出口 / tunnel 坑道
//   forts    预置工事 { x, y, level }
//   deploy   我方部署区（若干矩形）；maxDeploy 花名册最多上场数；reserved 本关不可部署（由剧情增援）
//   allies   本关的史实友军（不入花名册，玩家操作）；enemies 敌军（stance 见 engine/ai.js）
//   win/lose 胜负条件（engine/battle.js 的 evalCond）；events 事件脚本（engine/script.js）
//   turns 回合上限；startTime 'day'|'night'；weather 'clear'|'snow'；air 每个白天回合的空袭次数
export const LEVEL = {
  turns: 12, startTime: 'day', weather: 'clear', air: 0, par: 520,
  intro: `1950 年 10 月 19 日夜，志愿军跨过鸭绿江。25 日清晨，南朝鲜军第 6 师第 2 团沿温井—北镇公路北上，
    正好一头撞进我 40 军 118 师在两水洞设下的口袋。<br><br>
    独立一师作为先遣部队，奉命在北镇以南的山谷里配合 118 师，打好入朝第一仗。`,
  situation: `敌：南朝鲜军第 6 师一部，步兵为主，带一支辎重车队，正沿公路向北镇（西北角的村庄）推进，没料到会遇上志愿军。<br>
    我：独立一师 + 118 师 353 团一部（西侧丘陵）。公路中段已埋好地雷。`,
  goal: '守住北镇；把进入山谷的敌军全部消灭或击退（地图上剩余敌军 ≤ 1）。地雷响了以后，成天舒、傅国梓的骑兵连会从敌后赶到。',
  tips: ['点一支部队，再点蓝色格子移动；点红框的敌人攻击。', '先把部队藏在树林和丘陵里（策略：埋伏），等敌人走近再打。', '打完记得让疲劳高的部队休息一回合。'],
  note: '两水洞战斗是抗美援朝的第一仗，10 月 25 日后来被定为抗美援朝纪念日。',
  map: [
    'MMMMhhh......hhMMMMMMMMM',
    'MMhhh...ff....hhMMMMhhMM',
    'Mhh.=v..ff.....hMMhh..hM',
    'hh..=====.......hhh...hh',
    'h....f..====....h.....h.',
    '...ff......==..........f',
    '....f.......==...ff...ff',
    '..hh.........==..ff..fh.',
    '.hhh....~~....==....hhM.',
    '.hh....~~.~~...==..hMMM.',
    'hh....~~...~~...==.hMM..',
    'h....~~.....~~...==hh...',
    '....~~..hh...~~...==....',
    '...~~..hhh....~~...==v..',
    '..~~..hhhh.....~~....==.',
    '.~~........hhh..~~....==',
  ],
  objs: [
    { kind: 'flag', id: 'beizhen', name: '北镇', x: 5, y: 2, owner: 'p' },
    { kind: 'mine', x: 14, y: 7, owner: 'p' }, { kind: 'mine', x: 13, y: 6, owner: 'p' }, { kind: 'mine', x: 12, y: 5, owner: 'p' },
    { kind: 'treasure', x: 21, y: 2, item: 'thompson', name: '缴获的汤姆逊冲锋枪' },
    { kind: 'treasure', x: 9, y: 12, item: 'ginseng', name: '老乡送的人参' },
  ],
  forts: [],
  deploy: [{ x0: 5, y0: 1, x1: 14, y1: 5 }, { x0: 0, y0: 4, x1: 3, y1: 9 }],
  maxDeploy: 7, reserved: ['cheng', 'fu'],
  allies: [
    { id: 'a1', type: 'inf', name: '118师353团1营', x: 2, y: 7, level: 2 },
    { id: 'a2', type: 'inf', name: '118师353团2营', x: 1, y: 9, level: 2 },
  ],
  enemies: [
    { id: 'e1', type: 'rok_inf', name: '韩6师2团1营', x: 23, y: 15, stance: 'objective', target: 'beizhen' },
    { id: 'e2', type: 'rok_inf', name: '韩6师2团2营', x: 22, y: 14, stance: 'objective', target: 'beizhen' },
    { id: 'e3', type: 'rok_mg',  name: '韩6师2团机枪连', x: 21, y: 13, stance: 'objective', target: 'beizhen' },
    { id: 'e4', type: 'rok_inf', name: '韩6师2团3营', x: 20, y: 13, stance: 'objective', target: 'beizhen' },
    { id: 'e5', type: 'us_truck', name: '韩军辎重车队', x: 23, y: 14, stance: 'convoy', target: 'beizhen' },
    { id: 'e6', type: 'rok_inf', name: '韩6师7团1营', x: 19, y: 12, stance: 'objective', target: 'beizhen' },
    { id: 'e7', type: 'rok_art', name: '韩6师炮兵连', x: 22, y: 12, stance: 'objective', target: 'beizhen' },
  ],
  win: { all: [{ type: 'enemyAliveLte', n: 1 }] },
  lose: [{ type: 'heroDead' }, { type: 'hqDead' }, { type: 'objOwner', id: 'beizhen', owner: 'e' }, { type: 'turnLimit' }],
  events: [
    { id: 'start', when: { turn: 1, phase: 'p' }, do: [{ type: 'say', lines: [
      { who: 'peng', text: '敌人还不知道我们来了。这一仗，要打得干净、打得漂亮，让他们知道志愿军是什么样的部队。' },
      { who: 'player', text: '独立一师明白。先把部队藏进山谷两侧的树林和丘陵，等他们踩了雷，再收口袋。' },
      { who: 'zhengwei', text: '师长，提醒各连：疲劳超过一半就要歇一歇，别一口气冲到底。' },
    ] }] },
    { id: 'mine', when: { mineHit: true }, do: [
      { type: 'flag', flag: 'reinforced' },
      { type: 'spawnRoster', ids: ['cheng', 'fu'], at: [{ x: 23, y: 8 }, { x: 23, y: 9 }] },
      { type: 'say', lines: [
        { who: 'cheng', text: '师长！骑兵连绕到敌人后面了，公路已经堵死！' },
        { who: 'fu', text: '他们的辎重车队就在眼前，别让它跑了！' },
      ] },
    ] },
    { id: 'mine_fallback', when: { turn: 6, phase: 'p' }, unless: 'reinforced', do: [
      { type: 'flag', flag: 'reinforced' },
      { type: 'spawnRoster', ids: ['cheng', 'fu'], at: [{ x: 23, y: 8 }, { x: 23, y: 9 }] },
      { type: 'say', lines: [{ who: 'cheng', text: '师长，骑兵连按时到位，从后面压上来了！' }] },
    ] },
    { id: 'few', when: { enemyAliveLte: 3 }, do: [{ type: 'say', lines: [
      { who: 'zhengwei', text: '敌人已经乱了。别把他们逼得走投无路——留一条缝，让他们往枪口上撞。' },
    ] }] },
  ],
};
