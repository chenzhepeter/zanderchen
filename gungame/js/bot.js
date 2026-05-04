import * as THREE from 'three';
import {
  PLAYER_HP, GUNS, TEAM_COLOR, HOUSE_POS, HOUSE_DAMAGE_FACTOR, RESPAWN_TIME,
  ROLE_RIFLE, ROLE_MEDIC, ROLE_SNIPER, ROLE_GUN,
  HEADSHOT_MULT, DOWN_BLEEDOUT, REVIVE_TIME, HEAL_PER_SEC, HEAL_RANGE, REVIVE_RANGE,
  RESTOCK_ZONES, speedMultFromHp,
} from './constants.js';
import {
  makeShooter, tickShooter, canShoot, startReload, consumeShot,
  switchSlot, activeGun, activeGunId, restock, makeMuzzleFlash,
} from './guns.js';

const BOT_SPEED = 4.5;
// Range a bot will TRY to engage from. Sniper engages much further.
const ENGAGE_RANGE = {
  [ROLE_RIFLE]:  60,
  [ROLE_MEDIC]:  45,
  [ROLE_SNIPER]: 120,
};
// Distance at which the bot stops advancing on the enemy.
const STOP_RANGE = {
  [ROLE_RIFLE]:  22,
  [ROLE_MEDIC]:  28,
  [ROLE_SNIPER]: 70,
};
// Below this HP fraction, retreat toward own house instead of fighting.
const RETREAT_HP_FRAC = 0.25;

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

    // Role symbol sprite above head
    this.symbolSprite = makeRoleSprite(role);
    this.symbolSprite.position.y = 2.55;
    this.group.add(this.symbolSprite);

    // HP bar
    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x00ff66 }));
    bar.scale.set(1.2, 0.13, 1);
    bar.position.y = 2.25;
    this.group.add(bar);
    this.hpBar = bar;
  }

  takeDamage(d, game, isHead = false) {
    if (!this.alive && !this.downed) return;
    if (this.downed) {
      // Finishing blow on a downed bot kills permanently
      this.die(game);
      return;
    }
    this.hp = Math.max(0, this.hp - d);
    this.updateHpBar();
    if (this.hp <= 0) {
      // Snipers / headshots will instakill if overkill, otherwise downed
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
    this.group.scale.y = 0.4; // collapsed
    this.hpBar.material.color.set(0xffaa00);
  }

  die(game) {
    this.downed = false;
    this.alive = false;
    this.group.visible = false;
    this.respawnIn = RESPAWN_TIME;
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
    // refill ammo
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

    // Restock if standing in friendly/neutral zone
    for (const z of RESTOCK_ZONES) {
      if (z.team && z.team !== this.team) continue;
      const dx = this.group.position.x - z.x, dz = this.group.position.z - z.z;
      if (dx*dx + dz*dz <= z.r*z.r) { restock(this.shooter); break; }
    }

    if (this.role === ROLE_MEDIC) {
      if (this.medicLogic(dt, game)) return;
    }
    this.combatLogic(dt, game);
  }

  // Returns true if medic chose a non-combat action (heal/revive)
  medicLogic(dt, game) {
    // Find a downed ally first
    let downedAlly = null, ddist = Infinity;
    for (const b of game.bots) {
      if (b === this) continue;
      if (b.team !== this.team) continue;
      if (!b.downed) continue;
      const d = b.group.position.distanceTo(this.group.position);
      if (d < ddist) { ddist = d; downedAlly = b; }
    }
    if (downedAlly) {
      // Walk to ally; revive when close
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
    // Heal nearby wounded ally (or human)
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
      // Still shoot at any enemy in close range
      this.combatLogic(dt, game, /*opportunistic=*/true);
      return true;
    }
    return false;
  }

  combatLogic(dt, game, opportunistic = false) {
    const engageRange = ENGAGE_RANGE[this.role] ?? 60;
    const stopRange   = STOP_RANGE[this.role]   ?? 22;

    // Low-HP retreat: walk back toward own base, but still shoot at close threats.
    const retreating = !opportunistic && this.hp > 0 && this.hp / PLAYER_HP < RETREAT_HP_FRAC;

    // Find nearest enemy
    let target = null, dist = Infinity;
    for (const f of game.allFighters()) {
      if (f.team === this.team) continue;
      if (!f.alive) continue;
      const p = f.getPos();
      const d = p.distanceTo(this.group.position);
      if (d < dist) { dist = d; target = { kind: 'fighter', ref: f, pos: p, dist: d }; }
    }
    const enemyTeam = this.team === 'blue' ? 'red' : 'blue';
    const enemyHouse = game.world.houses[enemyTeam];
    // If no enemy in engage range, push the enemy house instead.
    if (!opportunistic && (!target || target.dist > engageRange + 30) && enemyHouse.hp > 0) {
      const hp = new THREE.Vector3(enemyHouse.pos.x, 0, enemyHouse.pos.z);
      target = { kind: 'house', ref: enemyHouse, pos: hp, dist: hp.distanceTo(this.group.position) };
    }
    if (!target) return;

    // Movement
    if (retreating) {
      const home = HOUSE_POS[this.team];
      const homePos = new THREE.Vector3(home.x, 0, home.z);
      this.moveToward(homePos, dt, 4, game);
      this.faceTarget(target.pos);
    } else {
      const stop = target.kind === 'fighter' ? stopRange : 14;
      if (target.dist > stop) {
        this.moveTowardWithUnstick(target.pos, dt, game);
      } else if (target.kind === 'fighter' && this.role === ROLE_SNIPER && target.dist < stopRange * 0.6) {
        // Sniper: keep distance — back away a step
        const away = this.group.position.clone().sub(target.pos).setY(0).normalize();
        this.group.position.x += away.x * BOT_SPEED * 0.6 * dt;
        this.group.position.z += away.z * BOT_SPEED * 0.6 * dt;
      }
      this.faceTarget(target.pos);
    }

    // Reload / fall back to pistol
    if (this.shooter.reloading <= 0 && this.shooter.ammo[this.shooter.activeSlot] === 0) {
      if (this.shooter.reserve[this.shooter.activeSlot] > 0) startReload(this.shooter);
      else if (this.shooter.activeSlot !== 0) switchSlot(this.shooter, 0);
    }

    // Fire if within this role's effective range
    const fireRange = target.kind === 'fighter' ? engageRange : engageRange + 20;
    if (canShoot(this.shooter) && target.dist <= fireRange) {
      this.fireAt(target, game);
    }
  }

  // Move toward target; if blocked by a solid in front, sidestep around it.
  moveTowardWithUnstick(targetPos, dt, game) {
    const before = this.group.position.clone();
    this.moveToward(targetPos, dt, 0, game);
    const moved = this.group.position.distanceToSquared(before);
    // If we tried to move but barely did, we're probably stuck on a wall.
    const expected = (BOT_SPEED * speedMultFromHp(this.hp) * dt) ** 2 * 0.25;
    if (moved < expected && game?.world?.solids) {
      // Pick a side based on bot id parity for variety
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
    // Try X then Z separately so we slide along walls instead of jamming.
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
      // Allow stepping over short obstacles (wheels, low crates, stairs)
      if (b.max.y - feetY <= 1.5 && b.max.y > feetY - 0.05) continue;
      // Don't block on solids that are entirely above the bot's head
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

    // Bot aim is intentionally soft so the player can react.
    const hitChance = target.kind === 'fighter'
      ? Math.max(0.10, 0.55 - target.dist * 0.012)
      : 0.75;
    if (Math.random() > hitChance) return;
    // 8% headshots from bots
    const head = target.kind === 'fighter' && Math.random() < 0.08;
    const dmg = gun.damage * (head ? HEADSHOT_MULT : 1);
    if (target.kind === 'fighter') target.ref.takeDamage(dmg, game, head);
    else target.ref.damage(gun.damage * HOUSE_DAMAGE_FACTOR);
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
  } else { // rifle
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

// Adapter for the human player so bots can address allies/enemies uniformly.
export function fighterAdapterPlayer(player) {
  const id = Symbol('player');
  return {
    _id: id,
    team: player.team,
    get alive() { return player.alive; },
    get hp() { return player.hp; },
    isSelf(other) { return false; }, // medic is a Bot, never the player
    getPos() { return player.position.clone(); },
    takeDamage(d) { player.takeDamage(d); },
    heal(amount) { player.hp = Math.min(PLAYER_HP, player.hp + amount); },
  };
}

export function fighterAdapterBot(bot) {
  return {
    _id: bot,
    team: bot.team,
    get alive() { return bot.alive; },
    get hp() { return bot.hp; },
    isSelf(other) { return other === bot; },
    getPos() { return bot.getPos(); },
    takeDamage(d, game, head) { bot.takeDamage(d, game, head); },
    heal(amount) { bot.heal(amount); },
  };
}
