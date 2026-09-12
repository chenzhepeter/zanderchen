// 第四章谜题：谁在传"袋子里是金子"。
// 一道纯逻辑题：四个人各说一句，只有一个人在撒谎——而事实能把他钉出来。
import { registerPuzzle } from '../puzzle.js';

const FACTS = [
  '谣言是<b>昨天日落之后</b>才开始传的，内容很具体：「船长那只袋子里是埃俄罗斯给的三十塔兰同黄金」。',
  '日落到现在，<b>忒俄克吕墨诺斯一直在桅顶瞭望</b>——换班的两个人都能作证，他没下来过，也没跟任何人说过话。',
  '<b>克特西波斯不识数。</b>他连自己分到几块饼都要数半天，说不出"三十塔兰同"这种话。',
  '波吕波斯和欧墨罗斯昨晚都在下层舱睡觉，中间隔着一整排桨。',
];

const MEN = [
  { id: 'kt', name: '克特西波斯', icon: '🍞', says: '「我是听<b>欧墨罗斯</b>说的。」' },
  { id: 'pb', name: '波吕波斯', icon: '🪣', says: '「我是听<b>克特西波斯</b>说的。」' },
  { id: 'em', name: '欧墨罗斯', icon: '🔥', says: '「我是听<b>忒俄克吕墨诺斯</b>说的。」', liar: true },
  { id: 'tk', name: '忒俄克吕墨诺斯', icon: '👁️', says: '「我谁也没说过。我一直在桅顶上。」' },
];

registerPuzzle({
  id: 'rumor',
  icon: '🔍',
  title: '谣言是从谁那里出来的',
  intro: `袋子扎着银绳，挂在桅杆下。你已经九天没合眼了。<br><br>
    今天早上你听见有人在低声说：那袋子里是金子，船长一个人独吞。<br><br>
    <i>四个人都说自己是"听别人说的"。其中<b>正好有一个人在撒谎</b>——
    谣言就是从他嘴里出来的。</i>`,
  hints: [
    '每个人都把源头推给了另一个人。把这四句话连成一条链子看看，链子的头在哪里？',
    '第 2 条事实很硬：忒俄克吕墨诺斯整晚在桅顶，没跟任何人说过话。那么，谁的话直接和它冲突？',
    '和事实冲突的那句话，就是唯一的假话。说这句话的人，就是源头。',
  ],
  mount(host) {
    let pick = null;
    const render = () => {
      host.body.innerHTML = `
        <div class="puz-intro">${this.intro}</div>
        <div class="puz-card" style="margin-bottom:14px">
          <h3 style="color:var(--bronze);margin:0 0 10px">你已经查清的事实</h3>
          <ol style="margin-left:20px;line-height:2.1;font-size:14.5px">
            ${FACTS.map(f => `<li>${f}</li>`).join('')}
          </ol>
        </div>
        <div class="puz-card">
          <h3 style="color:var(--bronze);margin:0 0 10px">四个人的说法</h3>
          <div class="puz-list">
            ${MEN.map(m => `<button class="puz-opt${pick === m.id ? ' on' : ''}" data-id="${m.id}">
              <b>${m.icon} ${m.name}</b><br>
              <span class="muted" style="color:#b9a68c;font-size:14px">${m.says}</span></button>`).join('')}
          </div>
          <p class="puz-note">点一个人，指认他是源头。</p>
        </div>`;
      host.body.querySelectorAll('.puz-opt').forEach(el => el.addEventListener('click', () => {
        pick = el.dataset.id; render();
      }));
      host.setFoot(`<button class="primary-btn big" id="puz-go" ${pick ? '' : 'disabled'}>就是他 ▶</button>`);
      document.getElementById('puz-go')?.addEventListener('click', submit);
    };

    const submit = () => {
      const m = MEN.find(x => x.id === pick);
      const ok = !!m.liar;
      host.body.innerHTML = `
        <div class="puz-card">
          <h3 style="color:var(--bronze)">${ok ? '他脸白了。' : '他一脸茫然。'}</h3>
          <p style="line-height:2;margin-top:10px">
            ${ok ? `你把第 2 条摆在他面前：忒俄克吕墨诺斯整晚在桅顶，没跟任何人说过话。<br><br>
              「所以你不可能是听他说的。」<br><br>
              欧墨罗斯低下了头。他没有恶意——他只是觉得那袋子看起来实在太像装金子的。<br><br>
              <i>你当着全船的人把这条链子讲了一遍：
              欧墨罗斯 → 克特西波斯 → 波吕波斯。<br>
              没有人再提金子的事。</i>`
              : `「船长，我真是听人说的啊……」<br><br>
              你指错了人。真正的源头站在人群里，什么也没说。<br><br>
              <i>那条链子是：<b>欧墨罗斯 → 克特西波斯 → 波吕波斯</b>。<br>
              欧墨罗斯说自己听忒俄克吕墨诺斯说的——而后者整晚都在桅顶，
              这是唯一和事实冲突的一句话。</i>`}
          </p>
        </div>`;
      host.setFoot(`<button class="primary-btn big" id="puz-ok">继续 ▶</button>`);
      document.getElementById('puz-ok').addEventListener('click', () => host.done(ok, { ok }));
    };
    render();
  },
});
