// 出场人物：史实人物（只用于战前简报与战中台词，措辞尊重、不写血腥）+ 原版的虚构人物（独立一师）。
// {player} 会被替换成玩家给主角起的名字。
export const CHARACTERS = {
  player:   { id: 'player', name: '{player}', title: '独立一师师长', faction: 'cpv', icon: '🎖️' },
  cheng:    { id: 'cheng', name: '成天舒', title: '独立一师骑兵连长', faction: 'cpv', icon: '🐎' },
  fu:       { id: 'fu', name: '傅国梓', title: '独立一师骑兵连长', faction: 'cpv', icon: '🐎' },
  yue:      { id: 'yue', name: '岳纫', title: '独立一师特种兵连长', faction: 'cpv', icon: '🗡️' },
  du:       { id: 'du', name: '杜乐辉', title: '独立一师特种兵连长', faction: 'cpv', icon: '🗡️' },
  zhengwei: { id: 'zhengwei', name: '老周', title: '独立一师政委', faction: 'cpv', icon: '📣' },
  peng:     { id: 'peng', name: '彭德怀', title: '志愿军司令员', faction: 'cpv', icon: '⭐' },
  deng:     { id: 'deng', name: '邓华', title: '志愿军副司令员', faction: 'cpv', icon: '⭐' },
  liang:    { id: 'liang', name: '梁兴初', title: '第38军军长', faction: 'cpv', icon: '⭐' },
  fan:      { id: 'fan', name: '范天恩', title: '第335团团长', faction: 'cpv', icon: '🎖️' },
  song:     { id: 'song', name: '宋时轮', title: '第9兵团司令员', faction: 'cpv', icon: '⭐' },
  yanggensi: { id: 'yanggensi', name: '杨根思', title: '第172团3连连长', faction: 'cpv', icon: '🎖️' },
  zeng:     { id: 'zeng', name: '曾泽生', title: '第50军军长', faction: 'cpv', icon: '⭐' },
  fuchongbi: { id: 'fuchongbi', name: '傅崇碧', title: '第63军军长', faction: 'cpv', icon: '⭐' },
  qin:      { id: 'qin', name: '秦基伟', title: '第15军军长', faction: 'cpv', icon: '⭐' },
  huang:    { id: 'huang', name: '黄继光', title: '第135团2营通信员', faction: 'cpv', icon: '🎖️' },
  yangyong: { id: 'yangyong', name: '杨勇', title: '第20兵团司令员', faction: 'cpv', icon: '⭐' },
  yangyucai: { id: 'yangyucai', name: '杨育才', title: '第607团侦察排副排长', faction: 'cpv', icon: '🗡️' },
  narrator: { id: 'narrator', name: '', title: '', faction: 'sys', icon: '📜' },
};

export function charName(id, playerName) {
  const c = CHARACTERS[id];
  if (!c) return id;
  return c.name.replace('{player}', playerName || '师长');
}
