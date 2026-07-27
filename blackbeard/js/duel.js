// 登船白刃战（仿《大航海时代2》）：每回合同时决定「攻击部位」与「防御部位」，各三选项。
//   · 我的攻击部位 == 对手的防御部位 → 被格挡，无伤害
//   · 双方出的攻击部位相同 → 兵器相撞，只耗体力、无变化
//   · 其余按部位相克：上段克中段、中段克下段、下段克上段（克制方伤害加成）
// 两条指标：体力(HP) 与 耐力(Stamina)。攻击比防御更耗耐力；耐力见底会力竭。
import { state } from './state.js';

export const ZONES = {
  high: { id: 'high', name: '上段', icon: '⬆️', beats: 'mid', atkStam: 22, defStam: 8, dmg: 26, desc: '劈头盖脸，力大势沉' },
  mid: { id: 'mid', name: '中段', icon: '➡️', beats: 'low', atkStam: 16, defStam: 6, dmg: 20, desc: '直取胸腹，稳妥' },
  low: { id: 'low', name: '下段', icon: '⬇️', beats: 'high', atkStam: 13, defStam: 5, dmg: 16, desc: '扫腿削膝，刁钻' },
};
const ORDER = ['high', 'mid', 'low'];

let D = null, onEndCb = null;

export function startDuel({ foeName, foeHp = 80, foeSkill = 1, onEnd }) {
  onEndCb = onEnd;
  D = {
    foeName,
    p: { hp: state.player.hp, hpMax: state.player.hpMax, stam: 100, stamMax: 100, pistol: true },
    f: { hp: Math.round(foeHp), hpMax: Math.round(foeHp), stam: 100, stamMax: 100, pistol: Math.random() < 0.4, skill: foeSkill },
    atk: 'mid', def: 'mid',            // 玩家本回合的选择
    log: ['跳板搭上，两船撞在一起——甲板上只剩下你和他。'],
    round: 1, over: false,
  };
  document.getElementById('duel').classList.remove('hidden');
  render();
}

const exhausted = x => x.stam < 15;

// 对手决策：略有倾向的随机；耐力低时偏防守
function foeChoose() {
  const f = D.f;
  const pick = () => ORDER[(Math.random() * 3) | 0];
  let atk = pick(), def = pick();
  if (exhausted(f)) {                     // 力竭时用轻招、并守住上段（伤害最高处）
    atk = Math.random() < 0.7 ? 'low' : 'mid';
    def = Math.random() < 0.6 ? 'high' : pick();
  }
  return { atk, def };
}

function strike(attacker, defender, atkZone, defZone, atkSkill) {
  // 被对方防在同一部位 → 格挡
  if (atkZone === defZone) return { blocked: true, dmg: 0 };
  let dmg = ZONES[atkZone].dmg + atkSkill * 2;
  // 部位相克加成：我的攻击部位克对方的防御部位
  if (ZONES[atkZone].beats === defZone) dmg *= 1.35;
  if (exhausted(attacker)) dmg *= 0.5;    // 自己力竭，出招绵软
  if (exhausted(defender)) dmg *= 1.3;    // 对方力竭，破绽大
  return { blocked: false, dmg: Math.round(dmg) };
}

