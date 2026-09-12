// 第十一章 · 淮阿喀亚的宴席
// 名声在这一章兑现。这也是全诗结构上最妙的一处：主角自己成了叙述者。
export const SCRIPT = { id: 'ch11', nodes: {

  start: { bg: 'scheria', who: 'nausicaa', emote: 'shock',
    text: `是洗衣服的声音把你吵醒的。<br><br>
      国王的女儿瑙西卡带着女伴在河边洗衣裳。别人看见你都跑了，只有她站着没动。<br><br>
      <i>你没有抱她的膝盖求她——你满身盐渍、赤身裸体，那样只会吓着她。<br>
      你隔着一段距离，站在树丛后面，说了一段很好听的话。</i>`,
    act: { peitho: 1 },
    next: 'n1' },

  n1: { who: 'nausicaa', emote: 'calm',
    text: `「客人，你看起来不像坏人，也不像蠢人。」<br><br>
      「宙斯把好运气分给谁，是他自己的事。你落到今天这样，得受着。」<br><br>
      她给了你衣服、油和食物，然后指了一条进城的路。<br><br>
      「进城以后别跟我一起走——人多嘴杂。<br>
      你自己进王宫，<b>先去抱我母亲的膝盖</b>。她答应了，事就成了。」`,
    act: { supply: 25, kleos: 6, notes: ['n_xenia'] },
    next: 'feast' },

  feast: { bg: 'scheria', who: 'alcinous', emote: 'smile',
    text: `王宫的墙是铜的，门是金的，门柱是银的，园子里的果树一年四季都在结果。<br><br>
      他们照规矩款待了你：先洗浴，先吃饱，先给座位——<br>
      <b>最后才问你是谁。</b>`,
    next: 'song' },

  song: { who: 'demodocus', emote: 'calm',
    text: `盲眼的歌手得摩多科斯抱着琴坐下，唱起了特洛伊城下的事。<br><br>
      他唱到了那匹木马，唱到了藏在里面的人，唱到了那个想出这个主意的人。<br><br>
      <i>你把斗篷拉起来，蒙住了头。</i>`,
    next: 'cry' },

  cry: { who: 'odysseus', emote: 'cry',
    text: `<i>荷马在这里放了全诗最漂亮的一个比喻：</i><br><br>
      他哭得像一个女人——抱着刚刚战死在自己城前的丈夫，
      而背后的枪杆正在把她往奴隶的日子里赶。<br><br>
      <i>写一个刚刚听见自己英雄事迹的英雄，荷马用的是<b>战败者遗孀</b>的比喻。</i>`,
    act: { kleos: 8 },
    next: 'ask' },

  ask: { who: 'alcinous', emote: 'calm',
    text: `国王放下酒杯，让歌手停下。<br><br>
      「客人，别哭了。」<br><br>
      「告诉我们你的名字——你父母给你起的那个名字。<br>
      没有人是没有名字的。」`,
    next: 'name' },

  name: { who: 'odysseus', emote: 'calm',
    text: `「我是<b>拉厄耳忒斯之子奥德修斯</b>。」<br><br>
      「我的计谋，人人都知道；我的名声，已经上了天。」<br><br>
      「我住在伊塔卡——一座粗粝的小岛，长不出什么东西。<br>
      <i>可是一个人看不见比故乡更甜的东西。</i>」`,
    act: { kleos: 10 },
    next: 'puzzle' },

  puzzle: { puzzle: 'retell', okNext: 'gifts', failNext: 'gifts' },

  gifts: { bg: 'scheria', who: 'alcinous', emote: 'smile',
    text: `他们给你装了一船东西：铜鼎、金杯、织好的衣裳。<br><br>
      「明天送你回去。我们的船不需要舵手——<br>
      它们自己认得每一座城，也从来不会迷路。」`,
    act: { supply: 40, arrows: 12, kleos: 12,
           log: '淮阿喀亚人送了他一船礼物，并用他们的快船送他回伊塔卡。' },
    next: 'shrine' },

  shrine: { who: 'alcinous', emote: 'calm',
    text: `临走前，国王带你去了海边的神庙。<br><br>
      「你身上跟着海里那位的怒气。我们全族都靠海吃饭，
      这点事我们看得出来。」<br><br>
      <i>（第三次、也是最后一次<b>永久移除神怒牌</b>的机会。）</i>`,
    choices: [
      { label: '献出一半赠礼。', next: 'purge', act: { supply: -20, purgeWrath: 1 },
        hint: '永久移除一张神怒牌' },
      { label: '不换。这些东西是要带回伊塔卡的。', next: 'sail' },
    ] },

  purge: { who: 'odysseus', emote: 'calm',
    text: `铜鼎沉进了海里。<br><br>
      <i>牌组里又少了一张神怒牌。</i>`,
    next: 'sail' },

  sail: { bg: 'ship_night', who: null,
    text: `他们把你抬上船的时候，你已经睡着了——<br>
      这是二十年来第一次睡得那么沉。<br><br>
      船在夜里划过大海，快得像鹰。<br><br>
      <i>他们把你连人带礼物一起放在伊塔卡的沙滩上，然后掉头走了。<br>
      你醒来的时候，家已经在脚下，而你自己还不知道。</i>`,
    next: 'end' },

  end: { chapterEnd: true, text: '' },
} };
