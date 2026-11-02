export function addBlast(state, point, radius, kind = 'shell') {
  const seed = (state.nextId * 977 + Math.round(point.x * 97 + point.y * 311)) >>> 0;
  state.effects.push({ type: 'blast', x: point.x, y: point.y, radius, kind, seed, life: 1.1, maxLife: 1.1 });
  state.effects.push({ type: 'smoke', x: point.x, y: point.y, radius: radius * 0.65, seed, life: 2.8, maxLife: 2.8 });
  if (kind !== 'air') state.effects.push({ type: 'scorch', x: point.x, y: point.y, radius: radius * 0.6, seed, life: 24, maxLife: 24 });
  state.shake = Math.max(state.shake || 0, kind === 'bomb' ? 0.55 : 0.2);
}
export function addImpact(state, enemy, explosive = false) {
  state.effects.push({ type: 'impact', x: enemy.x, y: enemy.y, armored: enemy.type === 'armor', seed: state.nextId + enemy.x * 17, life: explosive ? 0.45 : 0.24, maxLife: explosive ? 0.45 : 0.24 });
}
export function visualRandom(seed, index) {
  let n = (Math.imul((seed + index * 374761393) | 0, 668265263) ^ 1274126177) >>> 0;
  n = Math.imul(n ^ n >>> 13, 1274126177) >>> 0;
  return (n ^ n >>> 16) >>> 0;
}
export const vrand = (seed, index) => visualRandom(seed, index) / 4294967296;
