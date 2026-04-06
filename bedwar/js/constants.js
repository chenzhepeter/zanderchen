// ==================== GAME CONSTANTS ====================

// World dimensions
export const WORLD_WIDTH = 120;  // X axis
export const WORLD_HEIGHT = 40;  // Y axis
export const WORLD_DEPTH = 50;   // Z axis

// Island positions (center X, base Y, center Z)
export const RED_ISLAND = { cx: 15, cy: 15, cz: 25, size: 8 };
export const BLUE_ISLAND = { cx: 105, cy: 15, cz: 25, size: 8 };
export const CENTER_ISLAND = { cx: 60, cy: 13, cz: 25, size: 14 };

// Block types
export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD_PLANK: 4,
  WOOL_RED: 5,
  WOOL_BLUE: 6,
  WOOL_WHITE: 7,
  COBBLESTONE: 8,
  BED_RED: 9,
  BED_BLUE: 10,
  SAND: 11,
  WOOD_LOG: 12,
  LEAVES: 13,
  GLASS: 14,
  IRON_BLOCK: 15,
  DIAMOND_BLOCK: 16,
  GOLD_BLOCK: 17,
  CRAFTING_TABLE: 18,
  BRIDGE_TEMP: 19, // temporary bridge egg blocks
  TNT: 20,
  BEDROCK: 21,
};

// Block colors
export const BLOCK_COLORS = {
  [BLOCK.GRASS]: 0x5d9e3c,
  [BLOCK.DIRT]: 0x8b6b3d,
  [BLOCK.STONE]: 0x888888,
  [BLOCK.WOOD_PLANK]: 0xc4a46c,
  [BLOCK.WOOL_RED]: 0xcc3333,
  [BLOCK.WOOL_BLUE]: 0x3355cc,
  [BLOCK.WOOL_WHITE]: 0xeeeeee,
  [BLOCK.COBBLESTONE]: 0x777777,
  [BLOCK.BED_RED]: 0xff2222,
  [BLOCK.BED_BLUE]: 0x2244ff,
  [BLOCK.SAND]: 0xdbc67b,
  [BLOCK.WOOD_LOG]: 0x6b4226,
  [BLOCK.LEAVES]: 0x2d7a2d,
  [BLOCK.GLASS]: 0xaaddff,
  [BLOCK.IRON_BLOCK]: 0xcccccc,
  [BLOCK.DIAMOND_BLOCK]: 0x44ffee,
  [BLOCK.GOLD_BLOCK]: 0xffd700,
  [BLOCK.CRAFTING_TABLE]: 0x8b5e3c,
  [BLOCK.BRIDGE_TEMP]: 0xffff88,
  [BLOCK.TNT]: 0xff4444,
  [BLOCK.BEDROCK]: 0x333333,
};

// Block durability (hits to break)
export const BLOCK_DURABILITY = {
  [BLOCK.GRASS]: 3,
  [BLOCK.DIRT]: 3,
  [BLOCK.STONE]: 8,
  [BLOCK.WOOD_PLANK]: 5,
  [BLOCK.WOOL_RED]: 2,
  [BLOCK.WOOL_BLUE]: 2,
  [BLOCK.WOOL_WHITE]: 2,
  [BLOCK.COBBLESTONE]: 10,
  [BLOCK.BED_RED]: 15,
  [BLOCK.BED_BLUE]: 15,
  [BLOCK.SAND]: 2,
  [BLOCK.WOOD_LOG]: 6,
  [BLOCK.LEAVES]: 1,
  [BLOCK.GLASS]: 1,
  [BLOCK.IRON_BLOCK]: 12,
  [BLOCK.DIAMOND_BLOCK]: 15,
  [BLOCK.GOLD_BLOCK]: 12,
  [BLOCK.CRAFTING_TABLE]: 5,
  [BLOCK.BRIDGE_TEMP]: 1,
  [BLOCK.TNT]: 1,
  [BLOCK.BEDROCK]: 999,
};

