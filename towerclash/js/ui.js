// HUD：能量条、兵种按钮、路选择、顶栏、解锁提示、瞄准提示、结算面板
import { UNITS, UNIT_ORDER, LANES, ECONOMY, APP_VERSION } from './data/config.js';
import { requestUnit, canAfford, playerHasSpecial } from './game.js';
import { spawnPoint } from './combat.js';

const PENDING_HINT = {
  placeBlock: '点击自家半场道路放置路障（点对方侧取消）',
  aimSniper: '点击要狙杀的地面敌人',
  aimCatapult: '点击要轰炸的地面位置',
};

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
    toast: document.getElementById('toast'),
    aimhint: document.getElementById('aimhint'),
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
      <span class="ub-tip">${u.skill}</span>
      <span class="ub-lock">🔒<br>Lv.${u.unlock}</span>
      <span class="ub-cd"></span>`;
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

  const verEl = document.getElementById('version');
  if (verEl) verEl.textContent = 'v' + APP_VERSION;

  function showToast(msg) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.classList.remove('show');
    void el.toast.offsetWidth;
    el.toast.classList.add('show');
  }
  let prevLv = state.threat.lv;

  function trySpawn(key) {
    const btn = btnMap[key];
    const res = requestUnit(state, key);
    if (res === 'ok' || res === 'built' || res === 'pending') {
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 150);
    } else {
      btn.classList.add('shake');
      setTimeout(() => btn.classList.remove('shake'), 250);
    }
  }

  function update() {
    const e = state.energy.player;
    const pips = el.pips.children;
    for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < e.value);
    el.energyNum.textContent = e.value;

    // 选中路若不可出兵则自动换路
    if (!spawnPoint(state, 'player', state.selectedLane)) {
      const v = [0, 1, 2].find(i => spawnPoint(state, 'player', i));
      if (v !== undefined) state.selectedLane = v;
    }
    const tower = state.buildings.find(b => b.side === 'player' && b.kind === 'tower' && b.lane === state.selectedLane && b.alive);
    const sp = spawnPoint(state, 'player', state.selectedLane);

    for (const key of UNIT_ORDER) {
      const u = UNITS[key];
      const btn = btnMap[key];
      const locked = state.threat.lv < u.unlock;
      let disabled = locked, ready = false, cdText = '';
      if (!locked) {
        if (key === 'sniper' || key === 'catapult') {
          const ex = playerHasSpecial(state, key);
          if (ex) {
            if (ex.abilityTimer > 0) { disabled = true; cdText = Math.ceil(ex.abilityTimer) + 's'; }
            else { ready = true; cdText = '就绪'; }
          } else {
            disabled = !canAfford(state, key);
          }
        } else if (key === 'mage') {
          disabled = !canAfford(state, key) || !tower || (tower.mage && tower.mage.state !== 'dead');
        } else if (key === 'block') {
          disabled = !canAfford(state, key);
        } else {
          disabled = !canAfford(state, key) || !sp;
        }
      }
      btn.classList.toggle('locked', locked);
      btn.classList.toggle('ready', ready);
      btn.classList.toggle('disabled', disabled && !ready);
      const cdEl = btn.querySelector('.ub-cd');
      if (cdEl) { cdEl.textContent = cdText; cdEl.style.display = cdText ? 'flex' : 'none'; }
    }

    laneBtns.forEach((b, i) => {
      b.classList.toggle('active', i === state.selectedLane);
      b.classList.toggle('disabled', !spawnPoint(state, 'player', i));
    });

    el.threat.textContent = '威胁 Lv.' + state.threat.lv;
    const m = Math.floor(state.time / 60), s = Math.floor(state.time % 60);
    el.timer.textContent = `${m}:${String(s).padStart(2, '0')}`;

    // 升级解锁提示
    if (state.threat.lv > prevLv) {
      for (const key of UNIT_ORDER) {
        if (UNITS[key].unlock === state.threat.lv) showToast('🔓 解锁新兵种：' + UNITS[key].name + '！');
      }
    }
    prevLv = state.threat.lv;

    // 放置/瞄准提示
    if (el.aimhint) {
      const hint = state.pendingAction ? PENDING_HINT[state.pendingAction.type] : '';
      el.aimhint.textContent = hint || '';
      el.aimhint.classList.toggle('show', !!hint);
    }

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
    if (el.aimhint) el.aimhint.classList.remove('show');
    prevLv = state.threat.lv;
  }

  return { update, reset, trySpawn };
}
