// 第十一章谜题：在淮阿喀亚人的宴席上讲你自己的故事。
// 《奥德赛》最著名的四卷（第九到第十二卷），就是奥德修斯在这场宴席上亲口讲的。
// 讲什么、按什么顺序讲，决定他们送你多少东西——以及他们怎么记住你。
import { registerPuzzle } from '../puzzle.js';

// sym 同情（他们最看重"受苦"和"敬客之道"）；wary 戒心（他们怕海盗）
const EPISODES = [
  { id: 'horse', name: '木马计', icon: '🐴', sym: 1, wary: 2,
    note: '他们的歌手刚刚才唱过这一段。再讲一遍，就成了自夸。' },
  { id: 'cicone', name: '洗劫伊斯马罗斯', icon: '🗡️', sym: 0, wary: 4,
    note: '一群带着战利品的武装水手洗劫了一座不设防的城。他们会想：那我们呢？' },
  { id: 'lotus', name: '食莲人', icon: '🌺', sym: 2, wary: 0,
    note: '一个没有人流血的故事。你把自己的人劝了回来。' },
  { id: 'cyclops', name: '独眼巨人', icon: '👁️', sym: 5, wary: 1,
    note: '你是<b>客人</b>，而主人吃了你的同伴。这正是他们最恨的那种事。' },
  { id: 'bag', name: '风神的袋子', icon: '🌬️', sym: 4, wary: 0,
    note: '看得见家门口的火光，然后被自己人一夜之间送回原点。' },
  { id: 'laestry', name: '莱斯特律戈涅斯', icon: '🪨', sym: 5, wary: 0,
    note: '一炷香，十一条船，五百多个人。' },
  { id: 'circe', name: '喀耳刻之岛', icon: '🍷', sym: 2, wary: 1,
    note: '一位女神留了你一年。讲出来好听，但听的人会想：你也没那么急着回家嘛。' },
  { id: 'nekyia', name: '冥府招魂', icon: '🕯️', sym: 5, wary: 0,
    note: '你活着去了死人待的地方，还见到了自己的母亲。没有人听完这段还笑得出来。' },
  { id: 'cattle', name: '太阳神的牛群', icon: '🐂', sym: 3, wary: 1,
    note: '承认是自己的人犯了错，而你没能拦住。诚实，但不光彩。' },
  { id: 'calypso', name: '卡吕普索的岛', icon: '🍃', sym: 6, wary: 0, last: true,
    note: '一位女神给你不老不死，而你为了回家拒绝了。<b>这是他们最想听的那句话。</b>' },
];
const PICKS = 5;

