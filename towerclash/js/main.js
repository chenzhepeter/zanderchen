// 入口：初始化画布、游戏状态、UI、输入；运行固定步长主循环
import { createGame, update, startGame } from './game.js';
import { draw, makeView } from './render.js';
import { initUI } from './ui.js';
import { initInput } from './input.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let state = createGame('pve');
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

const ui = initUI(state, { onStart, onRestart, onMenu });
initInput(canvas, state, getView, ui);

function onStart(mode) {     // 菜单选择模式 → 开始
  startGame(state, mode);
  ui.applyMode();
  ui.hideResult();
  ui.showMenu(false);
}
function onRestart() {        // 结算面板：再来一局（同模式）
  startGame(state, state.mode);
  ui.applyMode();
  ui.hideResult();
}
function onMenu() {           // 结算面板：返回菜单
  ui.hideResult();
  state.started = false;
  ui.showMenu(true);
}

// 初始：显示开始菜单
ui.applyMode();
ui.showMenu(true);

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
