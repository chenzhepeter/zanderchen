import { bootUi } from './ui.js';
import { loadDetailedLand, drawLand } from './map.js';

document.addEventListener('DOMContentLoaded', () => {
  bootUi();
  // 异步加载真实陆地几何，加载成功后重绘陆地层
  loadDetailedLand().then(ok => {
    if (!ok) return;
    const svg = document.getElementById('world-map');
    if (svg) drawLand(svg);
  });
});
