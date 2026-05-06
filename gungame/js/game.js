import * as THREE from 'three';
import { TEAM_BLUE, TEAM_RED, BLUE_BOT_ROLES, RED_BOT_ROLES, RESTOCK_ZONES, HOUSE_POS, HOUSE_SIZE } from './constants.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Bot, fighterAdapterPlayer, fighterAdapterBot } from './bot.js';
import { HUD } from './hud.js';

export class FlagSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.carrier = null;       // the fighter currently carrying a flag
    this.carriedEnemyTeam = null; // which enemy flag is being carried
    this.droppedPos = null;    // THREE.Vector3 or null
    this.droppedTeam = null;   // which team's flag is dropped
    this._flagMeshes = {};
    this._dropMesh = null;
    this._initMeshes();
  }

  _initMeshes() {
    for (const team of [TEAM_BLUE, TEAM_RED]) {
      const color = team === TEAM_BLUE ? 0x3b82f6 : 0xef4444;
      const group = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.5),
        new THREE.MeshLambertMaterial({ color: 0x888888 })
      );
      pole.position.y = 1.25;
      group.add(pole);
      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.5),
        new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
      );
      cloth.position.set(0.4, 2.1, 0);
      group.add(cloth);
      this.scene.add(group);
      this._flagMeshes[team] = group;
    }
    // Dropped flag marker
    const dropGroup = new THREE.Group();
    const dpole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5), new THREE.MeshLambertMaterial({ color: 0x888888 }));
    dpole.position.y = 0.75; dropGroup.add(dpole);
    const dcloth = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    dcloth.position.set(0.3, 1.3, 0); dropGroup.add(dcloth);
    dropGroup.visible = false;
    this.scene.add(dropGroup);
    this._dropMesh = dropGroup;
    this._updatePositions();
  }

  _homePos(team) {
    const p = HOUSE_POS[team];
    return new THREE.Vector3(p.x, HOUSE_SIZE.h + 1.5, p.z);
  }

  _updatePositions() {
    for (const team of [TEAM_BLUE, TEAM_RED]) {
      const mesh = this._flagMeshes[team];
      if (this.droppedTeam === team) {
        mesh.visible = false;
      } else if (this.carriedEnemyTeam === team) {
        mesh.visible = false;
      } else {
        mesh.visible = true;
        mesh.position.copy(this._homePos(team));
      }
    }
    if (this.droppedPos) {
      this._dropMesh.visible = true;
      this._dropMesh.position.copy(this.droppedPos);
      // tint drop cloth to dropped team color
      const col = this.droppedTeam === TEAM_BLUE ? 0x3b82f6 : 0xef4444;
      this._dropMesh.children[1].material.color.setHex(col);
    } else {
      this._dropMesh.visible = false;
    }
  }

  _updateCarrierVisual(dt) {
    if (!this.carrier) return;
    const c = this.carrier;
    const pos = c.getPos ? c.getPos() : c.position.clone();
    pos.y += 2.2;
    const mesh = this._flagMeshes[this.carriedEnemyTeam];
    mesh.visible = true;
    mesh.position.copy(pos);
    // make flag wave a bit
    mesh.rotation.y = Math.sin(Date.now() * 0.005) * 0.2;
  }

  flagAtHome(team) {
    if (this.carriedEnemyTeam === team) return false;
    if (this.droppedTeam === team) return false;
    return true;
  }

  grabFlag(fighter, enemyTeam) {
    if (!this.flagAtHome(enemyTeam)) return false;
    // Must be on enemy roof (close to flag pole)
    const roofPos = this._homePos(enemyTeam);
    const pos = fighter.getPos ? fighter.getPos() : fighter.position.clone();
    if (pos.distanceTo(roofPos) > 6) return false;
    this.carrier = fighter;
    this.carriedEnemyTeam = enemyTeam;
    this.droppedPos = null;
    this.droppedTeam = null;
    this._updatePositions();
    return true;
  }

  dropFlag(pos) {
    if (!this.carrier || !this.carriedEnemyTeam) return;
    this.droppedPos = pos.clone();
    this.droppedTeam = this.carriedEnemyTeam;
    this.carrier = null;
    this.carriedEnemyTeam = null;
    this._updatePositions();
  }

  pickupDropped(fighter) {
    if (!this.droppedPos || !this.droppedTeam) return false;
    const pos = fighter.getPos ? fighter.getPos() : fighter.position.clone();
    if (pos.distanceTo(this.droppedPos) > 3) return false;
    // If fighter is on same team as dropped flag, return it home
    if (fighter.team === this.droppedTeam) {
      // Return flag to home
      this.droppedPos = null;
      this.droppedTeam = null;
      this._updatePositions();
      return true;
    }
    // Enemy picks it up and continues carrying
    this.carrier = fighter;
    this.carriedEnemyTeam = this.droppedTeam;
    this.droppedPos = null;
    this.droppedTeam = null;
    this._updatePositions();
    return true;
  }

  tryCapture(fighter) {
    if (!this.carrier || this.carrier !== fighter || !this.carriedEnemyTeam) return false;
    const ownBase = RESTOCK_ZONES.find(z => z.team === fighter.team);
    if (!ownBase) return false;
    const pos = fighter.getPos ? fighter.getPos() : fighter.position.clone();
    const dx = pos.x - ownBase.x, dz = pos.z - ownBase.z;
    if (dx * dx + dz * dz > ownBase.r * ownBase.r) return false;
    // SUCCESS — reset flag to home
    this.carrier = null;
    this.carriedEnemyTeam = null;
    this.droppedPos = null;
    this.droppedTeam = null;
    this._updatePositions();
    return true;
  }

  checkPlayerInteraction(player) {
    if (!player.alive) return;
    const enemyTeam = player.team === TEAM_BLUE ? TEAM_RED : TEAM_BLUE;
    // Try pickup dropped
    if (this.droppedPos) {
      if (this.pickupDropped(player)) return 'pickedup';
    }
    // Try grab from roof
    if (this.flagAtHome(enemyTeam)) {
      if (this.grabFlag(player, enemyTeam)) return 'grabbed';
    }
    return null;
  }

  checkBotInteraction(bot) {
    if (!bot.alive) return;
    const enemyTeam = bot.team === TEAM_BLUE ? TEAM_RED : TEAM_BLUE;
    if (this.droppedPos) {
      if (this.pickupDropped(bot)) return 'pickedup';
    }
    if (this.flagAtHome(enemyTeam)) {
      if (this.grabFlag(bot, enemyTeam)) return 'grabbed';
    }
    return null;
  }

  update(dt) {
    this._updateCarrierVisual(dt);
  }
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.scene.add(this.camera);

    this.world = buildWorld(this.scene);
    this.player = new Player(this.camera, canvas, this.world, 'rifle');
    this.bots = [];
    this.spawnTeams();

    this.flagSystem = new FlagSystem(this.scene, this.world);

    this.hud = new HUD();
    this.matchOver = false;
    this.clock = new THREE.Clock();

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyB') this.tryOpenWeaponPicker();
    });
    document.getElementById('weapon-picker').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-gun]');
      if (!btn) return;
      const id = parseInt(btn.dataset.gun, 10);
      this.player.setMain(id);
      this.closeWeaponPicker();
    });
    document.getElementById('weapon-picker-close').addEventListener('click', () => this.closeWeaponPicker());
  }

  tryOpenWeaponPicker() {
    const z = RESTOCK_ZONES.find(z => z.team === this.player.team);
    if (!z) return;
    const dx = this.player.position.x - z.x, dz = this.player.position.z - z.z;
    if (dx*dx + dz*dz > z.r*z.r) return;
    document.getElementById('weapon-picker').style.display = 'flex';
    document.exitPointerLock?.();
  }
  closeWeaponPicker() {
    document.getElementById('weapon-picker').style.display = 'none';
    this.canvas.requestPointerLock?.();
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.camera) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }
  }

  spawnTeams() {
    const bluePos = [[-6, 60], [6, 60], [-9, 56], [9, 56]];
    BLUE_BOT_ROLES.forEach((role, i) => {
      const [x, z] = bluePos[i];
      this.bots.push(new Bot(TEAM_BLUE, role, this.scene, new THREE.Vector3(x, 0, z)));
    });
    const redPos = [[0, -60], [-6, -60], [6, -60], [-9, -56], [9, -56]];
    RED_BOT_ROLES.forEach((role, i) => {
      const [x, z] = redPos[i];
      this.bots.push(new Bot(TEAM_RED, role, this.scene, new THREE.Vector3(x, 0, z)));
    });
  }

  allFighters() {
    if (!this._adapters) {
      this._adapters = [
        fighterAdapterPlayer(this.player),
        ...this.bots.map(fighterAdapterBot),
      ];
    }
    return this._adapters;
  }

  checkWin() {
    // CTF: capture enemy flag by bringing it to own base
    const cap = this.flagSystem.tryCapture(this.player);
    if (cap) return this.player.team;
    for (const b of this.bots) {
      if (b.alive && this.flagSystem.carrier === b) {
        const capBot = this.flagSystem.tryCapture(b);
        if (capBot) return b.team;
      }
    }
    return null;
  }

  start() {
    const tick = () => {
      const dt = Math.min(0.05, this.clock.getDelta());
      if (!this.matchOver) {
        this.player.update(dt, this);
        for (const b of this.bots) b.update(dt, this);
        this.flagSystem.update(dt);
        this.hud.update(this);
        const w = this.checkWin();
        if (w) {
          this.matchOver = true;
          this.hud.showEnd(w);
          document.exitPointerLock?.();
        }
      }
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    tick();
  }
}
