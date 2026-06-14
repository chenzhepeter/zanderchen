// 入口：初始化画布、游戏状态、UI、输入；运行固定步长主循环
import { createGame, update } from './game.js';
import { draw, makeView } from './render.js';
import { initUI } from './ui.js';
import { initInput } from './input.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let state = createGame();
let view = makeView(canvas);
const getView = () => view;

function resize() {
  const wrap = document.getElementById('stage');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = wrap.clientWidth, h = wrap.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  view = makeView(canvas);
}
window.addEventListener('resize', resize);
// iPad：横竖屏切换 / Stage Manager / 分屏 改变尺寸时重算画布
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// iPad/iOS：禁止双击放大与双指缩放（保留按钮单击不受影响）
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

resize();

const ui = initUI(state, restart);
initInput(canvas, state, getView, ui);

function restart() {
  const sel = state.selectedLane;
  const fresh = createGame();
  fresh.selectedLane = sel;
  // 就地替换字段，保持 state 引用不变（UI/input 已绑定该引用）
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
  ui.reset();
}

// 固定步长模拟
const STEP = 1 / 60;
let acc = 0;
let last = performance.now();

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25; // 防止切后台后大跳
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard < 8) {
    update(state, STEP);
    acc -= STEP;
    guard++;
  }
  ui.update();
  draw(ctx, state, view);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
