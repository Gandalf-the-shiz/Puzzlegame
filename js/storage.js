/**
 * storage.js — Versioned save/load with backwards-compatible migration
 *
 * All game state is stored under a single `puzzlegame.save` localStorage key.
 * Legacy v1 keys (infinityPuzzle_*) are migrated on first load.
 *
 * Exports:
 *   GameStorage   — primary singleton (used by match-3 game)
 *   Storage       — alias for GameStorage (used by hub modes)
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
  // Match-3 high scores
  highScores:   { endless: 0, daily: 0, hardcore: 0 },
  bestLevel:    1,
  // Shared Wizard Dust economy
  dust:         0,
  // Daily streak (shared; perMode tracks per-mode completion dates)
  dailyStreak:  { count: 0, lastDate: null, perMode: {} },
  // Match-3 unlocks (full item IDs like 'theme_ocean')
  unlockedItems: ['theme_default', 'particles_classic', 'announcer_wizard'],
  equippedItems: {
    theme:     'theme_default',
    particles: 'particles_classic',
    announcer: 'announcer_wizard',
  },
  // Shared settings
  settings: {
    soundOn:        true,
    musicOn:        false,
    hapticsOn:      true,
    colorblindMode: false,
  },
  // Match-3 leaderboards
  leaderboards: { endless: [], daily: [], hardcore: [] },
  // Hub mode leaderboards + state (keyed by modeId)
  modeData: {},
  hubLb:    {},
  // Hub cosmetics (separate from match-3 cosmetics, simpler IDs)
  hubCosmetics: {
    unlocks:  { themes: [], particles: [], borders: [] },
    equipped: { theme: 'default', particles: 'default', border: 'none' },
  },
};

class GameStorageClass {
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
    const d = Object.assign(deepClone(DEFAULT_SAVE), data);
    d.highScores    = Object.assign({}, DEFAULT_SAVE.highScores,    data.highScores   || {});
    d.dailyStreak   = Object.assign({ perMode: {} }, DEFAULT_SAVE.dailyStreak, data.dailyStreak || {});
    if (!d.dailyStreak.perMode) d.dailyStreak.perMode = {};
    d.equippedItems = Object.assign({}, DEFAULT_SAVE.equippedItems, data.equippedItems|| {});
    d.settings      = Object.assign({}, DEFAULT_SAVE.settings,      data.settings     || {});
    d.leaderboards  = Object.assign({}, DEFAULT_SAVE.leaderboards,  data.leaderboards || {});
    if (!Array.isArray(d.unlockedItems)) {
      d.unlockedItems = DEFAULT_SAVE.unlockedItems.slice();
    }
    if (!d.modeData)     d.modeData     = {};
    if (!d.hubLb)        d.hubLb        = {};
    if (!d.hubCosmetics) d.hubCosmetics = deepClone(DEFAULT_SAVE.hubCosmetics);
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

  // ─── High Scores (match-3 modes) ──────────────────────────────────────────

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

  getDust()         { return this._data.dust || 0; }

  addDust(amount) {
    this._data.dust = (this._data.dust || 0) + Math.max(0, Math.round(amount));
    this.save();
    return this._data.dust;
  }

  /** Set dust to an exact value (used by Economy module). */
  setDust(n) {
    this._data.dust = Math.max(0, Math.floor(n));
    this.save();
  }

  spendDust(amount) {
    if (this._data.dust < amount) return false;
    this._data.dust -= amount;
    this.save();
    return true;
  }

  // ─── Daily Streak ─────────────────────────────────────────────────────────

  getStreak()        { return Object.assign({ perMode: {} }, this._data.dailyStreak); }
  setStreak(streak)  { this._data.dailyStreak = Object.assign({ perMode: {} }, streak); this.save(); }

  /** Hub alias */
  getDailyStreak()       { return this.getStreak(); }
  saveDailyStreak(s)     { this.setStreak(s); }

  // ─── Unlocks (match-3, full item IDs like 'theme_ocean') ─────────────────

  getUnlocked()      { return this._data.unlockedItems.slice(); }
  isUnlocked(itemId) { return this._data.unlockedItems.includes(itemId); }

  unlock(itemId) {
    if (!this._data.unlockedItems.includes(itemId)) {
      this._data.unlockedItems.push(itemId);
      this.save();
    }
  }

  // ─── Equipped Items (match-3) ─────────────────────────────────────────────

  getEquipped()              { return Object.assign({}, this._data.equippedItems); }
  equip(category, itemId)    { this._data.equippedItems[category] = itemId; this.save(); }

  // ─── Hub Cosmetics (simpler IDs: 'sunset', 'stars', etc.) ────────────────

  getUnlocks() {
    const hc = this._data.hubCosmetics || DEFAULT_SAVE.hubCosmetics;
    return {
      themes:    (hc.unlocks && hc.unlocks.themes)    || [],
      particles: (hc.unlocks && hc.unlocks.particles) || [],
      borders:   (hc.unlocks && hc.unlocks.borders)   || [],
    };
  }

  saveUnlocks(u) {
    if (!this._data.hubCosmetics) this._data.hubCosmetics = deepClone(DEFAULT_SAVE.hubCosmetics);
    this._data.hubCosmetics.unlocks = u;
    this.save();
  }

  getHubEquipped() {
    const hc = this._data.hubCosmetics || DEFAULT_SAVE.hubCosmetics;
    return Object.assign({ theme: 'default', particles: 'default', border: 'none' }, hc.equipped || {});
  }

  saveHubEquipped(e) {
    if (!this._data.hubCosmetics) this._data.hubCosmetics = deepClone(DEFAULT_SAVE.hubCosmetics);
    this._data.hubCosmetics.equipped = e;
    this.save();
  }

  /** Hub alias for getHubEquipped/saveHubEquipped */
  saveEquipped(e) { this.saveHubEquipped(e); }

  // ─── Settings ─────────────────────────────────────────────────────────────

  getSettings()              { return Object.assign({}, this._data.settings); }
  setSetting(key, value)     { this._data.settings[key] = value; this.save(); }

  /** Hub alias */
  saveSettings(s) {
    // Map hub setting keys → internal keys
    const mapped = {};
    if ('sfx'        in s) mapped.soundOn        = s.sfx;
    if ('music'      in s) mapped.musicOn         = s.music;
    if ('haptics'    in s) mapped.hapticsOn       = s.haptics;
    if ('colorblind' in s) mapped.colorblindMode  = s.colorblind;
    // Allow direct internal keys too
    Object.assign(mapped, s);
    Object.assign(this._data.settings, mapped);
    this.save();
  }

  // ─── Mode Data (hub modes, keyed by modeId) ───────────────────────────────

  getModeData(modeId, fallback = {}) {
    return Object.assign({}, fallback, this._data.modeData[modeId] || {});
  }

  setModeData(modeId, data) {
    this._data.modeData[modeId] = data;
    this.save();
  }

  getModeField(modeId, field, fallback) {
    // Special case: match-3 high score lives in highScores
    if (modeId === 'match' && field === 'highScore') {
      return this._data.highScores.endless || fallback;
    }
    const data = this._data.modeData[modeId] || {};
    return field in data ? data[field] : fallback;
  }

  setModeField(modeId, field, value) {
    if (!this._data.modeData[modeId]) this._data.modeData[modeId] = {};
    this._data.modeData[modeId][field] = value;
    this.save();
  }

  // ─── Hub Leaderboards ─────────────────────────────────────────────────────

  /** Get hub mode leaderboard (array of entries). */
  getLeaderboard(mode) {
    // Route match-3 modes to main leaderboards, hub modes to hubLb
    if (mode === 'endless' || mode === 'daily' || mode === 'hardcore') {
      return (this._data.leaderboards[mode] || []).slice();
    }
    return (this._data.hubLb[mode] || []).slice();
  }

  /** Save hub mode leaderboard. */
  saveLeaderboard(mode, entries) {
    if (mode === 'endless' || mode === 'daily' || mode === 'hardcore') {
      this._data.leaderboards[mode] = entries;
    } else {
      this._data.hubLb[mode] = entries;
    }
    this.save();
  }

  /**
   * Add an entry to a leaderboard (keeps top 10 by score).
   * Used by main's match-3 game (match modes).
   * @returns {number} Rank of the new entry (1-indexed), 0 if not in top 10
   */
  addLeaderboardEntry(mode, entry) {
    const lb = this.getLeaderboard(mode);
    lb.push(entry);
    lb.sort((a, b) => b.score - a.score);
    const trimmed = lb.slice(0, 10);
    this.saveLeaderboard(mode, trimmed);
    const rank = trimmed.findIndex(e =>
      e.score === entry.score && e.timestamp === entry.timestamp
    ) + 1;
    return rank > 0 ? rank : 0;
  }
}

// Singleton — all modules reference window.GameStorage
const GameStorage = new GameStorageClass();

// Expose singleton globally; hub modules call Storage.*, match-3 calls GameStorage.*
// `const Storage` creates a lexical binding visible to all scripts in this realm,
// so bare `Storage` in app.js resolves to the instance, not the class constructor.
const Storage = GameStorage;
if (typeof window !== 'undefined') {
  window.GameStorage = GameStorage;
  window.Storage = GameStorage;
}
