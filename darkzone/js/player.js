// player.js — 玩家：三档移动、姿态、藏匿、脚步噪声
import { RULESET as C } from './config.js';
import { SPAWN } from './level.js';
import { moveWithCollision, dist } from './geom.js';

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = SPAWN.x;
    this.y = SPAWN.y;
    this.angle = SPAWN.angle * Math.PI / 180;
    this.stance = 'walk'; // crouch / walk
    this.running = false;
    this.speedNow = 0;
    this.hidden = null; // 藏匿点 id
    this.hideSpot = null;
    this.stepTimer = 0;
    this.visible = true;
  }

  get speed() {
    if (this.hidden) return 0;
    if (this.stance === 'crouch') return C.PLAYER_SPEED.crouch;
    return this.running ? C.PLAYER_SPEED.run : C.PLAYER_SPEED.walk;
  }

  get noiseRadius() {
    if (this.hidden || this.stance === 'crouch') return 0;
    return this.running ? C.NOISE.run : C.NOISE.walk;
  }

  update(dt, input, world) {
    this.running = !this.hidden && input.keys.has('shift') && this.stance !== 'crouch';

    if (this.hidden) {
      this.speedNow = 0;
      // 藏匿时仍可小幅转动观察
      if (input.mouseWorld) {
        this.angle = Math.atan2(input.mouseWorld.y - this.y, input.mouseWorld.x - this.x);
      }
      return;
    }

    let mx = 0, my = 0;
    const k = input.keys;
    if (k.has('w')) my += 1;
    if (k.has('s')) my -= 1;
    if (k.has('a')) mx -= 1;
    if (k.has('d')) mx += 1;

    if (mx !== 0 || my !== 0) {
      const a = Math.atan2(my, mx);
      const sp = this.speed;
      const d = sp * dt;
      const before = { x: this.x, y: this.y };
      moveWithCollision(this, a, d, C.ENTITY_RADIUS, world.activeWalls(), world.collisionRects());
      const actual = dist(before.x, before.y, this.x, this.y);
      this.speedNow = actual / dt;

      // 面朝鼠标（鼠标在附近时才用移动方向），否则保持鼠标朝向
      if (input.mouseWorld) {
        this.angle = Math.atan2(input.mouseWorld.y - this.y, input.mouseWorld.x - this.x);
      }

      // 脚步噪声
      const nr = this.noiseRadius;
      if (nr > 0) {
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
          world.emitNoise(this.x, this.y, nr, 'footstep');
          this.stepTimer = this.running ? C.STEP_INTERVAL.run : C.STEP_INTERVAL.walk;
        }
      }
    } else {
      this.speedNow = 0;
    }
  }
}
