// 31 个大西洋港口 —— 覆盖蒂奇（黑胡子）真实活动范围
// nation: en英 / es西 / fr法 / nl荷 / pt葡 / free自由港（海盗）
// size 1..5 影响市场容量与繁荣度；produces 便宜、wants 昂贵
// facilities: market市场 / tavern酒馆 / shipyard造船厂 / governor总督府 / church医馆
// stance: 对海盗的默认态度 friendly / neutral / wary / hostile

export const PORTS = [
  // ===== 巴哈马 & 加勒比 =====
  {
    id: 'NASSAU', name: '拿骚', nameEn: 'Nassau', lng: -77.35, lat: 25.06,
    nation: 'free', size: 3, stance: 'friendly', pirateHaven: true,
    produces: ['rum'], wants: ['gunpowder', 'grain', 'medicine'],
    facilities: ['market', 'tavern', 'shipyard'],
    blurb: '海盗共和国的心脏。没有总督，没有法律，只有《海盗公约》和一片浅得让军舰不敢进来的沙洲。',
  },
  {
    id: 'PORTROYAL', name: '皇家港', nameEn: 'Port Royal', lng: -76.84, lat: 17.94,
    nation: 'en', size: 4, stance: 'wary',
    produces: ['sugar', 'rum'], wants: ['timber', 'medicine', 'cotton'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '曾被称作"地球上最邪恶的城市"，1692 年的大地震把半座城沉进了海里。如今是皇家海军的据点。',
  },
  {
    id: 'TORTUGA', name: '托尔图加', nameEn: 'Tortuga', lng: -72.79, lat: 20.06,
    nation: 'free', size: 2, stance: 'friendly', pirateHaven: true,
    produces: ['rum'], wants: ['gunpowder', 'grain', 'timber'],
    facilities: ['market', 'tavern', 'shipyard'],
    blurb: '老一辈"海岸兄弟会"的巢穴。龟岛北岸礁石密布，只有本地领航员敢在夜里进港。',
  },
  {
    id: 'HAVANA', name: '哈瓦那', nameEn: 'Havana', lng: -82.38, lat: 23.13,
    nation: 'es', size: 5, stance: 'hostile',
    produces: ['tobacco', 'sugar', 'silver'], wants: ['timber', 'grain', 'cotton'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '西属美洲最坚固的要塞港。珍宝船队每年在此集结，莫罗堡的炮口日夜指着入口水道。',
  },
  {
    id: 'SANTIAGO', name: '圣地亚哥', nameEn: 'Santiago de Cuba', lng: -75.83, lat: 20.02,
    nation: 'es', size: 3, stance: 'hostile',
    produces: ['sugar', 'coffee'], wants: ['timber', 'gunpowder', 'medicine'],
    facilities: ['market', 'tavern', 'governor', 'church'],
    blurb: '古巴东南的老城，深水湾被群山环抱，是通往向风海峡的门户。',
  },
  {
    id: 'SANTODOMINGO', name: '圣多明各', nameEn: 'Santo Domingo', lng: -69.93, lat: 18.47,
    nation: 'es', size: 4, stance: 'hostile',
    produces: ['sugar', 'cocoa'], wants: ['timber', 'cotton', 'medicine'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '新世界最古老的欧洲城市，哥伦布之子曾在此建总督府。',
  },
  {
    id: 'SANJUAN', name: '圣胡安', nameEn: 'San Juan', lng: -66.11, lat: 18.47,
    nation: 'es', size: 3, stance: 'hostile',
    produces: ['sugar', 'coffee'], wants: ['grain', 'timber', 'gunpowder'],
    facilities: ['market', 'tavern', 'governor', 'church'],
    blurb: '莫罗城堡扼守海口。西班牙人称它"波多黎各"——富庶之港。',
  },
  {
    id: 'CARTAGENA', name: '卡塔赫纳', nameEn: 'Cartagena de Indias', lng: -75.51, lat: 10.39,
    nation: 'es', size: 5, stance: 'hostile',
    produces: ['silver', 'cocoa'], wants: ['grain', 'timber', 'medicine', 'cotton'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '南美珍宝的出海口，城墙厚得能跑马车。历代海盗都梦想攻破它，多数葬身城下。',
  },
  {
    id: 'PORTOBELLO', name: '波托贝洛', nameEn: 'Porto Bello', lng: -79.65, lat: 9.55,
    nation: 'es', size: 3, stance: 'hostile',
    produces: ['silver'], wants: ['grain', 'medicine', 'cotton'],
    facilities: ['market', 'tavern', 'governor'],
    blurb: '秘鲁白银经巴拿马地峡运到这里装船。集市季节，白银像柴火一样堆在码头上。',
  },
  {
    id: 'VERACRUZ', name: '韦拉克鲁斯', nameEn: 'Vera Cruz', lng: -96.13, lat: 19.19,
    nation: 'es', size: 4, stance: 'hostile',
    produces: ['silver', 'cocoa'], wants: ['timber', 'grain', 'cotton'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '新西班牙的门户，圣胡安·德乌卢阿要塞守着这片浅湾。',
  },
  {
    id: 'BRIDGETOWN', name: '布里奇顿', nameEn: 'Bridgetown', lng: -59.62, lat: 13.11,
    nation: 'en', size: 3, stance: 'wary',
    produces: ['sugar', 'rum'], wants: ['grain', 'timber', 'medicine'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '巴巴多斯是加勒比最东的岛，进入西印度群岛的第一站。斯蒂德·邦尼特的庄园就在此地。',
  },
  {
    id: 'FORTROYAL', name: '法兰西堡', nameEn: 'Fort-de-France', lng: -61.07, lat: 14.60,
    nation: 'fr', size: 3, stance: 'neutral',
    produces: ['sugar', 'coffee'], wants: ['grain', 'timber', 'gunpowder'],
    facilities: ['market', 'tavern', 'shipyard', 'governor'],
    blurb: '马提尼克的法国据点，火山脚下的良港。法国人对付得起钱的客人一向宽容。',
  },
  {
    id: 'BASSETERRE', name: '巴斯特尔', nameEn: 'Basseterre', lng: -62.72, lat: 17.30,
    nation: 'en', size: 2, stance: 'wary',
    produces: ['sugar', 'tobacco'], wants: ['grain', 'medicine', 'timber'],
    facilities: ['market', 'tavern', 'church'],
    blurb: '圣基茨——英法在同一座小岛上分治了几十年，直到战争把法国人赶走。',
  },
  {
    id: 'WILLEMSTAD', name: '威廉斯塔德', nameEn: 'Willemstad', lng: -68.93, lat: 12.11,
    nation: 'nl', size: 3, stance: 'neutral',
    produces: ['spice', 'gunpowder'], wants: ['sugar', 'tobacco', 'silver'],
    facilities: ['market', 'tavern', 'shipyard', 'governor'],
    blurb: '库拉索的荷兰转口港。荷兰人不问货从哪来，只问价钱几何——走私者的天堂。',
  },
  // ===== 北美东岸 =====
  {
    id: 'STAUGUSTINE', name: '圣奥古斯丁', nameEn: 'St. Augustine', lng: -81.31, lat: 29.90,
    nation: 'es', size: 2, stance: 'hostile',
    produces: ['timber'], wants: ['grain', 'gunpowder', 'medicine', 'rum'],
    facilities: ['market', 'tavern', 'governor', 'church'],
    blurb: '西属佛罗里达的孤哨，卡斯蒂略要塞由珊瑚石砌成，炮弹打上去只会陷进去。',
  },
  {
    id: 'CHARLESTON', name: '查尔斯顿', nameEn: 'Charles Town', lng: -79.93, lat: 32.78,
    nation: 'en', size: 4, stance: 'wary',
    produces: ['grain', 'indigo', 'cotton'], wants: ['medicine', 'rum', 'spice', 'silver'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '卡罗来纳的稻米与靛蓝从这里出海。港口敞开，没有像样的炮台——这是它最大的弱点。',
  },
  {
    id: 'BATH', name: '巴斯镇', nameEn: 'Bath', lng: -76.81, lat: 35.47,
    nation: 'en', size: 1, stance: 'friendly',
    produces: ['tobacco', 'timber'], wants: ['rum', 'grain', 'cotton'],
    facilities: ['market', 'tavern', 'governor'],
    blurb: '北卡罗来纳的小镇，总督查尔斯·伊登的官邸所在。安静、偏僻，适合一个想洗白的人安家。',
  },
  {
    id: 'OCRACOKE', name: '奥克拉科克', nameEn: 'Ocracoke Inlet', lng: -76.02, lat: 35.11,
    nation: 'free', size: 1, stance: 'friendly', pirateHaven: true, anchorageOnly: true,
    produces: [], wants: [],
    facilities: ['tavern'],
    blurb: '外滩群岛间的隐蔽锚地，浅滩交错。大船进不来，小船出得去——藏身的好地方，也是死地。',
  },
  {
    id: 'PHILADELPHIA', name: '费城', nameEn: 'Philadelphia', lng: -75.17, lat: 39.95,
    nation: 'en', size: 4, stance: 'wary',
    produces: ['grain', 'timber'], wants: ['sugar', 'rum', 'spice', 'coffee'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '贵格会的"兄弟友爱之城"，特拉华河上最规整的港口。',
  },
  {
    id: 'NEWYORK', name: '纽约', nameEn: 'New York', lng: -74.01, lat: 40.71,
    nation: 'en', size: 4, stance: 'wary',
    produces: ['grain', 'timber'], wants: ['sugar', 'rum', 'spice', 'ivory'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '从荷兰人手里夺来的新阿姆斯特丹。这里的商人从不介意跟"私掠者"做生意。',
  },
  {
    id: 'BOSTON', name: '波士顿', nameEn: 'Boston', lng: -71.06, lat: 42.36,
    nation: 'en', size: 4, stance: 'hostile',
    produces: ['timber', 'grain'], wants: ['sugar', 'rum', 'coffee', 'indigo'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '新英格兰的造船中心。清教徒的城市对海盗毫无耐心——绞刑架就立在码头边。',
  },
  // ===== 西非 =====
  {
    id: 'GOREE', name: '戈雷', nameEn: 'Gorée', lng: -17.40, lat: 14.67,
    nation: 'fr', size: 2, stance: 'neutral',
    produces: ['ivory', 'cotton'], wants: ['gunpowder', 'rum', 'grain', 'timber'],
    facilities: ['market', 'tavern', 'governor'],
    blurb: '佛得角半岛外的小岛，法国人的西非据点。补给贵，但这是横渡前最后的淡水。',
  },
  {
    id: 'SANTIAGOCV', name: '圣地亚哥岛', nameEn: 'Santiago, Cape Verde', lng: -23.51, lat: 14.92,
    nation: 'pt', size: 2, stance: 'neutral',
    produces: ['cotton', 'grain'], wants: ['timber', 'medicine', 'rum'],
    facilities: ['market', 'tavern', 'church'],
    blurb: '佛得角群岛的葡萄牙港口。信风从这里把船一路推到西印度群岛。',
  },
  {
    id: 'CAPECOAST', name: '海岸角', nameEn: 'Cape Coast Castle', lng: -1.24, lat: 5.10,
    nation: 'en', size: 3, stance: 'wary',
    produces: ['ivory', 'spice'], wants: ['gunpowder', 'rum', 'grain', 'cotton'],
    facilities: ['market', 'tavern', 'governor'],
    blurb: '黄金海岸的英国要塞，白色的城墙在赤道阳光下刺眼。',
  },
  {
    id: 'WHYDAH', name: '维达', nameEn: 'Whydah', lng: 2.09, lat: 6.36,
    nation: 'fr', size: 2, stance: 'neutral',
    produces: ['ivory'], wants: ['gunpowder', 'rum', 'medicine'],
    facilities: ['market', 'tavern'],
    blurb: '几内亚湾的贸易口岸。"维达号"就以此地为名——后来它成了萨姆·贝拉米的旗舰。',
  },
  // ===== 欧洲 =====
  {
    id: 'BRISTOL', name: '布里斯托尔', nameEn: 'Bristol', lng: -2.59, lat: 51.45,
    nation: 'en', size: 4, stance: 'hostile', homePort: true,
    produces: ['timber', 'gunpowder', 'medicine'], wants: ['sugar', 'tobacco', 'cocoa', 'ivory'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '爱德华·蒂奇出生的地方。艾冯河的潮水一天涨落两次，把远洋船一直送到城中心的码头。',
  },
  {
    id: 'LONDON', name: '伦敦', nameEn: 'London', lng: 0.07, lat: 51.51,
    nation: 'en', size: 5, stance: 'hostile',
    produces: ['gunpowder', 'medicine', 'timber'], wants: ['sugar', 'tobacco', 'spice', 'silver', 'ivory'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '帝国的心脏。泰晤士河边的处刑码头上，海盗的尸体要挂到三次潮水漫过为止。',
  },
  {
    id: 'NANTES', name: '南特', nameEn: 'Nantes', lng: -1.55, lat: 47.22,
    nation: 'fr', size: 4, stance: 'hostile',
    produces: ['gunpowder', 'medicine', 'grain'], wants: ['sugar', 'cocoa', 'coffee', 'ivory'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '卢瓦尔河口的法国大港。"协和号"就是从这里出发驶向几内亚的。',
  },
  {
    id: 'LISBON', name: '里斯本', nameEn: 'Lisbon', lng: -9.14, lat: 38.72,
    nation: 'pt', size: 4, stance: 'wary',
    produces: ['spice', 'timber'], wants: ['sugar', 'tobacco', 'silver', 'cocoa'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '特茹河口的葡萄牙王都，通往东方的航路从这里开始。',
  },
  {
    id: 'CADIZ', name: '加的斯', nameEn: 'Cádiz', lng: -6.29, lat: 36.53,
    nation: 'es', size: 4, stance: 'hostile',
    produces: ['gunpowder', 'medicine'], wants: ['silver', 'cocoa', 'tobacco', 'ivory'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '西班牙珍宝船队的终点。整个欧洲都盯着从这里卸下的白银。',
  },
  {
    id: 'AMSTERDAM', name: '阿姆斯特丹', nameEn: 'Amsterdam', lng: 4.90, lat: 52.37,
    nation: 'nl', size: 5, stance: 'wary',
    produces: ['spice', 'gunpowder', 'medicine'], wants: ['sugar', 'tobacco', 'cotton', 'ivory'],
    facilities: ['market', 'tavern', 'shipyard', 'governor', 'church'],
    blurb: '世界的仓库。这里能买到任何东西——包括不该卖的东西。',
  },
];

export const PORT_BY_ID = Object.fromEntries(PORTS.map(p => [p.id, p]));

export const NATIONS = {
  en: { name: '英格兰', color: '#b23a33', flag: '🇬🇧' },
  es: { name: '西班牙', color: '#c8901f', flag: '🇪🇸' },
  fr: { name: '法兰西', color: '#3a5fb2', flag: '🇫🇷' },
  nl: { name: '荷兰', color: '#d4761f', flag: '🇳🇱' },
  pt: { name: '葡萄牙', color: '#2f7d4f', flag: '🇵🇹' },
  free: { name: '自由港', color: '#2b2b2b', flag: '🏴‍☠️' },
};
