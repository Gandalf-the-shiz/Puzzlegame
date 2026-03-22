/**
 * leaderboard.js — Local top-10 leaderboard per mode
 *
 * Each entry: { score, time, date, label }
 * 'score' is used for modes that rank by score (higher = better)
 * 'time' is used for modes that rank by time (lower = better)
 */

'use strict';

const Leaderboard = (() => {
  const MAX_ENTRIES = 10;

  /**
   * Add an entry to a mode's leaderboard.
   * @param {string} modeId
   * @param {object} entry  { score?, time?, label? }
   * @param {string} rankBy 'score' (desc) | 'time' (asc)
   * @returns {number} rank achieved (1-based), or 0 if not in top 10
   */
  function addEntry(modeId, entry, rankBy = 'score') {
    const entries = Storage.getLeaderboard(modeId);
    const now = Daily.todayStr();
    const full = { score: 0, time: 0, label: 'You', date: now, ...entry };

    entries.push(full);

    // Sort
    if (rankBy === 'time') {
      entries.sort((a, b) => a.time - b.time);
    } else {
      entries.sort((a, b) => b.score - a.score);
    }

    // Keep top 10
    const trimmed = entries.slice(0, MAX_ENTRIES);
    Storage.saveLeaderboard(modeId, trimmed);

    const rank = trimmed.indexOf(full) + 1;
    return rank > 0 ? rank : 0;
  }

  /**
   * Get all entries for a mode.
   */
  function getEntries(modeId) {
    return Storage.getLeaderboard(modeId);
  }

  /**
   * Get the best entry for a mode.
   */
  function getBest(modeId, rankBy = 'score') {
    const entries = getEntries(modeId);
    if (!entries.length) return null;
    return entries[0]; // already sorted
  }

  return { addEntry, getEntries, getBest };
})();
