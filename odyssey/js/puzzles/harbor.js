// 第五章谜题：把船停在哪里。
// 先看三条线索，再选停泊点。这一次选错，代价是十一条船和一个有名字的人。
import { registerPuzzle } from '../puzzle.js';

const CLUES = [
  { id: 'c1', icon: '🕊️', title: '岸上没有鸟', seen: false,
    text: '整个港湾三面环崖，水面平得像镜子。但你在崖上一只海鸟都没看见——<br>' +
          '海边的崖壁本该是鸟巢最多的地方。<b>这里有什么东西，连鸟都不敢住。</b>' },
  { id: 'c2', icon: '🦴', title: '沙滩太干净了', seen: false,
    text: '沙滩上没有海藻，没有贝壳，没有漂上来的木头，什么都没有。<br>' +
          '<b>有东西把岸上的一切都捡走了</b>——而且捡得很勤快。' },
  { id: 'c3', icon: '🪣', title: '打水的姑娘', seen: false,
    text: '派去问路的人回来说，他们在泉边遇到国王的女儿在打水。<br>' +
          '「她很客气，指了路。」他顿了一下，<br>' +
          '「船长……她站起来的时候，比我们的桅杆还高一点。」' },
];

const SPOTS = [
  { id: 's1', name: '湾底最深处', desc: '风浪完全进不来，是全湾最舒服的位置。十一位船长都想停这儿。',
    ok: false, why: '崖顶上的人只要往下扔石头，湾底的船一条都跑不掉。<b>越挡风的地方，越是口袋。</b>' },
  { id: 's2', name: '湾口内侧的浅滩', desc: '离出口近，但还在崖壁的射程里。',
    ok: false, why: '还是在崖下。石头照样砸得到，只是你能多划两桨。' },
  { id: 's3', name: '湾外，那块黑礁石的背面', desc: '风浪很大，一夜都别想睡好。但礁石挡住了崖顶的视线。',
    ok: true, why: '你把缆绳系在礁石上，船头朝外。这一夜谁都没睡好——<b>但第二天早上，你的船还在。</b>' },
  { id: 's4', name: '干脆不停，连夜绕过去', desc: '不上岸，不取水，直接走。',
    ok: false, why: '六天没有风，人是划过来的。不补水，撑不到下一座岛。', partial: true },
];

registerPuzzle({
  id: 'harbor',
  icon: '🗺️',
  title: '忒勒皮洛斯的港湾',
  intro: `一个几乎完美的港湾：三面环崖，风浪进不来，水面平得像镜子。<br>
    十一位船长都在打旗语问你——<b>进不进去？</b><br><br>
    <i>先把三条线索看完，再决定把你的旗舰停在哪里。</i>`,
  hints: [
    '三条线索都指向同一件事：这个湾里少了点什么，而少掉的东西是被"拿走"的。',
    '想一想：一个三面都是高崖、只有一个窄口的港湾，对停在里面的船来说是"避风港"，还是别的什么？',
    '最舒服的位置往往是最危险的位置。你要的是<b>能马上跑掉</b>的位置，不是睡得最好的位置。',
  ],
  mount(host) {
    let opened = 0, pick = null;
    const render = () => {
      host.body.innerHTML = `
        <div class="puz-intro">${this.intro}</div>
        <div class="puz-card" style="margin-bottom:14px">
          <h3 style="color:var(--bronze);margin:0 0 10px">线索（点开看，${opened}/3）</h3>
          <div class="puz-list">
            ${CLUES.map(c => `<button class="puz-opt${c.seen ? ' on' : ''}" data-c="${c.id}">
              <b>${c.icon} ${c.title}</b>
              ${c.seen ? `<div class="muted" style="color:#b9a68c;font-size:13.5px;margin-top:6px">${c.text}</div>` : ''}
            </button>`).join('')}
          </div>
        </div>
        <div class="puz-card">
          <h3 style="color:var(--bronze);margin:0 0 10px">把旗舰停在哪里？</h3>
          <div class="puz-list">
            ${SPOTS.map(s => `<button class="puz-opt${pick === s.id ? ' on' : ''}" data-s="${s.id}">
              <b>${s.name}</b><div class="muted" style="color:#b9a68c;font-size:13.5px;margin-top:4px">${s.desc}</div>
            </button>`).join('')}
          </div>
        </div>`;
      host.body.querySelectorAll('[data-c]').forEach(el => el.addEventListener('click', () => {
        const c = CLUES.find(x => x.id === el.dataset.c);
        if (!c.seen) { c.seen = true; opened++; }
        render();
      }));
      host.body.querySelectorAll('[data-s]').forEach(el => el.addEventListener('click', () => {
        pick = el.dataset.s; render();
      }));
      host.setFoot(`<button class="primary-btn big" id="puz-go" ${pick ? '' : 'disabled'}>下令 ▶</button>`);
      document.getElementById('puz-go')?.addEventListener('click', submit);
    };

    const submit = () => {
      const s = SPOTS.find(x => x.id === pick);
      host.body.innerHTML = `
        <div class="puz-card">
          <h3 style="color:var(--bronze)">${s.ok ? '你把船停在了礁石背面。' : '你把船开进了湾里。'}</h3>
          <p style="line-height:2;margin-top:10px">${s.why}</p>
          <p class="puz-note" style="margin-top:16px">
            📖 原著里奥德修斯确实把自己的船拴在了湾外的礁石上——荷马特意写了这一笔。
            其余十一条船全部进了湾，一条都没出来。<br>
            他没有解释为什么只有自己停在外面。</p>
        </div>`;
      host.setFoot(`<button class="primary-btn big" id="puz-ok">继续 ▶</button>`);
      document.getElementById('puz-ok').addEventListener('click', () => host.done(!!s.ok, { spot: s.id, clues: opened }));
    };
    render();
  },
});
