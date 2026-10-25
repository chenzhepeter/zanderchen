// level.js — EP01 关卡数据：房间、墙体（程序化生成）、门、灯、物件、藏匿点、巡逻路线
// 坐标：西南角 (0,0)，X 向东，Y 向北，单位米。以设计文档 3.4 房间表坐标为权威。
import { RULESET as C } from './config.js';

// ---------- 区域 ----------
export const REGIONS = [
  { id: 'south', name: '南走廊', x: 0, y: 0, w: 48, h: 6, light: 'bright', floor: '#2e323b', canSwitch: false },
  { id: 'archive', name: '档案室', x: 0, y: 6, w: 12, h: 14, light: 'bright', floor: '#3a3028', canSwitch: true },
  { id: 'office', name: '开放办公区', x: 12, y: 6, w: 22, h: 14, light: 'bright', floor: '#32363e', canSwitch: true },
  { id: 'pantry', name: '茶水间', x: 34, y: 6, w: 6, h: 7, light: 'bright', floor: '#323939', canSwitch: true },
  { id: 'lobby', name: '前台', x: 40, y: 6, w: 8, h: 7, light: 'bright', floor: '#38352c', canSwitch: true },
  { id: 'meeting', name: '会议室', x: 34, y: 13, w: 14, h: 11, light: 'bright', floor: '#2e3640', canSwitch: true },
  { id: 'boss', name: '主管办公室', x: 0, y: 20, w: 14, h: 10, light: 'bright', floor: '#3a3128', canSwitch: true },
  { id: 'north', name: '北走廊', x: 14, y: 20, w: 20, h: 10, light: 'bright', floor: '#2e323b', canSwitch: true },
  { id: 'stair', name: '消防楼梯间', x: 34, y: 24, w: 14, h: 6, light: 'dim', floor: '#282c32', canSwitch: false },
];

export function regionAt(x, y) {
  for (const r of REGIONS) {
    if (x >= r.x - 0.02 && x <= r.x + r.w + 0.02 && y >= r.y - 0.02 && y <= r.y + r.h + 0.02) return r;
  }
  return null;
}

// ---------- 门 ----------
// axis 'v'=竖墙上的门（wall=x 坐标，at=门中心 y）；'h'=横墙上的门（wall=y，at=门中心 x）
// state: open / closed；kind: wood / keypad(D1) / exit(D6)
export const DOORS = [
  { id: 'D1', axis: 'v', wall: 12, at: 12, w: 1.4, kind: 'keypad', state: 'closed', locked: true, connects: ['archive', 'office'], name: '档案室门禁' },
  { id: 'D2', axis: 'h', wall: 6, at: 14, w: 1.4, kind: 'wood', state: 'open', connects: ['south', 'office'], name: '办公区木门' },
  { id: 'D3', axis: 'v', wall: 34, at: 12.25, w: 1.4, kind: 'wood', state: 'closed', connects: ['office', 'pantry'], name: '茶水间木门' },
  { id: 'D4', axis: 'h', wall: 6, at: 44, w: 1.4, kind: 'wood', state: 'open', connects: ['south', 'lobby'], name: '前台木门' },
  { id: 'D5', axis: 'h', wall: 20, at: 13, w: 1.4, kind: 'wood', state: 'closed', connects: ['office', 'boss'], name: '主管室木门' },
  { id: 'D5b', axis: 'v', wall: 14, at: 24, w: 1.4, kind: 'wood', state: 'closed', connects: ['boss', 'north'], name: '主管室东门' },
  { id: 'D6', axis: 'v', wall: 34, at: 27, w: 1.4, kind: 'exit', state: 'closed', locked: true, connects: ['north', 'stair'], name: '消防楼梯密码门' },
  { id: 'D7', axis: 'h', wall: 20, at: 20, w: 1.4, kind: 'wood', state: 'closed', connects: ['office', 'north'], name: '北走廊中门' },
  { id: 'D8', axis: 'v', wall: 34, at: 22, w: 1.6, kind: 'wood', state: 'closed', connects: ['north', 'meeting'], name: '会议室双开门' },
  { id: 'D8b', axis: 'v', wall: 34, at: 16, w: 1.6, kind: 'wood', state: 'closed', connects: ['office', 'meeting'], name: '会议室双开门' },
  { id: 'DP', axis: 'v', wall: 40, at: 9, w: 1.4, kind: 'wood', state: 'open', connects: ['pantry', 'lobby'], name: '茶水间内门' },
];

