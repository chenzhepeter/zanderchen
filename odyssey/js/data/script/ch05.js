// 第五章 · 莱斯特律戈涅斯
// 这一章之后，你从十二条船变成一条。欧吕巴忒斯的存亡挂在港湾谜题上。
export const SCRIPT = { id: 'ch05', nodes: {

  start: { bg: 'telepylos', who: null,
    text: `忒勒皮洛斯。这里的白天长得不像话——<br>
      牧人赶羊回来的时候，另一个牧人正赶着羊出去，两个人在门口打招呼。<br><br>
      <i>荷马说：在这里，不睡觉的人能挣两份工钱。</i>`,
    next: 'n1' },

  n1: { who: 'eurybates', emote: 'smile',
    text: `欧吕巴忒斯把号角别回腰上。<br><br>
      「船长，十一位船长都在等你的旗语。这湾里连个浪花都没有，
      弟兄们已经六天没睡过一个整觉了。」`,
    next: 'puzzle' },

  puzzle: { puzzle: 'harbor', okNext: 'outside', failNext: 'inside',
    okAct: { metis: 1, athena: 2, flags: ['harbor_outside'] } },

  outside: { bg: 'telepylos', who: 'odysseus', emote: 'calm',
    text: `你把旗舰系在湾外那块黑礁石的背面，船头朝外。<br><br>
      十一条船都进了湾。你打了旗语让他们出来，没有人理你——<br>
      湾里太舒服了。`,
    next: 'attack' },

  inside: { bg: 'telepylos', who: 'odysseus', emote: 'calm',
    text: `十二条船一起开进了湾。<br><br>
      所有人都睡得很沉。这是六天来第一个安稳觉。`,
    next: 'attack' },

  attack: { bg: 'telepylos', who: 'laestry', emote: 'angry',
    text: `打水的姑娘回家告诉了她父亲。<br><br>
      崖顶上开始出现人影，一个，十个，几百个——每一个都有三个人那么高。<br><br>
      然后石头下来了。`,
    next: 'battle' },

  battle: {
    battle: 'e_laestry', bg: 'telepylos',
    yieldNext: 'aftermath', killNext: 'aftermath', loseNext: 'aftermath',
    yieldAct: { kleos: 8, athena: 1 },
    killAct: { hubris: 5, kleos: 5, bie: 1 },
    loseAct: { crew: -20 },
  },

  aftermath: { bg: 'ship_day', who: 'odysseus', emote: 'sad',
    text: `你砍断了缆绳，喊所有人拼命划。<br><br>
      回头看的时候，湾里已经没有船了。只有崖顶上的人在把落水的人一个一个叉起来。<br><br>
      <i>十一条船。五百多个人。用了不到一炷香。</i>`,
    next: 'roll' },

  roll: { who: 'odysseus', emote: 'sad',
    text: `点名的时候，第二条船上那个吹号的人没有应声。`,
    next: 'check' },

  // 欧吕巴忒斯的生死：只有把船停在湾外才救得下他
  check: { branch: [{ if: { flag: 'harbor_outside' }, next: 'saved' }], next: 'lost' },

  saved: { who: 'eurybates', emote: 'weary',
    text: `——然后有人从舱底爬了上来，浑身是水，号角还挂在脖子上。<br><br>
      「船长。」欧吕巴忒斯咳出一大口海水，<br>
      「我在礁石背面……我就是跟着你的船绳游过来的。」<br><br>
      <i>你把船停在了湾外。这一个决定，救了他。</i>`,
    act: { save: ['eurybates'], kleos: 10, athena: 2, log: '欧吕巴忒斯从礁石那边游了回来。' },
    next: 'ships' },

  lost: { who: 'odysseus', emote: 'cry',
    text: `他在第二条船上吹号，让大家快撤。<br><br>
      他吹到了最后一刻。<br><br>
      <i>——牌组永久失去「📯 欧吕巴忒斯」。<br>
      从今往后，你的手里少了一张牌。</i>`,
    act: { kill: ['eurybates'] },
    next: 'ships' },

  ships: { bg: 'ship_day', who: 'odysseus', emote: 'weary',
    text: `一条船。<br><br>
      从特洛伊出发时是十二条，六百个人。<br>
      现在是一条船，剩下的人一条船装得下。<br><br>
      <i>你把这件事记在了航海日志上，然后合上了本子。</i>`,
    act: { ships: -11, crew: -420, supply: -10,
           log: '忒勒皮洛斯：十一条船，五百多人，一炷香。' },
    next: 'end' },

  end: { chapterEnd: true, text: '' },
} };
