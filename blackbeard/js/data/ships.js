// 船型表。speed 为基准航速（节）；guns 炮位；cargo 载货；crewMax 满编船员
// availableFrom：按年代解锁（1690-1720 的大西洋）
export const SHIPS = [
  {
    id: 'skiff', name: '单桅小艇', nameEn: 'Skiff', cls: 'light',
    hull: 70, armor: 1, speed: 7.5, guns: 2, cargo: 25, crewMax: 20, price: 900,
    note: '近海跑腿的小船。装不下多少货，但吃水浅、进得了浅滩。',
  },
  {
    id: 'sloop', name: '单桅纵帆船', nameEn: 'Sloop', cls: 'light',
    hull: 110, armor: 2, speed: 9.5, guns: 8, cargo: 45, crewMax: 45, price: 3200,
    note: '海盗最爱的船型：快、灵活、能贴着沙洲跑，军舰追不上。',
  },
  {
    id: 'schooner', name: '双桅纵帆船', nameEn: 'Schooner', cls: 'light',
    hull: 140, armor: 2, speed: 10.5, guns: 10, cargo: 65, crewMax: 65, price: 5400,
    note: '抢风性能极佳，逆风时比横帆船占尽便宜。',
  },
  {
    id: 'brigantine', name: '双桅横帆船', nameEn: 'Brigantine', cls: 'medium',
    hull: 195, armor: 3, speed: 8.5, guns: 14, cargo: 95, crewMax: 95, price: 8600,
    note: '攻守兼备的中型船，海盗把它当主力舰用。',
  },
  {
    id: 'fluyt', name: '弗鲁特商船', nameEn: 'Fluyt', cls: 'trade',
    hull: 210, armor: 2, speed: 6.5, guns: 8, cargo: 190, crewMax: 60, price: 9800,
    note: '荷兰人的运货机器：肚子大、水手少、跑得慢——海盗眼里的肥羊。',
  },
  {
    id: 'frigate', name: '巡防舰', nameEn: 'Frigate', cls: 'war',
    hull: 310, armor: 5, speed: 8.0, guns: 28, cargo: 105, crewMax: 170, price: 21000,
    note: '皇家海军的多面手，火力与航速兼顾。',
  },
  {
    id: 'galleon', name: '大帆船', nameEn: 'Galleon', cls: 'trade',
    hull: 390, armor: 5, speed: 5.5, guns: 30, cargo: 210, crewMax: 190, price: 27000,
    note: '西班牙珍宝船队的主力。又大又慢，但一舷炮打过来能把小船掀翻。',
  },
  {
    id: 'manowar', name: '战列舰', nameEn: 'Man-o-War', cls: 'war',
    hull: 540, armor: 7, speed: 5.0, guns: 52, cargo: 160, crewMax: 340, price: 46000,
    note: '海上的移动堡垒。见到它升起战旗，聪明人就该转舵逃跑。',
  },
  {
    id: 'qar', name: '安妮女王复仇号', nameEn: "Queen Anne's Revenge", cls: 'war',
    hull: 430, armor: 6, speed: 8.0, guns: 40, cargo: 175, crewMax: 260, price: 0, story: true,
    note: '由法国船"协和号"改装而成的旗舰。四十门炮让整个西印度群岛的商船闻风丧胆。',
  },
];

export const SHIP_BY_ID = Object.fromEntries(SHIPS.map(s => [s.id, s]));

// 改装项（造船厂）
export const UPGRADES = [
  { id: 'guns', name: '增设炮位', icon: '💣', price: 2200, effect: '+4 炮', max: 3 },
  { id: 'plating', name: '加固船壳', icon: '🛡️', price: 1800, effect: '+2 装甲 / +30 耐久', max: 3 },
  { id: 'sails', name: '加装帆索', icon: '⛵', price: 1600, effect: '+0.8 节航速', max: 3 },
  { id: 'hold', name: '扩充货舱', icon: '📦', price: 1400, effect: '+25 载货', max: 3 },
];
