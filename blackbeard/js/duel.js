// 一騎打ち（照《大航海时代2》原版规格重做）
//
// 每回合双方同时决定「攻击招式」与「防御架势」，各三选项，按 3×3 相克表判定：
//            受ける    払う     よける
//   斬る      無傷     通常     大伤
//   突く      大伤     無傷     通常
//   強打      通常     大伤     無傷
//
// 体力是一条**共用的拉锯槽**（原版最独特的手感）：命中不是单纯扣血，
// 而是把中间那条界线朝对方推——你打中他，你自己的那一段就变长。
// 界线推到任一端即分胜负；10 回合仍未分出 → 平局，回到海战。
// 败不致死：输了只是重伤（HP 落到 15）。
import { state, playerAtk, playerDef } from './state.js';

// 招式（攻）
export const MOVES = {
  slash: { id: 'slash', name: '斬', icon: '🗡️', full: '斬る', power: 1.0, stam: 18, safeVs: 'parry', bigVs: 'dodge', desc: '横向劈砍，最稳的一招' },
  thrust: { id: 'thrust', name: '突', icon: '🤺', full: '突く', power: 0.9, stam: 14, safeVs: 'sweep', bigVs: 'parry', desc: '直线突刺，快而省力' },
  smash: { id: 'smash', name: '強打', icon: '💥', full: '強打', power: 1.35, stam: 26, safeVs: 'dodge', bigVs: 'sweep', desc: '全力一击，极耗气力' },
};
// 架势（守）
export const GUARDS = {
  parry: { id: 'parry', name: '受', icon: '🛡️', full: '受ける', stam: 8, desc: '用刀身硬接——挡得住劈砍，怕刺' },
  sweep: { id: 'sweep', name: '払', icon: '↔️', full: '払う', stam: 7, desc: '拨开来刃——化得掉突刺，怕重击' },
  dodge: { id: 'dodge', name: '避', icon: '💨', full: 'よける', stam: 10, desc: '侧身闪避——躲得开重击，怕横砍' },
};
export const MOVE_ORDER = ['slash', 'thrust', 'smash'];
export const GUARD_ORDER = ['parry', 'sweep', 'dodge'];

// 三档结果
const TIER = { none: { k: 'none', mult: 0, name: '無傷' }, normal: { k: 'normal', mult: 1.0, name: '通常' }, big: { k: 'big', mult: 1.85, name: '大伤' } };
export function tierOf(move, guard) {
  const m = MOVES[move];
  if (m.safeVs === guard) return TIER.none;
  if (m.bigVs === guard) return TIER.big;
  return TIER.normal;
}

export const GAUGE_MAX = 120;      // 拉锯槽总长；玩家占 gauge，对手占 GAUGE_MAX-gauge
                                   // 定这么短是为了让 10 回合内多半能分出胜负（原版决斗很少拖到平局）
const MAX_ROUNDS = 10;

let D = null, onEndCb = null;

// foeSkill 决定对手的攻防与 AI 精度；foePower 可由接舷战力直接传入
export function startDuel({ foeName, foeSkill = 1, foeAtk = null, foeDef = null, onEnd }) {
  onEndCb = onEnd;
  const hpFrac = state.player.hp / state.player.hpMax;
  D = {
    foeName,
    // 起始界线：带伤上阵就先输一截（最多让出 24）
    gauge: Math.round(GAUGE_MAX / 2 + (hpFrac - 1) * 24),
    hpStart: state.player.hp,
    p: { stam: 100, stamMax: 100, pistol: true, atk: playerAtk(), def: playerDef() },
    f: {
      stam: 100, stamMax: 100, pistol: Math.random() < 0.4, skill: foeSkill,
      atk: foeAtk ?? (10 + foeSkill * 4), def: foeDef ?? (3 + foeSkill * 3),
    },
    recent: [],                    // 玩家最近的招式，供对手记忆
    move: 'slash', guard: 'parry',
    log: ['跳板搭上，两船撞在一起——甲板上只剩下你和他。'],
    round: 1, over: false, result: null,
  };
  document.getElementById('duel').classList.remove('hidden');
  render();
}

