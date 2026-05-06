import * as THREE from 'three';
import {
  PLAYER_HP, GUNS, TEAM_COLOR, HOUSE_POS, RESPAWN_TIME,
  ROLE_RIFLE, ROLE_MEDIC, ROLE_SNIPER, ROLE_GUN,
  HEADSHOT_MULT, DOWN_BLEEDOUT, REVIVE_TIME, HEAL_PER_SEC, HEAL_RANGE, REVIVE_RANGE,
  RESTOCK_ZONES, speedMultFromHp, LADDER_SPEED, HOUSE_SIZE,
} from './constants.js';
import {
  makeShooter, tickShooter, canShoot, startReload, consumeShot,
  switchSlot, activeGun, activeGunId, restock, makeMuzzleFlash,
} from './guns.js';

const BOT_SPEED = 4.5;
const ENGAGE_RANGE = {
  [ROLE_RIFLE]:  60,
  [ROLE_MEDIC]:  45,
  [ROLE_SNIPER]: 120,
};
const STOP_RANGE = {
  [ROLE_RIFLE]:  22,
  [ROLE_MEDIC]:  28,
  [ROLE_SNIPER]: 70,
};
const RETREAT_HP_FRAC = 0.35;

export class Bot {
  constructor(team, role, scene, spawnPos) {
    this.team = team;
    this.role = role;
    this.scene = scene;
    this.spawnPos = spawnPos.clone();
    this.hp = PLAYER_HP;
    this.alive = true;
    this.downed = false;
    this.bleedoutTimer = 0;
    this.respawnIn = 0;
    this.shooter = makeShooter(ROLE_GUN[role]);

    this.group = new THREE.Group();
    this.group.position.copy(spawnPos);
    scene.add(this.group);

    const bodyMat = new THREE.MeshLambertMaterial({ color: TEAM_COLOR[team] });
    this.bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.6, 8), bodyMat);
    this.bodyMesh.position.y = 0.8;
    this.group.add(this.bodyMesh);

    const headMat = new THREE.MeshLambertMaterial({ color: 0xffd9a8 });
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), headMat);
    this.headMesh.position.y = 1.85;
    this.group.add(this.headMesh);

    this.symbolSprite = makeRoleSprite(role);
    this.symbolSprite.position.y = 2.55;
    this.group.add(this.symbolSprite);

    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x00ff66 }));
    bar.scale.set(1.2, 0.13, 1);
    bar.position.y = 2.25;
    this.group.add(bar);
    this.hpBar = bar;

    // Stats
    this.kills = 0;
    this.deaths = 0;

    // AI state
    this._coverCooldown = 0;
    this._strafeDir = 1;
    this._strafeTimer = 0;
  }

  takeDamage(d, game, isHead = false) {
    if (!this.alive && !this.downed) return;
    if (this.downed) {
      this.die(game);
      return;
    }
    this.hp = Math.max(0, this.hp - d);
    this.updateHpBar();
    if (this.hp <= 0) {
      if (isHead || d >= PLAYER_HP) this.die(game);
      else this.goDown();
    }
  }

  updateHpBar() {
    const r = this.hp / PLAYER_HP;
    this.hpBar.scale.x = 1.2 * Math.max(0.05, r);
    this.hpBar.material.color.setHSL(0.33 * r, 1, 0.5);
  }

  goDown() {
    this.downed = true;
    this.alive = false;
    this.bleedoutTimer = DOWN_BLEEDOUT;
    this.group.scale.y = 0.4;
    this.hpBar.material.color.set(0xffaa00);
  }

  die(game) {
    this.downed = false;
    this.alive = false;
    this.group.visible = false;
    this.respawnIn = RESPAWN_TIME;
    this.deaths++;
    // Drop flag if carrying
    if (game?.flagSystem?.carrier === this) {
      game.flagSystem.dropFlag(this.group.position.clone());
    }
  }

  reviveBy(medic) {
    this.downed = false;
    this.alive = true;
    this.hp = Math.round(PLAYER_HP * 0.5);
    this.bleedoutTimer = 0;
    this.group.scale.y = 1;
    this.group.visible = true;
    this.updateHpBar();
  }

  respawn() {
    this.hp = PLAYER_HP;
    this.alive = true; this.downed = false;
    this.group.visible = true;
    this.group.scale.y = 1;
    this.group.position.copy(this.spawnPos);
    for (let i = 0; i < this.shooter.slots.length; i++) {
      this.shooter.ammo[i] = GUNS[this.shooter.slots[i]].mag;
      this.shooter.reserve[i] = Math.max(0, GUNS[this.shooter.slots[i]].magsAtSpawn - 1);
    }
    this.shooter.reloading = 0;
    this.updateHpBar();
  }

  getPos() { return this.group.position.clone().setY(this.group.position.y + 1.0); }

  update(dt, game) {
    if (this.downed) {
      this.bleedoutTimer -= dt;
      if (this.bleedoutTimer <= 0) this.die(game);
      return;
    }
    if (!this.alive) {
      this.respawnIn -= dt;
      if (this.respawnIn <= 0 && !game.matchOver) this.respawn();
      return;
    }
    tickShooter(this.shooter, dt);
    this._coverCooldown -= dt;
    this._strafeTimer -= dt;

    // Restock if standing in friendly/neutral zone
    for (const z of RESTOCK_ZONES) {
      if (z.team && z.team !== this.team) continue;
      const dx = this.group.position.x - z.x, dz = this.group.position.z - z.z;
      if (dx*dx + dz*dz <= z.r*z.r) { restock(this.shooter); break; }
    }

    // CTF: check flag interactions (pickup dropped flags or grab from roof)
    game.flagSystem?.checkBotInteraction(this);

    // Ladder handling
    const ladder = this._checkLadder(game.world.solids);
    if (ladder) {
      this._climbLadder(dt, ladder, game);
      return;
    }

    if (this.role === ROLE_MEDIC) {
      if (this.medicLogic(dt, game)) return;
    }
    this.combatLogic(dt, game);
  }

  _checkLadder(solids) {
    for (const s of solids) {
      if (!s.isLadder) continue;
      const b = s.box;
      // Generous Y range so bots on the roof can still catch the ladder when stepping off edge
      if (this.group.position.x >= b.min.x && this.group.position.x <= b.max.x &&
          this.group.position.z >= b.min.z && this.group.position.z <= b.max.z &&
          this.group.position.y >= b.min.y - 0.5 && this.group.position.y <= b.max.y + 2.5) {
        return { houseTeam: s.houseTeam };
      }
    }
    return null;
  }

  _climbLadder(dt, ladder, game) {
    const roofY = HOUSE_SIZE.h + 0.5 + 1.0; // top of roof + bot center offset
    const onGround = this.group.position.y <= 1.5;
    const onRoof = this.group.position.y >= roofY - 0.5;
    // Determine direction based on current objective
    let goingUp = true;
    if (onRoof) goingUp = false;
    else if (onGround) goingUp = true;
    // If somewhere in the middle, keep previous direction or default up
    const dir = goingUp ? 1 : -1;
    this.group.position.y += dir * LADDER_SPEED * dt;
    if (goingUp && this.group.position.y >= roofY - 0.3) {
      this.group.position.y = roofY;
    }
    if (!goingUp && this.group.position.y <= 0.8) {
      this.group.position.y = 0.8;
    }
  }

  medicLogic(dt, game) {
    let downedAlly = null, ddist = Infinity;
    for (const b of game.bots) {
      if (b === this) continue;
      if (b.team !== this.team) continue;
      if (!b.downed) continue;
      const d = b.group.position.distanceTo(this.group.position);
      if (d < ddist) { ddist = d; downedAlly = b; }
    }
    if (downedAlly) {
      this.moveToward(downedAlly.group.position, dt, 0, game);
      this.faceTarget(downedAlly.group.position);
      if (ddist <= REVIVE_RANGE) {
        downedAlly._reviveProgress = (downedAlly._reviveProgress || 0) + dt;
        if (downedAlly._reviveProgress >= REVIVE_TIME) {
          downedAlly._reviveProgress = 0;
          downedAlly.reviveBy(this);
        }
      }
      return true;
    }
    let woundAlly = null, hdist = Infinity;
    for (const f of game.allFighters()) {
      if (f.team !== this.team) continue;
      if (f.isSelf?.(this)) continue;
      if (!f.alive) continue;
      if (f.hp >= PLAYER_HP) continue;
      const d = f.getPos().distanceTo(this.group.position);
      if (d < hdist) { hdist = d; woundAlly = f; }
    }
    if (woundAlly && hdist <= HEAL_RANGE * 2.0) {
      this.moveToward(woundAlly.getPos(), dt, HEAL_RANGE * 0.6, game);
      this.faceTarget(woundAlly.getPos());
      if (hdist <= HEAL_RANGE) woundAlly.heal(HEAL_PER_SEC * dt);
      this.combatLogic(dt, game, /*opportunistic=*/true);
      return true;
    }
    return false;
  }

  _isOnRoof(team) {
    const roofY = HOUSE_SIZE.h + 0.5;
    const p = HOUSE_POS[team];
    return this.group.position.y > roofY - 0.5 &&
           Math.abs(this.group.position.x - p.x) < HOUSE_SIZE.w / 2 + 1 &&
           Math.abs(this.group.position.z - p.z) < HOUSE_SIZE.d / 2 + 1;
  }

  combatLogic(dt, game, opportunistic = false) {
    const engageRange = ENGAGE_RANGE[this.role] ?? 60;
    const stopRange   = STOP_RANGE[this.role]   ?? 22;
    const retreating = !opportunistic && this.hp > 0 && this.hp / PLAYER_HP < RETREAT_HP_FRAC;

    // Find nearest enemy + note if any sniper is targeting us
    let target = null, dist = Infinity;
    let enemyHasSniper = false;
    for (const f of game.allFighters()) {
      if (f.team === this.team) continue;
      if (!f.alive) continue;
      const p = f.getPos();
      const d = p.distanceTo(this.group.position);
      if (d < dist) { dist = d; target = { kind: 'fighter', ref: f, pos: p, dist: d }; }
      if (f.role === ROLE_SNIPER && d < 100) enemyHasSniper = true;
    }

    const enemyTeam = this.team === 'blue' ? 'red' : 'blue';
    const fs = game.flagSystem;

    // CTF objective overrides normal combat target
    if (!opportunistic && fs) {
      // If I am carrying the flag, go straight to my base
      if (fs.carrier === this) {
        const home = HOUSE_POS[this.team];
        const homePos = new THREE.Vector3(home.x, 0, home.z);
        // If on a roof, first get to a ladder to climb down
        if (this._isOnRoof(enemyTeam) || this._isOnRoof(this.team)) {
          const ladX = home.x + (this.team === 'blue' ? 1 : -1) * (HOUSE_SIZE.w / 2 + 0.6);
          const ladderPos = new THREE.Vector3(ladX, 0, home.z);
          target = { kind: 'ladder', pos: ladderPos, dist: this.group.position.distanceTo(ladderPos) };
        } else {
          target = { kind: 'home', pos: homePos, dist: this.group.position.distanceTo(homePos) };
        }
      }
      // Dropped enemy flag -> pick it up
      else if (fs.droppedPos && fs.droppedTeam !== this.team) {
        const d = this.group.position.distanceTo(fs.droppedPos);
        if (!target || d < target.dist + 20) {
          target = { kind: 'flag', pos: fs.droppedPos.clone().setY(1), dist: d };
        }
      }
      // Enemy flag at home -> go grab it
      else if (fs.flagAtHome(enemyTeam)) {
        if (this._isOnRoof(enemyTeam)) {
          // Already on enemy roof, go to flag pole
          const roofPos = new THREE.Vector3(HOUSE_POS[enemyTeam].x, HOUSE_SIZE.h + 1.5, HOUSE_POS[enemyTeam].z);
          target = { kind: 'roof', pos: roofPos, dist: this.group.position.distanceTo(roofPos) };
        } else {
          // On ground: go to nearest ladder base
          const ladX = HOUSE_POS[enemyTeam].x + (enemyTeam === 'blue' ? 1 : -1) * (HOUSE_SIZE.w / 2 + 0.6);
          const ladderPos = new THREE.Vector3(ladX, 0, HOUSE_POS[enemyTeam].z);
          const d = this.group.position.distanceTo(ladderPos);
          if (!target || d < target.dist + 40) {
            target = { kind: 'ladder', pos: ladderPos, dist: d };
          }
        }
      }
      // Teammate carrying flag -> escort
      else if (fs.carrier && fs.carrier.team === this.team && fs.carrier !== this) {
        const cPos = fs.carrier.getPos ? fs.carrier.getPos() : fs.carrier.position.clone();
        const d = this.group.position.distanceTo(cPos);
        if (!target || d < target.dist + 30) {
          target = { kind: 'escort', pos: cPos, dist: d };
        }
      }
    }

    if (!target) return;

    // Find cover if enemy sniper is around and we are exposed
    let coverPos = null;
    if (enemyHasSniper && !retreating && target.kind === 'fighter' && target.dist > 40 && this._coverCooldown <= 0) {
      coverPos = this._findCover(game);
      if (coverPos) this._coverCooldown = 3;
    }

    // Movement
    if (retreating) {
      const home = HOUSE_POS[this.team];
      const homePos = new THREE.Vector3(home.x, 0, home.z);
      this.moveToward(homePos, dt, 4, game);
      this.faceTarget(target.pos);
    } else if (coverPos) {
      this.moveTowardWithUnstick(coverPos, dt, game);
      this.faceTarget(target.pos);
    } else {
      const stop = target.kind === 'fighter' ? stopRange : (target.kind === 'flag' || target.kind === 'roof' ? 2 : (target.kind === 'ladder' || target.kind === 'home' ? 1 : 14));
      if (target.dist > stop) {
        this.moveTowardWithUnstick(target.pos, dt, game);
      } else if (target.kind === 'fighter' && this.role === ROLE_SNIPER && target.dist < stopRange * 0.6) {
        const away = this.group.position.clone().sub(target.pos).setY(0).normalize();
        this.group.position.x += away.x * BOT_SPEED * 0.6 * dt;
        this.group.position.z += away.z * BOT_SPEED * 0.6 * dt;
      }
      this.faceTarget(target.pos);
    }

    // Strafe when fighting to be harder to hit
    if (target.kind === 'fighter' && target.dist < engageRange && !retreating && !coverPos) {
      if (this._strafeTimer <= 0) {
        this._strafeDir *= -1;
        this._strafeTimer = 1.2 + Math.random() * 1.5;
      }
      const speed = BOT_SPEED * speedMultFromHp(this.hp) * 0.5;
      const fwd = target.pos.clone().sub(this.group.position).setY(0).normalize();
      const lat = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(this._strafeDir);
      this.group.position.x += lat.x * speed * dt;
      this.group.position.z += lat.z * speed * dt;
    }

    // Reload / fall back to pistol
    if (this.shooter.reloading <= 0 && this.shooter.ammo[this.shooter.activeSlot] === 0) {
      if (this.shooter.reserve[this.shooter.activeSlot] > 0) startReload(this.shooter);
      else if (this.shooter.activeSlot !== 0) switchSlot(this.shooter, 0);
    }

    // Low ammo -> go restock at nearest friendly zone
    const totalAmmo = this.shooter.ammo[this.shooter.activeSlot] + this.shooter.reserve[this.shooter.activeSlot] * GUNS[this.shooter.slots[this.shooter.activeSlot]].mag;
    if (!opportunistic && totalAmmo <= 3 && this.shooter.activeSlot !== 0) {
      let nearestZone = null, zdist = Infinity;
      for (const z of RESTOCK_ZONES) {
        if (z.team && z.team !== this.team) continue;
        const d = Math.hypot(this.group.position.x - z.x, this.group.position.z - z.z);
        if (d < zdist) { zdist = d; nearestZone = z; }
      }
      if (nearestZone) {
        this.moveTowardWithUnstick(new THREE.Vector3(nearestZone.x, 0, nearestZone.z), dt, game);
        this.faceTarget(target.pos);
      }
    }

    const fireRange = target.kind === 'fighter' ? engageRange : engageRange + 20;
    if (canShoot(this.shooter) && target.dist <= fireRange) {
      this.fireAt(target, game);
    }
  }

  _findCover(game) {
    // Look for nearest solid that can block line-of-sight from nearest enemy
    let best = null, bestScore = -Infinity;
    const myPos = this.group.position;
    let nearestEnemyPos = null, nearestEnemyDist = Infinity;
    for (const f of game.allFighters()) {
      if (f.team === this.team || !f.alive) continue;
      const p = f.getPos();
      const d = p.distanceTo(myPos);
      if (d < nearestEnemyDist) { nearestEnemyDist = d; nearestEnemyPos = p; }
    }
    if (!nearestEnemyPos) return null;
    for (const s of game.world.solids) {
      if (s.isLadder) continue;
      const c = s.box.getCenter(new THREE.Vector3());
      const dToMe = c.distanceTo(myPos);
      if (dToMe > 25 || dToMe < 2) continue;
      // Prefer positions that put the solid BETWEEN us and the enemy
      const toEnemy = nearestEnemyPos.clone().sub(myPos).normalize();
      const toSolid = c.clone().sub(myPos).normalize();
      const alignment = toEnemy.dot(toSolid); // higher = more in line
      const score = alignment * 2 - dToMe * 0.05;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  moveTowardWithUnstick(targetPos, dt, game) {
    const before = this.group.position.clone();
    this.moveToward(targetPos, dt, 0, game);
    const moved = this.group.position.distanceToSquared(before);
    const expected = (BOT_SPEED * speedMultFromHp(this.hp) * dt) ** 2 * 0.25;
    if (moved < expected && game?.world?.solids) {
      const side = ((this._sideTick = (this._sideTick || 0) + 1) % 60 < 30) ? 1 : -1;
      const flat = this.group.position.clone(); flat.y = 0;
      const tgt = targetPos.clone(); tgt.y = 0;
      const fwd = tgt.sub(flat).normalize();
      const lateral = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(side);
      const speed = BOT_SPEED * speedMultFromHp(this.hp);
      this.group.position.x += lateral.x * speed * dt;
      this.group.position.z += lateral.z * speed * dt;
    }
  }

  moveToward(targetPos, dt, stopDist = 0, game = null) {
    const flat = this.group.position.clone(); flat.y = 0;
    const tgt = targetPos.clone(); tgt.y = 0;
    const dir = tgt.sub(flat);
    const d = dir.length();
    if (d <= stopDist) return;
    dir.normalize();
    const speed = BOT_SPEED * speedMultFromHp(this.hp);
    const stepX = dir.x * speed * dt;
    const stepZ = dir.z * speed * dt;
    const solids = game?.world?.solids;
    if (!solids || !this._wouldHit(this.group.position.x + stepX, this.group.position.z, solids)) {
      this.group.position.x += stepX;
    }
    if (!solids || !this._wouldHit(this.group.position.x, this.group.position.z + stepZ, solids)) {
      this.group.position.z += stepZ;
    }
  }

  _wouldHit(nx, nz, solids) {
    const r = 0.45;
    const feetY = this.group.position.y;
    const top = feetY + 1.6;
    for (const s of solids) {
      const b = s.box;
      if (b.max.y - feetY <= 1.5 && b.max.y > feetY - 0.05) continue;
      if (b.min.y > top) continue;
      if (nx + r > b.min.x && nx - r < b.max.x && nz + r > b.min.z && nz - r < b.max.z) return true;
    }
    return false;
  }

  faceTarget(p) {
    this.group.rotation.y = Math.atan2(p.x - this.group.position.x, p.z - this.group.position.z);
  }

  fireAt(target, game) {
    const gun = activeGun(this.shooter);
    consumeShot(this.shooter);

    const origin = this.group.position.clone(); origin.y += 1.4;
    const aimAt = target.pos.clone(); aimAt.y += target.kind === 'fighter' ? 1.0 : 2.0;
    const dir = aimAt.sub(origin).normalize();
    dir.x += (Math.random() - 0.5) * (gun.spread * 4);
    dir.y += (Math.random() - 0.5) * (gun.spread * 4);
    dir.z += (Math.random() - 0.5) * (gun.spread * 4);
    dir.normalize();
    makeMuzzleFlash(game.scene, activeGunId(this.shooter), origin.clone().add(dir.clone().multiplyScalar(0.5)), dir);

    // LOS check: raycast to target; if a solid wall is in the way, miss
    const ray = new THREE.Raycaster(origin, dir.clone().normalize(), 0, target.dist + 2);
    const losTargets = [];
    const losMap = new Map();
    // Target mesh (player adapter has no mesh; raycast then just checks for blocking walls)
    if (target.kind === 'fighter' && target.ref.bodyMesh) {
      losTargets.push(target.ref.bodyMesh);
      losMap.set(target.ref.bodyMesh.uuid, { type: 'target' });
    }
    // All walls & solids (exclude bots to avoid false blocks from allies)
    for (const s of game.world.solids) {
      losTargets.push(s.mesh);
      losMap.set(s.mesh.uuid, { type: 'solid' });
    }
    // House walls
    for (const team of ['blue', 'red']) {
      for (const w of game.world.houses[team].walls) {
        if (!losMap.has(w.mesh.uuid)) {
          losTargets.push(w.mesh);
          losMap.set(w.mesh.uuid, { type: 'wall' });
        }
      }
    }
    const losHits = ray.intersectObjects(losTargets, false);
    if (losHits.length > 0) {
      const first = losHits[0];
      const info = losMap.get(first.object.uuid);
      if (info?.type === 'solid' || info?.type === 'wall') {
        // Blocked by wall — no hit
        return;
      }
    }

    const hitChance = target.kind === 'fighter'
      ? Math.max(0.10, 0.55 - target.dist * 0.012)
      : 0.75;
    if (Math.random() > hitChance) return;
    const head = target.kind === 'fighter' && Math.random() < 0.08;
    const dmg = gun.damage * (head ? HEADSHOT_MULT : 1);
    if (target.kind === 'fighter') {
      const wasAlive = target.ref.alive || target.ref.downed;
      target.ref.takeDamage(dmg, game, head);
      if (wasAlive && !target.ref.alive && !target.ref.downed) {
        this.kills++;
      }
    }
  }

  heal(amount) {
    if (!this.alive || this.downed) return;
    this.hp = Math.min(PLAYER_HP, this.hp + amount);
    this.updateHpBar();
  }
}

function makeRoleSprite(role) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 5;
  if (role === ROLE_MEDIC) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(28, 14, 8, 36);
    ctx.fillRect(14, 28, 36, 8);
    ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 3;
    ctx.strokeRect(28, 14, 8, 36);
    ctx.strokeRect(14, 28, 36, 8);
  } else if (role === ROLE_SNIPER) {
    ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.arc(32, 32, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 32); ctx.lineTo(56, 32);
    ctx.moveTo(32, 8); ctx.lineTo(32, 56);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(12, 30, 36, 6);
    ctx.fillRect(40, 24, 10, 6);
    ctx.fillRect(20, 36, 6, 12);
  }
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(0.7, 0.7, 1);
  return sprite;
}

export function fighterAdapterPlayer(player) {
  const id = Symbol('player');
  return {
    _id: id,
    team: player.team,
    get alive() { return player.alive; },
    get hp() { return player.hp; },
    get role() { return player.role; },
    get bodyMesh() { return null; },
    isSelf(other) { return false; },
    getPos() { return player.position.clone(); },
    takeDamage(d) { player.takeDamage(d, { game: null }); },
    heal(amount) { player.hp = Math.min(PLAYER_HP, player.hp + amount); },
  };
}

export function fighterAdapterBot(bot) {
  return {
    _id: bot,
    team: bot.team,
    get alive() { return bot.alive; },
    get hp() { return bot.hp; },
    get role() { return bot.role; },
    get bodyMesh() { return bot.bodyMesh; },
    isSelf(other) { return other === bot; },
    getPos() { return bot.getPos(); },
    takeDamage(d, game, head) { bot.takeDamage(d, game, head); },
    heal(amount) { bot.heal(amount); },
  };
}
