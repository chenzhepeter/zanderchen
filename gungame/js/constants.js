export const MAP_SIZE = 160;
export const HOUSE_HP = 500;
export const PLAYER_HP = 100;
export const TEAM_SIZE = 5;
export const RESPAWN_TIME = 6;
export const PLAYER_RESPAWN_TIME = 6;
export const DOWN_BLEEDOUT = 6;
export const REVIVE_TIME = 1;
export const REVIVE_HP_FRAC = 0.8;
export const REVIVE_RANGE = 2.5;
export const HEAL_RANGE = 4;
export const MEDIC_HEAL_PER_VISIT = 20;
export const HEADSHOT_MULT = 2;
export const HOUSE_DAMAGE_FACTOR = 0.5;

export const FALL_DAMAGE = 10;
export const FALL_DAMAGE_THRESHOLD = 3.0; // meters fallen
export const LADDER_SPEED = 4.5;

export const TEAM_BLUE = 'blue';
export const TEAM_RED = 'red';
export const TEAM_COLOR = {
  [TEAM_BLUE]: 0x3b82f6,
  [TEAM_RED]: 0xef4444,
};

export const HOUSE_POS = {
  [TEAM_BLUE]: { x: 0, z: 65 },
  [TEAM_RED]:  { x: 0, z: -65 },
};
export const HOUSE_SIZE = { w: 18, h: 5, d: 14 };

// Gun ids
export const GUN_PISTOL = 0;
export const GUN_SMG    = 1;
export const GUN_RIFLE  = 2;
export const GUN_SNIPER = 3;

export const GUNS = [
  { id: 0, name: 'Pistol',  damage: 10, mag: 10, fireDelay: 0.18, reload: 1.2, color: 0xffe066, scale: 1.0,  range: 50,  spread: 0.020, adsFov: 60, magsAtSpawn: 1 },
  { id: 1, name: 'SMG',     damage: 20, mag: 10, fireDelay: 0.30, reload: 1.5, color: 0xff8c42, scale: 1.25, range: 55,  spread: 0.030, adsFov: 55, magsAtSpawn: 3 },
  { id: 2, name: 'Rifle',   damage: 35, mag: 15, fireDelay: 0.55, reload: 2.0, color: 0x9bd1ff, scale: 1.55, range: 75,  spread: 0.012, adsFov: 45, magsAtSpawn: 3 },
  { id: 3, name: 'Sniper',  damage: 80, mag: 5,  fireDelay: 1.10, reload: 2.5, color: 0xff5577, scale: 1.85, range: 140, spread: 0.003, adsFov: 22, magsAtSpawn: 3 },
];

// Roles
export const ROLE_RIFLE  = 'rifle';
export const ROLE_MEDIC  = 'medic';
export const ROLE_SNIPER = 'sniper';

export const ROLE_GUN = {
  [ROLE_RIFLE]:  GUN_RIFLE,
  [ROLE_MEDIC]:  GUN_SMG,
  [ROLE_SNIPER]: GUN_SNIPER,
};

// Per-team composition (4 bots per team + 1 player slot for blue)
export const BLUE_BOT_ROLES = [ROLE_MEDIC, ROLE_SNIPER, ROLE_RIFLE, ROLE_RIFLE];
export const RED_BOT_ROLES  = [ROLE_MEDIC, ROLE_SNIPER, ROLE_RIFLE, ROLE_RIFLE, ROLE_RIFLE];

// Slow factor: at 0 HP you'd be at MIN_SPEED_MULT, scales linearly
export const MIN_SPEED_MULT = 0.45;
export function speedMultFromHp(hp) {
  return MIN_SPEED_MULT + (1 - MIN_SPEED_MULT) * Math.max(0, hp / PLAYER_HP);
}

// Restock zones: middle of map + just inside each house
export const RESTOCK_ZONES = [
  { x: 0,   z: 0,   r: 5, label: 'Middle Restock' },
  { x: -25, z: 20,  r: 4, label: 'West Restock' },
  { x: 25,  z: -20, r: 4, label: 'East Restock' },
  { x: HOUSE_POS[TEAM_BLUE].x, z: HOUSE_POS[TEAM_BLUE].z, r: 6, team: TEAM_BLUE, label: 'Blue Base' },
  { x: HOUSE_POS[TEAM_RED].x,  z: HOUSE_POS[TEAM_RED].z,  r: 6, team: TEAM_RED,  label: 'Red Base'  },
];
