// 计谋牌组战斗。
// 敌人有两条血：hp 生命 / menos 气焰。红牌打 hp，蓝绿牌打 menos。
// 气焰破 → 破绽 2 回合（跳过意图、受伤翻倍），气焰随即回满，可以反复破。
// 破满 yieldAt 次而 hp 未清零 → 敌人屈服 = 非致命胜利（更少傲慢、更多名声）。
import { state, handSize, saveGame } from './state.js';
import { CARDS } from './data/cards.js';
import { ENEMIES } from './data/enemies.js';
import { buildPiles, drawCards, discardHand, leaveHand } from './deck.js';
import { removeOneCard, purgeOneWrath } from './story.js';
import { drawMonster, drawHero } from './art/monster.js';
import { drawScene, W, H } from './art/scene.js';
import { fitCover, PAL, OUTLINE, roundRect, outlinedText, poly } from './art/common.js';
import { cardHTML, paintCardArts } from './art/card.js';

const $ = (s, r = document) => r.querySelector(s);

let HOST = null;
export function bindHost(h) { HOST = h; }

let B = null, raf = 0, t0 = 0;

const INTENT_ICON = { attack: '⚔️', heavy: '💢', roar: '📢', summon: '🫧', guard: '🛡️' };
const INTENT_TEXT = {
  attack: (v) => `攻击 ${v}`,
  heavy: (v) => `蓄力（下回合 ${v}）`,
  roar: (v) => `咆哮（削格挡 ${v}，你下回合少抽 1 张）`,
  summon: (v) => `气焰回复 ${v}`,
  guard: () => '戒备（气焰伤害减半）',
};

export function startBattle({ enemyId, bg, onDone }) {
  const def = ENEMIES[enemyId];
  if (!def) { console.warn('未知敌人', enemyId); onDone?.({ win: true, lethal: false }); return; }
  B = {
    def, onDone, bg: bg || state.scene || 'beach_day',
    e: {
      hp: def.hp, hpMax: def.hp, menos: def.menos, menosMax: def.menos,
      open: 0, broken: 0, intent: null, pending: null, iIdx: -1,
      guard: false, hitFlash: 0, blinded: false, phase2: false,
    },
    hero: { hp: state.player.hp, hpMax: state.player.hpMax, block: 0, hitFlash: 0 },
    piles: buildPiles(state.deck),
    thumos: 0, thumosMax: 3, thumosNext: 0, drawPenalty: 0,
    turn: 0, over: false, busy: false,
    tf: {},                                   // 本回合标记
    perm: { regenBlock: 0, falsename: false, veil: false, moly: false },
    kleosGain: 0,
    msg: '',
  };
  $('#battle-screen').classList.remove('hidden');
  startLoop();
  pickIntent();
  startTurn();
}

// ===== 回合 =====
function startTurn() {
  const b = B;
  b.turn++;
  b.tf = {};
  b.hero.block = b.perm.regenBlock;            // 格挡回合初重置；立誓每回合白送几点
  b.thumos = b.thumosMax + b.thumosNext;
  b.thumosNext = 0;
  const n = Math.max(1, handSize() - b.drawPenalty);
  b.drawPenalty = 0;
  const got = drawCards(b.piles, n);
  // 抽到神怒牌的即时惩罚（赫利俄斯的烈日）
  for (const id of got) {
    const c = CARDS[id];
    if (c?.onDrawThumos) b.thumos = Math.max(0, b.thumos + c.onDrawThumos);
  }
  render();
}

export function endTurn() {
  const b = B;
  if (!b || b.over || b.busy) return;
  b.busy = true;

  // 手上留着的神怒牌在回合结束时发作
  let wrathMsg = [];
  for (const id of [...b.piles.hand]) {
    const c = CARDS[id];
    if (!c) continue;
    if (c.endTurnDmg) { hurtHero(c.endTurnDmg, true); wrathMsg.push(`${c.icon} ${c.name}：你受到 ${c.endTurnDmg} 点伤害`); }
    if (c.endTurnDiscard) {
      const others = b.piles.hand.map((x, i) => [x, i]).filter(([x]) => x !== id);
      if (others.length) {
        const [, idx] = others[Math.floor(Math.random() * others.length)];
        const lost = leaveHand(b.piles, idx);
        wrathMsg.push(`${c.icon} ${c.name}：弃掉了「${CARDS[lost]?.name}」`);
      }
    }
  }
  if (wrathMsg.length) b.msg = wrathMsg.join('　');

  discardHand(b.piles);
  render();

  setTimeout(() => {
    if (b.over) return;
    enemyAct();
    checkEnd();
    if (b.over) return;
    b.busy = false;
    startTurn();
  }, 520);
}

