/**
 * daily.js — Deterministic daily seed + streak logic
 *
 * The daily challenge uses a seeded PRNG so every player gets the
 * exact same initial board layout on the same calendar day.
 *
 * Debug: add ?devDate=YYYY-MM-DD to the URL to test specific dates.
 *
 * Exports:
 *   DailyChallenge — primary singleton (match-3 daily mode)
 *   Daily          — alias for DailyChallenge (hub mode API)
 *
 * Hub mode helpers available on Daily / DailyChallenge:
 *   todayStr()
 *   seedForDate(dateStr, modeId)
 *   seededRng(seed)           → Mulberry32 PRNG function
 *   seededShuffle(arr, rng)
 *   seededPick(arr, seed)
 *   hasCompletedToday(modeId)
 *   recordDailyCompletion(modeId)
 *   getStreak()               → { count, lastDate, perMode }
 */

'use strict';

// ─── Date helpers ───────────────────────────────────────────────────────────

/** Return today's date as "YYYY-MM-DD", respecting ?devDate= override. */
function getDailyDateString() {
  try {
    const params = new URLSearchParams(window.location.search);
    const dev = params.get('devDate');
    if (dev && /^\d{4}-\d{2}-\d{2}$/.test(dev)) return dev;
  } catch { /* ignore */ }
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

// ─── Seeded PRNG (match-3 game uses LCG; hub modes use Mulberry32) ──────────

/**
 * Simple 32-bit LCG PRNG. Returns a closure that produces values in [0, 1).
 * Same seed → same sequence; deterministic across all browsers.
 * Used internally by the match-3 DailyManager.
 */
function makeSeededRng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = Math.imul(1664525, s) + 1013904223;
    s = s >>> 0;
    return s / 0x100000000;
  };
}

/** Convert a date string "YYYY-MM-DD" to a stable numeric seed (FNV-1a). */
function dateToSeed(dateStr) {
  let h = 0x811c9dc5;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h = h >>> 0;
  }
  return h;
}

// ─── Hub mode seeded helpers (Mulberry32) ───────────────────────────────────

/**
 * Convert "YYYY-MM-DD" + modeId to a deterministic integer seed (djb2-style).
 * Used by hub modes.
 */
function seedForDate(dateStr, modeId) {
  const str = dateStr + ':' + (modeId || '');
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Mulberry32 PRNG. Returns a function producing values in [0, 1).
 * Preferred for hub modes (better statistical quality than LCG).
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
 * Fisher-Yates shuffle using a seeded RNG.
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
 * Pick one element from an array using a seed.
 */
function seededPick(arr, seed) {
  const rng = seededRng(seed);
  return arr[Math.floor(rng() * arr.length)];
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

  // ─── Match-3 RNG ─────────────────────────────────────────────────────────

  /** Return a fresh seeded LCG RNG for today's match-3 challenge. */
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

  /** True if the player has already completed today's match-3 daily. */
  isDailyCompleted()  {
    return GameStorage.getStreak().lastDate === this.today;
  }

  // ─── Completion (match-3) ────────────────────────────────────────────────

  /**
   * Mark today's match-3 daily challenge as completed, update streak.
   * @returns {number} The new streak count, or 0 if already completed today.
   */
  completeDaily() {
    if (this.isDailyCompleted()) return 0;

    const streak    = GameStorage.getStreak();
    const yesterday = getYesterdayString();

    const newCount = (streak.lastDate === yesterday)
      ? (streak.count || 0) + 1
      : 1;

    GameStorage.setStreak({ count: newCount, lastDate: this.today, perMode: streak.perMode || {} });
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

  // ─── Hub mode streak helpers ──────────────────────────────────────────────

  /** Return today's date string (respects ?devDate= override). */
  todayStr() { return getDailyDateString(); }

  /**
   * Convert "YYYY-MM-DD" + modeId to a deterministic seed.
   * Each mode gets a unique seed for its daily puzzle selection.
   */
  seedForDate(dateStr, modeId) { return seedForDate(dateStr, modeId); }

  /**
   * Mulberry32 seeded PRNG — preferred for hub modes.
   * @returns {function} rng — produces values in [0, 1)
   */
  seededRng(seed) { return seededRng(seed); }

  /** Fisher-Yates shuffle with seeded RNG. */
  seededShuffle(arr, rng) { return seededShuffle(arr, rng); }

  /** Pick one element from arr using a seed. */
  seededPick(arr, seed) { return seededPick(arr, seed); }

  /**
   * Get the shared streak object (count + per-mode dates).
   * Hub modes use this for the streak bar on the hub screen.
   */
  getStreak() { return GameStorage.getStreak(); }

  /** Has the player completed this mode's daily today? */
  hasCompletedToday(modeId) {
    const today  = getDailyDateString();
    const streak = GameStorage.getStreak();
    return (streak.perMode || {})[modeId] === today;
  }

  /**
   * Record a daily completion for a hub mode.
   * Increments the shared streak if this is the first mode completed today.
   * @returns {{ alreadyCredited: boolean, streak: number }}
   */
  recordDailyCompletion(modeId) {
    const today   = getDailyDateString();
    const streak  = GameStorage.getStreak();
    streak.perMode = streak.perMode || {};

    // Already credited today for this mode?
    if (streak.perMode[modeId] === today) {
      return { alreadyCredited: true, streak: streak.count };
    }

    // Mark mode as done today
    streak.perMode[modeId] = today;

    // Check streak continuity: was any mode done yesterday?
    const yesterday = getYesterdayString();
    const anyYesterday = Object.values(streak.perMode).some(d => d === yesterday);

    // Count completions today (after adding this one)
    const todayCount = Object.values(streak.perMode).filter(d => d === today).length;

    if (todayCount === 1) {
      // First completion today — update global streak
      if (streak.lastDate === yesterday || anyYesterday) {
        streak.count = (streak.count || 0) + 1;
      } else if (streak.lastDate !== today) {
        streak.count = 1; // streak broken → restart
      }
      streak.lastDate = today;
    }

    GameStorage.setStreak(streak);
    this._grantStreakRewards(streak.count);

    return { alreadyCredited: false, streak: streak.count };
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

// Alias for hub modes (they call Daily.*)
const Daily = DailyChallenge;
