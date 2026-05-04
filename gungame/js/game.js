import * as THREE from 'three';
import { TEAM_BLUE, TEAM_RED, BLUE_BOT_ROLES, RED_BOT_ROLES, RESTOCK_ZONES, GUN_RIFLE, GUN_SMG, GUN_SNIPER } from './constants.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Bot, fighterAdapterPlayer, fighterAdapterBot } from './bot.js';
import { HUD } from './hud.js';

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

    this.hud = new HUD();
    this.matchOver = false;
    this.clock = new THREE.Clock();

    // 'B' opens base weapon picker if standing in blue base
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
    // must be in own base
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
    // Spawn near each team's house (houses now at z=±65)
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
    // Player counts as alive if they're alive OR will respawn (Blue base still standing)
    const blueHouseHp = this.world.houses.blue.hp;
    const playerCounts = this.player.alive || (blueHouseHp > 0);
    const blueAlive = (playerCounts ? 1 : 0) + this.bots.filter(b => b.team === 'blue' && b.alive).length;
    const redAlive  = this.bots.filter(b => b.team === 'red' && b.alive).length;
    const redHouse  = this.world.houses.red.hp;
    if (redAlive === 0 && redHouse === 0) return 'blue';
    if (blueAlive === 0 && blueHouseHp === 0) return 'red';
    return null;
  }

  start() {
    const tick = () => {
      const dt = Math.min(0.05, this.clock.getDelta());
      if (!this.matchOver) {
        this.player.update(dt, this);
        for (const b of this.bots) b.update(dt, this);
        // No respawn once enemy house is destroyed
        for (const team of ['blue', 'red']) {
          if (this.world.houses[team].hp === 0) {
            for (const b of this.bots) if (b.team === team && !b.alive) b.respawnIn = 9999;
          }
        }
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
