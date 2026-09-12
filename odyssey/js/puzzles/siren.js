// 第八章谜题：划过塞壬。
// 桨要跟上鼓点，同时歌声会往你脑子里塞东西。
// 这是全作唯一一道"手上要动"的题，但很宽容——真正的考验是它唱的<b>内容</b>。
import { registerPuzzle } from '../puzzle.js';

const SONGS = [
  '「过来吧，名满天下的奥德修斯，阿开亚人的骄傲……」',
  '「我们知道特洛伊平原上发生过的<b>每一件事</b>。」',
  '「我们也知道大地上<b>将要</b>发生的每一件事。」',
  '「你想知道你儿子现在长什么样吗？」',
  '「你想知道你回家那天，谁会先认出你吗？」',
  '「靠过来一点。就一点。」',
];
const BEATS = 12;

registerPuzzle({
  id: 'siren',
  icon: '🎶',
  title: '划过去',
  intro: `你把蜂蜡揉软，塞进每一个人的耳朵。<br>
    然后让他们把你<b>绑在桅杆上</b>——手脚都绑死，并且交代：<br>
    「我要是挣扎着叫你们松绑，你们就<b>再多绑几道</b>。」<br><br>
    <i>桨要跟上鼓点。鼓响的时候按一下。<br>
    她们唱的东西会往你脑子里钻——别管它。</i>`,
  hints: [
    '看着鼓点走。节奏是固定的，不快。',
    '一般以为塞壬用美色诱惑水手。原著里她们兜售的其实是<b>知识</b>——这对你才真正致命。',
    '这道题不会因为你手慢而失败得太惨。真正要做到的只有一件事：<b>别让船靠过去</b>。',
  ],
  mount(host) {
    let beat = 0, hits = 0, misses = 0, songIdx = 0, timer = null, live = false, window_ = false;

    const draw = () => {
      const dist = 100 - Math.round((hits / BEATS) * 100);
      host.body.innerHTML = `
        <div class="puz-intro">${this.intro}</div>
        <div class="puz-card" style="text-align:center">
          <p style="min-height:3.2em;line-height:2;color:#e8c8f0;font-size:15.5px">
            ${songIdx > 0 ? SONGS[Math.min(songIdx - 1, SONGS.length - 1)] : '<i style="color:#8f8371">……海面忽然静了下来。一丝风都没有。</i>'}
          </p>
          <div style="margin:16px 0">
            <div style="height:16px;border-radius:8px;background:rgba(255,255,255,.14);overflow:hidden">
              <div style="height:100%;width:${(hits / BEATS) * 100}%;background:var(--bronze);transition:width .2s"></div>
            </div>
            <p class="puz-note">桨 <b>${hits}/${BEATS}</b>　·　乱了 <b>${misses}</b> 下</p>
          </div>
          <button id="oar" class="tile ${window_ ? 'ok' : ''}"
            style="width:190px;height:110px;font-size:17px;flex-direction:column">
            <span style="font-size:34px">🚣</span>
            <span>${window_ ? '划！' : '……'}</span>
          </button>
          <p class="puz-note">${live ? '鼓点亮起来的时候按一下。' : '准备好了就开始。'}</p>
        </div>`;
      document.getElementById('oar').addEventListener('click', () => {
        if (!live) return;
        if (window_) { hits++; window_ = false; draw(); }
        else { misses++; draw(); }
      });
      host.setFoot(live
        ? ''
        : `<button class="primary-btn big" id="puz-go">${beat ? '继续' : '开始划'} ▶</button>`);
      document.getElementById('puz-go')?.addEventListener('click', start);
    };

    const start = () => {
      live = true;
      draw();
      timer = setInterval(() => {
        if (window_) misses++;              // 上一拍没跟上
        window_ = true;
        beat++;
        if (beat % 2 === 1) songIdx++;
        draw();
        setTimeout(() => { if (window_) { window_ = false; draw(); } }, 620);
        if (beat >= BEATS + 3) { clearInterval(timer); live = false; finish(); }
      }, 900);
    };

    const finish = () => {
      const ok = hits >= Math.ceil(BEATS * 0.6);
      host.body.innerHTML = `
        <div class="puz-card">
          <h3 style="color:var(--bronze)">${ok ? '过去了。' : '差一点。'}</h3>
          <p style="line-height:2;margin-top:10px">
            ${ok ? `你在桅杆上又喊又挣，眉毛拧成一团，用眼神命令他们松绑。<br>
              珀里墨得斯和欧律洛科斯站起来，<b>又给你加了两道绳子</b>。<br><br>
              等歌声听不见了，他们才掏出耳朵里的蜡，把你放下来。`
              : `桨乱了，船偏了，往岛那边靠了一段。<br>
              岸上白花花的一片——那是骨头。很多很多骨头。<br><br>
              是欧律洛科斯反应过来，硬把舵扳了回去。`}
          </p>
          <div style="background:rgba(217,164,65,.14);border-left:4px solid var(--bronze);
                      border-radius:0 10px 10px 0;padding:14px 16px;margin-top:16px;line-height:2">
            <b>她们唱的到底是什么？</b><br>
            一般以为塞壬用美貌或情歌勾引水手。但原著里写得很具体：<br>
            <i>「我们知道特洛伊平原上发生的一切，也知道大地上将要发生的一切。」</i><br><br>
            她们兜售的是<b>知识</b>。对一个以好奇心著称的人来说，
            这比任何美色都危险。<br>
            （另外，荷马的塞壬是鸟身女头，不是后世的美人鱼。）
          </div>
        </div>`;
      host.setFoot(`<button class="primary-btn big" id="puz-ok">前面就是海峡 ▶</button>`);
      document.getElementById('puz-ok').addEventListener('click', () => host.done(ok, { hits, misses }));
    };
    draw();
  },
});