function enemyAct() {
  const b = B, e = b.e;
  // 破绽中：跳过意图，这就是"打破气焰"的回报
  if (e.open > 0) {
    e.open--;
    b.msg = e.open > 0 ? `${b.def.name}还在踉跄——它这回合动不了。` : `${b.def.name}缓过来了。`;
    if (e.open === 0) pickIntent();
    return;
  }
  e.guard = false;
  const it = e.pending || e.intent;
  e.pending = null;
  if (b.tf.mist) { b.msg = '🌫️ 迷雾罩住了它——这一击落空了。'; pickIntent(); return; }
  if (!it) { pickIntent(); return; }

  switch (it.type) {
    case 'attack': {
      let v = it.v;
      if (b.tf.weaken) v = Math.ceil(v / 2);
      if (b.tf.untargetable) { b.msg = '🧥 它扑了个空——它没看见你。'; break; }
      hurtHero(v);
      b.msg = `${b.def.name}攻击，造成 ${v} 点。`;
      break;
    }
    case 'heavy':
      e.pending = { type: 'attack', v: it.v };
      b.msg = `${b.def.name}正在蓄力——下回合会很重。`;
      break;
    case 'roar':
      b.hero.block = Math.max(0, b.hero.block - it.v);
      b.drawPenalty = 1;
      b.msg = `${b.def.name}的咆哮震散了你的阵脚。`;
      break;
    case 'summon':
      e.menos = Math.min(e.menosMax, e.menos + it.v);
      b.msg = `${b.def.name}重新聚起了气焰。`;
      break;
    case 'guard':
      e.guard = true;
      b.msg = `${b.def.name}戒备起来——这回合气焰很难削。`;
      break;
  }
  if (!e.pending) pickIntent();
  else e.intent = e.pending;
  render();
}

function pickIntent() {
  const b = B, e = b.e;
  if (!e.phase2 && b.def.phase2At && e.hp <= e.hpMax * b.def.phase2At) {
    e.phase2 = true; e.iIdx = -1;
    b.msg = `${b.def.name}换了打法。`;
  }
  const list = (e.phase2 && b.def.intents2) ? b.def.intents2 : b.def.intents;
  e.iIdx = (e.iIdx + 1) % list.length;
  e.intent = list[e.iIdx];
}

// ===== 出牌 =====
export function playCard(idx) {
  const b = B;
  if (!b || b.over || b.busy) return;
  const id = b.piles.hand[idx];
  const c = CARDS[id];
  if (!c) return;
  if (c.unplayable) { HOST?.toast?.('神怒牌打不出去——用金色的「忍耐」牌才能净化它。'); return; }
  if (c.special === 'bow' && state.arrows <= 0) { HOST?.toast?.('没有箭了。'); return; }
  const cost = b.tf.nextFree ? 0 : c.cost;
  if (b.thumos < cost) { HOST?.toast?.('锐气不够。'); return; }

  b.thumos -= cost;
  if (b.tf.nextFree) b.tf.nextFree = false;
  if (c.color === 'endure') b.tf.playedGold = true;

  applyCard(c);

  // once 牌（风袋）：用掉即从牌组母本永久移除
  const to = (c.exhaust || c.once) ? 'exhaust' : 'discard';
  leaveHand(b.piles, idx, to);
  if (c.once) removeOneCard(c.id);

  checkEnd();
  render();
}

