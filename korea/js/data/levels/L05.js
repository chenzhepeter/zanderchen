// 第 5 关 长津湖（1950.11.27 起，第9兵团在零下三四十度的严寒中围歼新兴里的美7师31团；杨根思守小高岭）
export const LEVEL = {
  turns: 14, startTime: 'night', weather: 'snow', air: 1, par: 900,
  intro: `1950 年 11 月底，第 9 兵团 15 万人翻山越岭赶到长津湖，很多战士还穿着南方的薄棉衣。
    气温降到零下三十多度，冻伤比子弹更可怕。<br><br>
    27 军的目标是新兴里的美 7 师 31 团——"北极熊团"；20 军的杨根思连守在下碣隅里东南的小高岭，
    挡住美军陆战 1 师突围的去路。`,
  situation: `敌：北极熊团据守东岸的新兴里，有坦克和炮兵，团部就在村里；第 5 回合，下碣隅里方向的美陆战队会向西南的小高岭发起进攻。<br>
    我：27 军 80 师从北面围攻新兴里，杨根思的 3 连守小高岭。严寒：不在村庄里休息的部队每回合疲劳上升，疲劳过高会有人冻伤；穿棉衣的部队不受影响。`,
  goal: '消灭新兴里的北极熊团团部，同时守住小高岭（西南的要点）。小高岭失守即告失败。',
  tips: ['雪原上多用"休息"，或让部队进村庄躲一躲；地图上有两件缴获的棉衣。', '空投的补给箱谁先到手就是谁的。', '夜里进攻，白天守。'],
  note: '新兴里战斗全歼美 7 师 31 团级战斗队，是志愿军在朝鲜战场上成建制歼灭美军一个团的战例；杨根思在小高岭抱起炸药包冲向敌群，壮烈牺牲。',
  map: [
    'SSS***%%%%****SSS*******',
    'SS***%%%%%%***SS********',
    'S***%%%%%%%%****S**vv***',
    '****%%%%%%%%%***=*vvv***',
    '***%%%%%%%%%%**=**vv****',
    '***%%%%%%%%%%*=****S****',
    '****%%%%%%%%*=****SS****',
    'S****%%%%%%*=****SS*****',
    'SS****%%%%*=****S*******',
    'SSS****%%*=****S********',
    '*SSS****=*****SS*****SS*',
    '**SSS**=******S*****SSS*',
    '***SS*=******S*****SS***',
    '****=*=*****S******S****',
    '***=**=****SS***********',
    '***=**vv***S************',
  ],
  objs: [
    { kind: 'flag', id: 'gaoling', name: '小高岭', x: 3, y: 12, owner: 'p' },
    { kind: 'flag', id: 'xinxingli', name: '新兴里', x: 19, y: 3, owner: 'e' },
    { kind: 'treasure', x: 12, y: 7, item: 'cotton', name: '缴获的棉衣' },
    { kind: 'treasure', x: 8, y: 10, item: 'cotton', name: '缴获的棉衣' },
    { kind: 'treasure', x: 22, y: 9, item: 'ginseng', name: '老乡送的人参' },
  ],
  forts: [{ x: 3, y: 12, level: 2 }, { x: 4, y: 12, level: 1 }, { x: 19, y: 3, level: 1 }, { x: 18, y: 2, level: 1 }, { x: 20, y: 4, level: 1 }],
  deploy: [{ x0: 12, y0: 0, x1: 23, y1: 1 }, { x0: 0, y0: 8, x1: 3, y1: 11 }],
  maxDeploy: 9, reserved: [],
  allies: [
    { id: 'a1', type: 'inf', name: '80师239团1营', x: 14, y: 0, level: 2 },
    { id: 'a2', type: 'inf', name: '80师239团2营', x: 17, y: 1, level: 2 },
    { id: 'a3', type: 'mortar', name: '80师迫击炮排', x: 21, y: 0, level: 2 },
    { id: 'yg', type: 'inf', name: '杨根思·172团3连', x: 3, y: 12, level: 3, morale: 100, gear: ['cotton'] },
  ],
  enemies: [
    { id: 'polar', type: 'us_hq', name: '北极熊团团部', x: 19, y: 3, stance: 'hold' },
    { id: 'e1', type: 'us_inf', name: '美31团3营I连', x: 18, y: 2, stance: 'hold' },
    { id: 'e2', type: 'us_inf', name: '美31团3营K连', x: 20, y: 4, stance: 'hold' },
    { id: 'e3', type: 'us_inf', name: '美32团1营A连', x: 18, y: 4, stance: 'hold' },
    { id: 'e4', type: 'us_tank', name: '美31坦克连一部', x: 17, y: 3, stance: 'hold' },
    { id: 'e5', type: 'us_art', name: '美57炮兵营A连', x: 19, y: 4, stance: 'hold' },
    { id: 'e6', type: 'us_mg', name: '美31团重武器连', x: 20, y: 2, stance: 'hold' },
  ],
  win: { all: [{ type: 'unitDead', id: 'polar' }, { type: 'objOwner', id: 'gaoling', owner: 'p' }] },
  lose: [{ type: 'objOwner', id: 'gaoling', owner: 'e' }, { type: 'heroDead' }, { type: 'hqDead' }, { type: 'turnLimit' }],
  events: [
    { id: 'start', when: { turn: 1, phase: 'p' }, do: [{ type: 'say', lines: [
      { who: 'song', text: '同志们，这里比子弹更厉害的是冷。能进村的进村，能休息的休息，把手脚保住，才有力气打仗。' },
      { who: 'player', text: '80 师从北面压向新兴里，独立一师负责东侧和北极熊团团部。杨根思连守小高岭，第 5 回合前后美军会从南边扑上来。' },
    ] }] },
    { id: 'airdrop', when: { turn: 4, phase: 'p' }, do: [
      { type: 'addObj', obj: { kind: 'treasure', x: 14, y: 8, item: 'ammobox', name: '美军空投的补给箱' } },
      { type: 'say', lines: [{ who: 'du', text: '师长，美军飞机往湖面上空投了补给箱，落在我们和他们中间——去抢！' }] },
    ] },
    { id: 'wave', when: { turn: 5, phase: 'e' }, do: [
      { type: 'spawn', units: [
        { id: 'e7', type: 'us_inf', name: '美陆战1师一部', x: 6, y: 15, stance: 'objective', target: 'gaoling' },
        { id: 'e8', type: 'us_inf', name: '美陆战1师一部', x: 8, y: 15, stance: 'objective', target: 'gaoling' },
        { id: 'e9', type: 'us_inf', name: '美陆战1师一部', x: 7, y: 14, stance: 'objective', target: 'gaoling' },
        { id: 'e10', type: 'us_sherman', name: '美陆战队坦克排', x: 9, y: 14, stance: 'objective', target: 'gaoling' },
      ] },
      { type: 'say', lines: [
        { who: 'yanggensi', text: '在革命战士面前，不相信有完不成的任务，不相信有克服不了的困难，不相信有战胜不了的敌人！' },
      ] },
    ] },
    { id: 'polar', when: { unitDead: 'polar' }, do: [{ type: 'say', lines: [
      { who: 'narrator', text: '北极熊团团部被端掉了，团旗成了战利品。这是志愿军在朝鲜成建制歼灭美军一个团的战例。' },
    ] }] },
  ],
};
