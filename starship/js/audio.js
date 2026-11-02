let context, master, noiseBuffer, enabled = true, lastShot = 0, lastGun = 0, lastFlame = 0;
export function initAudio() { if (!context) { const Constructor = window.AudioContext || window.webkitAudioContext; if (!Constructor) return; context = new Constructor(); master = context.createGain(); master.gain.value = 0.13; master.connect(context.destination); } if (context.state === 'suspended') context.resume().catch(() => {}); }
export function toggleSound() { enabled = !enabled; if (master) master.gain.value = enabled ? 0.13 : 0; return enabled; }
export function sound(type) {
  if (!enabled || !context) return;
  if (type === 'flame') { if (context.currentTime - lastFlame < 0.22) return; lastFlame=context.currentTime; }
  if (type === 'gun') { if (context.currentTime - lastGun < 0.07) return; lastGun = context.currentTime; }
  if (type === 'missile' || type === 'shell') { if (context.currentTime - lastShot < 0.1) return; lastShot = context.currentTime; }
  const specs = { flame: [100,70,0.25,'sine'], build: [530, 320, 0.08, 'triangle'], gun: [160, 70, 0.045, 'triangle'], throw: [440, 180, 0.18, 'sine'], shell: [95, 30, 0.22, 'sawtooth'], missile: [260, 800, 0.2, 'triangle'], explosion: [70, 24, 0.5, 'sine'], breach: [210, 100, 0.6, 'square'], round: [440, 660, 0.3, 'triangle'], supply: [620, 950, 0.4, 'sine'], defeat: [180, 60, 0.8, 'triangle'] };
  const spec = specs[type]; if (!spec) return;
  const [from, to, duration, wave] = spec, time = context.currentTime;
  const osc = context.createOscillator(), gain = context.createGain(); osc.type = wave;
  osc.frequency.setValueAtTime(from, time); osc.frequency.exponentialRampToValueAtTime(to, time + duration);
  gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.4, time + 0.008); gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  osc.connect(gain); gain.connect(master); osc.start(time); osc.stop(time + duration + 0.02);
  if (['gun', 'shell', 'explosion', 'missile', 'flame'].includes(type)) {
    if (!noiseBuffer) { noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate); const data = noiseBuffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1; }
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain();
    source.buffer = noiseBuffer; filter.type = 'lowpass'; filter.frequency.value = type === 'flame' ? 1200 : type === 'gun' ? 1800 : type === 'missile' ? 2400 : 700;
    envelope.gain.setValueAtTime(type === 'gun' ? 0.12 : 0.32, time); envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(master); source.start(time); source.stop(time + duration);
  }
}
