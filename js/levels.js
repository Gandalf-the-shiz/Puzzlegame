/**
 * levels.js — Level progression and difficulty curves
 */

'use strict';

class LevelManager {
  constructor() {
    this.level         = 1;
    this.pointsForNext = this._thresholdFor(1);

    // Callbacks
    this.onLevelUp = null; // (newLevel) => void
  }

  /**
   * Score threshold to reach the next level
   */
  _thresholdFor(level) {
    // Each level needs progressively more points
    return Math.round(200 * Math.pow(1.4, level - 1));
  }

  /**
   * Check if score has crossed into a new level.
   * @param {number} score — current total score
   * @returns {boolean} true if level increased
   */
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

  /**
   * Get the difficulty configuration for the current level.
   * @returns {LevelConfig}
   */
  getConfig() {
    return LevelManager.configFor(this.level);
  }

  /**
   * Static: return a difficulty config for a given level number.
   */
  static configFor(level) {
    // Color pool: unlock new colors as levels increase
    const colorCount = Math.min(2 + Math.floor(level / 2), COLORS.length);
    const colorPool  = COLORS.slice(0, colorCount);

    // Special block chances (ramp up slowly)
    const blockerChance = level >= 4  ? Math.min(0.04 * (level - 3), 0.12) : 0;
    const bombChance    = level >= 6  ? Math.min(0.02 * (level - 5), 0.08) : 0;
    const rainbowChance = level >= 3  ? Math.min(0.015 * (level - 2), 0.06) : 0;
    const numberChance  = level >= 5  ? Math.min(0.025 * (level - 4), 0.10) : 0;

    // Animation speed multiplier (blocks fall faster at higher levels)
    const speedMul = Math.min(1 + (level - 1) * 0.08, 3.0);

    // Minimum matches needed for hints/shuffles
    const minMoves = 1;

    return {
      level,
      colorPool,
      colorCount,
      blockerChance,
      bombChance,
      rainbowChance,
      numberChance,
      speedMul,
      minMoves,
      // Points multiplier (referenced by ScoreManager)
      scoreMul: 1 + (level - 1) * 0.1,
    };
  }

  /**
   * Reset to level 1 for new game
   */
  reset() {
    this.level = 1;
    this.pointsForNext = this._thresholdFor(1);
  }
}
