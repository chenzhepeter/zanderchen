// 入口：注入 UI 到 story（避免模块循环）、启动界面、iPad 手势适配
import * as UI from './ui.js';
import { bindUI } from './story.js';

bindUI(UI);

// iPad/iOS：禁止双击放大与双指缩放（按钮单击不受影响）
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

// type="module" 天然 defer，DOM 此时已就绪
UI.boot();