registerPuzzle({
  id: 'retell',
  icon: '🎼',
  title: '「客人，你到底是谁？」',
  intro: `盲眼的歌手得摩多科斯正好唱起了木马计。唱到一半，国王发现这个陌生客人蒙着脸在哭。<br><br>
    他放下酒杯：「客人，你到底是谁？」<br><br>
    <i>挑 <b>${PICKS}</b> 段来讲，并且排好顺序。<br>
    <b>他们最看重两件事：敬客之道，和一个人受过多少苦。</b><br>
    他们最怕的是海盗。</i>`,
  hints: [
    '这不是"哪段最精彩"，是"这些人想听什么"。淮阿喀亚人是航海民族，最讲究待客，也最怕武装来客。',
    '有一段会直接吓到他们——你带着武装水手洗劫了一座不设防的城。别讲那个。',
    '把最重的那段放<b>最后</b>：一位女神给了你不老不死，而你为了回家拒绝了。这正是他们心里"归乡"的分量。',
  ],
  mount(host) {
    const order = [];
    const render = () => {
      host.body.innerHTML = `
        <div class="puz-intro">${this.intro}</div>
        <div class="puz-card">
          <h3 style="color:var(--bronze);margin:0 0 8px">你要讲的（${order.length}/${PICKS}）</h3>
          <div class="tile-row">
            ${Array.from({ length: PICKS }, (_, i) => {
              const e = order[i] && EPISODES.find(x => x.id === order[i]);
              return e ? `<button class="tile on" data-rm="${i}" style="min-width:112px;height:64px;flex-direction:column">
                  <span style="font-size:18px">${e.icon}</span>
                  <span style="font-size:11.5px;font-weight:700">${e.name}</span></button>`
                : `<div class="tile slot" style="min-width:112px;height:64px">${i + 1}</div>`;
            }).join('')}
          </div>
          <div class="puz-list" style="margin-top:16px">
            ${EPISODES.map(e => `<button class="puz-opt${order.includes(e.id) ? ' on' : ''}" data-id="${e.id}">
              <b>${e.icon} ${e.name}</b>
              <div class="muted" style="color:#b9a68c;font-size:13.5px;margin-top:4px">${e.note}</div>
            </button>`).join('')}
          </div>
        </div>`;
      host.body.querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', () => {
        const id = el.dataset.id, i = order.indexOf(id);
        if (i >= 0) order.splice(i, 1);
        else if (order.length >= PICKS) return host.toast(`只讲 ${PICKS} 段。`);
        else order.push(id);
        render();
      }));
      host.body.querySelectorAll('[data-rm]').forEach(el => el.addEventListener('click', () => {
        order.splice(+el.dataset.rm, 1); render();
      }));
      host.setFoot(`<button class="primary-btn big" id="puz-go" ${order.length === PICKS ? '' : 'disabled'}>
        开口 ▶</button>`);
      document.getElementById('puz-go')?.addEventListener('click', submit);
    };

    const submit = () => {
      const picked = order.map(id => EPISODES.find(e => e.id === id));
      let score = picked.reduce((a, e) => a + e.sym - e.wary, 0);
      const finale = picked[PICKS - 1]?.last;
      if (finale) score += 4;
      const tier = score >= 22 ? 3 : score >= 15 ? 2 : score >= 8 ? 1 : 0;
      const gift = [0, 8, 16, 26][tier];
      const kleos = [4, 12, 22, 34][tier];
      host.body.innerHTML = `
        <div class="puz-card">
          <h3 style="color:var(--bronze)">${['他们听完了，礼貌地散了。', '大厅里安静了很久。',
            '国王站了起来。', '整个大厅没有一个人动。'][tier]}</h3>
          <p style="line-height:2;margin-top:10px">
            ${['你讲了一些他们无法感同身受的事，还有一些让他们有点害怕的事。<br>他们给了你一条船，仅此而已。',
               '你讲的东西打动了一部分人。国王吩咐每家送一份礼物。',
               '「客人，」国王说，「你受的苦，比我们这一族所有人加起来还多。」<br>他吩咐每一位首领再加一份铜器。',
               `你最后讲到了卡吕普索——讲到一位女神给你不老不死，而你为了一座多石头的小岛拒绝了。<br><br>
                <i>大厅里长久地没有人说话。</i><br><br>
                「阿尔喀诺俄斯王说：把库房打开。」`][tier]}
          </p>
          <div style="background:rgba(217,164,65,.14);border-left:4px solid var(--bronze);
                      border-radius:0 10px 10px 0;padding:14px 16px;margin-top:16px;line-height:2">
            <b>他们为什么这样反应？</b><br>
            淮阿喀亚人是航海民族，最讲究 <b>ξενία</b>（宾主之道），也最怕武装来客。<br>
            所以「你作为客人被主人吃掉同伴」这种故事对他们最重；<br>
            而「你带兵洗劫了一座不设防的城」会让他们把手按在剑上。<br><br>
            📖 现实里，《奥德赛》第九到第十二卷——全诗最有名的四卷——
            正是奥德修斯在这张桌子上亲口讲的。<b>他是自己故事的叙述者。</b>
          </div>
          <p class="puz-note" style="margin-top:12px">评价：${'★'.repeat(tier + 1)}${'☆'.repeat(3 - tier)}</p>
        </div>`;
      host.setFoot(`<button class="primary-btn big" id="puz-ok">收下赠礼 ▶</button>`);
      document.getElementById('puz-ok').addEventListener('click', () =>
        host.done(tier >= 2, { tier, gift, kleos, perfect: tier === 3 }));
    };
    render();
  },
});