export function doorCenter(d) {
  return d.axis === 'v' ? { x: d.wall, y: d.at } : { x: d.at, y: d.wall };
}

// 关闭状态下的门作为墙段
export function doorSegment(d) {
  if (d.axis === 'v') return { x1: d.wall, y1: d.at - d.w / 2, x2: d.wall, y2: d.at + d.w / 2, mat: 'wood', door: d.id };
  return { x1: d.at - d.w / 2, y1: d.wall, x2: d.at + d.w / 2, y2: d.wall, mat: 'wood', door: d.id };
}

// ---------- 灯开关 ----------
export const LIGHT_SWITCHES = [
  { id: 'sw-archive', region: 'archive', x: 11.4, y: 6.7 },
  { id: 'sw-office1', region: 'office', x: 12.7, y: 19.3 },
  { id: 'sw-office2', region: 'office', x: 33.3, y: 6.7 },
  { id: 'sw-pantry', region: 'pantry', x: 34.5, y: 6.7 },
  { id: 'sw-lobby', region: 'lobby', x: 47.3, y: 6.7 },
  { id: 'sw-meeting', region: 'meeting', x: 34.5, y: 13.7 },
  { id: 'sw-boss', region: 'boss', x: 0.6, y: 20.7 },
  { id: 'sw-north', region: 'north', x: 14.6, y: 29.3 },
  { id: 'sw-south', region: 'south', x: 0.6, y: 0.7 },
];

// ---------- 障碍物 ----------
// 半高：碰撞 + 蹲伏半身遮挡（站立时仍被看见）
export const LOW_BLOCKERS = [
  // 开放办公区 8 个半高隔间（两排，列间留 1.7m 过道，G2 环线圈在 x16-28 / y8-16 之外）
  { x: 15.2, y: 10.4, w: 1.5, h: 1.2, kind: 'cubicle' },
  { x: 18.4, y: 10.4, w: 1.5, h: 1.2, kind: 'cubicle' },
  { x: 21.6, y: 10.4, w: 1.5, h: 1.2, kind: 'cubicle' },
  { x: 24.8, y: 10.4, w: 1.5, h: 1.2, kind: 'cubicle' },
  { x: 15.2, y: 13.4, w: 1.5, h: 1.2, kind: 'cubicle' },
  { x: 18.4, y: 13.4, w: 1.5, h: 1.2, kind: 'cubicle' },
  { x: 21.6, y: 13.4, w: 1.5, h: 1.2, kind: 'cubicle' },
  { x: 24.8, y: 13.4, w: 1.5, h: 1.2, kind: 'cubicle' },
  { x: 25.2, y: 13.5, w: 1.5, h: 1.0, kind: 'desk' }, // H5 矮桌
  { x: 7.2, y: 23.4, w: 2.4, h: 1.3, kind: 'desk' }, // 主管桌（H1）
  { x: 42.5, y: 6.8, w: 3.2, h: 1.2, kind: 'desk' }, // 前台接待台
];

// 高柜：完全遮挡视线与移动（生成墙环）
export const HIGH_BLOCKERS = [
  { x: 0.4, y: 7.8, w: 0.8, h: 2.0, kind: 'cabinet' },
  { x: 0.4, y: 10.2, w: 0.8, h: 2.0, kind: 'cabinet' },
  { x: 0.4, y: 12.6, w: 0.8, h: 2.0, kind: 'cabinet' },
  { x: 0.4, y: 15.0, w: 0.8, h: 2.0, kind: 'cabinet' },
  { x: 1.2, y: 17.3, w: 1.2, h: 1.4, kind: 'locker' }, // H2 铁柜
  { x: 1.2, y: 27.6, w: 1.8, h: 0.9, kind: 'cabinet' }, // 主管室上锁文件柜
  { x: 34.5, y: 10.2, w: 1.0, h: 2.0, kind: 'locker' }, // H3 储物柜
  { x: 9.2, y: 26.5, w: 1.8, h: 0.9, kind: 'cabinet' }, // 主管室北墙矮柜（N1 显示器）
];

