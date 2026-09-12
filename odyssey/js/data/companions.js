// 有名字的同伴 = 牌组里的一张牌。他们在剧情里死亡时，对应卡牌被永久移出牌组。
// 「十年归途只剩自己」这句话在机制上就是：你的牌组会越来越薄。
//
// 每个人都有一个 savedIf 条件——都很难达成，但都真实存在。
// 全部救下才可能走到「同归」结局。
export const COMPANIONS = [
  {
    id: 'eurylochus', name: '欧律洛科斯', card: 'co_eurylochus', icon: '🛡️',
    joinsAt: 0, diesAt: 9,
    look: { skin: '#d9a06b', hair: '#3a2a1c', beard: true, cloth: '#7a3b2a', head: 'helmet' },
    bio: '你的副手，也是你妹夫。全船最能打的人，也是每一次带头违抗你命令的人。',
    death: '在特里那喀亚岛，是他说服了所有人：与其饿死，不如吃掉太阳神的牛。',
    savedIf: '第 9 章的排班调度谜题拿到满分（29 天无人挨饿、无人叛变）。',
  },
  {
    id: 'perimedes', name: '珀里墨得斯', card: 'co_perimedes', icon: '🏹',
    joinsAt: 0, diesAt: 8,
    look: { skin: '#c98a58', hair: '#241f33', beard: false, cloth: '#4a6b8a', head: 'band' },
    bio: '话最少的一个。你让他做什么他就做什么，从不问为什么。',
    death: '斯库拉的六个头从崖上探下来时，他是被叼走的六个人之一。',
    savedIf: '第 8 章：手上有神物牌，且花掉 2 点忍耐把他按在桨位上。',
  },
  {
    id: 'elpenor', name: '埃尔佩诺耳', card: 'co_elpenor', icon: '🍷',
    joinsAt: 0, diesAt: 6,
    look: { skin: '#e8b98a', hair: '#8a6a2a', beard: false, cloth: '#6b7f4a', head: 'none' },
    bio: '船上最年轻的一个。不会打仗，不会掌舵，酒量还差——但每个人都喜欢他。',
    death: '在喀耳刻的屋顶上睡着了，听见启航的号声，忘了有梯子，直接站起来往下走。',
    savedIf: '第 6 章：配药谜题一次通过，并花 1 点忍耐上屋顶把他叫下来。',
  },
  {
    id: 'eurybates', name: '欧吕巴忒斯', card: 'co_eurybates', icon: '📯',
    joinsAt: 0, diesAt: 5,
    look: { skin: '#b87a4a', hair: '#2a2a2a', beard: true, cloth: '#d9a441', head: 'band' },
    bio: '你的传令官，从特洛伊起就跟着你。他记得每一个人的名字。',
    death: '莱斯特律戈涅斯人的巨石砸下来时，他在第二条船上吹号，让大家快撤。',
    savedIf: '第 5 章：在港湾图上把船停在湾外的那块礁石后面。',
  },
];

export const COMPANION_BY_ID = Object.fromEntries(COMPANIONS.map(c => [c.id, c]));
export const CARD_TO_COMPANION = Object.fromEntries(COMPANIONS.map(c => [c.card, c.id]));
