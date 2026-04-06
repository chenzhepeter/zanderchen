import * as THREE from 'three';
import { BLOCK, TEAM_RED, TEAM_BLUE, GRAVITY, WALK_SPEED, PLAYER_HEIGHT, PLAYER_WIDTH,
         AI_SIGHT_RANGE, AI_ATTACK_RANGE, ATTACK_COOLDOWN, KNOCKBACK_FORCE,
         ZOMBIE_HP, ZOMBIE_DAMAGE, ZOMBIE_SIGHT_RANGE, ZOMBIE_RESPAWN_TIME,
         ITEMS, ATTACK_RANGE } from './constants.js';

// ==================== BASE ENTITY ====================
export class Entity {
  constructor(game, position, team = null) {
    this.game = game;
    this.world = game.world;
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.team = team;
    this.hp = 20;
    this.maxHp = 20;
    this.armor = 0;
    this.alive = true;
    this.onGround = false;
    this.yaw = 0;

    // Visual
    this.mesh = null;

    // Combat
    this.attackCooldown = 0;
    this.invincibleTimer = 0;
    this.damage = 3; // base melee damage
  }

  createMesh(color, headColor = null, isMonster = false) {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.9, 0.3);
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.85;
    group.add(body);

    // Head
    const hSize = isMonster ? 0.6 : 0.5;
    const headGeo = new THREE.BoxGeometry(hSize, hSize, hSize);
    const headMat = new THREE.MeshLambertMaterial({ color: headColor || 0xffcc99 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = isMonster ? 1.6 : 1.55;
    head.name = 'head';
    group.add(head);

    // === FACE (on front of head, -Z direction is forward) ===
    if (!isMonster) {
      // Eyes (two white squares with dark pupils)
      const eyeGeo = new THREE.PlaneGeometry(0.1, 0.1);
      const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide });
      const pupilGeo = new THREE.PlaneGeometry(0.06, 0.06);
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.FrontSide });

      const leftEye = new THREE.Mesh(eyeGeo, eyeWhite);
      leftEye.position.set(-0.1, 1.6, -0.26);
      group.add(leftEye);
      const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
      leftPupil.position.set(-0.1, 1.58, -0.265);
      group.add(leftPupil);

      const rightEye = new THREE.Mesh(eyeGeo, eyeWhite);
      rightEye.position.set(0.1, 1.6, -0.26);
      group.add(rightEye);
      const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
      rightPupil.position.set(0.1, 1.58, -0.265);
      group.add(rightPupil);

      // Mouth (small dark rectangle)
      const mouthGeo = new THREE.PlaneGeometry(0.12, 0.04);
      const mouthMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.FrontSide });
      const mouth = new THREE.Mesh(mouthGeo, mouthMat);
      mouth.position.set(0, 1.42, -0.26);
      group.add(mouth);
    } else {
      // Monster face: glowing red eyes, jagged mouth
      const mEyeGeo = new THREE.PlaneGeometry(0.14, 0.08);
      const mEyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.FrontSide });

      const mLeftEye = new THREE.Mesh(mEyeGeo, mEyeMat);
      mLeftEye.position.set(-0.12, 1.65, -0.31);
      group.add(mLeftEye);

      const mRightEye = new THREE.Mesh(mEyeGeo, mEyeMat);
      mRightEye.position.set(0.12, 1.65, -0.31);
      group.add(mRightEye);

      // Jagged mouth
      const mouthGeo = new THREE.PlaneGeometry(0.25, 0.08);
      const mouthMat = new THREE.MeshBasicMaterial({ color: 0x440000, side: THREE.FrontSide });
      const mouth = new THREE.Mesh(mouthGeo, mouthMat);
      mouth.position.set(0, 1.45, -0.31);
      group.add(mouth);

      // Teeth
      const toothGeo = new THREE.PlaneGeometry(0.04, 0.06);
      const toothMat = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.FrontSide });
      for (let i = -2; i <= 2; i++) {
        const tooth = new THREE.Mesh(toothGeo, toothMat);
        tooth.position.set(i * 0.06, 1.48, -0.315);
        group.add(tooth);
      }
    }

    // === BACK OF HEAD (hair/marking to show direction) ===
    if (!isMonster) {
      const backGeo = new THREE.PlaneGeometry(0.35, 0.2);
      const backMat = new THREE.MeshBasicMaterial({ color: 0x664422, side: THREE.FrontSide });
      const backHair = new THREE.Mesh(backGeo, backMat);
      backHair.position.set(0, 1.65, 0.26);
      backHair.rotation.y = Math.PI;
      group.add(backHair);
    }

    // Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    const armMat = new THREE.MeshLambertMaterial({ color: isMonster ? headColor || color : color });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.4, 0.95, 0);
    leftArm.name = 'leftArm';
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.4, 0.95, 0);
    rightArm.name = 'rightArm';
    group.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.25, 0.6, 0.25);
    const legColor = isMonster ? 0x2a3a2a : 0x444488;
    const legMat = new THREE.MeshLambertMaterial({ color: legColor });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.15, 0.3, 0);
    leftLeg.name = 'leftLeg';
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.15, 0.3, 0);
    rightLeg.name = 'rightLeg';
    group.add(rightLeg);

    // HP bar above head
    const hpBarBg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide })
    );
    hpBarBg.position.y = 2.0;
    hpBarBg.name = 'hpBarBg';
    group.add(hpBarBg);

    const hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
    );
    hpBar.position.y = 2.0;
    hpBar.name = 'hpBar';
    group.add(hpBar);

    this.mesh = group;
    this.game.scene.add(group);
  }

  updateMesh() {
    if (!this.mesh) return;
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    this.mesh.rotation.y = this.yaw;

    // Update HP bar
    const hpBar = this.mesh.getObjectByName('hpBar');
    if (hpBar) {
      const ratio = this.hp / this.maxHp;
      hpBar.scale.x = ratio;
      hpBar.position.x = (ratio - 1) * 0.4;
      hpBar.material.color.setHex(ratio > 0.5 ? 0x00ff00 : ratio > 0.25 ? 0xffff00 : 0xff0000);

      // Billboard: counter-rotate bars so they always face the camera
      // The parent group is rotated by this.yaw, so we negate it and add camera yaw
      const cam = this.game.camera;
      const camDir = new THREE.Vector3();
      cam.getWorldDirection(camDir);
      const camYaw = Math.atan2(-camDir.x, -camDir.z);
      const localYaw = camYaw - this.yaw;

      const hpBg = this.mesh.getObjectByName('hpBarBg');
      [hpBar, hpBg].forEach(bar => {
        if (bar) {
          bar.rotation.set(0, localYaw, 0);
        }
      });
    }

    // Simple walk animation
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    const time = performance.now() * 0.005;
    const swing = speed > 0.5 ? Math.sin(time * 3) * 0.5 : 0;

    const lArm = this.mesh.getObjectByName('leftArm');
    const rArm = this.mesh.getObjectByName('rightArm');
    const lLeg = this.mesh.getObjectByName('leftLeg');
    const rLeg = this.mesh.getObjectByName('rightLeg');
    if (lArm) lArm.rotation.x = swing;
    if (rArm) rArm.rotation.x = -swing;
    if (lLeg) lLeg.rotation.x = -swing;
    if (rLeg) rLeg.rotation.x = swing;

    this.mesh.visible = this.alive;
  }

  moveWithCollision(dt) {
    // Clamp fall speed to prevent tunneling
    this.velocity.y = Math.max(this.velocity.y, -15);

    // Sub-step for large dt
    const maxStep = 0.02;
    let remaining = dt;
    while (remaining > 0) {
      const step = Math.min(remaining, maxStep);
      this._moveStep(step);
      remaining -= step;
    }
  }

  _moveStep(dt) {
    const hw = PLAYER_WIDTH / 2;
    const h = PLAYER_HEIGHT;

    // X axis
    this.position.x += this.velocity.x * dt;
    if (this._checkCollision(hw, h)) {
      this.position.x -= this.velocity.x * dt;
      this.velocity.x = 0;
    }

    // Y axis
    this.position.y += this.velocity.y * dt;
    if (this._checkCollision(hw, h)) {
      if (this.velocity.y < 0) {
        this.position.y = Math.floor(this.position.y) + 1.001;
        this.onGround = true;
      } else {
        this.position.y -= this.velocity.y * dt;
      }
      this.velocity.y = 0;
    } else {
      this.onGround = false;
    }

    // Z axis
    this.position.z += this.velocity.z * dt;
    if (this._checkCollision(hw, h)) {
      this.position.z -= this.velocity.z * dt;
      this.velocity.z = 0;
    }
  }

  _checkCollision(hw, h) {
    const px = this.position.x;
    const py = this.position.y;
    const pz = this.position.z;

    const minX = Math.floor(px - hw);
    const maxX = Math.floor(px + hw);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + h);
    const minZ = Math.floor(pz - hw);
    const maxZ = Math.floor(pz + hw);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.world.isSolid(x, y, z)) {
            if (px + hw > x && px - hw < x + 1 &&
                py + h > y && py < y + 1 &&
                pz + hw > z && pz - hw < z + 1) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  takeDamage(amount, attacker = null) {
    if (this.invincibleTimer > 0) return;
    if (!this.alive) return;

    const reduction = this.armor * 0.04;
    amount = Math.max(1, Math.floor(amount * (1 - reduction)));
    this.hp -= amount;

    if (attacker) {
      const attackerPos = attacker.position || attacker;
      const dir = new THREE.Vector3().subVectors(this.position, attackerPos).normalize();
      this.velocity.x += dir.x * KNOCKBACK_FORCE;
      this.velocity.y += KNOCKBACK_FORCE * 0.4;
      this.velocity.z += dir.z * KNOCKBACK_FORCE;
    }

    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    this.hp = 0;
    this.alive = false;
  }

  distanceTo(other) {
    const otherPos = other.position || other;
    return this.position.distanceTo(otherPos);
  }

  dispose() {
    if (this.mesh) {
      this.game.scene.remove(this.mesh);
      this.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
  }
}

// ==================== NPC (Team member AI) ====================
export class NPCEntity extends Entity {
  constructor(game, position, team, name) {
    super(game, position, team);
    this.name = name;
    this.respawnTimer = 0;
    this.eliminated = false;

    // AI state
    this.state = 'idle'; // idle, gather, follow, attack, defend, bridge, buy
    this.command = 'follow'; // current command from player
    this.target = null;
    this.pathTarget = null;
    this.stateTimer = 0;
    this.thinkTimer = 0;
    this.jumpTimer = 0;
    this.stuckTimer = 0;
    this.lastPosition = position.clone();
    this.buyTimer = 3 + Math.random() * 3;
    this.gatherTimer = 0;
    this.wanderTarget = null;

    // NPC inventory (simplified)
    this.currency = { copper: 0, iron: 0, diamond: 0, gold: 0 };
    this.hasWeapon = false;
    this.hasArmor = false;
    this.blockCount = 0;

    const color = team === TEAM_RED ? 0xcc4444 : 0x4444cc;
    this.createMesh(color);
  }

  update(dt) {
    if (!this.alive) {
      if (this.eliminated) return;
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    this.thinkTimer -= dt;
    this.jumpTimer -= dt;
    this.buyTimer -= dt;

    // Gravity
    this.velocity.y -= GRAVITY * dt;

    // AI thinking
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.3 + Math.random() * 0.3;
      this._think();
    }

    // Auto-buy when near spawner
    if (this.buyTimer <= 0) {
      this.buyTimer = 4 + Math.random() * 3;
      this._autoBuy();
    }

    // Execute current behavior
    this._executeBehavior(dt);

    // Stuck detection
    this.stuckTimer += dt;
    if (this.stuckTimer > 0.8) {
      const dist = this.position.distanceTo(this.lastPosition);
      if (dist < 0.3 && this.state !== 'idle' && this.state !== 'buy') {
        if (this.onGround) {
          // Jump higher and nudge sideways to escape
          this.velocity.y = 9;
          this.onGround = false;
          // Add a sideways nudge to avoid getting stuck in the same spot
          const sideX = (Math.random() - 0.5) * 4;
          const sideZ = (Math.random() - 0.5) * 4;
          this.velocity.x += sideX;
          this.velocity.z += sideZ;
        }
      }
      this.lastPosition.copy(this.position);
      this.stuckTimer = 0;
    }

    this.moveWithCollision(dt);

    // Void death
    if (this.position.y < -5) {
      this.die();
    }

    this.updateMesh();
  }

  _autoBuy() {
    // Priority: weapon > blocks > armor
    if (!this.hasWeapon && this.currency.copper >= 8) {
      this.hasWeapon = true;
      this.damage = 5;
      this.currency.copper -= 8;
    }
    if (this.blockCount < 32 && this.currency.copper >= 2) {
      this.blockCount += 16;
      this.currency.copper -= 2;
    }
    if (!this.hasArmor && this.currency.copper >= 6) {
      this.hasArmor = true;
      this.armor = 2;
      this.currency.copper -= 6;
    }
  }

  _think() {
    // Find nearby enemies - always fight if close
    const nearestEnemy = this._findNearestEnemy();
    if (nearestEnemy && this.distanceTo(nearestEnemy) < AI_SIGHT_RANGE) {
      this.state = 'attack';
      this.target = nearestEnemy;
      return;
    }

    // Follow commands from player
    switch (this.command) {
      case 'follow':
        // Smart follow: stay near player but also gather resources and buy gear
        this._thinkFollowMode();
        break;
      case 'defend':
        this.state = 'defend';
        break;
      case 'attack':
        this.state = 'attack_base';
        break;
      default:
        this._thinkFollowMode();
    }
  }

  _thinkFollowMode() {
    const player = this.game.player;
    const distToPlayer = player.alive ? this.distanceTo(player) : 999;

    // If player is far away (> 15 blocks), move toward player
    if (distToPlayer > 15 && player.alive) {
      this.state = 'follow_close';
      return;
    }

    // If player is in enemy territory or center, join the attack
    if (player.alive) {
      const homeIsland = this.team === TEAM_RED ? this.world.redSpawnPos : this.world.blueSpawnPos;
      const playerDistFromHome = Math.sqrt(
        (player.position.x - homeIsland.x) ** 2 + (player.position.z - homeIsland.z) ** 2
      );
      if (playerDistFromHome > 20 && this.blockCount >= 8) {
        // Player is far from home — follow aggressively and attack enemies along the way
        this.state = 'follow_close';
        return;
      }
    }

    // If player is nearby (< 15), do autonomous actions
    // Priority 1: Pickup nearby currency drops
    const nearestDrop = this._findNearestCurrencyDrop();
    if (nearestDrop && this.position.distanceTo(nearestDrop.position) < 8) {
      this.state = 'gather_drop';
      this.gatherTarget = nearestDrop;
      return;
    }

    // Priority 2: Go near resource spawner to collect resources
    const spawnerPos = this.team === TEAM_RED ? this.world.redSpawnerPos : this.world.blueSpawnerPos;
    if (spawnerPos) {
      const spawnerVec = new THREE.Vector3(spawnerPos.x, spawnerPos.y, spawnerPos.z);
      const distToSpawner = this.position.distanceTo(spawnerVec);
      if (distToSpawner > 5) {
        this.state = 'go_spawner';
        return;
      }
    }

    // Priority 3: If near player, loosely follow but wander
    if (distToPlayer < 10) {
      this.state = 'wander_near_player';
    } else {
      this.state = 'follow_close';
    }
  }

  _executeBehavior(dt) {
    switch (this.state) {
      case 'follow_close':
        this._followPlayerClose(dt);
        break;
      case 'wander_near_player':
        this._wanderNearPlayer(dt);
        break;
      case 'gather_drop':
        this._gatherDrop(dt);
        break;
      case 'go_spawner':
        this._goToSpawner(dt);
        break;
      case 'attack':
        this._attackTarget(dt);
        break;
      case 'defend':
        this._defendBed(dt);
        break;
      case 'attack_base':
        this._attackEnemyBase(dt);
        break;
      case 'gather':
        this._gatherResources(dt);
        break;
      default:
        this._idle(dt);
    }
  }

  _followPlayerClose(dt) {
    const player = this.game.player;
    if (!player.alive) { this._idle(dt); return; }

    const dist = this.distanceTo(player);
    if (dist > 4) {
      this._moveToward(player.position, dt);
    } else {
      this.velocity.x *= 0.5;
      this.velocity.z *= 0.5;
    }
  }

  _wanderNearPlayer(dt) {
    // Wander around the current area, staying loosely near player
    if (!this.wanderTarget || this.position.distanceTo(this.wanderTarget) < 2 || Math.random() < 0.01) {
      // Pick a new random wander target near current position
      const player = this.game.player;
      const baseX = player.alive ? player.position.x : this.position.x;
      const baseZ = player.alive ? player.position.z : this.position.z;
      this.wanderTarget = new THREE.Vector3(
        baseX + (Math.random() - 0.5) * 10,
        this.position.y,
        baseZ + (Math.random() - 0.5) * 10
      );
    }
    this._moveToward(this.wanderTarget, dt, 0.6);
  }

  _gatherDrop(dt) {
    if (!this.gatherTarget || this.gatherTarget.timer <= 0) {
      this.state = 'wander_near_player';
      return;
    }
    const dist = this.position.distanceTo(this.gatherTarget.position);
    if (dist > 1.5) {
      this._moveToward(this.gatherTarget.position, dt);
    } else {
      this.velocity.x *= 0.3;
      this.velocity.z *= 0.3;
    }
  }

  _goToSpawner(dt) {
    const spawnerPos = this.team === TEAM_RED ? this.world.redSpawnerPos : this.world.blueSpawnerPos;
    if (!spawnerPos) { this._idle(dt); return; }
    const spawnerVec = new THREE.Vector3(spawnerPos.x, spawnerPos.y, spawnerPos.z);
    const dist2D = Math.sqrt(
      (this.position.x - spawnerVec.x) ** 2 +
      (this.position.z - spawnerVec.z) ** 2
    );
    if (dist2D > 2) {
      this._moveToward(spawnerVec, dt);
    } else {
      this.velocity.x *= 0.3;
      this.velocity.z *= 0.3;
    }
  }

  _findNearestCurrencyDrop() {
    let nearest = null;
    let minDist = Infinity;
    for (const drop of this.game.currencyDrops) {
      const d = this.position.distanceTo(drop.position);
      if (d < minDist) {
        minDist = d;
        nearest = drop;
      }
    }
    return nearest;
  }

  _attackTarget(dt) {
    if (!this.target || !this.target.alive) {
      this.target = null;
      this.state = 'idle';
      return;
    }

    const dist = this.distanceTo(this.target);
    if (dist > AI_SIGHT_RANGE) {
      this.target = null;
      this.state = 'idle';
      return;
    }

    if (dist > AI_ATTACK_RANGE) {
      this._moveToward(this.target.position, dt);
    } else {
      // Attack
      this._faceTarget(this.target.position);
      if (this.attackCooldown <= 0) {
        const dmg = this.hasWeapon ? 5 : 3;
        this.target.takeDamage(dmg, this);
        this.attackCooldown = ATTACK_COOLDOWN + 0.2; // slightly slower than player
      }
      this.velocity.x *= 0.3;
      this.velocity.z *= 0.3;
    }
  }

  _defendBed(dt) {
    const bedPos = this.team === TEAM_RED ? this.world.redBedPos : this.world.blueBedPos;
    if (!bedPos) { this.state = 'idle'; return; }

    // Patrol OUTSIDE the wool defense ring (radius ~5 from bed center)
    const spawn = this.team === TEAM_RED ? this.world.redSpawnPos : this.world.blueSpawnPos;
    const patrolCenter = new THREE.Vector3(bedPos.x, spawn.y, bedPos.z);
    const dist = this.position.distanceTo(patrolCenter);

    if (dist > 10) {
      // Too far, move back toward the island
      this._moveToward(new THREE.Vector3(spawn.x, spawn.y, spawn.z), dt);
    } else {
      // Patrol in a circle OUTSIDE the wool defense (radius 5-6 blocks from bed)
      const time = performance.now() * 0.001;
      const angle = time * 0.5 + this.name.charCodeAt(this.name.length - 1) * 2;
      const patrolX = bedPos.x + Math.sin(angle) * 6;
      const patrolZ = bedPos.z + Math.cos(angle) * 6;
      this._moveToward(new THREE.Vector3(patrolX, this.position.y, patrolZ), dt);
    }

    // Attack nearby enemies
    const enemy = this._findNearestEnemy();
    if (enemy && this.distanceTo(enemy) < 8) {
      this.state = 'attack';
      this.target = enemy;
    }
  }

  _attackEnemyBase(dt) {
    // Move toward enemy base using pre-built bridges
    const enemyBed = this.team === TEAM_RED ? this.world.blueBedPos : this.world.redBedPos;
    if (!enemyBed) { this.state = 'idle'; return; }

    const enemyBedVec = new THREE.Vector3(enemyBed.x, enemyBed.y, enemyBed.z);
    const dist = this.position.distanceTo(enemyBedVec);

    // Attack nearby enemies first
    const enemy = this._findNearestEnemy();
    if (enemy && this.distanceTo(enemy) < 6) {
      this.state = 'attack';
      this.target = enemy;
      return;
    }

    // Pick a bridge path if we haven't yet, or if we're near base
    if (!this._bridgeZ && this.world.bridgeZPositions) {
      const bridges = this.world.bridgeZPositions;
      this._bridgeZ = bridges[Math.floor(Math.random() * bridges.length)];
    }

    if (dist > 3) {
      // Navigate via bridge: first move to the bridge Z, then along X toward enemy
      const onBridge = this._bridgeZ && Math.abs(this.position.z - this._bridgeZ) < 2;
      let target;
      if (onBridge || Math.abs(this.position.x - enemyBed.x) < 20) {
        // On bridge or near enemy island: head straight for bed
        target = enemyBedVec;
      } else {
        // Move to bridge entry first
        target = new THREE.Vector3(this.position.x, this.position.y, this._bridgeZ);
      }
      this._moveToward(target, dt);
    } else {
      // Attack the bed
      const bedBlock = this.team === TEAM_RED ? BLOCK.BED_BLUE : BLOCK.BED_RED;
      if (this.world.getBlock(enemyBed.x, enemyBed.y, enemyBed.z) === bedBlock) {
        if (this.attackCooldown <= 0) {
          this.world.damageBlock(enemyBed.x, enemyBed.y, enemyBed.z, 1);
          this.attackCooldown = 0.5;
        }
      }
    }
  }

  _idle(dt) {
    this.velocity.x *= 0.5;
    this.velocity.z *= 0.5;
  }

  _moveToward(target, dt, speedMult = 1) {
    const dir = new THREE.Vector3().subVectors(target, this.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist < 0.5) return;

    dir.normalize();
    const speed = WALK_SPEED * 0.8 * speedMult;
    this.velocity.x = dir.x * speed;
    this.velocity.z = dir.z * speed;
    this._faceTarget(target);

    // Jump over obstacles — check 1-2 blocks ahead in movement direction
    const lookY = Math.floor(this.position.y);
    let shouldJump = false;

    for (let ahead = 1; ahead <= 2; ahead++) {
      const lx = Math.floor(this.position.x + dir.x * ahead);
      const lz = Math.floor(this.position.z + dir.z * ahead);
      if (this.world.isSolid(lx, lookY, lz) || this.world.isSolid(lx, lookY + 1, lz)) {
        shouldJump = true;
        break;
      }
    }
    // Also check diagonal (for corner collisions)
    if (!shouldJump && Math.abs(dir.x) > 0.1 && Math.abs(dir.z) > 0.1) {
      const dx = Math.floor(this.position.x + dir.x);
      const dz = Math.floor(this.position.z + dir.z);
      if (this.world.isSolid(dx, lookY, dz)) shouldJump = true;
    }

    if (shouldJump && this.onGround && this.jumpTimer <= 0) {
      this.velocity.y = 8;
      this.onGround = false;
      this.jumpTimer = 0.3;
    }

    // === PROACTIVE BRIDGING ===
    // Only bridge when heading over actual void (no ground within a few blocks below)
    if (this.blockCount > 0) {
      const woolType = this.team === TEAM_RED ? BLOCK.WOOL_RED : BLOCK.WOOL_BLUE;
      const footY = Math.floor(this.position.y) - 1;

      // Check 1-2 blocks ahead: only bridge if there's no solid block beneath
      for (let ahead = 1; ahead <= 2; ahead++) {
        const ax = Math.floor(this.position.x + dir.x * ahead);
        const az = Math.floor(this.position.z + dir.z * ahead);
        // Check if there's any ground within 3 blocks below footY
        let hasGround = false;
        for (let dy = 0; dy >= -3; dy--) {
          if (this.world.isSolid(ax, footY + dy, az)) { hasGround = true; break; }
        }
        if (!hasGround && footY > 0) {
          // True void ahead - place bridge
          this.world.setBlock(ax, footY, az, woolType); this.blockCount--;
          if (this.blockCount <= 0) break;
          // Widen perpendicular to movement
          if (Math.abs(dir.x) > Math.abs(dir.z)) {
            if (!this.world.isSolid(ax, footY, az-1)) { this.world.setBlock(ax, footY, az-1, woolType); this.blockCount--; }
            if (this.blockCount > 0 && !this.world.isSolid(ax, footY, az+1)) { this.world.setBlock(ax, footY, az+1, woolType); this.blockCount--; }
          } else {
            if (!this.world.isSolid(ax-1, footY, az)) { this.world.setBlock(ax-1, footY, az, woolType); this.blockCount--; }
            if (this.blockCount > 0 && !this.world.isSolid(ax+1, footY, az)) { this.world.setBlock(ax+1, footY, az, woolType); this.blockCount--; }
          }
        }
        if (this.blockCount <= 0) break;
      }

      // Also place below feet if currently falling over void (emergency catch)
      if (!this.onGround && this.velocity.y < 0) {
        const bx = Math.floor(this.position.x);
        const by = Math.floor(this.position.y) - 1;
        const bz = Math.floor(this.position.z);
        let hasGroundBelow = false;
        for (let dy = 0; dy >= -3; dy--) {
          if (this.world.isSolid(bx, by + dy, bz)) { hasGroundBelow = true; break; }
        }
        if (!hasGroundBelow && by > 0 && this.blockCount > 0) {
          this.world.setBlock(bx, by, bz, woolType); this.blockCount--;
        }
      }
    }
  }

  _faceTarget(target) {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    this.yaw = Math.atan2(-dx, -dz);
  }

  _findNearestEnemy() {
    let nearest = null;
    let minDist = Infinity;

    const entities = this.game.getAllEntities();
    for (const e of entities) {
      if (!e.alive || e.team === this.team || e === this) continue;
      const d = this.distanceTo(e);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    }

    // Also check player
    const player = this.game.player;
    if (player.alive && player.team !== this.team) {
      const d = this.distanceTo(player);
      if (d < minDist) {
        nearest = player;
      }
    }

    return nearest;
  }

  die() {
    super.die();

    const bedAlive = this.team === TEAM_RED ? this.world.redBedAlive : this.world.blueBedAlive;
    if (bedAlive) {
      this.respawnTimer = 5;
    } else {
      this.eliminated = true;
      this.game.checkWinCondition();
    }
  }

  respawn() {
    this.alive = true;
    this.hp = this.maxHp;
    this.invincibleTimer = 2;

    const spawn = this.team === TEAM_RED ? this.world.redSpawnPos : this.world.blueSpawnPos;
    // Spawn near the spawn point but only in the safe zone (away from bed wool defense)
    this.position.set(
      spawn.x + (Math.random() - 0.5) * 4,
      spawn.y,
      spawn.z + Math.random() * 2
    );
    this.velocity.set(0, 0, 0);
  }
}

// ==================== ENEMY AI ====================
export class EnemyAI extends NPCEntity {
  constructor(game, position, team, name) {
    super(game, position, team, name);
    this.phase = 'early'; // early, mid, late
    this.phaseTimer = 0;
    this.buyTimer = 3 + Math.random() * 3;
    this.attackDecisionTimer = 0;
  }

  _think() {
    const gameTime = this.game.gameTime;

    // Phase transitions — faster escalation
    if (gameTime < 60) {
      this.phase = 'early';
    } else if (gameTime < 180) {
      this.phase = 'mid';
    } else {
      this.phase = 'late';
    }

    // Find nearby enemies (= player and their teammates)
    const nearestEnemy = this._findNearestEnemy();
    if (nearestEnemy && this.distanceTo(nearestEnemy) < AI_SIGHT_RANGE) {
      this.state = 'attack';
      this.target = nearestEnemy;
      return;
    }

    // Phase-based behavior — more aggressive
    switch (this.phase) {
      case 'early':
        // One enemy starts attacking early if they have a weapon and blocks
        if (this.hasWeapon && this.blockCount >= 16 && this.name.includes('1')) {
          this.state = 'attack_base';
        } else {
          this.state = 'gather';
        }
        break;
      case 'mid':
        // Half go attack, half gather
        if (this.name.includes('1') || this.name.includes('2')) {
          this.state = 'attack_base';
        } else {
          this.state = this.blockCount >= 16 ? 'attack_base' : 'gather';
        }
        break;
      case 'late':
        // All-out attack
        this.state = 'attack_base';
        break;
    }
  }

  _gatherResources(dt) {
    // Stay near spawner and collect resources
    const spawnerPos = this.team === TEAM_RED ? this.world.redSpawnerPos : this.world.blueSpawnerPos;
    if (!spawnerPos) return;

    const spawnerVec = new THREE.Vector3(spawnerPos.x, spawnerPos.y, spawnerPos.z);
    const dist2D = Math.sqrt(
      (this.position.x - spawnerVec.x) ** 2 +
      (this.position.z - spawnerVec.z) ** 2
    );

    if (dist2D > 2) {
      // Move toward spawner (ignore Y difference to avoid getting confused by elevation)
      this._moveToward(spawnerVec, dt);
    } else {
      // Close enough - wander around the spawner to pick up drops
      if (!this.wanderTarget || this.position.distanceTo(this.wanderTarget) < 1 || Math.random() < 0.02) {
        this.wanderTarget = new THREE.Vector3(
          spawnerVec.x + (Math.random() - 0.5) * 4,
          this.position.y,
          spawnerVec.z + (Math.random() - 0.5) * 4
        );
      }
      this._moveToward(this.wanderTarget, dt, 0.5);
    }
    // Note: buyTimer is already decremented in parent NPCEntity.update()
  }

}

// ==================== ZOMBIE ====================
export class ZombieEntity extends Entity {
  constructor(game, position) {
    super(game, position, null);
    this.hp = ZOMBIE_HP;
    this.maxHp = ZOMBIE_HP;
    this.damage = ZOMBIE_DAMAGE;
    this.respawnTimer = 0;
    this.spawnPos = position.clone();
    this.target = null;
    this.thinkTimer = 0;
    this.wanderAngle = Math.random() * Math.PI * 2;

    this.groanTimer = 3 + Math.random() * 5;
    this.createMesh(0x3a5a3a, 0x4a6a4a, true); // monster flag = true
  }

  update(dt) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.thinkTimer -= dt;
    this.velocity.y -= GRAVITY * dt;

    // Zombie groan sounds
    this.groanTimer -= dt;
    if (this.groanTimer <= 0) {
      this.groanTimer = 5 + Math.random() * 8;
      // Only play if player is within earshot
      const playerDist = this.game.player.alive ? this.distanceTo(this.game.player) : 999;
      if (playerDist < 20) {
        this.game.audio.playZombieGroan();
      }
    }

    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.5;
      this._findTarget();
    }

    if (this.target && this.target.alive) {
      const dist = this.distanceTo(this.target);
      if (dist > ZOMBIE_SIGHT_RANGE) {
        this.target = null;
      } else if (dist > 2) {
        this._moveToward(this.target.position, dt);
      } else {
        if (this.attackCooldown <= 0) {
          this.target.takeDamage(this.damage, this);
          this.attackCooldown = 1.0;
          this.game.audio.playHit();
        }
        this.velocity.x *= 0.3;
        this.velocity.z *= 0.3;
      }
    } else {
      // Wander
      this.wanderAngle += (Math.random() - 0.5) * 0.5;
      const speed = 1.5;
      this.velocity.x = Math.sin(this.wanderAngle) * speed;
      this.velocity.z = Math.cos(this.wanderAngle) * speed;

      // Stay near spawn
      const distToSpawn = this.position.distanceTo(this.spawnPos);
      if (distToSpawn > 8) {
        const dir = new THREE.Vector3().subVectors(this.spawnPos, this.position).normalize();
        this.velocity.x = dir.x * speed;
        this.velocity.z = dir.z * speed;
      }
    }

    this.moveWithCollision(dt);
    this.yaw = Math.atan2(-this.velocity.x, -this.velocity.z);

    if (this.position.y < -5) {
      this.die();
    }

    this.updateMesh();
  }

  _moveToward(target, dt) {
    const dir = new THREE.Vector3().subVectors(target, this.position);
    dir.y = 0;
    dir.normalize();
    const speed = 3;
    this.velocity.x = dir.x * speed;
    this.velocity.z = dir.z * speed;

    // Jump over obstacles — check 1-2 blocks ahead
    const lookY = Math.floor(this.position.y);
    let blocked = false;
    for (let ahead = 1; ahead <= 2; ahead++) {
      const lx = Math.floor(this.position.x + dir.x * ahead);
      const lz = Math.floor(this.position.z + dir.z * ahead);
      if (this.world.isSolid(lx, lookY, lz) || this.world.isSolid(lx, lookY + 1, lz)) {
        blocked = true;
        break;
      }
    }
    if (blocked && this.onGround) {
      this.velocity.y = 7;
      this.onGround = false;
    }
  }

  _findTarget() {
    let nearest = null;
    let minDist = Infinity;

    // Check player
    const player = this.game.player;
    if (player.alive) {
      const d = this.distanceTo(player);
      if (d < ZOMBIE_SIGHT_RANGE && d < minDist) {
        minDist = d;
        nearest = player;
      }
    }

    // Check all NPCs
    for (const e of this.game.getAllNPCs()) {
      if (!e.alive) continue;
      const d = this.distanceTo(e);
      if (d < ZOMBIE_SIGHT_RANGE && d < minDist) {
        minDist = d;
        nearest = e;
      }
    }

    this.target = nearest;
  }

  die() {
    super.die();
    this.respawnTimer = ZOMBIE_RESPAWN_TIME;

    // Drop loot
    const drops = [];
    drops.push({ type: 'iron', amount: 1 + Math.floor(Math.random() * 2) });
    if (Math.random() < 0.2) {
      drops.push({ type: 'diamond', amount: 1 });
    }
    this.game.spawnCurrencyDrops(this.position.clone(), drops);
  }

  respawn() {
    this.alive = true;
    this.hp = this.maxHp;
    this.position.copy(this.spawnPos);
    this.velocity.set(0, 0, 0);
    this.target = null;
  }
}

