// 18 个全球主要城市，2000-2025 演化
// 亚 5 / 中东 2 / 欧 4 / 北美+加 4 / 南美 1 / 大洋 1 / 非 1 = 18

export const DEMAND_BY_SIZE = { 3: 480, 4: 720, 5: 1000 };
export const SLOTS_BY_SIZE = { 3: 6, 4: 10, 5: 15 };

// 2000 年的格局：5 星只属于"区域性龙头"
//   亚洲: HKG / HND
//   北美: JFK / LAX
//   欧洲: LHR / CDG
// 共 6 城。其他多数为 4 星 (新兴枢纽) 与 3 星 (中等市场)。

export const CITIES = [
  // ==== 亚洲 (5) ====
  { id: 'PEK', nameZh: '北京',       iata: 'PEK', lat: 40.08, lng: 116.58, region: 'asia',     country: 'CN',
    baseSizeAt2000: 4, sizeHistory: [{ year: 2008, size: 5 }] },
  { id: 'HKG', nameZh: '香港',       iata: 'HKG', lat: 22.31, lng: 113.91, region: 'asia',     country: 'HK',
    baseSizeAt2000: 5, sizeHistory: [] },
  { id: 'HND', nameZh: '东京',       iata: 'HND', lat: 35.55, lng: 139.78, region: 'asia',     country: 'JP',
    baseSizeAt2000: 5, sizeHistory: [] },
  { id: 'SIN', nameZh: '新加坡',     iata: 'SIN', lat: 1.36,  lng: 103.99, region: 'asia',     country: 'SG',
    baseSizeAt2000: 4, sizeHistory: [{ year: 2008, size: 5 }] },
  { id: 'BOM', nameZh: '孟买',       iata: 'BOM', lat: 19.09, lng: 72.87,  region: 'asia',     country: 'IN',
    baseSizeAt2000: 4, sizeHistory: [{ year: 2020, size: 5 }] },

  // ==== 中东 (2) ====
  { id: 'DXB', nameZh: '迪拜',       iata: 'DXB', lat: 25.25, lng: 55.37,  region: 'mideast',  country: 'AE',
    baseSizeAt2000: 4, sizeHistory: [{ year: 2012, size: 5 }] },  // 降到 4 起步，2012 后再升 5
  { id: 'IST', nameZh: '伊斯坦布尔', iata: 'IST', lat: 41.28, lng: 28.74,  region: 'mideast',  country: 'TR',
    baseSizeAt2000: 4, sizeHistory: [{ year: 2018, size: 5 }] },

  // ==== 欧洲 (4) ====
  { id: 'LHR', nameZh: '伦敦',       iata: 'LHR', lat: 51.47, lng: -0.45,  region: 'europe',   country: 'GB',
    baseSizeAt2000: 5, sizeHistory: [] },
  { id: 'CDG', nameZh: '巴黎',       iata: 'CDG', lat: 49.01, lng: 2.55,   region: 'europe',   country: 'FR',
    baseSizeAt2000: 5, sizeHistory: [] },
  { id: 'MAD', nameZh: '马德里',     iata: 'MAD', lat: 40.49, lng: -3.57,  region: 'europe',   country: 'ES',
    baseSizeAt2000: 4, sizeHistory: [] },
  { id: 'OSL', nameZh: '奥斯陆',     iata: 'OSL', lat: 60.19, lng: 11.10,  region: 'europe',   country: 'NO',
    baseSizeAt2000: 3, sizeHistory: [{ year: 2015, size: 4 }] },

  // ==== 北美 (4) ====
  { id: 'JFK', nameZh: '纽约',       iata: 'JFK', lat: 40.64, lng: -73.78, region: 'namerica', country: 'US',
    baseSizeAt2000: 5, sizeHistory: [] },
  { id: 'LAX', nameZh: '洛杉矶',     iata: 'LAX', lat: 33.94, lng: -118.41,region: 'namerica', country: 'US',
    baseSizeAt2000: 5, sizeHistory: [] },
  { id: 'YVR', nameZh: '温哥华',     iata: 'YVR', lat: 49.19, lng: -123.18,region: 'namerica', country: 'CA',
    baseSizeAt2000: 3, sizeHistory: [{ year: 2012, size: 4 }] },
  { id: 'MEX', nameZh: '墨西哥城',   iata: 'MEX', lat: 19.44, lng: -99.07, region: 'namerica', country: 'MX',
    baseSizeAt2000: 4, sizeHistory: [] },

  // ==== 南美 (1) ====
  { id: 'GRU', nameZh: '圣保罗',     iata: 'GRU', lat: -23.43,lng: -46.47, region: 'samerica', country: 'BR',
    baseSizeAt2000: 3, sizeHistory: [{ year: 2014, size: 4 }] },

  // ==== 大洋洲 (1) ====
  { id: 'SYD', nameZh: '悉尼',       iata: 'SYD', lat: -33.95,lng: 151.18, region: 'oceania',  country: 'AU',
    baseSizeAt2000: 3, sizeHistory: [{ year: 2015, size: 4 }] },

  // ==== 非洲 (1) ====
  { id: 'JNB', nameZh: '约翰内斯堡', iata: 'JNB', lat: -26.13,lng: 28.24,  region: 'africa',   country: 'ZA',
    baseSizeAt2000: 3, sizeHistory: [{ year: 2018, size: 4 }] },
];

export const CITY_BY_ID = Object.fromEntries(CITIES.map(c => [c.id, c]));

export function citySizeAt(city, year) {
  let size = city.baseSizeAt2000;
  for (const stage of (city.sizeHistory || [])) {
    if (year >= stage.year) size = stage.size;
  }
  return size;
}

export function recomputeCityStates(year) {
  for (const c of CITIES) {
    c.size = citySizeAt(c, year);
    c.baseDemand = DEMAND_BY_SIZE[c.size];
    c.slotCapacity = SLOTS_BY_SIZE[c.size];
  }
}

recomputeCityStates(2000);

export function distanceKm(a, b) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}
