/**
 * score.js — Scoring, combo tracking, Wizard Dust, and persistence via GameStorage
 */

'use strict';

// Dust earned per 100 score points
const DUST_PER_100_SCORE = 1;
// Dust earned per level-up
const DUST_PER_LEVEL     = 5;
// Dust bonus for completing the daily challenge
const DUST_DAILY_BONUS   = 25;

class ScoreManager {
  /**
   * @param {'endless'|'daily'|'hardcore'} mode
   */
  constructor(mode = 'endless') {
    this.mode      = mode;
    this.score     = 0;
    this.highScore = GameStorage.getHighScore(mode);
    this.bestLevel = GameStorage.get('bestLevel') || 1;
    this.combo     = 0;
    this.chain     = 0;
    this._lastComboTime  = 0;
    this.COMBO_RESET_MS  = 3000;

    // Dust earned this run (not yet committed to storage)
    this._runDust   = 0;
    this._dustTrack = 0; // score watermark for dust calculation

    // Callbacks set by Game
    this.onScore     = null;  // (points, total) => void
    this.onCombo     = null;  // (combo, message) => void
    this.onHighScore = null;  // (newHighScore) => void
  }

  // ─── Score calculation ─────────────────────────────────────────────────────

  addMatchPoints(matchSize, chain, level) {
    const sizeBonus = matchSize >= 5 ? 3 : matchSize >= 4 ? 2 : 1;
    const base      = matchSize * 10 * sizeBonus;
    const chainMul  = 1 + chain * 0.5;
    this.combo++;
    this._lastComboTime = Date.now();
    const comboMul  = 1 + (this.combo - 1) * 0.25;
    const levelMul  = 1 + (level - 1) * 0.1;
    const points    = Math.round(base * chainMul * comboMul * levelMul);

    this._awardPoints(points);

    const msg = Unlocks.getComboMsg(this.combo);
    if (msg && this.onCombo) this.onCombo(this.combo, msg);

    return points;
  }

  addBombPoints(blocksCleared, level) {
    const points = Math.round(blocksCleared * 15 * (1 + (level - 1) * 0.1));
    this._awardPoints(points);
    return points;
  }

  /** Award dust for reaching a new level. Call on each level-up event. */
  onLevelUp() {
    this._runDust += DUST_PER_LEVEL;
  }

  /**
   * Commit all dust earned this run to GameStorage.
   * @param {boolean} dailyCompleted — add daily bonus?
   * @returns {number} dust earned this run
   */
  commitDust(dailyCompleted = false) {
    if (dailyCompleted) this._runDust += DUST_DAILY_BONUS;
    GameStorage.addDust(this._runDust);
    const earned   = this._runDust;
    this._runDust  = 0;
    return earned;
  }

  get runDust() { return this._runDust; }

  // ─── Internal ─────────────────────────────────────────────────────────────

  _awardPoints(points) {
    const prev = this.score;
    this.score += points;

    // Accumulate dust at 1 per 100 score points
    const newH = Math.floor(this.score       / 100);
    const oldH = Math.floor(this._dustTrack  / 100);
    this._runDust  += (newH - oldH) * DUST_PER_100_SCORE;
    this._dustTrack = this.score;

    // High score (mode-specific)
    let newHigh = false;
    if (GameStorage.setHighScore(this.mode, this.score)) {
      this.highScore = this.score;
      newHigh = true;
    }

    if (this.onScore) this.onScore(points, this.score);

    const milestone = getMilestone(prev, this.score);
    if (milestone && this.onCombo) {
      this.onCombo(0, { msg: milestone.msg, color: milestone.color });
    }

    if (newHigh && this.onHighScore) this.onHighScore(this.highScore);
  }

  // ─── Combo / chain ────────────────────────────────────────────────────────

  resetCombo() { this.combo = 0; }
  resetChain() { this.chain = 0; }
  nextChain()  { this.chain++; }

  tick() {
    if (this.combo > 0 && Date.now() - this._lastComboTime > this.COMBO_RESET_MS) {
      this.resetCombo();
    }
  }

  updateBestLevel(level) {
    if (level > this.bestLevel) {
      this.bestLevel = level;
      GameStorage.set('bestLevel', level);
    }
  }

  reset() {
    this.score      = 0;
    this.combo      = 0;
    this.chain      = 0;
    this._runDust   = 0;
    this._dustTrack = 0;
    this.highScore  = GameStorage.getHighScore(this.mode);
  }
}
