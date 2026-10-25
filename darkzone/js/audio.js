// audio.js — WebAudio 合成音效（无外部音频资产）
let ctx = null;
let master = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
}

function now() { return ctx.currentTime; }

function tone({ freq, freq2, type = 'sine', dur = 0.15, vol = 0.3, delay = 0, attack = 0.005, release = 0.08 }) {
  if (!ctx) return;
  const t0 = now() + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (freq2) o.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
  o.connect(g); g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + release + 0.02);
}

function noise({ dur = 0.2, vol = 0.25, delay = 0, filterFreq = 800, type = 'lowpass', q = 1, sweep }) {
  if (!ctx) return;
  const t0 = now() + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(filterFreq, t0);
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), t0 + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

function volByDist(dist, hear, vol) {
  if (dist == null) return vol;
  const f = Math.max(0, 1 - dist / hear);
  return vol * (0.25 + 0.75 * f * f);
}

export const sfx = {
  uiClick() { tone({ freq: 660, type: 'triangle', dur: 0.05, vol: 0.18 }); },
  footstep(quiet = false, dist, hear) {
    noise({ dur: 0.08, vol: volByDist(dist, hear, quiet ? 0.05 : 0.12), filterFreq: quiet ? 160 : 260 });
  },
  switchClick(dist, hear) {
    tone({ freq: 1800, type: 'square', dur: 0.04, vol: volByDist(dist, hear, 0.18), release: 0.03 });
  },
  doorOpen(dist, hear, slow = false) {
    noise({ dur: slow ? 0.45 : 0.18, vol: volByDist(dist, hear, slow ? 0.05 : 0.16), filterFreq: 500, sweep: 200 });
  },
  doorClose(dist, hear) {
    tone({ freq: 140, freq2: 60, type: 'sine', dur: 0.12, vol: volByDist(dist, hear, 0.4) });
    noise({ dur: 0.1, vol: volByDist(dist, hear, 0.2), filterFreq: 300 });
  },
  kick(dist, hear) {
    tone({ freq: 90, freq2: 45, type: 'sine', dur: 0.25, vol: volByDist(dist, hear, 0.5) });
    noise({ dur: 0.22, vol: volByDist(dist, hear, 0.3), filterFreq: 250 });
  },
  pickup() {
    tone({ freq: 520, type: 'triangle', dur: 0.07, vol: 0.22 });
    tone({ freq: 780, type: 'triangle', dur: 0.1, vol: 0.22, delay: 0.08 });
  },
  clue() {
    tone({ freq: 440, type: 'sine', dur: 0.1, vol: 0.16 });
    tone({ freq: 660, type: 'sine', dur: 0.14, vol: 0.16, delay: 0.1 });
  },
  beep(dist, hear) {
    for (let i = 0; i < 3; i++) {
      tone({ freq: 980, type: 'square', dur: 0.12, vol: volByDist(dist, hear, 0.22), delay: i * 0.16, release: 0.05 });
    }
  },
  keypadOk(dist, hear) {
    [523, 659, 784].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.12, vol: volByDist(dist, hear, 0.22), delay: i * 0.1 }));
  },
  throwWhoosh() { noise({ dur: 0.25, vol: 0.12, filterFreq: 1200, sweep: 400 }); },
  canLand(dist, hear) {
    tone({ freq: 1600, freq2: 900, type: 'square', dur: 0.08, vol: volByDist(dist, hear, 0.2), release: 0.06 });
    noise({ dur: 0.1, vol: volByDist(dist, hear, 0.15), filterFreq: 2500 });
  },
  microwave(dist, hear) {
    for (let i = 0; i < 4; i++) {
      tone({ freq: 1100 + (i % 2) * 200, type: 'square', dur: 0.18, vol: volByDist(dist, hear, 0.16), delay: i * 0.25 });
    }
  },
  question(dist, hear) {
    tone({ freq: 500, freq2: 700, type: 'sine', dur: 0.18, vol: volByDist(dist, hear, 0.16) });
  },
  gesture(dist, hear) {
    tone({ freq: 360, type: 'triangle', dur: 0.1, vol: volByDist(dist, hear, 0.16) });
    tone({ freq: 360, type: 'triangle', dur: 0.1, vol: volByDist(dist, hear, 0.16), delay: 0.14 });
  },
  whistle(dist, hear) {
    for (let i = 0; i < 3; i++) {
      tone({ freq: 2100, freq2: 2500, type: 'square', dur: 0.16, vol: volByDist(dist, hear, 0.2), delay: i * 0.2, release: 0.06 });
    }
  },
  heartbeat(intensity = 1) {
    tone({ freq: 62, type: 'sine', dur: 0.12, vol: 0.35 * intensity });
    tone({ freq: 55, type: 'sine', dur: 0.14, vol: 0.26 * intensity, delay: 0.18 });
  },
  alarm(dist, hear) {
    tone({ freq: 700, freq2: 950, type: 'sawtooth', dur: 0.45, vol: volByDist(dist, hear, 0.18), release: 0.05 });
    tone({ freq: 950, freq2: 700, type: 'sawtooth', dur: 0.45, vol: volByDist(dist, hear, 0.18), delay: 0.5, release: 0.05 });
  },
  grab(dist, hear) {
    tone({ freq: 300, freq2: 90, type: 'sawtooth', dur: 0.3, vol: volByDist(dist, hear, 0.4) });
  },
  search() {
    noise({ dur: 0.25, vol: 0.1, filterFreq: 600 });
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.25, vol: 0.22, delay: i * 0.14 }));
  },
  lose() {
    [400, 330, 260, 200].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.3, vol: 0.2, delay: i * 0.16 }));
  },
};
