// 第二章 · 食莲人之岛
// 引入「忍耐」的真正用法：这一章完全没有敌人，最好的结果是一刀不动地把人带回来。
export const SCRIPT = { id: 'ch02', nodes: {

  start: { bg: 'lotus_isle', who: null,
    text: `九天大风把船队吹出了所有的海图。<br><br>
      第十天靠上的这座岛，空气是甜的。岸上开满了一种你没见过的花。`,
    next: 'n1' },

  n1: { who: 'odysseus', emote: 'calm',
    text: `你派了三个人上岸打听——这里住着什么人，吃什么，肯不肯给水。<br><br>
      按规矩，他们该在日落前回来。<br><br>
      日落了。`,
    next: 'n2' },

  n2: { bg: 'lotus_isle', who: 'lotusman', emote: 'smile',
    text: `你亲自上岸找。<br><br>
      岛上的人很客气，一点也不像要打架的样子。<br>
      他们迎上来，捧着一盘花：「吃一朵吧，客人。吃了就不用走了。」`,
    choices: [
      { label: '接过来看看。', next: 'taste', act: { hubris: 3 } },
      { label: '🜃 摆手谢绝，只问我的人在哪里。', endureCost: 1, next: 'find',
        act: { athena: 2, notes: ['n_xenia'] }, hint: '忍耐 −1' },
    ] },

  taste: { who: 'odysseus', emote: 'shock',
    text: `花瓣碰到舌头的一瞬间，你想起了伊塔卡后山的橄榄林。<br>
      味道对得可怕。<br><br>
      <i>你把花扔了。手在抖。</i><br><br>
      「我的人在哪里。」`,
    next: 'find' },

  find: { bg: 'lotus_isle', who: 'crew', emote: 'smile', nameAs: '你的三个人',
    text: `他们坐在花丛里，面前摆着吃剩的花瓣。<br><br>
      看见你，他们抬了抬头，笑了一下，然后又低下去。<br><br>
      「船长，你也坐吧。」<br>
      「回家干嘛呢。」<br>
      「我已经想不起来我家在哪儿了——真好啊。」`,
    next: 'brief' },

  brief: { who: 'eurylochus', emote: 'angry',
    text: `「捆起来拖走就完了。」欧律洛科斯已经在解绳子。<br><br>
      「三个人而已，船长。绑上船，扔进舱底，等他们醒。」`,
    choices: [
      { label: '「绑。我们没时间。」', next: 'rope', act: { crew: -3, hubris: 4 } },
      { label: '🜃 「等一下。让我先跟他们说句话。」', endureCost: 1, next: 'puzzle',
        hint: '忍耐 −1 · 试着把他们叫醒' },
    ] },

  rope: { bg: 'ship_day', who: 'odysseus', emote: 'sad',
    text: `他们被绑在桨座下面，一路都在哭着要回岸上去。<br><br>
      到第三天，其中一个挣脱了绳子跳下了海。剩下两个再也没有笑过。<br><br>
      <i>你带回了人，可你带回来的已经不完全是原来那三个人了。</i>`,
    act: { log: '食莲人之岛：三个人被绑上了船，只回来两个。' },
    next: 'leave' },

  puzzle: { puzzle: 'lotus', okNext: 'wake_ok', failNext: 'wake_bad' },

  wake_ok: { bg: 'lotus_isle', who: 'odysseus', emote: 'smile',
    text: `三个人陆续站了起来。<br><br>
      最后一个站起来的时候，眼泪一下子涌出来——他终于想起了自己是谁。<br><br>
      <i>你一刀没动，一个人没少。<br>
      这就是「忍耐」真正的用处：不是挨打，是不动手也能把事办成。</i>`,
    act: { peitho: 1, kleos: 10, athena: 2, log: '食莲人之岛：你把三个人劝醒了，一个都没少。' },
    next: 'leave' },

  wake_bad: { who: 'odysseus', emote: 'sad',
    text: `有两个听懂了。第三个没有。<br><br>
      最后还是绑上了船。他一路都在问：「我们为什么要走？」<br><br>
      <i>你答不上来。你只是知道必须走。</i>`,
    act: { crew: -1, kleos: 3, log: '食莲人之岛：两个劝醒了，一个是绑上船的。' },
    next: 'leave' },

  leave: { bg: 'ship_day', who: 'odysseus', emote: 'calm',
    text: `你下令：<b>所有人上船，谁都不许再上岸。</b><br><br>
      解缆的时候，岛上的人还站在花丛里朝你们挥手，笑得很温和。<br>
      他们没有恶意。他们从头到尾都没有恶意。<br><br>
      <i>这才是最可怕的地方。</i>`,
    act: { supply: -8 },
    next: 'end' },

  end: { chapterEnd: true, text: '' },
} };
