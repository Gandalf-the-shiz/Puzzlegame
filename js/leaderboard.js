/**
 * leaderboard.js — Local top-10 leaderboard per game mode
 *
 * Entries are persisted via GameStorage per mode key.
 * No backend required — fully offline.
 *
 * Exports a single `Leaderboard` singleton used by both:
 *   - The match-3 game (modes: 'endless', 'daily', 'hardcore')
 *   - Hub modes (connector, wordle, minesweeper, watersort, mahjong, miniwordgrid)
 */

'use strict';

const LB_MAX = 10;

// Utility (may not be available if utils.js isn't loaded yet; provide local fallback)
function _formatNum(n) {
  if (typeof formatNumber === 'function') return formatNumber(n);
  return (n || 0).toLocaleString();
}

class LeaderboardManager {
  // ─── Match-3 API (mode = 'endless' | 'daily' | 'hardcore') ──────────────

  /**
   * Add a score entry to the match-3 leaderboard.
   * Keeps only the top-10 by score.
   *
   * @param {'endless'|'daily'|'hardcore'} mode
   * @param {number} score
   * @param {number} level
   * @param {string} [dateLabel] — display label, defaults to today
   * @returns {number} rank of this entry (1 = first place), 0 = not in top 10
   */
  addMatchEntry(mode, score, level, dateLabel = null) {
    const entry = {
      score,
      level,
      date:      dateLabel || new Date().toLocaleDateString(),
      timestamp: Date.now(),
    };
    return GameStorage.addLeaderboardEntry(mode, entry);
  }

  /**
   * Get the leaderboard for a match-3 mode (array of entries, descending score).
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
   * Render a match-3 leaderboard into an HTML element.
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
      const rank  = i + 1;
      const isNew = (rank === highlightRank);
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      return `<div class="lb-row${isNew ? ' lb-row-new' : ''}">
        <span class="lb-rank">${medal}</span>
        <span class="lb-score">${_formatNum(e.score)}</span>
        <span class="lb-meta">Lvl ${e.level} · ${e.date}</span>
      </div>`;
    });
    container.innerHTML = rows.join('');
  }

  // ─── Hub mode API (modeId = 'connector' | 'wordle' | etc.) ──────────────

  /**
   * Add an entry to a hub mode leaderboard.
   * @param {string} modeId
   * @param {object} entry   — { score?, time?, label? }
   * @param {string} rankBy  — 'score' (desc) | 'time' (asc)
   * @returns {number} rank achieved (1-based), or 0 if not in top 10
   */
  addEntry(modeId, entry, rankBy = 'score') {
    const entries = GameStorage.getLeaderboard(modeId);
    const now     = Daily.todayStr();
    const full    = Object.assign({ score: 0, time: 0, label: 'You', date: now }, entry);

    entries.push(full);

    if (rankBy === 'time') {
      entries.sort((a, b) => a.time - b.time);
    } else {
      entries.sort((a, b) => b.score - a.score);
    }

    const trimmed = entries.slice(0, LB_MAX);
    GameStorage.saveLeaderboard(modeId, trimmed);

    const rank = trimmed.findIndex(e => e === full) + 1;
    return rank > 0 ? rank : 0;
  }

  /**
   * Get all entries for a hub mode leaderboard.
   */
  getEntries(modeId) {
    return GameStorage.getLeaderboard(modeId);
  }

  /**
   * Get the best entry for a mode (first entry after sorting).
   */
  getBest(modeId, rankBy = 'score') {
    const entries = this.getEntries(modeId);
    if (!entries.length) return null;
    return entries[0]; // already sorted on insert
  }
}

const Leaderboard = new LeaderboardManager();
