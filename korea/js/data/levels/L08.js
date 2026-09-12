// 第 8 关 铁原阻击（1951.5.28–6.10，第五次战役后期：63军在铁原以"钉子"战术拖住敌军十三昼夜，掩护主力转移）
export const LEVEL = {
  turns: 13, startTime: 'day', weather: 'clear', air: 2, par: 900,
  intro: `第五次战役后期，志愿军主力北撤，美军的机械化部队追了上来。彭德怀给 63 军的命令只有一句：
    "在铁原坚守十五到二十天，不许放敌人过来。"<br><br>
    傅崇碧把 189 师像钉子一样撒在铁原以南的山头上，两百多个小阵地，每一个都要美军花一天去拔。
    十三个昼夜之后，主力安全转移，铁原还在。`,
  situation: `敌：美 1 军的美 1 骑兵师、美 3 师和英 29 旅，兵力火力占绝对优势，从南面全线推进，目标是穿过阵地北上。<br>
    我：63 军 189 师和独立一师，四个要点像钉子一样钉在路上。北边缘是撤退出口——打不住的部队可以主动撤出保存实力。`,
  goal: '坚守到第 13 回合结束，期间到达北边缘的敌军不超过 1 支，且我方部队（含主动撤退的）保存 40% 以上。敌军 2 支以上抵达北边缘即告失败。',
  tips: ['不用每个要点都守到底——拖住时间才是目的。', '快守不住的部队走到北边缘的出口用"撤退"，算作保存实力。', '敌人多，优先打炮兵和机枪；坦克让它慢慢啃工事。'],
  note: '铁原阻击战后 63 军伤亡惨重，彭德怀到医院看望 189 师时说："祖国感谢你们。"',
  map: [
    '....=.....=........=....',
    '....=.....=........=....',
    '....=.....=...ff...=....',
    '...hh.....=...ff...=hh..',
    '..hhh...hhh........hhh..',
    '..hhhh.hhhhh......hhhh..',
    '...hh...hhh....hh..hh...',
    '.....=....=....hhh......',
    '.....=....=.....h..=....',
    '....hh....=........=....',
    '...hhh....=..hh....=....',
    '....hh....=.hhh....=....',
    '.....=....=..h.....=....',
    '.....=....=........=....',
    '.....=....=..v.....=....',
    '.....=....=........=....',
  ],
  objs: [
    { kind: 'flag', id: 'n1', name: '钉子一号', x: 3, y: 5, owner: 'p' },
    { kind: 'flag', id: 'n2', name: '钉子二号', x: 9, y: 5, owner: 'p' },
    { kind: 'flag', id: 'n3', name: '钉子三号', x: 16, y: 7, owner: 'p' },
    { kind: 'flag', id: 'n4', name: '钉子四号', x: 20, y: 5, owner: 'p' },
    { kind: 'exit', x: 4, y: 0, owner: 'p' }, { kind: 'exit', x: 10, y: 0, owner: 'p' }, { kind: 'exit', x: 19, y: 0, owner: 'p' }, { kind: 'exit', x: 14, y: 0, owner: 'p' },
    { kind: 'treasure', x: 13, y: 14, item: 'can', name: '敌军丢下的口粮' },
  ],
  forts: [{ x: 3, y: 5, level: 2 }, { x: 9, y: 5, level: 2 }, { x: 16, y: 7, level: 2 }, { x: 20, y: 5, level: 2 }, { x: 2, y: 5, level: 1 }, { x: 10, y: 5, level: 1 }, { x: 15, y: 6, level: 1 }, { x: 19, y: 5, level: 1 }],
  deploy: [{ x0: 0, y0: 2, x1: 23, y1: 9 }],
  maxDeploy: 10, reserved: [],
  allies: [
    { id: 'a1', type: 'inf', name: '189师566团1营', x: 3, y: 5, level: 3 },
    { id: 'a2', type: 'inf', name: '189师566团2营', x: 9, y: 5, level: 3 },
    { id: 'a3', type: 'inf', name: '189师567团1营', x: 20, y: 5, level: 3 },
    { id: 'a4', type: 'mg',  name: '189师机枪连', x: 16, y: 7, level: 2 },
  ],
  enemies: [
    { id: 'e1', type: 'us_inf', name: '美骑1师5团一部', x: 3, y: 15, stance: 'objective', target: 'n1' },
    { id: 'e2', type: 'us_inf', name: '美骑1师5团一部', x: 8, y: 15, stance: 'objective', target: 'n2' },
    { id: 'e3', type: 'us_inf', name: '美3师65团一部', x: 15, y: 15, stance: 'objective', target: 'n3' },
    { id: 'e4', type: 'uk_inf', name: '英29旅一部', x: 20, y: 15, stance: 'objective', target: 'n4' },
    { id: 'e5', type: 'us_tank', name: '美70坦克营一部', x: 5, y: 14, stance: 'objective', target: 'n1' },
    { id: 'e6', type: 'us_tank', name: '美64坦克营一部', x: 10, y: 14, stance: 'objective', target: 'n2' },
    { id: 'e7', type: 'us_art', name: '美军炮兵连', x: 7, y: 15, stance: 'hold' },
    { id: 'e8', type: 'us_art', name: '美军炮兵连', x: 18, y: 15, stance: 'hold' },
    { id: 'e9', type: 'us_mg', name: '美3师机枪连', x: 12, y: 15, stance: 'objective', target: 'n3' },
  ],
  win: { all: [{ type: 'turnLimit' }, { type: 'enemyReachLte', rect: { x0: 0, y0: 0, x1: 23, y1: 1 }, n: 1 }, { type: 'preservedRatioGte', r: 0.4 }] },
  lose: [{ type: 'enemyReachGte', rect: { x0: 0, y0: 0, x1: 23, y1: 1 }, n: 2 }, { type: 'heroDead' }, { type: 'hqDead' }],
  events: [
    { id: 'start', when: { turn: 1, phase: 'p' }, do: [{ type: 'say', lines: [
      { who: 'fuchongbi', text: '189 师，你们是钉子。每一个山头都要让敌人付出一天的时间。守不住的可以撤，但撤下来的人要能再打。' },
      { who: 'player', text: '独立一师分散布防。骑兵连留在后面，哪里吃紧就往哪里堵。' },
    ] }] },
    { id: 'wave2', when: { turn: 4, phase: 'e' }, do: [
      { type: 'spawn', units: [
        { id: 'e10', type: 'us_inf', name: '美3师7团一部', x: 4, y: 15, stance: 'objective', target: 'n1' },
        { id: 'e11', type: 'us_inf', name: '美骑1师8团一部', x: 13, y: 15, stance: 'objective', target: 'n3' },
        { id: 'e12', type: 'us_sherman', name: '美军坦克排', x: 21, y: 14, stance: 'objective', target: 'n4' },
      ] },
    ] },
    { id: 'wave3', when: { turn: 8, phase: 'e' }, do: [
      { type: 'spawn', units: [
        { id: 'e13', type: 'us_inf', name: '美骑1师7团一部', x: 9, y: 15, stance: 'objective', target: 'n2' },
        { id: 'e14', type: 'uk_inf', name: '英29旅一部', x: 17, y: 15, stance: 'objective', target: 'n3' },
        { id: 'e15', type: 'us_tank', name: '美军坦克排', x: 2, y: 15, stance: 'objective', target: 'n1' },
        { id: 'e16', type: 'us_apc', name: '美军装甲车队', x: 11, y: 15, stance: 'objective', target: 'n2' },
      ] },
      { type: 'say', lines: [{ who: 'peng', text: '主力已经安全转移一半了。63 军再给我顶五个回合！' }] },
    ] },
    { id: 'end', when: { turn: 12, phase: 'p' }, do: [{ type: 'say', lines: [
      { who: 'fuchongbi', text: '最后两回合。能撤的撤，留下的打完这一仗，祖国不会忘记你们。' },
    ] }] },
  ],
};
