/**
 * audio.js — Sound effects using Web Audio API (no external files)
 */

'use strict';

class AudioManager {
  constructor() {
    this._ctx    = null;
    this._muted  = !ScoreManager.loadSoundPreference();
    this._master = null;
    this._comboStep = 0; // rising pitch counter for combos
  }

  /**
   * Lazily create AudioContext (browsers require user gesture first)
   */
  _getCtx() {
    if (!this._ctx) {
      try {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._master = this._ctx.createGain();
        this._master.gain.value = this._muted ? 0 : 0.5;
        this._master.connect(this._ctx.destination);
      } catch {
        // Audio not supported — silently fail
        return null;
      }
    }
    // Resume if suspended (mobile browsers auto-suspend)
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
    return this._ctx;
  }

  // ─── Public controls ───────────────────────────────────────────────────────

  get muted() { return this._muted; }

  toggleMute() {
    this._muted = !this._muted;
    if (this._master) this._master.gain.value = this._muted ? 0 : 0.5;
    ScoreManager.saveSoundPreference(!this._muted);
    return this._muted;
  }

  resetCombo() {
    this._comboStep = 0;
  }

  // ─── Sound effects ─────────────────────────────────────────────────────────

  /**
   * Play a "pop" sound for a match.
   * @param {number} size — match size (bigger = richer sound)
   */
  playMatch(size = 3) {
    const ctx = this._getCtx();
    if (!ctx || this._muted) return;

    const baseFreq = 300 + size * 50;
    this._playNote(baseFreq, 'sine', 0.3, 0.08, 0.15);
    this._playNote(baseFreq * 1.5, 'sine', 0.15, 0.05, 0.12);
  }

  /**
   * Play a combo rising tone
   */
  playCombo(combo) {
    const ctx = this._getCtx();
    if (!ctx || this._muted) return;

    this._comboStep = Math.min(combo, 20);
    const freq = 400 + this._comboStep * 40;
    this._playNote(freq, 'square', 0.2, 0.04, 0.2);
  }

  /**
   * Satisfying cascade sound (whoosh + chord)
   */
  playCascade(chain) {
    const ctx = this._getCtx();
    if (!ctx || this._muted) return;

    const freqs = [523, 659, 784]; // C E G
    freqs.forEach((f, i) => {
      setTimeout(() => {
        this._playNote(f * (1 + chain * 0.1), 'sine', 0.25, 0.05, 0.3);
      }, i * 60);
    });
  }

  /**
   * Triumphant fanfare for new high score
   */
  playHighScore() {
    const ctx = this._getCtx();
    if (!ctx || this._muted) return;

    const melody = [523, 659, 784, 1047];
    melody.forEach((f, i) => {
      setTimeout(() => {
        this._playNote(f, 'sawtooth', 0.3, 0.02, 0.25);
        this._playNote(f * 1.5, 'sine', 0.15, 0.02, 0.25);
      }, i * 100);
    });
  }

  /**
   * Sad wah-wah for game over
   */
  playGameOver() {
    const ctx = this._getCtx();
    if (!ctx || this._muted) return;

    const notes = [330, 294, 262, 220];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playNote(f, 'sawtooth', 0.35, 0.05, 0.35);
      }, i * 150);
    });
  }

  /**
   * Light tap sound for block selection
   */
  playSelect() {
    const ctx = this._getCtx();
    if (!ctx || this._muted) return;
    this._playNote(800, 'sine', 0.08, 0.01, 0.05);
  }

  /**
   * Denied sound (invalid swap)
   */
  playDenied() {
    const ctx = this._getCtx();
    if (!ctx || this._muted) return;
    this._playNote(180, 'square', 0.2, 0.02, 0.12);
    this._playNote(160, 'square', 0.2, 0.02, 0.12);
  }

  /**
   * Level up jingle
   */
  playLevelUp() {
    const ctx = this._getCtx();
    if (!ctx || this._muted) return;

    const notes = [523, 784, 1047, 1568];
    notes.forEach((f, i) => {
      setTimeout(() => this._playNote(f, 'sine', 0.3, 0.02, 0.2), i * 80);
    });
  }

  /**
   * Bomb explosion sound
   */
  playBomb() {
    const ctx = this._getCtx();
    if (!ctx || this._muted) return;

    // White noise burst
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer     = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data       = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type            = 'lowpass';
    filter.frequency.value = 400;
    filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.4;
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this._master);
    source.start();
  }

  // ─── Internal synthesis ────────────────────────────────────────────────────

  _playNote(freq, type, gain, attackTime, decayTime) {
    const ctx = this._getCtx();
    if (!ctx) return;

    const osc  = ctx.createOscillator();
    const env  = ctx.createGain();
    const now  = ctx.currentTime;

    osc.type      = type;
    osc.frequency.value = freq;

    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + attackTime);
    env.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime);

    osc.connect(env);
    env.connect(this._master);
    osc.start(now);
    osc.stop(now + attackTime + decayTime + 0.01);
  }
}
