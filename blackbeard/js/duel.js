// 登船白刃战：回合博弈。四招相克 + 体力槽 + 对手动作预兆（读心）+ 短铳每场一次
import { state } from './state.js';

// 相克环：猛砍破格挡 · 格挡挡快刺 · 快刺打断佯攻 · 佯攻闪反猛砍
export const MOVES = {
  slash: { id: 'slash', name: '猛砍', icon: '🪓', beats: 'guard', stam: 25, dmg: 30, tell: '他把重心压低，握紧了刀柄——像是要发大力。' },
  thrust: { id: 'thrust', name: '快刺', icon: '🗡️', beats: 'feint', stam: 12, dmg: 18, tell: '他的脚尖轻轻点地，刀尖在抖——他想抢快的。' },
  guard: { id: 'guard', name: '格挡', icon: '🛡️', beats: 'thrust', stam: 6, dmg: 14, tell: '他把刀横在胸前，退了半步——他在等你先动。' },
  feint: { id: 'feint', name: '佯攻', icon: '🌀', beats: 'slash', stam: 8, dmg: 16, tell: '他的眼神飘了一下，肩膀先动了——这一招是假的。' },
};
const ORDER = ['slash', 'thrust', 'guard', 'feint'];

let D = null, onEndCb = null;

export function startDuel({ foeName, foeHp = 80, onEnd }) {
  onEndCb = onEnd;
  D = {
    foeName,
    p: { hp: state.player.hp, hpMax: state.player.hpMax, stam: 100, pistol: true },
    f: { hp: Math.round(foeHp), hpMax: Math.round(foeHp), stam: 100, pistol: Math.random() < 0.4 },
    next: pickAI(),
    log: ['两船相撞，跳板搭上——甲板上只剩下你和他。'],
    round: 1, over: false,
  };
  D.tellMove = makeTell();
  document.getElementById('duel').classList.remove('hidden');
  render();
}

function pickAI() {
  // 略带倾向的随机：体力低时更爱格挡
  const r = Math.random();
  if (D && D.f.stam < 30) return r < 0.55 ? 'guard' : (r < 0.8 ? 'feint' : 'thrust');
  if (r < 0.3) return 'slash';
  if (r < 0.55) return 'thrust';
  if (r < 0.8) return 'guard';
  return 'feint';
}

// 动作预兆并非百分百可靠：老手会用假动作骗你。战斗技能越高，看得越准。
function makeTell() {
  const acc = Math.min(0.86, 0.62 + state.player.skills.combat * 0.03);
  if (Math.random() < acc) return D.next;
  const others = ORDER.filter(m => m !== D.next);
  return others[(Math.random() * others.length) | 0];
}

function exhausted(x) { return x.stam < 12; }

function play(pid) {
  if (!D || D.over) return;
  const fid = D.next;
  const P = MOVES[pid], F = MOVES[fid];
  const skill = state.player.skills.combat;
  let msg = `你使出【${P.name}】，对手【${F.name}】——`;

  D.p.stam = Math.max(0, D.p.stam - P.stam + 6);
  D.f.stam = Math.max(0, D.f.stam - F.stam + 6);

  if (pid === fid) {
    const d = 4;
    D.p.hp -= d; D.f.hp -= d;
    msg += `刀锋相撞，火星四溅，两人各退一步。`;
  } else if (P.beats === fid) {
    let dmg = P.dmg + skill * 2;
    if (exhausted(D.p)) dmg *= 0.5;
    if (exhausted(D.f)) dmg *= 1.35;
    D.f.hp -= Math.round(dmg);
    msg += `<b class="good">你占了上风，造成 ${Math.round(dmg)} 点伤害。</b>`;
  } else if (F.beats === pid) {
    let dmg = F.dmg;
    if (exhausted(D.f)) dmg *= 0.5;
    if (exhausted(D.p)) dmg *= 1.35;
    D.p.hp -= Math.round(dmg);
    msg += `<b class="bad">你被压制，挨了 ${Math.round(dmg)} 点伤害。</b>`;
  } else {
    msg += `两人错身而过，谁也没占到便宜。`;
  }
  if (exhausted(D.p)) msg += ' 你的手臂在发抖——<b class="bad">力竭</b>。';

  D.log.unshift(msg);
  if (D.log.length > 5) D.log.length = 5;
  D.round++;
  D.next = pickAI(); D.tellMove = makeTell();

  // 对手的短铳
  if (D.f.pistol && D.f.hp < D.f.hpMax * 0.4 && Math.random() < 0.5) {
    D.f.pistol = false;
    D.p.hp -= 22;
    D.log.unshift('<b class="bad">砰！他掏出腰间的短铳开了一枪。</b>');
  }
  checkOver();
  render();
}