function applyCard(c) {
  const b = B, e = b.e;

  switch (c.special) {
    case 'eurylochus':
      // 打出过金牌 → 他擅自行动，效果反噬。原著里他就是每次带头违抗命令的人。
      if (b.tf.playedGold) {
        hurtHero(4, true);
        b.msg = '🛡️ 欧律洛科斯不肯等——他自己冲了上去。';
        return;
      }
      b.hero.block += 8; dealDamage(6);
      return;
    case 'windbag':
      b.msg = '🌬️ 风袋开了。船被一股风推出了几海里——你们脱离了。';
      finish({ win: true, lethal: false, fled: true });
      return;
    case 'veil': b.perm.veil = true; b.msg = '🧣 头巾缠在腰上。这一场你倒不下去。'; return;
    case 'moly': b.perm.moly = true; b.hero.block += 10; return;
    case 'mist': b.tf.mist = true; return;
    case 'falsename': b.perm.falsename = true; hitMenos(c.menos || 0); return;
    case 'bow':
      state.arrows--;
      dealDamage(20);
      hitMenos(e.menos);        // 直接击破气焰
      return;
  }

  if (c.dmg) for (let i = 0; i < (c.hits || 1); i++) dealDamage(c.dmg + (e.open > 0 ? (c.bonusVsOpen || 0) : 0));
  if (c.menos) hitMenos(c.menos);
  if (c.block) b.hero.block += c.block;
  if (c.draw) drawCards(b.piles, c.draw);
  if (c.selfDmg) hurtHero(c.selfDmg, true);
  if (c.thumosNext) b.thumosNext += c.thumosNext;
  if (c.regenBlock) b.perm.regenBlock += c.regenBlock;
  if (c.weakenNext) b.tf.weaken = true;
  if (c.forceTarget) b.tf.forced = true;
  if (c.untargetable) b.tf.untargetable = true;
  if (c.noDamageThisTurn) b.tf.noDamage = true;
  if (c.nextCardFree) b.tf.nextFree = true;
  if (c.kleos) b.kleosGain += c.kleos;

  if (c.purge) {
    const i = b.piles.hand.findIndex(x => CARDS[x]?.color === 'wrath');
    if (i >= 0) { const id = leaveHand(b.piles, i, 'exhaust'); b.msg = `💧 「${CARDS[id].name}」被净化了（本场）。`; }
    else b.msg = '手上没有神怒牌可净化。';
  }
  if (c.purgePerm) {
    const id = purgeOneWrath();
    if (id) {
      const i = b.piles.hand.findIndex(x => x === id);
      if (i >= 0) leaveHand(b.piles, i, 'exhaust');
      const j = b.piles.draw.indexOf(id); if (j >= 0) b.piles.draw.splice(j, 1);
      const k = b.piles.discard.indexOf(id); if (k >= 0) b.piles.discard.splice(k, 1);
      b.msg = `🕯️ 「${CARDS[id].name}」被<b>永久</b>从牌组里除掉了。`;
      saveGame();
    } else b.msg = '牌组里已经没有神怒牌了。';
  }
}

function dealDamage(n) {
  const b = B, e = b.e;
  const v = Math.round(n * (e.open > 0 ? 2 : 1));
  e.hp = Math.max(0, e.hp - v);
  e.hitFlash = 1;
}

function hitMenos(n) {
  const b = B, e = b.e;
  if (e.open > 0) return;                       // 已经破绽了，再削没意义
  const v = e.guard ? Math.ceil(n / 2) : n;
  e.menos -= v;
  e.hitFlash = Math.max(e.hitFlash, 0.6);
  if (e.menos <= 0) {
    e.broken++;
    e.open = 2;
    e.menos = e.menosMax;
    e.blinded = b.def.id === 'e_polyphemus';
    if (b.perm.falsename) dealDamage(4);
    b.msg = `💥 气焰被打散了！${b.def.name}露出<b>破绽</b>（2 回合）——现在打他，伤害翻倍。`;
  }
}

function hurtHero(n, ignoreBlock = false) {
  const b = B;
  if (b.tf.noDamage) { b.msg = '🧘 你按兵不动，这一下没有落在你身上。'; return; }
  let v = n;
  if (!ignoreBlock) {
    const absorbed = Math.min(b.hero.block, v);
    b.hero.block -= absorbed; v -= absorbed;
  }
  if (v <= 0) return;
  b.hero.hp = Math.max(0, b.hero.hp - v);
  b.hero.hitFlash = 1;
  if (b.hero.hp <= 0 && b.perm.veil) {
    b.perm.veil = false; b.hero.hp = 12;
    b.msg = '🧣 伊诺的头巾把你从水里托了上来。';
  }
}

