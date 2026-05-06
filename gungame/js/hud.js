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
    this.blueKd = document.getElementById('hud-blue-kd');
    this.redKd = document.getElementById('hud-red-kd');
    this.endScreen = document.getElementById('end-screen');
    this.endTitle = document.getElementById('end-title');
    this.zoneHint = document.getElementById('hud-zone-hint');
    this.crosshair = document.getElementById('crosshair');
    this.scope = document.getElementById('scope');
    this.respawnBanner = document.getElementById('respawn-banner');

    // Create flag status overlay
    const flagDiv = document.createElement('div');
    flagDiv.id = 'hud-flag';
    flagDiv.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.6);padding:8px 16px;border-radius:8px;color:#fff;font-size:14px;display:none;pointer-events:none;';
    document.getElementById('hud').appendChild(flagDiv);
    this.flagStatus = flagDiv;
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

    // K/D stats
    let blueKills = p.kills, blueDeaths = p.deaths;
    let redKills = 0, redDeaths = 0;
    for (const b of game.bots) {
      if (b.team === 'blue') { blueKills += b.kills; blueDeaths += b.deaths; }
      else { redKills += b.kills; redDeaths += b.deaths; }
    }
    this.blueKd.textContent = `K/D: ${blueKills} / ${blueDeaths}`;
    this.redKd.textContent = `K/D: ${redKills} / ${redDeaths}`;

    // Flag status
    const fs = game.flagSystem;
    if (fs.carrier === p) {
      this.flagStatus.style.display = 'block';
      this.flagStatus.textContent = `🚩 Carrying ${fs.carriedEnemyTeam === 'red' ? 'Red' : 'Blue'} Flag — return to base!`;
      this.flagStatus.style.background = 'rgba(180,30,30,0.7)';
    } else if (fs.carrier) {
      this.flagStatus.style.display = 'block';
      const ct = fs.carrier.team === 'blue' ? 'Blue' : 'Red';
      this.flagStatus.textContent = `🚩 ${ct} team has your flag!`;
      this.flagStatus.style.background = 'rgba(180,30,30,0.7)';
    } else if (fs.droppedPos) {
      this.flagStatus.style.display = 'block';
      const dt = fs.droppedTeam === 'red' ? 'Red' : 'Blue';
      this.flagStatus.textContent = `🚩 ${dt} Flag dropped on the field!`;
      this.flagStatus.style.background = 'rgba(100,80,0,0.7)';
    } else {
      this.flagStatus.style.display = 'none';
    }

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
