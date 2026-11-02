export const APP_VERSION = '2026.11.3.1';
export const STARTING_CREDITS = 1000;
export const STARTING_BOMBS = 3;
export const RECOMMENDED_COST = 940;
export const SIDES = ['north', 'east', 'south', 'west'];
export const SIDE_NAMES = { north: '北', east: '东', south: '南', west: '西', reserve: '内环' };
export const ANGLES = { north: -Math.PI / 2, east: 0, south: Math.PI / 2, west: Math.PI };
export const WORLD = { w: 120, h: 90, left: 38, right: 82, top: 28, bottom: 62, cx: 60, cy: 45 };
export const CORE = { x: 60, y: 45, w: 10, h: 10, hp: 1400 };
export const WALL_HP = 900;
export const STORAGE_KEY = 'starship.campaign.v3';
export const PREVIOUS_STORAGE_KEY = 'starship.prototype.v2';
export const DEFAULT_SPEED = 2;
export const POWER_LEVELS = [1, 1.45, 2.05];
export const HEALTH_LEVELS = [1, 1.25, 1.55];
export const LEGACY_STORAGE_KEY = 'starship.prototype.v1';
export const SAVE_VERSION = 3;
export const DEFENDERS = {
  infantry: { name: '步兵班', short: '步', cost: 70, hp: 240, range: 18, airRange: 14, damage: 6, cooldown: 1 / 3, airMult: 0.5, arc: Math.PI * 2, slot: 'infantry', mobile: true, unlock: 1, description: '三人班组 · 可调动 · 近空支援', color: '#9eae76' },
  machinegun: { name: '机枪座', short: '机', cost: 130, hp: 360, range: 22, airRange: 22, damage: 9, cooldown: 0.25, airMult: 0.5, arc: Math.PI * 2 / 3, slot: 'heavy', unlock: 1, description: '持续压制 · 朝外 120° 射界', color: '#c2b385' },
  cannon: { name: '炮塔', short: '炮', cost: 220, hp: 420, range: 30, damage: 110, cooldown: 2.8, splash: 2.5, arc: Math.PI * 2, slot: 'cannon', unlock: 1, description: '独立炮位 · 全向对地范围火力', color: '#d6a260' },
  sam: { name: '防空导弹', short: '空', cost: 180, hp: 280, range: 32, damage: 150, cooldown: 2.2, arc: Math.PI * 2, slot: 'air', unlock: 2, description: '全向防空 · 仅对空 · 跨面支援', color: '#8daea9' },
  bomb: { name: '高爆炸弹', short: '弹', cost: 35, damage: 320, splash: 5.5, range: 65, cooldown: 1.2, slot: 'consumable', unlock: 1, description: '点选战场投掷 · 320 地面范围伤害', color: '#ed9f50' },
  flamethrower: { name: '喷火兵', short: '焰', cost: 150, hp: 280, range: 10.5, damage: 9, cooldown: 0.12, flameArc: Math.PI * 0.42, arc: Math.PI * 2, slot: 'infantry', mobile: true, unlock: 2, burnDamage: 8, burnDuration: 1.8, description: '近距 76° 扇面喷火 · 持续灼烧 · 仅对地', color: '#ee9959' },
};
export const BUGS = {
  warrior: { name: '战士虫', hp: 75, speed: 3.2, damage: 2, radius: 0.65, reward: 4, color: '#76632e', air: false },
  runner: { name: '奔袭虫', hp: 40, speed: 5, damage: 1.5, radius: 0.45, reward: 3, color: '#a88c42', air: false },
  flyer: { name: '飞翼虫', hp: 95, speed: 6.8, damage: 3, radius: 0.65, reward: 8, color: '#8d9778', air: true },
  armor: { name: '重甲虫', hp: 650, speed: 2.1, damage: 16, radius: 1.2, armor: 0.35, reward: 35, color: '#4f5544', air: false },
};
