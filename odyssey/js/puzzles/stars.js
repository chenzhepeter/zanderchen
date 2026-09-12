// 第十章谜题：观星导航。
// 《奥德赛》第五卷真的写了这一段：昴星团、迟落的牧夫座、大熊座（又叫「车」），
// 以及那句「让大熊座保持在他的左手边」。这是文学史上最早的航海导航记录之一。
import { registerPuzzle } from '../puzzle.js';
import { PAL, OUTLINE, outlinedText } from '../art/common.js';

// 星座：pts 是归一化坐标（0–1），lines 是连线索引对
const CONSTS = [
  { id: 'ursa', name: '大熊座', alias: '人们也叫它「车」', at: [0.50, 0.16], scale: 1.15,
    pts: [[0, 0.5], [0.16, 0.62], [0.33, 0.6], [0.46, 0.74], [0.63, 0.62], [0.8, 0.5], [0.95, 0.62]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [3, 0]],
    hint: '七颗星，勺子的形状。它总在原地打转，<b>从来不沉进大洋里</b>。' },
  { id: 'pleiades', name: '昴星团', alias: '一小簇', at: [0.16, 0.44], scale: 0.5,
    pts: [[0.3, 0.3], [0.5, 0.22], [0.68, 0.34], [0.42, 0.5], [0.6, 0.56], [0.24, 0.6]],
    lines: [], hint: '挤在一起的一小簇暗星，像撒了一把盐。' },
  { id: 'bootes', name: '牧夫座', alias: '落得很晚', at: [0.84, 0.40], scale: 0.9,
    pts: [[0.5, 0.06], [0.26, 0.4], [0.42, 0.72], [0.62, 0.72], [0.76, 0.4]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]],
    hint: '像一只风筝。荷马说它「迟落」——沉下去得比别的星都晚。' },
  { id: 'orion', name: '猎户座', alias: '腰带上三颗', at: [0.46, 0.74], scale: 0.95,
    pts: [[0.24, 0.1], [0.76, 0.14], [0.4, 0.46], [0.5, 0.5], [0.6, 0.54], [0.28, 0.9], [0.74, 0.9]],
    lines: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]],
    hint: '猎人。腰带上那整整齐齐的三颗最好认。' },
];

const DIRS = [
  { id: 'N', name: '正北', deg: 0 }, { id: 'NE', name: '东北', deg: 45 },
  { id: 'E', name: '正东', deg: 90, ok: true }, { id: 'SE', name: '东南', deg: 135 },
  { id: 'S', name: '正南', deg: 180 }, { id: 'SW', name: '西南', deg: 225 },
  { id: 'W', name: '正西', deg: 270 }, { id: 'NW', name: '西北', deg: 315 },
];

