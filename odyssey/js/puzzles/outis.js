// 第三章谜题：给自己起一个名字。
// 这是全作的招牌谜题，也是《奥德赛》里最著名的一次文字游戏。
// 两步：先想清楚这个名字要做到什么，再用希腊字母把它拼出来。
import { registerPuzzle } from '../puzzle.js';

const LETTERS = [
  { g: 'Ο', z: 'o（哦）' }, { g: 'Υ', z: 'u（乌）' }, { g: 'Τ', z: 't（特）' },
  { g: 'Ι', z: 'i（伊）' }, { g: 'Σ', z: 's（斯）' }, { g: 'Μ', z: 'm（姆）' },
  { g: 'Η', z: 'ē（诶）' }, { g: 'Ν', z: 'n（呢）' }, { g: 'Α', z: 'a（啊）' },
];
const TARGET = ['Ο', 'Υ', 'Τ', 'Ι', 'Σ'];

const WHY = [
  { t: '一个听起来很威风的名字，让他不敢动我。', ok: false,
    why: '他有一座山那么大，力气比你大二十倍。任何名字都吓不住他。' },
  { t: '一个说出来等于什么都没说的名字。', ok: true,
    why: '对了。他的邻居们会来问他"谁在害你"——而你要让他的回答变成一句废话。' },
  { t: '我父亲的名字，让他记住我家的门第。', ok: false,
    why: '那正好帮他找到你家。这一路上，报出真名从来不是好主意。' },
];

registerPuzzle({
  id: 'outis',
  icon: '🎭',
  title: '你叫什么名字',
  intro: `他喝下了那袋最烈的酒，眼皮开始打架。<br><br>
    「好客人……告诉我你的名字，我给你留一份礼物。」<br><br>
    <i>洞外住着别的库克罗普斯。他要是喊救命，他们会来。<br>
    所以这个名字，得先替你把他们打发掉。</i>`,
  hints: [
    '先别急着拼字。想清楚：等他出事以后，会发生什么？他会喊人。他的邻居会隔着石头问他一句话。',
    '希腊语里「没有人」这个词是 <b>ΟΥΤΙΣ</b>（读作 <i>ou-tis</i>，"乌-提斯"）。按字母表一个一个找。',
    '按顺序点：Ο → Υ → Τ → Ι → Σ。剩下四个字母是干扰项。',
  ],
  mount(host) {
    let stage = 1, whyPick = null, built = [];

    const render = () => {
      if (stage === 1) {
        host.body.innerHTML = `
          <div class="puz-intro">${this.intro}</div>
          <div class="puz-card">
            <h3 style="color:var(--bronze);margin-bottom:10px">这个名字要做到什么？</h3>
            <div class="puz-list">
              ${WHY.map((w, i) => `<button class="puz-opt${whyPick === i ? ' on' : ''}" data-i="${i}">${w.t}</button>`).join('')}
            </div>
          </div>`;
        host.body.querySelectorAll('.puz-opt').forEach(el => el.addEventListener('click', () => {
          whyPick = +el.dataset.i;
          const w = WHY[whyPick];
          host.body.querySelector('.puz-card').insertAdjacentHTML('beforeend',
            `<p class="puz-note" style="margin-top:12px">${w.ok ? '✅' : '❌'} ${w.why}</p>`);
          if (w.ok) setTimeout(() => { stage = 2; render(); }, 1400);
          else setTimeout(render, 1800);
        }));
        host.setFoot('');
        return;
      }

      const word = built.join('');
      const reading = built.map(g => LETTERS.find(l => l.g === g).z.split('（')[0]).join('');
      const done = word === TARGET.join('');
      host.body.innerHTML = `
        <div class="puz-intro">
          「没有人」在希腊语里怎么写？<b>按顺序</b>把字母拼出来。<br>
          <i>点下面的字母加进去，点上面拼好的字母可以拿掉。</i>
        </div>
        <div class="puz-card" style="text-align:center">
          <div class="tile-row">
            ${TARGET.map((_, i) => built[i]
              ? `<button class="tile ${done ? 'ok' : 'on'}" data-rm="${i}">${built[i]}</button>`
              : `<div class="tile slot">·</div>`).join('')}
          </div>
          <p class="puz-note">读作：<b>${reading || '—'}</b>　${done ? '　意思是「<b>没有人</b>」' : ''}</p>
          <div class="tile-row" style="margin-top:18px">
            ${LETTERS.map(l => `<button class="tile sm" data-add="${l.g}" title="${l.z}">
              ${l.g}<span style="display:block;font-size:9px;opacity:.6">${l.z.split('（')[0]}</span></button>`).join('')}
          </div>
        </div>`;
      host.body.querySelectorAll('[data-add]').forEach(el => el.addEventListener('click', () => {
        if (built.length >= TARGET.length) return host.toast('已经五个字母了。');
        built.push(el.dataset.add); render();
      }));
      host.body.querySelectorAll('[data-rm]').forEach(el => el.addEventListener('click', () => {
        built.splice(+el.dataset.rm, 1); render();
      }));
      host.setFoot(`<button class="primary-btn big" id="puz-go" ${built.length === TARGET.length ? '' : 'disabled'}>
        「我叫${word || '……'}」▶</button>`);
      document.getElementById('puz-go')?.addEventListener('click', submit);
    };

    const submit = () => {
      const ok = built.join('') === TARGET.join('');
      host.body.innerHTML = `
        <div class="puz-card">
          ${ok ? `
            <h3 style="color:var(--bronze)">「我叫 ΟΥΤΙΣ。」</h3>
            <p style="line-height:2;margin-top:10px">
              他把这个词在嘴里含了一遍，笑了：「那好，<b>没有人</b>——我答应给你的礼物是：
              我会把你留到最后再吃。」<br><br>
              然后他倒下去，睡着了。</p>
            <div style="background:rgba(217,164,65,.14);border-left:4px solid var(--bronze);
                        border-radius:0 10px 10px 0;padding:14px 16px;margin-top:16px;line-height:2">
              <b>而这个名字还有第二层。</b><br>
              「没有人」是 <b>ΟΥΤΙΣ</b>（ou-tis）。<br>
              而「智谋」是 <b>ΜΗΤΙΣ</b>（mē-tis）——荷马给奥德修斯的固定称号
              「多智的」（πολύμητις），词根就是它。<br><br>
              <i>两个词只差一个音。他一边报了假名，一边报了真名。</i>
            </div>` : `
            <h3>他歪着头看了你很久。</h3>
            <p style="line-height:2;margin-top:10px">「这不是个词。」<br><br>
              最后他还是睡着了——但你没能给自己留下那个后手。</p>`}
        </div>`;
      host.setFoot(`<button class="primary-btn big" id="puz-ok">${ok ? '拿起那根橄榄木桩 ▶' : '继续 ▶'}</button>`);
      document.getElementById('puz-ok').addEventListener('click', () => host.done(ok, { ok }));
    };
    render();
  },
});
