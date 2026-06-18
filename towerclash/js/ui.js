// HUD：每侧一套（能量条/路选择/兵种按钮/瞄准提示）+ 共享顶栏/解锁提示/菜单/结算
import { UNITS, UNIT_ORDER, LANES, ECONOMY, APP_VERSION } from './data/config.js';
import { requestUnit, canAfford, hasSpecial } from './game.js';
import { spawnPoint } from './combat.js';

const PENDING_HINT = {
  placeBlock: '点击自家半场道路放置路障（点对方侧取消）',
  aimSniper: '点击要狙杀的地面敌人',
  aimCatapult: '点击要轰炸的地面位置',
};

// 为某一侧在容器内构建一套 HUD，返回 { update, trySpawn }
function createHud(state, side, container) {
  container.innerHTML = `
    <div class="hud-hint"></div>
    <div class="lane-col">
      <div class="lane-label">出兵路</div>
      <div class="lane-select"></div>
    </div>
    <div class="energy">
      <div class="pips"></div>
      <div class="energy-num">⚡<span class="energy-val">5</span></div>
    </div>
    <div class="unit-buttons"></div>`;

  const hintEl = container.querySelector('.hud-hint');
  const laneSel = container.querySelector('.lane-select');
  const pipsEl = container.querySelector('.pips');
  const energyVal = container.querySelector('.energy-val');
  const btnWrap = container.querySelector('.unit-buttons');

  for (let i = 0; i < ECONOMY.max; i++) {
    const pip = document.createElement('div');
    pip.className = 'pip';
    pipsEl.appendChild(pip);
  }

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
    btnWrap.appendChild(btn);
    btnMap[key] = btn;
  }

  const laneBtns = [];
  for (const lane of LANES) {
    const b = document.createElement('button');
    b.className = 'lane-btn';
    b.textContent = lane.name + '路';
    b.addEventListener('click', () => { if (spawnPoint(state, side, lane.id)) state.selected[side] = lane.id; });
    laneSel.appendChild(b);
    laneBtns.push(b);
  }

  function trySpawn(key) {
    const btn = btnMap[key];
    const res = requestUnit(state, side, key);
    if (res === 'ok' || res === 'built' || res === 'pending') {
      btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 150);
    } else {
      btn.classList.add('shake'); setTimeout(() => btn.classList.remove('shake'), 250);
    }
  }

  function update() {
    const e = state.energy[side];
    for (let i = 0; i < pipsEl.children.length; i++) pipsEl.children[i].classList.toggle('on', i < e.value);
    energyVal.textContent = e.value;

    if (!spawnPoint(state, side, state.selected[side])) {
      const v = [0, 1, 2].find(i => spawnPoint(state, side, i));
      if (v !== undefined) state.selected[side] = v;
    }
    const tower = state.buildings.find(b => b.side === side && b.kind === 'tower' && b.lane === state.selected[side] && b.alive);
    const sp = spawnPoint(state, side, state.selected[side]);

    for (const key of UNIT_ORDER) {
      const u = UNITS[key];
      const btn = btnMap[key];
      const locked = state.threat.lv < u.unlock;
      let disabled = locked, ready = false, cdText = '';
      if (!locked) {
        if (key === 'sniper' || key === 'catapult') {
          const ex = hasSpecial(state, side, key);
          if (ex) {
            if (ex.abilityTimer > 0) { disabled = true; cdText = Math.ceil(ex.abilityTimer) + 's'; }
            else { ready = true; cdText = '就绪'; }
          } else disabled = !canAfford(state, side, key);
        } else if (key === 'mage') {
          disabled = !canAfford(state, side, key) || !tower || (tower.mage && tower.mage.state !== 'dead');
        } else if (key === 'block') {
          disabled = !canAfford(state, side, key);
        } else {
          disabled = !canAfford(state, side, key) || !sp;
        }
      }
      btn.classList.toggle('locked', locked);
      btn.classList.toggle('ready', ready);
      btn.classList.toggle('disabled', disabled && !ready);
      const cdEl = btn.querySelector('.ub-cd');
      if (cdEl) { cdEl.textContent = cdText; cdEl.style.display = cdText ? 'flex' : 'none'; }
    }

    laneBtns.forEach((b, i) => {
      b.classList.toggle('active', i === state.selected[side]);
      b.classList.toggle('disabled', !spawnPoint(state, side, i));
    });

    const a = state.pending[side];
    const hint = a ? PENDING_HINT[a.type] : '';
    hintEl.textContent = hint || '';
    hintEl.classList.toggle('show', !!hint);
  }

  return { update, trySpawn };
}

