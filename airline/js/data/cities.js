// 24 个全球主要城市，按大洲分布更均衡
// 亚 8 / 中东+土 2 / 欧+俄 4 / 北美+墨+加 6 / 南美 1 / 大洋 1 / 非 2 = 24

export const CITIES = [
  // 东亚 (4)
  { id: 'PEK', nameZh: '北京',       iata: 'PEK', lat: 40.08, lng: 116.58, region: 'asia',     country: 'CN', size: 5, baseDemand: 950 },
  { id: 'PVG', nameZh: '上海',       iata: 'PVG', lat: 31.14, lng: 121.81, region: 'asia',     country: 'CN', size: 5, baseDemand: 950 },
  { id: 'HKG', nameZh: '香港',       iata: 'HKG', lat: 22.31, lng: 113.91, region: 'asia',     country: 'HK', size: 4, baseDemand: 800 },
  { id: 'HND', nameZh: '东京',       iata: 'HND', lat: 35.55, lng: 139.78, region: 'asia',     country: 'JP', size: 5, baseDemand: 900 },
  { id: 'ICN', nameZh: '首尔',       iata: 'ICN', lat: 37.46, lng: 126.44, region: 'asia',     country: 'KR', size: 4, baseDemand: 720 },
  // 东南亚 + 南亚 (3)
  { id: 'SIN', nameZh: '新加坡',     iata: 'SIN', lat: 1.36,  lng: 103.99, region: 'asia',     country: 'SG', size: 4, baseDemand: 780 },
  { id: 'BKK', nameZh: '曼谷',       iata: 'BKK', lat: 13.69, lng: 100.75, region: 'asia',     country: 'TH', size: 4, baseDemand: 700 },
  { id: 'BOM', nameZh: '孟买',       iata: 'BOM', lat: 19.09, lng: 72.87,  region: 'asia',     country: 'IN', size: 4, baseDemand: 720 },

  // 中东 (2)
  { id: 'DXB', nameZh: '迪拜',       iata: 'DXB', lat: 25.25, lng: 55.37,  region: 'mideast',  country: 'AE', size: 5, baseDemand: 800 },
  { id: 'IST', nameZh: '伊斯坦布尔', iata: 'IST', lat: 41.28, lng: 28.74,  region: 'mideast',  country: 'TR', size: 4, baseDemand: 760 },

  // 欧洲 + 俄罗斯 (4)
  { id: 'LHR', nameZh: '伦敦',       iata: 'LHR', lat: 51.47, lng: -0.45,  region: 'europe',   country: 'GB', size: 5, baseDemand: 900 },
  { id: 'CDG', nameZh: '巴黎',       iata: 'CDG', lat: 49.01, lng: 2.55,   region: 'europe',   country: 'FR', size: 5, baseDemand: 850 },
  { id: 'FRA', nameZh: '法兰克福',   iata: 'FRA', lat: 50.03, lng: 8.56,   region: 'europe',   country: 'DE', size: 4, baseDemand: 780 },
  { id: 'SVO', nameZh: '莫斯科',     iata: 'SVO', lat: 55.97, lng: 37.41,  region: 'europe',   country: 'RU', size: 4, baseDemand: 720 },

  // 北美 + 墨西哥 + 加拿大 (6)
  { id: 'JFK', nameZh: '纽约',       iata: 'JFK', lat: 40.64, lng: -73.78, region: 'namerica', country: 'US', size: 5, baseDemand: 950 },
  { id: 'LAX', nameZh: '洛杉矶',     iata: 'LAX', lat: 33.94, lng: -118.41,region: 'namerica', country: 'US', size: 5, baseDemand: 880 },
  { id: 'ORD', nameZh: '芝加哥',     iata: 'ORD', lat: 41.98, lng: -87.91, region: 'namerica', country: 'US', size: 4, baseDemand: 780 },
  { id: 'ATL', nameZh: '亚特兰大',   iata: 'ATL', lat: 33.64, lng: -84.43, region: 'namerica', country: 'US', size: 4, baseDemand: 760 },
  { id: 'YVR', nameZh: '温哥华',     iata: 'YVR', lat: 49.19, lng: -123.18,region: 'namerica', country: 'CA', size: 4, baseDemand: 660 },
  { id: 'MEX', nameZh: '墨西哥城',   iata: 'MEX', lat: 19.44, lng: -99.07, region: 'namerica', country: 'MX', size: 4, baseDemand: 700 },

  // 南美 (1)
  { id: 'GRU', nameZh: '圣保罗',     iata: 'GRU', lat: -23.43,lng: -46.47, region: 'samerica', country: 'BR', size: 4, baseDemand: 700 },

  // 大洋洲 (1)
  { id: 'SYD', nameZh: '悉尼',       iata: 'SYD', lat: -33.95,lng: 151.18, region: 'oceania',  country: 'AU', size: 4, baseDemand: 700 },

  // 非洲 (2)
  { id: 'CAI', nameZh: '开罗',       iata: 'CAI', lat: 30.13, lng: 31.41,  region: 'africa',   country: 'EG', size: 4, baseDemand: 680 },
  { id: 'JNB', nameZh: '约翰内斯堡', iata: 'JNB', lat: -26.13,lng: 28.24,  region: 'africa',   country: 'ZA', size: 4, baseDemand: 640 },
];

export const CITY_BY_ID = Object.fromEntries(CITIES.map(c => [c.id, c]));

// 大圆距离近似（球面公式），单位 km
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}
