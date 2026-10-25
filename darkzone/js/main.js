// main.js — 引导：初始化音频、创建游戏与 UI、启动渲染循环
import { initAudio } from './audio.js';
import { Game } from './game.js';
import { UI } from './ui.js';

const ui = new UI();
const game = new Game(ui);
ui.bindGame(game);

// 调试/自动化走查钩子：仅在 ?debug=1 时挂载
if (new URLSearchParams(location.search).has('debug')) {
  window.__game = game;
  window.__ui = ui;
}

// 浏览器自动播放策略：首次交互后初始化音频
const ensureAudio = () => initAudio();
window.addEventListener('pointerdown', ensureAudio);
window.addEventListener('keydown', ensureAudio);

// 启动渲染循环（菜单阶段仅渲染背景，不更新）
game.running = true;
game.lastTs = performance.now();
requestAnimationFrame(game.loop);
