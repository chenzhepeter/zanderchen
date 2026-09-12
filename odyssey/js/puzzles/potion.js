// 第六章谜题：配出解药。
// 简化版 Mastermind：五味草药里选三味，每次只告诉你"对了几味"，不告诉你是哪几味。
// 三次以内配出来才算"一次通过"——这是救下埃尔佩诺耳的前提之一。
import { registerPuzzle } from '../puzzle.js';

const HERBS = [
  { id: 'moly',    name: '摩吕草',   icon: '🌿', note: '赫耳墨斯给的。黑根白花。' },
  { id: 'laurel',  name: '月桂叶',   icon: '🍃', note: '阿波罗的树。庙里烧的就是它。' },
  { id: 'squill',  name: '海葱',     icon: '🧅', note: '海边到处都是。据说能驱邪。' },
  { id: 'poppy',   name: '罂粟籽',   icon: '🌸', note: '睡神的花。给伤兵止痛用的。' },
  { id: 'thyme',   name: '百里香',   icon: '🌾', note: '牧人拿它熏羊圈，防虫。' },
];
const ANSWER = ['moly', 'laurel', 'thyme'];   // 神物 + 神的树 + 与"畜群"有关的那一味
const MAX_TRIES = 5;
const PERFECT_TRIES = 3;

registerPuzzle({
  id: 'potion',
  icon: '⚗️',
  title: '配出解药',
  intro: `喀耳刻把人变成猪，用的是掺了药的奶酪和酒。<br>
    赫耳墨斯给了你<b>摩吕草</b>，但只给了草，没给方子。<br><br>
    <i>五味里选三味。每配一次，你会看见汤的颜色变化——
    它只告诉你<b>对了几味</b>，不告诉你是哪几味。</i>`,
  hints: [
    '摩吕草是神亲手给的，它一定在方子里。剩下的问题只是另外两味。',
    '喀耳刻的法术是把人变成<b>牲畜</b>。想一想：五味草药里，哪一味是专门跟"畜群"打交道的？',
    '还有一味来自<b>神的树</b>——神的东西要用神的东西来解。答案是：摩吕草 + 月桂叶 + 百里香。',
  ],
  mount(host) {
    let sel = new Set(['moly']), tries = [];
    const render = () => {
      const solved = tries.some(t => t.hit === 3);
      host.body.innerHTML = `
        <div class="puz-intro">${this.intro}</div>
        <div class="puz-card">
          <div class="tile-row">
            ${HERBS.map(h => `<button class="tile ${sel.has(h.id) ? 'on' : ''}" data-h="${h.id}"
              style="min-width:104px;height:78px;flex-direction:column" title="${h.note}">
              <span style="font-size:22px">${h.icon}</span>
              <span style="font-size:12px;font-weight:700">${h.name}</span></button>`).join('')}
          </div>
          <p class="puz-note">${[...sel].map(id => HERBS.find(h => h.id === id).name).join(' + ') || '（还没选）'}
            　已选 <b>${sel.size}</b>/3　·　剩 <b>${MAX_TRIES - tries.length}</b> 次机会</p>
          ${tries.length ? `<h3 style="color:var(--bronze);margin:16px 0 8px">试过的方子</h3>
            ${tries.map((t, i) => `<div class="stat-line" style="color:var(--clay-lt);border-color:rgba(255,255,255,.12)">
              <span>${i + 1}. ${t.names}</span>
              <b style="color:${t.hit === 3 ? '#8fe0a0' : t.hit === 2 ? '#e8c46a' : '#d09a8a'}">
                对了 ${t.hit} 味</b></div>`).join('')}` : ''}
          ${solved ? '<p class="puz-note" style="color:#8fe0a0;margin-top:14px">汤变成了清亮的金色。</p>' : ''}
        </div>`;
      host.body.querySelectorAll('[data-h]').forEach(el => el.addEventListener('click', () => {
        const id = el.dataset.h;
        if (sel.has(id)) sel.delete(id);
        else if (sel.size >= 3) return host.toast('锅里只放得下三味。');
        else sel.add(id);
        render();
      }));
      const solvedNow = tries.some(t => t.hit === 3);
      const out = tries.length >= MAX_TRIES;
      host.setFoot(solvedNow || out
        ? `<button class="primary-btn big" id="puz-ok">${solvedNow ? '端着碗去找她 ▶' : '只能硬闯了 ▶'}</button>`
        : `<button class="primary-btn big" id="puz-go" ${sel.size === 3 ? '' : 'disabled'}>下锅 ▶</button>`);
      document.getElementById('puz-go')?.addEventListener('click', () => {
        const hit = [...sel].filter(id => ANSWER.includes(id)).length;
        tries.push({ names: [...sel].map(id => HERBS.find(h => h.id === id).name).join(' + '), hit });
        render();
      });
      document.getElementById('puz-ok')?.addEventListener('click', () => {
        const ok = tries.some(t => t.hit === 3);
        host.done(ok, { ok, tries: tries.length, perfect: ok && tries.length <= PERFECT_TRIES });
      });
    };
    render();
  },
});
