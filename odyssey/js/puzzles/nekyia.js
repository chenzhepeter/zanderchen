// 第七章谜题：血只够四个亡魂开口。选谁，按什么顺序。
// 这不是一道有唯一解的题——除了"提瑞西阿斯必须第一个"是硬规矩，
// 其余的顺序决定你在后面几章手里有什么信息。
import { registerPuzzle } from '../puzzle.js';
import { state } from '../state.js';

const SHADES = [
  { id: 'tiresias', name: '提瑞西阿斯', icon: '🕯️', must: true,
    line: '底比斯的盲先知。喀耳刻说：不问他，你就回不了家。',
    gain: '<b>预言</b>：太阳神的牛群、求婚者、以及你回家之后的路。',
    prophecy: '提瑞西阿斯：「特里那喀亚岛上的牛是赫利俄斯的。碰一头，你会失去船和所有同伴。忍住，你还能回家。」' },
  { id: 'anticlea', name: '安提克勒亚', icon: '🕊️',
    line: '你母亲。你离家时她还好好的。',
    gain: '她会告诉你伊塔卡现在的样子——你妻子、你儿子、你父亲。',
    prophecy: '安提克勒亚：「珀涅罗珀还在等你，每天夜里都在哭。你父亲搬去了乡下，睡在灰堆边上。」' },
  { id: 'agamemnon', name: '阿伽门农', icon: '👑',
    line: '联军的统帅。他比你早回家十年。',
    gain: '他会告诉你<b>回家那天</b>会发生什么——他自己就死在回家的那顿接风宴上。',
    prophecy: '阿伽门农：「回家不要张扬。我回到家，是我妻子和她的相好在宴席上杀了我。悄悄地靠岸。」' },
  { id: 'achilles', name: '阿喀琉斯', icon: '⚔️',
    line: '死在特洛伊城下的那个人。全希腊最强的战士。',
    gain: '他会告诉你，"不朽的名声"到底值多少。',
    prophecy: '阿喀琉斯：「别跟我说死后当王有多光荣。我宁可在地上给最穷的人当雇工，也不愿在这里当所有死人的王。」' },
  { id: 'aias', name: '埃阿斯', icon: '🛡️',
    line: '他因为一副铠甲输给了你，羞愤自杀。他到现在都不肯看你一眼。',
    gain: '什么也得不到——他不会开口。但你可以试着道歉。',
    prophecy: '埃阿斯什么也没说。他转过身，走回黑暗里去了。' },
  { id: 'elpenor', name: '埃尔佩诺耳', icon: '🍷', onlyIfDead: true,
    line: '他比你先到这里。你们启航时太急，没有埋他。',
    gain: '他只求一件事：回去把他埋了，在坟上插一支桨。',
    prophecy: '埃尔佩诺耳：「别把我丢在那儿不管。回去把我烧了、埋了，在坟上插一支我划过的桨。」' },
];

registerPuzzle({
  id: 'nekyia',
  icon: '🕯️',
  title: '血只够四个',
  intro: `坑里的黑血招来了成百上千的亡魂。他们挤在坑边，伸着手。<br>
    你必须用剑把他们拦住——<b>只有喝到血的，才能开口说话。</b><br><br>
    <i>血够四个人喝。按顺序排好。<br>
    你在这里听到的每一句话，后面几章都用得上。</i>`,
  hints: [
    '喀耳刻交代得很清楚：有一个人<b>必须第一个喝</b>，否则这一趟白来。',
    '想一想你接下来会遇到什么。有人会告诉你路上的坑，有人会告诉你家里的事，有人会告诉你上岸那天该怎么做。',
    '埃阿斯不会开口——把血给他是浪费。但去跟他说一句话，是另一回事。',
  ],
  mount(host) {
    const order = [];
    // 埃尔佩诺耳只有在他真的死了的那条线上才会出现在坑边
    const pool = SHADES.filter(s => !s.onlyIfDead || state.companions.elpenor === 'dead');
    const render = () => {
      host.body.innerHTML = `
        <div class="puz-intro">${this.intro}</div>
        <div class="puz-card">
          <h3 style="color:var(--bronze);margin:0 0 8px">召唤顺序（${order.length}/4）</h3>
          <div class="tile-row">
            ${[0, 1, 2, 3].map(i => {
              const s = order[i] && pool.find(x => x.id === order[i]);
              return s ? `<button class="tile on" data-rm="${i}" style="min-width:118px;height:66px;flex-direction:column">
                  <span style="font-size:19px">${s.icon}</span>
                  <span style="font-size:11.5px;font-weight:700">${s.name}</span></button>`
                : `<div class="tile slot" style="min-width:118px;height:66px">${i + 1}</div>`;
            }).join('')}
          </div>
          <div class="puz-list" style="margin-top:16px">
            ${pool.map(s => `<button class="puz-opt${order.includes(s.id) ? ' on' : ''}" data-id="${s.id}">
              <b>${s.icon} ${s.name}</b>${s.must ? '　<span class="tag">喀耳刻特别交代过</span>' : ''}
              <div class="muted" style="color:#b9a68c;font-size:13.5px;margin-top:4px">${s.line}</div>
              <div class="muted" style="color:#8f8371;font-size:13px;margin-top:3px">→ ${s.gain}</div>
            </button>`).join('')}
          </div>
        </div>`;
      host.body.querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', () => {
        const id = el.dataset.id;
        const i = order.indexOf(id);
        if (i >= 0) order.splice(i, 1);
        else if (order.length >= 4) return host.toast('血只够四个。');
        else order.push(id);
        render();
      }));
      host.body.querySelectorAll('[data-rm]').forEach(el => el.addEventListener('click', () => {
        order.splice(+el.dataset.rm, 1); render();
      }));
      host.setFoot(`<button class="primary-btn big" id="puz-go" ${order.length === 4 ? '' : 'disabled'}>
        ${order.length === 4 ? '割开羊的喉咙 ▶' : `还要再选 ${4 - order.length} 个`}</button>`);
      document.getElementById('puz-go')?.addEventListener('click', submit);
    };

    const submit = () => {
      const first = order[0] === 'tiresias';
      const got = order.map(id => pool.find(s => s.id === id));
      host.body.innerHTML = `
        <div class="puz-card">
          <h3 style="color:var(--bronze)">${first ? '提瑞西阿斯先喝了血。' : '你把顺序排错了。'}</h3>
          ${first ? '' : `<p style="line-height:2;margin-top:8px;color:#e0a08a">
            喀耳刻说过，必须让提瑞西阿斯<b>第一个</b>喝。<br>
            等轮到他的时候，坑里的血已经不多了——他只肯说一半。</p>`}
          <div style="margin-top:14px">
            ${got.map(s => `<p style="line-height:2;margin-bottom:14px">
              <b>${s.icon} ${s.name}</b><br>
              <span class="muted" style="color:#b9a68c">${s.prophecy}</span></p>`).join('')}
          </div>
          <p class="puz-note" style="margin-top:12px">
            📖 第十一卷叫「Νέκυια」（招魂）。奥德修斯在那里见到了自己的母亲——
            他离家时她还活着，是思念他死的。他三次伸手去抱她，三次抱了个空。</p>
        </div>`;
      host.setFoot(`<button class="primary-btn big" id="puz-ok">离开这里 ▶</button>`);
      document.getElementById('puz-ok').addEventListener('click', () =>
        host.done(first, { first, picked: order, prophecies: got.map(s => s.prophecy) }));
    };
    render();
  },
});
