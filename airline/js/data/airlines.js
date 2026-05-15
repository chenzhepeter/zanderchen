// 4 家可选航司。删除 FRA 后用伊比利亚（IBE/MAD）取代汉莎（DLH/FRA）。

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
      ['PEK', 'PVG'], ['PEK', 'SIN'], ['PEK', 'HKG'],
      ['PEK', 'HND'], ['PEK', 'LHR'],
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
      ['ATL', 'JFK'], ['ATL', 'LAX'], ['ATL', 'MEX'],
      ['ATL', 'CDG'], ['JFK', 'LHR'],
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
    initialCash: 1300,
    initialDebt: 500,
    initialPrestige: 55,
    initialFleet: [
      { modelId: 'A320', count: 5 },
      { modelId: 'A330', count: 3 },
      { modelId: '767',  count: 2 },
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