// Item definitions
export const ITEMS = {
  // Weapons
  WOOD_SWORD: { id: 'wood_sword', name: '木剑', icon: '🗡️', type: 'weapon', damage: 3, color: 0xc4a46c },
  STONE_SWORD: { id: 'stone_sword', name: '石剑', icon: '⚔️', type: 'weapon', damage: 5, color: 0x888888 },
  IRON_SWORD: { id: 'iron_sword', name: '铁剑', icon: '🗡️', type: 'weapon', damage: 7, color: 0xcccccc },
  DIAMOND_SWORD: { id: 'diamond_sword', name: '钻石剑', icon: '⚔️', type: 'weapon', damage: 10, color: 0x44ffee },
  BOW: { id: 'bow', name: '弓', icon: '🏹', type: 'bow', damage: 5 },
  ARROW: { id: 'arrow', name: '箭矢', icon: '➶', type: 'ammo', stackable: true, maxStack: 64 },
  SLINGSHOT: { id: 'slingshot', name: '弹弓', icon: '🎯', type: 'weapon', damage: 2, knockback: 2 },

  // Armor
  LEATHER_ARMOR: { id: 'leather_armor', name: '皮甲', icon: '🦺', type: 'armor', armor: 2 },
  CHAIN_ARMOR: { id: 'chain_armor', name: '锁子甲', icon: '🛡️', type: 'armor', armor: 5 },
  DIAMOND_ARMOR: { id: 'diamond_armor', name: '钻石甲', icon: '💎', type: 'armor', armor: 8 },

  // Food
  BREAD: { id: 'bread', name: '面包', icon: '🍞', type: 'food', hunger: 4, stackable: true, maxStack: 16 },
  CHICKEN: { id: 'chicken', name: '烤鸡', icon: '🍗', type: 'food', hunger: 8, stackable: true, maxStack: 16 },
  GOLDEN_APPLE: { id: 'golden_apple', name: '金苹果', icon: '🍎', type: 'food', hunger: 20, healAll: true, invincible: 5, stackable: true, maxStack: 4 },

  // Blocks
  WOOL: { id: 'wool', name: '羊毛', icon: '🧱', type: 'block', blockType: BLOCK.WOOL_WHITE, stackable: true, maxStack: 64 },
  PLANKS: { id: 'planks', name: '木板', icon: '🪵', type: 'block', blockType: BLOCK.WOOD_PLANK, stackable: true, maxStack: 64 },
  COBBLE: { id: 'cobble', name: '圆石', icon: '🪨', type: 'block', blockType: BLOCK.COBBLESTONE, stackable: true, maxStack: 64 },
  TNT_ITEM: { id: 'tnt', name: 'TNT', icon: '🧨', type: 'tnt', stackable: true, maxStack: 4 },
  BRIDGE_EGG: { id: 'bridge_egg', name: '搭桥蛋', icon: '🥚', type: 'bridge_egg', stackable: true, maxStack: 4 },

  // Potions
  SPEED_POTION: { id: 'speed_potion', name: '速度药水', icon: '🧪', type: 'potion', effect: 'speed', duration: 15 },
  JUMP_POTION: { id: 'jump_potion', name: '跳跃药水', icon: '🧪', type: 'potion', effect: 'jump', duration: 15 },
  INVIS_POTION: { id: 'invis_potion', name: '隐身药水', icon: '🧪', type: 'potion', effect: 'invisible', duration: 10 },

  // Crafting materials
  STICK: { id: 'stick', name: '木棍', icon: '/', type: 'material', stackable: true, maxStack: 64 },
  STONE_MAT: { id: 'stone_mat', name: '石头', icon: '�ite', type: 'material', stackable: true, maxStack: 64 },
  WOOD_SHIELD: { id: 'wood_shield', name: '木盾', icon: '🛡️', type: 'shield', blockChance: 0.5 },
  LADDER: { id: 'ladder', name: '梯子', icon: '🪜', type: 'block', blockType: BLOCK.WOOD_PLANK, stackable: true, maxStack: 16 },
  CAMPFIRE: { id: 'campfire', name: '篝火', icon: '🔥', type: 'placeable', stackable: true, maxStack: 4 },
};

// Currency types
export const CURRENCY = {
  COPPER: { id: 'copper', name: '铜币', icon: '🪙', color: '#cd7f32' },
  IRON: { id: 'iron', name: '铁锭', icon: '⬜', color: '#cccccc' },
  DIAMOND: { id: 'diamond', name: '钻石', icon: '💎', color: '#44ffee' },
  GOLD: { id: 'gold', name: '金锭', icon: '🥇', color: '#ffd700' },
};

