// 序章谜题：木马里的最后六个位置。
// 这是一道「读人」题——每个候选的一句话介绍里都藏着他能不能进去的理由。
// 三个危险人选各对应木马里真实存在过的一种风险：会应声、会打呼、下马时跟不上。
import { registerPuzzle } from '../puzzle.js';

const PEOPLE = [
  { id: 'epeius', name: '厄珀俄斯', icon: '🔨', safe: true, must: true,
    line: '造这匹马的木匠。「活板门的插销我留了个巧劲，除了我没人打得开。」' },
  { id: 'menelaus', name: '墨涅拉俄斯', icon: '👑', safe: true,
    line: '海伦的丈夫。「她要是在外面学我的声音喊我——我也不会应。我等这一天等了十年。」' },
  { id: 'diomedes', name: '狄俄墨得斯', icon: '🛡️', safe: true,
    line: '全军力气最大的人。他从进帐篷到现在一句话没说过。' },
  { id: 'neopt', name: '涅俄普托勒摩斯', icon: '⚔️', safe: true,
    line: '阿喀琉斯的儿子，第一次上战场。手在抖，但他站得笔直，也没有问一个问题。' },
  { id: 'sthenelus', name: '斯忒涅罗斯', icon: '🐎', safe: true,
    line: '狄俄墨得斯的御者。两个人配合了十年，一个抬手另一个就知道要干什么。' },
  { id: 'teucer', name: '忒乌克罗斯', icon: '🏹', safe: true,
    line: '神射手。他能趴在同一个地方八个小时不动一下，等一只鹿走过来。' },

  { id: 'anticlus', name: '安提克洛斯', icon: '💍', safe: false,
    why: '海伦会绕着木马走，一个一个模仿你们妻子的声音喊你们的名字。<b>他一定会答应。</b>',
    line: '结婚三个月就跟着来了。夜里老是说梦话，喊的都是同一个名字。' },
  { id: 'thersandros', name: '忒尔桑德罗斯', icon: '😴', safe: false,
    why: '木马里要藏一整夜，一点声音都不能有。<b>而他的呼噜声全营都听得见。</b>',
    line: '他昨天还在跟人打赌，说自己的呼噜能把帐篷震塌。营里没人跟他赌，因为都知道是真的。' },
  { id: 'akamas', name: '阿卡玛斯', icon: '🩹', safe: false,
    why: '下马的时候要顺着绳子滑下去，落地就得跑向城门。<b>他这条腿跑不动。</b>',
    line: '昨天的乱战里腿上挨了一矛。他说不碍事，可你看见他站起来时扶了一下桌子。' },
];

const NEED = 6;

registerPuzzle({
  id: 'horse',
  icon: '🐴',
  title: '木马里的最后六个位置',
  intro: `木马的肚子里只剩 <b>${NEED}</b> 个位置。<br>
    今晚这匹马会被拖进特洛伊城，在里面待一整夜——不能出声，不能动，天亮前不能睡着。<br><br>
    <i>九个人报了名。看清楚每个人说的话。</i>`,
  hints: [
    '不是挑最能打的。想一想：在一匹木马的肚子里待一整夜，什么样的人会坏事？',
    '海伦会绕着木马走，用你们妻子的声音，一个一个喊你们的名字。有人会答应。',
    '还有两种毛病同样致命：一种发生在夜里，一种发生在下马那一刻。',
  ],
  mount(host) {
    const picked = new Set(['epeius']);   // 木匠是必选的，直接给上
    const render = () => {
      host.body.innerHTML = `
        <div class="puz-intro">${this.intro}</div>
        <div class="puz-card">
          <div class="puz-list">
            ${PEOPLE.map(p => `
              <button class="puz-opt${picked.has(p.id) ? ' on' : ''}" data-id="${p.id}" ${p.must ? 'disabled' : ''}>
                <b>${p.icon} ${p.name}</b>${p.must ? '　<span class="tag">必须带上</span>' : ''}
                <div class="muted" style="color:#b9a68c;font-size:13.5px;margin-top:4px">${p.line}</div>
              </button>`).join('')}
          </div>
          <p class="puz-note">已选 <b>${picked.size}</b> / ${NEED} 人</p>
        </div>`;
      host.body.querySelectorAll('.puz-opt').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.id;
          if (picked.has(id)) picked.delete(id);
          else if (picked.size >= NEED) return host.toast(`只有 ${NEED} 个位置了。`);
          else picked.add(id);
          render();
        });
      });
      host.setFoot(`<button class="primary-btn big" id="puz-go" ${picked.size === NEED ? '' : 'disabled'}>
        ${picked.size === NEED ? '就这六个人 ▶' : `还要再选 ${NEED - picked.size} 个`}</button>`);
      document.getElementById('puz-go')?.addEventListener('click', submit);
    };

    const submit = () => {
      const bad = PEOPLE.filter(p => !p.safe && picked.has(p.id));
      const perfect = bad.length === 0;
      host.body.innerHTML = `
        <div class="puz-card">
          <h3 style="color:var(--bronze);margin-bottom:10px">${perfect ? '天亮了。城破了。' : '天亮了。城也破了——不过差一点没破。'}</h3>
          ${perfect ? `
            <p style="line-height:2">木马在城里停了一整夜。<br><br>
            海伦真的来了。她绕着马走了三圈，用每个人妻子的声音，一个一个喊名字。<br>
            马肚子里没有一点声音。<br><br>
            <i>你选对了每一个人。这不是靠武勇，是靠你认识他们。</i></p>` : `
            <p style="line-height:2">你带进去的人里，有人出了问题：</p>
            <ul style="margin:10px 0 0 20px;line-height:2">
              ${bad.map(p => `<li><b>${p.icon} ${p.name}</b>——${p.why}</li>`).join('')}
            </ul>
            <p style="line-height:2;margin-top:12px">你死死捂住了他的嘴，直到外面的脚步声走远。<br>
            城还是破了，但那一夜你的手一直在抖。</p>`}
          <p class="puz-note" style="margin-top:14px">
            📖 安提克洛斯确有其人：《奥德赛》第四卷里，海伦模仿众人妻子的声音，他险些出声，
            是奥德修斯亲手捂住了他的嘴。</p>
        </div>`;
      host.setFoot(`<button class="primary-btn big" id="puz-ok">上船 ▶</button>`);
      document.getElementById('puz-ok').addEventListener('click', () =>
        host.done(perfect, { perfect, badCount: bad.length }));
    };

    render();
  },
});
