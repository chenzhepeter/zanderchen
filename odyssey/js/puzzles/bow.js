// 第十二章谜题二：弓之试炼。
// 两步：上弦（考的是技巧不是力气），和一箭穿过十二把斧头（考的是"箭会掉"这件事）。
import { registerPuzzle } from '../puzzle.js';
import { PAL, OUTLINE, outlinedText } from '../art/common.js';

const WAYS = [
  { id: 'fire', name: '像求婚者那样，先用油和火把弓身烤软', ok: false,
    why: '他们一个接一个试过了，烤到弓身发烫也没用。<b>弓身软了，弦更挂不住。</b>' },
  { id: 'two', name: '叫两个人帮忙，一起用力掰开', ok: false,
    why: '这张弓不是靠掰开的。三个人一起用力，只会互相别着劲。' },
  { id: 'seat', name: '坐下来，把弓抵在腿上，用整个身体的重量把它压弯', ok: true,
    why: '这是唯一的办法。<b>靠的是坐姿、支点和体重，不是手臂的力气。</b>' +
         '<br>荷马写他做这件事的时候，用的比喻是「像乐师给竖琴换弦一样轻松」。' },
  { id: 'strength', name: '站直了，一口气拉开', ok: false,
    why: '大厅里最壮的那几个都试过了。<b>这张弓从来就不是用蛮力开的。</b>' },
];

// 十二把斧的环孔（Telemachus 挖了一条沟把它们排齐了）
const RINGS = 12, X0 = 90, DX = 52, RINGY = 120, RR = 13;
// 下坠系数：必须让整条弹道在 572px 的跨度上起伏小于环孔直径，否则这道题无解。
// 取 0.00005 时，最优解大约是「起手高度 89、仰角 22」——两个滑块都落在量程中段，
// 而且必须两个一起调才配得平，正好是这道题要教的那件事。
const DROP = 0.00005;

