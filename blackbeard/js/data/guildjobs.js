// 公会委托模板（照原版《大航海时代2》的工作表）
//   仕事      報酬          期限    必要名声
//   手紙配達  700          1月     交易50
//   商品輸送  1000-30000   1-3月   交易200
//   商品購入  2000         1月     交易200
//   借金取立  5000         1月     海賊150・冒険300
//   海賊退治  —            1月     —
// 每次进公会按模板 + 当前港口随机生成若干条，复用 quests.js 的任务引擎结算。
import { PORTS, PORT_BY_ID } from './ports.js';
import { GOODS, GOOD_BY_ID } from './goods.js';

export const JOB_TEMPLATES = [
  {
    type: 'letter', name: '书信投递', icon: '✉️',
    reward: [600, 900], deadlineMonths: 1,
    fameReq: { trade: 50 },
    fameGain: { trade: 8 },
    failPenalty: { trade: -10 },
    desc: (p) => `把一封加急信件送到 ${p.name}。`,
  },
  {
    type: 'haul', name: '商品运输', icon: '📦',
    reward: [1000, 30000], deadlineMonths: [1, 3],
    fameReq: { trade: 200 },
    fameGain: { trade: 25 },
    failPenalty: { trade: -10 },
    desc: (p, g, q) => `把 ${g.name} ×${q} 运到 ${p.name} 交割。`,
  },
  {
    type: 'buy', name: '商品采购', icon: '🛒',
    reward: [1800, 2600], deadlineMonths: 1,
    fameReq: { trade: 200 },
    fameGain: { trade: 12 },
    failPenalty: { trade: -10 },
    desc: (p, g, q) => `替公会采购 ${g.name} ×${q}，运回本港。`,
  },
  {
    type: 'debt', name: '借款催收', icon: '💰',
    reward: [4500, 5500], deadlineMonths: 1,
    fameReq: { battle: 150, adventure: 300 },
    fameGain: { trade: 10, battle: 10 },
    failPenalty: { trade: -10, battle: -10 },
    desc: (p) => `有个老赖躲在 ${p.name}。去把钱要回来——用什么办法公会不管。`,
  },
  {
    type: 'hunt', name: '海盗讨伐', icon: '⚔️',
    reward: [3000, 9000], deadlineMonths: 1,
    fameReq: { battle: 100 },
    fameGain: { battle: 30 },
    failPenalty: { battle: -10 },
    desc: (n) => `附近海域有劫掠者作乱。击沉或俘获 ${n} 艘，公会付赏金。`,
  },
];

const pick = a => a[(Math.random() * a.length) | 0];
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const rrange = v => Array.isArray(v) ? rint(v[0], v[1]) : v;

// 依当前港口生成一批可接委托（转成 quests.js 认识的任务对象）
export function generateJobs(portId, seedCount = 4) {
  const here = PORT_BY_ID[portId];
  if (!here) return [];
  // 目的港：优先取较近的其他港口，让期限有意义
  const others = PORTS.filter(p => p.id !== portId && !p.anchorageOnly);
  const out = [];
  for (let i = 0; i < seedCount; i++) {
    const t = pick(JOB_TEMPLATES);
    const dest = pick(others);
    const good = pick(GOODS.filter(g => g.basePrice <= 130));
    const qty = rint(10, 40);
    const months = rrange(t.deadlineMonths);
    const id = `job_${t.type}_${portId}_${i}_${Date.now().toString(36).slice(-4)}`;

    let objective, desc, gold = rrange(t.reward);
    if (t.type === 'letter') {
      objective = { type: 'arrive', port: dest.id };
      desc = t.desc(dest);
    } else if (t.type === 'haul') {
      objective = { type: 'deliver', good: good.id, qty, port: dest.id };
      desc = t.desc(dest, good, qty);
      gold = Math.round(good.basePrice * qty * 1.6 + 800);   // 报酬随货值浮动
    } else if (t.type === 'buy') {
      objective = { type: 'deliver', good: good.id, qty, port: portId };
      desc = t.desc(here, good, qty);
      gold = Math.round(good.basePrice * qty * 1.35 + 500);
    } else if (t.type === 'debt') {
      objective = { type: 'arrive', port: dest.id };
      desc = t.desc(dest);
    } else {
      const n = rint(1, 2);
      objective = { type: 'defeat', count: n, kind: 'patrol' };
      desc = t.desc(n);
      gold = 3000 * n + rint(0, 2000);
    }

    out.push({
      id, kind: 'job', jobType: t.type,
      title: `${t.icon} ${t.name}`,
      desc,
      objective,
      deadlineMonths: months,
      fameReq: t.fameReq,
      failPenalty: t.failPenalty,
      reward: { gold, exp: 6, fame: t.fameGain },
      guildPort: portId,
      doneText: '公会的老人数出赏金，在名册上划掉了你的名字。',
    });
  }
  return out;
}
