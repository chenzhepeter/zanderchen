import * as THREE from 'three';
import { VoxelWorld } from './world.js';
import { Player } from './player.js';
import { NPCEntity, EnemyAI, ZombieEntity, MerchantEntity,
         DroppedItem, CurrencyDrop, ArrowProjectile } from './entities.js';
import { HUD } from './hud.js';
import { AudioSystem } from './audio.js';
import { TEAM_RED, TEAM_BLUE, TEAM_YELLOW, TEAM_GREEN, ALL_TEAMS, TEAM_CONFIG,
         RESOURCE_COPPER_INTERVAL, RESOURCE_IRON_INTERVAL,
         PREP_PHASE_TIME, MAX_GAME_TIME, BLOCK, BLOCK_COLORS, ATTACK_RANGE, ITEMS,
         KNOCKBACK_FORCE } from './constants.js';

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
    this.scene.fog = new THREE.Fog(0x87ceeb, 80, 200);

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
    voidPlane.position.set(60, -2, 60);
    this.scene.add(voidPlane);

    // Void fog particles (subtle floating particles below islands)
    const starGeo = new THREE.BufferGeometry();
    const starVertices = [];
    for (let i = 0; i < 300; i++) {
      starVertices.push(
        Math.random() * 200 - 40,
        Math.random() * 10 - 5,
        Math.random() * 200 - 40
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
    this.teamNPCs = { red: [], blue: [], yellow: [], green: [] };
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
    this.lastBedState = { red: true, blue: true, yellow: true, green: true };

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
    const spawn = this.world.teams.red.spawnPos;
    this.player.position.set(spawn.x, spawn.y, spawn.z);
    this.player.team = TEAM_RED;
    // Face toward center island (positive X direction)
    this.player.yaw = -Math.PI / 2;

    // Give player starting items
    this.player.addItem(ITEMS.WOOD_SWORD, 1);

    // Create red team NPCs (3 teammates, follow player)
    const redNames = ['队友1', '队友2', '队友3'];
    for (let i = 0; i < 3; i++) {
      const pos = new THREE.Vector3(
        spawn.x + (i - 1) * 2,
        spawn.y,
        spawn.z
      );
      const npc = new NPCEntity(this, pos, TEAM_RED, redNames[i]);
      npc.command = 'follow';
      npc.blockCount = 96;
      this.teamNPCs.red.push(npc);
    }

    // Create enemy team NPCs (3 per enemy team)
    const enemyTeams = [TEAM_BLUE, TEAM_YELLOW, TEAM_GREEN];
    const teamLabels = {
      [TEAM_BLUE]: '蓝',
      [TEAM_YELLOW]: '黄',
      [TEAM_GREEN]: '绿',
    };
    for (const team of enemyTeams) {
      const teamSpawn = this.world.teams[team].spawnPos;
      for (let i = 0; i < 3; i++) {
        const pos = new THREE.Vector3(
          teamSpawn.x + (i - 1) * 2,
          teamSpawn.y,
          teamSpawn.z
        );
        const enemy = new EnemyAI(this, pos, team, `${teamLabels[team]}${i + 1}`);
        enemy.blockCount = 96;
        this.teamNPCs[team].push(enemy);
      }
    }

    // Create zombies on center island
    for (const spawnPos of this.world.zombieSpawnPositions) {
      const zombie = new ZombieEntity(this, new THREE.Vector3(spawnPos.x, spawnPos.y, spawnPos.z));
      this.zombies.push(zombie);
    }

    // Create merchants (one per team)
    for (const team of ALL_TEAMS) {
      const mPos = this.world.teams[team].merchantPos;
      if (mPos) {
        const merchant = new MerchantEntity(this,
          new THREE.Vector3(mPos.x, mPos.y, mPos.z),
          team
        );
        this.merchants.push(merchant);
      }
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
        this.hud.showNotification('⏰ 时间到! 所有床被摧毁 - 绝杀模式!', 5);
        for (const team of ALL_TEAMS) {
          const td = this.world.teams[team];
          td.bedAlive = false;
          if (td.bedPos) {
            this.world.setBlock(td.bedPos.x, td.bedPos.y, td.bedPos.z, BLOCK.AIR);
            this.world.setBlock(td.bedPos.x + 1, td.bedPos.y, td.bedPos.z, BLOCK.AIR);
          }
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
    for (const team of ALL_TEAMS) {
      for (const npc of this.teamNPCs[team]) npc.update(dt);
    }
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
      const allNPCs = this.getAllNPCs();
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
        this._explosionDamage(t.x + 0.5, t.y + 0.5, t.z + 0.5, 4);
        this._spawnExplosionEffect(t.x + 0.5, t.y + 0.5, t.z + 0.5, 4);
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
    // Copper spawning at all team islands
    this.copperTimer += dt;
    if (this.copperTimer >= RESOURCE_COPPER_INTERVAL) {
      this.copperTimer = 0;
      for (const team of ALL_TEAMS) {
        const sp = this.world.teams[team].spawnerPos;
        if (sp) {
          this.spawnCurrencyDrops(
            new THREE.Vector3(sp.x + (Math.random() - 0.5), sp.y + 0.5, sp.z + (Math.random() - 0.5)),
            [{ type: 'copper', amount: 1 }]
          );
        }
      }
    }

    // Iron spawning at all team islands
    this.ironTimer += dt;
    if (this.ironTimer >= RESOURCE_IRON_INTERVAL) {
      this.ironTimer = 0;
      for (const team of ALL_TEAMS) {
        const sp = this.world.teams[team].spawnerPos;
        if (sp) {
          this.spawnCurrencyDrops(
            new THREE.Vector3(sp.x + (Math.random() - 0.5), sp.y + 0.5, sp.z + (Math.random() - 0.5)),
            [{ type: 'iron', amount: 1 }]
          );
        }
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
        // Apply damage without knockback from takeDamage (we'll add our own)
        entity.takeDamage(damage);

        // Explosion knockback — stronger than melee
        const dir = new THREE.Vector3().subVectors(entity.position, center);
        if (dir.length() > 0.01) dir.normalize();
        else dir.set(0, 1, 0);
        const knockbackStrength = KNOCKBACK_FORCE * 2 * (1 - dist / radius);
        entity.velocity.x += dir.x * knockbackStrength;
        entity.velocity.y += Math.abs(dir.y + 0.5) * knockbackStrength * 0.8;
        entity.velocity.z += dir.z * knockbackStrength;
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

  _spawnExplosionEffect(x, y, z, radius) {
    // Fiery explosion particles (orange/yellow/white)
    const colors = [0xff6600, 0xffaa00, 0xffcc44, 0xffffff, 0xff4400];
    for (let i = 0; i < 35; i++) {
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const color = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x, y, z);
      this.scene.add(p);
      const speed = 3 + Math.random() * 8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      this.particles.push({
        mesh: p,
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.cos(phi) * speed * 0.8 + 2,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        life: 0.4 + Math.random() * 0.5,
      });
    }

    // Smoke particles (delayed effect via slower, darker particles)
    for (let i = 0; i < 12; i++) {
      const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const gray = 0x30 + Math.floor(Math.random() * 0x30);
      const mat = new THREE.MeshBasicMaterial({
        color: (gray << 16) | (gray << 8) | gray,
        transparent: true, opacity: 0.7,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(
        x + (Math.random() - 0.5) * 2,
        y + Math.random(),
        z + (Math.random() - 0.5) * 2
      );
      this.scene.add(p);
      this.particles.push({
        mesh: p,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 1 + Math.random() * 2,
        vz: (Math.random() - 0.5) * 1.5,
        life: 1.0 + Math.random() * 0.8,
      });
    }

    // Flash light
    const flash = new THREE.PointLight(0xff8800, 8, radius * 4);
    flash.position.set(x, y, z);
    this.scene.add(flash);
    this._explosionLights = this._explosionLights || [];
    this._explosionLights.push({ light: flash, life: 0.3 });
  }

  _updateParticles(dt) {
    // Update explosion lights
    if (this._explosionLights) {
      for (let i = this._explosionLights.length - 1; i >= 0; i--) {
        const el = this._explosionLights[i];
        el.life -= dt;
        if (el.life <= 0) {
          this.scene.remove(el.light);
          el.light.dispose();
          this._explosionLights.splice(i, 1);
        } else {
          el.light.intensity = 8 * (el.life / 0.3);
        }
      }
    }

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
    const npcs = [];
    for (const team of ALL_TEAMS) npcs.push(...this.teamNPCs[team]);
    return [...npcs, ...this.zombies];
  }

  getAllNPCs() {
    const npcs = [];
    for (const team of ALL_TEAMS) npcs.push(...this.teamNPCs[team]);
    return npcs;
  }

  getTeamMembers(team) {
    return this.teamNPCs[team] || [];
  }

  // ==================== GAME FLOW ====================
  setTeamCommand(cmd) {
    for (const npc of this.teamNPCs.red) {
      npc.command = cmd;
    }
    const cmdNames = { defend: '保护床', attack: '全体进攻', follow: '跟我走' };
    this.hud.showNotification(`指令: ${cmdNames[cmd] || cmd}`);
  }

  _checkBedStates() {
    for (const team of ALL_TEAMS) {
      if (this.lastBedState[team] && !this.world.teams[team].bedAlive) {
        this.lastBedState[team] = false;
        this.hud.showBedDestroyed(team);
      }
    }
  }

  onPlayerEliminated(entity) {
    this.checkWinCondition();
  }

  checkWinCondition() {
    if (this.phase === 'over') return;

    // Check if red team (player) is eliminated
    const redAlive = this.player.alive || this.player.respawnTimer > 0 ||
      this.teamNPCs.red.some(n => n.alive || (!n.eliminated && n.respawnTimer > 0));
    const redCanRespawn = this.world.teams.red.bedAlive;

    if (!redAlive && !redCanRespawn) {
      // Player loses
      this.phase = 'over';
      this.hud.showGameOver(false);
      return;
    }

    // Check if all enemy teams are eliminated
    let allEnemiesDead = true;
    for (const team of [TEAM_BLUE, TEAM_YELLOW, TEAM_GREEN]) {
      const teamAlive = this.teamNPCs[team].some(n => n.alive || (!n.eliminated && n.respawnTimer > 0));
      const canRespawn = this.world.teams[team].bedAlive;
      if (teamAlive || canRespawn) {
        allEnemiesDead = false;
        break;
      }
    }

    if (allEnemiesDead) {
      // Player wins
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

    // Check if near crafting table (check all teams' tables, player might be on enemy island)
    const craftPositions = ALL_TEAMS.map(t => this.world.teams[t].craftPos).filter(Boolean);
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
