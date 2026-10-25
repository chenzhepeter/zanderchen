// config.js — 唯一规则配置源（ruleset）
// 《暗区搜寻》EP01 所有数值与设计文档 3.9 关键数值总表一致，单位 m / s。
export const RULESET = {
  ruleset_id: 'darkzone-ep01-1.0',

  // 关卡尺寸（米）
  MAP_W: 48,
  MAP_H: 30,
  WALL_THICKNESS: 0.18,
  ENTITY_RADIUS: 0.36,

  // 玩家速度 m/s
  PLAYER_SPEED: { crouch: 1.2, walk: 2.6, run: 4.8 },

  // 敌人速度 m/s
  GUARD_SPEED: { patrol: 1.5, investigate: 2.3, hunt: 3.8 },

  // 玩家视野（明/暗），蹲伏 -1/-0.5
  PLAYER_VISION: {
    halfAngle: 75, // 150° 扇形
    bright: { stand: 8, crouch: 7 },
    dark: { stand: 4, crouch: 3.5 },
    behindGlow: 1.5, // 身后微光
  },

  // 敌人视野（明/半暗/暗），视野锥 120°
  GUARD_VISION: {
    halfAngle: 60,
    bright: { base: 9, crouch: 6.3, crouchStill: 4.5 },
    dim: { base: 6, crouch: 4.2, crouchStill: 3 },
    dark: { base: 4, crouch: 2.8, crouchStill: 2 },
  },

  // 警戒阈值
  ALERT: { L1: 15, L2: 45, L3: 75 },

  // 警戒槽积累速率（每秒）
  ALERT_GAIN: {
    exposedBright: 55, // 明处全身站立
    halfCover: 20, // 半身遮挡（蹲伏+半高隔间）
    exposedDark: 10, // 暗处暴露
    farGlimpse: 8, // 距离 >7m 短暂一瞥
    soundEvent: 18, // 一次性声音
    evidence: 50, // 物证（门开/灯关/物品被拿）
  },

  // 衰减
  ALERT_DECAY: { gracePeriod: 2, rate: 30 }, // 失视线 2s 宽限后 -30/s
  L1_INVESTIGATE_TIME: 5, // L1 到点查看 5s 无发现
  L2_SEARCH_TIME: 20, // L2 扫视 20s 无目击
  HUNT_LOSE_SIGHT_TIME: 12, // 全员无视线 12s → L2 区域搜索
  HUNT_SEARCH_TIME: 30, // 区域搜索 30s 无目击 → L0

  // 噪声半径（空气传播，米）
  NOISE: {
    silent: 0,
    walk: 3,
    run: 9,
    throw: 8,
    envTrap: 8,
    keypadError: 10,
    switch: 2,
    closeDoor: 3,
    openDoorFast: 3,
  },
  // 穿墙衰减
  WALL_SOUND_FACTOR: { wood: 0.7, concrete: 0.2 },

  // 动作耗时（秒）
  ACTION_TIME: {
    openDoorFast: 0.3,
    openDoorSlow: 0.8,
    closeDoor: 0.6, // 关门瞬间阻挡，此为玩家动作动画
    switchLight: 0.3,
    searchDrawer: 1.2,
    swipeCard: 0.5,
    keypadDoor: 1.5, // 密码正确开门
    kickDoor: 3, // 敌人踢门
    guardKeypad: 1.5, // 敌人过密码门
    grabReach: 0.5, // 接触抓捕前摇
    alarmDelay: 3, // U 盘静默报警延迟
    whistle: 0.5, // 吹哨反应
    throwFly: 0.45, // 投掷物飞行
    microwaveDelay: 8, // 微波炉响铃延迟
  },

  // 触碰抓捕距离
  GRAB_DISTANCE: 0.78,
  GRAB_ESCAPE_DISTANCE: 1.25,

  // 藏匿时视野
  HIDE_VISION: 2,

  // 密码
  CODES: { archive: '0423', exit: '0512' },

  // 楼层光照（初始）
  LIGHT: {
    bright: { key: 'bright', enemyVision: 'bright' },
    dim: { key: 'dim', enemyVision: 'dim' },
    dark: { key: 'dark', enemyVision: 'dark' },
  },

  // 运行参数
  RENDER: {
    fogCell: 0.5, // 迷雾网格边长（米）
    coneStepDeg: 2, // 视野锥射线角度步长
    baseScale: 27, // 每米像素
    minScale: 18,
    maxScale: 42,
  },

  // 移动噪声节流：按姿态移动时多久产生一次脚步噪声
  STEP_INTERVAL: { crouch: 0, walk: 0.55, run: 0.38 },

  // 评级
  RANK: {
    ghostTimeLimit: 300, // 5 分钟
  },
};
