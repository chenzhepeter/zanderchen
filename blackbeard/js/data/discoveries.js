// 发现物：原版《大航海时代2》最主要的探险收入线。
// 驶近 sightNm 之内即"发现"，之后到里斯本/阿姆斯特丹/伦敦的邸宅上缴收藏家换金币 + 冒险名声。
// kind: cape 岬 / strait 海峡 / island 岛屿 / ruin 遗迹 / life 生物 / bay 港湾 / land 陆地

export const DISCOVERIES = [
  // ===== 大西洋（主战场，靠得近、奖励低）=====
  { id: 'd_lizard', name: '利泽德角', nameEn: 'Lizard Point', kind: 'cape', lng: -5.2, lat: 49.9, sightNm: 40, fame: 8, reward: 900, blurb: '英格兰最南端的岬角，出大西洋的船最后看见的一块陆地。', note: '历来是英吉利海峡的landfall标志。' },
  { id: 'd_finisterre', name: '菲尼斯特雷角', nameEn: 'Cape Finisterre', kind: 'cape', lng: -9.27, lat: 42.9, sightNm: 45, fame: 10, reward: 1200, blurb: '罗马人以为这里是"大地的尽头"。', note: 'Finis Terrae——世界的终点。' },
  { id: 'd_stvincent', name: '圣文森特角', nameEn: 'Cape St. Vincent', kind: 'cape', lng: -8.99, lat: 37.02, sightNm: 45, fame: 10, reward: 1300, blurb: '伊比利亚西南角，恩里克王子的航海学校就在附近。', note: '萨格里什航海学校推动了葡萄牙的大航海。' },
  { id: 'd_gibraltar', name: '直布罗陀海峡', nameEn: 'Strait of Gibraltar', kind: 'strait', lng: -5.6, lat: 35.95, sightNm: 40, fame: 14, reward: 2200, blurb: '地中海的门闩，两侧是传说中的"赫拉克勒斯之柱"。', note: '古代认为这里是已知世界的西界。' },
  { id: 'd_azores', name: '亚速尔群岛', nameEn: 'Azores', kind: 'island', lng: -25.7, lat: 37.7, sightNm: 70, fame: 16, reward: 3200, blurb: '大西洋正中的火山群岛，回航的船在这里等西风。', note: '葡萄牙人 1427 年前后抵达，是横渡航路的枢纽。' },
  { id: 'd_madeira', name: '马德拉岛', nameEn: 'Madeira', kind: 'island', lng: -16.9, lat: 32.75, sightNm: 55, fame: 12, reward: 1800, blurb: '满山的葡萄园，酒装桶越过赤道反而更好喝。', note: '马德拉酒因远航受热而闻名。' },
  { id: 'd_canary', name: '加那利群岛', nameEn: 'Canary Islands', kind: 'island', lng: -16.5, lat: 28.3, sightNm: 60, fame: 12, reward: 1900, blurb: '西行船队的最后补给站，信风从这里推着你走。', note: '哥伦布四次西航都在此地补给。' },
  { id: 'd_capeverde', name: '佛得角群岛', nameEn: 'Cape Verde Islands', kind: 'island', lng: -23.6, lat: 15.1, sightNm: 60, fame: 14, reward: 2400, blurb: '非洲西端外海的干旱群岛，盐和奴隶的中转站。', note: '1456 年前后为葡萄牙人发现。' },
  { id: 'd_bermuda', name: '百慕大', nameEn: 'Bermuda', kind: 'island', lng: -64.75, lat: 32.3, sightNm: 45, fame: 18, reward: 3600, blurb: '孤悬北大西洋的珊瑚岛，四周礁石吃过太多船。', note: '1609 年"海冒险号"在此触礁，据说启发了《暴风雨》。' },
  { id: 'd_hatteras', name: '哈特拉斯角', nameEn: 'Cape Hatteras', kind: 'cape', lng: -75.53, lat: 35.25, sightNm: 40, fame: 14, reward: 2100, blurb: '"大西洋的坟场"——暖流与寒流在此相撞，浅滩游移不定。', note: '外滩群岛沉船数以千计。' },
  { id: 'd_floridastrait', name: '佛罗里达海峡', nameEn: 'Florida Straits', kind: 'strait', lng: -80.5, lat: 24.5, sightNm: 45, fame: 16, reward: 2800, blurb: '湾流从这里冲出加勒比，珍宝船队年年借它北上。', note: '1622 年"阿托查夫人号"即沉于此。' },
  { id: 'd_windward', name: '向风海峡', nameEn: 'Windward Passage', kind: 'strait', lng: -74.0, lat: 20.0, sightNm: 40, fame: 14, reward: 2300, blurb: '古巴与伊斯帕尼奥拉之间的水道，海盗的猎场。', note: '进出加勒比的要冲。' },
  { id: 'd_yucatan', name: '尤卡坦海峡', nameEn: 'Yucatán Channel', kind: 'strait', lng: -85.5, lat: 21.5, sightNm: 45, fame: 15, reward: 2500, blurb: '墨西哥湾的入口，水流急得能把船推着走。', note: '湾流的源头段。' },
  { id: 'd_orinoco', name: '奥里诺科河口', nameEn: 'Orinoco Delta', kind: 'bay', lng: -61.0, lat: 9.2, sightNm: 45, fame: 18, reward: 3400, blurb: '淡水在离岸数十海里外仍未被咸水吞没。', note: '哥伦布见此断定前方是"大陆"而非岛屿。' },
  { id: 'd_amazon', name: '亚马孙河口', nameEn: 'Amazon Estuary', kind: 'bay', lng: -50.0, lat: 0.5, sightNm: 60, fame: 26, reward: 6800, blurb: '河口宽得看不到对岸，褐色的淡水把海面染出一道界线。', note: '1500 年由品松发现，称"甜海"。' },
  { id: 'd_recife', name: '圣罗克角', nameEn: 'Cape São Roque', kind: 'cape', lng: -35.25, lat: -5.2, sightNm: 45, fame: 20, reward: 4200, blurb: '南美最东端，横渡南大西洋的转折点。', note: '葡西《托尔德西里亚斯条约》分界线附近。' },
  { id: 'd_sargasso', name: '马尾藻海', nameEn: 'Sargasso Sea', kind: 'life', lng: -55.0, lat: 28.0, sightNm: 80, fame: 20, reward: 4400, blurb: '没有海岸的海：海面浮着一望无际的金褐色藻毯，风也常常停在这里。', note: '哥伦布船队曾误以为接近陆地。' },

  // ===== 西非（沿岸南下，中等奖励）=====
  { id: 'd_bojador', name: '博哈多尔角', nameEn: 'Cape Bojador', kind: 'cape', lng: -14.5, lat: 26.1, sightNm: 40, fame: 22, reward: 5200, blurb: '水手世代相传：过了此角，海水沸腾、船只再不能回头。', note: '1434 年吉尔·埃阿尼什越过它，破除了大航海时代最著名的恐惧。' },
  { id: 'd_verde', name: '佛得角', nameEn: 'Cape Verde', kind: 'cape', lng: -17.53, lat: 14.73, sightNm: 40, fame: 20, reward: 4200, blurb: '非洲最西端，撒哈拉的黄与几内亚的绿在此交界。', note: '1444 年由迪尼什·迪亚士抵达。' },
  { id: 'd_palmas', name: '棕榈角', nameEn: 'Cape Palmas', kind: 'cape', lng: -7.72, lat: 4.37, sightNm: 40, fame: 22, reward: 4800, blurb: '西非海岸在此向东急转，进入几内亚湾。', note: '胡椒海岸与象牙海岸的分界。' },
  { id: 'd_guinea', name: '几内亚湾', nameEn: 'Gulf of Guinea', kind: 'bay', lng: 2.0, lat: 3.0, sightNm: 90, fame: 24, reward: 5600, blurb: '赤道正下方的大海湾，闷热、无风、多雨。', note: '黄金海岸、奴隶海岸皆在此弧线上。' },
  { id: 'd_congo', name: '刚果河口', nameEn: 'Congo Estuary', kind: 'bay', lng: 12.4, lat: -6.0, sightNm: 50, fame: 28, reward: 7400, blurb: '巨量淡水涌出，把海水推开上百海里。', note: '1482 年迪奥戈·康发现，立石为记。' },
  { id: 'd_goodhope', name: '好望角', nameEn: 'Cape of Good Hope', kind: 'cape', lng: 18.47, lat: -34.36, sightNm: 55, fame: 45, reward: 22000, blurb: '两洋在此交汇，风与浪终年不歇。绕过它，通往东方的路就打开了。', note: '1488 年迪亚士抵达，初名"风暴角"，若昂二世改称"好望角"。' },
  { id: 'd_agulhas', name: '厄加勒斯角', nameEn: 'Cape Agulhas', kind: 'cape', lng: 20.0, lat: -34.83, sightNm: 45, fame: 34, reward: 12000, blurb: '非洲真正的最南端，罗盘在此不偏不倚地指着正北。', note: 'Agulhas 即"罗盘针"之意。' },

  // ===== 印度洋 / 东方（远航高奖励）=====
  { id: 'd_madagascar', name: '马达加斯加', nameEn: 'Madagascar', kind: 'island', lng: 46.0, lat: -19.0, sightNm: 90, fame: 38, reward: 16000, blurb: '比想象中大得多的岛，岛上的树和兽都没在别处见过。', note: '后来成为印度洋海盗的巢穴。' },
  { id: 'd_mozchannel', name: '莫桑比克海峡', nameEn: 'Mozambique Channel', kind: 'strait', lng: 41.0, lat: -18.0, sightNm: 70, fame: 34, reward: 12500, blurb: '大陆与巨岛之间的长水道，暗流与季风都难对付。', note: '通往印度的东非航路要冲。' },
  { id: 'd_calicut', name: '马拉巴尔海岸', nameEn: 'Malabar Coast', kind: 'land', lng: 75.5, lat: 11.5, sightNm: 60, fame: 48, reward: 26000, blurb: '胡椒之乡。达·伽马跪下亲吻沙滩的地方。', note: '1498 年葡萄牙人抵达卡利卡特，欧洲直通印度的航路自此打通。' },
  { id: 'd_ceylon', name: '锡兰岛', nameEn: 'Ceylon', kind: 'island', lng: 80.7, lat: 7.5, sightNm: 60, fame: 42, reward: 20000, blurb: '肉桂的香气顺风飘出几十海里。', note: '锡兰肉桂曾是欧洲最昂贵的香料之一。' },
  { id: 'd_malacca', name: '马六甲海峡', nameEn: 'Strait of Malacca', kind: 'strait', lng: 100.5, lat: 2.5, sightNm: 55, fame: 50, reward: 30000, blurb: '两洋之间最窄的咽喉，谁扼住它谁就掐住了香料贸易。', note: '1511 年葡萄牙攻占马六甲。' },
  { id: 'd_spice', name: '香料群岛', nameEn: 'Spice Islands', kind: 'island', lng: 127.5, lat: -1.0, sightNm: 60, fame: 60, reward: 42000, blurb: '丁香与肉豆蔻真正的原产地——全世界找了它一千年。', note: '摩鹿加群岛，麦哲伦船队的终极目标。' },
  { id: 'd_goodhopewind', name: '咆哮西风带', nameEn: 'Roaring Forties', kind: 'life', lng: 30.0, lat: -42.0, sightNm: 120, fame: 40, reward: 15000, blurb: '南纬四十度以下，风从不停歇，浪比桅杆还高。', note: '后来的帆船靠它一路狂奔到澳洲。' },

  // ===== 美洲深处 / 太平洋（最远、最高奖励）=====
  { id: 'd_magellan', name: '麦哲伦海峡', nameEn: 'Strait of Magellan', kind: 'strait', lng: -71.0, lat: -53.5, sightNm: 55, fame: 62, reward: 46000, blurb: '在大陆最南端的迷宫般水道里穿行三十八天，出口是另一个大洋。', note: '1520 年麦哲伦船队通过，命名"太平洋"。' },
  { id: 'd_horn', name: '合恩角', nameEn: 'Cape Horn', kind: 'cape', lng: -67.28, lat: -55.98, sightNm: 50, fame: 58, reward: 40000, blurb: '美洲的最后一块岩石。绕过它的水手才有资格在耳朵上戴金环。', note: '1616 年由荷兰人斯豪滕命名。' },
  { id: 'd_riodelaplata', name: '拉普拉塔河口', nameEn: 'Río de la Plata', kind: 'bay', lng: -56.5, lat: -35.0, sightNm: 60, fame: 30, reward: 9000, blurb: '宽阔得像海湾的河口，人们曾以为它是通往太平洋的水道。', note: '1516 年索利斯发现，误认为海峡。' },
  { id: 'd_galapagos', name: '加拉帕戈斯群岛', nameEn: 'Galápagos', kind: 'island', lng: -90.5, lat: -0.5, sightNm: 70, fame: 55, reward: 36000, blurb: '岛上的巨龟大得能驮起一个人，鸟也不怕人。', note: '1535 年由贝兰加主教偶然发现。' },
  { id: 'd_hawaii', name: '夏威夷群岛', nameEn: 'Hawaiian Islands', kind: 'island', lng: -157.0, lat: 20.5, sightNm: 80, fame: 70, reward: 55000, blurb: '太平洋正中的火山群岛，离任何一块大陆都有数千海里。', note: '这个年代的欧洲海图上还是一片空白。' },
  { id: 'd_tahiti', name: '塔希提', nameEn: 'Tahiti', kind: 'island', lng: -149.5, lat: -17.6, sightNm: 60, fame: 68, reward: 50000, blurb: '棕榈、礁湖与从未见过欧洲船的居民。', note: '欧洲人 1767 年才"发现"它。' },
  { id: 'd_greatbarrier', name: '大堡礁', nameEn: 'Great Barrier Reef', kind: 'life', lng: 147.0, lat: -18.0, sightNm: 70, fame: 66, reward: 48000, blurb: '水下的珊瑚长城，延绵得看不到头——也撞碎过看不到头的船。', note: '1770 年库克的"奋进号"在此触礁。' },
  { id: 'd_iceland', name: '冰岛', nameEn: 'Iceland', kind: 'island', lng: -19.0, lat: 64.9, sightNm: 70, fame: 30, reward: 8600, blurb: '火与冰同在一岛：冒烟的山顶上盖着积雪。', note: '维京人 9 世纪定居，是北大西洋航路的跳板。' },
  { id: 'd_greenland', name: '格陵兰', nameEn: 'Greenland', kind: 'land', lng: -45.0, lat: 61.0, sightNm: 80, fame: 44, reward: 21000, blurb: '"绿色的土地"——命名者显然是个高明的推销员。', note: '红发埃里克 985 年命名，以吸引移民。' },
  { id: 'd_newfoundland', name: '纽芬兰大浅滩', nameEn: 'Grand Banks', kind: 'life', lng: -50.0, lat: 45.5, sightNm: 80, fame: 26, reward: 6400, blurb: '鳕鱼多到用篮子就能捞上来，据说船都会被鱼群顶得慢下来。', note: '1497 年卡波特报告后，欧洲渔船蜂拥而至。' },
  { id: 'd_stlawrence', name: '圣劳伦斯湾', nameEn: 'Gulf of St. Lawrence', kind: 'bay', lng: -62.0, lat: 48.5, sightNm: 60, fame: 28, reward: 7200, blurb: '通往北美内陆的大门，一度被当作通往中国的水道。', note: '1534 年卡蒂埃探入。' },
];

export const DISCOVERY_BY_ID = Object.fromEntries(DISCOVERIES.map(d => [d.id, d]));

export const KIND_NAME = {
  cape: '岬角', strait: '海峡', island: '岛屿',
  ruin: '遗迹', life: '自然奇观', bay: '海湾', land: '陆地',
};

// 收藏家：上缴发现物的地点（原版是在邸宅里）
export const COLLECTORS = [
  { port: 'LISBON', name: '制图师 马可', bonus: 1.0, blurb: '「拿来我看看——每一处都要标上经纬度。」' },
  { port: 'AMSTERDAM', name: '学者 墨卡托', bonus: 1.15, blurb: '「投影法是我的执念，而你的见闻是我的材料。」' },
  { port: 'LONDON', name: '皇家学会 莫德斯教授', bonus: 1.1, blurb: '「学会愿意为可信的记录付钱，先生。可信是关键。」' },
];
