// 视觉小说引擎：节点图执行 + 打字机 + 选项（带条件门与忍耐消耗）+ 立绘调度。
// 画面（背景 + 立绘）走 canvas，文本框 / 选项走 DOM —— 沿用仓库「场景 canvas、面板 DOM」的分工。
import { state, saveGame } from './state.js';
import { checkCond, condText, applyAct } from './story.js';
import { charById, charName } from './data/characters.js';
import { drawScene, W, H } from './art/scene.js';
import { drawPortrait } from './art/portrait.js';
import { fitCover } from './art/common.js';

const $ = (s, r = document) => r.querySelector(s);

let HOST = null;                 // ui.js 注入：battle / puzzle / chapterEnd / ending / hud
export function bindHost(h) { HOST = h; }

let script = null;               // 当前章脚本 { id, nodes }
let node = null;                 // 当前节点对象
let canvas = null, raf = 0, t0 = 0;
let typing = null;               // { full, n, timer }
let busy = false;                // 结算演出中，屏蔽点击

// 立绘状态：left / right 两个位置，做淡入与"说话方高亮"
const cast = { left: null, right: null };

export async function openVN(scriptId, nodeId = 'start') {
  let mod;
  try { mod = await import(`./data/script/${scriptId}.js`); }
  catch (e) {
    console.warn('章节脚本缺失', scriptId, e);
    HOST?.missingChapter?.(scriptId);
    return;
  }
  script = mod.SCRIPT;
  cast.left = cast.right = null;
  startLoop();
  goto(nodeId);
}

export function closeVN() {
  stopLoop();
  const box = $('#vn-box'); if (box) box.classList.add('hidden');
}

export function currentNode() { return node; }

// ===== 节点执行 =====
export function goto(id) {
  if (!script) return;
  const n = script.nodes[id];
  if (!n) { console.warn('VN: 找不到节点', id); return; }
  node = n; node.__id = id;
  state.node = id;

  if (n.bg) state.scene = n.bg;
  // 立绘：who 在左，right 在右；显式 null 表示退场
  if ('who' in n) cast.left = n.who ? { id: n.who, emote: n.emote || 'calm' } : null;
  if ('right' in n) cast.right = n.right ? { id: n.right, emote: n.rightEmote || 'calm' } : null;

  const fx = n.act ? applyAct(n.act) : [];
  saveGame();
  HOST?.refreshHud?.();

  // 有资源变化先演出，再显示正文。
  // 演出结束时如果已经触发了即死条件（船员归零 / 傲慢满），当场收场。
  const after = () => {
    busy = false;
    if (state.gameOver && state.ending) { closeBox(); return HOST?.showEnding?.(state.ending); }
    renderNode();
  };
  if (fx.length) { busy = true; HOST?.showEffects?.(fx, after); }
  else after();
}

function renderNode() {
  const n = node;
  // 分支节点：按条件自动跳转，不显示任何文本。
  // 用来做"这一步的结果取决于你前几章做过什么"，比硬塞一个假选项干净得多。
  if (n.branch) {
    for (const b of n.branch) if (checkCond(b.if)) return goto(b.next);
    return goto(n.next);
  }
  // 特殊跳转类节点：不显示文本框，直接交给宿主
  if (n.battle) { closeBox(); return HOST?.startBattle?.(n); }
  if (n.puzzle) { closeBox(); return HOST?.startPuzzle?.(n); }
  if (n.ending) { closeBox(); return HOST?.showEnding?.(n.ending); }
  if (n.chapterEnd) { closeBox(); return HOST?.endChapter?.(n); }

  const box = $('#vn-box');
  box.classList.remove('hidden');
  const spk = n.who ? charById(n.who) : null;
  const nameHtml = spk ? `<div class="vn-name">${escapeHtml(n.nameAs || spk.name)}</div>` : '';
  box.innerHTML = `
    ${nameHtml}
    <div class="vn-text" id="vn-text"></div>
    <div class="vn-choices" id="vn-choices" hidden></div>
    <div class="vn-next" id="vn-next" hidden>▼</div>`;
  typewrite(n.text || '');
}

function typewrite(html) {
  const el = $('#vn-text');
  stopTyping();
  const total = visibleLen(html);
  typing = { full: html, n: 0 };
  el.innerHTML = '';
  typing.timer = setInterval(() => {
    typing.n += 2;
    if (typing.n >= total) { finishTyping(); return; }
    el.innerHTML = revealHtml(html, typing.n);
  }, 16);
}

function finishTyping() {
  if (!typing) return;
  clearInterval(typing.timer);
  const el = $('#vn-text');
  if (el) el.innerHTML = typing.full;
  typing = null;
  showChoicesOrNext();
}
function stopTyping() { if (typing) { clearInterval(typing.timer); typing = null; } }

function showChoicesOrNext() {
  const n = node;
  const cbox = $('#vn-choices'), nbox = $('#vn-next');
  if (!cbox) return;
  const list = (n.choices || []).filter(c => !c.hideIf || !checkCond(c.hideIf));
  if (list.length) {
    nbox.hidden = true;
    cbox.hidden = false;
    cbox.innerHTML = list.map((c, i) => {
      const ok = checkCond(c.if);
      const cost = costLabel(c);
      const why = ok ? '' : `<span class="vn-lock">🔒 ${escapeHtml(condText(c.if))}</span>`;
      return `<button class="vn-choice${ok ? '' : ' locked'}${c.endureCost ? ' endure' : ''}" data-i="${i}" ${ok ? '' : 'disabled'}>
        <span class="vn-choice-label">${c.label}</span>${cost}${why}</button>`;
    }).join('');
    cbox.querySelectorAll('button').forEach((b, i) => {
      b.addEventListener('click', (ev) => { ev.stopPropagation(); pick(list[i]); });
    });
  } else {
    cbox.hidden = true;
    nbox.hidden = false;
  }
}

