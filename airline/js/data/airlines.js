// 4 家 AI 巨头 + 1 玩家模板（STR 星途航空）
// 玩家不再从 4 巨头里选 — 玩家代表 STR 新进入者，挑选基地后才填充 hubCity。

export const AIRLINES = [
  {
    id: 'CCA',
    codeIATA: 'CA',
    nameZh: '中国国际航空',
    nameShort: '国航',
    country: 'CN',
    hubCity: 'PEK',
    color: '#dc2626',
    initialCash: 720,
    initialPrestige: 50,
    initialFleet: [
      { modelId: '737NG', count: 4 },
      { modelId: '767',   count: 2 },
      { modelId: 'A320',  count: 1 },
    ],
    initialRoutes: [
      ['PEK', 'BOM'], ['PEK', 'SIN'], ['PEK', 'HKG'],
      ['PEK', 'HND'], ['PEK', 'LHR'],
    ],
  },
  {
    id: 'DAL',
    codeIATA: 'DL',
    nameZh: '达美航空',
    nameShort: '达美',
    country: 'US',
    hubCity: 'JFK',
    color: '#1d4ed8',
    initialCash: 900,
    initialPrestige: 60,
    initialFleet: [
      { modelId: '757', count: 4 },
      { modelId: '767', count: 2 },
      { modelId: '737NG', count: 2 },
    ],
    initialRoutes: [
      ['JFK', 'LAX'], ['JFK', 'YVR'], ['JFK', 'MEX'],
      ['JFK', 'FRA'], ['JFK', 'LHR'],
    ],
  },
  {
    id: 'DLH',
    codeIATA: 'LH',
    nameZh: '汉莎航空',
    nameShort: '汉莎',
    country: 'DE',
    hubCity: 'FRA',
    color: '#eab308',
    initialCash: 800,
    initialPrestige: 65,
    initialFleet: [
      { modelId: 'A330', count: 2 },
      { modelId: 'A320', count: 2 },
      { modelId: '767',  count: 2 },
    ],
    initialRoutes: [
      ['FRA', 'LHR'], ['FRA', 'JFK'], ['FRA', 'DXB'],
      ['FRA', 'PEK'], ['FRA', 'HKG'],
    ],
  },
  {
    id: 'SIA',
    codeIATA: 'SQ',
    nameZh: '新加坡航空',
    nameShort: '新航',
    country: 'SG',
    hubCity: 'SIN',
    color: '#16a34a',
    initialCash: 840,
    initialPrestige: 70,
    initialFleet: [
      { modelId: '777', count: 2 },
      { modelId: 'A330', count: 3 },
      { modelId: 'A320', count: 1 },
    ],
    initialRoutes: [
      ['SIN', 'HKG'], ['SIN', 'BOM'], ['SIN', 'SYD'],
      ['SIN', 'LHR'], ['SIN', 'HND'],
    ],
  },
];

export const AIRLINE_BY_ID = Object.fromEntries(AIRLINES.map(a => [a.id, a]));

// 玩家航司模板（hubCity / country 由 initNewGame 在玩家选定后填入）
export const PLAYER_TEMPLATE = {
  id: 'STR',
  codeIATA: 'XJ',
  nameZh: '星途航空',
  nameShort: '星途',
  country: 'INT',
  hubCity: null,
  color: '#7c3aed',
  initialCash: 300,
  initialPrestige: 35,
  initialFleet: [
    { modelId: 'ERJ145', count: 1 },
  ],
  initialRoutes: [],  // 空——玩家从零搭网络
};
