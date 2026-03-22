/**
 * levels.js — Level progression and difficulty curves
 *
 * Supports two difficulty presets:
 *   • Standard — used by Endless and Daily modes
 *   • Hardcore  — faster ramp, more blockers, wider color pool
 */

'use strict';

class LevelManager {
  /**
   * @param {boolean} hardcore — enable Hardcore difficulty ramp
   */
  constructor(hardcore = false) {
    this.level         = 1;
    this.hardcore      = hardcore;
    this.pointsForNext = this._thresholdFor(1);

    // Callbacks
    this.onLevelUp = null; // (newLevel) => void
  }

  // ─── Thresholds ───────────────────────────────────────────────────────────

  _thresholdFor(level) {
    // Hardcore needs 60% fewer points to level up (faster ramp)
    const base = Math.round(200 * Math.pow(1.4, level - 1));
    return this.hardcore ? Math.round(base * 0.6) : base;
  }

  checkLevelUp(score) {
    let leveled = false;
    while (score >= this.pointsForNext) {
      this.level++;
      this.pointsForNext = this.pointsForNext + this._thresholdFor(this.level);
      leveled = true;
      if (this.onLevelUp) this.onLevelUp(this.level);
    }
    return leveled;
  }

  getConfig() {
    return LevelManager.configFor(this.level, this.hardcore);
  }

  // ─── Static config ────────────────────────────────────────────────────────

  /**
   * Return a difficulty config for a given level number.
   * @param {number}  level
   * @param {boolean} hardcore
   */
  static configFor(level, hardcore = false) {
    // Standard colour pool (unlocks more colours as levels rise)
    const colorCount    = Math.min(2 + Math.floor(level / 2), COLORS.length);
    // Hardcore: start with one extra colour (harder to match)
    const hcColorCount  = Math.min(colorCount + 1, COLORS.length);
    const colorPool     = COLORS.slice(0, hardcore ? hcColorCount : colorCount);

    // Special block spawn chances
    const blockerBase   = hardcore
      ? (level >= 2 ? Math.min(0.06 * (level - 1), 0.18) : 0)  // earlier, heavier
      : (level >= 4 ? Math.min(0.04 * (level - 3), 0.12) : 0);

    const bombChance    = level >= 6  ? Math.min(0.02 * (level - 5), 0.08) : 0;
    const rainbowChance = level >= 3  ? Math.min(0.015 * (level - 2), 0.06) : 0;
    const numberChance  = level >= 5  ? Math.min(0.025 * (level - 4), 0.10) : 0;

    // Speed: Hardcore blocks fall and animate faster
    const speedMul = hardcore
      ? Math.min(1 + (level - 1) * 0.12, 4.0)
      : Math.min(1 + (level - 1) * 0.08, 3.0);

    return {
      level,
      hardcore,
      colorPool,
      colorCount:     colorPool.length,
      blockerChance:  blockerBase,
      bombChance,
      rainbowChance,
      numberChance,
      speedMul,
      minMoves:       1,
      scoreMul:       1 + (level - 1) * 0.1,
    };
  }

  reset() {
    this.level         = 1;
    this.pointsForNext = this._thresholdFor(1);
  }
}