function costLabel(c) {
  const bits = [];
  if (c.endureCost) bits.push(`<span class="vn-cost">🜃 忍耐 −${c.endureCost}</span>`);
  if (c.hint) bits.push(`<span class="vn-hint">${escapeHtml(c.hint)}</span>`);
  return bits.join('');
}

function pick(c) {
  if (busy) return;
  if (!checkCond(c.if)) return;
  if (c.endureCost) {
    if (state.player.endure < c.endureCost) return;
    state.player.endure -= c.endureCost;
    HOST?.refreshHud?.();
  }
  const fx = c.act ? applyAct(c.act) : [];
  const go = () => { if (c.next) goto(c.next); else if (node.next) goto(node.next); };
  if (fx.length) { busy = true; HOST?.showEffects?.(fx, () => { busy = false; go(); }); }
  else go();
}

// 点击推进：打字中→直接显示全文；已显示完→下一节点
export function advance() {
  if (busy || !node) return;
  if (typing) { finishTyping(); return; }
  if ((node.choices || []).some(c => !c.hideIf || !checkCond(c.hideIf))) return;   // 有选项时必须选
  if (node.next) goto(node.next);
}

function closeBox() { const b = $('#vn-box'); if (b) b.classList.add('hidden'); stopTyping(); }

// ===== 画面循环 =====
export function startLoop() {
  canvas = $('#vn-canvas');
  if (!canvas || raf) return;
  t0 = performance.now();
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const t = (performance.now() - t0) / 1000;
    const v = fitCover(canvas, W, H);
    drawScene(v.ctx, state.scene || 'ship_day', t);

    // 立绘按「可见虚拟矩形」定位，而不是按 1200×700 的死坐标——
    // 否则在竖屏 iPad 上人物会被裁到画面外。
    const vw = v.vx1 - v.vx0;
    const both = cast.left && cast.right;
    // 底边压在对话框上沿再往下一点，胸口被框住是 VN 的正常构图
    const baseY = Math.min(v.vy1 - 8, boxTopVirtual(v) + 96);
    // 立绘高度按「HUD 下沿到底边」的可用空间算，头顶就不会被顶栏切掉
    const sc = portraitScale(v, baseY);
    // 只有一个人说话时，窄屏上把他往中间挪一点（宽屏留着右边给第二个人）
    const solo = vw < 620 ? 0.46 : 0.34;
    if (cast.left)  drawCast(v.ctx, cast.left,  v.vx0 + vw * (both ? 0.26 : solo), baseY, sc, both && node?.who !== cast.left.id, t);
    if (cast.right) drawCast(v.ctx, cast.right, v.vx0 + vw * (both ? 0.74 : 0.67), baseY, sc, both && node?.who !== cast.right.id, t);
  };
  raf = requestAnimationFrame(tick);
}
export function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

function drawCast(ctx, c, x, baseY, scale, dim, t) {
  const spec = charById(c.id);
  if (!spec) return;
  // 立绘背后垫一团柔和暗晕：背景是程序化画的、对比度不高，
  // 不垫这一层人物会"糊"在背景里。
  const r = 210 * scale;
  const g = ctx.createRadialGradient(x, baseY - r * 0.62, r * 0.15, x, baseY - r * 0.55, r * 1.25);
  g.addColorStop(0, 'rgba(18,12,22,0.50)');
  g.addColorStop(1, 'rgba(18,12,22,0)');
  ctx.save(); ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, baseY - r * 0.55, r * 1.25, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.save();
  if (dim) { ctx.globalAlpha = 0.55; ctx.filter = 'saturate(0.55) brightness(0.72)'; }
  drawPortrait(ctx, spec, x, baseY, scale, c.emote, t);
  ctx.restore();
}

// 对话框上沿在虚拟坐标里的位置：立绘要站在它上面
function boxTopVirtual(v) {
  const box = $('#vn-box');
  if (!box || box.classList.contains('hidden')) return v.vy1 - 340;
  const cr = canvas.getBoundingClientRect(), br = box.getBoundingClientRect();
  return v.toVY(br.top - cr.top);
}

// 立绘大小跟着可用高度走：窄屏上自动缩小，头顶不会被顶栏切掉
function portraitScale(v, baseY) {
  const hud = $('#hud');
  const cr = canvas.getBoundingClientRect();
  const hudBottom = hud ? v.toVY(hud.getBoundingClientRect().bottom - cr.top) : v.vy0 + 90;
  const avail = baseY - Math.max(v.vy0, hudBottom) - 10;
  return Math.max(0.5, Math.min(1.15, avail / 372));
}

// ===== HTML 打字机：标签整段拷贝，只对可见字符计数 =====
function visibleLen(html) {
  let n = 0, inTag = false;
  for (const ch of html) {
    if (ch === '<') inTag = true;
    else if (ch === '>') inTag = false;
    else if (!inTag) n++;
  }
  return n;
}
function revealHtml(html, count) {
  let out = '', n = 0, inTag = false;
  const open = [];
  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (ch === '<') {
      const close = html.indexOf('>', i);
      const tag = html.slice(i, close + 1);
      out += tag;
      const m = /^<\/?([a-zA-Z0-9]+)/.exec(tag);
      if (m) { if (tag[1] === '/') open.pop(); else if (!tag.endsWith('/>')) open.push(m[1]); }
      i = close;
      continue;
    }
    if (n >= count) break;
    out += ch; n++;
  }
  // 补齐未闭合标签，避免中途截断把整页样式带歪
  for (let i = open.length - 1; i >= 0; i--) out += `</${open[i]}>`;
  return out;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
