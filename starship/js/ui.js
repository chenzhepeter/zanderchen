import { APP_VERSION, DEFENDERS, SIDES, SIDE_NAMES, BUGS, RECOMMENDED_COST, POWER_LEVELS } from './data/config.js';
import { PROTOTYPE, roundTotal } from './data/rounds.js';
import { occupied, buy, relocate, repairWall, repairCore, repairDefender, sell, undo, autoDeploy, upgradeDefender, upgradeCost, availableSlots, upgradeBlockReason, moveBlockReason } from './economy.js';
import { newCampaign, startRound, nextRound, togglePause } from './game.js';
import { loadGame, saveGame, restoreCheckpoint } from './state.js';
import { initAudio, toggleSound } from './audio.js';
import { distance } from './geometry.js';
import { throwBomb } from './combat.js';

const $ = id => document.getElementById(id);
const money = n => Math.ceil(n).toLocaleString('en-US');
const clock = n => `${Math.floor(n / 60).toString().padStart(2, '0')}:${Math.floor(n % 60).toString().padStart(2, '0')}`;
const icons = { infantry: '⌖', machinegun: '╬', cannon: '◉', sam: '↟', bomb: '✹', flamethrower: '♨' };
export class UI {
  constructor(app) {
    this.app = app; this.selection = null; this.pending = null; this.hoverSlot = null; this.showRanges = false; this.lastPhase = ''; this.panelKey = ''; this.tick = 0;
    $('version').textContent = `v${APP_VERSION}`;
    document.addEventListener('click', e => { const button = e.target.closest('[data-action]'); if (button && !button.disabled) { initAudio(); this.action(button.dataset.action, button.dataset); } });
    window.addEventListener('keydown', e => {
      if (e.repeat || e.target.matches('input,textarea')) return;
      if (e.code === 'Space') { e.preventDefault(); if (!this.app.menu && !$('overlay').innerHTML) this.action('pause'); }
      if (e.key === 'Escape') { if (this.pending) { this.pending = null; this.hoverSlot = null; } else if ($('overlay').innerHTML && !this.app.menu && !['resupply', 'victory', 'defeat'].includes(this.app.state.phase)) this.action('close-help'); else if (!this.app.menu) this.action('pause'); }
      if (e.key >= '1' && e.key <= '6' && !this.app.menu && !$('overlay').innerHTML) this.action('shop', { type: Object.keys(DEFENDERS)[Number(e.key) - 1] });
    });
    const canvas = $('battlefield');
    canvas.addEventListener('pointermove', e => {
      const drag=this.drag;
      if(drag && Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5) {
        if(drag.unitId) {
          drag.moved=true;
          if(!drag.started) { drag.started=true;drag.blocked=!this.startMove(drag.unitId); }
        } else if(this.app.renderer.zoom>1 && !this.pending) {
          drag.moved=true;this.app.renderer.pan(e.clientX-drag.x,e.clientY-drag.y);
        }
      }
      if(drag) {drag.x=e.clientX;drag.y=e.clientY;}
      this.pointerWorld=this.app.renderer.toWorld(e.clientX,e.clientY);
      this.hoverSlot=this.nearestSlot(this.pointerWorld);
      canvas.style.cursor=this.pending?.mode==='bomb'?'crosshair':this.unitAt(this.pointerWorld)&&this.pending?.mode!=='move'?'pointer':this.pending?this.hoverSlot?'crosshair':'not-allowed':drag?.moved?'grabbing':this.app.renderer.zoom>1?'grab':'default';
    });
    canvas.addEventListener('pointerleave', () => { this.hoverSlot = null; });
    canvas.addEventListener('pointerdown', e => {
      if(e.button!==0)return;
      initAudio();canvas.setPointerCapture(e.pointerId);
      const point=this.app.renderer.toWorld(e.clientX,e.clientY);
      const unit=this.pending?.mode==='bomb'||this.pending?.mode==='move'?null:this.unitAt(point);
      this.drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,unitId:unit?.id};
    });
    canvas.addEventListener('pointerup', e => {
      const drag=this.drag;if(!drag)return;
      if(!drag.moved || drag.unitId&&!drag.blocked)this.clickMap(this.app.renderer.toWorld(e.clientX,e.clientY));
      this.drag=null;
    });
    canvas.addEventListener('pointercancel', () => { if(this.drag?.unitId&&this.drag.started)this.pending=null;this.drag=null; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.app.renderer.setZoom(this.app.renderer.zoom - e.deltaY * 0.001); }, { passive: false });
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); this.pending = null; this.hoverSlot = null; });
    this.showMenu(); this.refresh(true);
  }
  toast(message, danger = false) {
    if (!message) return;
    const node = document.createElement('div'); node.className = `toast${danger ? ' danger' : ''}`; node.textContent = message; $('toasts').appendChild(node);
    while ($('toasts').children.length > 3) $('toasts').firstElementChild.remove();
    setTimeout(() => node.remove(), danger ? 6000 : 3500);
  }
  save() { if (['planning', 'combat', 'paused', 'resupply', 'victory'].includes(this.app.state.phase)) { if (!saveGame(this.app.state) && !this.saveWarning) { this.saveWarning = true; this.toast('浏览器存储不可用，本次进度仅保留在页面中'); } } }
  result(result) { if (!result.ok) this.toast(result.message, true); else { this.panelKey = ''; this.save(); } return result.ok; }
  clearOverlay() { $('overlay').innerHTML = ''; }
  showMenu() {
    const app = this.app;
    if (app.state.phase === 'combat') togglePause(app.state);
    app.menu = true; this.pending = null; if (app.hasRun) this.save();
    const saved = loadGame();
    $('overlay').innerHTML = `<div class="modal"><div class="eyebrow">TACTICAL DEFENSE / 10 ROUND CAMPAIGN</div><h1>星河战队<small>孤 垒</small></h1><p class="english-title">HOLD THE OUTPOST</p><p class="description">最后一座前哨。四面不断逼近的虫群。<br>部署你的火线，在每一次补给后重整防线，守住指挥中心。</p><div class="modal-actions">${app.hasRun ? '<button class="primary-button" data-action="resume-current">返回当前战役 →</button>' : saved ? '<button class="primary-button" data-action="continue">继续战役 →</button>' : ''}<button class="${app.hasRun || saved ? 'secondary' : 'primary'}-button" data-action="new">${saved || app.hasRun ? '开始新战役' : '进入指挥部 →'}</button><button class="secondary-button" data-action="help">操作说明</button></div><div class="meta"><span>10 回合</span><span>06 类部署</span><span>四面围攻</span><span>建议横屏游玩</span></div></div>`;
  }
  action(action, data = {}) {
    const app = this.app, state = app.state;
    if (action === 'sound') { const on = toggleSound(); $('sound-button').textContent = on ? '♫' : '♪'; $('sound-button').setAttribute('aria-label', on ? '关闭音效' : '开启音效'); return; }
    if (action === 'new') { app.state = newCampaign(); app.menu = false; app.hasRun = true; this.selection = null; this.pending = null; this.lastPhase = ''; $('app').classList.remove('command-open'); this.clearOverlay(); this.save(); this.toast('选择装备后点选高亮空位，也可以使用推荐布防'); }
    else if (action === 'continue') { const saved = loadGame(); if (!saved) { this.toast('没有可恢复的有效存档', true); return; } app.state = saved; app.menu = false; app.hasRun = true; this.selection = null; this.lastPhase = ''; this.clearOverlay(); }
    else if (action === 'resume-current') { app.menu = false; this.clearOverlay(); this.lastPhase = ''; }
    else if (action === 'menu') this.showMenu();
    else if (action === 'briefing') $('app').classList.toggle('command-open');
    else if (action === 'help') {
      this.helpFromMenu = app.menu; this.helpResume = state.phase === 'combat'; if (this.helpResume) togglePause(state);
      $('overlay').innerHTML = `<div class="modal"><div class="eyebrow">FIELD MANUAL / 01</div><h2>前哨防御手册</h2><div class="help-row"><b>部署</b><span>准备与战斗中都可购买装备，再点高亮空位增援。炮塔首轮开放，使用独立炮位；第 2 回合开放防空和喷火兵。战时部署需 1.5 秒。</span></div><div class="help-row"><b>调兵 / 集火</b><span>点选守军即可使用战场内操作条，也可直接拖动到高亮空位。步兵与喷火兵可战时调动，固定武器在整备阶段搬迁。点虫子标记集火，所有武器仍遵守射程、射界和空地限制。</span></div><div class="help-row"><b>补给与维修</b><span>击杀立即获得军需，清场还有额外补给。按 5 选炸弹，再点虫群投掷；库存不足可实时购买。维修在准备阶段进行。</span></div><div class="help-row"><b>升级 / 喷火</b><span>点选守军可直接升级至 III 级；战斗或暂停时升级需改装 2 秒，期间停火。喷火兵对近距地面扇面持续喷火并灼烧，不能防空。第 7 回合起虫潮明显增强。</span></div><div class="help-row"><b>破墙</b><span>虫群会从缺口进入。幸存步兵自动撤下墙，可调往内环。指挥中心归零才算失败。</span></div><div class="help-row"><b>快捷操作</b><span>1–4 选装备 · 5 投掷炸弹 · 6 选喷火兵 · 空格暂停 · Esc/右键取消。滚轮或 +/− 缩放，放大后拖动战场。</span></div><p class="muted">准备和战斗进度自动保存。刷新后恢复战斗快照并暂停，失败可重试本回合重新布防。</p><div class="modal-actions"><button class="primary-button" data-action="close-help">明白了 →</button></div></div>`;
    }
    else if (action === 'close-help') { if (this.helpFromMenu) this.showMenu(); else { this.clearOverlay(); if (this.helpResume && state.phase === 'paused') togglePause(state); } this.helpResume = false; }
    else if (action === 'shop') {
      if (app.menu || !['planning', 'combat', 'paused'].includes(state.phase)) return;
      const cfg = DEFENDERS[data.type]; if (!cfg) return;
      if (cfg.unlock > state.roundIndex + 1) { this.toast(`${cfg.name}在第 ${cfg.unlock} 回合开放`); return; }
      if (data.type === 'bomb') {
        if (state.phase === 'planning') this.result(buy(state, 'bomb'));
        else { if (!state.bombs && !this.result(buy(state, 'bomb'))) return; this.pending = { mode: 'bomb' }; }
      } else this.pending = this.pending?.type === data.type ? null : { mode: 'buy', type: data.type };
      this.selection = null;
    }
    else if (action === 'start') {
      if (state.phase !== 'planning') return;
      if (!state.defenders.some(u => u.hp > 0)) { this.toast('先部署守军，再开始进攻', true); return; }
      this.save(); startRound(state); this.pending = null; this.selection = null;
    }
    else if (action === 'buy-bomb') this.result(buy(state, 'bomb'));
    else if (action === 'zoom-in') app.renderer.setZoom(app.renderer.zoom + 0.25);
    else if (action === 'zoom-out') app.renderer.setZoom(app.renderer.zoom - 0.25);
    else if (action === 'zoom-reset') app.renderer.setZoom(1);
    else if (action === 'auto') this.result(autoDeploy(state));
    else if (action === 'place-slot' || action === 'place-side') {
      if (!this.pending || this.pending.mode==='bomb') return;
      const unit = state.defenders.find(u => u.id === this.pending.id);
      const cfg = DEFENDERS[this.pending.type || unit?.type];
      const slot = availableSlots(state,cfg.slot,unit?.id).find(s => (action === 'place-slot' ? s.id === data.slot : s.side === data.side) && !occupied(state, s.id, unit?.id) && s.id !== unit?.slotId);
      if (slot) this.clickMap(slot); else this.toast('该方向没有可用的兼容空位', true);
    }
    else if (action === 'undo') { this.result(undo(state)); this.selection = null; this.pending = null; }
    else if (action === 'wall') { this.selection = { kind: 'wall', side: data.side }; this.pending = null; }
    else if (action === 'select-unit') this.selectUnit(data.id);
    else if (action === 'repair-wall') this.result(repairWall(state, data.side));
    else if (action === 'repair-core') this.result(repairCore(state));
    else if (action === 'upgrade') this.result(upgradeDefender(state, data.id));
    else if (action === 'repair-unit') this.result(repairDefender(state, data.id));
    else if (action === 'sell') { if (this.result(sell(state, data.id))) this.selection = null; }
    else if (action === 'move') this.startMove(data.id);
    else if (action === 'cancel') {this.pending=null;this.hoverSlot=null;}
    else if (action === 'deselect') {this.selection=null;this.pending=null;this.hoverSlot=null;}
    else if (action === 'clear-focus') state.focusId = null;
    else if (action === 'pause') { if (!app.menu) { togglePause(state); this.pending = null; } }
    else if (action === 'speed') { if (['combat', 'paused'].includes(state.phase)) state.speed = [1,1.5,2,3][([1,1.5,2,3].indexOf(state.speed)+1)%4]; }
    else if (action === 'ranges') this.showRanges = !this.showRanges;
    else if (action === 'next') { if (nextRound(state)) { this.clearOverlay(); this.selection = null; this.pending = null; this.save(); } }
    else if (action === 'retry') { if (restoreCheckpoint(state)) { this.clearOverlay(); this.selection = null; this.pending = null; this.save(); this.toast('已恢复本回合准备阶段，可以重新布防'); } }
    this.refresh(true);
  }
  unitAt(point) {
    return this.app.state.defenders.filter(u=>u.hp>0&&distance(u,point)<2.8).sort((a,b)=>distance(a,point)-distance(b,point))[0] || null;
  }
  selectUnit(id) {
    if(!this.app.state.defenders.some(u=>u.id===id&&u.hp>0))return false;
    this.selection={kind:'unit',id};this.pending=null;this.hoverSlot=null;this.panelKey='';return true;
  }
  startMove(id) {
    const state=this.app.state,unit=state.defenders.find(u=>u.id===id&&u.hp>0);
    this.selectUnit(id);
    const blocked=moveBlockReason(state,unit);
    if(blocked){this.toast(blocked,true);return false;}
    if(!availableSlots(state,DEFENDERS[unit.type].slot,id).some(s=>s.id!==unit.slotId)){this.toast('没有可用的兼容空位',true);return false;}
    this.pending={mode:'move',id};$('app').classList.remove('command-open');return true;
  }
  renderUnitButtons(state,unit) {
    const cfg=DEFENDERS[unit.type],upgradeReason=upgradeBlockReason(state,unit);
    const moveReason=moveBlockReason(state,unit)||(!availableSlots(state,cfg.slot,unit.id).some(slot=>slot.id!==unit.slotId)?'没有可用的兼容空位':'');
    const upgradeLabel=unit.refitting&&unit.deployTime>0?`改装中 ${Math.ceil(unit.deployTime)}s`:unit.level>=3?'已达 III 级':`升级至 ${unit.level===1?'II':'III'} · ${upgradeCost(unit)}`;
    const moveLabel=state.phase==='planning'?'移动 / 搬迁':cfg.mobile?'调动班组':'整备时搬迁';
    return `<button data-action="upgrade" data-id="${unit.id}" title="${upgradeReason||'提升火力与生命；战时改装 2 秒，期间停火'}" ${upgradeReason?'disabled':''}>${upgradeLabel}</button><button data-action="move" data-id="${unit.id}" title="${moveReason||'点选高亮空位，或直接拖动守军换位'}" ${moveReason?'disabled':''}>${moveLabel}</button>`;
  }
  renderUnitActions(state) {
    const unit=this.selection?.kind==='unit'?state.defenders.find(u=>u.id===this.selection.id&&u.hp>0):null;
    if(this.app.menu||!unit||!['planning','combat','paused'].includes(state.phase)||this.pending&&this.pending.mode!=='move')return '';
    const cfg=DEFENDERS[unit.type],name=`${SIDE_NAMES[unit.side]}${unit.side==='reserve'?'':'侧'} · ${cfg.name} ${['I','II','III'][(unit.level||1)-1]}`;
    if(this.pending?.mode==='move')return `<strong>${name}</strong><span class="unit-action-note">点选高亮空位完成移动</span><button data-action="cancel">取消移动</button>`;
    let note=unit.refitting&&unit.deployTime>0?state.phase==='paused'?'恢复战斗后继续改装':'改装期间暂停射击':state.phase==='planning'?'可直接拖动守军到空位':cfg.mobile?'战时升级停火 2 秒；调动期间停止射击':'战时升级停火 2 秒；固定武器仅整备时搬迁';
    const upgradeIssue=upgradeBlockReason(state,unit);if(upgradeIssue&&unit.level<3&&!unit.refitting)note=`${upgradeIssue}；${note}`;
    return `<strong>${name}</strong><div class="unit-action-buttons">${this.renderUnitButtons(state,unit)}<button data-action="deselect" aria-label="关闭单位操作">×</button></div><span class="unit-action-note">${note}</span>`;
  }
  nearestSlot(p) {
    if (!this.pending) return null;
    const state = this.app.state, u = state.defenders.find(d => d.id === this.pending.id);
    const cfg = DEFENDERS[this.pending.type || u?.type]; if (!cfg) return null;
    return availableSlots(state,cfg.slot,u?.id).filter(slot=>slot.id!==u?.slotId).map(s => ({ ...s, d: distance(s, p) })).filter(s => s.d < 3).sort((a, b) => a.d - b.d)[0] || null;
  }
  clickMap(p) {
    if (this.app.menu || $('overlay').innerHTML) return;
    const state = this.app.state;
    if (this.pending?.mode === 'bomb') {
      this.pointerWorld = p; this.result(throwBomb(state, p)); this.refresh(true); return;
    }
    const clickedUnit=this.unitAt(p);
    if(clickedUnit && (this.pending?.mode!=='move' || clickedUnit.id!==this.pending.id)) {this.selectUnit(clickedUnit.id);this.refresh(true);return;}
    if (this.pending) {
      const slot = this.nearestSlot(p);
      if (!slot) { this.toast('请选择高亮的空闲部署位'); return; }
      const result = this.pending.mode === 'buy' ? buy(state, this.pending.type, slot.id) : relocate(state, this.pending.id, slot.id);
      if (this.result(result)) {
        if (this.pending.mode === 'buy') this.selectUnit(result.id);
        else { this.selection = { kind: 'unit', id: this.pending.id }; this.pending = null; this.toast(state.phase === 'planning' ? '部署位置已调整' : '班组正在沿内环调动，移动期间停止射击'); }
      }
    } else {
      const unit = state.defenders.filter(u => u.hp > 0).filter(u => distance(u, p) < 2.4).sort((a, b) => distance(a, p) - distance(b, p))[0];
      const enemy = state.enemies.filter(e => distance(e, p) < 2.5).sort((a, b) => distance(a, p) - distance(b, p))[0];
      if (unit) this.selection = { kind: 'unit', id: unit.id };
      else if (enemy) { state.focusId = enemy.id; this.selection = { kind: 'enemy', id: enemy.id }; this.toast(`优先集火：${BUGS[enemy.type].name}`); }
      else if (p.x >= 55 && p.x <= 65 && p.y >= 40 && p.y <= 50) this.selection = { kind: 'core' };
      else if (p.x >= 36 && p.x <= 84 && p.y >= 26 && p.y <= 64 && (p.x < 40 || p.x > 80 || p.y < 30 || p.y > 60)) this.selection = { kind: 'wall', side: p.y < 30 ? 'north' : p.y > 60 ? 'south' : p.x < 40 ? 'west' : 'east' };
      else this.selection = null;
    }
    this.refresh(true);
  }
  renderSelection(state) {
    const selected = this.selection, planning = state.phase === 'planning';
    if (this.pending?.mode === 'bomb') return `<strong class="order-title">高爆炸弹 · 库存 ${state.bombs}</strong><p>点选虫群附近投掷，320 地面范围伤害，无误伤。${state.phase === 'paused' ? '恢复时间后炸弹开始飞行。' : ''}</p><div class="detail-row">投掷状态<b>${state.bombCooldown > 0 ? state.bombCooldown.toFixed(1) + 's' : '已就绪'}</b></div><div class="actions"><button data-action="buy-bomb" ${state.credits < DEFENDERS.bomb.cost ? 'disabled' : ''}>补充炸弹 · ${DEFENDERS.bomb.cost}</button><button data-action="cancel">取消瞄准</button></div>`;
    if (this.pending) {
      const cfg = this.pending.mode === 'buy' ? DEFENDERS[this.pending.type] : null;
      const moving = state.defenders.find(u => u.id === this.pending.id), kind = cfg?.slot || DEFENDERS[moving?.type]?.slot;
      const free=availableSlots(state,kind,moving?.id).filter(slot=>slot.id!==moving?.slotId);
      const positions = kind === 'air' ? ['西北外环', '东北外环', '东南外环', '西南外环', '西北内环', '东北内环', '东南内环', '西南内环'].map((name, i) => `<button data-action="place-slot" data-slot="air-${i}" ${free.some(p=>p.id===`air-${i}`) ? '' : 'disabled'}>${name}</button>`).join('') : [...SIDES, ...(kind === 'infantry' ? ['reserve'] : [])].map(side => `<button data-action="place-side" data-side="${side}" ${free.some(p=>p.side===side) ? '' : 'disabled'}>${SIDE_NAMES[side]}${side === 'reserve' ? '预备位' : '侧'} · ${free.filter(p=>p.side===side).length} 空位</button>`).join('');
      return `<strong class="order-title">${cfg ? `部署 ${cfg.name} / ${cfg.cost} 点` : '调动部队'}</strong><p>${cfg ? cfg.description : '点选高亮空位。战斗中需要真实移动，途中停止射击。'}</p><div class="actions">${positions}</div><div class="actions"><button data-action="cancel">取消指令 · Esc</button></div>`;
    }
    if (selected?.kind === 'wall') { const wall = state.walls[selected.side], cost = wall.hp <= 0 ? 120 : 20; return `<h3>${SIDE_NAMES[selected.side]}侧防线</h3><div class="detail-row">耐久<b>${money(wall.hp)} / ${wall.maxHp}</b></div><p>${wall.hp <= 0 ? '地面虫会从缺口进入，步兵请回防内环。重建可恢复至 600 耐久。' : '墙体为火力争取时间，每次维修恢复 200 耐久。'}</p>${planning ? `<div class="actions"><button data-action="repair-wall" data-side="${selected.side}" ${wall.hp >= wall.maxHp || state.credits < cost ? 'disabled' : ''}>${wall.hp <= 0 ? '重建' : '维修'} · ${cost} 点</button></div>` : '<p class="accent">补给到达后可修复</p>'}`; }
    if (selected?.kind === 'core') return `<h3>指挥中心</h3><div class="detail-row">耐久<b>${money(state.core.hp)} / ${state.core.maxHp}</b></div><p>守住它即可继续战斗。每次整备可支付 40 点恢复 200 耐久，限一次。</p>${planning ? `<button data-action="repair-core" ${state.coreRepaired || state.core.hp >= state.core.maxHp || state.credits < 40 ? 'disabled' : ''}>维修 · 40 点</button>` : ''}`;
    if (selected?.kind === 'enemy') { const e = state.enemies.find(e => e.id === selected.id); return e ? `<h3>${BUGS[e.type].name}</h3><div class="detail-row">生命<b>${money(e.hp)} / ${e.maxHp}</b></div><p>${e.type === 'armor' ? '甲壳抵消 65% 子弹伤害，使用炮弹和高爆炸弹。' : BUGS[e.type].air ? '飞行单位可以越墙，优先使用防空导弹。' : '地面目标受完整城墙阻挡。'}</p><button data-action="clear-focus">取消优先集火</button>` : '<p>目标已被消灭。点选新的目标设置集火。</p>'; }
    if (selected?.kind === 'unit') {
      const unit=state.defenders.find(u=>u.id===selected.id&&u.hp>0);
      if(!unit){this.selection=null;return '<p>单位已失联。</p>';}
      const cfg=DEFENDERS[unit.type],repair=Math.ceil(cfg.cost*0.25),refund=Math.floor(cfg.cost*(1+(unit.level>1?0.8:0)+(unit.level>2?1.2:0))*(unit.veteran?0.4:1));
      return `<h3>${cfg.name} ${['I','II','III'][unit.level-1]} · ${SIDE_NAMES[unit.side]}侧</h3><div class="detail-row">生命<b>${money(unit.hp)} / ${unit.maxHp}</b></div><div class="detail-row">累计伤害<b>${money(unit.damageDealt||0)}</b></div><div class="detail-row">火力倍率<b>×${POWER_LEVELS[unit.level-1]}</b></div><p>${unit.status||cfg.description}</p><div class="actions">${this.renderUnitButtons(state,unit)}${planning?`<button data-action="repair-unit" data-id="${unit.id}" ${unit.hp>=unit.maxHp||state.credits<repair?'disabled':''}>修理 · ${repair}</button><button data-action="sell" data-id="${unit.id}">撤除 · +${refund}</button>`:''}</div><p>也可用战场内操作条，或直接拖动守军换位。${!planning&&!cfg.mobile?'固定武器仅整备时搬迁。':''}</p>`;
    }
    return `<p>${planning ? '点选下方装备，再点战场高亮空位。选中墙体或守军可维修与调整部署。' : state.phase === 'paused' ? '时间暂停。可购买增援、投掷炸弹或调动步兵，恢复后执行。' : '击杀获得军需，实时购买增援。按 5 投掷炸弹；点虫子可集火，步兵可调往薄弱防线。'}</p>${planning && state.roundIndex === 0 && !state.defenders.length ? `<button data-action="auto" class="accent">使用推荐布防 · ${RECOMMENDED_COST} 点</button>` : ''}`;
  }
  showReport(state) {
    const report = state.report, final = state.phase === 'victory';
    if (state.phase === 'defeat') { $('overlay').innerHTML = `<div class="modal"><div class="eyebrow">SIGNAL LOST / OUTPOST 07</div><h2>指挥中心失守</h2><p class="description">第 ${state.roundIndex + 1} 回合 · 已击退 ${state.roundStats.kills} 只虫。<br>从本回合准备阶段重试，可以重新分配军需与布防。</p><p class="muted">${state.walls.east.hp <= 0 || state.walls.west.hp <= 0 ? '侧面防线出现缺口。尝试调动机枪、预留内环班组，并优先修复残墙。' : '留意空中威胁和墙体耐久。炮塔对重甲更有效，暂停后可查看各方向。'}</p><div class="modal-actions"><button data-action="retry" class="primary-button">重新布防 →</button><button data-action="menu" class="secondary-button">返回菜单</button></div></div>`; return; }
    if (!report) return;
    const damage = Object.entries(report.damage).sort((a, b) => b[1] - a[1]), max = Math.max(1, ...damage.map(d => d[1]));
    $('overlay').innerHTML = `<div class="modal"><div class="eyebrow">${final ? 'MISSION COMPLETE / CAMPAIGN 10' : `ROUND ${report.round.toString().padStart(2, '0')} / SUPPLY INBOUND`}</div><h2>${final ? '前哨守住了' : '补给已经抵达'}</h2><p class="description">${final ? '十回合防守完成，撤离舰已接回守军。<br>你守住了前哨，也撑过了最后的总攻。' : `“${report.name}”已完成。幸存单位恢复 20% 生命，存活墙体恢复 80 耐久。<br>下一回合：${PROTOTYPE.rounds[state.roundIndex + 1].name}。`}</p><div class="stat-grid"><div><span>本轮补给</span><strong>+${report.supply}</strong></div><div><span>本轮击退</span><strong>${report.kills}</strong></div><div><span>当前军需</span><strong>${money(state.credits)}</strong></div></div><div class="report-details">炸弹投掷 ${report.bombsUsed || 0} 次 · 击杀补给 +${report.earned || 0} · 核心损伤 ${report.coreLost} · ${report.broken.length ? `${report.broken.map(s => SIDE_NAMES[s]).join(' / ')}侧墙体待重建` : '四面墙体仍在'}${final ? `<br>累计击退 ${state.stats.kills} · 守军损失 ${state.stats.lost} · 重试 ${state.stats.retries}` : ''}</div><div class="report-bars">${damage.map(([type, value]) => `<div class="report-bar"><span>${DEFENDERS[type].name}</span><i style="width:${value / max * 100}%"></i><span>${money(value)}</span></div>`).join('')}</div><div class="modal-actions"><button data-action="${final ? 'new' : 'next'}" class="primary-button">${final ? '开始新战役' : '整备下一回合'} →</button><button data-action="menu" class="secondary-button">返回菜单</button></div></div>`;
  }
  refresh(force = false) {
    const state = this.app.state, round = PROTOTYPE.rounds[state.roundIndex];
    if (!this.app.menu && state.phase !== this.lastPhase) {
      this.lastPhase = state.phase; this.pending = null; this.panelKey = '';
      if (['resupply', 'victory', 'defeat'].includes(state.phase)) { this.showReport(state); this.save(); }
      else if (['planning', 'combat'].includes(state.phase)) this.clearOverlay();
    }
    if (!force && ++this.tick % 6) return;
    $('credits').textContent = money(state.credits); $('kill-income').textContent = '+' + money(state.roundStats.earned || 0); $('core-hp').textContent = `${Math.ceil(state.core.hp / state.core.maxHp * 100)}%`;
    $('core-hp').style.color = state.core.hp < state.core.maxHp * 0.3 ? 'var(--red)' : '';
    $('phase-label').textContent = { planning: '准备阶段 / 部署与维修', combat: '战斗进行中 / 可实时增援', paused: '战术暂停 / 可下达指令', resupply: '回合完成 / 补给到达', victory: '任务完成', defeat: '基地失守' }[state.phase];
    $('round-label').textContent = `ROUND ${String(state.roundIndex + 1).padStart(2, '0')} / ${String(PROTOTYPE.rounds.length).padStart(2, '0')}`;
    $('map-time').textContent = state.phase === 'planning' ? 'T− PREPARATION' : `T+ ${clock(state.time)}`;
    const briefingKey = `${state.roundIndex}-${state.phase}`;
    if (this.briefingKey !== briefingKey) { this.briefingKey = briefingKey; $('briefing').innerHTML = `<span class="eyebrow">MISSION ${String(state.roundIndex + 1).padStart(2, '0')} / ${state.phase === 'planning' ? 'BRIEFING' : 'LIVE'}</span><h2>${round.name}</h2><div>${round.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div><p>主攻：${round.mainSides.map(s => SIDE_NAMES[s]).join('、')}侧<br>${round.tip}</p><div class="threat-level ${state.roundIndex>=6?'danger':''}">虫体强度 ×${round.threat.health.toFixed(2)} · ${roundTotal(round)} 只${state.roundIndex>=6 ? ' · 高危波次' : ''}</div>`; }
    const wallMarkup = SIDES.map(side => { const w = state.walls[side], pct = Math.ceil(w.hp / w.maxHp * 100); return `<button class="wall-card ${pct <= 0 ? 'breached' : pct < 50 ? 'damaged' : ''} ${this.selection?.side === side ? 'chosen' : ''}" data-action="wall" data-side="${side}"><span class="row"><span>${SIDE_NAMES[side]}侧防线</span><strong>${pct > 0 ? `${pct}%` : '缺口'}</strong></span><div class="health-track"><i style="width:${Math.max(0, pct)}%"></i></div></button>`; }).join('');
    if (wallMarkup !== this.wallMarkup) { this.wallMarkup = wallMarkup; $('wall-list').innerHTML = wallMarkup; }
    const living = state.defenders.filter(u => u.hp > 0), roster = living.map(u => `<button data-action="select-unit" data-id="${u.id}">${SIDE_NAMES[u.side]}${u.side === 'reserve' ? '' : '侧'}·${DEFENDERS[u.type].name} ${['I','II','III'][(u.level||1)-1]}<span>${Math.ceil(u.hp / u.maxHp * 100)}%</span></button>`).join('');
    if (this.rosterMarkup !== roster) { this.rosterMarkup = roster; $('roster-list').innerHTML = roster || '<p>尚未部署守军</p>'; $('roster-count').textContent = living.length; }
    const dockMarkup=this.renderUnitActions(state);const dock=$('unit-actions');
    const dockUnit=this.selection?.kind==='unit'?state.defenders.find(u=>u.id===this.selection.id):null, camera=this.app.renderer;
    dock.classList.toggle('dock-top',!!(dockUnit&&camera?.view&&dockUnit.y*camera.view.scale+camera.view.oy>camera.height-240));
    dock.classList.toggle('hidden',!dockMarkup);if(dockMarkup!==this.dockKey){this.dockKey=dockMarkup;dock.innerHTML=dockMarkup;}
    const panel = this.renderSelection(state); if (panel !== this.panelKey) { this.panelKey = panel; $('selection-panel').innerHTML = panel; }
    const shopKey = `${state.roundIndex}-${state.phase}-${state.credits}-${state.bombs}-${this.pending?.type}-${this.pending?.mode}`;
    if (shopKey !== this.shopKey) {
      this.shopKey = shopKey;
      $('shop').innerHTML = Object.entries(DEFENDERS).map(([type, cfg], i) => {
        const locked = cfg.unlock > state.roundIndex + 1;
        const active = this.pending?.type === type || type === 'bomb' && this.pending?.mode === 'bomb';
        const permitted = ['planning', 'combat', 'paused'].includes(state.phase);
        const affordable = type === 'bomb' && state.phase !== 'planning' ? state.bombs > 0 || state.credits >= cfg.cost : state.credits >= cfg.cost;
        return `<button class="shop-card ${locked ? 'locked' : ''} ${active ? 'active' : ''}" data-action="shop" data-type="${type}" title="${cfg.description}" ${!permitted || !affordable || locked ? 'disabled' : ''}><span class="hotkey">${i + 1}</span><span class="unit-icon">${icons[type]}</span><span><span class="shop-name">${cfg.name}${type === 'bomb' ? ' ×' + state.bombs : ''}</span><span class="shop-cost">${locked ? `第 ${cfg.unlock} 回合开放` : type === 'bomb' && state.phase !== 'planning' ? `投掷 / ${cfg.cost}` : `${cfg.cost} 军需`}</span></span></button>`;
      }).join('');
    }
    const total = roundTotal(round), done = Math.max(0, state.roundStats.kills), left = state.enemies.length, next = state.spawnQueue[state.spawnIndex];
    const roundBadge = `<b class="round-badge">${state.roundIndex + 1}/${PROTOTYPE.rounds.length}</b>`;
    $('phase-strip').innerHTML = state.phase === 'planning' ? `<div>${roundBadge}<span class="phase-text">${this.pending ? this.pending.mode === 'bomb' ? '点选虫群投掷炸弹' : '点选高亮空位 · Esc 取消' : '部署就绪后，开始进攻'}</span></div>${state.roundIndex === 0 && !state.defenders.length ? `<button data-action="auto">推荐布防 · ${RECOMMENDED_COST} 点</button>` : `<span>${total} 个目标 · 补给 +${round.supply}</span>`}` : `<div>${roundBadge}<span class="phase-text">${this.pending?.mode === 'bomb' ? '点选虫群投掷炸弹' : state.phase === 'paused' ? '战术暂停 · 可部署增援' : `击退 ${done} / ${total}`}</span><div class="round-progress"><i style="width:${Math.min(100, done / total * 100)}%"></i></div></div><span>当前 ${left} · ${next ? `后续 ${Math.max(0, Math.ceil(next.at - state.time))}s` : '全部出发'}</span>`;
    $('speed-button').textContent = `${state.speed}× 速度`; $('ranges-button').classList.toggle('active', this.showRanges);
    $('pause-button').textContent = state.phase === 'paused' ? '▶' : 'Ⅱ';
    $('start-button').disabled = state.phase !== 'planning'; $('undo-button').disabled = state.phase !== 'planning' || !state.history.length;
    const hint = $('placement-hint'); hint.classList.toggle('hidden', !this.pending);
    if (this.pending) hint.textContent = this.pending.mode === 'bomb' ? `点选落点投掷炸弹 · 库存 ${state.bombs} · 5.5m 爆炸范围` : this.pending.mode === 'buy' ? `部署 ${DEFENDERS[this.pending.type].name} · 点选高亮空位` : state.phase === 'planning' ? '调整部署 · 点选兼容空位' : '调动班组 · 点选空位或内环预备位';
  }
}
