// game.js — 主逻辑：输入、状态机调度、解密交互、检查点、渲染
import { RULESET as C } from './config.js';
import {
  WALLS, REGIONS, DOORS, LIGHT_SWITCHES, LOW_BLOCKERS, HIGH_BLOCKERS,
  HIDING_SPOTS, INTERACTABLES, PATROLS, PHASE_RESET,
  doorCenter, doorSegment, regionAt,
} from './level.js';
import {
  dist, blocked, findPath, wallsCrossed, D2R, resolveCollision,
} from './geom.js';
import { guardVision, conePolygon, FogOfWar } from './vision.js';
import { Guard } from './guards.js';
import { Player } from './player.js';
import { sfx } from './audio.js';

export class Game {
  constructor(ui) {
    this.ui = ui;
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.fog = new FogOfWar();
    this.input = { keys: new Set(), mouse: { x: 0, y: 0 }, mouseWorld: null, rightDown: false };
    this.scale = C.RENDER.baseScale;
    this.camera = { x: 4, y: 1.5 };
    this.running = false;
    this.lastTs = 0;
    this.phase = 'menu'; // menu / play / paused / keypad / reader / caught / won
    this.bindInput();
    this.resize();
    this.resetWorld();
  }

  // ---------------- 世界初始化 ----------------
  resetWorld() {
    this.doors = DOORS.map((d) => ({ ...d }));
    this.doorById = Object.fromEntries(this.doors.map((d) => [d.id, d]));
    this.lights = {};
    for (const r of REGIONS) this.lights[r.id] = r.light === 'bright';
    this.player = new Player();
    this.guards = PATROLS.map((p) => new Guard(p));
    this.fog.reset();
    this.inventory = { key: false, card: false, usb: false, cans: 0 };
    this.clues = { n1: false, n2: false, n3: false };
    this.taken = new Set();
    this.evidence = [];
    this.globalState = 'normal'; // normal / hunt / huntSearch
    this.whistleTimer = 0;
    this.loseSightTimer = 0;
    this.huntSearchTimer = 0;
    this.globalLKP = null;
    this.searchSpotQueue = [];
    this.cp = 0;
    this.stats = { startTime: 0, elapsed: 0, maxLevel: 'L0', evidenceL2: false, hunt: false, captures: 0 };
    this.action = null; // 当前按住 E 的动作
    this.flying = null;
    this.microwaveTimer = 0;
    this.aiming = false;
    this.aimPoint = null;
    this.heartbeatT = 0;
    this.d1 = { swiped: false, unlocked: false };
    this.activeWallsCache = null;
    this._frameSeen = false;
  }

  startGame() {
    this.resetWorld();
    this.stats.startTime = performance.now();
    this.phase = 'play';
    this.ui.showScreen(null);
    this.ui.setHUDVisible(true);
    this.ui.setProgress(null);
    this.ui.toast('WASD 移动 · 鼠标控制朝向 · Shift 奔跑 · C 蹲伏 · E 交互', 'info');
    if (!this.running) {
      this.running = true;
      this.lastTs = performance.now();
      requestAnimationFrame(this.loop);
    }
  }