// 设定本回合的招式与架势（按钮与自动化测试共用同一入口）
export function setChoice(move, guard) {
  if (!D || D.over) return false;
  if (MOVES[move]) D.move = move;
  if (GUARDS[guard]) D.guard = guard;
  return true;
}
export function duelSnapshot() {
  return D ? { gauge: D.gauge, round: D.round, over: D.over, result: D.result, pStam: D.p.stam, fStam: D.f.stam } : null;
}

const exhausted = x => x.stam < 15;

// 伤害：招式威力 × 攻击值 × 档位 ×（1 − 铠甲减免）
export function damage(atkVal, defVal, move, tier, tired = false, foeTired = false) {
  if (!tier.mult) return 0;
  let d = (6 + atkVal) * MOVES[move].power * tier.mult;
  d *= 1 - defVal / (defVal + 45);       // 铠甲/剑技减伤，递减收益
  if (tired) d *= 0.55;                   // 自己力竭，出招绵软
  if (foeTired) d *= 1.25;                // 对方力竭，破绽大
  return Math.max(1, Math.round(d));
}

// 对手 AI：带记忆。统计玩家最近 3 手，对高频招式加权选出对应的克制架势。
function foeChoose() {
  const f = D.f;
  // 防御：基础均等 + 记忆加权（技能越高越会读招）
  const w = { parry: 1, sweep: 1, dodge: 1 };
  const counterOf = { slash: 'parry', thrust: 'sweep', smash: 'dodge' };
  for (const m of D.recent) w[counterOf[m]] += 0.9 + f.skill * 0.35;
  let guard = weighted(w);

  // 进攻：力竭时改用省力的突刺；血线落后时搏命重击
  const behind = D.gauge > GAUGE_MAX * 0.6;
  let move;
  if (exhausted(f)) move = Math.random() < 0.75 ? 'thrust' : 'slash';
  else if (behind && Math.random() < 0.45) move = 'smash';
  else move = MOVE_ORDER[(Math.random() * 3) | 0];
  return { move, guard };
}
function weighted(w) {
  const keys = Object.keys(w);
  let r = Math.random() * keys.reduce((a, k) => a + w[k], 0);
  for (const k of keys) { r -= w[k]; if (r <= 0) return k; }
  return keys[0];
}

function shift(n) {   // n>0 玩家推进
  D.gauge = Math.max(0, Math.min(GAUGE_MAX, D.gauge + n));
}

