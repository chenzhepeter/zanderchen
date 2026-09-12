// 第十二章谜题一：二十年之后，谁还是你的人。
// 乞丐的破衣服是最好的筛子——人对一个要不到东西的人是什么态度，就是他真正的样子。
import { registerPuzzle } from '../puzzle.js';

const PEOPLE = [
  { id: 'eumaeus', name: '欧迈俄斯', role: '猪倌', icon: '🐖', loyal: true,
    ev: '你穿着破衣服到他的窝棚，他杀了自己养的两头小猪招待你，还把自己唯一那件斗篷给你披上。<br>' +
        '他跟你抱怨了一整夜他那个"失踪的主人"，说着说着就哭了。',
    why: '他不知道你是谁，却按 <b>ξενία</b> 的规矩招待了一个一无所有的陌生人。这是全诗的道德标尺。' },
  { id: 'eurycleia', name: '欧律克勒娅', role: '老乳母', icon: '🧺', loyal: true,
    ev: '她奉命给"客人"洗脚。洗到膝盖的时候，她的手停住了——<br>' +
        '那里有一道疤，是你少年时打野猪留下的。<br>铜盆翻了，水泼了一地。',
    why: '她认出你的第一反应是要喊出来——而不是去领赏。你捂住她的嘴时，她抖了，但没有挣。' },
  { id: 'philoetius', name: '菲罗提俄斯', role: '牧牛人', icon: '🐄', loyal: true,
    ev: '他赶牛进院时看见你，愣了很久，说：「你这身板……让我想起一个人。」<br>' +
        '然后他背过身去擦眼睛，嘴里骂了一句「这帮人把牛都快吃完了」。',
    why: '他心疼的是牛，是这个家的东西，不是自己的位置。' },
  { id: 'melanthius', name: '墨兰透斯', role: '牧羊人', icon: '🐐', loyal: false,
    ev: '路上遇见你这个"乞丐"，他抬脚踢了你的胯骨一下，还骂：<br>' +
        '「滚开，讨饭的。」<br>然后他赶着最肥的羊，进城送去给求婚者们下酒。',
    why: '他踢的是一个跟他无冤无仇、也给不了他任何东西的人。这一脚不是为了利益，纯粹是因为他觉得可以。' },
  { id: 'melantho', name: '墨兰托', role: '女仆', icon: '💄', loyal: false,
    ev: '珀涅罗珀把她当女儿一样养大，给她买首饰。<br>' +
        '她当着女主人的面嘲笑那个"客人"：「老东西，别在这儿碍事，去铁匠铺睡吧。」',
    why: '被善待过的人回头去羞辱更弱的人。她选的是眼下热闹的那一边。' },
  { id: 'iros', name: '伊洛斯', role: '另一个乞丐', icon: '🥣', loyal: null,
    ev: '门口本来就有个讨饭的，看见来了同行，非要跟你打一架抢地盘。<br>' +
        '求婚者们起哄下注，看得很开心。',
    why: '他既不忠也不叛——他只是另一个可怜人。<br><b>把他算成敌人，是这道题真正的陷阱。</b>' },
];

registerPuzzle({
  id: 'loyalty',
  icon: '🔎',
  title: '二十年之后，谁还是你的人',
  intro: `雅典娜把你变成了一个满脸皱纹的老乞丐。<br>
    连你自己的狗都差点没认出来——它抬了抬耳朵，摇了摇尾巴，然后死了。<br><br>
    <i>接下来几天，你要在自己家里当一个讨饭的。<br>
    给每个人一个判断：<b>忠</b>、<b>叛</b>，还是<b>都不是</b>。</i>`,
  hints: [
    '别看他们对"主人"说什么。看他们对<b>这个要不到任何东西的乞丐</b>做了什么。',
    '有一个人既不忠也不叛——他跟这个家没有关系，只是恰好也在门口讨饭。',
    '猪倌、乳母、牧牛人是忠的；牧羊人和那个女仆是叛的；门口那个乞丐两边都不是。',
  ],
  mount(host) {
    const marks = {};
    const render = () => {
      const done = PEOPLE.every(p => marks[p.id] !== undefined);
      host.body.innerHTML = `
        <div class="puz-intro">${this.intro}</div>
        ${PEOPLE.map(p => `
          <div class="puz-card" style="margin-bottom:12px">
            <h3 style="color:var(--bronze);margin:0 0 6px">${p.icon} ${p.name}
              <span class="muted" style="color:#8f8371;font-size:13px;font-weight:400">· ${p.role}</span></h3>
            <p class="muted" style="color:#b9a68c;font-size:14px;line-height:1.9">${p.ev}</p>
            <div class="tile-row" style="justify-content:flex-start;margin:10px 0 0">
              ${[['loyal', '忠'], ['traitor', '叛'], ['neither', '都不是']].map(([v, l]) =>
                `<button class="tile sm${marks[p.id] === v ? ' on' : ''}" data-p="${p.id}" data-v="${v}"
                  style="min-width:76px">${l}</button>`).join('')}
            </div>
          </div>`).join('')}`;
      host.body.querySelectorAll('[data-p]').forEach(el => el.addEventListener('click', () => {
        marks[el.dataset.p] = el.dataset.v; render();
      }));
      host.setFoot(`<button class="primary-btn big" id="puz-go" ${done ? '' : 'disabled'}>看清楚了 ▶</button>`);
      document.getElementById('puz-go')?.addEventListener('click', submit);
    };

    const submit = () => {
      const want = (p) => p.loyal === true ? 'loyal' : p.loyal === false ? 'traitor' : 'neither';
      const right = PEOPLE.filter(p => marks[p.id] === want(p));
      const allies = PEOPLE.filter(p => p.loyal === true && marks[p.id] === 'loyal');
      host.body.innerHTML = `
        <div class="puz-card">
          <h3 style="color:var(--bronze)">${right.length}/${PEOPLE.length} 判断正确</h3>
          <p style="line-height:2;margin-top:8px">
            你在夜里向 <b>${allies.length}</b> 个人露出了那道疤。
            ${allies.length >= 3 ? '大厅里的那一战，你不是一个人。' : '肯站在你这边的人不多。'}</p>
          <div style="margin-top:14px">
            ${PEOPLE.map(p => `<p style="line-height:1.9;margin-bottom:12px">
              <b>${p.icon} ${p.name}</b>　${marks[p.id] === want(p) ? '✅' : '❌'}
              <span class="tag ${p.loyal === true ? 'alive' : p.loyal === false ? 'dead' : ''}">
                ${p.loyal === true ? '忠' : p.loyal === false ? '叛' : '都不是'}</span><br>
              <span class="muted" style="color:#b9a68c">${p.why}</span></p>`).join('')}
          </div>
          <p class="puz-note" style="margin-top:12px">
            📖 求婚者的罪名不是求婚，是破坏了 <b>ξενία</b>——赖在别人家里吃了三年。
            所以荷马让奥德修斯先当几天乞丐：先让读者亲眼看清这屋子里谁还讲规矩。</p>
        </div>`;
      host.setFoot(`<button class="primary-btn big" id="puz-ok">去拿那张弓 ▶</button>`);
      document.getElementById('puz-ok').addEventListener('click', () =>
        host.done(right.length >= 5, { right: right.length, allies: allies.length, perfect: right.length === 6 }));
    };
    render();
  },
});
