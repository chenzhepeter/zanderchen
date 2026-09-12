// 第 6 关 突破临津江·解放汉城（1950.12.31 除夕黄昏，第三次战役：39军等部强渡临津江，突破南朝鲜军第1师防线）
export const LEVEL = {
  turns: 12, startTime: 'night', weather: 'clear', air: 1, par: 850,
  intro: `1950 年的最后一天，志愿军发起第三次战役。临津江是"三八线"上的天然屏障，南岸的南朝鲜军第 1 师修了三道阵地：
    铁丝网、雷区、壕沟，炮兵在后面等着。<br><br>
    下午 5 点，炮火准备开始。工兵在冰面和浅滩上架起浮桥，突击营踏着冰碴子冲过江去。三天后，汉城解放。`,
  situation: `敌：南朝鲜军第 1 师据守南岸，前沿有铁丝网和地雷，两侧高地上有工事和机枪，纵深有炮兵；第 6 回合会有美军从汉城方向增援。<br>
    我：39 军 116 师和独立一师在北岸。江面部分结冰（冰面格可以涉渡），工兵最多能架 2 座浮桥。`,
  goal: '占领南岸两侧的高地（两个要点），并让至少一支部队抵达地图南边缘（通往汉城的公路）。',
  tips: ['先用炮兵轰前沿工事里的敌人，再让工兵架桥、剪铁丝网。', '敌人的雷区对我们不可见——让工兵或特种兵（侦察）走在前面。', '夜里过江，天亮以前拿下高地。'],
  note: '第三次战役突破临津江后，志愿军于 1951 年 1 月 4 日进入汉城。',
  map: [
    '........hh..............',
    '...ff...hhh......ff.....',
    '..ff.....hh.....fff.....',
    '...............=........',
    '.........=====.=........',
    '....=====.....=.........',
    '....=.........=.........',
    '~~~~%~~~~~~~~~%~~~~~%~~~',
    '....=.........=.........',
    '....=.........=.........',
    '..hhh..hh.....=..hhh....',
    '..hhhh........=..hhhh...',
    '...hhh........=...hhh...',
    '....=.........=.........',
    '....=....v....=....v....',
    '....=====.....==========',
  ],
  objs: [
    { kind: 'flag', id: 'h1', name: '西侧高地', x: 4, y: 11, owner: 'e' },
    { kind: 'flag', id: 'h2', name: '东侧高地', x: 18, y: 11, owner: 'e' },
    { kind: 'wire', x: 2, y: 9 }, { kind: 'wire', x: 3, y: 9 }, { kind: 'wire', x: 6, y: 9 }, { kind: 'wire', x: 7, y: 9 }, { kind: 'wire', x: 8, y: 9 },
    { kind: 'wire', x: 11, y: 9 }, { kind: 'wire', x: 12, y: 9 }, { kind: 'wire', x: 16, y: 9 }, { kind: 'wire', x: 17, y: 9 }, { kind: 'wire', x: 19, y: 9 }, { kind: 'wire', x: 21, y: 9 },
    { kind: 'mine', x: 5, y: 9, owner: 'e' }, { kind: 'mine', x: 9, y: 8, owner: 'e' }, { kind: 'mine', x: 13, y: 9, owner: 'e' }, { kind: 'mine', x: 15, y: 8, owner: 'e' }, { kind: 'mine', x: 20, y: 8, owner: 'e' },
    { kind: 'treasure', x: 9, y: 14, item: 'ammobox', name: '敌军弹药库' },
  ],
  forts: [{ x: 4, y: 11, level: 2 }, { x: 18, y: 11, level: 2 }, { x: 3, y: 10, level: 1 }, { x: 8, y: 10, level: 1 }, { x: 17, y: 10, level: 1 }, { x: 20, y: 10, level: 1 }, { x: 14, y: 10, level: 1 }],
  deploy: [{ x0: 0, y0: 0, x1: 23, y1: 5 }],
  maxDeploy: 10, reserved: [],
  allies: [
    { id: 'a1', type: 'inf', name: '116师346团1营', x: 6, y: 5, level: 3 },
    { id: 'a2', type: 'inf', name: '116师346团2营', x: 12, y: 5, level: 3 },
    { id: 'a3', type: 'eng', name: '116师工兵连', x: 9, y: 5, level: 2 },
    { id: 'a4', type: 'art', name: '116师炮兵营', x: 10, y: 3, level: 2 },
  ],
  enemies: [
    { id: 'e1', type: 'rok_inf', name: '韩1师12团1营', x: 3, y: 10, stance: 'hold' },
    { id: 'e2', type: 'rok_inf', name: '韩1师12团2营', x: 8, y: 10, stance: 'hold' },
    { id: 'e3', type: 'rok_mg',  name: '韩1师机枪连', x: 4, y: 11, stance: 'hold' },
    { id: 'e4', type: 'rok_inf', name: '韩1师11团1营', x: 17, y: 10, stance: 'hold' },
    { id: 'e5', type: 'rok_inf', name: '韩1师11团2营', x: 20, y: 10, stance: 'hold' },
    { id: 'e6', type: 'rok_mg',  name: '韩1师机枪连', x: 18, y: 11, stance: 'hold' },
    { id: 'e7', type: 'rok_inf', name: '韩1师15团1营', x: 14, y: 10, stance: 'hold' },
    { id: 'e8', type: 'rok_art', name: '韩1师炮兵营', x: 11, y: 14, stance: 'hold' },
    { id: 'e9', type: 'us_sherman', name: '韩军坦克排', x: 14, y: 13, stance: 'hold' },
  ],
  win: { all: [{ type: 'objOwner', id: 'h1', owner: 'p' }, { type: 'objOwner', id: 'h2', owner: 'p' }, { type: 'reach', rect: { x0: 0, y0: 15, x1: 23, y1: 15 }, n: 1 }] },
  lose: [{ type: 'heroDead' }, { type: 'hqDead' }, { type: 'turnLimit' }],
  events: [
    { id: 'start', when: { turn: 1, phase: 'p' }, do: [{ type: 'say', lines: [
      { who: 'peng', text: '突破三八线，打过临津江！今晚炮火一响，各部队按预定地段渡江，天亮以前必须拿下南岸高地。' },
      { who: 'player', text: '炮兵先打前沿工事，工兵架桥、剪铁丝网。特种兵走在最前面，把雷区探出来。' },
    ] }] },
    { id: 'cross', when: { playerReach: { rect: { x0: 0, y0: 8, x1: 23, y1: 15 }, n: 1 } }, do: [{ type: 'say', lines: [
      { who: 'yue', text: '过江了！前面有铁丝网和雷区，工兵快跟上。' },
    ] }] },
    { id: 'reinf', when: { turn: 6, phase: 'e' }, do: [
      { type: 'spawn', units: [
        { id: 'e10', type: 'us_inf', name: '美25师一部', x: 5, y: 15, stance: 'objective', target: 'h1' },
        { id: 'e11', type: 'us_inf', name: '美25师一部', x: 19, y: 15, stance: 'objective', target: 'h2' },
        { id: 'e12', type: 'us_tank', name: '美军坦克排', x: 15, y: 15, stance: 'objective', target: 'h2' },
      ] },
      { type: 'say', lines: [{ who: 'du', text: '汉城方向来了美军增援，有坦克。' }] },
    ] },
  ],
};
