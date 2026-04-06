import * as THREE from 'three';
import { BLOCK, BLOCK_COLORS, BLOCK_DURABILITY, WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH,
         RED_ISLAND, BLUE_ISLAND, CENTER_ISLAND } from './constants.js';

const CHUNK_SIZE = 16;

export class VoxelWorld {
  constructor(scene) {
    this.scene = scene;
    this.width = WORLD_WIDTH;
    this.height = WORLD_HEIGHT;
    this.depth = WORLD_DEPTH;
    this.blocks = new Uint8Array(this.width * this.height * this.depth);
    this.blockDamage = {};

    // Chunk system
    this.chunksX = Math.ceil(this.width / CHUNK_SIZE);
    this.chunksY = Math.ceil(this.height / CHUNK_SIZE);
    this.chunksZ = Math.ceil(this.depth / CHUNK_SIZE);
    this.chunkMeshes = {}; // "cx,cy,cz" -> THREE.Group
    this.dirtyChunks = new Set();
    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);

    this.tempBridges = [];

    // Positions
    this.redBedPos = null;
    this.blueBedPos = null;
    this.redBedAlive = true;
    this.blueBedAlive = true;
    this.redSpawnerPos = null;
    this.blueSpawnerPos = null;
    this.redMerchantPos = null;
    this.blueMerchantPos = null;
    this.redCraftPos = null;
    this.blueCraftPos = null;
    this.centerResourcePositions = [];
    this.redSpawnPos = null;
    this.blueSpawnPos = null;
    this.zombieSpawnPositions = [];
  }

  index(x, y, z) {
    return x + z * this.width + y * this.width * this.depth;
  }

  getBlock(x, y, z) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height || z < 0 || z >= this.depth) return BLOCK.AIR;
    return this.blocks[this.index(x, y, z)];
  }

  setBlock(x, y, z, type) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height || z < 0 || z >= this.depth) return;
    this.blocks[this.index(x, y, z)] = type;
    // Mark this chunk and neighbors dirty
    this._markChunkDirty(x, y, z);
  }

  _markChunkDirty(x, y, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    this.dirtyChunks.add(`${cx},${cy},${cz}`);
    // Mark neighbor chunks if block is on edge
    if (x % CHUNK_SIZE === 0 && cx > 0) this.dirtyChunks.add(`${cx-1},${cy},${cz}`);
    if (x % CHUNK_SIZE === CHUNK_SIZE - 1 && cx < this.chunksX - 1) this.dirtyChunks.add(`${cx+1},${cy},${cz}`);
    if (y % CHUNK_SIZE === 0 && cy > 0) this.dirtyChunks.add(`${cx},${cy-1},${cz}`);
    if (y % CHUNK_SIZE === CHUNK_SIZE - 1 && cy < this.chunksY - 1) this.dirtyChunks.add(`${cx},${cy+1},${cz}`);
    if (z % CHUNK_SIZE === 0 && cz > 0) this.dirtyChunks.add(`${cx},${cy},${cz-1}`);
    if (z % CHUNK_SIZE === CHUNK_SIZE - 1 && cz < this.chunksZ - 1) this.dirtyChunks.add(`${cx},${cy},${cz+1}`);
  }

  isSolid(x, y, z) {
    return this.getBlock(x, y, z) !== BLOCK.AIR;
  }

  damageBlock(x, y, z, amount = 1) {
    const block = this.getBlock(x, y, z);
    if (block === BLOCK.AIR || block === BLOCK.BEDROCK) return false;

    const key = `${x},${y},${z}`;
    this.blockDamage[key] = (this.blockDamage[key] || 0) + amount;
    const maxHp = BLOCK_DURABILITY[block] || 5;

    if (this.blockDamage[key] >= maxHp) {
      if (block === BLOCK.BED_RED) this.redBedAlive = false;
      else if (block === BLOCK.BED_BLUE) this.blueBedAlive = false;
      this.setBlock(x, y, z, BLOCK.AIR);
      delete this.blockDamage[key];
      return true;
    }
    return false;
  }

  // ==================== MAP GENERATION ====================
  generateMap() {
    this._generateIsland(RED_ISLAND.cx, RED_ISLAND.cy, RED_ISLAND.cz, RED_ISLAND.size, 'red');
    this._generateIsland(BLUE_ISLAND.cx, BLUE_ISLAND.cy, BLUE_ISLAND.cz, BLUE_ISLAND.size, 'blue');
    this._generateCenterIsland();
    this._generateBridges();
    // Mark all chunks dirty for initial build
    for (let cx = 0; cx < this.chunksX; cx++)
      for (let cy = 0; cy < this.chunksY; cy++)
        for (let cz = 0; cz < this.chunksZ; cz++)
          this.dirtyChunks.add(`${cx},${cy},${cz}`);
  }

  _generateIsland(cx, cy, cz, size, team) {
    for (let x = cx - size; x <= cx + size; x++) {
      for (let z = cz - size; z <= cz + size; z++) {
        const dx = x - cx, dz = z - cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= size + 0.5) {
          this.blocks[this.index(x, cy, z)] = BLOCK.GRASS;
          for (let y = cy - 1; y >= cy - 3; y--) this.blocks[this.index(x, y, z)] = BLOCK.DIRT;
          this.blocks[this.index(x, cy - 4, z)] = BLOCK.BEDROCK;
        }
      }
    }

    const bedBlock = team === 'red' ? BLOCK.BED_RED : BLOCK.BED_BLUE;
    this.blocks[this.index(cx, cy + 1, cz)] = bedBlock;
    this.blocks[this.index(cx + 1, cy + 1, cz)] = bedBlock;
    if (team === 'red') this.redBedPos = { x: cx, y: cy + 1, z: cz };
    else this.blueBedPos = { x: cx, y: cy + 1, z: cz };

    const woolBlock = team === 'red' ? BLOCK.WOOL_RED : BLOCK.WOOL_BLUE;
    for (let dx = -1; dx <= 2; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx >= 0 && dx <= 1 && dz === 0) continue;
        this.blocks[this.index(cx + dx, cy + 1, cz + dz)] = woolBlock;
      }
    }

    const spawnerPos = { x: cx - 3, y: cy + 1, z: cz };
    if (team === 'red') this.redSpawnerPos = spawnerPos; else this.blueSpawnerPos = spawnerPos;
    this.blocks[this.index(spawnerPos.x, cy, spawnerPos.z)] = BLOCK.IRON_BLOCK;

    const merchantPos = { x: cx + 3, y: cy + 1, z: cz - 3 };
    if (team === 'red') this.redMerchantPos = merchantPos; else this.blueMerchantPos = merchantPos;

    const craftPos = { x: cx - 3, y: cy + 1, z: cz + 3 };
    this.blocks[this.index(craftPos.x, cy, craftPos.z)] = BLOCK.CRAFTING_TABLE;
    if (team === 'red') this.redCraftPos = { x: craftPos.x, y: cy + 1, z: craftPos.z };
    else this.blueCraftPos = { x: craftPos.x, y: cy + 1, z: craftPos.z };

    const spawnPos = { x: cx, y: cy + 1.01, z: cz + 3 };
    if (team === 'red') this.redSpawnPos = spawnPos; else this.blueSpawnPos = spawnPos;

    this._generateTree(cx + size - 2, cy + 1, cz + size - 2);
    this._generateTree(cx - size + 2, cy + 1, cz - size + 2);
  }

  _generateTree(x, y, z) {
    for (let dy = 0; dy < 4; dy++) this.blocks[this.index(x, y + dy, z)] = BLOCK.WOOD_LOG;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = 3; dy <= 5; dy++) {
          const dist = Math.abs(dx) + Math.abs(dz);
          if (dist <= 2 + (5 - dy) && !(dx === 0 && dz === 0 && dy < 4)) {
            if (Math.random() > 0.15) this.blocks[this.index(x + dx, y + dy, z + dz)] = BLOCK.LEAVES;
          }
        }
      }
    }
  }

  _generateCenterIsland() {
    const { cx, cy, cz, size } = CENTER_ISLAND;
    for (let x = cx - size; x <= cx + size; x++) {
      for (let z = cz - size; z <= cz + size; z++) {
        const dx = x - cx, dz = z - cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= size + 0.5) {
          const heightVar = Math.max(0, Math.floor(2 - dist * 0.15));
          this.blocks[this.index(x, cy + heightVar, z)] = BLOCK.GRASS;
          for (let y = cy + heightVar - 1; y >= cy - 3; y--)
            this.blocks[this.index(x, y, z)] = dist < size * 0.3 ? BLOCK.STONE : BLOCK.DIRT;
          this.blocks[this.index(x, cy - 4, z)] = BLOCK.BEDROCK;
        }
      }
    }
    this.centerResourcePositions = [
      { x: cx - 4, y: cy + 1, z: cz, type: 'diamond' },
      { x: cx + 4, y: cy + 1, z: cz, type: 'diamond' },
      { x: cx, y: cy + 1, z: cz - 4, type: 'gold' },
      { x: cx, y: cy + 1, z: cz + 4, type: 'gold' },
    ];

    // Item pickup positions (arrows, food scattered around the island — no bows)
    this.centerItemPositions = [
      { x: cx - 3, y: cy + 1, z: cz - 6, item: 'arrow' },
      { x: cx + 3, y: cy + 1, z: cz + 6, item: 'arrow' },
      { x: cx - 7, y: cy + 1, z: cz - 2, item: 'arrow' },
      { x: cx + 7, y: cy + 1, z: cz + 2, item: 'arrow' },
      { x: cx - 6, y: cy + 1, z: cz + 3, item: 'arrow' },
      { x: cx + 6, y: cy + 1, z: cz - 3, item: 'arrow' },
      { x: cx, y: cy + 1, z: cz + 7, item: 'bread' },
      { x: cx, y: cy + 1, z: cz - 7, item: 'bread' },
      { x: cx + 5, y: cy + 1, z: cz + 5, item: 'chicken' },
      { x: cx - 5, y: cy + 1, z: cz - 5, item: 'chicken' },
    ];
    this.blocks[this.index(cx - 4, cy, cz)] = BLOCK.DIAMOND_BLOCK;
    this.blocks[this.index(cx + 4, cy, cz)] = BLOCK.DIAMOND_BLOCK;
    this.blocks[this.index(cx, cy, cz - 4)] = BLOCK.GOLD_BLOCK;
    this.blocks[this.index(cx, cy, cz + 4)] = BLOCK.GOLD_BLOCK;

    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        this.blocks[this.index(cx + dx, cy + 1, cz + dz)] = BLOCK.STONE;
        if (Math.abs(dx) === 2 || Math.abs(dz) === 2)
          this.blocks[this.index(cx + dx, cy + 2, cz + dz)] = BLOCK.STONE;
      }
    }
    this._generateTree(cx + 8, cy + 1, cz + 6);
    this._generateTree(cx - 7, cy + 1, cz - 5);
    this._generateTree(cx + 6, cy + 1, cz - 8);

    this.zombieSpawnPositions = [
      { x: cx + 2, y: cy + 3, z: cz + 2 },
      { x: cx - 2, y: cy + 3, z: cz - 2 },
      { x: cx, y: cy + 3, z: cz },
    ];
  }

  // ==================== PRE-BUILT BRIDGES ====================
  _generateBridges() {
    // Three bridges connect each side island to the center island
    // Bridge Z positions
    const bridgeZs = [30, 25, 20]; // north, center, south
    const types = ['gaps', 'walls', 'corridor']; // obstacle types

    // Red side bridges: from red island edge (x≈23) to center island edge (x≈46)
    // Blue side bridges: from center island edge (x≈74) to blue island edge (x≈97)
    for (let i = 0; i < 3; i++) {
      this._generateBridge(23, 46, bridgeZs[i], types[i], 'left');   // red → center
      this._generateBridge(74, 97, bridgeZs[i], types[i], 'right');  // center → blue
    }

    // Store bridge Z coords for NPC pathfinding
    this.bridgeZPositions = bridgeZs;
  }

  _generateBridge(startX, endX, z, type, side) {
    // Height: side islands at y=15, center island at y=13
    // Transition smoothly across the bridge
    const length = endX - startX;
    const isLeftSide = side === 'left'; // red→center goes high→low, center→blue goes low→high

    for (let i = 0; i <= length; i++) {
      const x = startX + i;
      const progress = i / length; // 0 at start, 1 at end

      // Height transition: smooth step from island height to center height
      let y;
      if (isLeftSide) {
        // y=15 → y=13: descending toward center
        y = Math.round(15 - progress * 2);
      } else {
        // y=13 → y=15: ascending toward blue island
        y = Math.round(13 + progress * 2);
      }

      // Apply obstacle patterns
      let placeBridge = true;

      if (type === 'gaps') {
        // Gap bridge: 1-block gaps every 5 blocks (skip first and last 3 blocks for safe entry/exit)
        if (i > 3 && i < length - 3 && i % 5 === 3) {
          placeBridge = false; // gap
        }
      }

      if (placeBridge) {
        this.blocks[this.index(x, y, z)] = BLOCK.COBBLESTONE;
        // Support pillar underneath to make it look sturdy
        if (y > 10) {
          this.blocks[this.index(x, y - 1, z)] = BLOCK.STONE;
        }
      }

      // Obstacle decorations
      if (type === 'walls' && placeBridge) {
        // Wall bridge: 1-high stone walls every 6 blocks
        if (i > 2 && i < length - 2 && i % 6 === 3) {
          this.blocks[this.index(x, y + 1, z)] = BLOCK.COBBLESTONE;
        }
      }

      if (type === 'corridor' && placeBridge) {
        // Corridor bridge: walls on both sides in segments
        if (i > 4 && i < length - 4) {
          const segment = Math.floor(i / 8);
          if (segment % 2 === 0 && i % 8 < 5) {
            // Side walls creating narrow corridor
            this.blocks[this.index(x, y + 1, z - 1)] = BLOCK.COBBLESTONE;
            this.blocks[this.index(x, y + 1, z + 1)] = BLOCK.COBBLESTONE;
          }
        }
        // Place TNT traps at a few strategic spots
        if (i === Math.floor(length * 0.3) || i === Math.floor(length * 0.7)) {
          this.blocks[this.index(x, y + 1, z)] = BLOCK.TNT;
        }
      }
    }

    // Add railings/markers at bridge entry points
    this.blocks[this.index(startX, Math.round(isLeftSide ? 15 : 13) + 1, z - 1)] = BLOCK.WOOD_LOG;
    this.blocks[this.index(startX, Math.round(isLeftSide ? 15 : 13) + 1, z + 1)] = BLOCK.WOOD_LOG;
    this.blocks[this.index(endX, Math.round(isLeftSide ? 13 : 15) + 1, z - 1)] = BLOCK.WOOD_LOG;
    this.blocks[this.index(endX, Math.round(isLeftSide ? 13 : 15) + 1, z + 1)] = BLOCK.WOOD_LOG;
  }

  // ==================== TEMP BRIDGES / TNT ====================
  placeTempBridge(x, y, z, dirX, dirZ, length = 12) {
    const placed = [];
    const perpX = Math.abs(dirZ) > 0.5 ? 1 : 0;
    const perpZ = Math.abs(dirX) > 0.5 ? 1 : 0;
    for (let i = 0; i < length; i++) {
      const bx = Math.floor(x + dirX * i);
      const bz = Math.floor(z + dirZ * i);
      const by = Math.floor(y);
      for (let w = -1; w <= 1; w++) {
        const wx = bx + perpX * w, wz = bz + perpZ * w;
        if (this.getBlock(wx, by, wz) === BLOCK.AIR) {
          this.setBlock(wx, by, wz, BLOCK.BRIDGE_TEMP);
          placed.push({ x: wx, y: by, z: wz });
        }
      }
    }
    this.tempBridges.push({ blocks: placed, timer: 10 });
  }

  explodeTNT(cx, cy, cz, radius = 4) {
    const destroyed = [];
    for (let x = cx - radius; x <= cx + radius; x++) {
      for (let y = cy - radius; y <= cy + radius; y++) {
        for (let z = cz - radius; z <= cz + radius; z++) {
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2);
          if (dist <= radius) {
            const block = this.getBlock(x, y, z);
            if (block !== BLOCK.AIR && block !== BLOCK.BEDROCK) {
              if (block === BLOCK.BED_RED) this.redBedAlive = false;
              if (block === BLOCK.BED_BLUE) this.blueBedAlive = false;
              this.setBlock(x, y, z, BLOCK.AIR);
              destroyed.push({ x, y, z, block });
            }
          }
        }
      }
    }
    return destroyed;
  }

  update(dt) {
    for (let i = this.tempBridges.length - 1; i >= 0; i--) {
      this.tempBridges[i].timer -= dt;
      if (this.tempBridges[i].timer <= 0) {
        for (const pos of this.tempBridges[i].blocks) {
          if (this.getBlock(pos.x, pos.y, pos.z) === BLOCK.BRIDGE_TEMP)
            this.setBlock(pos.x, pos.y, pos.z, BLOCK.AIR);
        }
        this.tempBridges.splice(i, 1);
      }
    }
  }

  // ==================== CHUNK MESH SYSTEM ====================
  rebuildMesh() {
    if (this.dirtyChunks.size === 0) return;

    // Rebuild only dirty chunks (up to 4 per frame for smoothness)
    let rebuilt = 0;
    for (const key of this.dirtyChunks) {
      this._rebuildChunk(key);
      this.dirtyChunks.delete(key);
      rebuilt++;
      if (rebuilt >= 4) break;
    }
  }

  _rebuildChunk(key) {
    const [cx, cy, cz] = key.split(',').map(Number);

    // Remove old chunk mesh
    if (this.chunkMeshes[key]) {
      const oldGroup = this.chunkMeshes[key];
      oldGroup.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.meshGroup.remove(oldGroup);
      delete this.chunkMeshes[key];
    }

    // Build geometry for this chunk
    const geometries = {};
    const x0 = cx * CHUNK_SIZE, y0 = cy * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
    const x1 = Math.min(x0 + CHUNK_SIZE, this.width);
    const y1 = Math.min(y0 + CHUNK_SIZE, this.height);
    const z1 = Math.min(z0 + CHUNK_SIZE, this.depth);

    let hasBlocks = false;

    for (let y = y0; y < y1; y++) {
      for (let z = z0; z < z1; z++) {
        for (let x = x0; x < x1; x++) {
          const block = this.getBlock(x, y, z);
          if (block === BLOCK.AIR) continue;
          hasBlocks = true;

          const faces = [
            [1, 0, 0], [-1, 0, 0],
            [0, 1, 0], [0, -1, 0],
            [0, 0, 1], [0, 0, -1],
          ];

          for (const normal of faces) {
            if (!this.isSolid(x + normal[0], y + normal[1], z + normal[2])) {
              if (!geometries[block]) geometries[block] = { positions: [], normals: [], indices: [] };
              this._addFace(geometries[block], x, y, z, normal);
            }
          }
        }
      }
    }

    if (!hasBlocks) return;

    const group = new THREE.Group();
    for (const [blockType, geo] of Object.entries(geometries)) {
      if (geo.positions.length === 0) continue;

      const bufGeo = new THREE.BufferGeometry();
      bufGeo.setAttribute('position', new THREE.Float32BufferAttribute(geo.positions, 3));
      bufGeo.setAttribute('normal', new THREE.Float32BufferAttribute(geo.normals, 3));
      bufGeo.setIndex(geo.indices);

      const color = BLOCK_COLORS[blockType] || 0xff00ff;
      const bt = parseInt(blockType);
      const mat = new THREE.MeshLambertMaterial({
        color,
        transparent: bt === BLOCK.GLASS || bt === BLOCK.BRIDGE_TEMP,
        opacity: bt === BLOCK.GLASS ? 0.4 : bt === BLOCK.BRIDGE_TEMP ? 0.6 : 1.0,
      });

      group.add(new THREE.Mesh(bufGeo, mat));
    }

    this.meshGroup.add(group);
    this.chunkMeshes[key] = group;
  }

  _addFace(geo, x, y, z, normal) {
    const idx = geo.positions.length / 3;
    const [nx, ny, nz] = normal;
    let v;
    if (nx === 1) v = [[x+1,y,z],[x+1,y+1,z],[x+1,y+1,z+1],[x+1,y,z+1]];
    else if (nx === -1) v = [[x,y,z+1],[x,y+1,z+1],[x,y+1,z],[x,y,z]];
    else if (ny === 1) v = [[x,y+1,z],[x,y+1,z+1],[x+1,y+1,z+1],[x+1,y+1,z]];
    else if (ny === -1) v = [[x,y,z+1],[x,y,z],[x+1,y,z],[x+1,y,z+1]];
    else if (nz === 1) v = [[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1],[x,y,z+1]];
    else v = [[x,y,z],[x,y+1,z],[x+1,y+1,z],[x+1,y,z]];
    for (const vert of v) { geo.positions.push(...vert); geo.normals.push(nx, ny, nz); }
    geo.indices.push(idx, idx+1, idx+2, idx, idx+2, idx+3);
  }

  // ==================== RAYCAST ====================
  raycast(origin, direction, maxDist = 8) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const dx = direction.x, dy = direction.y, dz = direction.z;
    const stepX = dx >= 0 ? 1 : -1, stepY = dy >= 0 ? 1 : -1, stepZ = dz >= 0 ? 1 : -1;
    let tMaxX = dx !== 0 ? ((dx > 0 ? (x+1-origin.x) : (x-origin.x)) / dx) : Infinity;
    let tMaxY = dy !== 0 ? ((dy > 0 ? (y+1-origin.y) : (y-origin.y)) / dy) : Infinity;
    let tMaxZ = dz !== 0 ? ((dz > 0 ? (z+1-origin.z) : (z-origin.z)) / dz) : Infinity;
    const tDeltaX = dx !== 0 ? Math.abs(1/dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(1/dy) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(1/dz) : Infinity;
    let dist = 0, nx = 0, ny = 0, nz = 0;

    while (dist < maxDist) {
      const block = this.getBlock(x, y, z);
      if (block !== BLOCK.AIR) return { hit: true, x, y, z, nx, ny, nz, block };
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) { dist=tMaxX; x+=stepX; tMaxX+=tDeltaX; nx=-stepX; ny=0; nz=0; }
        else { dist=tMaxZ; z+=stepZ; tMaxZ+=tDeltaZ; nx=0; ny=0; nz=-stepZ; }
      } else {
        if (tMaxY < tMaxZ) { dist=tMaxY; y+=stepY; tMaxY+=tDeltaY; nx=0; ny=-stepY; nz=0; }
        else { dist=tMaxZ; z+=stepZ; tMaxZ+=tDeltaZ; nx=0; ny=0; nz=-stepZ; }
      }
    }
    return { hit: false };
  }

  getTopY(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    for (let y = this.height - 1; y >= 0; y--) { if (this.isSolid(x, y, z)) return y + 1; }
    return 0;
  }

  isWalkable(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    return this.isSolid(x, y-1, z) && !this.isSolid(x, y, z) && !this.isSolid(x, y+1, z);
  }
}
