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

  // Solids — walls are NOT climbable (otherwise bot auto-jump teleports over them);
  // roofs ARE climbable so bots reach the flag via the parkour platforms.
  const solids = [];
  for (const team of [TEAM_BLUE, TEAM_RED]) {
    for (const w of houses[team].walls) solids.push({ mesh: w.mesh, box: w.box, climbable: false });
    solids.push({ mesh: houses[team].roof, box: houses[team].roofBox, climbable: true });
  }

  // Cover crates (climbable)
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
  const crates = [
    [-8, 0, 2], [8, 0, 2], [-4, 8, 2], [4, -8, 2], [-12, -4, 2], [12, 4, 2],
    [3, 18, 1.5], [-3, -18, 1.5], [-18, 12, 2.5], [18, -12, 2.5],
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
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const wheelGeom = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 12);
    for (const wx of [-1.4, 1.4]) for (const wz of [-1.0, 1.0]) {
      const wh = new THREE.Mesh(wheelGeom, wheelMat);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(wx, 0.45, wz);
      carGroup.add(wh);
    }
    scene.add(carGroup);
    solids.push({ mesh: chassis, box: new THREE.Box3().setFromObject(chassis), climbable: true, isCar: true });
    solids.push({ mesh: cabin, box: new THREE.Box3().setFromObject(cabin), climbable: true, isCar: true });
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

  // Neutral buildings (shacks) with doors and windows
  const shackPositions = [
    { x: -22, z: 6,   color: 0x8b8b6b, w: 6,  h: 3.5, d: 5 },
    { x: 22,  z: -6,  color: 0x6b8b8b, w: 6,  h: 3.5, d: 5 },
    { x: -34, z: -12, color: 0xa8896b, w: 7,  h: 4.0, d: 6 },
    { x: 34,  z: 12,  color: 0x6ba889, w: 7,  h: 4.0, d: 6 },
    { x: -14, z: 28,  color: 0x896ba8, w: 5,  h: 3.0, d: 5 },
    { x: 14,  z: -28, color: 0xa86b89, w: 5,  h: 3.0, d: 5 },
    { x: 0,   z: 24,  color: 0x4f46e5, w: 9,  h: 4.5, d: 7 },
    { x: 0,   z: -24, color: 0xb91c1c, w: 9,  h: 4.5, d: 7 },
    { x: -42, z: 0,   color: 0x71717a, w: 8,  h: 4.0, d: 6 },
    { x: 42,  z: 0,   color: 0x71717a, w: 8,  h: 4.0, d: 6 },
  ];
  for (const sp of shackPositions) {
    makeShack(scene, sp, solids);
  }

  // Uneven terrain: a few low hills/ramps
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

  // Jump platforms to reach house roofs (parkour style)
  const platMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  for (const team of [TEAM_BLUE, TEAM_RED]) {
    const hp = HOUSE_POS[team];
    const sign = team === TEAM_BLUE ? 1 : -1;
    const baseZ = hp.z + sign * (HOUSE_SIZE.d / 2 + 0.5);
    // Two columns of platforms on each side of the back of the house
    for (const sideOffset of [-6, 6]) {
      const platX = hp.x + sideOffset;
      const heights = [1.4, 2.8, 4.4];
      const zOffsets = [2.0, 0.5, -1.5];
      for (let i = 0; i < heights.length; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 1.0), platMat);
        p.position.set(platX, heights[i], baseZ + sign * zOffsets[i]);
        scene.add(p);
        p.updateMatrixWorld(true);
        solids.push({ mesh: p, box: new THREE.Box3().setFromObject(p), climbable: true });
      }
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

