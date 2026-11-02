import { newCampaign, update, togglePause } from './game.js';
import { autoDeploy } from './economy.js';
import { spawnEnemy } from './enemies.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { sound } from './audio.js';
import { SIDE_NAMES } from './data/config.js';

const app = { state: newCampaign(), menu: true, hasRun: false, renderer: new Renderer(document.getElementById('battlefield')) };
const demo = newCampaign(); autoDeploy(demo); demo.events = [];
for (let i = 0; i < 16; i++) { spawnEnemy(demo, { side: i % 2 ? 'north' : 'south', type: i % 3 ? 'warrior' : 'runner', lane: i % 2 }); const e = demo.enemies.at(-1); e.x = 44 + (i * 13) % 33; e.y = i % 2 ? 15 + (i % 5) : 71 + (i % 4); e.angle = i % 2 ? Math.PI / 2 : -Math.PI / 2; }
app.ui = new UI(app);
let previous = performance.now(), accumulator = 0;
let lastAutoSave = 0;
function frame(now) {
  const elapsed = Math.min(0.15, (now - previous) / 1000); previous = now;
  if (!app.menu && app.state.phase === 'combat') {
    accumulator += elapsed * app.state.speed;
    let guard = 0;
    while (accumulator >= 1 / 60 && guard++ < 20) { update(app.state, 1 / 60); accumulator -= 1 / 60; }
  } else accumulator = 0;
  if (!app.menu && app.hasRun && now - lastAutoSave > 4000) { lastAutoSave = now; app.ui.save(); }
  for (const event of app.state.events.splice(0)) {
    sound(event.type);
    if (event.type === 'breach') app.ui.toast(`${SIDE_NAMES[event.side]}侧城墙失守！步兵已撤下墙，注意内环防御`, true);
    else if (event.message) app.ui.toast(event.message, event.type === 'loss' || event.type === 'defeat');
  }
  app.ui.refresh(); app.renderer.draw(app.menu ? demo : app.state, app.ui, now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener('resize', () => app.renderer.resize());
new ResizeObserver(() => app.renderer.resize()).observe(document.querySelector('.battlefield'));
document.addEventListener('visibilitychange', () => { if (document.hidden && app.state.phase === 'combat') togglePause(app.state); });
window.addEventListener('blur', () => { if (app.state.phase === 'combat') togglePause(app.state); });
if (new URLSearchParams(location.search).get('debug') === '1') window.__starship = app;