function play() {
  if (!D || D.over) return;
  const my = { move: D.move, guard: D.guard };
  const fo = foeChoose();

  D.recent.unshift(my.move);
  if (D.recent.length > 3) D.recent.length = 3;

  const pTired = exhausted(D.p), fTired = exhausted(D.f);
  D.p.stam = Math.max(0, Math.min(D.p.stamMax, D.p.stam - MOVES[my.move].stam - GUARDS[my.guard].stam + 14));
  D.f.stam = Math.max(0, Math.min(D.f.stamMax, D.f.stam - MOVES[fo.move].stam - GUARDS[fo.guard].stam + 14));

  const tA = tierOf(my.move, fo.guard);          // 我打他
  const tB = tierOf(fo.move, my.guard);          // 他打我
  const dA = damage(D.p.atk, D.f.def, my.move, tA, pTired, fTired);
  const dB = damage(D.f.atk, D.p.def, fo.move, tB, fTired, pTired);

  let msg = `<span class="d-hd">第 ${D.round} 回合</span> 你【${MOVES[my.move].full} / ${GUARDS[my.guard].full}】　他【${MOVES[fo.move].full} / ${GUARDS[fo.guard].full}】<br>`;
  msg += tA.mult
    ? `<b class="good">你的${MOVES[my.move].full}${tA.k === 'big' ? '结结实实打了进去' : '划开一道口子'}——${tA.name} ${dA}。</b> `
    : `<span class="d-blk">你的${MOVES[my.move].full}被他${GUARDS[fo.guard].full}化掉了。</span> `;
  msg += tB.mult
    ? `<b class="bad">他的${MOVES[fo.move].full}${tB.k === 'big' ? '重重砸在你身上' : '擦过你'}——${tB.name} ${dB}。</b>`
    : `<span class="d-blk">他的${MOVES[fo.move].full}被你${GUARDS[my.guard].full}挡下。</span>`;
  if (!tA.mult && !tB.mult) msg += '<br>两人各退半步，谁也没占到便宜——只是白费了力气。';

  shift(dA - dB);

  if (exhausted(D.p) && !pTired) msg += '<br><b class="bad">你的手臂在发抖——力竭了。</b>';
  if (exhausted(D.f) && !fTired) msg += '<br><span class="good">他的呼吸乱了——他也撑不住了。</span>';

  D.log.unshift(msg);
  if (D.log.length > 4) D.log.length = 4;
  D.round++;

  // 对手的短铳：落后时孤注一掷
  if (D.f.pistol && D.gauge > GAUGE_MAX * 0.68 && Math.random() < 0.5) {
    D.f.pistol = false;
    shift(-(12 + D.f.skill * 2));
    D.log.unshift('<b class="bad">砰！他掏出腰间的短铳开了一枪。</b>');
  }
  checkOver();
  render();
}

function usePistol() {
  if (!D || !D.p.pistol || D.over) return;
  D.p.pistol = false;
  const d = 12 + state.player.skills.combat * 2 + Math.round(D.p.atk * 0.3);
  shift(d);
  D.log.unshift(`<b class="good">砰！你抽出腰间的短铳，近距离一枪把他打退了 ${d}。</b>`);
  checkOver();
  render();
}

function checkOver() {
  if (D.gauge >= GAUGE_MAX) { D.over = true; D.result = 'win'; }
  else if (D.gauge <= 0) { D.over = true; D.result = 'lose'; }
  else if (D.round > MAX_ROUNDS) {
    // 10 回合未分胜负：按界线偏向判个平局（原版即回到海战）
    D.over = true; D.result = 'draw';
  }
}

function finish() {
  const res = D.result;
  const hpMax = state.player.hpMax;
  if (res === 'lose') {
    state.player.hp = 15;                                    // 败不致死，只是重伤
  } else {
    // 拉锯槽折回体力：赢不至于满血复活，上限是入场时的体力
    state.player.hp = Math.max(15, Math.min(D.hpStart, Math.round(hpMax * D.gauge / GAUGE_MAX)));
  }
  if (res === 'win') state.player.exp += 8;
  else if (res === 'draw') state.player.exp += 3;
  document.getElementById('duel').classList.add('hidden');
  D = null;
  onEndCb && onEndCb(res);
}

