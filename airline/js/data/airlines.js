// 4 家可选航司。初始现金 -40%、初始机队 -~40%，更依赖经营赚钱扩张

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
      ['JFK', 'CDG'], ['JFK', 'LHR'],
    ],
  },
  {
    id: 'IBE',
    codeIATA: 'IB',
    nameZh: '伊比利亚航空',
    nameShort: '伊航',
    country: 'ES',
    hubCity: 'MAD',
    color: '#f59e0b',
    initialCash: 780,
    initialPrestige: 55,
    initialFleet: [
      { modelId: 'A320', count: 3 },
      { modelId: 'A330', count: 2 },
      { modelId: '767',  count: 1 },
    ],
    initialRoutes: [
      ['MAD', 'LHR'], ['MAD', 'CDG'], ['MAD', 'JFK'],
      ['MAD', 'GRU'], ['MAD', 'MEX'],
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
