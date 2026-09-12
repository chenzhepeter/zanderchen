// 第 3 关 血战飞虎山（1950.11.4–8，38军335团在飞虎山阻击敌军五昼夜；弹药紧缺、工事、补给线）
export const LEVEL = {
  turns: 10, startTime: 'day', weather: 'clear', air: 1, par: 650,
  intro: `第一次战役临近尾声，38 军 335 团团长范天恩带着部队攻占了飞虎山，
    随后就顶着敌军一万余人的反扑，在山上守了五个昼夜。<br><br>
    山上的弹药一天比一天少，全靠夜里从后方一趟趟背上来。独立一师奉命上山增援，并保证运输队的安全。`,
  situation: `敌：南朝鲜军第 7 师与美军一部，从南面分几批进攻主峰，有炮兵和坦克支援，白天有飞机。<br>
    我：335 团三个营已在山脊上构筑了工事；山后的村庄是补给点，运输队可以在那里装弹药再送上山。`,
  goal: '坚守飞虎山主峰（山脊中央的要点）直到第 10 回合结束。主峰一旦被敌人占领即告失败。',
  tips: ['工兵可以把壕沟修成沙包、掩体（防御 40% → 60% → 80%）。', '弹药打光就只能拼刺刀——让运输队停在部队旁边使用"补给"。', '机枪连放在主峰两侧的工事里反击最狠。'],
  note: '飞虎山阻击战中 335 团顶住了敌军五昼夜的进攻，掩护了第一次战役的收尾；该团后来又打了松骨峰。',
  map: [
    '........................',
    '....hh....v.....hh......',
    '...hhh..........hhh.....',
    '......==......==........',
    '.....=..======..=.......',
    '...hh=..........=hh.....',
    '..hhhh.hhhhhhhh..hhh....',
    '.hhhhhhhhhMMhhhhhhhhhh..',
    '..hhhh.hhhhhhhh..hhhh...',
    '...hh=..ff......=hh.....',
    '.....=...ff.....=.......',
    '.....=..........=.......',
    '....=....ff......=......',
    '....=.....ff.....=......',
    '...=..............=.....',
    '...=..............=.....',
  ],
  objs: [
    { kind: 'flag', id: 'peak', name: '飞虎山主峰', x: 10, y: 7, owner: 'p' },
    { kind: 'depot', x: 10, y: 1, owner: 'p', name: '山后补给点' },
    { kind: 'treasure', x: 17, y: 1, item: 'ammobox', name: '后方送来的弹药箱' },
  ],
  forts: [{ x: 10, y: 7, level: 2 }, { x: 11, y: 7, level: 2 }, { x: 7, y: 7, level: 1 }, { x: 14, y: 7, level: 1 }, { x: 5, y: 7, level: 1 }, { x: 16, y: 7, level: 1 }, { x: 9, y: 6, level: 1 }, { x: 12, y: 6, level: 1 }],
  deploy: [{ x0: 2, y0: 4, x1: 21, y1: 8 }, { x0: 6, y0: 0, x1: 16, y1: 3 }],
  maxDeploy: 9, reserved: [],
  allies: [
    { id: 'a1', type: 'inf', name: '335团1营', x: 7, y: 7, level: 2, fatigue: 30, ammo: 18 },
    { id: 'a2', type: 'inf', name: '335团2营', x: 11, y: 7, level: 2, fatigue: 30, ammo: 14 },
    { id: 'a3', type: 'inf', name: '335团3营', x: 14, y: 7, level: 2, fatigue: 30, ammo: 16 },
    { id: 'a4', type: 'mg',  name: '335团机枪连', x: 10, y: 7, level: 2, fatigue: 20, ammo: 20 },
  ],
  enemies: [
    { id: 'e1', type: 'rok_inf', name: '韩7师3团1营', x: 6, y: 15, stance: 'objective', target: 'peak' },
    { id: 'e2', type: 'rok_inf', name: '韩7师3团2营', x: 10, y: 15, stance: 'objective', target: 'peak' },
    { id: 'e3', type: 'rok_inf', name: '韩7师3团3营', x: 14, y: 15, stance: 'objective', target: 'peak' },
    { id: 'e4', type: 'rok_mg',  name: '韩7师机枪连', x: 8, y: 14, stance: 'objective', target: 'peak' },
    { id: 'e5', type: 'rok_art', name: '韩7师炮兵连', x: 12, y: 15, stance: 'hold' },
  ],
  win: { all: [{ type: 'turnLimit' }, { type: 'objOwner', id: 'peak', owner: 'p' }] },
  lose: [{ type: 'objOwner', id: 'peak', owner: 'e' }, { type: 'heroDead' }, { type: 'hqDead' }],
  events: [
    { id: 'start', when: { turn: 1, phase: 'p' }, do: [{ type: 'say', lines: [
      { who: 'fan', text: '山上就这么多子弹了。白天他们炮打、飞机炸，夜里我们下去摸他们的营地。撑住，援兵就是你们。' },
      { who: 'player', text: '运输队立刻去山后村庄装弹药。工兵把主峰的工事再加固一层。' },
    ] }] },
    { id: 'wave2', when: { turn: 4, phase: 'e' }, do: [
      { type: 'spawn', units: [
        { id: 'e6', type: 'us_inf', name: '美2师9团一部', x: 4, y: 15, stance: 'objective', target: 'peak' },
        { id: 'e7', type: 'us_inf', name: '美2师9团一部', x: 16, y: 15, stance: 'objective', target: 'peak' },
        { id: 'e8', type: 'us_sherman', name: '美军坦克排', x: 5, y: 14, stance: 'objective', target: 'peak' },
        { id: 'e9', type: 'us_art', name: '美军炮兵连', x: 18, y: 15, stance: 'hold' },
      ] },
      { type: 'say', lines: [{ who: 'fan', text: '美军上来了，还有坦克。坦克上不了陡坡，把它引到山脚下用炸药包收拾。' }] },
    ] },
    { id: 'wave3', when: { turn: 7, phase: 'e' }, do: [
      { type: 'spawn', units: [
        { id: 'e10', type: 'rok_inf', name: '韩7师5团1营', x: 9, y: 15, stance: 'objective', target: 'peak' },
        { id: 'e11', type: 'rok_inf', name: '韩7师5团2营', x: 13, y: 15, stance: 'objective', target: 'peak' },
        { id: 'e12', type: 'us_inf', name: '美2师9团一部', x: 11, y: 15, stance: 'objective', target: 'peak' },
      ] },
      { type: 'say', lines: [{ who: 'zhengwei', text: '最后一波了。弹药不够的部队先退到二线，让机枪连顶在工事里。' }] },
    ] },
  ],
};
