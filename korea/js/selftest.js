// 规则/寻路/AI 冒烟自测：node korea/js/selftest.js [关卡号] [种子]
// 让双方都由 AI 自动打完每一关，检查不抛异常、数值不出 NaN、胜负能判定。
import { loadLevel, initialRoster } from './data/campaign.js';
import { UNIT_TYPES } from './data/units.js';
import * as Battle from './engine/battle.js';
import { autoPlaySide } from './engine/ai.js';
import { computeReach } from './engine/grid.js';

const argLevel = process.argv[2] ? +process.argv[2] : 0;
const argSeed = process.argv[3] ? +process.argv[3] : 7;
let fail = 0;
const check = (cond, msg) => { if (!cond) { fail++; console.log('  ✗', msg); } };

Battle.bindHost({
  log: () => {}, say: async () => {}, refresh: () => {}, anim: async () => {}, onEnd: () => {}, toast: () => {}, mapChanged: () => {},
});

async function runLevel(num, seed) {
  const level = await loadLevel(num);
  const roster = initialRoster('inf', '测试师长').map(r => ({ ...r, men: UNIT_TYPES[r.type].men, weapons: [...UNIT_TYPES[r.type].weapons], gear: [], items: [], tactics: [...(UNIT_TYPES[r.type].tactics || []), ...(r.tactics || [])] }));
  const B = Battle.startBattle(level, { roster, playerName: '测试师长', heroStats: { cmd: 2, intel: 2 }, seed });
  Battle.autoDeploy();
  const deployed = B.units.filter(u => u.roster).length;
  check(deployed > 0 && deployed <= level.maxDeploy, `${level.key} 部署数量 ${deployed}`);
  const t0 = Date.now();
  await Battle.finishDeploy();
  let guard = 0;
  while (B.phase !== 'over' && guard++ < 60) {
    // 测试寻路：每支我方部队算一次可达
    for (const u of B.units) if (u.side === 'p' && u.alive && !u.offmap) computeReach(B.map, u, B.units, u.mp, B.objs);
    await autoPlaySide(B, Battle.debugApi, 'p');
    if (B.phase === 'over') break;
    await Battle.endPlayerTurn();
  }
  for (const u of B.units) {
    for (const k of ['men', 'wounded', 'morale', 'fatigue', 'ammo', 'xp', 'level']) check(Number.isFinite(u[k]), `${level.key} ${u.name}.${k} = ${u[k]}`);
    check(u.wounded <= u.men, `${level.key} ${u.name} 伤员 ${u.wounded} > 人数 ${u.men}`);
  }
  check(B.phase === 'over', `${level.key} 未在 ${guard} 轮内结束`);
  const r = B.result || {};
  const ser = Battle.serializeBattle();
  check(JSON.stringify(ser).length > 100, `${level.key} 序列化`);
  console.log(`${level.key} ${level.title.padEnd(14)} seed=${seed} → ${r.win ? '胜' : '负'}(${r.reason || ''}) 回合 ${B.turn}/${level.turns} 歼敌 ${B.stats.enemyCas} 我方阵亡 ${B.stats.ownKilled} 敌军被歼 ${B.stats.enemyUnitsKilled} 逃脱 ${B.stats.escaped} 得分 ${r.score} 用时 ${Date.now() - t0}ms`);
}

const nums = argLevel ? [argLevel] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
for (const n of nums) {
  try { await runLevel(n, argSeed); }
  catch (e) { fail++; console.log(`L${String(n).padStart(2, '0')} 异常:`, e.stack || e); }
}
console.log(fail ? `\n${fail} 个问题` : '\n全部通过');
process.exit(fail ? 1 : 0);
