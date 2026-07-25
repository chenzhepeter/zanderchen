// 剧情推进：章节触发、旗标、三结局判定
import { state, addLog, saveGame, makeShip } from './state.js';
import { CHAPTERS, ENDINGS } from './data/chapters.js';
import { PORT_BY_ID } from './data/ports.js';

// UI 依赖延迟注入，避免与 ui.js 形成模块循环
let UI = null;
export function bindUI(ui) { UI = ui; }

export function describeChapter(n) {
  return CHAPTERS.find(c => c.num === n);
}

function chapterModal(ch, extraActions = []) {
  UI.openModal({
    title: `${ch.title}`,
    wide: true,
    body: `<div class="story">${ch.text}
      <p class="goal">🎯 <b>本章目标：</b>${ch.goal}</p>
      <p class="hist">📖 <b>史料：</b>${ch.note}</p></div>`,
    actions: extraActions.length ? extraActions
      : [{ label: '继续', primary: true, onClick: () => { UI.closeModal(); UI.refresh(); } }],
  });
}

// 新游戏或读档后调用：把当前章节的开场演出出来
export function tryChapter() {
  const ch = CHAPTERS.find(c => c.num === state.chapter);
  if (!ch) return false;
  if (state.flags['ch_shown_' + ch.num]) return false;
  state.flags['ch_shown_' + ch.num] = true;
  addLog(`【${ch.title}】${ch.goal}`);
  chapterModal(ch);
  saveGame();
  return true;
}

// 每日推进后检查：日期到了就进入下一章
export function onDayAdvanced() {
  const next = CHAPTERS.find(c => c.num === state.chapter + 1);
  if (!next || !next.trigger) return false;
  const t = next.trigger;
  if (t.flag) { if (!state.flags[t.flag]) return false; }
  else {
    const { y, m } = state.date;
    if (y < t.y) return false;
    if (t.m && y === t.y && m < t.m) return false;
  }
  state.chapter = next.num;
  onChapterStart(next);
  return tryChapter();
}

function onChapterStart(ch) {
  if (ch.num === 3) state.flags.canTakeQAR = true;
  if (ch.num === 5) state.flags.pardonOffered = true;
}

// ===== 第五章：赦免抉择（三线分歧点）=====
export function offerPardon() {
  UI.openModal({
    title: '国王的赦免状',
    wide: true,
    body: `<div class="story">
      <p>伊登总督把纸推过来，又推过来一支笔。</p>
      <p class="muted">签下去，过去的一切既往不咎。你可以做个体面人——前提是你受得了。</p>
      <p class="hist">📖 史实：蒂奇确实签了。然后在几个月内又回到了海上。</p></div>`,
    actions: [
      {
        label: '✍️ 签下名字（接受赦免）', primary: true, onClick: () => {
          UI.closeModal();
          state.flags.pardonAccepted = true;
          state.flags.chapter6 = true;
          state.player.infamy = Math.max(0, state.player.infamy - 25);
          state.player.fame += 15;
          addLog('接受了国王的赦免。海面很安静。');
          UI.toast('你接受了赦免。'); saveGame(); UI.refresh();
        },
      },
      {
        label: '🏴‍☠️ 把纸推回去（拒绝）', onClick: () => {
          UI.closeModal();
          state.flags.refusedPardon = true;
          state.flags.chapter6 = true;
          state.player.infamy += 20;
          addLog('拒绝了赦免。黑旗照旧升着。');
          UI.toast('你拒绝了赦免。'); saveGame(); UI.refresh();
        },
      },
    ],
  });
}

// 终章：玩家主动做出最终选择
export function finalChoices() {
  const acts = [];
  const p = state.player;
  if (state.flags.pardonAccepted && !state.flags.returnedToPiracy) {
    acts.push({
      label: '🏡 就此上岸，在巴斯镇安家', primary: true,
      onClick: () => { UI.closeModal(); finish(p.gold >= 6000 ? 'B' : 'A_retire'); },
    });
  }
  if (state.flags.pardonAccepted) {
    acts.push({
      label: '🏴‍☠️ 重新升起黑旗', onClick: () => {
        UI.closeModal();
        state.flags.returnedToPiracy = true;
        state.player.infamy += 25;
        addLog('黑旗再次升起——赦免状成了一张废纸。');
        UI.toast('你回到了海上。'); saveGame(); UI.refresh();
      },
    });
  }
  const allies = state.officers.filter(id => ['vane', 'rackham', 'bonnet', 'hornigold'].includes(id)).length;
  acts.push({
    label: `👑 联合各路船长，对抗罗杰斯总督（盟友 ${allies}/3，恶名 ${p.infamy}/60）`,
    onClick: () => {
      UI.closeModal();
      if (allies >= 3 && p.infamy >= 60) finish('C');
      else UI.toast('时机未到：需要至少 3 位海盗船长盟友，且恶名达到 60。');
    },
  });
  acts.push({
    label: '⚔️ 前往奥克拉科克，等梅纳德来', onClick: () => { UI.closeModal(); finish('A'); },
  });
  acts.push({ label: '再想想', onClick: () => UI.closeModal() });

  UI.openModal({
    title: '终章 · 三个抉择',
    wide: true,
    body: `<div class="story"><p>路就在脚下分成三条。</p>
      <p class="small muted">当前：金币 ${state.player.gold} ／ 声望 ${p.fame} ／ 恶名 ${p.infamy} ／ 盟友 ${allies}</p></div>`,
    actions: acts,
  });
}

// 结局判定：C → B → A 兜底
export function resolveEnding(force) {
  if (force && ENDINGS[force]) return ENDINGS[force];
  const p = state.player, f = state.flags;
  const allies = state.officers.filter(id => ['vane', 'rackham', 'bonnet', 'hornigold'].includes(id)).length;
  if (f.refusedPardon && p.infamy >= 60 && allies >= 3 && f.beatRogers) return ENDINGS.C;
  if (f.pardonAccepted && !f.returnedToPiracy && p.gold >= 6000) return ENDINGS.B;
  return ENDINGS.A;
}

function finish(code) {
  let ending;
  if (code === 'C') { state.flags.beatRogers = true; ending = ENDINGS.C; }
  else if (code === 'B') ending = ENDINGS.B;
  else if (code === 'A_retire') ending = ENDINGS.B;   // 上岸但家底不厚，仍归入"绅士"线
  else ending = ENDINGS.A;

  state.gameOver = true;
  state.ending = ending.id;
  addLog(`【结局】${ending.title}`);
  saveGame();
  UI.openModal({
    title: `${ending.title}　<span class="tag">${ending.kind}</span>`,
    wide: true,
    body: `<div class="story ending">${ending.text}
      <p class="hist">📖 <b>史料：</b>${ending.note}</p>
      <p class="small muted">本局：${state.date.y} 年 · 金币 ${state.player.gold} · 声望 ${state.player.fame} · 恶名 ${state.player.infamy} · 舰队 ${state.fleet.length} 艘</p></div>`,
    actions: [{ label: '完', primary: true, onClick: () => { UI.closeModal(); UI.refresh(); } }],
  });
}

// 剧情奖励：夺取安妮女王复仇号
export function grantQAR() {
  if (state.flags.hasQAR) return;
  state.flags.hasQAR = true;
  const sh = makeShip('qar');
  if (state.fleet.length >= 4) state.fleet.pop();
  state.fleet.push(sh);
  state.flagship = state.fleet.length - 1;
  state.player.infamy += 15;
  addLog('「协和号」改装完成——安妮女王复仇号，四十门炮。');
}