function makeShack(scene, sp, solids) {
  const sw = sp.w, sh = sp.h, sd = sp.d;
  const wallMat = new THREE.MeshLambertMaterial({ color: sp.color });
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
  const glassMat = new THREE.MeshBasicMaterial({
    color: 0x88ccff, transparent: true, opacity: 0.18,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const addWall = (mesh) => {
    scene.add(mesh);
    solids.push({ mesh, box: new THREE.Box3().setFromObject(mesh), climbable: false });
  };

  // Front has a door opening
  const frontZ = sp.z - sd / 2;
  const doorW = 2.5, doorH = 2.4;
  const sideW = (sw - doorW) / 2;
  const fl = new THREE.Mesh(new THREE.BoxGeometry(sideW, sh, 0.3), wallMat);
  fl.position.set(sp.x - (doorW / 2 + sideW / 2), sh / 2, frontZ);
  addWall(fl);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(sideW, sh, 0.3), wallMat);
  fr.position.set(sp.x + (doorW / 2 + sideW / 2), sh / 2, frontZ);
  addWall(fr);
  const lintelH = sh - doorH;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, lintelH, 0.3), wallMat);
  lintel.position.set(sp.x, doorH + lintelH / 2, frontZ);
  addWall(lintel);

  // Door frame visuals
  const frameThick = 0.15;
  const dfLeft = new THREE.Mesh(new THREE.BoxGeometry(frameThick, doorH, frameThick), frameMat);
  dfLeft.position.set(sp.x - doorW / 2, doorH / 2, frontZ); scene.add(dfLeft);
  const dfRight = new THREE.Mesh(new THREE.BoxGeometry(frameThick, doorH, frameThick), frameMat);
  dfRight.position.set(sp.x + doorW / 2, doorH / 2, frontZ); scene.add(dfRight);
  const dfTop = new THREE.Mesh(new THREE.BoxGeometry(doorW + frameThick * 2, frameThick, frameThick), frameMat);
  dfTop.position.set(sp.x, doorH, frontZ); scene.add(dfTop);

  // Back wall (solid)
  const back = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.3), wallMat);
  back.position.set(sp.x, sh / 2, sp.z + sd / 2);
  addWall(back);

  // Side walls with windows
  const winW = 1.8, winH = 1.2, winBottom = 1.0;
  for (const side of ['left', 'right']) {
    const sideX = side === 'left' ? sp.x - sw / 2 : sp.x + sw / 2;
    const wallThick = 0.3;
    // Bottom solid strip
    const botStrip = new THREE.Mesh(new THREE.BoxGeometry(wallThick, winBottom, sd), wallMat);
    botStrip.position.set(sideX, winBottom / 2, sp.z);
    addWall(botStrip);
    // Top solid strip
    const topStripH = sh - (winBottom + winH);
    const topStrip = new THREE.Mesh(new THREE.BoxGeometry(wallThick, topStripH, sd), wallMat);
    topStrip.position.set(sideX, winBottom + winH + topStripH / 2, sp.z);
    addWall(topStrip);

    // Window edges and center pillar
    const pillarW = 0.8;
    const edgeSegD = (sd - winW * 2 - pillarW) / 2;
    if (edgeSegD > 0) {
      const leftSeg = new THREE.Mesh(new THREE.BoxGeometry(wallThick, winH, edgeSegD), wallMat);
      leftSeg.position.set(sideX, winBottom + winH / 2, sp.z - sd / 2 + edgeSegD / 2);
      addWall(leftSeg);

      const rightSeg = new THREE.Mesh(new THREE.BoxGeometry(wallThick, winH, edgeSegD), wallMat);
      rightSeg.position.set(sideX, winBottom + winH / 2, sp.z + sd / 2 - edgeSegD / 2);
      addWall(rightSeg);
    }
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(wallThick, winH, pillarW), wallMat);
    pillar.position.set(sideX, winBottom + winH / 2, sp.z);
    addWall(pillar);

    // Glass panes — thin planes for clear see-through
    for (const offset of [-winW / 2 - pillarW / 2, winW / 2 + pillarW / 2]) {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glassMat);
      glass.position.set(sideX, winBottom + winH / 2, sp.z + offset);
      glass.rotation.y = Math.PI / 2;
      glass.renderOrder = 1;
      scene.add(glass);
    }
  }

  // Roof — climbable so bots and players can stand on it
  const roof = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.6, 0.3, sd + 0.6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  roof.position.set(sp.x, sh + 0.15, sp.z);
  scene.add(roof);
  solids.push({ mesh: roof, box: new THREE.Box3().setFromObject(roof), climbable: true });
}