registerPuzzle({
  id: 'bow',
  icon: '🏹',
  title: '弓之试炼',
  intro: `珀涅罗珀把那张大弓抱了出来。<br><br>
    「谁能给这张弓上弦，再一箭穿过十二把斧子，我就跟谁走。」<br><br>
    <i>一百零八个人排着队试。没有一个人连第一步都做到。</i>`,
  hints: [
    '第一步不是力气题。想一想：一个坐着的人怎么可能比一群站着的壮汉更能压弯一张弓？',
    '第二步：<b>箭是会往下掉的。</b>所以你不能瞄成一条水平线。',
    '把箭的落点抬高一点、起手放低一点，让它划一道很浅的弧——弧的中段刚好从环孔中间穿过去。',
  ],
  mount(host) {
    let stage = 1, wayPick = null, y0 = 100, ang = 28, shot = false;

    const draw = () => {
      const cv = host.body.querySelector('#hall');
      if (!cv) return;
      const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#3a2a30'); g.addColorStop(1, '#22181f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#5c4436'; ctx.fillRect(0, H - 46, W, 46);     // 地面
      ctx.fillStyle = '#4a382c'; ctx.fillRect(0, H - 46, W, 6);

      // 十二把斧：柄插进沟里，柄上的环孔排成一条隧道
      for (let i = 0; i < RINGS; i++) {
        const x = X0 + i * DX;
        ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 4, RINGY, 8, H - 46 - RINGY);
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.strokeRect(x - 4, RINGY, 8, H - 46 - RINGY);
        ctx.fillStyle = '#b8b0a4';                                    // 斧头
        ctx.beginPath();
        ctx.moveTo(x - 4, RINGY - 34); ctx.lineTo(x - 20, RINGY - 26);
        ctx.lineTo(x - 20, RINGY - 8); ctx.lineTo(x - 4, RINGY - 4); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 3.4;             // 环孔
        ctx.beginPath(); ctx.arc(x, RINGY, RR, 0, Math.PI * 2); ctx.stroke();
      }

      // 弹道
      const pts = [], rad = (ang - 20) * Math.PI / 180;
      for (let x = 0; x <= W; x += 4) {
        const y = (H - 46 - y0) - Math.tan(rad) * x + DROP * x * x;
        pts.push([x, y]);
      }
      ctx.strokeStyle = shot ? '#ffe08a' : 'rgba(255,224,138,.55)';
      ctx.lineWidth = shot ? 3.4 : 2;
      ctx.setLineDash(shot ? [] : [8, 7]);
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.setLineDash([]);

      // 每个环是否穿过
      let pass = 0;
      for (let i = 0; i < RINGS; i++) {
        const x = X0 + i * DX;
        const y = (H - 46 - y0) - Math.tan(rad) * x + DROP * x * x;
        const ok = Math.abs(y - RINGY) <= RR - 2.5;
        if (ok) pass++;
        ctx.fillStyle = ok ? 'rgba(140,220,150,.9)' : 'rgba(220,120,90,.9)';
        ctx.beginPath(); ctx.arc(x, RINGY + 32, 4, 0, Math.PI * 2); ctx.fill();
      }
      // 射手
      ctx.fillStyle = '#8c3a2a';
      ctx.beginPath(); ctx.ellipse(30, H - 46 - y0, 12, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.4; ctx.stroke();
      outlinedText(ctx, `${pass}/${RINGS}`, W - 54, 30, 22, pass === RINGS ? '#9fe0a8' : PAL.clayLt);
      return pass;
    };

    const render = () => {
      if (stage === 1) {
        host.body.innerHTML = `
          <div class="puz-intro">${this.intro}</div>
          <div class="puz-card">
            <h3 style="color:var(--bronze);margin:0 0 10px">怎么给它上弦？</h3>
            <div class="puz-list">
              ${WAYS.map(w => `<button class="puz-opt${wayPick === w.id ? ' on' : ''}" data-w="${w.id}">${w.name}</button>`).join('')}
            </div>
          </div>`;
        host.body.querySelectorAll('[data-w]').forEach(el => el.addEventListener('click', () => {
          wayPick = el.dataset.w;
          const w = WAYS.find(x => x.id === wayPick);
          host.body.querySelector('.puz-card').insertAdjacentHTML('beforeend',
            `<p class="puz-note" style="margin-top:12px">${w.ok ? '✅' : '❌'} ${w.why}</p>`);
          if (w.ok) setTimeout(() => { stage = 2; render(); }, 2200);
          else setTimeout(() => { wayPick = null; render(); }, 2600);
        }));
        host.setFoot('');
        return;
      }

      host.body.innerHTML = `
        <div class="puz-intro">
          弦上好了。你随手拨了一下——它响了一声，像燕子叫。<br>
          大厅里所有人的脸都白了。<br><br>
          <i>现在是第二步：<b>一箭穿过十二把斧子的环孔。</b><br>
          注意——<b>箭是会往下掉的。</b></i>
        </div>
        <div class="puz-card" style="text-align:center">
          <canvas id="hall" width="740" height="260"
            style="width:100%;max-width:740px;border-radius:12px;border:2px solid rgba(217,164,65,.35)"></canvas>
          <div style="max-width:520px;margin:14px auto 0;text-align:left">
            <label style="display:block;font-size:14px;margin-bottom:4px">起手高度 <b id="v1">${y0}</b></label>
            <input type="range" id="s1" min="60" max="150" value="${y0}" style="width:100%">
            <label style="display:block;font-size:14px;margin:12px 0 4px">仰角 <b id="v2">${ang}</b></label>
            <input type="range" id="s2" min="10" max="42" step="0.5" value="${ang}" style="width:100%">
          </div>
          <p class="puz-note">绿点＝穿过去了，红点＝擦在斧柄上。</p>
        </div>`;
      const s1 = document.getElementById('s1'), s2 = document.getElementById('s2');
      const upd = () => {
        y0 = +s1.value; ang = +s2.value;
        document.getElementById('v1').textContent = y0;
        document.getElementById('v2').textContent = ang;
        const pass = draw();
        const go = document.getElementById('puz-go');
        if (go) go.textContent = pass === RINGS ? '放手 ▶' : `还差 ${RINGS - pass} 个环`;
      };
      s1.addEventListener('input', upd); s2.addEventListener('input', upd);
      host.setFoot(`<button class="primary-btn big" id="puz-go">放手 ▶</button>`);
      document.getElementById('puz-go').addEventListener('click', submit);
      upd();
    };

    const submit = () => {
      const pass = draw();
      shot = true; draw();
      const ok = pass === RINGS;
      setTimeout(() => {
        host.body.innerHTML = `
          <div class="puz-card">
            <h3 style="color:var(--bronze)">${ok ? '箭从十二个环里穿了过去，钉在了对面的墙上。' : `箭穿过了 ${pass} 个环，然后钉在了第 ${pass + 1} 把斧子的柄上。`}</h3>
            <p style="line-height:2;margin-top:10px">
              ${ok ? `大厅里安静得能听见外面的风。<br><br>
                你从座位上站起来，把剩下的箭全部倒在脚边。<br>
                然后你说了这一路上最短的一句话：<br><br>
                <b>「这一场比完了。现在换个靶子。」</b>`
                : `没有人笑。<br><br>
                因为在这之前，一百零八个人连弦都上不去。<br>
                你把剩下的箭倒在脚边，站了起来。`}
            </p>
            <div style="background:rgba(217,164,65,.14);border-left:4px solid var(--bronze);
                        border-radius:0 10px 10px 0;padding:14px 16px;margin-top:16px;line-height:2">
              📖 <b>「穿过十二把斧」到底穿的是什么？</b><br>
              学界至今有争论。主流说法是斧头柄上用来悬挂的<b>圆环孔</b>——
              把斧子成排插进一条挖好的沟里，孔对齐，形成一条隧道。<br>
              原著里挖沟排斧的人是忒勒马科斯，而他<b>从来没见过这个游戏</b>，
              却一次就排得笔直——荷马特意写了这一笔。<br><br>
              真正难的其实是第一步。<b>上弦考的是技巧和角度，不是力气</b>，
              所以求婚者们一个都没做到。
            </div>
          </div>`;
        host.setFoot(`<button class="primary-btn big" id="puz-ok">站起来 ▶</button>`);
        document.getElementById('puz-ok').addEventListener('click', () => host.done(ok, { ok, pass, perfect: ok }));
      }, 700);
    };
    render();
  },
});
