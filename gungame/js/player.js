import * as THREE from 'three';
import { PLAYER_HP, GUNS, TEAM_BLUE, HEADSHOT_MULT, RESTOCK_ZONES, speedMultFromHp, ROLE_RIFLE, ROLE_GUN, PLAYER_RESPAWN_TIME, HOUSE_POS, FALL_DAMAGE, FALL_DAMAGE_THRESHOLD, ROLE_MEDIC, REVIVE_TIME, REVIVE_RANGE, HEAL_PER_SEC, HEAL_RANGE } from './constants.js';
import { makeGunMesh, makeMuzzleFlash, makeShooter, tickShooter, canShoot, startReload, consumeShot, switchSlot, activeGun, activeGunId, restock, setMainGun } from './guns.js';

const EYE_HEIGHT_STAND = 1.6;
const EYE_HEIGHT_PRONE = 0.5;
const MOVE_SPEED = 6;
const SPRINT_MULT = 1.6;
const JUMP_V = 10.0;
const GRAVITY = 22;
const DEFAULT_FOV = 75;

export class Player {
  constructor(camera, domElement, world, role = ROLE_RIFLE) {
    this.camera = camera;
    this.dom = domElement;
    this.world = world;
    this.team = TEAM_BLUE;
    this.role = role;
    this.hp = PLAYER_HP;
    this.alive = true;
    this.respawnIn = 0;
    this.spawnPos = new THREE.Vector3(HOUSE_POS[TEAM_BLUE].x, EYE_HEIGHT_STAND, HOUSE_POS[TEAM_BLUE].z);

    this.position = this.spawnPos.clone();
    this.velocity = new THREE.Vector3();
    this.yaw = Math.PI;
    this.pitch = 0;
    this.onGround = true;

    this.keys = new Set();
    this.mouseDown = false;
    this.rmbDown = false;

    this.shooter = makeShooter(ROLE_GUN[role]);

    this.gunGroup = new THREE.Group();
    this.camera.add(this.gunGroup);
    this.currentGunMesh = null;
    this.equipCurrentMesh();

    this.raycaster = new THREE.Raycaster();
    this.bindEvents();
    this.applyCamera();

    // Stats
    this.kills = 0;
    this.deaths = 0;

    // Prone
    this.isProne = false;
    this.eyeHeight = EYE_HEIGHT_STAND;

    // Fall damage
    this._prevGroundY = null;

    // Medic revive
    this._reviveTarget = null;
    this._reviveProgress = 0;
  }

  setRole(role) {
    this.role = role;
    setMainGun(this.shooter, ROLE_GUN[role]);
    this.equipCurrentMesh();
  }

  setMain(gunId) {
    setMainGun(this.shooter, gunId);
    for (const [role, gid] of Object.entries(ROLE_GUN)) if (gid === gunId) this.role = role;
    this.equipCurrentMesh();
  }

  equipCurrentMesh() {
    if (this.currentGunMesh) this.gunGroup.remove(this.currentGunMesh);
    this.currentGunMesh = makeGunMesh(activeGunId(this.shooter));
    this.gunGroup.add(this.currentGunMesh);
  }

