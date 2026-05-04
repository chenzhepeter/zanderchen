import * as THREE from 'three';
import { MAP_SIZE, HOUSE_POS, HOUSE_SIZE, HOUSE_HP, TEAM_BLUE, TEAM_RED, TEAM_COLOR, RESTOCK_ZONES } from './constants.js';

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 70, 180);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2),
    new THREE.MeshLambertMaterial({ color: 0x4ade80 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Lights
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(20, 40, 20);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const houses = {
    [TEAM_BLUE]: makeHouse(scene, TEAM_BLUE),
    [TEAM_RED]:  makeHouse(scene, TEAM_RED),
  };

  // Solids: world geometry the player can stand on AND collide with.
  // Each entry: { mesh, box, climbable }  climbable=true means player can stand on top.
  const solids = [];
  // Houses are climbable (roofs reachable via ramps)
  for (const team of [TEAM_BLUE, TEAM_RED]) {
    for (const w of houses[team].walls) solids.push({ mesh: w.mesh, box: w.box, climbable: true });
    // Roof slab is climbable
    solids.push({ mesh: houses[team].roof, box: new THREE.Box3().setFromObject(houses[team].roof), climbable: true });
  }

  // Cover crates (climbable)
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
  const crates = [
    [-8, 0, 2], [8, 0, 2], [-4, 8, 2], [4, -8, 2], [-12, -4, 2], [12, 4, 2],
    [0, 18, 1.5], [0, -18, 1.5], [-18, 12, 2.5], [18, -12, 2.5],
    [-25, 0, 2], [25, 0, 2], [-32, 22, 2], [32, -22, 2], [10, 30, 2],
    [-10, -30, 2], [22, 40, 2], [-22, -40, 2], [40, 8, 2], [-40, -8, 2],
  ];
  for (const [x, z, h] of crates) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), crateMat);
    c.position.set(x, h / 2, z);
    scene.add(c);
    solids.push({ mesh: c, box: new THREE.Box3().setFromObject(c), climbable: true });
  }

  // Cars (two boxes stacked: chassis + cabin)
  const cars = [
    { x: -10, z: 14, rot: 0.3, color: 0x444b8a },
    { x: 12, z: -14, rot: -0.4, color: 0x8a4444 },
    { x: -16, z: -8, rot: 1.0, color: 0x556b2f },
    { x: 18, z: 22, rot: 0.7, color: 0xb45309 },
    { x: -22, z: -18, rot: -0.6, color: 0x4c1d95 },
    { x: 28, z: 10, rot: 0.0, color: 0x0f766e },
    { x: -30, z: 30, rot: 1.4, color: 0x9d174d },
    { x: 6, z: -38, rot: 0.2, color: 0x1d4ed8 },
    { x: -6, z: 38, rot: -0.2, color: 0xdc2626 },
    { x: 36, z: -32, rot: 1.1, color: 0x65a30d },
    { x: -36, z: 32, rot: -1.1, color: 0xea580c },
    { x: 0, z: 48, rot: 0.0, color: 0x334155 },
    { x: 0, z: -48, rot: Math.PI, color: 0x334155 },
  ];
  for (const c of cars) {
    const carGroup = new THREE.Group();
    carGroup.position.set(c.x, 0, c.z);
    carGroup.rotation.y = c.rot;
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(4, 1.0, 2), new THREE.MeshLambertMaterial({ color: c.color }));
    chassis.position.y = 0.7;
    carGroup.add(chassis);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.8), new THREE.MeshLambertMaterial({ color: c.color }));
    cabin.position.set(-0.2, 1.65, 0);
    carGroup.add(cabin);
    // Wheels
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const wheelGeom = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 12);
    for (const wx of [-1.4, 1.4]) for (const wz of [-1.0, 1.0]) {
      const wh = new THREE.Mesh(wheelGeom, wheelMat);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(wx, 0.45, wz);
      carGroup.add(wh);
    }
    scene.add(carGroup);
    // Use the cabin top as a climbable surface; collide with chassis box
    solids.push({ mesh: chassis, box: new THREE.Box3().setFromObject(chassis), climbable: true });
    solids.push({ mesh: cabin, box: new THREE.Box3().setFromObject(cabin), climbable: true });
  }

  // Standalone wheel obstacles
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const [x, z] of [[3, 4], [-3, -4], [9, -2], [-9, 2], [20, 36], [-20, -36], [38, -18], [-38, 18]]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 16), wheelMat);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(x, 0.7, z);
    scene.add(wh);
    solids.push({ mesh: wh, box: new THREE.Box3().setFromObject(wh), climbable: true });
  }

  // Neutral buildings (shacks) the player can enter / climb. Mix of sizes.
  const shackPositions = [
    { x: -22, z: 6,   color: 0x8b8b6b, w: 6,  h: 3.5, d: 5 },
    { x: 22,  z: -6,  color: 0x6b8b8b, w: 6,  h: 3.5, d: 5 },
    { x: -34, z: -12, color: 0xa8896b, w: 7,  h: 4.0, d: 6 },
    { x: 34,  z: 12,  color: 0x6ba889, w: 7,  h: 4.0, d: 6 },
    { x: -14, z: 28,  color: 0x896ba8, w: 5,  h: 3.0, d: 5 },
    { x: 14,  z: -28, color: 0xa86b89, w: 5,  h: 3.0, d: 5 },
    { x: 0,   z: 22,  color: 0x4f46e5, w: 9,  h: 4.5, d: 7 }, // big middle-blue side
    { x: 0,   z: -22, color: 0xb91c1c, w: 9,  h: 4.5, d: 7 }, // big middle-red side
    { x: -42, z: 0,   color: 0x71717a, w: 8,  h: 4.0, d: 6 },
    { x: 42,  z: 0,   color: 0x71717a, w: 8,  h: 4.0, d: 6 },
  ];
  for (const sp of shackPositions) {
    const sw = sp.w, sh = sp.h, sd = sp.d;
    const wallMat = new THREE.MeshLambertMaterial({ color: sp.color });
    const back  = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.3), wallMat); back.position.set(sp.x, sh/2, sp.z + sd/2); scene.add(back);
    const left  = new THREE.Mesh(new THREE.BoxGeometry(0.3, sh, sd), wallMat); left.position.set(sp.x - sw/2, sh/2, sp.z); scene.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.3, sh, sd), wallMat); right.position.set(sp.x + sw/2, sh/2, sp.z); scene.add(right);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(sw, 1, 0.3), wallMat); lintel.position.set(sp.x, sh - 0.5, sp.z - sd/2); scene.add(lintel);
    const roof  = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.6, 0.3, sd + 0.6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    roof.position.set(sp.x, sh + 0.15, sp.z); scene.add(roof);
    for (const m of [back, left, right, lintel, roof]) {
      solids.push({ mesh: m, box: new THREE.Box3().setFromObject(m), climbable: true });
    }
  }

  // Uneven terrain: a few low hills/ramps you can walk over
  const dirtMat = new THREE.MeshLambertMaterial({ color: 0x7c5a3a });
  const ramps = [
    { x: -6, z: -16, w: 5, h: 1.0, d: 6 },
    { x: 6,  z:  16, w: 5, h: 1.2, d: 6 },
    { x: 14, z:  4,  w: 4, h: 0.8, d: 4 },
    { x: -14, z: -4, w: 4, h: 0.8, d: 4 },
    { x: 26, z: 28,  w: 6, h: 1.4, d: 8 },
    { x: -26, z: -28, w: 6, h: 1.4, d: 8 },
    { x: 44, z: -10, w: 5, h: 1.0, d: 6 },
    { x: -44, z: 10,  w: 5, h: 1.0, d: 6 },
  ];
  for (const r of ramps) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(r.w, r.h, r.d), dirtMat);
    m.position.set(r.x, r.h / 2, r.z);
    scene.add(m);
    solids.push({ mesh: m, box: new THREE.Box3().setFromObject(m), climbable: true });
  }
  // Staircases from ground up to the houses' roofs (so you can climb on top).
  // Roof top is at HOUSE_SIZE.h + 0.5 (≈7.5). We build 5 steps of ~1.4m each
  // along the outside wall — each step is short enough to walk up (step-up=1.6).
  const stepMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  for (const team of [TEAM_BLUE, TEAM_RED]) {
    const hp = HOUSE_POS[team];
    const sign = team === TEAM_BLUE ? 1 : -1; // stairs on the OUTER (back) side of each house
    const baseZ = hp.z + sign * (HOUSE_SIZE.d / 2 + 0.5); // hugs the back wall
    const steps = 5;
    const stepDepth = 1.6;
    const stepHeight = (HOUSE_SIZE.h + 0.5) / steps; // ~1.5 — within step-up tolerance
    const stepWidth = 4;
    for (let i = 0; i < steps; i++) {
      const top = (i + 1) * stepHeight;
      const m = new THREE.Mesh(new THREE.BoxGeometry(stepWidth, top, stepDepth), stepMat);
      m.position.set(hp.x + 6, top / 2, baseZ + sign * (i * stepDepth));
      scene.add(m);
      solids.push({ mesh: m, box: new THREE.Box3().setFromObject(m), climbable: true });
    }
  }

  // Restock pads (visual)
  const restockMarkers = [];
  for (const z of RESTOCK_ZONES) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(z.r, z.r, 0.05, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x22ee22, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.position.set(z.x, 0.05, z.z);
    scene.add(ring);
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(z.r, 24),
      new THREE.MeshBasicMaterial({ color: 0x22ee22, transparent: true, opacity: 0.18 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(z.x, 0.02, z.z);
    scene.add(pad);
    restockMarkers.push(pad);
  }

  return { houses, solids, ground, restockMarkers };
}

function makeHouse(scene, team) {
  const pos = HOUSE_POS[team];
  const color = TEAM_COLOR[team];
  const group = new THREE.Group();
  group.position.set(pos.x, 0, pos.z);

  const wallMat = new THREE.MeshLambertMaterial({ color });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const w = HOUSE_SIZE.w, h = HOUSE_SIZE.h, d = HOUSE_SIZE.d;
  const t = 0.5;

  const backZ = team === TEAM_BLUE ? d / 2 : -d / 2;
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), wallMat);
  back.position.set(0, h / 2, backZ);
  group.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), wallMat);
  left.position.set(-w / 2, h / 2, 0); group.add(left);
  const right = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), wallMat);
  right.position.set(w / 2, h / 2, 0); group.add(right);

  const frontZ = team === TEAM_BLUE ? -d / 2 : d / 2;
  const doorW = 4;
  const sideW = (w - doorW) / 2;
  const fl = new THREE.Mesh(new THREE.BoxGeometry(sideW, h, t), wallMat);
  fl.position.set(-(doorW / 2 + sideW / 2), h / 2, frontZ); group.add(fl);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(sideW, h, t), wallMat);
  fr.position.set((doorW / 2 + sideW / 2), h / 2, frontZ); group.add(fr);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, h - 3.2, t), wallMat);
  lintel.position.set(0, h - (h - 3.2) / 2, frontZ); group.add(lintel);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.5, d + 1), roofMat);
  roof.position.set(0, h + 0.25, 0); group.add(roof);

  // Flag
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  pole.position.set(0, h + 2.5 + 0.5, 0); group.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.2), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  flag.position.set(1, h + 4, 0); group.add(flag);

  scene.add(group);

  const wallMeshes = [back, left, right, fl, fr, lintel];
  const walls = wallMeshes.map(m => ({ mesh: m, box: new THREE.Box3().setFromObject(m) }));

  const house = {
    team, group, walls, roof, pos, flag, pole,
    hp: HOUSE_HP, maxHp: HOUSE_HP,
    onDestroyed() { group.visible = false; },
    damage(d) {
      this.hp = Math.max(0, this.hp - d);
      const ratio = this.hp / this.maxHp;
      flag.scale.setScalar(0.3 + 0.7 * ratio);
      if (this.hp === 0) this.onDestroyed();
    },
  };
  return house;
}
