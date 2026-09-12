// 入口：只做接线。type="module" 自带 defer，DOM 已就绪，不需要 DOMContentLoaded。
import * as UI from './ui.js';

// iPad：禁双击放大与捏合缩放页面（地图缩放由 render.js 自己处理）
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

UI.boot();

// 调试/自动化测试用的口子（Playwright 冒烟脚本会用）
import * as Battle from './engine/battle.js';
import * as R from './render.js';
import { state } from './state.js';
window.__korea = { Battle, UI, R, state };