  bindEvents() {
    this.dom.addEventListener('click', () => {
      if (!document.pointerLockElement) this.requestPointerLock();
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.dom) return;
      const sens = this.shooter.ads ? 0.0011 : 0.0025;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      const lim = Math.PI / 2 - 0.05;
      if (this.pitch > lim) this.pitch = lim;
      if (this.pitch < -lim) this.pitch = -lim;
    });
    document.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== this.dom) return;
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) { this.rmbDown = true; this.shooter.ads = true; }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) { this.rmbDown = false; this.shooter.ads = false; }
    });
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyR') startReload(this.shooter);
      if (e.code === 'Digit1') { switchSlot(this.shooter, 0); this.equipCurrentMesh(); }
      if (e.code === 'Digit2') { switchSlot(this.shooter, 1); this.equipCurrentMesh(); }
      if (e.code === 'KeyZ') this.toggleProne();
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    this.dom.addEventListener('contextmenu', e => e.preventDefault());
  }

  requestPointerLock() { this.dom.requestPointerLock?.(); }

  toggleProne() {
    if (!this.alive) return;
    if (this.isProne) {
      // Try stand up — check ceiling
      const solids = this.world?.solids;
      if (solids) {
        const headY = this.position.y + EYE_HEIGHT_STAND + 0.2;
        const r = 0.4;
        for (const s of solids) {
          const b = s.box;
          if (b.max.y < this.position.y + 0.5) continue;
          if (b.min.y > headY) continue;
          if (this.position.x + r > b.min.x && this.position.x - r < b.max.x &&
              this.position.z + r > b.min.z && this.position.z - r < b.max.z) {
            return;
          }
        }
      }
      this.isProne = false;
      this.eyeHeight = EYE_HEIGHT_STAND;
    } else {
      this.isProne = true;
      this.eyeHeight = EYE_HEIGHT_PRONE;
    }
  }

  takeDamage(d, source) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - d);
    if (this.hp <= 0) {
      this.alive = false;
      this.respawnIn = PLAYER_RESPAWN_TIME;
      this.deaths++;
      if (source?.game?.flagSystem?.carrier === this) {
        source.game.flagSystem.dropFlag(this.position.clone());
      }
    }
  }

  respawn() {
    this.alive = true;
    this.hp = PLAYER_HP;
    this.position.copy(this.spawnPos);
    this.velocity.set(0, 0, 0);
    for (let i = 0; i < this.shooter.slots.length; i++) {
      const g = GUNS[this.shooter.slots[i]];
      this.shooter.ammo[i] = g.mag;
      this.shooter.reserve[i] = Math.max(0, g.magsAtSpawn - 1);
    }
    this.shooter.reloading = 0;
    this.isProne = false;
    this.eyeHeight = EYE_HEIGHT_STAND;
    this._reviveTarget = null;
    this._reviveProgress = 0;
  }

  applyCamera() {
    this.camera.position.copy(this.position);
    this.camera.position.y = this.position.y - EYE_HEIGHT_STAND + this.eyeHeight;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    const targetFov = this.shooter.ads ? activeGun(this.shooter).adsFov : DEFAULT_FOV;
    this.camera.fov += (targetFov - this.camera.fov) * 0.25;
    this.camera.updateProjectionMatrix();
    this.gunGroup.position.x = this.shooter.ads ? -0.25 : 0;
    this.gunGroup.position.y = this.shooter.ads ? 0.04 : 0;
  }

  update(dt, game) {
    if (!this.alive) {
      this.respawnIn -= dt;
      if (this.respawnIn <= 0 && !game.matchOver) this.respawn();
      return;
    }
    tickShooter(this.shooter, dt);

    // Restock
    for (const z of RESTOCK_ZONES) {
      if (z.team && z.team !== this.team) continue;
      const dx = this.position.x - z.x, dz = this.position.z - z.z;
      if (dx*dx + dz*dz <= z.r*z.r) { restock(this.shooter); break; }
    }

    // Flag capture interaction
    game.flagSystem?.checkPlayerInteraction(this);

    // Medic revive / heal
    if (this.role === ROLE_MEDIC) {
      this.updateMedic(dt, game);
    }

    // Movement
    this._updateMovement(dt, game);

    // Shooting
    if (this.mouseDown && canShoot(this.shooter)) this.shoot(game);

    this.applyCamera();
  }

  updateMedic(dt, game) {
    // Find nearest downed ally
    let target = null, bestD = Infinity;
    for (const b of game.bots) {
      if (b.team !== this.team || !b.downed) continue;
      const d = b.group.position.distanceTo(this.position);
      if (d < bestD) { bestD = d; target = b; }
    }
    if (target && bestD <= REVIVE_RANGE) {
      this._reviveTarget = target;
      this._reviveProgress += dt;
      if (this._reviveProgress >= REVIVE_TIME) {
        target.reviveBy(this);
        this._reviveProgress = 0;
        this._reviveTarget = null;
      }
    } else {
      this._reviveTarget = null;
      this._reviveProgress = 0;
    }

    // Heal nearby wounded allies automatically
    for (const f of game.allFighters()) {
      if (f.team !== this.team) continue;
      if (f.isSelf?.(this)) continue;
      if (!f.alive) continue;
      if (f.hp >= PLAYER_HP) continue;
      const d = f.getPos().distanceTo(this.position);
      if (d <= HEAL_RANGE) {
        f.heal(HEAL_PER_SEC * dt);
      }
    }
  }

  getReviveHUD() {
    if (this._reviveTarget && this._reviveProgress > 0) {
      return { progress: this._reviveProgress / REVIVE_TIME, target: this._reviveTarget };
    }
    return null;
  }

  _updateMovement(dt, game) {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const dir = new THREE.Vector3();
    if (this.keys.has('KeyW')) dir.add(forward);
    if (this.keys.has('KeyS')) dir.sub(forward);
    if (this.keys.has('KeyD')) dir.add(right);
    if (this.keys.has('KeyA')) dir.sub(right);
    if (dir.lengthSq() > 0) dir.normalize();
    let speed = MOVE_SPEED * speedMultFromHp(this.hp);
    if (this.keys.has('ShiftLeft') && !this.shooter.ads && !this.isProne) speed *= SPRINT_MULT;
    if (this.shooter.ads) speed *= 0.5;
    if (this.isProne) speed *= 0.3;
    this.velocity.x = dir.x * speed;
    this.velocity.z = dir.z * speed;

    if (this.keys.has('Space') && this.onGround && !this.isProne) {
      this.velocity.y = JUMP_V;
      this.onGround = false;
    }
    this.velocity.y -= GRAVITY * dt;

    this.tryMove(dt, game);
  }

  tryMove(dt, game) {
    const solids = game.world.solids;
    const stepX = this.velocity.x * dt;
    const stepZ = this.velocity.z * dt;

    // Sub-step XZ movement to prevent tunneling through thin walls
    const maxSubStep = 0.25;
    const subSteps = Math.max(1, Math.ceil(Math.max(Math.abs(stepX), Math.abs(stepZ)) / maxSubStep));
    for (let i = 0; i < subSteps; i++) {
      const sx = stepX / subSteps;
      const sz = stepZ / subSteps;
      if (!this.collidesXZ(this.position.x + sx, this.position.y, this.position.z, solids))
        this.position.x += sx;
      if (!this.collidesXZ(this.position.x, this.position.y, this.position.z + sz, solids))
        this.position.z += sz;
    }

    let nextY = this.position.y + this.velocity.y * dt;
    const floorY = this.sampleFloor(this.position.x, this.position.z, solids) + this.eyeHeight;

    if (nextY <= floorY) {
      if (!this.onGround && this._prevGroundY !== null) {
        const fallen = this._prevGroundY - floorY;
        if (fallen > FALL_DAMAGE_THRESHOLD) {
          this.hp = Math.max(1, this.hp - FALL_DAMAGE);
        }
      }
      nextY = floorY;
      this.velocity.y = 0;
      this.onGround = true;
      this._prevGroundY = floorY;
    } else {
      if (this.onGround) {
        this._prevGroundY = this.position.y;
      }
      this.onGround = false;
    }
    this.position.y = nextY;
  }

  collidesXZ(px, py, pz, solids) {
    const r = 0.4;
    const feetY = py - this.eyeHeight;
    const min = new THREE.Vector3(px - r, feetY + 0.05, pz - r);
    const max = new THREE.Vector3(px + r, py + 0.2, pz + r);
    const test = new THREE.Box3(min, max);
    // Cars require a jump: on ground step-up is low (0.8), rising jump allows 2.0
    const baseStep = this.onGround ? 0.8 : 0.4;
    const stepUp = (!this.onGround && this.velocity.y > 1.5) ? 2.0 : baseStep;
    for (const s of solids) {
      const topY = s.box.max.y;
      if (topY - feetY <= stepUp && topY > feetY - 0.05) continue;
      if (s.box.intersectsBox(test)) return true;
    }
    return false;
  }

  sampleFloor(px, pz, solids) {
    let best = 0;
    const feetY = this.position.y - this.eyeHeight;
    for (const s of solids) {
      const b = s.box;
      if (px >= b.min.x - 0.4 && px <= b.max.x + 0.4 && pz >= b.min.z - 0.4 && pz <= b.max.z + 0.4) {
        if (b.max.y > best && b.max.y <= feetY + 1.6) best = b.max.y;
      }
    }
    return best;
  }

  shoot(game) {
    const gun = activeGun(this.shooter);
    consumeShot(this.shooter);

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const spread = this.shooter.ads ? gun.spread * 0.25 : gun.spread;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();

    const origin = this.position.clone();
    origin.y += this.eyeHeight - 0.2;
    this.raycaster.set(origin, dir);
    this.raycaster.far = gun.range;

    const targets = [];
    const map = new Map();
    for (const bot of game.bots) {
      if (!bot.alive && !bot.downed) continue;
      targets.push(bot.bodyMesh); map.set(bot.bodyMesh.uuid, { type: 'bot', ref: bot, head: false });
      targets.push(bot.headMesh); map.set(bot.headMesh.uuid, { type: 'bot', ref: bot, head: true });
    }
    for (const team of ['blue', 'red']) {
      const h = game.world.houses[team];
      for (const w of h.walls) { targets.push(w.mesh); map.set(w.mesh.uuid, { type: 'house', ref: h }); }
    }
    for (const s of game.world.solids) {
      if (!map.has(s.mesh.uuid)) { targets.push(s.mesh); map.set(s.mesh.uuid, { type: 'solid' }); }
    }

    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      const h = hits[0];
      const info = map.get(h.object.uuid);
      if (info?.type === 'bot' && info.ref.team !== this.team) {
        const dmg = gun.damage * (info.head ? HEADSHOT_MULT : 1);
        const wasAlive = info.ref.alive || info.ref.downed;
        info.ref.takeDamage(dmg, game, info.head);
        if (wasAlive && !info.ref.alive && !info.ref.downed) {
          this.kills++;
        }
      }
    }

    const muzzle = new THREE.Vector3();
    this.currentGunMesh.getWorldPosition(muzzle);
    muzzle.add(dir.clone().multiplyScalar(0.6));
    makeMuzzleFlash(game.scene, activeGunId(this.shooter), muzzle, dir);
  }
}
