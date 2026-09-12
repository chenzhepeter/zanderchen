// 牌堆管理：抽牌堆 / 手牌 / 弃牌堆 / 耗尽区。
// 战斗内的牌堆是 state.deck 的一份拷贝——战斗中的耗尽不影响牌组母本，
// 只有 once 牌（风袋）和净化才会回写 state.deck。
import { CARDS } from './data/cards.js';

export function buildPiles(deckIds, rand = Math.random) {
  return { draw: shuffle([...deckIds], rand), hand: [], discard: [], exhaust: [] };
}

export function shuffle(arr, rand = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 抽 n 张；抽牌堆空了就把弃牌堆洗回去。两边都空则抽不满，返回实际抽到的牌。
export function drawCards(p, n, rand = Math.random) {
  const got = [];
  for (let i = 0; i < n; i++) {
    if (!p.draw.length) {
      if (!p.discard.length) break;
      p.draw = shuffle(p.discard, rand);
      p.discard = [];
    }
    const id = p.draw.pop();
    p.hand.push(id);
    got.push(id);
  }
  return got;
}

export function discardHand(p) {
  p.discard.push(...p.hand);
  p.hand = [];
}

// 从手牌里拿掉一张（按索引），送去弃牌堆或耗尽区
export function leaveHand(p, idx, to = 'discard') {
  const id = p.hand.splice(idx, 1)[0];
  if (to === 'exhaust') p.exhaust.push(id);
  else if (to === 'discard') p.discard.push(id);
  return id;
}

export function handIndexOfWrath(p) {
  return p.hand.findIndex(id => CARDS[id]?.color === 'wrath');
}

export function countIn(list, id) { return list.filter(x => x === id).length; }

// 牌组母本按 id 归类计数，面板里展示用
export function groupDeck(ids) {
  const m = new Map();
  for (const id of ids) m.set(id, (m.get(id) || 0) + 1);
  const order = { bie: 0, metis: 1, peitho: 2, endure: 3, companion: 4, relic: 5, wrath: 6 };
  return [...m.entries()]
    .map(([id, n]) => ({ card: CARDS[id], n }))
    .filter(x => x.card)
    .sort((a, b) => (order[a.card.color] - order[b.card.color]) || (a.card.cost - b.card.cost));
}