function checkEnd() {
  // finish() 会把 B 置空。敌人行动里如果已经分出胜负（比如主角倒下），
  // 回到这里时 B 已经没了——不判空就会抛 "reading 'e' of null"。
  const b = B;
  if (!b || b.over) return;
  const e = b.e;
  if (b.def.survival && b.turn > b.def.survival) return finish({ win: true, lethal: false });
  if (e.hp <= 0) return finish({ win: true, lethal: true });
  if (e.broken >= b.def.yieldAt && e.hp > 0) return finish({ win: true, lethal: false });
  if (b.hero.hp <= 0) return finish({ win: false, lethal: false });
}

function finish(res) {
  const b = B;
  if (b.over) return;
  b.over = true;
  state.player.hp = Math.max(1, b.hero.hp);
  if (b.kleosGain) state.kleos += b.kleosGain;
  saveGame();
  stopLoop();
  $('#battle-screen').classList.add('hidden');
  const out = { ...res, turns: b.turn, kleos: b.kleosGain, broken: b.e.broken, enemy: b.def };
  const cb = b.onDone; B = null;
  cb?.(out);
}

// ===== 渲染 =====
function render() {
  const b = B; if (!b) return;
  const e = b.e, def = b.def;

  // 顶栏：敌人两条血 + 意图
  const it = e.pending || e.intent;
  const intentHtml = e.open > 0
    ? `<span class="ib open">✨ 破绽（${e.open}）</span>`
    : `<span class="ib">${INTENT_ICON[it?.type] || '❔'} ${it ? INTENT_TEXT[it.type](it.v) : '？'}</span>`;
  $('#battle-top').innerHTML = `
    <b>${def.icon} ${def.name}</b>
    <span class="bstat">❤️ ${e.hp}/${e.hpMax}</span>
    <span class="bstat">💠 气焰 ${Math.max(0, e.menos)}/${e.menosMax}</span>
    <span class="bstat">💥 已破 ${e.broken}/${def.survival ? '—' : def.yieldAt}</span>
    ${intentHtml}
    <span class="grow"></span>
    <span class="bstat">🜃 你 ${b.hero.hp}/${b.hero.hpMax}${b.hero.block ? ` 🛡️${b.hero.block}` : ''}</span>
    ${def.survival ? `<span class="bstat">⏳ 撑住 ${b.turn}/${def.survival + 1}</span>` : ''}
    ${b.msg ? `<div class="bmsg">${b.msg}</div>` : ''}`;

  // 手牌
  const hand = $('#battle-hand');
  hand.innerHTML = b.piles.hand.map((id, i) => {
    const c = CARDS[id];
    const cost = b.tf.nextFree ? 0 : c.cost;
    const cls = c.unplayable ? 'unplayable' : (b.thumos < cost ? 'unaffordable' : '');
    return cardHTML(c, { idx: i, cls, cost });
  }).join('');
  paintCardArts(hand);
  hand.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => playCard(+el.dataset.i));
  });

  // 底栏：锐气 + 结束回合 + 牌堆
  const pips = Array.from({ length: Math.max(b.thumosMax, b.thumos) },
    (_, i) => `<span class="thumos-pip${i < b.thumos ? ' on' : ''}"></span>`).join('');
  $('#battle-bar').innerHTML = `
    <button class="pile-btn" id="pile-draw">🂠 抽牌堆 ${b.piles.draw.length}</button>
    <span class="thumos">${pips} <span>锐气 ${b.thumos}</span></span>
    <button class="primary-btn" id="btn-endturn">结束回合 ▶</button>
    <button class="pile-btn" id="pile-disc">🗑 弃牌堆 ${b.piles.discard.length}</button>`;
  $('#btn-endturn').addEventListener('click', endTurn);
  $('#pile-draw').addEventListener('click', () => HOST?.showPile?.('抽牌堆（顺序已打乱）', b.piles.draw));
  $('#pile-disc').addEventListener('click', () => HOST?.showPile?.('弃牌堆', b.piles.discard));
}