function usePistol() {
  if (!D || !D.p.pistol || D.over) return;
  D.p.pistol = false;
  const dmg = 25 + state.player.skills.combat * 2;
  D.f.hp -= dmg;
  D.log.unshift(`<b class="good">砰！你抽出腰间的短铳，近距离一枪打了 ${dmg} 点伤害。</b>`);
  D.next = pickAI(); D.tellMove = makeTell();
  checkOver();
  render();
}

function checkOver() {
  if (D.f.hp <= 0) { D.over = true; D.won = true; }
  else if (D.p.hp <= 0) { D.over = true; D.won = false; }
}

function finish() {
  const won = !!D.won;
  state.player.hp = Math.max(15, Math.round(D.p.hp));
  if (won) state.player.exp += 8;
  document.getElementById('duel').classList.add('hidden');
  D = null;
  onEndCb && onEndCb(won);
}

function bar(v, max, cls) {
  return `<div class="dbar ${cls}"><i style="width:${Math.max(0, v / max * 100)}%"></i></div>`;
}

function render() {
  const el = document.getElementById('duel-body');
  if (!D) return;
  if (D.over) {
    el.innerHTML = `<div class="duel-end">
      <h2>${D.won ? '⚔️ 你赢了' : '💀 你倒下了'}</h2>
      <p>${D.won ? '对方的刀掉在甲板上。他退后一步，举起了双手。' : '视野发黑，你被拖回了自己的船。'}</p>
      <button class="primary-btn" id="duel-ok">继续</button></div>`;
    document.getElementById('duel-ok').addEventListener('click', finish);
    return;
  }
  el.innerHTML = `
    <div class="duel-side">
      <div class="dname">你 · ${state.player.name}</div>
      ${bar(D.p.hp, D.p.hpMax, 'hp')}<div class="small">体力 ${Math.round(D.p.hp)}/${D.p.hpMax}</div>
      ${bar(D.p.stam, 100, 'st')}<div class="small">耐力 ${Math.round(D.p.stam)}${exhausted(D.p) ? ' · <b class="bad">力竭</b>' : ''}</div>
    </div>
    <div class="duel-side foe">
      <div class="dname">${D.foeName}</div>
      ${bar(D.f.hp, D.f.hpMax, 'hp')}<div class="small">体力 ${Math.round(D.f.hp)}/${D.f.hpMax}</div>
      ${bar(D.f.stam, 100, 'st')}<div class="small">耐力 ${Math.round(D.f.stam)}${exhausted(D.f) ? ' · 力竭' : ''}</div>
    </div>
    <div class="tell">👁️ ${MOVES[D.tellMove || D.next].tell}</div>
    <div class="duel-moves">
      ${ORDER.map(m => `<button class="dmove" data-m="${m}">
        <span class="di">${MOVES[m].icon}</span><span>${MOVES[m].name}</span>
        <span class="small muted">耐力 −${MOVES[m].stam}</span>
        <span class="small">克 ${MOVES[MOVES[m].beats].name}</span></button>`).join('')}
    </div>
    <div class="duel-extra">
      <button class="ghost-btn" id="duel-pistol" ${D.p.pistol ? '' : 'disabled'}>🔫 短铳（每场一次）</button>
    </div>
    <div class="duel-log">${D.log.map(l => `<div>${l}</div>`).join('')}</div>`;
  [...el.querySelectorAll('[data-m]')].forEach(b => b.addEventListener('click', () => play(b.dataset.m)));
  const pb = document.getElementById('duel-pistol');
  if (pb) pb.addEventListener('click', usePistol);
}