// Shop definitions
export const SHOP_CATEGORIES = {
  weapons: {
    name: '🗡️ 武器',
    items: [
      { item: ITEMS.WOOD_SWORD, price: { copper: 4 }, desc: '攻击力 3' },
      { item: ITEMS.STONE_SWORD, price: { copper: 8 }, desc: '攻击力 5' },
      { item: ITEMS.IRON_SWORD, price: { iron: 4 }, desc: '攻击力 7' },
      { item: ITEMS.DIAMOND_SWORD, price: { diamond: 4 }, desc: '攻击力 10' },
      { item: ITEMS.BOW, price: { iron: 6 }, desc: '远程武器' },
      { item: ITEMS.ARROW, price: { iron: 2 }, desc: '×8 弓的弹药', qty: 8 },
      { item: ITEMS.SLINGSHOT, price: { copper: 2 }, desc: '低伤害，可击退' },
    ]
  },
  armor: {
    name: '🛡️ 装备',
    items: [
      { item: ITEMS.LEATHER_ARMOR, price: { copper: 6 }, desc: '护甲 +2' },
      { item: ITEMS.CHAIN_ARMOR, price: { iron: 6 }, desc: '护甲 +5' },
      { item: ITEMS.DIAMOND_ARMOR, price: { diamond: 2 }, desc: '护甲 +8' },
    ]
  },
  food: {
    name: '🍞 食物',
    items: [
      { item: ITEMS.BREAD, price: { copper: 2 }, desc: '恢复 4 饱食度', qty: 2 },
      { item: ITEMS.CHICKEN, price: { copper: 4 }, desc: '恢复 8 饱食度' },
      { item: ITEMS.GOLDEN_APPLE, price: { gold: 2 }, desc: '恢复全部 HP + 5秒无敌' },
    ]
  },
  blocks: {
    name: '🧱 方块',
    items: [
      { item: ITEMS.WOOL, price: { copper: 2 }, desc: '×16 搭桥用，易碎', qty: 16 },
      { item: ITEMS.PLANKS, price: { copper: 4 }, desc: '×16 中等硬度', qty: 16 },
      { item: ITEMS.COBBLE, price: { iron: 6 }, desc: '×12 高硬度', qty: 12 },
      { item: ITEMS.TNT_ITEM, price: { gold: 4 }, desc: '3秒后爆炸' },
      { item: ITEMS.BRIDGE_EGG, price: { iron: 2 }, desc: '投掷生成临时桥' },
    ]
  },
  potions: {
    name: '🧪 药水',
    items: [
      { item: ITEMS.SPEED_POTION, price: { diamond: 1 }, desc: '15秒加速 50%' },
      { item: ITEMS.JUMP_POTION, price: { diamond: 1 }, desc: '15秒跳跃翻倍' },
      { item: ITEMS.INVIS_POTION, price: { diamond: 2 }, desc: '10秒隐身' },
    ]
  },
};

// Crafting recipes
export const RECIPES = [
  { result: ITEMS.WOOD_SWORD, qty: 1, materials: { stick: 1, planks: 2 }, desc: '基础近战武器' },
  { result: ITEMS.STONE_SWORD, qty: 1, materials: { stick: 1, stone_mat: 2 }, desc: '中级近战武器' },
  { result: ITEMS.WOOD_SHIELD, qty: 1, materials: { planks: 3 }, desc: '格挡正面伤害' },
  { result: ITEMS.LADDER, qty: 4, materials: { stick: 5 }, desc: '可放置攀爬' },
  { result: ITEMS.CAMPFIRE, qty: 1, materials: { stick: 2, stone_mat: 1 }, desc: '附近缓慢恢复HP' },
];

// Physics
export const GRAVITY = 20;
export const JUMP_VELOCITY = 8;
export const WALK_SPEED = 5;
export const RUN_SPEED = 8;
export const PLAYER_HEIGHT = 1.7;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_EYE_HEIGHT = 1.5;

// Game timing
export const RESOURCE_COPPER_INTERVAL = 3; // seconds
export const RESOURCE_IRON_INTERVAL = 10;
export const RESPAWN_TIME = 5;
export const PREP_PHASE_TIME = 30;
export const MAX_GAME_TIME = 15 * 60; // 15 minutes
export const ITEM_DESPAWN_TIME = 60;

// Combat
export const ATTACK_RANGE = 4;
export const ATTACK_COOLDOWN = 0.4;
export const KNOCKBACK_FORCE = 5;
export const BOW_RANGE = 30;

// AI
export const AI_SIGHT_RANGE = 20;
export const AI_ATTACK_RANGE = 3;
export const ZOMBIE_SIGHT_RANGE = 8;
export const ZOMBIE_HP = 15;
export const ZOMBIE_DAMAGE = 3;
export const ZOMBIE_RESPAWN_TIME = 30;

// Teams
export const TEAM_RED = 'red';
export const TEAM_BLUE = 'blue';