export function initUI(state, handlers) {
  const el = {
    threat: document.getElementById('threat'),
    timer: document.getElementById('timer'),
    legendE: document.getElementById('legend-e'),
    legendP: document.getElementById('legend-p'),
    toast: document.getElementById('toast'),
    result: document.getElementById('result'),
    resultTitle: document.getElementById('result-title'),
    resultSub: document.getElementById('result-sub'),
    restart: document.getElementById('restart-btn'),
    menuBtn: document.getElementById('menu-btn'),
    menu: document.getElementById('menu'),
    pve: document.getElementById('mode-pve'),
    pvp: document.getElementById('mode-pvp'),
    hudTop: document.getElementById('hud-top'),
  };
  const verEl = document.getElementById('version');
  if (verEl) verEl.textContent = 'v' + APP_VERSION;

  el.pve.addEventListener('click', () => handlers.onStart('pve'));
  el.pvp.addEventListener('click', () => handlers.onStart('pvp'));
  el.restart.addEventListener('click', () => handlers.onRestart());
  el.menuBtn.addEventListener('click', () => handlers.onMenu());

  const hudBottom = createHud(state, 'player', document.getElementById('hud-bottom'));
  const hudTop = createHud(state, 'enemy', document.getElementById('hud-top'));

  let prevLv = state.threat.lv;
  function showToast(msg) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.classList.remove('show');
    void el.toast.offsetWidth;
    el.toast.classList.add('show');
  }

  function updateShared() {
    const pvp = state.mode === 'pvp';
    el.threat.textContent = (pvp ? '等级 Lv.' : '威胁 Lv.') + state.threat.lv;
    const m = Math.floor(state.time / 60), s = Math.floor(state.time % 60);
    el.timer.textContent = `${m}:${String(s).padStart(2, '0')}`;
    el.legendE.textContent = pvp ? '玩家2' : '骷髅';
    el.legendP.textContent = pvp ? '玩家1' : '玩家';

    if (state.started && state.threat.lv > prevLv) {
      for (const key of UNIT_ORDER) {
        if (UNITS[key].unlock === state.threat.lv) showToast('🔓 解锁新兵种：' + UNITS[key].name + '！');
      }
    }
    prevLv = state.threat.lv;

    if (state.over && el.result.classList.contains('hidden')) {
      el.result.classList.remove('hidden');
      const win = state.result === 'win'; // 敌(右)主楼倒
      if (pvp) {
        el.resultTitle.textContent = win ? '🏆 玩家1 胜利！' : '🏆 玩家2 胜利！';
        el.resultTitle.className = 'win';
        el.resultSub.textContent = win ? '玩家2 的主楼被摧毁！' : '玩家1 的主楼被摧毁！';
      } else {
        el.resultTitle.textContent = win ? '🏆 胜利！' : '💀 战败';
        el.resultTitle.className = win ? 'win' : 'lose';
        el.resultSub.textContent = win ? '骷髅主楼被摧毁，王国守住了！' : '主楼陷落……骷髅大军攻破了王城。';
      }
    }
  }

  function update() {
    hudBottom.update();
    if (state.mode === 'pvp') hudTop.update();
    updateShared();
  }

  function applyMode() {
    el.hudTop.style.display = state.mode === 'pvp' ? '' : 'none';
  }

  function showMenu(show) { el.menu.classList.toggle('hidden', !show); }
  function hideResult() { el.result.classList.add('hidden'); prevLv = state.threat.lv; }

  return { update, applyMode, showMenu, hideResult, trySpawnPlayer: hudBottom.trySpawn };
}
