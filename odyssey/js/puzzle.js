// 谜题宿主 + 注册表。仿 blackbeard/js/facilities.js 的 registerRender 模式：
// 每个谜题只管自己的 mount(host)，进出场、提示、结算统一在这里做。
//
// 谜题定义：{ id, title, intro, hints: [...], mount(host) }
// host：{ body, foot, done(ok, extra), toast, setFoot(html), solved() }
const REGISTRY = {};
export function registerPuzzle(def) { REGISTRY[def.id] = def; }
export function getPuzzle(id) { return REGISTRY[id]; }

const $ = (s, r = document) => r.querySelector(s);

let HOST = null;
export function bindHost(h) { HOST = h; }

let current = null;

export async function startPuzzle({ puzzleId, onDone }) {
  // 谜题实现按需加载，避免开局就把 13 个谜题全拉进来
  if (!REGISTRY[puzzleId]) {
    try { await import(`./puzzles/${puzzleId}.js`); }
    catch (e) { console.warn('谜题加载失败', puzzleId, e); onDone?.({ ok: true, skipped: true }); return; }
  }
  const def = REGISTRY[puzzleId];
  if (!def) { onDone?.({ ok: true, skipped: true }); return; }

  current = { def, onDone, hintIdx: 0 };
  $('#puzzle-screen').classList.remove('hidden');
  $('#puz-title').textContent = `${def.icon || '🧩'} ${def.title}`;
  $('#puz-foot').innerHTML = '';
  $('#puz-body').innerHTML = def.intro ? `<div class="puz-intro">${def.intro}</div>` : '';

  const hintBtn = $('#puz-hint');
  hintBtn.disabled = !(def.hints || []).length;
  hintBtn.onclick = showHint;

  def.mount(makeHost());
}

function makeHost() {
  return {
    body: $('#puz-body'),
    foot: $('#puz-foot'),
    setFoot: (html) => { $('#puz-foot').innerHTML = html; },
    toast: (m) => HOST?.toast?.(m),
    done: (ok, extra = {}) => finish(ok, extra),
  };
}

function showHint() {
  const c = current; if (!c) return;
  const hints = c.def.hints || [];
  if (c.hintIdx >= hints.length) { HOST?.toast?.('雅典娜不再说话了——剩下的要你自己想。'); return; }
  const h = hints[c.hintIdx++];
  HOST?.openModal?.({
    title: '🦉 雅典娜的低语',
    body: `<div style="line-height:2">${h}</div>
      <p class="muted" style="margin-top:12px">还可以再问 ${hints.length - c.hintIdx} 次。</p>`,
    actions: [{ label: '知道了', primary: true, onClick: () => HOST?.closeModal?.() }],
  });
}

function finish(ok, extra) {
  const c = current;
  if (!c) return;
  current = null;
  $('#puzzle-screen').classList.add('hidden');
  $('#puz-body').innerHTML = '';
  $('#puz-foot').innerHTML = '';
  c.onDone?.({ ok, ...extra });
}

// 谜题里反复用到的小控件
export function tileRow(items, cls = '') {
  return `<div class="tile-row">${items.map(i =>
    `<button class="tile ${cls} ${i.cls || ''}" data-v="${i.v}">${i.label}</button>`).join('')}</div>`;
}
