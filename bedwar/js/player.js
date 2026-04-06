import * as THREE from 'three';
import { GRAVITY, JUMP_VELOCITY, WALK_SPEED, RUN_SPEED, PLAYER_HEIGHT, PLAYER_WIDTH,
         PLAYER_EYE_HEIGHT, ATTACK_RANGE, ATTACK_COOLDOWN, KNOCKBACK_FORCE, BLOCK,
         TEAM_RED, ITEMS } from './constants.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.world = game.world;

    // Position and physics
    this.position = new THREE.Vector3(15, 20, 28);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.onGround = false;

    // Camera
    this.camera = game.camera;
    this.yaw = 0;
    this.pitch = 0;

    // Stats
    this.hp = 20;
    this.maxHp = 20;
    this.hunger = 20;
    this.maxHunger = 20;
    this.armor = 0;
    this.team = TEAM_RED;
    this.alive = true;
    this.eliminated = false;
    this.respawnTimer = 0;
    this.invincibleTimer = 0;

    // Combat
    this.attackCooldown = 0;
    this.isBreaking = false;
    this.breakTarget = null;
    this.breakProgress = 0;
    this.swingTimer = 0; // attack animation timer

    // Inventory: 20 slots (5 hotbar + 15 bag)
    this.inventory = new Array(20).fill(null);
    this.selectedSlot = 0;

    // Currency
    this.currency = { copper: 0, iron: 0, diamond: 0, gold: 0 };

    // Active effects
    this.effects = {};

    // Input state
    this.keys = {};
    this.mouseButtons = { left: false, right: false };
    this.mouseDelta = { x: 0, y: 0 };
    this.pointerLocked = false;
    this.canvasActive = false; // whether canvas has focus for actions
    this._closingUI = false;  // flag to suppress pause overlay when closing UI

    // Mouse drag tracking (fallback when pointer lock unavailable)
    this._lastMouseX = 0;
    this._lastMouseY = 0;
    this._mouseDragging = false;

    // Hunger consumption tracking
    this.hungerTimer = 0;
    this.regenTimer = 0;
    this.starveTimer = 0;

    // Block placement cooldown
    this.placeCooldown = 0;

    this._initInput();
  }

  _initInput() {
    const canvas = this.game.renderer.domElement;

    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code >= 'Digit1' && e.code <= 'Digit5') {
        this.selectedSlot = parseInt(e.key) - 1;
      }
      if (e.code === 'KeyE' && this.alive) {
        e.preventDefault();
        this.game.toggleInventory();
      }
      if (e.code === 'KeyF' && this.alive) {
        e.preventDefault();
        this.game.handleFKey();
      }
      if (e.code === 'Escape') {
        this.game.handleEscape();
      }
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // === MOUSE MOVEMENT (pointer lock mode) ===
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        // Pointer lock: use movementX/Y directly
        this.mouseDelta.x += e.movementX;
        this.mouseDelta.y += e.movementY;
      } else if (this._mouseDragging && this.game.running) {
        // Fallback drag mode: track delta from last position
        const dx = e.clientX - this._lastMouseX;
        const dy = e.clientY - this._lastMouseY;
        this.mouseDelta.x += dx;
        this.mouseDelta.y += dy;
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
      }
    });

    // === TRACKPAD / WHEEL ===
    document.addEventListener('wheel', (e) => {
      if (!this.game.running || this.game.isAnyUIOpen()) return;

      // Use deltaX for horizontal camera, deltaY depends on context
      if (Math.abs(e.deltaX) > 1 || (e.ctrlKey && Math.abs(e.deltaY) > 1)) {
        // Trackpad two-finger pan or pinch
        this.mouseDelta.x += e.deltaX * 0.5;
        this.mouseDelta.y += e.deltaY * 0.5;
        e.preventDefault();
      } else if (Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY)) {
        // Discrete mouse wheel: switch hotbar
        if (e.deltaY > 0) this.selectedSlot = (this.selectedSlot + 1) % 5;
        else this.selectedSlot = (this.selectedSlot + 4) % 5;
      } else {
        // Smooth trackpad vertical scroll: use for camera pitch
        this.mouseDelta.y += e.deltaY * 0.5;
        e.preventDefault();
      }
    }, { passive: false });

    // === MOUSE BUTTONS ===
    document.addEventListener('mousedown', (e) => {
      if (!this.game.running || this.game.isAnyUIOpen()) return;

      // Re-acquire pointer lock whenever it's lost and user clicks the canvas
      if (!this.pointerLocked && e.target === canvas) {
        try { canvas.requestPointerLock(); } catch(err) {}
        this.canvasActive = true;
      }

      // Right-click drag for camera rotation (fallback)
      if (e.button === 2) {
        this._mouseDragging = true;
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
      }

      // Actions work regardless of pointer lock
      if (e.button === 0) {
        this.mouseButtons.left = true;
      }
      if (e.button === 2) {
        this.mouseButtons.right = true;
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseButtons.left = false;
      if (e.button === 2) {
        this.mouseButtons.right = false;
        this._mouseDragging = false;
      }
      this.isBreaking = false;
      this.breakTarget = null;
      this.breakProgress = 0;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      if (this.pointerLocked) {
        this.canvasActive = true;
        // Hide click-to-start if it was shown as a resume prompt
        const cts = document.getElementById('click-to-start');
        if (cts) cts.style.display = 'none';
      } else if (this.game.running && this.game.phase !== 'over'
                 && !this.game.isAnyUIOpen() && !this._closingUI) {
        // Pointer lock was lost during gameplay (e.g. user pressed ESC with no UI open)
        // Show a "click to resume" prompt
        const cts = document.getElementById('click-to-start');
        if (cts) {
          cts.style.display = 'flex';
          cts.querySelector('div:first-child').textContent = '点击屏幕继续';
          cts.querySelector('.hint').textContent = '按 ESC 可暂停并释放鼠标';
        }
      }
    });

    // Track when user clicks away from canvas
    document.addEventListener('mousedown', (e) => {
      if (e.target !== canvas) {
        this.canvasActive = false;
      }
    }, true);
  }

  requestPointerLock() {
    try { this.game.renderer.domElement.requestPointerLock(); } catch(e) {}
  }

  getSelectedItem() {
    return this.inventory[this.selectedSlot];
  }

  addItem(itemDef, count = 1) {
    if (itemDef.stackable) {
      for (let i = 0; i < this.inventory.length; i++) {
        const slot = this.inventory[i];
        if (slot && slot.item.id === itemDef.id && slot.count < (itemDef.maxStack || 64)) {
          const canAdd = Math.min(count, (itemDef.maxStack || 64) - slot.count);
          slot.count += canAdd;
          count -= canAdd;
          if (count <= 0) return true;
        }
      }
    }
    while (count > 0) {
      const emptySlot = this.inventory.findIndex(s => s === null);
      if (emptySlot === -1) return false;
      const stackSize = itemDef.stackable ? Math.min(count, itemDef.maxStack || 64) : 1;
      this.inventory[emptySlot] = { item: itemDef, count: stackSize };
      count -= stackSize;
    }
    return true;
  }

  removeFromSlot(slot, count = 1) {
    if (!this.inventory[slot]) return;
    this.inventory[slot].count -= count;
    if (this.inventory[slot].count <= 0) this.inventory[slot] = null;
  }

  hasItem(itemId) {
    return this.inventory.some(s => s && s.item.id === itemId);
  }

  countItem(itemId) {
    let total = 0;
    for (const slot of this.inventory) {
      if (slot && slot.item.id === itemId) total += slot.count;
    }
    return total;
  }

  removeItem(itemId, count = 1) {
    for (let i = 0; i < this.inventory.length && count > 0; i++) {
      if (this.inventory[i] && this.inventory[i].item.id === itemId) {
        const remove = Math.min(count, this.inventory[i].count);
        this.inventory[i].count -= remove;
        count -= remove;
        if (this.inventory[i].count <= 0) this.inventory[i] = null;
      }
    }
  }

  getDrops() {
    const drops = [];
    for (let i = 0; i < this.inventory.length; i++) {
      if (this.inventory[i]) {
        drops.push({ ...this.inventory[i] });
        this.inventory[i] = null;
      }
    }
    return drops;
  }

  updateArmor() {
    this.armor = 0;
    for (const slot of this.inventory) {
      if (slot && slot.item.type === 'armor') {
        this.armor = Math.max(this.armor, slot.item.armor || 0);
      }
    }
  }

  takeDamage(amount, attacker = null) {
    if (this.invincibleTimer > 0) return;
    if (!this.alive) return;

    const reduction = this.armor * 0.04;
    amount = Math.max(1, Math.floor(amount * (1 - reduction)));
    this.hp -= amount;

    // Hit flash
    this.game.audio.playHit();

    if (attacker) {
      const dir = new THREE.Vector3().subVectors(this.position, attacker.position || attacker).normalize();
      this.velocity.x += dir.x * KNOCKBACK_FORCE;
      this.velocity.y += KNOCKBACK_FORCE * 0.5;
      this.velocity.z += dir.z * KNOCKBACK_FORCE;
    }

    if (this.hp <= 0) this.die();
  }

  die() {
    this.hp = 0;
    this.alive = false;
    const drops = this.getDrops();
    if (this.position.y > 0) {
      this.game.spawnDroppedItems(this.position.clone(), drops, this.currency);
    }
    this.currency = { copper: 0, iron: 0, diamond: 0, gold: 0 };

    if (this.team === TEAM_RED && this.world.redBedAlive) {
      this.respawnTimer = 5;
    } else if (this.team !== TEAM_RED && this.world.blueBedAlive) {
      this.respawnTimer = 5;
    } else {
      this.eliminated = true;
      this.game.onPlayerEliminated(this);
    }
  }

  respawn() {
    this.alive = true;
    this.hp = this.maxHp;
    this.hunger = this.maxHunger;
    this.invincibleTimer = 2;
    const spawn = this.team === TEAM_RED ? this.world.redSpawnPos : this.world.blueSpawnPos;
    this.position.set(spawn.x, spawn.y, spawn.z);
    this.velocity.set(0, 0, 0);
  }

  update(dt) {
    if (!this.alive) {
      if (this.respawnTimer > 0) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) this.respawn();
      }
      return;
    }

    for (const key in this.effects) {
      this.effects[key] -= dt;
      if (this.effects[key] <= 0) delete this.effects[key];
    }

    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.placeCooldown > 0) this.placeCooldown -= dt;
    if (this.swingTimer > 0) this.swingTimer -= dt;

    // Camera rotation from mouse delta
    const sensitivity = 0.002;
    this.yaw -= this.mouseDelta.x * sensitivity;
    this.pitch -= this.mouseDelta.y * sensitivity;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;

    // Movement
    const isRunning = this.keys['ShiftLeft'] && this.hunger > 6;
    let speed = isRunning ? RUN_SPEED : WALK_SPEED;
    if (this.effects.speed) speed *= 1.5;

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3(0, 0, 0);
    if (this.keys['KeyW']) moveDir.add(forward);
    if (this.keys['KeyS']) moveDir.sub(forward);
    if (this.keys['KeyA']) moveDir.sub(right);
    if (this.keys['KeyD']) moveDir.add(right);

    if (moveDir.length() > 0) moveDir.normalize().multiplyScalar(speed);

    this.velocity.x = moveDir.x;
    this.velocity.z = moveDir.z;

    let jumpVel = JUMP_VELOCITY;
    if (this.effects.jump) jumpVel *= 2;
    if (this.keys['Space'] && this.onGround) {
      this.velocity.y = jumpVel;
      this.onGround = false;
    }

    this.velocity.y -= GRAVITY * dt;
    this.velocity.y = Math.max(this.velocity.y, -15);

    const maxStep = 0.02;
    let remaining = dt;
    while (remaining > 0) {
      const step = Math.min(remaining, maxStep);
      this._moveWithCollision(step);
      remaining -= step;
    }

    if (this.position.y < -5) { this.die(); return; }

    this.camera.position.set(this.position.x, this.position.y + PLAYER_EYE_HEIGHT, this.position.z);
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    this._updateHunger(dt, isRunning);
    this._updateRegen(dt);

    // Actions work regardless of pointer lock when canvas is active
    if (this.mouseButtons.left && (this.pointerLocked || this.canvasActive)) {
      this._handleLeftClick(dt);
    }
    if (this.mouseButtons.right && (this.pointerLocked || this.canvasActive)) {
      this._handleRightClick(dt);
    }

    this.updateArmor();
  }

  _moveWithCollision(dt) {
    const hw = PLAYER_WIDTH / 2;
    const h = PLAYER_HEIGHT;

    this.position.x += this.velocity.x * dt;
    if (this._checkCollision(hw, h)) {
      this.position.x -= this.velocity.x * dt;
      this.velocity.x = 0;
    }

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

  _updateHunger(dt, isRunning) {
    let consumeRate = 0;
    if (isRunning) consumeRate = 0.1;
    if (this.keys['Space']) consumeRate += 0.03;
    if (consumeRate > 0) this.hunger = Math.max(0, this.hunger - consumeRate * dt);
  }

  _updateRegen(dt) {
    if (this.hunger >= 18 && this.hp < this.maxHp) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3) { this.regenTimer = 0; this.hp = Math.min(this.maxHp, this.hp + 1); }
    }
    if (this.hunger <= 0 && this.hp > 1) {
      this.starveTimer += dt;
      if (this.starveTimer >= 3) { this.starveTimer = 0; this.hp = Math.max(1, this.hp - 1); }
    }
  }

  _handleLeftClick(dt) {
    if (this.attackCooldown <= 0) {
      const attacked = this.game.tryAttackEntity(this);
      if (attacked) {
        this.attackCooldown = ATTACK_COOLDOWN;
        this.swingTimer = 0.3;
        this.hunger = Math.max(0, this.hunger - 0.05);
        this.game.audio.playSwing();
        return;
      }
    }

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const ray = this.world.raycast(this.camera.position, dir, ATTACK_RANGE);

    if (ray.hit) {
      const key = `${ray.x},${ray.y},${ray.z}`;
      if (!this.breakTarget || this.breakTarget !== key) {
        this.breakTarget = key;
        this.breakProgress = 0;
      }
      this.breakProgress += dt * 3;

      if (this.breakProgress >= 0.3) {
        this.breakProgress = 0;
        const destroyed = this.world.damageBlock(ray.x, ray.y, ray.z, 1);
        this.game.audio.playBreak();
        if (destroyed) {
          this.game.spawnBlockParticles(ray.x + 0.5, ray.y + 0.5, ray.z + 0.5, ray.block);
        }
      }
    }
  }

  _handleRightClick(dt) {
    if (this.placeCooldown > 0) return;
    const selected = this.getSelectedItem();
    if (!selected) return;
    const item = selected.item;

    if (item.type === 'block') {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const ray = this.world.raycast(this.camera.position, dir, 6);

      let px, py, pz;
      if (ray.hit) {
        px = ray.x + ray.nx;
        py = ray.y + ray.ny;
        pz = ray.z + ray.nz;
      } else {
        // No block hit — place below/in-front of feet (for bridging over void)
        const footX = Math.floor(this.position.x);
        const footY = Math.floor(this.position.y) - 1;
        const footZ = Math.floor(this.position.z);

        if (this.world.getBlock(footX, footY, footZ) === BLOCK.AIR) {
          // Place directly below feet
          px = footX; py = footY; pz = footZ;
        } else {
          // Place one block ahead at foot level
          const aheadX = Math.floor(this.position.x + dir.x * 1.5);
          const aheadZ = Math.floor(this.position.z + dir.z * 1.5);
          const aheadY = Math.floor(this.position.y) - 1;
          if (this.world.getBlock(aheadX, aheadY, aheadZ) === BLOCK.AIR) {
            px = aheadX; py = aheadY; pz = aheadZ;
          } else {
            return; // nowhere to place
          }
        }
      }

      // Don't place inside player
      const hw = PLAYER_WIDTH / 2;
      const playerOverlap =
        this.position.x + hw > px && this.position.x - hw < px + 1 &&
        this.position.y + PLAYER_HEIGHT > py && this.position.y < py + 1 &&
        this.position.z + hw > pz && this.position.z - hw < pz + 1;

      if (!playerOverlap && this.world.getBlock(px, py, pz) === BLOCK.AIR) {
        let blockType = item.blockType;
        if (blockType === BLOCK.WOOL_WHITE) {
          blockType = this.team === TEAM_RED ? BLOCK.WOOL_RED : BLOCK.WOOL_BLUE;
        }
        this.world.setBlock(px, py, pz, blockType);
        this.removeFromSlot(this.selectedSlot, 1);
        this.placeCooldown = 0.12;
        this.game.audio.playPlace();
      }
    } else if (item.type === 'food') {
      if (this.hunger < this.maxHunger || item.healAll) {
        this.hunger = Math.min(this.maxHunger, this.hunger + (item.hunger || 0));
        if (item.healAll) this.hp = this.maxHp;
        if (item.invincible) this.invincibleTimer = item.invincible;
        this.removeFromSlot(this.selectedSlot, 1);
        this.placeCooldown = 0.5;
      }
    } else if (item.type === 'potion') {
      this.effects[item.effect] = item.duration;
      this.removeFromSlot(this.selectedSlot, 1);
      this.placeCooldown = 0.5;
    } else if (item.type === 'bridge_egg') {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      dir.y = 0; dir.normalize();
      this.world.placeTempBridge(
        Math.floor(this.position.x) + dir.x * 2,
        Math.floor(this.position.y) - 1,
        Math.floor(this.position.z) + dir.z * 2,
        dir.x, dir.z
      );
      this.removeFromSlot(this.selectedSlot, 1);
      this.placeCooldown = 1;
    } else if (item.type === 'tnt') {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const ray = this.world.raycast(this.camera.position, dir, 6);
      if (ray.hit) {
        this.game.placeTNT(ray.x + ray.nx, ray.y + ray.ny, ray.z + ray.nz);
        this.removeFromSlot(this.selectedSlot, 1);
        this.placeCooldown = 1;
      }
    } else if (item.type === 'bow') {
      if (this.countItem('arrow') > 0) {
        this.removeItem('arrow', 1);
        this.game.shootArrow(this);
        this.placeCooldown = 0.8;
      }
    }
  }

  getLookDirection() {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
  }
}