function makeHouse(scene, team) {
  const pos = HOUSE_POS[team];
  const color = TEAM_COLOR[team];
  const group = new THREE.Group();
  group.position.set(pos.x, 0, pos.z);

  const wallMat = new THREE.MeshLambertMaterial({ color });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
  // Highly transparent glass: thin plane + depthWrite off so you can clearly see through.
  const glassMat = new THREE.MeshBasicMaterial({
    color: 0x88ccff, transparent: true, opacity: 0.18,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const w = HOUSE_SIZE.w, h = HOUSE_SIZE.h, d = HOUSE_SIZE.d;
  const t = 0.5;
  const walls = [];

  function addWall(mesh) {
    group.add(mesh);
    walls.push({ mesh });
  }

  // Back wall (solid)
  const backZ = team === TEAM_BLUE ? d / 2 : -d / 2;
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), wallMat);
  back.position.set(0, h / 2, backZ);
  addWall(back);

  // Front wall with door opening
  const frontZ = team === TEAM_BLUE ? -d / 2 : d / 2;
  const doorW = 4, doorH = 3.0;
  const sideW = (w - doorW) / 2;
  const fl = new THREE.Mesh(new THREE.BoxGeometry(sideW, h, t), wallMat);
  fl.position.set(-(doorW / 2 + sideW / 2), h / 2, frontZ);
  addWall(fl);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(sideW, h, t), wallMat);
  fr.position.set((doorW / 2 + sideW / 2), h / 2, frontZ);
  addWall(fr);
  const lintelH = h - doorH;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, lintelH, t), wallMat);
  lintel.position.set(0, doorH + lintelH / 2, frontZ);
  addWall(lintel);

  // Door frame visuals
  const frameThick = 0.15;
  const dfLeft = new THREE.Mesh(new THREE.BoxGeometry(frameThick, doorH, frameThick), frameMat);
  dfLeft.position.set(-doorW / 2, doorH / 2, frontZ);
  group.add(dfLeft);
  const dfRight = new THREE.Mesh(new THREE.BoxGeometry(frameThick, doorH, frameThick), frameMat);
  dfRight.position.set(doorW / 2, doorH / 2, frontZ);
  group.add(dfRight);
  const dfTop = new THREE.Mesh(new THREE.BoxGeometry(doorW + frameThick * 2, frameThick, frameThick), frameMat);
  dfTop.position.set(0, doorH, frontZ);
  group.add(dfTop);

  // Side walls with windows — sized to fit shorter house
  const winW = 3, winH = 1.4, winBottom = 1.0;
  const winZCenters = [-3.5, 3.5];

  for (const side of ['left', 'right']) {
    const sideX = side === 'left' ? -w / 2 : w / 2;
    const wallThick = t;
    const botStrip = new THREE.Mesh(new THREE.BoxGeometry(wallThick, winBottom, d), wallMat);
    botStrip.position.set(sideX, winBottom / 2, 0);
    addWall(botStrip);
    const topStripH = h - (winBottom + winH);
    const topStrip = new THREE.Mesh(new THREE.BoxGeometry(wallThick, topStripH, d), wallMat);
    topStrip.position.set(sideX, winBottom + winH + topStripH / 2, 0);
    addWall(topStrip);

    const edgeZ = [-d / 2, -1, 1, d / 2];
    for (let i = 0; i < edgeZ.length - 1; i++) {
      const zStart = edgeZ[i], zEnd = edgeZ[i + 1];
      const segD = zEnd - zStart;
      const segZ = (zStart + zEnd) / 2;
      if (Math.abs(segZ) < 0.1) continue;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(wallThick, winH, segD), wallMat);
      seg.position.set(sideX, winBottom + winH / 2, segZ);
      addWall(seg);
    }
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(wallThick, winH, 2), wallMat);
    pillar.position.set(sideX, winBottom + winH / 2, 0);
    addWall(pillar);

    for (const wz of winZCenters) {
      // Use a thin plane for the glass so transparency reads clearly (no double-face stacking).
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glassMat);
      glass.position.set(sideX, winBottom + winH / 2, wz);
      glass.rotation.y = Math.PI / 2;
      glass.renderOrder = 1;
      group.add(glass);
      const wfTop = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 0.1, 0.1, winW + 0.2), frameMat);
      wfTop.position.set(sideX, winBottom + winH, wz); group.add(wfTop);
      const wfBot = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 0.1, 0.1, winW + 0.2), frameMat);
      wfBot.position.set(sideX, winBottom, wz); group.add(wfBot);
      const wfL = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 0.1, winH, 0.1), frameMat);
      wfL.position.set(sideX, winBottom + winH / 2, wz - winW / 2); group.add(wfL);
      const wfR = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 0.1, winH, 0.1), frameMat);
      wfR.position.set(sideX, winBottom + winH / 2, wz + winW / 2); group.add(wfR);
    }
  }

  // Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.5, d + 1), roofMat);
  roof.position.set(0, h + 0.25, 0);
  group.add(roof);

  // Flag pole on roof
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  pole.position.set(0, h + 2.5 + 0.5, 0);
  group.add(pole);

  scene.add(group);
  // Force-resolve world matrices BEFORE computing collision boxes — three.js r160's
  // Box3.setFromObject calls updateWorldMatrix(false, false), which does NOT walk up
  // to refresh the parent group's matrixWorld. Without this, all wall boxes end up at
  // the local-space position (group offset ignored) and the player walks straight
  // through the house.
  group.updateMatrixWorld(true);

  for (const wRec of walls) {
    wRec.box = new THREE.Box3().setFromObject(wRec.mesh);
  }
  const roofBox = new THREE.Box3().setFromObject(roof);

  const house = {
    team, group, walls, roof, roofBox, pos, pole,
    ladders: [],
    hp: HOUSE_HP, maxHp: HOUSE_HP,
    onDestroyed() { group.visible = false; },
    damage(d) {
      this.hp = Math.max(0, this.hp - d);
      if (this.hp === 0) this.onDestroyed();
    },
  };
  return house;
}
