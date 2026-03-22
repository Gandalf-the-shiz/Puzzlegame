/**
 * storage.js — Versioned save/load with backwards-compatible migration
 *
 * All game state is stored under a single `puzzlegame.save` localStorage key.
 * Legacy v1 keys (infinityPuzzle_*) are migrated on first load.
 */

'use strict';

const SAVE_VERSION = 2;
const LS_KEY       = 'puzzlegame.save';

// v1 legacy keys (from original ScoreManager)
const LS_V1_HIGH_SCORE = 'infinityPuzzle_highScore';
const LS_V1_BEST_LEVEL = 'infinityPuzzle_bestLevel';
const LS_V1_SOUND_ON   = 'infinityPuzzle_soundOn';

/** Deep-clone an object using JSON round-trip (safe for plain objects) */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const DEFAULT_SAVE = {
  saveVersion:  SAVE_VERSION,
  highScores:   { endless: 0, daily: 0, hardcore: 0 },
  bestLevel:    1,
  dust:         0,
  dailyStreak:  { count: 0, lastDate: null },
  unlockedItems: ['theme_default', 'particles_classic', 'announcer_wizard'],
  equippedItems: {
    theme:     'theme_default',
    particles: 'particles_classic',
    announcer: 'announcer_wizard',
  },
  settings: {
    soundOn:        true,
    musicOn:        false,
    hapticsOn:      true,
    colorblindMode: false,
  },
  leaderboards: { endless: [], daily: [], hardcore: [] },
};

class Storage {
  constructor() {
    this._data = this._load();
  }

  // ─── Load & Migration ────────────────────────────────────────────────────

  _load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return this._migrate(parsed);
      }
    } catch { /* ignore parse errors */ }

    // No v2 save found — try migrating from v1
    return this._migrateFromV1();
  }

  /** Ensure all expected fields exist (handles partial/old v2 saves) */
  _migrate(data) {
    const d = Object.assign({}, deepClone(DEFAULT_SAVE), data);
    d.highScores    = Object.assign({}, DEFAULT_SAVE.highScores,    data.highScores   || {});
    d.dailyStreak   = Object.assign({}, DEFAULT_SAVE.dailyStreak,   data.dailyStreak  || {});
    d.equippedItems = Object.assign({}, DEFAULT_SAVE.equippedItems, data.equippedItems|| {});
    d.settings      = Object.assign({}, DEFAULT_SAVE.settings,      data.settings     || {});
    d.leaderboards  = Object.assign({}, DEFAULT_SAVE.leaderboards,  data.leaderboards || {});
    if (!Array.isArray(d.unlockedItems)) {
      d.unlockedItems = DEFAULT_SAVE.unlockedItems.slice();
    }
    d.saveVersion = SAVE_VERSION;
    return d;
  }

  /** Import high score and preferences from the original v1 localStorage keys */
  _migrateFromV1() {
    const d = deepClone(DEFAULT_SAVE);
    try {
      const hs = parseInt(localStorage.getItem(LS_V1_HIGH_SCORE) || '0', 10);
      if (hs > 0) d.highScores.endless = hs;

      const bl = parseInt(localStorage.getItem(LS_V1_BEST_LEVEL) || '1', 10);
      if (bl > 1) d.bestLevel = bl;

      const sound = localStorage.getItem(LS_V1_SOUND_ON);
      if (sound !== null) d.settings.soundOn = (sound === 'true');
    } catch { /* ignore */ }
    return d;
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this._data));
    } catch { /* storage full or unavailable */ }
  }

  // ─── Generic getters/setters ─────────────────────────────────────────────

  get(key)          { return this._data[key]; }
  set(key, value)   { this._data[key] = value; this.save(); }

  // ─── High Scores ──────────────────────────────────────────────────────────

  getHighScore(mode) {
    return this._data.highScores[mode] || 0;
  }

  /**
   * Update high score if `score` beats the current best.
   * @returns {boolean} true if a new high score was set
   */
  setHighScore(mode, score) {
    if (score > (this._data.highScores[mode] || 0)) {
      this._data.highScores[mode] = score;
      this.save();
      return true;
    }
    return false;
  }

  // ─── Wizard Dust ──────────────────────────────────────────────────────────

  getDust()             { return this._data.dust || 0; }
  addDust(amount)       { this._data.dust = (this._data.dust || 0) + Math.max(0, amount); this.save(); return this._data.dust; }
  spendDust(amount)     {
    if (this._data.dust < amount) return false;
    this._data.dust -= amount;
    this.save();
    return true;
  }

  // ─── Daily Streak ─────────────────────────────────────────────────────────

  getStreak()           { return Object.assign({}, this._data.dailyStreak); }
  setStreak(streak)     { this._data.dailyStreak = Object.assign({}, streak); this.save(); }

  // ─── Unlocks ──────────────────────────────────────────────────────────────

  getUnlocked()         { return this._data.unlockedItems.slice(); }
  isUnlocked(itemId)    { return this._data.unlockedItems.includes(itemId); }

  unlock(itemId) {
    if (!this._data.unlockedItems.includes(itemId)) {
      this._data.unlockedItems.push(itemId);
      this.save();
    }
  }

  // ─── Equipped Items ───────────────────────────────────────────────────────

  getEquipped()              { return Object.assign({}, this._data.equippedItems); }
  equip(category, itemId)    { this._data.equippedItems[category] = itemId; this.save(); }

  // ─── Settings ─────────────────────────────────────────────────────────────

  getSettings()              { return Object.assign({}, this._data.settings); }
  setSetting(key, value)     { this._data.settings[key] = value; this.save(); }

  // ─── Leaderboards ─────────────────────────────────────────────────────────

  getLeaderboard(mode) {
    return (this._data.leaderboards[mode] || []).slice();
  }

  /**
   * Add an entry to a leaderboard (keeps top 10 by score).
   * @returns {number} Rank of the new entry (1-indexed), 0 if not in top 10
   */
  addLeaderboardEntry(mode, entry) {
    const lb = this._data.leaderboards[mode] || [];
    lb.push(entry);
    lb.sort((a, b) => b.score - a.score);
    const trimmed = lb.slice(0, 10);
    this._data.leaderboards[mode] = trimmed;
    this.save();
    const rank = trimmed.findIndex(e =>
      e.score === entry.score && e.timestamp === entry.timestamp
    ) + 1;
    return rank > 0 ? rank : 0;
  }
}

// Singleton — all modules reference window.GameStorage
const GameStorage = new Storage();