// ---------- 藏匿点 ----------
export const HIDING_SPOTS = [
  { id: 'H1', x: 8.4, y: 24.05, name: '主管桌下', region: 'boss' },
  { id: 'H2', x: 1.8, y: 18, name: '铁柜', region: 'archive' },
  { id: 'H3', x: 35, y: 11.2, name: '储物柜', region: 'pantry' },
  { id: 'H4', x: 19.1, y: 11, name: '隔间桌下', region: 'office' },
  { id: 'H5', x: 25.9, y: 14, name: '桌下', region: 'office' },
];

// ---------- 交互物 ----------
export const INTERACTABLES = [
  { id: 'box', kind: 'box', x: 4, y: 4.2, name: '纸箱' },
  { id: 'can1', kind: 'can', x: 24, y: 9.8, name: '易拉罐' },
  { id: 'can2', kind: 'can', x: 38, y: 12.1, name: '易拉罐' },
  { id: 'key', kind: 'key', x: 35, y: 7.1, name: '工服挂钩上的小钥匙' },
  { id: 'n2', kind: 'clue', x: 39, y: 12.4, clue: 'n2', name: '墙上的日历' },
  { id: 'n1', kind: 'clue', x: 10, y: 27, clue: 'n1', name: '显示器上的便利贴' },
  { id: 'n3', kind: 'clue', x: 42, y: 18.1, clue: 'n3', name: '会议室白板' },
  { id: 'drawer', kind: 'drawer', x: 2.1, y: 28.05, name: '上锁的文件柜抽屉' },
  { id: 'usb', kind: 'usb', x: 6, y: 18, name: '重量感应底座' },
  { id: 'microwave', kind: 'microwave', x: 37.4, y: 6.75, name: '微波炉' },
  { id: 'tD1', kind: 'terminal', x: 12.9, y: 12, door: 'D1', name: '档案室门禁终端' },
  { id: 'tD6', kind: 'terminal', x: 33.2, y: 27, door: 'D6', name: '消防门密码键盘' },
];

// ---------- 巡逻路线 ----------
// face: 0=东 90=北 180=西 -90=南；wait 为节点停顿秒数
export const PATROLS = [
  {
    id: 'G1', name: '老周', color: '#7aa5e8',
    pingpong: true,
    route: [
      { x: 16, y: 25, wait: 2, face: 180 },
      { x: 30, y: 25, wait: 2, face: 0 },
      { x: 33, y: 22, wait: 4, face: 180 },
    ],
  },
  {
    id: 'G2', name: '小吴', color: '#8bd08b',
    loop: true,
    // 矩形外圈：西侧 x14 拐点绕开半高隔间（隔间从 x15.2 起）
    route: [
      { x: 20, y: 8, wait: 1.5, face: -90 },
      { x: 28, y: 8, wait: 1.5 },
      { x: 28, y: 16, wait: 1.5 },
      { x: 16, y: 16, wait: 1.5 },
      { x: 14, y: 16, wait: 0 },
      { x: 14, y: 8, wait: 0 },
    ],
  },
  {
    id: 'G3', name: '胖子', color: '#e0a86a',
    loop: true,
    // (44,3) 拐点保证从 D4 门洞（x43.3-44.7）穿过南走廊/前台隔墙
    route: [
      { x: 8, y: 3, wait: 1, face: 180 },
      { x: 28, y: 3, wait: 1 },
      { x: 44, y: 3, wait: 0 },
      { x: 44, y: 9, wait: 1 },
      { x: 40, y: 9, wait: 0 },
      { x: 36, y: 9, wait: 3 },
      { x: 40, y: 9, wait: 0 },
      { x: 44, y: 9, wait: 0 },
      { x: 44, y: 3, wait: 0 },
      { x: 28, y: 3, wait: 0 },
    ],
  },
];

// 检查点 1（D1 打开）时的有利相位：G1 N1b 朝东、G2 (20,8) 朝南、G3 N3a 朝西
export const PHASE_RESET = {
  G1: { x: 30, y: 25, nodeIndex: 1, dir: 1, face: 0, hold: 1.2 },
  G2: { x: 20, y: 8, nodeIndex: 0, dir: 1, face: -90, hold: 1.5 },
  G3: { x: 8, y: 3, nodeIndex: 0, dir: 1, face: 180, hold: 1.2 },
};

export const SPAWN = { x: 4, y: 1.5, angle: 90 };

