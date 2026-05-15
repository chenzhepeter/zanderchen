// 4 家可选航司，玩家选 1 家，其余 3 家为 AI
// initialFleet 列出每家在 2000 Q1 的粗略机队（按机型 id × 数量）

export const AIRLINES = [
  {
    id: 'CCA',
    codeIATA: 'CA',
    nameZh: '中国国际航空',
    nameShort: '国航',
    country: 'CN',
    hubCity: 'PEK',
    color: '#dc2626',
    initialCash: 1200,
    initialDebt: 400,
    initialPrestige: 50,
    initialFleet: [
      { modelId: '737NG', count: 6 },
      { modelId: '767',   count: 3 },
      { modelId: 'A320',  count: 2 },
    ],
    initialRoutes: [
      ['PEK', 'PVG'], ['PEK', 'ICN'], ['PEK', 'HKG'],
      ['PEK', 'HND'], ['PEK', 'FRA'],
    ],
  },
  {
    id: 'DAL',
    codeIATA: 'DL',
    nameZh: '达美航空',
    nameShort: '达美',
    country: 'US',
    hubCity: 'ATL',
    color: '#1d4ed8',
    initialCash: 1500,
    initialDebt: 600,
    initialPrestige: 60,
    initialFleet: [
      { modelId: '757', count: 6 },
      { modelId: '767', count: 4 },
      { modelId: '737NG', count: 4 },
    ],
    initialRoutes: [
      ['ATL', 'JFK'], ['ATL', 'LAX'], ['ATL', 'ORD'],
      ['ATL', 'CDG'], ['JFK', 'LHR'],
    ],
  },
  {
    id: 'DLH',
    codeIATA: 'LH',
    nameZh: '汉莎航空',
    nameShort: '汉莎',
    country: 'DE',
    hubCity: 'FRA',
    color: '#f59e0b',
    initialCash: 1300,
    initialDebt: 500,
    initialPrestige: 55,
    initialFleet: [
      { modelId: 'A320', count: 6 },
      { modelId: 'A330', count: 3 },
      { modelId: '767',  count: 2 },
    ],
    initialRoutes: [
      ['FRA', 'LHR'], ['FRA', 'CDG'], ['FRA', 'JFK'],
      ['FRA', 'PEK'], ['FRA', 'DXB'],
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
    initialCash: 1400,
    initialDebt: 350,
    initialPrestige: 70,
    initialFleet: [
      { modelId: '777', count: 4 },
      { modelId: 'A330', count: 4 },
      { modelId: 'A320', count: 2 },
    ],
    initialRoutes: [
      ['SIN', 'HKG'], ['SIN', 'BKK'], ['SIN', 'SYD'],
      ['SIN', 'LHR'], ['SIN', 'HND'],
    ],
  },
];

export const AIRLINE_BY_ID = Object.fromEntries(AIRLINES.map(a => [a.id, a]));