// ==================== MERCHANT NPC (non-combat) ====================
export class MerchantEntity extends Entity {
  constructor(game, position, team) {
    super(game, position, team);
    this.createMesh(0xdaa520, 0xffcc99);
    this.interactable = true;
  }

  update(dt) {
    // Merchants just stand there and slowly rotate
    const time = performance.now() * 0.0005;
    this.yaw = Math.sin(time) * 0.3;
    this.updateMesh();
  }
}

// ==================== DROPPED ITEM ====================
export class DroppedItem {
  constructor(game, position, itemData, currency = null) {
    this.game = game;
    this.position = position.clone();
    this.position.y += 0.5;
    this.items = itemData; // array of {item, count}
    this.currency = currency || { copper: 0, iron: 0, diamond: 0, gold: 0 };
    this.timer = 60; // despawn timer
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 3,
      5,
      (Math.random() - 0.5) * 3
    );
    this.onGround = false;

    // Visual - floating spinning item
    const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffff00, emissive: 0x444400 });
    this.mesh = new THREE.Mesh(geo, mat);
    game.scene.add(this.mesh);
  }

  update(dt) {
    this.timer -= dt;

    // Physics
    if (!this.onGround) {
      this.velocity.y -= GRAVITY * dt;
      this.position.add(this.velocity.clone().multiplyScalar(dt));

      // Ground collision
      const by = Math.floor(this.position.y - 0.15);
      if (this.game.world.isSolid(Math.floor(this.position.x), by, Math.floor(this.position.z))) {
        this.position.y = by + 1.15;
        this.onGround = true;
        this.velocity.set(0, 0, 0);
      }
    }

    // Void
    if (this.position.y < -10) {
      this.timer = -1;
    }

    // Bobbing animation
    const bob = Math.sin(performance.now() * 0.003) * 0.1;
    this.mesh.position.set(this.position.x, this.position.y + bob, this.position.z);
    this.mesh.rotation.y += dt * 2;

    // Blink when about to despawn
    if (this.timer < 10) {
      this.mesh.visible = Math.sin(performance.now() * 0.01) > 0;
    }

    return this.timer > 0;
  }

  pickup(entity) {
    // Give items
    if (entity === this.game.player) {
      for (const drop of this.items) {
        this.game.player.addItem(drop.item, drop.count);
      }
      for (const [key, amount] of Object.entries(this.currency)) {
        if (amount > 0) {
          this.game.player.currency[key] += amount;
        }
      }
    }
  }

  dispose() {
    this.game.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// ==================== CURRENCY DROP ====================
export class CurrencyDrop {
  constructor(game, position, type, amount) {
    this.game = game;
    this.position = position.clone();
    this.type = type; // 'copper', 'iron', 'diamond', 'gold'
    this.amount = amount;
    this.timer = 30;
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      3,
      (Math.random() - 0.5) * 2
    );
    this.onGround = false;

    const colors = { copper: 0xcd7f32, iron: 0xcccccc, diamond: 0x44ffee, gold: 0xffd700 };
    const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const mat = new THREE.MeshLambertMaterial({
      color: colors[type] || 0xffffff,
      emissive: (colors[type] || 0xffffff) & 0x333333,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    game.scene.add(this.mesh);
  }

  update(dt) {
    this.timer -= dt;

    if (!this.onGround) {
      this.velocity.y -= GRAVITY * dt;
      this.position.add(this.velocity.clone().multiplyScalar(dt));

      const by = Math.floor(this.position.y - 0.1);
      if (this.game.world.isSolid(Math.floor(this.position.x), by, Math.floor(this.position.z))) {
        this.position.y = by + 1.1;
        this.onGround = true;
        this.velocity.set(0, 0, 0);
      }
    }

    if (this.position.y < -10) this.timer = -1;

    const bob = Math.sin(performance.now() * 0.004 + this.position.x) * 0.08;
    this.mesh.position.set(this.position.x, this.position.y + bob, this.position.z);
    this.mesh.rotation.y += dt * 3;

    return this.timer > 0;
  }

  dispose() {
    this.game.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// ==================== ARROW PROJECTILE ====================
export class ArrowProjectile {
  constructor(game, position, direction, shooter) {
    this.game = game;
    this.position = position.clone();
    this.direction = direction.clone().normalize();
    this.velocity = this.direction.clone().multiplyScalar(30);
    this.velocity.y += 2; // slight arc
    this.shooter = shooter;
    this.timer = 3;
    this.damage = 5;

    const geo = new THREE.CylinderGeometry(0.05, 0.05, 0.6);
    const mat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = Math.PI / 2;
    game.scene.add(this.mesh);
  }

  update(dt) {
    this.timer -= dt;
    this.velocity.y -= GRAVITY * dt;

    const oldPos = this.position.clone();
    this.position.add(this.velocity.clone().multiplyScalar(dt));

    // Check block collision
    const block = this.game.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y),
      Math.floor(this.position.z)
    );
    if (block !== BLOCK.AIR) {
      this.timer = -1;
      return false;
    }

    // Check entity collision
    const entities = [...this.game.getAllEntities()];
    if (this.shooter !== this.game.player) {
      entities.push(this.game.player);
    }
    for (const e of entities) {
      if (!e.alive || e === this.shooter) continue;
      if (e.team === this.shooter.team) continue;
      if (this.position.distanceTo(e.position) < 1.5) {
        e.takeDamage(this.damage, this.shooter);
        this.timer = -1;
        return false;
      }
    }

    // Update visual
    this.mesh.position.copy(this.position);
    this.mesh.lookAt(this.position.clone().add(this.velocity));

    return this.timer > 0;
  }

  dispose() {
    this.game.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