function render() {
  const el = document.getElementById('duel-body');
  if (!D) return;
  if (D.over) {
    const txt = {
      win: ['⚔️ 你赢了', '对方的刀掉在甲板上。他退后一步，举起了双手。'],
      lose: ['💀 你倒下了', '视野发黑，你被拖回了自己的船——但还活着。'],
      draw: ['🤝 谁也没能压倒谁', '十个回合过去，两人都喘得说不出话。刀锋撤开，战斗回到船与船之间。'],
    }[D.result];
    el.innerHTML = `<div class="duel-end"><h2>${txt[0]}</h2><p>${txt[1]}</p>
      <button class="primary-btn" id="duel-ok">继续</button></div>`;
    document.getElementById('duel-ok').addEventListener('click', finish);
    return;
  }

  const mine = D.gauge, foe = GAUGE_MAX - D.gauge;
  const tug = `<div class="duel-tug" title="共用体力槽：打中对方，界线就朝他那边推">
      <i class="tug-p" style="width:${mine / GAUGE_MAX * 100}%"></i>
      <i class="tug-f" style="width:${foe / GAUGE_MAX * 100}%"></i>
      <span class="tug-n l">${mine}</span><span class="tug-n r">${foe}</span>
    </div>`;
  const stam = (who, cls) => `<div class="dbar st"><i class="${cls}" style="width:${who.stam}%"></i></div>`;

  // 相克提示表：让玩家看得见规则（原版也是明规则）
  const table = `<table class="duel-mx"><tr><th></th>${GUARD_ORDER.map(g => `<th>${GUARDS[g].icon}${GUARDS[g].name}</th>`).join('')}</tr>
    ${MOVE_ORDER.map(m => `<tr class="${D.move === m ? 'on' : ''}"><th>${MOVES[m].icon}${MOVES[m].name}</th>
      ${GUARD_ORDER.map(g => { const t = tierOf(m, g); return `<td class="t-${t.k}">${t.name}</td>`; }).join('')}</tr>`).join('')}
  </table>`;

  el.innerHTML = `
    <div class="duel-head">
      <div class="dname">你 · ${state.player.name}<span class="small muted"> 🗡️${D.p.atk} 🛡️${D.p.def}</span></div>
      <div class="dround">第 ${D.round} / ${MAX_ROUNDS} 回合</div>
      <div class="dname foe">${D.foeName}<span class="small muted"> 🗡️${D.f.atk} 🛡️${D.f.def}</span></div>
    </div>
    ${tug}
    <div class="duel-stam">
      <div>${stam(D.p, 'p')}<span class="small">耐力 ${Math.round(D.p.stam)}${exhausted(D.p) ? ' · <b class="bad">力竭</b>' : ''}</span></div>
      <div>${stam(D.f, 'f')}<span class="small">对手耐力 ${Math.round(D.f.stam)}${exhausted(D.f) ? ' · <b class="good">力竭</b>' : ''}</span></div>
    </div>
    <div class="duel-pick">
      <div class="dp-col">
        <div class="dp-head">🗡️ 招式<span class="muted">（耗气力多）</span></div>
        ${MOVE_ORDER.map(m => `<button class="dzone atk${D.move === m ? ' on' : ''}" data-move="${m}">
          <span class="dz-i">${MOVES[m].icon}</span><b>${MOVES[m].full}</b>
          <span class="small muted">威力 ×${MOVES[m].power} · 气 −${MOVES[m].stam}</span>
          <span class="small">${MOVES[m].desc}</span></button>`).join('')}
      </div>
      <div class="dp-col">
        <div class="dp-head">🛡️ 架势<span class="muted">（同时决定）</span></div>
        ${GUARD_ORDER.map(g => `<button class="dzone def${D.guard === g ? ' on' : ''}" data-guard="${g}">
          <span class="dz-i">${GUARDS[g].icon}</span><b>${GUARDS[g].full}</b>
          <span class="small muted">气 −${GUARDS[g].stam}</span>
          <span class="small">${GUARDS[g].desc}</span></button>`).join('')}
      </div>
    </div>
    ${table}
    <div class="duel-go">
      <button class="primary-btn big" id="duel-fight">⚔️ 出招（${MOVES[D.move].full} / ${GUARDS[D.guard].full}）</button>
      <button class="ghost-btn" id="duel-pistol" ${D.p.pistol ? '' : 'disabled'}>🔫 短铳（每场一次）</button>
    </div>
    <div class="duel-log">${D.log.map(l => `<div>${l}</div>`).join('')}</div>`;

  el.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => { D.move = b.dataset.move; render(); }));
  el.querySelectorAll('[data-guard]').forEach(b => b.addEventListener('click', () => { D.guard = b.dataset.guard; render(); }));
  document.getElementById('duel-fight').addEventListener('click', play);
  const pb = document.getElementById('duel-pistol');
  if (pb) pb.addEventListener('click', usePistol);
}
