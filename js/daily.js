/**
 * daily.js — Deterministic daily seed + streak logic
 *
 * The daily challenge uses a seeded PRNG so every player gets the
 * exact same initial board layout on the same calendar day.
 *
 * Debug: add ?devDate=YYYY-MM-DD to the URL (only works when DEBUG=true).
 */

'use strict';

const DEBUG = false; // ⚠️ NEVER commit as `true` — for local dev only

// ─── Date helpers ───────────────────────────────────────────────────────────

/** Return today's date as "YYYY-MM-DD" (or devDate override when DEBUG). */
function getDailyDateString() {
  if (DEBUG) {
    try {
      const params = new URLSearchParams(window.location.search);
      const dev = params.get('devDate');
      if (dev && /^\d{4}-\d{2}-\d{2}$/.test(dev)) return dev;
    } catch { /* ignore */ }
  }
  const d   = new Date();
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Return yesterday's date as "YYYY-MM-DD". */
function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Seeded PRNG ────────────────────────────────────────────────────────────

/**
 * Simple 32-bit LCG PRNG. Returns a closure that produces values in [0, 1).
 * Same seed → same sequence; deterministic across all browsers.
 */
function makeSeededRng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = Math.imul(1664525, s) + 1013904223;
    s = s >>> 0;
    return s / 0x100000000;
  };
}

/** Convert a date string "YYYY-MM-DD" to a stable numeric seed. */
function dateToSeed(dateStr) {
  let h = 0x811c9dc5;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h = h >>> 0;
  }
  return h;
}

// ─── Streak reward catalogue ─────────────────────────────────────────────────

const STREAK_REWARDS = [
  { days: 3,  itemId: 'theme_ocean',      dust: 50  },
  { days: 7,  itemId: 'particles_stars',  dust: 100 },
  { days: 14, itemId: 'announcer_sports', dust: 200 },
  { days: 30, itemId: 'theme_neon',       dust: 500 },
];

// ─── DailyManager class ──────────────────────────────────────────────────────

class DailyManager {
  constructor() {
    this.today = getDailyDateString();
    this._seed = dateToSeed(this.today);
  }

  // ─── RNG ─────────────────────────────────────────────────────────────────

  /**
   * Return a fresh seeded RNG for today's challenge.
   * Each call resets back to the start of the sequence.
   */
  getRng() {
    return makeSeededRng(this._seed);
  }

  /**
   * Temporarily replace Math.random with today's seeded RNG, call fn(), then
   * restore Math.random. Used to seed Board/Block construction deterministically.
   */
  withSeededRng(fn) {
    const rng  = this.getRng();
    const orig = Math.random;
    Math.random = rng;
    try { return fn(); }
    finally { Math.random = orig; }
  }

  // ─── State ───────────────────────────────────────────────────────────────

  getToday()          { return this.today; }

  /** True if the player has already completed today's daily. */
  isDailyCompleted()  {
    return GameStorage.getStreak().lastDate === this.today;
  }

  // ─── Completion ──────────────────────────────────────────────────────────

  /**
   * Mark today's daily challenge as completed, update streak.
   * @returns {number} The new streak count, or 0 if already completed today.
   */
  completeDaily() {
    if (this.isDailyCompleted()) return 0;

    const streak    = GameStorage.getStreak();
    const yesterday = getYesterdayString();

    const newCount = (streak.lastDate === yesterday)
      ? (streak.count || 0) + 1
      : 1;

    GameStorage.setStreak({ count: newCount, lastDate: this.today });
    this._grantStreakRewards(newCount);

    return newCount;
  }

  _grantStreakRewards(count) {
    for (const reward of STREAK_REWARDS) {
      if (count === reward.days) {
        GameStorage.unlock(reward.itemId);
        GameStorage.addDust(reward.dust);
      }
    }
  }

  // ─── Info ────────────────────────────────────────────────────────────────

  /**
   * Get current streak info (accounts for broken streaks).
   * @returns {{ count: number, completedToday: boolean }}
   */
  getStreakInfo() {
    const streak    = GameStorage.getStreak();
    const yesterday = getYesterdayString();
    const isActive  = streak.lastDate === this.today || streak.lastDate === yesterday;
    return {
      count:          isActive ? (streak.count || 0) : 0,
      completedToday: streak.lastDate === this.today,
    };
  }

  /**
   * Return the next streak milestone above the current count, or null.
   */
  getNextMilestone(currentCount) {
    return STREAK_REWARDS.find(r => r.days > currentCount) || null;
  }
}

const DailyChallenge = new DailyManager();
