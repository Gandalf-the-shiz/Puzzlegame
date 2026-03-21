/**
 * score.js — Scoring, combo tracking, and localStorage persistence
 */

'use strict';

const LS_HIGH_SCORE = 'infinityPuzzle_highScore';
const LS_BEST_LEVEL = 'infinityPuzzle_bestLevel';
const LS_SOUND_ON   = 'infinityPuzzle_soundOn';

class ScoreManager {
  constructor() {
    this.score     = 0;
    this.highScore = this._loadHighScore();
    this.bestLevel = this._loadBestLevel();
    this.combo     = 0;        // current combo multiplier
    this.chain     = 0;        // cascade chain count
    this._lastComboTime = 0;
    this.COMBO_RESET_MS = 3000; // ms of inactivity before combo resets

    // Callbacks set by Game
    this.onScore      = null;  // (points, total) => void
    this.onCombo      = null;  // (combo, message) => void
    this.onHighScore  = null;  // (newHighScore) => void
  }

  // ─── Score calculation ─────────────────────────────────────────────────────

  /**
   * Award points for a match.
   * @param {number} matchSize — number of blocks in the match
   * @param {number} chain     — cascade depth (0 = first match, 1 = cascade, …)
   * @param {number} level     — current game level (multiplier)
   * @returns {number} points awarded
   */
  addMatchPoints(matchSize, chain, level) {
    // Base: 10 per block, bonus for size
    const sizeBonus = matchSize >= 5 ? 3 : matchSize >= 4 ? 2 : 1;
    const base      = matchSize * 10 * sizeBonus;

    // Chain multiplier (cascades are more valuable)
    const chainMul  = 1 + chain * 0.5;

    // Combo multiplier
    this.combo++;
    this._lastComboTime = Date.now();
    const comboMul = 1 + (this.combo - 1) * 0.25;

    // Level multiplier
    const levelMul = 1 + (level - 1) * 0.1;

    const points = Math.round(base * chainMul * comboMul * levelMul);
    this._awardPoints(points);

    // Notify combo
    const msg = getComboMessage(this.combo);
    if (msg && this.onCombo) {
      this.onCombo(this.combo, msg);
    }

    return points;
  }

  /**
   * Award points for a bomb explosion (bonus)
   */
  addBombPoints(blocksCleared, level) {
    const points = blocksCleared * 15 * (1 + (level - 1) * 0.1);
    this._awardPoints(Math.round(points));
    return Math.round(points);
  }

  /**
   * Internal: add points, update high score, fire callbacks
   */
  _awardPoints(points) {
    const prev = this.score;
    this.score += points;

    // Update high score BEFORE firing onScore so UI reads the fresh value
    let newHighScore = false;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this._saveHighScore();
      newHighScore = true;
    }

    if (this.onScore) this.onScore(points, this.score);

    // Milestone check
    const milestone = getMilestone(prev, this.score);
    if (milestone && this.onCombo) {
      this.onCombo(0, { msg: milestone.msg, color: milestone.color });
    }

    if (newHighScore && this.onHighScore) {
      this.onHighScore(this.highScore);
    }
  }

  /**
   * Reset combo (called after inactivity or game events)
   */
  resetCombo() {
    this.combo = 0;
  }

  /**
   * Reset chain depth (called at start of each player-initiated swap)
   */
  resetChain() {
    this.chain = 0;
  }

  /**
   * Increment chain (for cascades)
   */
  nextChain() {
    this.chain++;
  }

  /**
   * Tick: auto-reset combo after inactivity
   */
  tick() {
    if (this.combo > 0 && Date.now() - this._lastComboTime > this.COMBO_RESET_MS) {
      this.resetCombo();
    }
  }

  /**
   * Update best level if current level is higher
   */
  updateBestLevel(level) {
    if (level > this.bestLevel) {
      this.bestLevel = level;
      this._saveBestLevel();
    }
  }

  /**
   * Reset score and combo for a new game (high score persists)
   */
  reset() {
    this.score = 0;
    this.combo = 0;
    this.chain = 0;
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  _loadHighScore() {
    try {
      return parseInt(localStorage.getItem(LS_HIGH_SCORE) || '0', 10) || 0;
    } catch { return 0; }
  }

  _saveHighScore() {
    try { localStorage.setItem(LS_HIGH_SCORE, String(this.highScore)); } catch { /* ignore */ }
  }

  _loadBestLevel() {
    try {
      return parseInt(localStorage.getItem(LS_BEST_LEVEL) || '1', 10) || 1;
    } catch { return 1; }
  }

  _saveBestLevel() {
    try { localStorage.setItem(LS_BEST_LEVEL, String(this.bestLevel)); } catch { /* ignore */ }
  }

  static loadSoundPreference() {
    try {
      const val = localStorage.getItem(LS_SOUND_ON);
      return val === null ? true : val === 'true';
    } catch { return true; }
  }

  static saveSoundPreference(on) {
    try { localStorage.setItem(LS_SOUND_ON, String(on)); } catch { /* ignore */ }
  }
}
