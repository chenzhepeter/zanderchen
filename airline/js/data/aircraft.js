// 14 款机型，含解锁年份与停产年份
// purchasePrice 单位：百万美元；maintenancePerQuarter 单位：百万美元
// fuelPerSeatKm: 升/座/公里（粗略行业数据，越低越省油）
// landingFeeMult: 着陆费倍率（参考 MTOW 做 sub-linear 压缩；A320 = 1.0 基准）

export const AIRCRAFT = [
  // 支线
  { id: 'ERJ145', manufacturer: 'Embraer', name: 'ERJ-145',  capacity: 50,  rangeKm: 2800,
    fuelPerSeatKm: 0.045, purchasePrice: 20, maintenancePerQuarter: 0.6, landingFeeMult: 0.6,
    availableFrom: 2000, availableUntil: 2030, class: 'regional' },
  { id: 'CRJ700', manufacturer: 'Bombardier', name: 'CRJ-700', capacity: 70, rangeKm: 3000,
    fuelPerSeatKm: 0.041, purchasePrice: 26, maintenancePerQuarter: 0.7, landingFeeMult: 0.7,
    availableFrom: 2001, availableUntil: 2030, class: 'regional' },
  { id: 'E190',   manufacturer: 'Embraer', name: 'E-190',    capacity: 100, rangeKm: 3300,
    fuelPerSeatKm: 0.038, purchasePrice: 38, maintenancePerQuarter: 0.9, landingFeeMult: 0.8,
    availableFrom: 2005, availableUntil: 2030, class: 'regional' },

  // 窄体
  { id: '737NG',  manufacturer: 'Boeing', name: '波音 737-800', capacity: 180, rangeKm: 5400,
    fuelPerSeatKm: 0.033, purchasePrice: 85, maintenancePerQuarter: 1.5, landingFeeMult: 1.0,
    availableFrom: 2000, availableUntil: 2020, class: 'narrow' },
  { id: 'A320',   manufacturer: 'Airbus', name: '空客 A320',    capacity: 180, rangeKm: 5800,
    fuelPerSeatKm: 0.032, purchasePrice: 88, maintenancePerQuarter: 1.5, landingFeeMult: 1.0,
    availableFrom: 2000, availableUntil: 2030, class: 'narrow' },
  { id: 'A321NEO',manufacturer: 'Airbus', name: '空客 A321neo', capacity: 220, rangeKm: 7400,
    fuelPerSeatKm: 0.026, purchasePrice: 130, maintenancePerQuarter: 1.7, landingFeeMult: 1.1,
    availableFrom: 2016, availableUntil: 2030, class: 'narrow' },
  { id: '737MAX', manufacturer: 'Boeing', name: '波音 737 MAX 8', capacity: 200, rangeKm: 6500,
    fuelPerSeatKm: 0.028, purchasePrice: 120, maintenancePerQuarter: 1.6, landingFeeMult: 1.05,
    availableFrom: 2017, availableUntil: 2030, class: 'narrow' },
  { id: 'C919',   manufacturer: 'COMAC',  name: '商飞 C919',     capacity: 170, rangeKm: 5500,
    fuelPerSeatKm: 0.031, purchasePrice: 95, maintenancePerQuarter: 1.4, landingFeeMult: 1.0,
    availableFrom: 2023, availableUntil: 2030, class: 'narrow' },

  // 宽体
  { id: '757',    manufacturer: 'Boeing', name: '波音 757-200',  capacity: 230, rangeKm: 7250,
    fuelPerSeatKm: 0.036, purchasePrice: 100, maintenancePerQuarter: 1.8, landingFeeMult: 1.15,
    availableFrom: 2000, availableUntil: 2005, class: 'wide' },
  { id: '767',    manufacturer: 'Boeing', name: '波音 767-300ER',capacity: 270, rangeKm: 11000,
    fuelPerSeatKm: 0.034, purchasePrice: 145, maintenancePerQuarter: 2.2, landingFeeMult: 1.3,
    availableFrom: 2000, availableUntil: 2014, class: 'wide' },
  { id: '777',    manufacturer: 'Boeing', name: '波音 777-300ER',capacity: 365, rangeKm: 13650,
    fuelPerSeatKm: 0.029, purchasePrice: 320, maintenancePerQuarter: 3.6, landingFeeMult: 1.5,
    availableFrom: 2004, availableUntil: 2030, class: 'wide' },
  { id: 'A330',   manufacturer: 'Airbus', name: '空客 A330-300', capacity: 300, rangeKm: 11750,
    fuelPerSeatKm: 0.030, purchasePrice: 240, maintenancePerQuarter: 3.0, landingFeeMult: 1.4,
    availableFrom: 2000, availableUntil: 2030, class: 'wide' },
  { id: '787',    manufacturer: 'Boeing', name: '波音 787-9',    capacity: 290, rangeKm: 14140,
    fuelPerSeatKm: 0.024, purchasePrice: 290, maintenancePerQuarter: 2.6, landingFeeMult: 1.4,
    availableFrom: 2014, availableUntil: 2030, class: 'wide' },
  { id: 'A380',   manufacturer: 'Airbus', name: '空客 A380-800', capacity: 555, rangeKm: 15200,
    fuelPerSeatKm: 0.031, purchasePrice: 445, maintenancePerQuarter: 5.0, landingFeeMult: 1.65,
    availableFrom: 2008, availableUntil: 2021, class: 'super' },
];

export const AIRCRAFT_BY_ID = Object.fromEntries(AIRCRAFT.map(a => [a.id, a]));

// 季度可执飞的"乘客×公里"运力上限，用于估算每季航线能跑多少班
// 简化：每架飞机每季度最多飞 90 个航段，限制条件为 distanceKm <= rangeKm
export const FLIGHTS_PER_QUARTER = 90;