function startLoop() {
  const canvas = $('#battle-canvas');
  if (raf) return;
  t0 = performance.now();
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!B) return;
    const t = (performance.now() - t0) / 1000;
    const v = fitCover(canvas, W, H);
    const ctx = v.ctx;
    drawScene(ctx, B.bg, t);
    const e = B.e;
    e.hitFlash = Math.max(0, e.hitFlash - 0.05);
    B.hero.hitFlash = Math.max(0, B.hero.hitFlash - 0.05);
    // 单位站在手牌区上沿，大小按「顶栏下沿 → 手牌上沿」这段可用高度算。
    // 矮屏（笔电横屏、iPad 竖屏的下半段）上不缩的话，人会整个躲到卡牌背后。
    const { handTop, topY } = layoutV(v);
    const vw = v.vx1 - v.vx0;
    // 高度和宽度都要限：手机竖屏上 cover 会把可见宽度裁到只剩三百多，
    // 只按高度缩的话，主角和敌人会叠在一起。
    const k = Math.max(0.36, Math.min(1.05, Math.min((handTop - topY) / 380, vw / 620)));
    const sc = (B.def.boss ? 1.05 : 0.85) * k;
    // 站位再按可见宽度夹一次：手机竖屏上 cover 会把可见宽度裁到三百出头，
    // 光缩小还不够，还得把两边往里推，否则人会被切在画面外。
    const halfE = (B.def.art === 'crowd' ? 250 : 150) * sc;
    const halfH = 90 * k;
    const ex = Math.min(v.vx0 + vw * 0.76, v.vx1 - halfE - 6);
    const hx = Math.max(v.vx0 + vw * 0.18, v.vx0 + halfH + 6);
    drawMonster(ctx, B.def.art, ex, handTop, sc, {
      t, hitFlash: e.hitFlash, open: e.open > 0, blinded: e.blinded,
    });
    drawHero(ctx, hx, handTop, 0.95 * k, { t, hitFlash: B.hero.hitFlash, block: B.hero.block });
    drawBars(ctx, e, ex, Math.max(topY + 6, handTop - 350 * sc), Math.min(300, vw * 0.5));
  };
  raf = requestAnimationFrame(tick);
}
function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

// 手牌上沿与顶栏下沿在虚拟坐标里的位置
function layoutV(v) {
  const cr = $('#battle-canvas').getBoundingClientRect();
  const hand = $('#battle-hand'), top = $('#battle-top');
  const topY = top ? v.toVY(top.getBoundingClientRect().bottom - cr.top) + 8 : v.vy0 + 60;
  let handTop = hand ? v.toVY(hand.getBoundingClientRect().top - cr.top) + 14 : v.vy1 - 180;
  handTop = Math.min(handTop, v.vy1 - 40);
  return { handTop: Math.max(handTop, topY + 120), topY };
}

// 敌人头顶的两条血条：上红下蓝，气焰破了就闪金
function drawBars(ctx, e, x, y, w = 300) {
  ctx.save();
  ctx.translate(x - w / 2, y);
  roundRect(ctx, -3, -3, w + 6, 34, 8); ctx.fillStyle = 'rgba(23,18,28,.72)'; ctx.fill();
  // 生命
  roundRect(ctx, 0, 0, w, 14, 6); ctx.fillStyle = '#3a2430'; ctx.fill();
  roundRect(ctx, 0, 0, w * Math.max(0, e.hp / e.hpMax), 14, 6); ctx.fillStyle = PAL.terra; ctx.fill();
  // 气焰
  roundRect(ctx, 0, 18, w, 10, 5); ctx.fillStyle = '#1e2a3a'; ctx.fill();
  roundRect(ctx, 0, 18, w * Math.max(0, e.menos / e.menosMax), 10, 5);
  ctx.fillStyle = e.open > 0 ? PAL.bronze : '#4a8ac0'; ctx.fill();
  ctx.restore();
  if (e.open > 0) outlinedText(ctx, '破 绽', x, y - 26, 26, PAL.bronze);
}