// ---------- 墙体程序化生成 ----------
function buildWalls() {
  const hSegs = [];
  const vSegs = [];
  const addH = (x1, x2, y, mat) => hSegs.push({ x1: Math.min(x1, x2), x2: Math.max(x1, x2), y, mat });
  const addV = (x, y1, y2, mat) => vSegs.push({ x, y1: Math.min(y1, y2), y2: Math.max(y1, y2), mat });

  for (const r of REGIONS) {
    const matSouth = r.y === 0 ? 'concrete' : 'wood';
    const matNorth = r.y + r.h === C.MAP_H ? 'concrete' : 'wood';
    const matWest = r.x === 0 ? 'concrete' : 'wood';
    const matEast = r.x + r.w === C.MAP_W ? 'concrete' : 'wood';
    addH(r.x, r.x + r.w, r.y, matSouth);
    addH(r.x, r.x + r.w, r.y + r.h, matNorth);
    addV(r.x, r.y, r.y + r.h, matWest);
    addV(r.x + r.w, r.y, r.y + r.h, matEast);
  }

  // 高柜生成墙环
  for (const b of HIGH_BLOCKERS) {
    addH(b.x, b.x + b.w, b.y, 'wood');
    addH(b.x, b.x + b.w, b.y + b.h, 'wood');
    addV(b.x, b.y, b.y + b.h, 'wood');
    addV(b.x + b.w, b.y, b.y + b.h, 'wood');
  }

  const mergeH = (list) => {
    const groups = {};
    for (const s of list) (groups[s.y] ||= []).push(s);
    const out = [];
    for (const y of Object.keys(groups)) {
      const arr = groups[y].sort((a, b) => a.x1 - b.x1);
      let cur = { ...arr[0] };
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].x1 <= cur.x2 + 0.001) cur.x2 = Math.max(cur.x2, arr[i].x2);
        else { out.push(cur); cur = { ...arr[i] }; }
      }
      out.push(cur);
    }
    return out;
  };
  const mergeV = (list) => {
    const groups = {};
    for (const s of list) (groups[s.x] ||= []).push(s);
    const out = [];
    for (const x of Object.keys(groups)) {
      const arr = groups[x].sort((a, b) => a.y1 - b.y1);
      let cur = { ...arr[0] };
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].y1 <= cur.y2 + 0.001) cur.y2 = Math.max(cur.y2, arr[i].y2);
        else { out.push(cur); cur = { ...arr[i] }; }
      }
      out.push(cur);
    }
    return out;
  };

  let h = mergeH(hSegs);
  let v = mergeV(vSegs);

  // 切门洞
  const cutH = (y, cx, w) => {
    const a = cx - w / 2, b = cx + w / 2;
    for (let i = 0; i < h.length; i++) {
      const s = h[i];
      if (Math.abs(s.y - y) < 0.001 && s.x1 <= a + 0.01 && s.x2 >= b - 0.01) {
        const out = [];
        if (a - s.x1 > 0.02) out.push({ ...s, x2: a });
        if (s.x2 - b > 0.02) out.push({ ...s, x1: b });
        h.splice(i, 1, ...out);
        return;
      }
    }
  };
  const cutV = (x, cy, w) => {
    const a = cy - w / 2, b = cy + w / 2;
    for (let i = 0; i < v.length; i++) {
      const s = v[i];
      if (Math.abs(s.x - x) < 0.001 && s.y1 <= a + 0.01 && s.y2 >= b - 0.01) {
        const out = [];
        if (a - s.y1 > 0.02) out.push({ ...s, y2: a });
        if (s.y2 - b > 0.02) out.push({ ...s, y1: b });
        v.splice(i, 1, ...out);
        return;
      }
    }
  };

  for (const d of DOORS) {
    if (d.axis === 'h') cutH(d.wall, d.at, d.w);
    else cutV(d.wall, d.at, d.w);
  }

  const walls = [
    ...h.map((s) => ({ x1: s.x1, y1: s.y, x2: s.x2, y2: s.y, mat: s.mat })),
    ...v.map((s) => ({ x1: s.x, y1: s.y1, x2: s.x, y2: s.y2, mat: s.mat })),
  ];
  return walls;
}

export const WALLS = buildWalls();

// 房间邻接图（用于敌人寻路）
export function buildRoomGraph() {
  const graph = {};
  for (const r of REGIONS) graph[r.id] = [];
  for (const d of DOORS) {
    const [a, b] = d.connects;
    graph[a].push({ region: b, door: d.id });
    graph[b].push({ region: a, door: d.id });
  }
  return graph;
}

export const ROOM_GRAPH = buildRoomGraph();
