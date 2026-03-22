/**
 * leaderboard.js — Local top-10 leaderboard per game mode
 *
 * Entries are persisted in GameStorage per mode key.
 * No backend required — fully offline.
 */

'use strict';

const LB_MAX = 10;

class LeaderboardManager {
  /**
   * Add a score entry to the leaderboard for the given mode.
   * Keeps only the top-10 by score.
   *
   * @param {'endless'|'daily'|'hardcore'} mode
   * @param {number} score
   * @param {number} level
   * @param {string} [dateLabel] — display label, defaults to today
   * @returns {number} rank of this entry (1 = first place), 0 = not in top 10
   */
  addEntry(mode, score, level, dateLabel = null) {
    const entry = {
      score,
      level,
      date:      dateLabel || new Date().toLocaleDateString(),
      timestamp: Date.now(),
    };
    return GameStorage.addLeaderboardEntry(mode, entry);
  }

  /**
   * Get the leaderboard for a mode (array of entries, descending score).
   */
  getBoard(mode) {
    return GameStorage.getLeaderboard(mode);
  }

  /**
   * Check if a score would make the top 10 for a mode.
   */
  isTopScore(mode, score) {
    const board = this.getBoard(mode);
    return board.length < LB_MAX || score > (board[board.length - 1]?.score || 0);
  }

  /**
   * Render a leaderboard into an HTML element.
   * @param {HTMLElement} container
   * @param {'endless'|'daily'|'hardcore'} mode
   * @param {number} [highlightRank] — 1-indexed rank to highlight (current run)
   */
  renderInto(container, mode, highlightRank = 0) {
    const board = this.getBoard(mode);
    if (board.length === 0) {
      container.innerHTML = '<p class="lb-empty">No entries yet. Be the first!</p>';
      return;
    }
    const rows = board.map((e, i) => {
      const rank    = i + 1;
      const isNew   = (rank === highlightRank);
      const medal   = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      return `<div class="lb-row${isNew ? ' lb-row-new' : ''}">
        <span class="lb-rank">${medal}</span>
        <span class="lb-score">${formatNumber(e.score)}</span>
        <span class="lb-meta">Lvl ${e.level} · ${e.date}</span>
      </div>`;
    });
    container.innerHTML = rows.join('');
  }
}

const Leaderboard = new LeaderboardManager();
