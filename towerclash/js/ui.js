// HUD：能量条、兵种按钮、路选择、顶栏、结算面板
import { UNITS, UNIT_ORDER, LANES, ECONOMY, APP_VERSION } from './data/config.js';
import { playerSpawn, canAfford } from './game.js';
import { spawnPoint } from './combat.js';

export function initUI(state, onRestart) {
  const el = {
    threat: document.getElementById('threat'),
    timer: document.getElementById('timer'),
    pips: document.getElementById('energy-pips'),
    energyNum: document.getElementById('energy-num'),
    buttons: document.getElementById('unit-buttons'),
    lanes: document.getElementById('lane-select'),
    result: document.getElementById('result'),
    resultTitle: document.getElementById('result-title'),
    resultSub: document.getElementById('result-sub'),
    restart: document.getElementById('restart-btn'),
  };

  // 能量格
  for (let i = 0; i < ECONOMY.max; i++) {
    const pip = document.createElement('div');
    pip.className = 'pip';
    el.pips.appendChild(pip);
  }

  // 兵种按钮
  const btnMap = {};
  for (const key of UNIT_ORDER) {
    const u = UNITS[key];
    const btn = document.createElement('button');
    btn.className = 'unit-btn';
    btn.dataset.key = key;
    btn.innerHTML = `
      <span class="ub-icon">${u.icon}</span>
      <span class="ub-name">${u.name}</span>
      <span class="ub-cost">⚡${u.cost}</span>
      <span class="ub-tip">${u.skill}</span>`;
    btn.addEventListener('click', () => trySpawn(key));
    el.buttons.appendChild(btn);
    btnMap[key] = btn;
  }

  // 路选择按钮
  const laneBtns = [];
  for (const lane of LANES) {
    const b = document.createElement('button');
    b.className = 'lane-btn';
    b.textContent = lane.name + '路';
    b.addEventListener('click', () => { if (spawnPoint(state, 'player', lane.id)) state.selectedLane = lane.id; });
    el.lanes.appendChild(b);
    laneBtns.push(b);
  }

  el.restart.addEventListener('click', onRestart);

  // 顶栏版本号
  const verEl = document.getElementById('version');
  if (verEl) verEl.textContent = 'v' + APP_VERSION;

  function trySpawn(key) {
    const btn = btnMap[key];
    if (playerSpawn(state, key)) {
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 150);
    } else {
      btn.classList.add('shake');
      setTimeout(() => btn.classList.remove('shake'), 250);
    }
  }

  function update() {
    const e = state.energy.player;
    // 能量格
    const pips = el.pips.children;
    for (let i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('on', i < e.value);
    }
    el.energyNum.textContent = e.value;
    // 若当前选中路已不可出兵（城楼被毁），自动切到一条可用路
    if (!spawnPoint(state, 'player', state.selectedLane)) {
      const v = [0, 1, 2].find(i => spawnPoint(state, 'player', i));
      if (v !== undefined) state.selectedLane = v;
    }
    // 按钮可用
    const tower = state.buildings.find(b => b.side === 'player' && b.kind === 'tower' && b.lane === state.selectedLane && b.alive);
    const sp = spawnPoint(state, 'player', state.selectedLane);
    for (const key of UNIT_ORDER) {
      let blocked;
      if (key === 'mage') {
        // 法师需存活城楼且未被占用，不能从主楼出
        blocked = !tower || (tower.mage && tower.mage.state !== 'dead');
      } else {
        blocked = !sp; // 该路城楼被毁且其它路尚存城楼 → 不可出兵
      }
      btnMap[key].classList.toggle('disabled', !canAfford(state, key) || blocked);
    }
    // 路按钮：高亮当前路，置灰不可出兵的路
    laneBtns.forEach((b, i) => {
      b.classList.toggle('active', i === state.selectedLane);
      b.classList.toggle('disabled', !spawnPoint(state, 'player', i));
    });
    // 顶栏
    el.threat.textContent = '威胁 Lv.' + state.threat.lv;
    const m = Math.floor(state.time / 60), s = Math.floor(state.time % 60);
    el.timer.textContent = `${m}:${String(s).padStart(2, '0')}`;
    // 结算
    if (state.over && el.result.classList.contains('hidden')) {
      el.result.classList.remove('hidden');
      const win = state.result === 'win';
      el.resultTitle.textContent = win ? '🏆 胜利！' : '💀 战败';
      el.resultTitle.className = win ? 'win' : 'lose';
      el.resultSub.textContent = win ? '骷髅主楼被摧毁，王国守住了！' : '主楼陷落……骷髅大军攻破了王城。';
    }
  }

  function reset() {
    el.result.classList.add('hidden');
  }

  return { update, reset, trySpawn };
}