function play() {
  if (!D || D.over) return;
  const my = { atk: D.atk, def: D.def };
  const fo = foeChoose();
  const skill = state.player.skills.combat;

  // 耐力：攻击耗得多，防御耗得少，每回合小幅回复
  D.p.stam = Math.max(0, Math.min(D.p.stamMax, D.p.stam - ZONES[my.atk].atkStam - ZONES[my.def].defStam + 12));
  D.f.stam = Math.max(0, Math.min(D.f.stamMax, D.f.stam - ZONES[fo.atk].atkStam - ZONES[fo.def].defStam + 12));

  let msg = `你【攻 ${ZONES[my.atk].name} / 守 ${ZONES[my.def].name}】　对手【攻 ${ZONES[fo.atk].name} / 守 ${ZONES[fo.def].name}】<br>`;

  if (my.atk === fo.atk) {
    // 双方攻击同一部位 → 兵器相撞，只耗体力
    msg += '⚔️ 两把刀撞在一起，火星四溅——谁也没占到便宜，只是白费了力气。';
  } else {
    const a = strike(D.p, D.f, my.atk, fo.def, skill);
    const b = strike(D.f, D.p, fo.atk, my.def, D.f.skill);
    if (a.blocked) msg += `<span class="d-blk">你的${ZONES[my.atk].name}被他格开了。</span> `;
    else { D.f.hp -= a.dmg; msg += `<b class="good">你的${ZONES[my.atk].name}命中，造成 ${a.dmg} 伤害。</b> `; }
    if (b.blocked) msg += `<span class="d-blk">他的${ZONES[fo.atk].name}被你挡下。</span>`;
    else { D.p.hp -= b.dmg; msg += `<b class="bad">他的${ZONES[fo.atk].name}打中你，受到 ${b.dmg} 伤害。</b>`; }
  }
  if (exhausted(D.p)) msg += '<br><b class="bad">你的手臂在发抖——力竭了。</b>';

  D.log.unshift(msg);
  if (D.log.length > 4) D.log.length = 4;
  D.round++;

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
  D.log.unshift(`<b class="good">砰！你抽出腰间的短铳，近距离一枪打了 ${dmg} 伤害。</b>`);
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

const bar = (v, max, cls) => `<div class="dbar ${cls}"><i style="width:${Math.max(0, v / max * 100)}%"></i></div>`;

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
  const side = (who, name, mine) => `
    <div class="duel-side${mine ? '' : ' foe'}">
      <div class="dname">${name}</div>
      ${bar(who.hp, who.hpMax, 'hp')}<div class="small">体力 ${Math.round(who.hp)}/${who.hpMax}</div>
      ${bar(who.stam, who.stamMax, 'st')}<div class="small">耐力 ${Math.round(who.stam)}${exhausted(who) ? ' · <b class="bad">力竭</b>' : ''}</div>
    </div>`;

  el.innerHTML = `
    ${side(D.p, '你 · ' + state.player.name, true)}
    ${side(D.f, D.foeName, false)}
    <div class="duel-pick">
      <div class="dp-col">
        <div class="dp-head">🗡️ 攻击部位<span class="muted">（耗耐力多）</span></div>
        ${ORDER.map(z => `<button class="dzone atk${D.atk === z ? ' on' : ''}" data-atk="${z}">
          <span class="dz-i">${ZONES[z].icon}</span><b>${ZONES[z].name}</b>
          <span class="small muted">伤 ${ZONES[z].dmg} · 耐 −${ZONES[z].atkStam}</span>
          <span class="small">克 ${ZONES[ZONES[z].beats].name}</span></button>`).join('')}
      </div>
      <div class="dp-col">
        <div class="dp-head">🛡️ 防御部位<span class="muted">（挡住同部位）</span></div>
        ${ORDER.map(z => `<button class="dzone def${D.def === z ? ' on' : ''}" data-def="${z}">
          <span class="dz-i">${ZONES[z].icon}</span><b>${ZONES[z].name}</b>
          <span class="small muted">耐 −${ZONES[z].defStam}</span></button>`).join('')}
      </div>
    </div>
    <div class="duel-go">
      <button class="primary-btn big" id="duel-fight">⚔️ 出招（攻 ${ZONES[D.atk].name} / 守 ${ZONES[D.def].name}）</button>
      <button class="ghost-btn" id="duel-pistol" ${D.p.pistol ? '' : 'disabled'}>🔫 短铳（每场一次）</button>
    </div>
    <div class="duel-log">${D.log.map(l => `<div>${l}</div>`).join('')}</div>`;

  el.querySelectorAll('[data-atk]').forEach(b => b.addEventListener('click', () => { D.atk = b.dataset.atk; render(); }));
  el.querySelectorAll('[data-def]').forEach(b => b.addEventListener('click', () => { D.def = b.dataset.def; render(); }));
  document.getElementById('duel-fight').addEventListener('click', play);
  const pb = document.getElementById('duel-pistol');
  if (pb) pb.addEventListener('click', usePistol);
}