  // ---------------- 输入 ----------------
  bindInput() {
    const norm = (e) => e.key.toLowerCase();
    window.addEventListener('keydown', (e) => {
      const k = norm(e);
      if (['w', 'a', 's', 'd', 'shift', 'c', 'e', ' '].includes(k)) e.preventDefault();
      if (k === 'escape' || k === 'p') {
        if (this.phase === 'play') this.pause();
        else if (this.phase === 'paused') this.resume();
        return;
      }
      if (this.phase !== 'play') return;
      this.input.keys.add(k);
      if (k === 'c') this.player.stance = this.player.stance === 'crouch' ? 'walk' : 'crouch';
      if (k === 'e' && !e.repeat) this.beginAction();
    });
    window.addEventListener('keyup', (e) => this.input.keys.delete(norm(e)));
    window.addEventListener('blur', () => this.input.keys.clear());

    this.canvas.addEventListener('mousemove', (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.input.mouse.x = e.clientX - r.left;
      this.input.mouse.y = e.clientY - r.top;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.phase !== 'play') return;
      if (e.button === 2 && this.inventory.cans > 0 && !this.player.hidden) {
        this.aiming = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2 && this.aiming) {
        this.throwCan();
        this.aiming = false;
      }
    });
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.scale = Math.max(C.RENDER.minScale, Math.min(C.RENDER.maxScale, this.scale - e.deltaY * 0.02));
    }, { passive: false });
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
  }

  toWorld(sx, sy) {
    return {
      x: (sx - this.vw / 2) / this.scale + this.camera.x,
      y: -(sy - this.vh / 2) / this.scale + this.camera.y,
    };
  }

  // ---------------- 主循环 ----------------
  loop = (ts) => {
    if (!this.running) return;
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    if (this.phase === 'play') this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  };

  update(dt) {
    this.stats.elapsed += dt;
    this._frameSeen = false;

    // 鼠标世界坐标
    this.input.mouseWorld = this.toWorld(this.input.mouse.x, this.input.mouse.y);

    // 玩家（动作锁时不移动）
    if (this.action) this.tickAction(dt);
    else this.player.update(dt, this.input, this);
    this.tickUsbAlarm(dt);

    // 守卫
    for (const g of this.guards) g.update(dt, this);

    // 全局追捕协调
    this.tickGlobalHunt(dt);

    // 微波炉
    if (this.microwaveTimer > 0) {
      this.microwaveTimer -= dt;
      if (this.microwaveTimer <= 0) {
        this.emitNoise(37.4, 6.75, C.NOISE.envTrap, 'microwave');
        sfx.microwave(0, 1);
      }
    }

    // 投掷物飞行
    if (this.flying) {
      this.flying.t += dt;
      const f = this.flying;
      const k = Math.min(1, f.t / f.total);
      f.x = f.fx + (f.tx - f.fx) * k;
      f.y = f.fy + (f.ty - f.fy) * k;
      if (k >= 1) {
        this.emitNoise(f.tx, f.ty, C.NOISE.throw, 'throw');
        sfx.canLand(dist(f, this.player), 10);
        this.flying = null;
      }
    }

    // 相机
    this.camera.x += (this.player.x - this.camera.x) * Math.min(1, dt * 8);
    this.camera.y += (this.player.y - this.camera.y) * Math.min(1, dt * 8);

    // 视野 / 迷雾
    this.updateFog();

    // 交互目标
    this.currentTarget = this.findInteractTarget();

    // 记录最高警戒
    const lvl = this.currentAlertLevel();
    if (lvl === 'L3') this.stats.maxLevel = 'L3';
    else if (lvl === 'L2' && this.stats.maxLevel !== 'L3') this.stats.maxLevel = 'L2';
    else if (lvl === 'L1' && this.stats.maxLevel === 'L0') this.stats.maxLevel = 'L1';

    this.ui.syncHUD(this);
  }

  currentAlertLevel() {
    if (this.globalState !== 'normal') return 'L3';
    let m = 'L0';
    for (const g of this.guards) {
      const l = g.level;
      if (l === 'L3') return 'L3';
      if (l === 'L2') m = 'L2';
      else if (l === 'L1' && m === 'L0') m = 'L1';
    }
    return m;
  }

  // ---------------- 守卫上下文接口 ----------------
  activeWalls() {
    if (this.activeWallsCache) return this.activeWallsCache;
    const list = WALLS.slice();
    for (const d of this.doors) if (d.state === 'closed') list.push(doorSegment(d));
    this.activeWallsCache = list;
    return list;
  }

  collisionRects() {
    return LOW_BLOCKERS;
  }

  invalidateWalls() {
    this.activeWallsCache = null;
  }

  playerRegion() {
    return regionAt(this.player.x, this.player.y)?.id;
  }

  checkVision(guard) {
    const r = guardVision(guard, this.player, this.lights, this.activeWalls(),
      (x1, y1, x2, y2) => blocked(x1, y1, x2, y2, this.activeWalls()));
    if (r.seen) this._frameSeen = true;
    return r;
  }

  reportSeen(guard) {}

  triggerHunt(guard, mode) {
    if (this.globalState !== 'normal') return;
    this.globalState = 'hunt';
    this.whistleTimer = C.ACTION_TIME.whistle;
    this.loseSightTimer = 0;
    this.stats.hunt = true;
    if (mode === 'usb') {
      this.globalLKP = { x: 6, y: 18, region: 'archive' };
    } else if (mode === 'contact') {
      this.globalLKP = { x: this.player.x, y: this.player.y, region: this.playerRegion() };
    } else {
      this.globalLKP = { ...guard.lkp };
    }
    for (const g of this.guards) {
      g.lkp = { ...this.globalLKP };
      if (g.state !== 'grabbing') g.state = 'hunt';
    }
    this.buildSearchQueue(this.globalLKP.region);
    sfx.whistle(dist(guard, this.player), 10);
    this.ui.toast('被发现了！脱离他们的视线，关门能拖住他们！', 'danger');
  }

  tickGlobalHunt(dt) {
    if (this.globalState === 'hunt') {
      if (this.whistleTimer > 0) this.whistleTimer -= dt;
      if (this._frameSeen) this.loseSightTimer = 0;
      else this.loseSightTimer += dt;
      // 心跳
      this.heartbeatT -= dt;
      if (this.heartbeatT <= 0) {
        sfx.heartbeat(1);
        this.heartbeatT = 0.75;
      }
      if (this.loseSightTimer >= C.HUNT_LOSE_SIGHT_TIME) {
        this.globalState = 'huntSearch';
        this.huntSearchTimer = C.HUNT_SEARCH_TIME;
        this.buildSearchQueue(this.globalLKP.region);
        for (const g of this.guards) {
          g.searchSpot = null;
          g.loiterTarget = null;
        }
        this.ui.toast('他们失去了你的踪迹，正在搜索……', 'warn');
      }
    } else if (this.globalState === 'huntSearch') {
      this.huntSearchTimer -= dt;
      if (this.huntSearchTimer <= 0) {
        this.globalState = 'normal';
        for (const g of this.guards) g.toPatrol();
        for (const ev of this.evidence) for (const g of this.guards) ev.found.add(g.id);
      }
    }
  }

  buildSearchQueue(region) {
    this.searchSpotQueue = HIDING_SPOTS.filter((h) => h.region === region);
  }

  nextSearchSpot(guard) {
    return this.searchSpotQueue.shift() || null;
  }

  checkSpot(guard, spot) {
    if (this.player.hidden === spot.id) {
      this.onCatch(guard);
    }
  }

  loiterPoint(guard) {
    const r = REGIONS.find((x) => x.id === this.globalLKP.region);
    for (let i = 0; i < 12; i++) {
      const x = r.x + 0.8 + Math.random() * (r.w - 1.6);
      const y = r.y + 0.8 + Math.random() * (r.h - 1.6);
      if (dist(guard, { x, y }) > 2.5 && dist(guard, { x, y }) < 8 &&
        !blocked(guard.x, guard.y, x, y, this.activeWalls())) return { x, y };
    }
    return null;
  }

  gesture(guard, ev) {
    let best = null, bd = 16;
    for (const g of this.guards) {
      if (g === guard || g.state === 'grabbing') continue;
      const d = dist(g, guard);
      if (d < bd) { bd = d; best = g; }
    }
    if (best && best.alert < C.ALERT.L2) {
      const point = ev || this.globalLKP || guard.lkp;
      best.alert = C.ALERT.L2;
      best.lkp = { ...(point || guard.lkp) };
      best.soundPoint = point ? { x: point.x, y: point.y } : null;
      best.state = 'search';
      best.path = null;
      sfx.gesture(dist(best, this.player), 12);
    }
  }

  // ---------------- 声音 ----------------
  emitNoise(x, y, r, source) {
    for (const g of this.guards) {
      const crossed = wallsCrossed(g.x, g.y, x, y, WALLS);
      let eff = r;
      for (const w of crossed) {
        eff *= w.mat === 'concrete' ? C.WALL_SOUND_FACTOR.concrete : C.WALL_SOUND_FACTOR.wood;
      }
      if (dist(g, { x, y }) <= eff) {
        g.hearPoint(x, y, this);
      }
    }
  }

  // ---------------- 门（敌人） ----------------
  guardDoorBlock(guard, doorId) {
    const d = this.doorById[doorId];
    if (d.state === 'open') return false;
    const c = doorCenter(d);
    if (dist(guard, c) > 1.2) return false;
    if (d.kind === 'wood') {
      guard.busy = { type: 'kick', door: d.id, t: C.ACTION_TIME.kickDoor };
      sfx.kick(dist(c, this.player), 12);
    } else {
      guard.busy = { type: 'keypad', door: d.id, t: C.ACTION_TIME.guardKeypad };
      sfx.keypadOk(dist(c, this.player), 12);
    }
    return true;
  }

  guardOpenDoor(doorId) {
    const d = this.doorById[doorId];
    d.state = 'open';
    d.kicked = true;
    this.invalidateWalls();
  }

  findPath(guard, dest) {
    return findPath(guard, dest, this.doors);
  }

  // ---------------- 交互系统 ----------------
  findInteractTarget() {
    const p = this.player;
    if (p.hidden) {
      const spot = HIDING_SPOTS.find((h) => h.id === p.hidden);
      return { type: 'leaveHide', spot, dist: 0 };
    }
    const cands = [];
    for (const d of this.doors) {
      const c = doorCenter(d);
      const dd = dist(p, c);
      if (dd < 1.5) cands.push({ type: 'door', door: d, dist: dd });
    }
    for (const s of LIGHT_SWITCHES) {
      const dd = dist(p, s);
      if (dd < 1.1) cands.push({ type: 'switch', sw: s, dist: dd });
    }
    for (const h of HIDING_SPOTS) {
      const dd = dist(p, h);
      if (dd < 1.1) cands.push({ type: 'hide', spot: h, dist: dd });
    }
    for (const it of INTERACTABLES) {
      if (this.taken.has(it.id)) continue;
      const dd = dist(p, it);
      const r = it.kind === 'terminal' ? 1.2 : 1.1;
      if (dd < r) cands.push({ type: it.kind, it, dist: dd });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => a.dist - b.dist);
    return cands[0];
  }

  tickAction(dt) {
    const a = this.action;
    a.t += dt;
    // 仍按住 E 且目标未变
    const still = this.input.keys.has('e') && this.targetEquals(this.findInteractTarget(), a.target);
    if (!still) {
      this.action = null;
      this.ui.setProgress(null);
      return;
    }
    this.ui.setProgress({ t: a.t / a.total, label: a.label });
    if (a.t >= a.total) {
      const t = a.target;
      const swipe = a._swipe;
      const immediate = a.immediate;
      this.action = null;
      this.ui.setProgress(null);
      if (swipe) {
        this.d1.swiped = true;
        sfx.keypadOk(0, 1);
        this.useTerminal('D1');
      } else if (!immediate) {
        this.execute(t);
      }
    }
  }

  targetEquals(a, b) {
    if (!a || !b) return false;
    return a.type === b.type &&
      (a.door?.id === b.door?.id || a.sw?.id === b.sw?.id || a.spot?.id === b.spot?.id || a.it?.id === b.it?.id);
  }

  // E 按下时开始动作
  beginAction() {
    const t = this.currentTarget;
    if (!t || this.action) return;
    const cfg = this.actionConfig(t);
    if (!cfg) return;
    if (cfg.immediate) this.execute(t);
    this.action = { target: t, t: 0, total: cfg.time, label: cfg.label, immediate: !!cfg.immediate };
    this.ui.setProgress({ t: 0, label: cfg.label });
  }

  actionConfig(t) {
    const p = this.player;
    switch (t.type) {
      case 'door': {
        const d = t.door;
        if (d.state === 'open') {
          if (d.kicked) return null;
          return { time: 0.6, label: '关门中', immediate: true };
        }
        if (d.kind === 'keypad' || d.kind === 'exit') return null; // 走终端
        if (p.stance === 'crouch') return { time: C.ACTION_TIME.openDoorSlow, label: '慢开门中' };
        return { time: C.ACTION_TIME.openDoorFast, label: '开门中' };
      }
      case 'switch': return { time: C.ACTION_TIME.switchLight, label: '切换灯光' };
      case 'hide': return { time: 0.1, label: '藏匿' };
      case 'leaveHide': return { time: 0.1, label: '离开' };
      case 'box': return { time: 0.1, label: '打开' };
      case 'key': case 'can': return { time: 0.1, label: '拾取' };
      case 'clue': return { time: 0.1, label: '阅读' };
      case 'terminal': return { time: 0.1, label: '使用' };
      case 'microwave': return { time: 0.1, label: '设定' };
      case 'usb': return { time: 0.1, label: '拿取' };
      case 'drawer': return { time: this.inventory.key ? C.ACTION_TIME.searchDrawer : 0.1, label: '搜索' };
      default: return null;
    }
  }

  execute(t) {
    const p = this.player;
    switch (t.type) {
      case 'door': {
        const d = t.door;
        const dc = doorCenter(d);
        if (d.state === 'open') {
          d.state = 'closed';
          this.invalidateWalls();
          this.emitNoise(dc.x, dc.y, C.NOISE.closeDoor, 'closeDoor');
          sfx.doorClose(dist(dc.x, dc.y, p.x, p.y), 10);
        } else {
          d.state = 'open';
          this.invalidateWalls();
          if (p.stance !== 'crouch') {
            this.emitNoise(dc.x, dc.y, C.NOISE.openDoorFast, 'door');
            sfx.doorOpen(dist(dc.x, dc.y, p.x, p.y), 10);
            this.addEvidence('door', d);
          } else {
            sfx.doorOpen(dist(dc.x, dc.y, p.x, p.y), 10, true);
            this.addEvidence('door', d);
          }
        }
        break;
      }
      case 'switch': {
        const region = t.sw.region;
        this.lights[region] = !this.lights[region];
        sfx.switchClick(dist(t.sw, p), 6);
        if (!this.lights[region]) {
          this.addEvidence('light', { x: t.sw.x, y: t.sw.y, region });
        }
        break;
      }
      case 'hide': {
        p.hidden = t.spot.id;
        p.hideSpot = t.spot;
        p.x = t.spot.x;
        p.y = t.spot.y;
        break;
      }
      case 'leaveHide': {
        p.hidden = null;
        p.hideSpot = null;
        // 退出到藏匿点东侧，并解算碰撞避免卡在家具里
        p.x = t.spot.x + 1.1;
        p.y = t.spot.y;
        resolveCollision(p, 0.36, this.activeWalls(), this.collisionRects());
        break;
      }
      case 'box': {
        this.taken.add(t.it.id);
        sfx.pickup();
        this.ui.toast('只是个空纸箱。记住：靠近东西时按 E 交互。', 'info');
        break;
      }
      case 'key': {
        this.taken.add(t.it.id);
        this.inventory.key = true;
        sfx.pickup();
        this.ui.toast('拿到小钥匙——主管办公室有个上锁的抽屉。', 'info');
        break;
      }
      case 'can': {
        this.taken.add(t.it.id);
        this.inventory.cans++;
        sfx.pickup();
        this.ui.toast('拿到易拉罐：按住右键瞄准，松开投掷，落点会发出 8m 噪声。', 'info');
        break;
      }
      case 'clue': {
        this.openClue(t.it.clue);
        break;
      }
      case 'drawer': {
        if (!this.inventory.key) {
          this.ui.toast('抽屉锁着——需要一把小钥匙（茶水间的工服挂钩上）。', 'warn');
          return;
        }
        this.taken.add(t.it.id);
        this.inventory.card = true;
        sfx.pickup();
        this.addEvidence('drawer', { x: t.it.x, y: t.it.y, region: 'boss' });
        this.ui.toast('拿到门禁卡——档案室 D1 需要刷卡。', 'info');
        break;
      }
      case 'usb': {
        this.taken.add(t.it.id);
        this.inventory.usb = true;
        this.cp = 2;
        this.alarmTimer = C.ACTION_TIME.alarmDelay;
        sfx.pickup();
        this.ui.toast('拿到 U 盘了！3 秒后警报响起——快跑！', 'danger');
        // 3s 静默报警
        this._usbAlarm = C.ACTION_TIME.alarmDelay;
        break;
      }
      case 'microwave': {
        this.microwaveTimer = C.ACTION_TIME.microwaveDelay;
        this.ui.toast('微波炉开始转动，8 秒后响铃。', 'info');
        break;
      }
      case 'terminal': {
        this.useTerminal(t.it.door);
        break;
      }
    }
  }

  // USB 报警倒计时（在 update 中独立处理）
  tickUsbAlarm(dt) {
    if (this._usbAlarm != null) {
      this._usbAlarm -= dt;
      if (this._usbAlarm <= 0) {
        this._usbAlarm = null;
        this.globalLKP = { x: 6, y: 18, region: 'archive' };
        this.globalState = 'hunt';
        this.stats.hunt = true;
        this.loseSightTimer = 0;
        this.whistleTimer = C.ACTION_TIME.whistle;
        for (const g of this.guards) {
          g.lkp = { x: 6, y: 18, region: 'archive' };
          g.state = 'hunt';
        }
        this.buildSearchQueue('archive');
        sfx.alarm(dist(this.player, { x: 6, y: 18 }), 12);
        sfx.whistle(dist(this.player, this.guards[0]), 12);
      }
    }
  }

  addEvidence(type, ref) {
    const c = type === 'door' ? doorCenter(ref) : ref;
    const region = ref.region || regionAt(c.x, c.y)?.id;
    this.evidence.push({ type, x: c.x, y: c.y, region, found: new Set() });
    this.stats.evidenceL2 = true;
  }

  evidenceNear(guard) {
    for (const ev of this.evidence) {
      if (ev.found.has(guard.id)) continue;
      if (ev.region !== regionAt(guard.x, guard.y)?.id) continue;
      if (dist(guard, ev) < 2.3) {
        ev.found.add(guard.id);
        return ev;
      }
    }
    return null;
  }

  // ---------------- 线索 / 终端 ----------------
  openClue(clue) {
    const cfgs = {
      n1: {
        title: '便利贴（显示器上）',
        body: '一张黄色便利贴，字迹潦草：\n\n「档案室门密码 = 老婆生日，别再忘了！」\n\n（密码是某个日期……哪里能看到日期？）',
      },
      n2: {
        title: '墙上的日历',
        body: '茶水间墙上的日历，4 月 23 日被红笔圈了起来，旁边写着：\n\n「老婆生日 ❤」\n\n——便利贴上说档案室密码是「老婆生日」。',
      },
      n3: {
        title: '会议室白板',
        body: '白板上写满会议安排，角落里有一行不起眼的小字：\n\n「消防楼梯门密码：0512」',
      },
    };
    this.clues[clue] = true;
    sfx.clue();
    this.phase = 'reader';
    this.ui.openReader(cfgs[clue], () => {
      this.phase = 'play';
      if (clue === 'n3') this.ui.toast('已记下消防门密码：0512（任务栏自动记录）。', 'info');
      if (this.clues.n1 && this.clues.n2) this.ui.toast('拼出档案室密码：0423（04/23）。', 'info');
    });
  }

  useTerminal(door) {
    if (door === 'D1') {
      if (this.d1.unlocked) return;
      if (!this.inventory.card) {
        this.ui.toast('门禁读卡器：需要门禁卡（主管办公室的上锁抽屉里）。', 'warn');
        return;
      }
      if (!this.d1.swiped) {
        // 刷卡动作
        this.action = {
          target: { type: 'terminal', it: INTERACTABLES.find((x) => x.id === 'tD1') },
          t: 0, total: C.ACTION_TIME.swipeCard, label: '刷卡中',
          _swipe: true,
        };
        this.ui.setProgress({ t: 0, label: '刷卡中' });
        return;
      }
      this.openKeypad('档案室门禁', '输入 4 位密码', (code) => {
        if (code === C.CODES.archive) {
          this.d1.unlocked = true;
          const d = this.doorById.D1;
          d.state = 'open';
          d.kind = 'wood';
          this.invalidateWalls();
          this.cp = 1;
          // 相位重置
          for (const g of this.guards) {
            const pr = PHASE_RESET[g.id];
            g.resetPhase(pr);
          }
          sfx.keypadOk(0, 1);
          this.ui.toast('档案室门开了。检查点已保存——巡逻相位已重置。', 'info');
          return true;
        }
        this.emitNoise(12.9, 12, C.NOISE.keypadError, 'keypadError');
        sfx.beep(dist(this.player, { x: 12.9, y: 12 }), 12);
        return false;
      });
    } else if (door === 'D6') {
      if (!this.inventory.usb) {
        this.phase = 'reader';
        this.ui.openReader({
          title: '消防门密码键盘',
          body: '键盘没有通电，指示灯全灭。\n\n……还没拿到 U 盘，现在不能撤离。',
        }, () => { this.phase = 'play'; });
        return;
      }
      this.openKeypad('消防楼梯门', '输入 4 位密码', (code) => {
        if (code === C.CODES.exit) {
          this.win();
          return true;
        }
        this.emitNoise(33.2, 27, C.NOISE.keypadError, 'keypadError');
        sfx.beep(dist(this.player, { x: 33.2, y: 27 }), 12);
        return false;
      });
    }
  }

  // 刷卡动作完成回调（在 tickAction 中 _swipe 特殊处理）
  openKeypad(title, sub, onSubmit) {
    this.phase = 'keypad';
    this.ui.openKeypad({
      title, sub,
      onSubmit: (code) => {
        const ok = onSubmit(code);
        if (ok) {
          // 回调可能已切到结算（won）等其他阶段，仅在仍处于键盘层时回 play
          if (this.phase === 'keypad') this.phase = 'play';
          return true;
        }
        return false;
      },
      onCancel: () => { this.phase = 'play'; },
    });
  }

  // ---------------- 投掷 ----------------
  throwCan() {
    if (!this.aimPoint || this.inventory.cans <= 0) return;
    const to = this.aimPoint;
    this.inventory.cans--;
    this.flying = {
      fx: this.player.x, fy: this.player.y, tx: to.x, ty: to.y,
      x: this.player.x, y: this.player.y,
      t: 0, total: C.ACTION_TIME.throwFly,
    };
    sfx.throwWhoosh();
  }

  updateAim() {
    if (!this.aiming) { this.aimPoint = null; return; }
    const mw = this.input.mouseWorld;
    let dx = mw.x - this.player.x;
    let dy = mw.y - this.player.y;
    let d = Math.hypot(dx, dy);
    const maxD = 8;
    const nd = Math.min(d, maxD);
    const ux = dx / (d || 1), uy = dy / (d || 1);
    // 墙体限制
    const wallT = (() => {
      let best = nd;
      for (const w of this.activeWalls()) {
        // 射线
        const ex = w.x2 - w.x1, ey = w.y2 - w.y1;
        const den = ux * ey - uy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((w.x1 - this.player.x) * ey - (w.y1 - this.player.y) * ex) / den;
        const u = ((w.x1 - this.player.x) * uy - (w.y1 - this.player.y) * ux) / den;
        if (t >= 0 && u >= 0 && u <= 1 && t < best) best = t;
      }
      return best;
    })();
    this.aimPoint = { x: this.player.x + ux * wallT, y: this.player.y + uy * wallT };
  }

  // ---------------- 胜负 / 检查点 ----------------
  win() {
    this.phase = 'won';
    sfx.win();
    const s = this.stats;
    let rank;
    const minutes = s.elapsed;
    if (s.maxLevel !== 'L3' && s.maxLevel !== 'L2' && minutes <= C.RANK.ghostTimeLimit) rank = 'S';
    else if (!s.hunt) rank = 'A';
    else if (s.captures === 0) rank = 'B';
    else rank = 'C';
    const rankNames = {
      S: { name: '幽灵', desc: '最高警戒不超过疑惑，无物证，5 分钟内撤离。' },
      A: { name: '潜行者', desc: '全程没有触发群体追捕。' },
      B: { name: '逃脱者', desc: '触发了追捕，但一次就脱身。' },
      C: { name: '狼狈撤离', desc: '触发追捕，且被抓重试过。' },
    };
    this.ui.showResult({
      rank: rankNames[rank].name,
      rankCode: rank,
      desc: rankNames[rank].desc,
      stats: [
        ['用时', Math.floor(minutes / 60) + ':' + String(Math.floor(minutes % 60)).padStart(2, '0')],
        ['最高警戒', { L0: '平静', L1: '疑惑', L2: '警戒', L3: '追捕' }[s.maxLevel]],
        ['触发追捕', s.hunt ? '是' : '否'],
        ['被抓次数', s.captures],
      ],
    });
  }

  onCatch(guard) {
    this.stats.captures++;
    this.phase = 'caught';
    sfx.lose();
    let msg, hint;
    if (this.globalState === 'hunt' && this.cp < 2) {
      msg = '他抓住了你的胳膊。';
      hint = '追捕中：关门能拖住他们 3 秒（D7 是最重要的防线）。';
    } else if (this.cp === 0) {
      msg = '你被巡逻的警卫发现了。';
      hint = '蹲下、藏进隔间、等他转身。';
    } else {
      msg = '他把你按在了地上。';
      hint = '被追捕时记得关门断视线；藏匿要换房间。';
    }
    this.ui.showCaught(msg, hint, () => this.respawn());
  }

  respawn() {
    const cp = this.cp;
    // 保存跨重开统计
    const stats = this.stats;
    const clues = { ...this.clues };
    const captures = stats.captures;
    const hunt = stats.hunt;
    const evidenceL2 = stats.evidenceL2;
    const elapsed = stats.elapsed;
    const maxLevel = stats.maxLevel;

    this.resetWorld();
    this.clues = clues;
    this.stats.captures = captures;
    this.stats.hunt = hunt;
    this.stats.evidenceL2 = evidenceL2;
    this.stats.elapsed = elapsed;
    this.stats.maxLevel = maxLevel;
    this.stats.startTime = performance.now() - elapsed * 1000;

    if (cp === 0) {
      // 整关重置（线索保留）
    } else if (cp === 1) {
      this.inventory.key = true;
      this.inventory.card = true;
      this.d1 = { swiped: true, unlocked: true };
      const d = this.doorById.D1;
      d.kind = 'wood';
      d.state = 'closed';
      this.player.x = 11.3;
      this.player.y = 12;
      for (const g of this.guards) g.resetPhase(PHASE_RESET[g.id]);
      this.ui.toast('检查点：D1 已解锁，按 E 即可进入。', 'info');
    } else if (cp === 2) {
      this.inventory.key = true;
      this.inventory.card = true;
      this.inventory.usb = true;
      this.d1 = { swiped: true, unlocked: true };
      const d = this.doorById.D1;
      d.kind = 'wood';
      d.state = 'open';
      this.taken.add('usb');
      this.player.x = 6;
      this.player.y = 18;
      for (const g of this.guards) g.resetPhase(PHASE_RESET[g.id]);
      this._usbAlarm = C.ACTION_TIME.alarmDelay;
      this.ui.toast('检查点：拿起 U 盘，3 秒后警报响起。', 'danger');
    }
    this.phase = 'play';
    this.ui.showScreen(null);
    this.ui.setHUDVisible(true);
  }

  pause() {
    this.phase = 'paused';
    this.ui.showScreen('pause');
  }
  resume() {
    this.phase = 'play';
    this.ui.showScreen(null);
  }
  toMenu() {
    this.phase = 'menu';
    this.ui.setHUDVisible(false);
    this.ui.showScreen('menu');
  }

  // ---------------- 视野 / 迷雾 ----------------
  updateFog() {
    const p = this.player;
    const r = regionAt(p.x, p.y);
    let lit = true;
    if (r) {
      if (r.light === 'dim') lit = false;
      else lit = this.lights[r.id];
    }
    const v = C.PLAYER_VISION;
    let range, half;
    if (p.hidden) {
      range = C.HIDE_VISION; half = 55;
    } else {
      const crouch = p.stance === 'crouch';
      range = lit ? (crouch ? v.bright.crouch : v.bright.stand) : (crouch ? v.dark.crouch : v.dark.stand);
      half = v.halfAngle;
    }
    this.fog.update(p, p.angle, half, range, this.activeWalls());
  }

  // ---------------- 渲染 ----------------
  render() {
    const ctx = this.ctx;
    this.updateAim();
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, this.vw, this.vh);

    ctx.save();
    ctx.translate(this.vw / 2, this.vh / 2);
    ctx.scale(this.scale, -this.scale);
    ctx.translate(-this.camera.x, -this.camera.y);

    this.drawFloor(ctx);
    this.drawObjects(ctx);
    this.drawDoors(ctx);
    this.drawCones(ctx);
    this.drawGuards(ctx);
    this.drawPlayer(ctx);
    this.drawFlying(ctx);
    this.drawWalls(ctx);
    this.drawAim(ctx);
    this.fog.render(ctx);

    ctx.restore();

    this.drawMinimap(ctx);
  }

  drawFloor(ctx) {
    for (const r of REGIONS) {
      ctx.fillStyle = r.floor;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // 关灯区域叠暗
      let lit = r.light !== 'bright' ? false : this.lights[r.id];
      if (!lit) {
        ctx.fillStyle = 'rgba(2,4,12,0.62)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      // 房间名
      ctx.save();
      ctx.scale(1, -1);
      ctx.fillStyle = 'rgba(220,230,245,0.20)';
      ctx.font = '1.1px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.name, r.x + r.w / 2, -(r.y + r.h - 1.1));
      ctx.restore();
    }
  }

  drawWalls(ctx) {
    for (const w of WALLS) {
      ctx.strokeStyle = w.mat === 'concrete' ? '#3a3f48' : '#434a55';
      ctx.lineWidth = C.WALL_THICKNESS;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }
  }

  drawDoors(ctx) {
    for (const d of this.doors) {
      const c = doorCenter(d);
      ctx.save();
      ctx.translate(c.x, c.y);
      // 门框
      ctx.strokeStyle = 'rgba(120,135,160,0.5)';
      ctx.lineWidth = 0.06;
      if (d.axis === 'v') {
        ctx.beginPath(); ctx.moveTo(0, -d.w / 2); ctx.lineTo(0, d.w / 2); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(-d.w / 2, 0); ctx.lineTo(d.w / 2, 0); ctx.stroke();
      }
      // 门板
      if (d.state === 'closed') {
        ctx.strokeStyle = d.kind === 'exit' ? '#8ab4d8' : '#8a7a5c';
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        if (d.axis === 'v') {
          ctx.moveTo(0, -d.w / 2); ctx.lineTo(0, d.w / 2);
        } else {
          ctx.moveTo(-d.w / 2, 0); ctx.lineTo(d.w / 2, 0);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawObjects(ctx) {
    // 高柜
    for (const b of HIGH_BLOCKERS) {
      ctx.fillStyle = b.kind === 'locker' ? '#3c4450' : '#454c56';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(160,175,200,0.35)';
      ctx.lineWidth = 0.04;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    // 半高隔间
    for (const b of LOW_BLOCKERS) {
      ctx.fillStyle = b.kind === 'cubicle' ? 'rgba(70,90,110,0.55)' : 'rgba(110,90,60,0.5)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(150,170,195,0.3)';
      ctx.lineWidth = 0.04;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    // 交互物
    const icons = {
      key: '🔑', can: '🥤', clue: '📄', drawer: '🗄️', usb: '💾',
      microwave: '📟', terminal: '🔐', box: '📦',
    };
    ctx.save();
    ctx.scale(1, -1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const it of INTERACTABLES) {
      if (this.taken.has(it.id)) continue;
      let icon = icons[it.kind];
      if (it.kind === 'clue') icon = it.clue === 'n3' ? '⬜' : '📌';
      if (it.kind === 'usb') icon = '💾';
      ctx.font = '0.95px sans-serif';
      ctx.fillText(icon, it.x, -it.y);
    }
    // 藏匿点标记
    ctx.font = '0.7px sans-serif';
    for (const h of HIDING_SPOTS) {
      const near = this.currentTarget && this.currentTarget.spot?.id === h.id;
      ctx.fillStyle = near ? 'rgba(95,208,138,0.9)' : 'rgba(150,180,220,0.4)';
      ctx.fillText('▾', h.x, -(h.y + 0.7));
    }
    ctx.restore();
  }

  drawCones(ctx) {
    const globalHunt = this.globalState !== 'normal';
    for (const g of this.guards) {
      const half = C.GUARD_VISION.halfAngle;
      let range = 9;
      // 视野锥半径按 guard 所在区域光照
      const r = regionAt(g.x, g.y);
      if (r) {
        if (r.light === 'dim') range = 6;
        else range = this.lights[r.id] ? 9 : 4;
      }
      const poly = conePolygon(g, g.angle, half, range, this.activeWalls());
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fillStyle = g.coneColor(globalHunt);
      ctx.fill();
    }
  }

  drawGuards(ctx) {
    for (const g of this.guards) {
      // 身体
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(g.x, g.y, C.ENTITY_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 0.05;
      ctx.stroke();
      // 朝向
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(g.angle) * 0.55, g.y + Math.sin(g.angle) * 0.55);
      ctx.stroke();
      // 头顶图标
      const icon = g.icon();
      if (icon) {
        ctx.save();
        ctx.scale(1, -1);
        ctx.font = 'bold 0.75px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = icon === '?' ? '#e8d44d' : icon === '!!' ? '#f08a3c' : '#ef4444';
        ctx.fillText(icon, g.x, -(g.y + 0.75));
        ctx.restore();
      }
    }
  }

  drawPlayer(ctx) {
    const p = this.player;
    if (p.hidden) return;
    ctx.fillStyle = '#5fd08a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, C.ENTITY_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.05;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 0.55, p.y + Math.sin(p.angle) * 0.55);
    ctx.stroke();
  }

  drawFlying(ctx) {
    if (!this.flying) return;
    ctx.fillStyle = '#e8b64c';
    ctx.beginPath();
    ctx.arc(this.flying.x, this.flying.y, 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  drawAim(ctx) {
    if (!this.aiming || !this.aimPoint) return;
    const p = this.player;
    ctx.strokeStyle = 'rgba(232,182,76,0.5)';
    ctx.lineWidth = 0.05;
    ctx.setLineDash([0.2, 0.2]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(this.aimPoint.x, this.aimPoint.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(232,182,76,0.9)';
    ctx.beginPath();
    ctx.arc(this.aimPoint.x, this.aimPoint.y, 0.25, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawMinimap(ctx) {
    const mw = 168, mh = 105;
    const mx = this.vw - mw - 14, my = 14;
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,13,0.82)';
    ctx.strokeStyle = 'rgba(148,173,219,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx, my, mw, mh, 8);
    ctx.fill();
    ctx.stroke();
    const sx = mw / C.MAP_W, sy = mh / C.MAP_H;
    // 已探索区域
    const cs = this.fog.cs;
    for (let gy = 0; gy < this.fog.gh; gy++) {
      for (let gx = 0; gx < this.fog.gw; gx++) {
        const v = this.fog.cells[gy * this.fog.gw + gx];
        if (v === 0) continue;
        ctx.fillStyle = v === 2 ? 'rgba(150,170,200,0.7)' : 'rgba(90,105,130,0.5)';
        ctx.fillRect(mx + gx * cs * sx, my + (C.MAP_H - (gy + 1) * cs) * sy, cs * sx + 0.5, cs * sy + 0.5);
      }
    }
    // 敌人（仅当前可见）
    for (const g of this.guards) {
      const gx = Math.floor(g.x / cs), gy = Math.floor(g.y / cs);
      if (this.fog.cells[gy * this.fog.gw + gx] === 2) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(mx + g.x * sx, my + (C.MAP_H - g.y) * sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 玩家
    ctx.fillStyle = '#5fd08a';
    ctx.beginPath();
    ctx.arc(mx + this.player.x * sx, my + (C.MAP_H - this.player.y) * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
