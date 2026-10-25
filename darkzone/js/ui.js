// ui.js — DOM 接线：HUD、菜单、密码键盘、阅读弹层、结算
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.game = null;
    this.cache = { objectives: '', clues: '', prompt: '', alert: '', stance: '', can: -1, vignette: '' };
    this.keypadHandler = null;
    this.bindButtons();
  }

  bindGame(game) {
    this.game = game;
  }

  bindButtons() {
    const g = () => this.game;
    $('btn-start').addEventListener('click', () => { sfx.uiClick(); g().startGame(); });
    $('btn-help').addEventListener('click', () => { sfx.uiClick(); this.showScreen('help'); });
    $('btn-help-back').addEventListener('click', () => { sfx.uiClick(); this.showScreen('menu'); });
    $('btn-resume').addEventListener('click', () => { sfx.uiClick(); g().resume(); });
    $('btn-restart').addEventListener('click', () => { sfx.uiClick(); g().startGame(); });
    $('btn-menu').addEventListener('click', () => { sfx.uiClick(); g().toMenu(); });
    $('btn-retry').addEventListener('click', () => { sfx.uiClick(); this._retryFn && this._retryFn(); });
    $('btn-again').addEventListener('click', () => { sfx.uiClick(); g().startGame(); });
    $('btn-result-menu').addEventListener('click', () => { sfx.uiClick(); g().toMenu(); });
  }

  // ---------------- 全屏层切换 ----------------
  showScreen(name) {
    const layers = ['menu', 'help', 'pause', 'caught', 'result'];
    for (const id of layers) $(id).classList.toggle('hidden', id !== name);
    if (!name) return;
  }

  setHUDVisible(v) {
    $('hud').classList.toggle('hidden', !v);
  }

  // ---------------- Toast ----------------
  toast(text, type = 'info') {
    const layer = $('toast-layer');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.textContent = text;
    layer.appendChild(el);
    while (layer.children.length > 3) layer.removeChild(layer.firstChild);
    setTimeout(() => {
      el.classList.add('fade');
      setTimeout(() => el.remove(), 400);
    }, 3400);
  }

  // ---------------- 进度条 ----------------
  setProgress(cfg) {
    const bar = $('progress-bar');
    if (!cfg) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    $('progress-fill').style.width = Math.round(cfg.t * 100) + '%';
    $('progress-text').textContent = cfg.label;
  }

  // ---------------- HUD 同步 ----------------
  syncHUD(game) {
    const inv = game.inventory;
    const clues = game.clues;

    // 目标
    const objectives = [
      [!inv.key, '潜入办公楼（凌晨 2:47，后勤通道）'],
      [!inv.key, '茶水间：拿到小钥匙（工服挂钩）'],
      [!inv.card, '主管办公室：用钥匙打开上锁抽屉，拿门禁卡'],
      [!(clues.n1 && clues.n2), '找到档案室密码：便利贴 + 日历'],
      [game.cp < 1, 'D1 终端：刷卡 + 输入密码，进入档案室'],
      [!inv.usb, '档案室：拿起重量底座上的 U 盘'],
      [true, '穿过追捕，消防楼梯门 D6 输入 0512 撤离'],
    ];
    let currentDone = false;
    const items = objectives.map(([pending, text]) => {
      let cls = 'done';
      if (pending) {
        if (!currentDone) { cls = 'current'; currentDone = true; }
        else cls = 'todo';
      }
      return '<li class="' + cls + '">' + text + '</li>';
    }).join('');
    if (items !== this.cache.objectives) {
      $('objective-list').innerHTML = items;
      this.cache.objectives = items;
    }

    // 线索栏
    let clueHtml = '';
    if (clues.n1 && clues.n2) clueHtml += '<div class="clue-item">🔑 档案室密码：<b>0423</b></div>';
    else if (clues.n1) clueHtml += '<div class="clue-item">档案室密码 = 老婆生日（日期？）</div>';
    else if (clues.n2) clueHtml += '<div class="clue-item">4/23 老婆生日（用在哪？）</div>';
    if (clues.n3) clueHtml += '<div class="clue-item">🚪 消防门密码：<b>0512</b></div>';
    if (clueHtml !== this.cache.clues) {
      $('clue-list').innerHTML = clueHtml;
      this.cache.clues = clueHtml;
    }

    // 交互提示
    const prompt = this.describeTarget(game);
    if (prompt !== this.cache.prompt) {
      const bar = $('prompt-bar');
      if (prompt) {
        bar.innerHTML = prompt;
        bar.classList.add('show');
      } else bar.classList.remove('show');
      this.cache.prompt = prompt;
    }

    // 全局警戒
    const lvl = game.currentAlertLevel();
    let alertHtml = '', alertClass = '';
    if (game.globalState === 'hunt') {
      alertHtml = '🚨 追捕中';
      alertClass = 'l3';
    } else if (game.globalState === 'huntSearch') {
      alertHtml = '🔍 搜索中';
      alertClass = 'l3';
    } else if (lvl === 'L2') {
      alertHtml = '⚠️ 警戒';
      alertClass = 'l2';
    } else if (lvl === 'L1') {
      alertHtml = '❓ 疑惑';
      alertClass = 'l1';
    }
    const alertKey = alertHtml + alertClass;
    if (alertKey !== this.cache.alert) {
      const label = $('global-alert-label');
      label.textContent = alertHtml;
      label.className = alertClass ? 'show ' + alertClass : '';
      this.cache.alert = alertKey;
    }

    // 边缘光效
    const vig = game.globalState !== 'normal' ? 'l3' : lvl === 'L2' ? 'l2' : lvl === 'L1' ? 'l1' : '';
    if (vig !== this.cache.vignette) {
      const v = $('vignette');
      v.className = vig;
      this.cache.vignette = vig;
    }

    // 警报横幅
    $('alarm-banner').classList.toggle('hidden', game.globalState !== 'hunt');

    // 姿态
    const p = game.player;
    let icon, text;
    if (p.hidden) { icon = '🚪'; text = '藏匿中'; }
    else if (p.stance === 'crouch') { icon = '🦶'; text = '蹲伏'; }
    else if (p.running) { icon = '🏃'; text = '奔跑'; }
    else { icon = '🚶'; text = '步行'; }
    const stanceKey = icon + text;
    if (stanceKey !== this.cache.stance) {
      $('stance-icon').textContent = icon;
      $('stance-text').textContent = text;
      this.cache.stance = stanceKey;
    }
    if (inv.cans !== this.cache.can) {
      $('can-num').textContent = inv.cans;
      $('can-count').classList.toggle('hidden', inv.cans === 0);
      this.cache.can = inv.cans;
    }
  }

  describeTarget(game) {
    const t = game.currentTarget;
    if (!t) return '';
    const inv = game.inventory;
    switch (t.type) {
      case 'door': {
        const d = t.door;
        if (d.state === 'open') {
          if (d.kicked) return '';
          return '按 <b>E</b> 关门';
        }
        if (d.kind === 'keypad' || d.kind === 'exit') return '门需要通过旁边的终端解锁';
        if (game.player.stance === 'crouch') return '按住 <b>E</b> 慢开门（静音）';
        return '按 <b>E</b> 开门（3m 噪声）';
      }
      case 'switch':
        return game.lights[t.sw.region] ? '按 <b>E</b> 关灯' : '按 <b>E</b> 开灯';
      case 'hide': return '按 <b>E</b> 藏入：' + t.spot.name;
      case 'leaveHide': return '按 <b>E</b> 离开';
      case 'box': return '按 <b>E</b> 打开纸箱';
      case 'key': return '按 <b>E</b> 拾取小钥匙';
      case 'can': return '按 <b>E</b> 拾取易拉罐';
      case 'clue': return '按 <b>E</b> 阅读';
      case 'drawer': return inv.key ? '按 <b>E</b> 搜索上锁抽屉' : '抽屉锁着（需要小钥匙）';
      case 'usb': return '按 <b>E</b> 拿起 U 盘（3 秒后警报响起）';
      case 'microwave': return '按 <b>E</b> 设定微波炉（8 秒后响铃）';
      case 'terminal': return t.it.door === 'D1' ? '按 <b>E</b> 使用门禁终端' : '按 <b>E</b> 使用密码键盘';
      default: return '';
    }
  }

  // ---------------- 密码键盘 ----------------
  openKeypad(cfg) {
    const kp = $('keypad');
    $('keypad-title').textContent = cfg.title;
    $('keypad-sub').textContent = cfg.sub;
    let code = '';
    const dots = $('keypad-display').querySelectorAll('.dot');
    const render = () => {
      dots.forEach((d, i) => d.classList.toggle('filled', i < code.length));
    };
    const press = (k) => {
      sfx.uiClick();
      if (k === 'clear') code = '';
      else if (k === 'back') code = code.slice(0, -1);
      else if (code.length < 4) code += k;
      render();
    };
    const close = () => {
      kp.classList.add('hidden');
      window.removeEventListener('keydown', keyHandler);
      this.keypadHandler = null;
    };
    const submit = () => {
      if (code.length < 4) {
        const disp = $('keypad-display');
        disp.classList.add('shake');
        setTimeout(() => disp.classList.remove('shake'), 400);
        return;
      }
      const ok = cfg.onSubmit(code);
      if (ok) close();
      else {
        const disp = $('keypad-display');
        disp.classList.add('shake');
        code = '';
        render();
        setTimeout(() => disp.classList.remove('shake'), 400);
      }
    };
    const keyHandler = (e) => {
      const k = e.key;
      if (/^[0-9]$/.test(k)) press(k);
      else if (k === 'Backspace') press('back');
      else if (k === 'Enter') submit();
      else if (k === 'Escape') { cancel(); }
    };
    const cancel = () => { close(); cfg.onCancel(); };

    kp.classList.remove('hidden');
    code = '';
    render();
    window.addEventListener('keydown', keyHandler);
    $('keypad-keys').querySelectorAll('button').forEach((b) => {
      b.onclick = () => press(b.dataset.k);
    });
    $('keypad-ok').onclick = submit;
    $('keypad-cancel').onclick = cancel;
  }

  // ---------------- 阅读弹层 ----------------
  openReader(cfg, onClose) {
    const rd = $('reader');
    $('reader-title').textContent = cfg.title;
    $('reader-body').innerHTML = cfg.body.split('\n').map((l) =>
      l.trim() ? '<p>' + l + '</p>' : '<br/>').join('');
    const close = () => {
      rd.classList.add('hidden');
      window.removeEventListener('keydown', keyHandler);
      onClose && onClose();
    };
    const keyHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') close();
    };
    rd.classList.remove('hidden');
    $('reader-close').onclick = close;
    window.addEventListener('keydown', keyHandler);
  }

  // ---------------- 被抓 / 结算 ----------------
  showCaught(msg, hint, onRetry) {
    $('caught-msg').textContent = msg;
    $('caught-hint').textContent = hint;
    this._retryFn = onRetry;
    this.showScreen('caught');
  }

  showResult(cfg) {
    const rank = $('result-rank');
    rank.textContent = cfg.rankCode + ' · ' + cfg.rank;
    $('result-sub').textContent = cfg.desc;
    $('result-stats').innerHTML = cfg.stats.map(([k, v]) =>
      '<li><span>' + k + '</span><b>' + v + '</b></li>').join('');
    this.showScreen('result');
  }
}
