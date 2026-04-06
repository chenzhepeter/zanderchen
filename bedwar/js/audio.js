// Simple Web Audio API sound system using synthesized sounds
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._initOnInteraction();
  }

  _initOnInteraction() {
    const init = () => {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      document.removeEventListener('click', init);
      document.removeEventListener('keydown', init);
    };
    document.addEventListener('click', init);
    document.addEventListener('keydown', init);
  }

  _ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Sword swing
  playSwing() {
    if (!this.enabled) return;
    try {
      const ctx = this._ensureCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
    } catch(e) {}
  }

  // Hit sound
  playHit() {
    if (!this.enabled) return;
    try {
      const ctx = this._ensureCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.1);

      // Noise burst for impact
      const bufSize = ctx.sampleRate * 0.05;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.15, ctx.currentTime);
      ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      noise.connect(ng).connect(ctx.destination);
      noise.start(); noise.stop(ctx.currentTime + 0.05);
    } catch(e) {}
  }

  // Block break
  playBreak() {
    if (!this.enabled) return;
    try {
      const ctx = this._ensureCtx();
      const bufSize = ctx.sampleRate * 0.1;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize) * 0.5;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      noise.connect(gain).connect(ctx.destination);
      noise.start(); noise.stop(ctx.currentTime + 0.1);
    } catch(e) {}
  }

  // Block place
  playPlace() {
    if (!this.enabled) return;
    try {
      const ctx = this._ensureCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.08);
    } catch(e) {}
  }

  // Zombie groan
  playZombieGroan() {
    if (!this.enabled) return;
    try {
      const ctx = this._ensureCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const baseFreq = 60 + Math.random() * 30;
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(baseFreq * 0.7, ctx.currentTime + 0.5);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.2, ctx.currentTime + 0.8);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.8);

      // Add rumble
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 0.5, ctx.currentTime);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.06, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc2.connect(g2).connect(ctx.destination);
      osc2.start(); osc2.stop(ctx.currentTime + 0.6);
    } catch(e) {}
  }

  // Explosion
  playExplosion() {
    if (!this.enabled) return;
    try {
      const ctx = this._ensureCtx();
      const bufSize = ctx.sampleRate * 0.4;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        const t = i / ctx.sampleRate;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 8) * 0.8;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      noise.connect(gain).connect(ctx.destination);
      noise.start(); noise.stop(ctx.currentTime + 0.4);

      // Low boom
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.3);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.4, ctx.currentTime);
      bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(bg).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  }

  // Pickup
  playPickup() {
    if (!this.enabled) return;
    try {
      const ctx = this._ensureCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } catch(e) {}
  }
}