registerPuzzle({
  id: 'stars',
  icon: '🌌',
  title: '让它留在你的左手边',
  intro: `木筏做好了。卡吕普索给了你水、酒、干粮，和一阵不伤人的风。<br><br>
    临别时她说了一句：<b>「让大熊座留在你的左手边。」</b><br><br>
    <i>十七个昼夜，你没有合过眼。<br>
    先认出它是哪一个，再决定船头朝哪儿。</i>`,
  hints: [
    '荷马点了四个名字：昴星团、迟落的牧夫座、大熊座、还有猎户座。<br>其中只有一个「从不沉入大洋」——因为它在北天极附近打转。',
    '大熊座就是北斗七星，勺子形。它永远在<b>北边</b>。',
    '现在做一道方向题：你站在船头，北在你的<b>左手边</b>。那么你的船头朝哪个方向？',
  ],
  mount(host) {
    let stage = 1, pickC = null, pickD = null;

    const skyCanvas = () => {
      const cv = host.body.querySelector('#sky');
      if (!cv) return;
      const ctx = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b1224'); g.addColorStop(1, '#1b2b45');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // 背景碎星
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 160; i++) {
        const x = (i * 137.5) % W, y = (i * 71.3) % H;
        ctx.beginPath(); ctx.arc(x, y, ((i * 7) % 10) / 8 + 0.4, 0, Math.PI * 2); ctx.fill();
      }
      // 地平线 + 海
      ctx.fillStyle = '#0a1320'; ctx.fillRect(0, H * 0.88, W, H * 0.12);
      ctx.strokeStyle = 'rgba(160,200,240,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, H * 0.88); ctx.lineTo(W, H * 0.88); ctx.stroke();

      for (const c of CONSTS) {
        const cx = c.at[0] * W, cy = c.at[1] * H, s = 150 * c.scale;
        const px = c.pts.map(p => [cx + (p[0] - 0.5) * s, cy + (p[1] - 0.5) * s * 0.8]);
        const on = pickC === c.id;
        ctx.strokeStyle = on ? PAL.bronze : 'rgba(180,210,255,.42)';
        ctx.lineWidth = on ? 2.6 : 1.6;
        for (const [a, b] of c.lines) {
          ctx.beginPath(); ctx.moveTo(px[a][0], px[a][1]); ctx.lineTo(px[b][0], px[b][1]); ctx.stroke();
        }
        for (const p of px) {
          ctx.fillStyle = on ? '#ffe8a8' : '#eaf2ff';
          ctx.beginPath(); ctx.arc(p[0], p[1], on ? 4.4 : 3.2, 0, Math.PI * 2); ctx.fill();
          ctx.save(); ctx.globalAlpha = .35; ctx.beginPath(); ctx.arc(p[0], p[1], on ? 10 : 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        outlinedText(ctx, c.name, cx, cy + s * 0.44, 15, on ? PAL.bronze : 'rgba(210,225,255,.75)', 'rgba(10,14,26,.9)');
      }
    };

    const render = () => {
      if (stage === 1) {
        host.body.innerHTML = `
          <div class="puz-intro">${this.intro}</div>
          <div class="puz-card" style="text-align:center">
            <canvas id="sky" width="820" height="380"
              style="width:100%;max-width:820px;border-radius:12px;border:2px solid rgba(217,164,65,.35)"></canvas>
            <h3 style="color:var(--bronze);margin:14px 0 8px">哪一个是大熊座？</h3>
            <div class="puz-list">
              ${CONSTS.map(c => `<button class="puz-opt${pickC === c.id ? ' on' : ''}" data-c="${c.id}">
                <b>${c.name}</b>　<span class="muted" style="color:#8f8371">${c.alias}</span>
                <div class="muted" style="color:#b9a68c;font-size:13.5px;margin-top:4px">${c.hint}</div>
              </button>`).join('')}
            </div>
          </div>`;
        skyCanvas();
        host.body.querySelectorAll('[data-c]').forEach(el => el.addEventListener('click', () => {
          pickC = el.dataset.c; render();
        }));
        host.setFoot(`<button class="primary-btn big" id="puz-go" ${pickC ? '' : 'disabled'}>就是它 ▶</button>`);
        document.getElementById('puz-go')?.addEventListener('click', () => {
          if (pickC !== 'ursa') { host.toast('再看看——哪一个「从不沉进海里」？'); return; }
          stage = 2; render();
        });
        return;
      }

      // 第二步：定船头
      host.body.innerHTML = `
        <div class="puz-intro">
          大熊座在<b>北边</b>的天上打转，一夜都不沉下去。<br>
          卡吕普索说：<b>让它留在你的左手边。</b><br><br>
          <i>你站在木筏的船头。船头该朝哪个方向？</i>
        </div>
        <div class="puz-card" style="text-align:center">
          <div style="position:relative;width:260px;height:260px;margin:0 auto">
            ${DIRS.map((d, i) => {
              const a = (d.deg - 90) * Math.PI / 180;
              const x = 130 + Math.cos(a) * 100 - 30, y = 130 + Math.sin(a) * 100 - 22;
              return `<button class="tile sm${pickD === d.id ? ' on' : ''}" data-d="${d.id}"
                style="position:absolute;left:${x}px;top:${y}px;width:60px;height:44px;font-size:13px">${d.name}</button>`;
            }).join('')}
            <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
                        font-size:32px">🛶</div>
            <div style="position:absolute;left:50%;top:6px;transform:translateX(-50%);
                        font-size:12px;color:var(--bronze)">🌌 大熊座（北）</div>
          </div>
          <p class="puz-note">${pickD ? `船头朝<b>${DIRS.find(d => d.id === pickD).name}</b>` : '点一个方向'}</p>
        </div>`;
      host.body.querySelectorAll('[data-d]').forEach(el => el.addEventListener('click', () => {
        pickD = el.dataset.d; render();
      }));
      host.setFoot(`<button class="primary-btn big" id="puz-go2" ${pickD ? '' : 'disabled'}>就这么走 ▶</button>`);
      document.getElementById('puz-go2')?.addEventListener('click', submit);
    };

    const submit = () => {
      const d = DIRS.find(x => x.id === pickD);
      const ok = !!d.ok;
      host.body.innerHTML = `
        <div class="puz-card">
          <h3 style="color:${ok ? 'var(--bronze)' : '#e58a6a'}">${ok ? '船头朝东。' : `船头朝${d.name}。`}</h3>
          <p style="line-height:2;margin-top:10px">
            ${ok ? `北在你的左手边。<br><br>
              十七个昼夜，你坐在舵边没有合过眼，眼睛一直盯着那七颗星。<br>
              第十八天，海平线上出现了一片影子——像水面上一块盾牌。<br><br>
              <i>那是斯刻里亚，淮阿喀亚人的岛。</i>`
              : `你走偏了。<br><br>
              北在左手边，船头就该朝<b>正东</b>——你可以自己在纸上比一比。<br><br>
              第十八天你还是看见了陆地，但多漂了好几天，水和干粮都见了底。`}
          </p>
          <div style="background:rgba(217,164,65,.14);border-left:4px solid var(--bronze);
                      border-radius:0 10px 10px 0;padding:14px 16px;margin-top:16px;line-height:2">
            📖 <b>第五卷的原文</b>：<br>
            「他坐在木筏上掌舵，从不合眼，一直望着昴星团、迟落的牧夫座、
            以及人们又叫作『车』的大熊座——它在原地旋转，注视着猎户，
            <b>唯独它从不沐浴在大洋之中</b>。<br>
            卡吕普索嘱咐他航海时要<b>让这颗星留在左手边</b>。」<br><br>
            <i>「从不沐浴在大洋之中」＝ 从不落到地平线以下。这是北天拱极星的准确描述——
            公元前 8 世纪的诗，天文写得一点没错。</i>
          </div>
        </div>`;
      host.setFoot(`<button class="primary-btn big" id="puz-ok">继续 ▶</button>`);
      document.getElementById('puz-ok').addEventListener('click', () => host.done(ok, { ok, perfect: ok }));
    };
    render();
  },
});
