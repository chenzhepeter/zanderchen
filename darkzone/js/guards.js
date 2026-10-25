// guards.js — 警卫 AI：L0-L3 状态机、巡逻/调查/搜索/追捕、踢门、抓捕前摇
import { RULESET as C } from './config.js';
import { dist, angleTo, moveWithCollision } from './geom.js';
import { regionAt } from './level.js';
import { sfx } from './audio.js';

const D2R = Math.PI / 180;
const LEVEL_COLOR = { L0: 'rgba(255,255,255,0.13)', L1: 'rgba(232,212,77,0.16)', L2: 'rgba(240,138,60,0.18)', L3: 'rgba(239,68,68,0.22)' };

export class Guard {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.color = def.color;
    this.route = def.route;
    this.pingpong = !!def.pingpong;
    this.reset();
  }

  reset() {
    const n0 = this.route[0];
    this.x = n0.x;
    this.y = n0.y;
    this.angle = (n0.face ?? 0) * D2R;
    this.alert = 0;
    this.state = 'patrol'; // patrol / investigate / search / hunt / grabbing
    this.routeIndex = 0;
    this.routeDir = 1;
    this.nodeReached = false;
    this.waitTimer = 0;
    this.holdTimer = 0;
    this.holdFace = n0.face ?? 0;
    this.scanT = Math.random() * 3;
    this.lkp = null;
    this.soundPoint = null;
    this.investTimer = 0;
    this.searchTimer = 0;
    this.grace = 0;
    this.path = null;
    this.repathTimer = 0;
    this.busy = null;
    this.searchSpot = null;
    this.spotCheckTimer = 0.8;
    this.loiterTarget = null;
    this.stuckAcc = 0;
    this.stepFx = 0;
  }

  // 检查点相位重置
  resetPhase(preset) {
    this.reset();
    this.x = preset.x;
    this.y = preset.y;
    this.routeIndex = preset.nodeIndex;
    this.routeDir = preset.dir;
    this.holdTimer = preset.hold;
    this.holdFace = preset.face;
    this.angle = preset.face * D2R;
    this.nodeReached = false;
    this.path = null;
  }

  get level() {
    if (this.alert >= C.ALERT.L3) return 'L3';
    if (this.alert >= C.ALERT.L2) return 'L2';
    if (this.alert >= C.ALERT.L1) return 'L1';
    return 'L0';
  }

  coneColor(globalHunt) {
    if (globalHunt || this.alert >= C.ALERT.L3) return LEVEL_COLOR.L3;
    if (this.alert >= C.ALERT.L2) return LEVEL_COLOR.L2;
    if (this.alert >= C.ALERT.L1) return LEVEL_COLOR.L1;
    return LEVEL_COLOR.L0;
  }

  icon() {
    if (this.alert >= C.ALERT.L3) return '!!!';
    if (this.alert >= C.ALERT.L2) return '!!';
    if (this.alert >= C.ALERT.L1) return '?';
    return '';
  }

  hearPoint(x, y, ctx) {
    if (this.busy && this.busy.type === 'kick') return;
    if (this.state === 'hunt' || this.state === 'grabbing') return;
    this.alert = Math.max(this.alert, C.ALERT_GAIN.soundEvent);
    this.soundPoint = { x, y };
    this.investTimer = 0;
    if (this.state === 'patrol') {
      this.state = 'investigate';
      this.path = null;
    }
    sfx.question(dist(this.x, this.y, ctx.player.x, ctx.player.y), 10);
  }

  // ---------- 主更新 ----------
  update(dt, ctx) {
    const p = ctx.player;
    const globalHunt = ctx.globalState === 'hunt' || ctx.globalState === 'huntSearch';

    // 视线检测（busy 中也能看，看到人就放弃当前动作）
    const see = ctx.checkVision(this);
    this.seesPlayer = see.seen && !p.hidden;
    if (see.seen) {
      if (this.busy) { this.busy = null; this.path = null; }
      if (this.state !== 'grabbing') {
        this.alert = Math.min(100, this.alert + see.gain * dt);
        this.grace = C.ALERT_DECAY.gracePeriod;
        this.lkp = { x: p.x, y: p.y, region: ctx.playerRegion() };
        this.searchSpot = null;
        this.loiterTarget = null;
        ctx.reportSeen(this);
        if (this.alert >= C.ALERT.L3 && ctx.globalState === 'normal') {
          ctx.triggerHunt(this, 'sight');
        } else if (this.alert >= C.ALERT.L2 && ctx.globalState === 'normal') {
          if (this.state !== 'search') {
            this.toSearch();
            ctx.gesture(this);
          }
        } else if (this.alert >= C.ALERT.L1 && ctx.globalState === 'normal') {
          if (this.state === 'patrol') {
            this.toInvestigate({ x: p.x, y: p.y });
          }
        }
      }
    } else if (this.state !== 'grabbing') {
      this.seesPlayer = false;
      if (this.grace > 0) this.grace -= dt;
      // search 状态下 alert 维持在 L2，保证 20s 区域搜索完整
      else if (ctx.globalState === 'normal' && this.state !== 'search') {
        this.alert = Math.max(0, this.alert - C.ALERT_DECAY.rate * dt);
      }
    }

    // 物证
    if (ctx.globalState === 'normal' && (this.state === 'patrol' || this.state === 'investigate')) {
      const ev = ctx.evidenceNear(this);
      if (ev) {
        this.alert = Math.max(this.alert, C.ALERT_GAIN.evidence);
        this.soundPoint = { x: ev.x, y: ev.y };
        this.lkp = { x: ev.x, y: ev.y, region: ev.region };
        this.toSearch();
        ctx.gesture(this, ev);
      }
    }

    // 全局追捕同步
    if (globalHunt) {
      this.alert = 100;
      if (this.state !== 'hunt' && this.state !== 'grabbing') this.state = 'hunt';
    }

    // 接触抓捕（含 0.5s 前摇）
    if (!p.hidden && this.state !== 'grabbing' && dist(this, p) < C.GRAB_DISTANCE && !this.busy) {
      this.state = 'grabbing';
      this.grabTimer = C.ACTION_TIME.grabReach;
      this.path = null;
      ctx.triggerHunt(this, 'contact');
      sfx.grab(dist(this, p), 6);
    }

    // busy（踢门/密码门）
    if (this.busy) {
      this.busy.t -= dt;
      if (this.busy.t <= 0) {
        ctx.guardOpenDoor(this.busy.door);
        this.busy = null;
        this.path = null;
      }
      return;
    }

    // 抓捕前摇
    if (this.state === 'grabbing') {
      this.grabTimer -= dt;
      this.angle = angleTo(this, p);
      if (dist(this, p) > C.GRAB_ESCAPE_DISTANCE || p.hidden) {
        this.state = globalHunt ? 'hunt' : 'patrol';
        this.path = null;
      } else if (this.grabTimer <= 0) {
        ctx.onCatch(this);
      }
      return;
    }

    switch (this.state) {
      case 'patrol': this.patrolUpdate(dt, ctx); break;
      case 'investigate': this.investigateUpdate(dt, ctx); break;
      case 'search': this.searchUpdate(dt, ctx); break;
      case 'hunt': this.huntUpdate(dt, ctx); break;
    }

    // 巡逻脚步（玩家能听到靠近的敌人）
    if (this.state === 'patrol' && this.speedNow > 0.5) {
      this.stepFx -= dt;
      if (this.stepFx <= 0) {
        sfx.footstep(true, dist(this, p), 7);
        this.stepFx = 0.55;
      }
    }
  }

  // ---------- 行为 ----------
  advanceNode() {
    if (this.pingpong) {
      let i = this.routeIndex + this.routeDir;
      if (i >= this.route.length || i < 0) {
        this.routeDir *= -1;
        i = this.routeIndex + this.routeDir;
      }
      this.routeIndex = i;
    } else {
      this.routeIndex = (this.routeIndex + 1) % this.route.length;
    }
    this.nodeReached = false;
    this.path = null;
  }

  patrolUpdate(dt, ctx) {
    if (this.holdTimer > 0) {
      this.holdTimer -= dt;
      this.turnFace(this.holdFace * D2R, dt);
      return;
    }
    const node = this.route[this.routeIndex];
    if (!this.nodeReached) {
      if (this.followPath(dt, ctx, C.GUARD_SPEED.patrol, { x: node.x, y: node.y }, 0.35)) {
        this.nodeReached = true;
        this.waitTimer = node.wait ?? 0;
        this.scanT = 0;
      }
      return;
    }
    if (this.waitTimer > 0) {
      this.waitTimer -= dt;
      this.scanT += dt;
      if (node.face != null) {
        this.turnFace(node.face * D2R, dt);
      } else {
        this.angle = Math.atan2(node.y - this.y, node.x - this.x) + Math.sin(this.scanT * 1.5) * 0.7;
      }
      this.speedNow = 0;
      if (this.waitTimer <= 0) this.advanceNode();
    } else {
      this.advanceNode();
    }
  }

  investigateUpdate(dt, ctx) {
    const dest = this.soundPoint || this.lkp;
    if (!dest) { this.toPatrol(); return; }
    if (this.followPath(dt, ctx, C.GUARD_SPEED.investigate, dest, 0.5)) {
      if (this.investTimer <= 0) this.investTimer = C.L1_INVESTIGATE_TIME;
      this.investTimer -= dt;
      this.scanAround(dest, dt);
      if (this.investTimer <= 0 && this.alert < C.ALERT.L2) {
        this.soundPoint = null;
        this.lkp = null;
        this.alert = 0;
        this.toPatrol();
      }
    }
  }

  searchUpdate(dt, ctx) {
    if (ctx.globalState === 'normal') {
      if (this.alert < C.ALERT.L2) { this.toPatrol(); return; }
      const dest = this.lkp || this.soundPoint;
      if (!dest) { this.toPatrol(); return; }
      if (this.followPath(dt, ctx, C.GUARD_SPEED.investigate, dest, 0.6)) {
        if (this.searchTimer <= 0) this.searchTimer = C.L2_SEARCH_TIME;
        this.searchTimer -= dt;
        this.scanAround(dest, dt);
        if (this.searchTimer <= 0) { this.alert = 0; this.toPatrol(); }
      }
    } else {
      this.huntUpdate(dt, ctx);
    }
  }

  huntUpdate(dt, ctx) {
    if (ctx.whistleTimer > 0) {
      if (this.lkp) this.turnFace(angleTo(this, this.lkp), dt);
      this.speedNow = 0;
      return;
    }
    const p = ctx.player;
    // 看得见玩家就直扑玩家，保证能进入接触抓捕距离
    if (this.seesPlayer && !p.hidden) {
      this.searchSpot = null;
      this.loiterTarget = null;
      this.stepToward({ x: p.x, y: p.y }, dt, C.GUARD_SPEED.hunt, ctx);
      return;
    }
    const lkp = this.lkp || ctx.globalLKP;
    if (!lkp) { this.toPatrol(); return; }
    const inRoom = regionAt(this.x, this.y)?.id === lkp.region;
    if (!inRoom || dist(this, lkp) > 2.2) {
      this.followPath(dt, ctx, C.GUARD_SPEED.hunt, lkp, 0.9);
      return;
    }
    // LKP 房间内：先搜藏匿点，再踱步
    if (!this.searchSpot) {
      this.searchSpot = ctx.nextSearchSpot(this);
      this.spotCheckTimer = 0.8;
      if (this.searchSpot) {
        sfx.question(dist(this, ctx.player), 10);
      }
    }
    if (this.searchSpot) {
      const sp = this.searchSpot;
      if (dist(this, sp) > 0.95) {
        this.stepToward(sp, dt, C.GUARD_SPEED.investigate, ctx);
      } else {
        this.speedNow = 0;
        this.angle = angleTo(this, sp);
        this.spotCheckTimer -= dt;
        if (this.spotCheckTimer <= 0) {
          ctx.checkSpot(this, sp);
          this.searchSpot = null;
        }
      }
    } else {
      if (!this.loiterTarget || dist(this, this.loiterTarget) < 0.8) {
        this.loiterTarget = ctx.loiterPoint(this);
      }
      if (this.loiterTarget) this.stepToward(this.loiterTarget, dt, C.GUARD_SPEED.investigate, ctx);
    }
  }

  // ---------- 基础 ----------
  toPatrol() {
    this.state = 'patrol';
    this.path = null;
    this.soundPoint = null;
    this.lkp = null;
    this.searchSpot = null;
    this.loiterTarget = null;
    this.investTimer = 0;
    this.searchTimer = 0;
    this.alert = 0;
    this.nodeReached = false;
  }

  toInvestigate(point) {
    this.state = 'investigate';
    this.soundPoint = { x: point.x, y: point.y };
    this.investTimer = 0;
    this.path = null;
  }

  toSearch() {
    this.state = 'search';
    this.searchTimer = 0;
    this.path = null;
  }

  scanAround(center, dt) {
    this.scanT += dt;
    this.speedNow = 0;
    const base = Math.atan2(center.y - this.y, center.x - this.x);
    this.angle = base + Math.sin(this.scanT * 1.6) * 1.0;
  }

  turnFace(target, dt, rate = 7) {
    let d = (target - this.angle + Math.PI) % (Math.PI * 2) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    const max = rate * dt;
    this.angle += Math.abs(d) <= max ? d : Math.sign(d) * max;
  }

  stepToward(target, dt, speed, ctx) {
    const a = angleTo(this, target);
    this.turnFace(a, dt, 8);
    const before = dist(this, target);
    moveWithCollision(this, a, speed * dt, C.ENTITY_RADIUS, ctx.activeWalls(), ctx.collisionRects());
    const after = dist(this, target);
    this.speedNow = Math.max(0, (before - after) / dt);
    return before - after;
  }

  followPath(dt, ctx, speed, dest, arriveR) {
    this.dest = dest;
    if (this.repathTimer <= 0 || !this.path) {
      this.path = ctx.findPath(this, dest);
      this.repathTimer = 0.3 + Math.random() * 0.15;
    } else {
      this.repathTimer -= dt;
    }
    let guard = this;
    while (this.path.length && dist(this, this.path[0]) < 0.32) this.path.shift();
    if (this.path.length === 0) {
      this.speedNow = 0;
      return true;
    }
    const wp = this.path[0];
    if (wp.door && ctx.guardDoorBlock(this, wp.door)) {
      this.speedNow = 0;
      return false;
    }
    const before = dist(this, wp);
    this.stepToward(wp, dt, speed, ctx);
    const after = dist(this, wp);
    const moved = before - after;
    this.stuckAcc = moved < speed * dt * 0.4 ? this.stuckAcc + dt : 0;
    if (this.stuckAcc > 0.7) {
      this.path = null;
      this.repathTimer = 0;
      this.stuckAcc = 0;
    }
    if (dist(this, dest) <= arriveR) return true;
    return false;
  }
}
