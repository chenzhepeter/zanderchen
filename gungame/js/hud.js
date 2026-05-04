import { GUNS, RESTOCK_ZONES, TEAM_BLUE } from './constants.js';
import { activeGun, activeGunId } from './guns.js';

export class HUD {
  constructor() {
    this.gunName = document.getElementById('hud-gun-name');
    this.ammo = document.getElementById('hud-ammo');
    this.reload = document.getElementById('hud-reload');
    this.hp = document.getElementById('hud-hp');
    this.role = document.getElementById('hud-role');
    this.blueAlive = document.getElementById('hud-blue-alive');
    this.redAlive = document.getElementById('hud-red-alive');
    this.blueHouseHp = document.getElementById('hud-blue-house');
    this.redHouseHp = document.getElementById('hud-red-house');
    this.endScreen = document.getElementById('end-screen');
    this.endTitle = document.getElementById('end-title');
    this.zoneHint = document.getElementById('hud-zone-hint');
    this.crosshair = document.getElementById('crosshair');
    this.scope = document.getElementById('scope');
    this.respawnBanner = document.getElementById('respawn-banner');
  }

  update(game) {
    const p = game.player;
    const s = p.shooter;
    const g = activeGun(s);
    const slotLabel = s.activeSlot === 0 ? '1·Pistol' : `2·${g.name}`;
    this.gunName.textContent = slotLabel;
    this.ammo.textContent = `${s.ammo[s.activeSlot]} / ${g.mag}  •  reserve ${s.reserve[s.activeSlot]} mag${s.reserve[s.activeSlot] === 1 ? '' : 's'}`;
    if (s.reloading > 0) {
      this.reload.style.display = 'block';
      this.reload.textContent = `Reloading… ${s.reloading.toFixed(1)}s`;
    } else this.reload.style.display = 'none';

    this.hp.textContent = `HP ${p.hp}`;
    this.hp.style.color = p.hp > 60 ? '#86efac' : p.hp > 30 ? '#fde68a' : '#fca5a5';
    this.role.textContent = `Role: ${p.role}`;

    const blueAlive = (p.alive ? 1 : 0) + game.bots.filter(b => b.team === 'blue' && b.alive).length;
    const redAlive = game.bots.filter(b => b.team === 'red' && b.alive).length;
    this.blueAlive.textContent = `Blue: ${blueAlive} / 5`;
    this.redAlive.textContent = `Red: ${redAlive} / 5`;
    this.blueHouseHp.textContent = `🏠 ${game.world.houses.blue.hp}/500`;
    this.redHouseHp.textContent = `🏠 ${game.world.houses.red.hp}/500`;

    // Zone hint
    let inZone = null;
    for (const z of RESTOCK_ZONES) {
      if (z.team && z.team !== p.team) continue;
      const dx = p.position.x - z.x, dz = p.position.z - z.z;
      if (dx*dx + dz*dz <= z.r*z.r) { inZone = z; break; }
    }
    if (inZone) {
      this.zoneHint.style.display = 'block';
      this.zoneHint.textContent = `🟢 ${inZone.label} — ammo refilled${inZone.team === p.team ? ' • press B to change weapon' : ''}`;
    } else {
      this.zoneHint.style.display = 'none';
    }

    // Respawn banner
    if (!p.alive && p.respawnIn > 0) {
      this.respawnBanner.style.display = 'block';
      this.respawnBanner.textContent = `You died — respawning in ${p.respawnIn.toFixed(1)}s`;
    } else {
      this.respawnBanner.style.display = 'none';
    }

    // Scope overlay during ADS w/ sniper
    if (s.ads && activeGunId(s) === 3) {
      this.scope.style.display = 'block';
      this.crosshair.style.display = 'none';
    } else {
      this.scope.style.display = 'none';
      this.crosshair.style.display = 'block';
    }
  }

  showEnd(winner) {
    this.endScreen.style.display = 'flex';
    this.endTitle.textContent = winner === 'blue' ? '🎉 Blue Wins!' : '💀 Red Wins!';
    this.endTitle.style.color = winner === 'blue' ? '#60a5fa' : '#f87171';
  }
}
