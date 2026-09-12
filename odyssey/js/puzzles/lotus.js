// 第二章谜题：把吃了莲花的人叫醒。
// 忘记「回家」的人，唤不醒他的是道理，是他自己身上还没被忘掉的那件具体的事。
// 每个人的正确台词都藏在他自己刚才说的那句话里——这是一道读人题，不是记忆题。
import { registerPuzzle } from '../puzzle.js';

const MEN = [
  { id: 'a', name: '波吕忒斯', icon: '🪢',
    said: '「回家干嘛呢。海上又冷又湿，这里多好。」',
    tell: '他抱怨的是海——可他是全船最好的绳结手，十年来每一个结都是他打的。',
    lines: [
      { t: '「你老婆在等你。」', ok: false, why: '他没有妻子。他从来没提过家里有谁。' },
      { t: '「明天的缆绳谁来打？除了你没人会打那个双套结。」', ok: true,
        why: '他忘了家，但没忘自己会什么。<b>一个人最后忘掉的是他的手艺。</b>' },
      { t: '「这是命令。站起来。」', ok: false, why: '他现在连"船长"是什么都想不起来了。命令对他没有意义。' },
    ] },
  { id: 'b', name: '安提丰', icon: '🍼',
    said: '「我已经想不起来我家在哪儿了——真好啊。」',
    tell: '出海那年他女儿刚会走路。这十年他每次分到肉，都要留一块干的收在袋子里。',
    lines: [
      { t: '「你袋子里那块肉，本来是要给谁的？」', ok: true,
        why: '他忘了"家"这个词，但没忘那个每天都在做的动作。<b>身体比记忆诚实。</b>' },
      { t: '「伊塔卡在西边，二十天就到。」', ok: false, why: '地名对他已经是没有意义的声音了。' },
      { t: '「你会后悔的。」', ok: false, why: '一个已经没有明天的人，不会怕后悔。' },
    ] },
  { id: 'c', name: '克瑞翁', icon: '⚔️',
    said: '「船长，你也坐吧。」',
    tell: '他是三个人里唯一还认得你的。他在特洛伊城下替你挡过一矛，肩上留了疤。',
    lines: [
      { t: '「起来，我们回家。」', ok: false, why: '他会点头，然后继续坐着。这句话太轻了。' },
      { t: '「我给你一朵更好的花。」', ok: false, why: '骗得了一时。半个时辰后他还是会坐回去。' },
      { t: '「你替我挡过一矛。现在轮到我了——我不走，你也别想走。」', ok: true,
        why: '他唯一还记得的东西是<b>你</b>。所以能拉他起来的不是家，是他和你之间那件事。' },
    ] },
];

registerPuzzle({
  id: 'lotus',
  icon: '🌺',
  title: '把他们叫醒',
  intro: `他们不是被下了毒，也不是被控制了——他们只是<b>不想回家了</b>。<br>
    绳子能把身体带走，带不走人。<br><br>
    <i>给每个人挑一句话。挑对了，他会自己站起来。</i>`,
  hints: [
    '别讲道理，别下命令。一个忘了"家"的人，听不懂"家"这个词。',
    '看每个人的<b>那一行小字</b>——他忘掉了"回家"，但还有一样东西没忘。',
    '三个人分别没忘的是：自己的手艺、每天在做的一个小动作、和一个具体的人。',
  ],
  mount(host) {
    const chosen = {};
    const render = () => {
      const allDone = MEN.every(m => chosen[m.id] != null);
      host.body.innerHTML = `
        <div class="puz-intro">${this.intro}</div>
        ${MEN.map(m => `
          <div class="puz-card" style="margin-bottom:14px">
            <h3 style="color:var(--bronze);margin:0 0 4px">${m.icon} ${m.name}</h3>
            <p class="muted" style="color:#b9a68c;font-size:14px;margin-bottom:4px">${m.said}</p>
            <p class="muted" style="color:#8f8371;font-size:13px;margin-bottom:10px">🔍 ${m.tell}</p>
            <div class="puz-list">
              ${m.lines.map((l, i) => `<button class="puz-opt${chosen[m.id] === i ? ' on' : ''}"
                data-m="${m.id}" data-i="${i}">${l.t}</button>`).join('')}
            </div>
          </div>`).join('')}`;
      host.body.querySelectorAll('.puz-opt').forEach(el => el.addEventListener('click', () => {
        chosen[el.dataset.m] = +el.dataset.i; render();
      }));
      host.setFoot(`<button class="primary-btn big" id="puz-go" ${allDone ? '' : 'disabled'}>
        ${allDone ? '就这么说 ▶' : '还有人没选'}</button>`);
      document.getElementById('puz-go')?.addEventListener('click', submit);
    };

    const submit = () => {
      const results = MEN.map(m => ({ m, line: m.lines[chosen[m.id]], ok: m.lines[chosen[m.id]].ok }));
      const right = results.filter(r => r.ok).length;
      host.body.innerHTML = `
        <div class="puz-card">
          <h3 style="color:var(--bronze)">${right === 3 ? '三个人都站起来了。' : `${right} 个人站了起来。`}</h3>
          ${results.map(r => `<p style="line-height:1.9;margin-top:12px">
            <b>${r.m.icon} ${r.m.name}</b>　${r.ok ? '✅' : '❌'}<br>
            <span class="muted" style="color:#b9a68c">${r.line.why}</span></p>`).join('')}
          <p class="puz-note" style="margin-top:16px">
            📖 原著里奥德修斯是把他们<b>绑上船</b>的——荷马只用了三行就写完了。<br>
            但他也写了一句：那三个人「哭着不肯走」。</p>
        </div>`;
      host.setFoot(`<button class="primary-btn big" id="puz-ok">回船上 ▶</button>`);
      document.getElementById('puz-ok').addEventListener('click', () => host.done(right === 3, { right }));
    };
    render();
  },
});
