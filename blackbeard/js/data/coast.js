// 海域划分：决定遭遇密度、巡逻强度与风浪。陆地轮廓已改由 js/data/land110m.js 提供。
// bounds: [lngMin, latMin, lngMax, latMax]
export const SEAS = [
  { id: 'bahamas', name: '巴哈马浅滩', bounds: [-80, 22, -72, 28], danger: 3, patrol: 1 },
  { id: 'caribbean', name: '加勒比海', bounds: [-88, 9, -60, 22], danger: 3, patrol: 2 },
  { id: 'gulf', name: '墨西哥湾', bounds: [-98, 18, -81, 30], danger: 2, patrol: 2 },
  { id: 'florida', name: '佛罗里达海峡', bounds: [-84, 23, -78, 31], danger: 3, patrol: 3 },
  { id: 'eastcoast', name: '北美东岸', bounds: [-82, 28, -64, 45], danger: 2, patrol: 3 },
  { id: 'newfound', name: '纽芬兰渔场', bounds: [-60, 42, -45, 54], danger: 2, patrol: 1 },
  { id: 'northatlantic', name: '北大西洋', bounds: [-64, 35, -20, 55], danger: 2, patrol: 1 },
  { id: 'midatlantic', name: '中大西洋', bounds: [-60, 5, -20, 35], danger: 1, patrol: 1 },
  { id: 'southatlantic', name: '南大西洋', bounds: [-50, -40, 10, 5], danger: 1, patrol: 1 },
  { id: 'guinea', name: '几内亚湾', bounds: [-20, -8, 14, 12], danger: 2, patrol: 1 },
  { id: 'iberia', name: '伊比利亚外海', bounds: [-20, 35, -5, 45], danger: 2, patrol: 3 },
  { id: 'biscay', name: '比斯开湾', bounds: [-12, 43, 0, 52], danger: 2, patrol: 3 },
  { id: 'channel', name: '英吉利海峡', bounds: [-8, 48, 4, 54], danger: 1, patrol: 4 },
  { id: 'north', name: '北海', bounds: [-2, 51, 10, 61], danger: 2, patrol: 3 },
  { id: 'baltic', name: '波罗的海', bounds: [10, 53, 30, 66], danger: 1, patrol: 2 },
  { id: 'medwest', name: '西地中海', bounds: [-6, 35, 16, 45], danger: 2, patrol: 3 },
  { id: 'medeast', name: '东地中海', bounds: [16, 30, 36, 42], danger: 2, patrol: 2 },
  { id: 'goodhope', name: '好望角外海', bounds: [10, -40, 32, -25], danger: 3, patrol: 1 },
  { id: 'indianw', name: '西印度洋', bounds: [32, -25, 70, 12], danger: 2, patrol: 1 },
  { id: 'arabia', name: '阿拉伯海', bounds: [50, 8, 76, 25], danger: 3, patrol: 1 },
  { id: 'bengal', name: '孟加拉湾', bounds: [78, 5, 95, 22], danger: 2, patrol: 1 },
  { id: 'malacca', name: '马六甲海峡', bounds: [95, -8, 120, 8], danger: 3, patrol: 2 },
  { id: 'southchina', name: '南海', bounds: [105, 5, 125, 25], danger: 3, patrol: 2 },
  { id: 'eastchina', name: '东海', bounds: [118, 25, 132, 40], danger: 2, patrol: 2 },
  { id: 'pacificw', name: '西太平洋', bounds: [125, -20, 175, 25], danger: 1, patrol: 0 },
  { id: 'pacifice', name: '东太平洋', bounds: [-160, -20, -80, 25], danger: 1, patrol: 0 },
  { id: 'horn', name: '合恩角外海', bounds: [-80, -60, -55, -40], danger: 4, patrol: 0 },
];

export function seaAt(lng, lat) {
  for (const s of SEAS) {
    const [x0, y0, x1, y1] = s.bounds;
    if (lng >= x0 && lng <= x1 && lat >= y0 && lat <= y1) return s;
  }
  return { id: 'open', name: '外海', danger: 1, patrol: 0 };
}
