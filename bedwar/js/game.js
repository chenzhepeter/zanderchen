import * as THREE from 'three';
import { VoxelWorld } from './world.js';
import { Player } from './player.js';
import { NPCEntity, EnemyAI, ZombieEntity, MerchantEntity,
         DroppedItem, CurrencyDrop, ArrowProjectile } from './entities.js';
import { HUD } from './hud.js';
import { AudioSystem } from './audio.js';
import { TEAM_RED, TEAM_BLUE, RESOURCE_COPPER_INTERVAL, RESOURCE_IRON_INTERVAL,
         PREP_PHASE_TIME, MAX_GAME_TIME, BLOCK, BLOCK_COLORS, ATTACK_RANGE, ITEMS } from './constants.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x87ceeb); // sky blue

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87ceeb, 80, 150);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x666666);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(50, 80, 30);
    this.scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x554433, 0.4);
    this.scene.add(hemiLight);

    // Void plane (dark plane far below the islands to show the abyss)
    const voidGeo = new THREE.PlaneGeometry(300, 300);
    const voidMat = new THREE.MeshBasicMaterial({
      color: 0x111122,
      transparent: true,
      opacity: 0.8,
    });
    const voidPlane = new THREE.Mesh(voidGeo, voidMat);
    voidPlane.rotation.x = -Math.PI / 2;
    voidPlane.position.set(60, -2, 25);
    this.scene.add(voidPlane);

    // Void fog particles (subtle floating particles below islands)
    const starGeo = new THREE.BufferGeometry();
    const starVertices = [];
    for (let i = 0; i < 200; i++) {
      starVertices.push(
        Math.random() * 200 - 40,
        Math.random() * 10 - 5,
        Math.random() * 100 - 25
      );
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x8888ff, size: 0.3, transparent: true, opacity: 0.4 });
    this.voidParticles = new THREE.Points(starGeo, starMat);
    this.scene.add(this.voidParticles);

    // World
    this.world = new VoxelWorld(this.scene);

    // Player
    this.player = new Player(this);

    // Entities
    this.redTeamNPCs = [];
    this.blueTeamNPCs = [];
    this.zombies = [];
    this.merchants = [];
    this.droppedItems = [];
    this.currencyDrops = [];
    this.projectiles = [];
    this.tntTimers = []; // {x,y,z, timer}

    // Game state
    this.phase = 'prep'; // prep, battle, over
    this.prepTimer = PREP_PHASE_TIME;
    this.gameTime = 0;
    this.running = false;

    // Resource spawning
    this.copperTimer = 0;
    this.ironTimer = 0;
    this.centerResourceTimer = 0;

    // Bed state tracking
    this.lastRedBedState = true;
    this.lastBlueBedState = true;

    // Audio
    this.audio = new AudioSystem();

    // Particles
    this.particles = [];

    // HUD
    this.hud = new HUD(this);

    // Resize handler
    window.addEventListener('resize', () => this._onResize());

    // Block highlight
    this.blockHighlight = this._createBlockHighlight();
    this.scene.add(this.blockHighlight);
  }

  init() {
    // Generate world
    this.world.generateMap();
    this.world.rebuildMesh();

    // Set player position
    const spawn = this.world.redSpawnPos;
    this.player.position.set(spawn.x, spawn.y, spawn.z);
    this.player.team = TEAM_RED;
    // Face toward center island (positive X direction)
    this.player.yaw = -Math.PI / 2;

    // Give player starting items
    this.player.addItem(ITEMS.WOOD_SWORD, 1);

    // Create red team NPCs (3 teammates)
    // Spawn outside wool defense (wool is at cz-1..cz+1, spawn.z = cz+3)
    const redNames = ['队友1', '队友2', '队友3'];
    for (let i = 0; i < 3; i++) {
      const pos = new THREE.Vector3(
        spawn.x + (i - 1) * 2,
        spawn.y,
        spawn.z
      );
      const npc = new NPCEntity(this, pos, TEAM_RED, redNames[i]);
      npc.command = 'follow';
      npc.blockCount = 64; // start with bridge blocks
      this.redTeamNPCs.push(npc);
    }

    // Create blue team NPCs (4 enemies)
    const blueSpawn = this.world.blueSpawnPos;
    const blueNames = ['敌人1', '敌人2', '敌人3', '敌人4'];
    for (let i = 0; i < 4; i++) {
      const pos = new THREE.Vector3(
        blueSpawn.x + (i - 1.5) * 2,
        blueSpawn.y,
        blueSpawn.z
      );
      const enemy = new EnemyAI(this, pos, TEAM_BLUE, blueNames[i]);
      enemy.blockCount = 64;
      this.blueTeamNPCs.push(enemy);
    }

    // Create zombies on center island
    for (const spawnPos of this.world.zombieSpawnPositions) {
      const zombie = new ZombieEntity(this, new THREE.Vector3(spawnPos.x, spawnPos.y, spawnPos.z));
      this.zombies.push(zombie);
    }

    // Create merchants
    if (this.world.redMerchantPos) {
      const rm = new MerchantEntity(this,
        new THREE.Vector3(this.world.redMerchantPos.x, this.world.redMerchantPos.y, this.world.redMerchantPos.z),
        TEAM_RED
      );
      this.merchants.push(rm);
    }
    if (this.world.blueMerchantPos) {
      const bm = new MerchantEntity(this,
        new THREE.Vector3(this.world.blueMerchantPos.x, this.world.blueMerchantPos.y, this.world.blueMerchantPos.z),
        TEAM_BLUE
      );
      this.merchants.push(bm);
    }
  }

  start() {
    this.running = true;
    this.hud.show();
    this._gameLoop();
  }

  _gameLoop() {
    if (!this.running) return;

    const now = performance.now();
    if (!this._lastTime) this._lastTime = now;
    let dt = (now - this._lastTime) / 1000;
    this._lastTime = now;

    // Clamp dt to prevent huge jumps
    dt = Math.min(dt, 0.1);

    try {
      this._update(dt);
      this._render();
    } catch (e) {
      console.error('Game loop error:', e);
      this.running = false;
      return;
    }

    requestAnimationFrame(() => this._gameLoop());
  }

  _update(dt) {
    if (this.phase === 'over') return;

    // Phase management
    if (this.phase === 'prep') {
      this.prepTimer -= dt;
      if (this.prepTimer <= 0) {
        this.phase = 'battle';
        this.hud.showNotification('战斗开始!', 3);
      }
    }

    if (this.phase === 'battle') {
      this.gameTime += dt;

      // Check time limit
      if (this.gameTime >= MAX_GAME_TIME) {
        // Destroy all beds
        this.world.redBedAlive = false;
        this.world.blueBedAlive = false;
        this.hud.showNotification('⏰ 时间到! 所有床被摧毁 - 绝杀模式!', 5);
        // Remove bed blocks
        if (this.world.redBedPos) {
          this.world.setBlock(this.world.redBedPos.x, this.world.redBedPos.y, this.world.redBedPos.z, BLOCK.AIR);
          this.world.setBlock(this.world.redBedPos.x + 1, this.world.redBedPos.y, this.world.redBedPos.z, BLOCK.AIR);
        }
        if (this.world.blueBedPos) {
          this.world.setBlock(this.world.blueBedPos.x, this.world.blueBedPos.y, this.world.blueBedPos.z, BLOCK.AIR);
          this.world.setBlock(this.world.blueBedPos.x + 1, this.world.blueBedPos.y, this.world.blueBedPos.z, BLOCK.AIR);
        }
      }
    }

    // Resource spawning
    this._updateResourceSpawning(dt);

    // Update world (temp bridges etc.)
    this.world.update(dt);

    // Update player
    this.player.update(dt);

    // Update entities
    for (const npc of this.redTeamNPCs) npc.update(dt);
    for (const npc of this.blueTeamNPCs) npc.update(dt);
    for (const zombie of this.zombies) zombie.update(dt);
    for (const merchant of this.merchants) merchant.update(dt);

    // Update dropped items
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      if (!this.droppedItems[i].update(dt)) {
        this.droppedItems[i].dispose();
        this.droppedItems.splice(i, 1);
        continue;
      }
      // Check pickup by player
      if (this.player.alive && this.player.position.distanceTo(this.droppedItems[i].position) < 2) {
        this.droppedItems[i].pickup(this.player);
        this.droppedItems[i].dispose();
        this.droppedItems.splice(i, 1);
      }
    }

    // Update currency drops
    for (let i = this.currencyDrops.length - 1; i >= 0; i--) {
      if (!this.currencyDrops[i].update(dt)) {
        this.currencyDrops[i].dispose();
        this.currencyDrops.splice(i, 1);
        continue;
      }
      // Check pickup
      const drop = this.currencyDrops[i];
      // Player pickup
      if (this.player.alive && this.player.position.distanceTo(drop.position) < 2) {
        this.player.currency[drop.type] += drop.amount;
        this.audio.playPickup();
        drop.dispose();
        this.currencyDrops.splice(i, 1);
        continue;
      }
      // NPC pickup
      const allNPCs = [...this.redTeamNPCs, ...this.blueTeamNPCs];
      let picked = false;
      for (const npc of allNPCs) {
        if (npc.alive && npc.position.distanceTo(drop.position) < 2) {
          npc.currency[drop.type] = (npc.currency[drop.type] || 0) + drop.amount;
          drop.dispose();
          this.currencyDrops.splice(i, 1);
          picked = true;
          break;
        }
      }
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.projectiles[i].update(dt)) {
        this.projectiles[i].dispose();
        this.projectiles.splice(i, 1);
      }
    }

    // Update TNT timers
    for (let i = this.tntTimers.length - 1; i >= 0; i--) {
      this.tntTimers[i].timer -= dt;
      if (this.tntTimers[i].timer <= 0) {
        const t = this.tntTimers[i];
        this.world.explodeTNT(t.x, t.y, t.z);
        this._explosionDamage(t.x, t.y, t.z, 4);
        this.spawnBlockParticles(t.x + 0.5, t.y + 0.5, t.z + 0.5, BLOCK.TNT);
        this.audio.playExplosion();
        this.tntTimers.splice(i, 1);
      }
    }

    // Update particles
    this._updateParticles(dt);

    // Check bed state changes
    this._checkBedStates();

    // Block highlight
    this._updateBlockHighlight();

    // Rebuild mesh if needed
    this.world.rebuildMesh();

    // Update HUD
    this.hud.update(dt);
  }

  _render() {
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ==================== RESOURCE SPAWNING ====================
  _updateResourceSpawning(dt) {
    // Copper spawning at team islands
    this.copperTimer += dt;
    if (this.copperTimer >= RESOURCE_COPPER_INTERVAL) {
      this.copperTimer = 0;
      // Red spawner
      if (this.world.redSpawnerPos) {
        this.spawnCurrencyDrops(
          new THREE.Vector3(
            this.world.redSpawnerPos.x + (Math.random() - 0.5),
            this.world.redSpawnerPos.y + 0.5,
            this.world.redSpawnerPos.z + (Math.random() - 0.5)
          ),
          [{ type: 'copper', amount: 1 }]
        );
      }
      // Blue spawner
      if (this.world.blueSpawnerPos) {
        this.spawnCurrencyDrops(
          new THREE.Vector3(
            this.world.blueSpawnerPos.x + (Math.random() - 0.5),
            this.world.blueSpawnerPos.y + 0.5,
            this.world.blueSpawnerPos.z + (Math.random() - 0.5)
          ),
          [{ type: 'copper', amount: 1 }]
        );
      }
    }

    // Iron spawning
    this.ironTimer += dt;
    if (this.ironTimer >= RESOURCE_IRON_INTERVAL) {
      this.ironTimer = 0;
      if (this.world.redSpawnerPos) {
        this.spawnCurrencyDrops(
          new THREE.Vector3(
            this.world.redSpawnerPos.x + (Math.random() - 0.5),
            this.world.redSpawnerPos.y + 0.5,
            this.world.redSpawnerPos.z + (Math.random() - 0.5)
          ),
          [{ type: 'iron', amount: 1 }]
        );
      }
      if (this.world.blueSpawnerPos) {
        this.spawnCurrencyDrops(
          new THREE.Vector3(
            this.world.blueSpawnerPos.x + (Math.random() - 0.5),
            this.world.blueSpawnerPos.y + 0.5,
            this.world.blueSpawnerPos.z + (Math.random() - 0.5)
          ),
          [{ type: 'iron', amount: 1 }]
        );
      }
    }

    // Center island resources (currency)
    this.centerResourceTimer += dt;
    if (this.centerResourceTimer >= 8) {
      this.centerResourceTimer = 0;
      for (const rp of this.world.centerResourcePositions) {
        if (this.currencyDrops.filter(d =>
          d.position.distanceTo(new THREE.Vector3(rp.x, rp.y, rp.z)) < 3
        ).length < 4) {
          this.spawnCurrencyDrops(
            new THREE.Vector3(rp.x + (Math.random() - 0.5), rp.y + 0.5, rp.z + (Math.random() - 0.5)),
            [{ type: rp.type, amount: 1 }]
          );
        }
      }
    }

    // Center island item spawns (bow, arrows, food)
    if (!this._centerItemTimer) this._centerItemTimer = 0;
    this._centerItemTimer += dt;
    if (this._centerItemTimer >= 20) {
      this._centerItemTimer = 0;
      const itemMap = {
        bow: { def: ITEMS.BOW, qty: 1 },
        arrow: { def: ITEMS.ARROW, qty: 4 },
        bread: { def: ITEMS.BREAD, qty: 2 },
        chicken: { def: ITEMS.CHICKEN, qty: 1 },
      };
      for (const ip of this.world.centerItemPositions) {
        // Don't spawn if there's already a dropped item nearby
        const nearby = this.droppedItems.filter(d =>
          d.position.distanceTo(new THREE.Vector3(ip.x, ip.y, ip.z)) < 4
        ).length;
        if (nearby < 1) {
          const info = itemMap[ip.item];
          if (info) {
            this.spawnDroppedItems(
              new THREE.Vector3(ip.x, ip.y, ip.z),
              [{ item: info.def, count: info.qty }],
              { copper: 0, iron: 0, diamond: 0, gold: 0 }
            );
          }
        }
      }
    }
  }

  // ==================== COMBAT ====================
  tryAttackEntity(attacker) {
    const isPlayer = attacker === this.player;
    const attackerPos = isPlayer ? this.camera.position.clone() : attacker.position.clone();
    const attackDir = isPlayer
      ? new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
      : null;

    const allEntities = this.getAllEntities();
    let bestTarget = null;
    let bestDist = ATTACK_RANGE;

    for (const entity of allEntities) {
      if (!entity.alive) continue;
      if (entity.team === attacker.team && entity.team !== null) continue;
      if (entity === attacker) continue;

      const dist = attackerPos.distanceTo(entity.position);
      if (dist > ATTACK_RANGE) continue;

      // For player, check if entity is roughly in front
      if (isPlayer && attackDir) {
        const toEntity = new THREE.Vector3().subVectors(entity.position, attackerPos).normalize();
        const dot = attackDir.dot(toEntity);
        if (dot < 0.5) continue; // must be roughly in front
      }

      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = entity;
      }
    }

    // Also check player if attacker is NPC
    if (!isPlayer && this.player.alive && this.player.team !== attacker.team) {
      const dist = attacker.position.distanceTo(this.player.position);
      if (dist < bestDist) {
        bestTarget = this.player;
      }
    }

    if (bestTarget) {
      const weapon = isPlayer ? this.player.getSelectedItem() : null;
      let damage = 3;
      if (weapon && weapon.item.type === 'weapon') {
        damage = weapon.item.damage || 3;
      }
      if (!isPlayer) {
        damage = attacker.damage || 3;
      }

      bestTarget.takeDamage(damage, attacker);
      this.spawnHitParticles(bestTarget.position.x, bestTarget.position.y, bestTarget.position.z);
      this.audio.playHit();
      return true;
    }

    return false;
  }

  _explosionDamage(cx, cy, cz, radius) {
    const center = new THREE.Vector3(cx, cy, cz);
    const allEntities = [...this.getAllEntities()];
    if (this.player.alive) allEntities.push(this.player);

    for (const entity of allEntities) {
      if (!entity.alive) continue;
      const dist = entity.position.distanceTo(center);
      if (dist < radius) {
        const damage = Math.floor(10 * (1 - dist / radius));
        entity.takeDamage(damage, { position: center });
      }
    }
  }

  shootArrow(shooter) {
    const isPlayer = shooter === this.player;
    const pos = isPlayer
      ? this.camera.position.clone()
      : shooter.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    const dir = isPlayer
      ? this.player.getLookDirection()
      : new THREE.Vector3().subVectors(
          (shooter.target ? shooter.target.position : this.player.position),
          pos
        ).normalize();

    const arrow = new ArrowProjectile(this, pos, dir, shooter);
    this.projectiles.push(arrow);
  }

  placeTNT(x, y, z) {
    this.world.setBlock(x, y, z, BLOCK.TNT);
    this.tntTimers.push({ x, y, z, timer: 3 });
    this.hud.showNotification('TNT已放置! 3秒后爆炸!');
  }

  // ==================== ITEM DROPS ====================
  spawnDroppedItems(position, items, currency) {
    if (items.length > 0 || Object.values(currency).some(v => v > 0)) {
      const drop = new DroppedItem(this, position, items, currency);
      this.droppedItems.push(drop);
    }
  }

  spawnCurrencyDrops(position, drops) {
    for (const drop of drops) {
      const cd = new CurrencyDrop(this, position, drop.type, drop.amount);
      this.currencyDrops.push(cd);
    }
  }

  // ==================== PARTICLES ====================
  spawnBlockParticles(x, y, z, blockType) {
    const color = BLOCK_COLORS[blockType] || 0xffffff;
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const mat = new THREE.MeshLambertMaterial({ color });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x, y, z);
      this.scene.add(p);
      this.particles.push({
        mesh: p,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 5 + 2,
        vz: (Math.random() - 0.5) * 4,
        life: 0.6 + Math.random() * 0.4,
      });
    }
  }

  spawnHitParticles(x, y, z) {
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x, y + 1, z);
      this.scene.add(p);
      this.particles.push({
        mesh: p,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 3 + 1,
        vz: (Math.random() - 0.5) * 3,
        life: 0.3 + Math.random() * 0.3,
      });
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 15 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += dt * 5;
      p.mesh.rotation.y += dt * 7;
      p.mesh.material.opacity = p.life;
    }
  }

  // ==================== ENTITY HELPERS ====================
  getAllEntities() {
    return [...this.redTeamNPCs, ...this.blueTeamNPCs, ...this.zombies];
  }

  getAllNPCs() {
    return [...this.redTeamNPCs, ...this.blueTeamNPCs];
  }

  getTeamMembers(team) {
    return team === TEAM_RED ? this.redTeamNPCs : this.blueTeamNPCs;
  }

  // ==================== GAME FLOW ====================
  setTeamCommand(cmd) {
    for (const npc of this.redTeamNPCs) {
      npc.command = cmd;
    }
    const cmdNames = { defend: '保护床', attack: '全体进攻', follow: '跟我走' };
    this.hud.showNotification(`指令: ${cmdNames[cmd] || cmd}`);
  }

  _checkBedStates() {
    if (this.lastRedBedState && !this.world.redBedAlive) {
      this.lastRedBedState = false;
      this.hud.showBedDestroyed(TEAM_RED);
    }
    if (this.lastBlueBedState && !this.world.blueBedAlive) {
      this.lastBlueBedState = false;
      this.hud.showBedDestroyed(TEAM_BLUE);
    }
  }

  onPlayerEliminated(entity) {
    this.checkWinCondition();
  }

  checkWinCondition() {
    if (this.phase === 'over') return;

    // Check if all red team is eliminated
    const redAlive = this.player.alive || this.player.respawnTimer > 0 ||
      this.redTeamNPCs.some(n => n.alive || (!n.eliminated && n.respawnTimer > 0));
    const redCanRespawn = this.world.redBedAlive;

    // Check if all blue team is eliminated
    const blueAlive = this.blueTeamNPCs.some(n => n.alive || (!n.eliminated && n.respawnTimer > 0));
    const blueCanRespawn = this.world.blueBedAlive;

    if (!redAlive && !redCanRespawn) {
      // Blue wins
      this.phase = 'over';
      this.hud.showGameOver(false);
      return;
    }

    if (!blueAlive && !blueCanRespawn) {
      // Red wins
      this.phase = 'over';
      this.hud.showGameOver(true);
      return;
    }
  }

  // ==================== INTERACTION ====================
  isAnyUIOpen() {
    return this.hud.isShopOpen() || this.hud.isCommandMenuOpen() ||
           this.hud.isInventoryOpen() || this.hud.isCraftingOpen();
  }

  handleFKey() {
    // F toggles: if any UI is open, close it
    if (this.isAnyUIOpen()) {
      this.closeAnyUI();
      return;
    }

    // Check if near any merchant (both teams' merchants, distance 5)
    for (const merchant of this.merchants) {
      if (merchant.team === this.player.team) {
        const dist = this.player.position.distanceTo(merchant.position);
        if (dist < 5) {
          this.hud.openShop();
          return;
        }
      }
    }

    // Check if near crafting table (check both teams' tables, player might be on enemy island)
    const craftPositions = [this.world.redCraftPos, this.world.blueCraftPos].filter(Boolean);
    for (const craftPos of craftPositions) {
      const craftVec = new THREE.Vector3(craftPos.x, craftPos.y, craftPos.z);
      const dist = this.player.position.distanceTo(craftVec);
      if (dist < 5) {
        this.hud.openCrafting();
        return;
      }
    }

    // Otherwise open command menu (for NPC orders)
    this.hud.openCommandMenu();
  }

  handleEscape() {
    // ESC does not close any UI. Each UI has its own key (F or E) or click-outside to close.
  }

  closeAnyUI() {
    if (this.hud.isShopOpen()) this.hud.closeShop();
    else if (this.hud.isCommandMenuOpen()) this.hud.closeCommandMenu();
    else if (this.hud.isInventoryOpen()) this.hud.closeInventory();
    else if (this.hud.isCraftingOpen()) this.hud.closeCrafting();
  }

  toggleInventory() {
    if (this.hud.isInventoryOpen()) {
      this.hud.closeInventory();
    } else if (!this.isAnyUIOpen()) {
      this.hud.openInventory();
    }
  }

  // ==================== BLOCK HIGHLIGHT ====================
  _createBlockHighlight() {
    const geo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const edges = new THREE.EdgesGeometry(geo);
    const mat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const highlight = new THREE.LineSegments(edges, mat);
    highlight.visible = false;
    return highlight;
  }

  _updateBlockHighlight() {
    if (!this.player.alive || !this.player.pointerLocked) {
      this.blockHighlight.visible = false;
      return;
    }

    const dir = this.player.getLookDirection();
    const ray = this.world.raycast(this.camera.position, dir, 6);

    if (ray.hit) {
      this.blockHighlight.visible = true;
      this.blockHighlight.position.set(ray.x + 0.5, ray.y + 0.5, ray.z + 0.5);
    } else {
      this.blockHighlight.visible = false;
    }
  }
}
