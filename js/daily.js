/**
 * daily.js — Daily seeds, streak tracking, and date helpers
 *
 * Deterministic daily seed: dateString "YYYY-MM-DD" hashed to integer.
 * Streaks: each daily mode can grant credit once/day.
 */

'use strict';

const Daily = (() => {

  // ── Date helpers ────────────────────────────────────────────────

  /** Returns today's date as "YYYY-MM-DD", respecting ?devDate= override */
  function todayStr() {
    const params = new URLSearchParams(window.location.search);
    const dev = params.get('devDate');
    if (dev && /^\d{4}-\d{2}-\d{2}$/.test(dev)) return dev;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Convert a date string + mode id to a deterministic integer seed.
   * Uses a simple djb2-style hash.
   */
  function seedForDate(dateStr, modeId) {
    const str = dateStr + ':' + (modeId || '');
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash |= 0; // keep 32-bit
    }
    return Math.abs(hash);
  }

  /**
   * Seeded pseudo-random number generator (Mulberry32).
   * Returns a function that produces values in [0, 1).
   */
  function seededRng(seed) {
    let s = seed >>> 0;
    return function () {
      s += 0x6D2B79F5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Shuffle an array using a seeded RNG (Fisher-Yates).
   */
  function seededShuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Pick a seeded index into an array.
   */
  function seededPick(arr, seed) {
    const rng = seededRng(seed);
    return arr[Math.floor(rng() * arr.length)];
  }

  // ── Streak tracking ─────────────────────────────────────────────

  function getStreak() {
    return Storage.getDailyStreak();
  }

  /** Call when a mode's daily challenge is completed. */
  function recordDailyCompletion(modeId) {
    const today = todayStr();
    const streak = Storage.getDailyStreak();

    // Already credited today for this mode?
    if (streak.perMode && streak.perMode[modeId] === today) {
      return { alreadyCredited: true, streak: streak.count };
    }

    // Update per-mode date
    streak.perMode = streak.perMode || {};
    streak.perMode[modeId] = today;

    // Check if any mode was completed yesterday to maintain streak
    const yesterday = _yesterday();
    const anyYesterday = Object.values(streak.perMode)
      .some(d => d === yesterday);

    // First completion today?
    const anyToday = Object.values(streak.perMode)
      .filter(d => d === today).length;

    if (anyToday === 1) { // just became today's first
      if (streak.lastDate === yesterday || anyYesterday) {
        streak.count = (streak.count || 0) + 1;
      } else if (streak.lastDate !== today) {
        streak.count = 1; // reset streak
      }
      streak.lastDate = today;
    }

    Storage.saveDailyStreak(streak);
    return { alreadyCredited: false, streak: streak.count };
  }

  function _yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Has the player completed this mode's daily today? */
  function hasCompletedToday(modeId) {
    const today = todayStr();
    const streak = Storage.getDailyStreak();
    return (streak.perMode || {})[modeId] === today;
  }

  return {
    todayStr,
    seedForDate,
    seededRng,
    seededShuffle,
    seededPick,
    getStreak,
    recordDailyCompletion,
    hasCompletedToday,
  };
})();
