/**
 * audio.js — Sound effects and optional background music via Web Audio API
 *
 * All audio is synthesised — no external files required.
 * Reads Settings.getSoundOn() / Settings.getMusicOn() on every play call
 * so UI toggles take effect immediately.
 */

'use strict';

class AudioManager {
  constructor() {
    this._ctx         = null;
    this._master      = null;
    this._musicGain   = null;
    this._musicNodes  = [];   // currently playing music oscillators
    this._musicPlaying= false;
    this._comboStep   = 0;
  }

  // ─── Context ──────────────────────────────────────────────────────────────

  _getCtx() {
    if (!this._ctx) {
      try {
        this._ctx    = new (window.AudioContext || window.webkitAudioContext)();
        this._master = this._ctx.createGain();
        this._master.gain.value = 0.45;
        this._master.connect(this._ctx.destination);

        // Separate gain node for music (so SFX vol is independent)
        this._musicGain = this._ctx.createGain();
        this._musicGain.gain.value = 0.12;
        this._musicGain.connect(this._ctx.destination);
      } catch {
        return null;
      }
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
    return this._ctx;
  }

  // ─── Sound / Music toggles ────────────────────────────────────────────────

  get muted()      { return !Settings.getSoundOn(); }
  get musicMuted() { return !Settings.getMusicOn(); }

  toggleSound() {
    Settings.setSoundOn(!Settings.getSoundOn());
    if (this.muted) {
      this.stopMusic();
    } else if (Settings.getMusicOn()) {
      this.startMusic();
    }
    return this.muted;
  }

  toggleMusic() {
    Settings.setMusicOn(!Settings.getMusicOn());
    if (Settings.getMusicOn()) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
    return Settings.getMusicOn();
  }

  // ─── Background Music (procedural ambient loop) ───────────────────────────

  startMusic() {
    const ctx = this._getCtx();
    if (!ctx || this._musicPlaying || this.muted || this.musicMuted) return;
    this._musicPlaying = true;
    this._musicLoop();
  }

  stopMusic() {
    this._musicPlaying = false;
    for (const n of this._musicNodes) {
      try { n.stop(); } catch { /* already stopped */ }
    }
    this._musicNodes = [];
  }

  _musicLoop() {
    if (!this._musicPlaying || this.musicMuted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    // Simple arpeggiated ambient chord: Am pentatonic
    const notes = [220, 261.6, 329.6, 392, 440, 523.2];
    const beat  = 0.5; // seconds per step

    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const env  = ctx.createGain();
      const t    = ctx.currentTime + i * beat;

      osc.type      = 'sine';
      osc.frequency.value = freq;

      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.25, t + 0.05);
      env.gain.exponentialRampToValueAtTime(0.001, t + beat * 2);

      osc.connect(env);
      env.connect(this._musicGain);
      osc.start(t);
      osc.stop(t + beat * 2 + 0.1);
      this._musicNodes.push(osc);
    });

    // Schedule next loop iteration
    const loopDuration = notes.length * beat * 1000 + 1200;
    this._musicTimer = setTimeout(() => {
      this._musicNodes = [];
      this._musicLoop();
    }, loopDuration);
  }

  // ─── SFX ─────────────────────────────────────────────────────────────────

  resetCombo() { this._comboStep = 0; }

  playMatch(size = 3) {
    const ctx = this._getCtx();
    if (!ctx || this.muted) return;
    const base = 300 + size * 50;
    this._playNote(base,        'sine',     0.3,  0.08, 0.15);
    this._playNote(base * 1.5,  'sine',     0.15, 0.05, 0.12);
    Settings.vibrate(15);
  }

  playCombo(combo) {
    const ctx = this._getCtx();
    if (!ctx || this.muted) return;
    this._comboStep = Math.min(combo, 20);
    const freq = 400 + this._comboStep * 40;
    this._playNote(freq, 'square', 0.2, 0.04, 0.2);
    if (combo >= 5) Settings.vibrate([20, 10, 20]);
  }

  playCascade(chain) {
    const ctx = this._getCtx();
    if (!ctx || this.muted) return;
    const freqs = [523, 659, 784];
    freqs.forEach((f, i) => {
      setTimeout(() => {
        this._playNote(f * (1 + chain * 0.1), 'sine', 0.25, 0.05, 0.3);
      }, i * 60);
    });
  }

  playHighScore() {
    const ctx = this._getCtx();
    if (!ctx || this.muted) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => {
        this._playNote(f,        'sawtooth', 0.3,  0.02, 0.25);
        this._playNote(f * 1.5,  'sine',     0.15, 0.02, 0.25);
      }, i * 100);
    });
    Settings.vibrate([30, 20, 30, 20, 60]);
  }

  playGameOver() {
    const ctx = this._getCtx();
    if (!ctx || this.muted) return;
    [330, 294, 262, 220].forEach((f, i) => {
      setTimeout(() => {
        this._playNote(f, 'sawtooth', 0.35, 0.05, 0.35);
      }, i * 150);
    });
    Settings.vibrate([40, 30, 40, 30, 80]);
  }

  playSelect() {
    const ctx = this._getCtx();
    if (!ctx || this.muted) return;
    this._playNote(800, 'sine', 0.08, 0.01, 0.05);
  }

  playDenied() {
    const ctx = this._getCtx();
    if (!ctx || this.muted) return;
    this._playNote(180, 'square', 0.2, 0.02, 0.12);
    this._playNote(160, 'square', 0.2, 0.02, 0.12);
    Settings.vibrate(20);
  }

  playLevelUp() {
    const ctx = this._getCtx();
    if (!ctx || this.muted) return;
    [523, 784, 1047, 1568].forEach((f, i) => {
      setTimeout(() => this._playNote(f, 'sine', 0.3, 0.02, 0.2), i * 80);
    });
    Settings.vibrate([20, 10, 40]);
  }

  playBomb() {
    const ctx = this._getCtx();
    if (!ctx || this.muted) return;
    const size   = Math.round(ctx.sampleRate * 0.3);
    const buf    = ctx.createBuffer(1, size, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

    const src    = ctx.createBufferSource();
    src.buffer   = buf;

    const filt   = ctx.createBiquadFilter();
    filt.type    = 'lowpass';
    filt.frequency.value = 400;
    filt.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);

    const g      = ctx.createGain();
    g.gain.value = 0.4;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    src.connect(filt);
    filt.connect(g);
    g.connect(this._master);
    src.start();
    Settings.vibrate([50, 20, 30]);
  }

  playPowerup() {
    const ctx = this._getCtx();
    if (!ctx || this.muted) return;
    [600, 900, 1200].forEach((f, i) => {
      setTimeout(() => this._playNote(f, 'sine', 0.25, 0.02, 0.2), i * 60);
    });
    Settings.vibrate([15, 10, 25]);
  }

  playDailyComplete() {
    const ctx = this._getCtx();
    if (!ctx || this.muted) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      setTimeout(() => {
        this._playNote(f, 'sine', 0.35, 0.03, 0.3);
      }, i * 90);
    });
    Settings.vibrate([30, 20, 30, 20, 30, 20, 80]);
  }

  // ─── Internal synthesis ───────────────────────────────────────────────────

  _playNote(freq, type, gain, attack, decay) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const now = ctx.currentTime;

    osc.type            = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + attack);
    env.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

    osc.connect(env);
    env.connect(this._master);
    osc.start(now);
    osc.stop(now + attack + decay + 0.01);
  }
}
