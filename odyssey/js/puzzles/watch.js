// 第九章谜题：在特里那喀亚岛上撑过一个月。
// 六轮，每轮五天。三件事只能挑一件做，三条表互相牵制：
// 觅食累人，看守也累人，休息会让人开始琢磨岸上那些牛。
// 这是全作对「忍耐」最直白的一次考察——它考的不是意志，是配额。
import { registerPuzzle } from '../puzzle.js';

const ROUNDS = 6;
const ACTIONS = [
  { id: 'fish', name: '全员出海打鱼捕鸟', icon: '🎣',
    d: { food: +4, temp: +2, tired: +3 }, note: '弄得到吃的，但一天下来人都散架了。' },
  { id: 'watch', name: '轮班守住牛群', icon: '👁️',
    d: { food: 0, temp: -1, tired: +3 }, note: '没人敢动牛，可站一天岗跟打一仗一样累。' },
  { id: 'rest', name: '让大家睡个整觉', icon: '😴',
    d: { food: 0, temp: +4, tired: -2 }, note: '人缓过来了——然后就有工夫盯着岸上那七群牛看了。' },
];
const DAILY = { food: -3, temp: +2, tired: +1 };   // 每轮固定消耗
const LIMIT = { temp: 14, tired: 14 };

registerPuzzle({
  id: 'watch',
  icon: '🐂',
  title: '二十九天',
  intro: `南风刮了起来，一刮就是一个月。船出不去。<br>
    带上岸的粮食很快就吃完了。<br><br>
    岸上有<b>七群牛</b>，每群五十头，慢慢地走来走去。<br>
    它们是赫利俄斯的。提瑞西阿斯说过，喀耳刻也说过：<b>一头都不能碰。</b><br><br>
    <i>六轮，每轮五天。每轮只能安排一件事。</i>`,
  hints: [
    '三条表都会自己往坏处走：粮食每轮 −3，馋念每轮 +2，疲劳每轮 +1。你只是在决定"先按住哪一条"。',
    '别一条道走到黑。连着打鱼会累垮，连着守夜也会累垮，连着休息则会让馋念冲顶。',
    '六轮里，三件事各安排两次左右就能过去。<b>撑住的办法不是使劲，是配额。</b>',
  ],
  mount(host) {
    let round = 0, food = 12, temp = 0, tired = 0, history = [], over = null;

    const bar = (label, v, max, color, invert) => {
      const pct = Math.max(0, Math.min(100, (v / max) * 100));
      const danger = invert ? v <= 3 : v >= max - 3;
      return `<div style="margin:8px 0">
        <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:3px">
          <span>${label}</span><b style="color:${danger ? '#e58a6a' : '#e8d4b0'}">${v}</b></div>
        <div style="height:13px;border-radius:7px;background:rgba(255,255,255,.14);overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};transition:width .25s"></div></div></div>`;
    };

    const render = () => {
      if (over) return finish();
      host.body.innerHTML = `
        <div class="puz-intro">${this.intro}</div>
        <div class="puz-card">
          <h3 style="color:var(--bronze);margin:0 0 6px">第 ${round + 1} / ${ROUNDS} 轮（第 ${round * 5 + 1}–${round * 5 + 5} 天）</h3>
          ${bar('🍞 粮食', food, 20, 'linear-gradient(90deg,#8fbf6a,#d9a441)', true)}
          ${bar('🐂 馋念（到 14 就有人动手）', temp, LIMIT.temp, 'linear-gradient(90deg,#d9a441,#c1512f)')}
          ${bar('😩 疲劳（到 14 就撑不住了）', tired, LIMIT.tired, 'linear-gradient(90deg,#8a7fa8,#5b2a3e)')}
          <p class="puz-note" style="margin:12px 0 6px">每轮固定：粮食 −3　馋念 +2　疲劳 +1</p>
          <div class="puz-list" style="margin-top:10px">
            ${ACTIONS.map(a => `<button class="puz-opt" data-a="${a.id}">
              <b>${a.icon} ${a.name}</b>
              <span class="tag" style="margin-left:8px">粮食 ${fmt(a.d.food + DAILY.food)}　馋念 ${fmt(a.d.temp + DAILY.temp)}　疲劳 ${fmt(a.d.tired + DAILY.tired)}</span>
              <div class="muted" style="color:#b9a68c;font-size:13.5px;margin-top:4px">${a.note}</div>
            </button>`).join('')}
          </div>
          ${history.length ? `<p class="puz-note">已安排：${history.map(h => h.icon).join(' → ')}</p>` : ''}
        </div>`;
      host.body.querySelectorAll('[data-a]').forEach(el => el.addEventListener('click', () => step(el.dataset.a)));
      host.setFoot('');
    };

    const fmt = (n) => n > 0 ? `+${n}` : `${n}`;

    const step = (id) => {
      const a = ACTIONS.find(x => x.id === id);
      history.push(a);
      food = Math.max(0, food + a.d.food + DAILY.food);
      temp = Math.max(0, temp + a.d.temp + DAILY.temp);
      tired = Math.max(0, tired + a.d.tired + DAILY.tired);
      round++;
      if (food <= 0) over = 'hunger';
      else if (temp >= LIMIT.temp) over = 'temptation';
      else if (tired >= LIMIT.tired) over = 'exhaust';
      else if (round >= ROUNDS) over = 'survived';
      render();
    };

    const finish = () => {
      const ok = over === 'survived';
      const perfect = ok && temp <= 8;
      const why = {
        hunger: '粮食见了底。第三十天早上，有人说了一句：「饿死也是死。」',
        temptation: '馋念压不住了。趁你在山上祷告的工夫，岸上升起了烤肉的烟。',
        exhaust: '所有人都累垮了。守夜的睡着了，剩下的事就自然而然地发生了。',
        survived: '第二十九天夜里，南风停了。',
      }[over];
      host.body.innerHTML = `
        <div class="puz-card">
          <h3 style="color:${ok ? 'var(--bronze)' : '#e58a6a'}">${ok ? '风停了。' : '牛少了几头。'}</h3>
          <p style="line-height:2;margin-top:10px">${why}</p>
          ${ok ? `<p style="line-height:2;margin-top:10px">
              二十九天，七群牛一头没少。<br>
              你们把船推下水的时候，太阳正好升起来——照在牛背上，照在海上，什么事也没发生。
              ${perfect ? '<br><br><i>而且从头到尾，没有一个人真的动过那个念头。</i>' : ''}</p>`
            : `<p style="line-height:2;margin-top:10px">
              等你从山上回来的时候，肉已经在火上了。<br>
              而剥下来的牛皮在地上<b>自己爬</b>，串在扦子上的肉在<b>叫</b>。</p>`}
          <p class="puz-note" style="margin-top:16px">
            📖 这是《奥德赛》里最纯粹的一次忍耐测试，而船员们没能通过。
            荷马在全诗第一段就把这件事剧透了：「他们因为自己的愚蠢而死——
            他们吃了太阳神的牛。」</p>
        </div>`;
      host.setFoot(`<button class="primary-btn big" id="puz-ok">继续 ▶</button>`);
      document.getElementById('puz-ok').addEventListener('click', () => host.done(ok, { ok, perfect, temp, tired, food }));
    };
    render();
  },
});
