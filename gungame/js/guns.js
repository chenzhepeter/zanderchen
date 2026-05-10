import * as THREE from 'three';
import { GUNS } from './constants.js';

export function makeGunMesh(gunId) {
  const g = GUNS[gunId];
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.18 * g.scale, 0.16 * g.scale, 0.7 * g.scale),
    new THREE.MeshLambertMaterial({ color: g.color })
  );
  body.position.set(0.25, -0.25, -0.5);
  group.add(body);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04 * g.scale, 0.04 * g.scale, 0.6 * g.scale),
    new THREE.MeshLambertMaterial({ color: 0x222222 })
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.25, -0.22, -0.85 - 0.15 * g.scale);
  group.add(barrel);
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.25, 0.14),
    new THREE.MeshLambertMaterial({ color: 0x333333 })
  );
  grip.position.set(0.25, -0.42, -0.35);
  group.add(grip);
  return group;
}

export function makeMuzzleFlash(scene, gunId, position, direction) {
  const g = GUNS[gunId];
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.18 + 0.06 * g.scale, 6, 6),
    new THREE.MeshBasicMaterial({ color: g.color, transparent: true, opacity: 0.9 })
  );
  flash.position.copy(position);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 60);
  const tracerGeom = new THREE.BufferGeometry().setFromPoints([
    position.clone(),
    position.clone().add(direction.clone().multiplyScalar(0.6 + 0.4 * g.scale)),
  ]);
  const tracer = new THREE.Line(tracerGeom, new THREE.LineBasicMaterial({ color: g.color }));
  scene.add(tracer);
  setTimeout(() => scene.remove(tracer), 70);
}

// Loadout has exactly 2 guns: pistol (slot 0) + main (slot 1).
// State tracks ammo in current mag AND reserve magazines per slot.
export function makeShooter(mainGunId) {
  const slots = [0, mainGunId]; // slot 0 = pistol, slot 1 = main
  return {
    slots,
    activeSlot: 1,
    ammo:    slots.map(id => GUNS[id].mag),
    reserve: slots.map(id => Math.max(0, GUNS[id].magsAtSpawn - 1)), // current mag is loaded; rest in reserve
    fireCooldown: 0,
    reloading: 0,
    ads: false,
  };
}

export function activeGunId(s)  { return s.slots[s.activeSlot]; }
export function activeGun(s)    { return GUNS[activeGunId(s)]; }

export function tickShooter(s, dt) {
  if (s.fireCooldown > 0) s.fireCooldown -= dt;
  if (s.reloading > 0) {
    s.reloading -= dt;
    if (s.reloading <= 0) {
      s.reloading = 0;
      // Consume one whole reserve mag (drop-mag style — partial ammo is discarded).
      if (s.reserve[s.activeSlot] > 0) {
        s.reserve[s.activeSlot] -= 1;
        s.ammo[s.activeSlot] = activeGun(s).mag;
      }
    }
  }
}

export function canShoot(s) {
  return s.fireCooldown <= 0 && s.reloading <= 0 && s.ammo[s.activeSlot] > 0;
}

export function startReload(s) {
  if (s.reloading > 0) return false;
  if (s.reserve[s.activeSlot] <= 0) return false;
  if (s.ammo[s.activeSlot] === activeGun(s).mag) return false;
  s.reloading = activeGun(s).reload;
  return true;
}

export function consumeShot(s) {
  s.ammo[s.activeSlot] -= 1;
  s.fireCooldown = activeGun(s).fireDelay;
  if (s.ammo[s.activeSlot] <= 0 && s.reserve[s.activeSlot] > 0) {
    s.reloading = activeGun(s).reload;
  }
}

export function switchSlot(s, slot) {
  if (slot < 0 || slot >= s.slots.length) return;
  if (slot === s.activeSlot) return;
  s.reloading = 0;
  s.activeSlot = slot;
  s.ads = false;
}

// Restock fills reserves up to spawn amount and tops off current mag
export function restock(s) {
  let changed = false;
  for (let i = 0; i < s.slots.length; i++) {
    const g = GUNS[s.slots[i]];
    if (s.reserve[i] < g.magsAtSpawn - 1) { s.reserve[i] = g.magsAtSpawn - 1; changed = true; }
    if (s.ammo[i] < g.mag) { s.ammo[i] = g.mag; changed = true; }
  }
  return changed;
}

// Replace the main weapon (slot 1) with a new gun id, full ammo.
export function setMainGun(s, gunId) {
  s.slots[1] = gunId;
  s.ammo[1] = GUNS[gunId].mag;
  s.reserve[1] = Math.max(0, GUNS[gunId].magsAtSpawn - 1);
  s.activeSlot = 1;
  s.reloading = 0;
  s.ads = false;
}
