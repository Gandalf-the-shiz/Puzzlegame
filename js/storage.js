/**
 * storage.js — Versioned localStorage with namespaced keys and migration
 *
 * Schema version: 1
 * All keys are prefixed with "puzzlegame."
 * Legacy keys (infinityPuzzle_*) are migrated on first load.
 */

'use strict';

const Storage = (() => {
  const PREFIX      = 'puzzlegame.';
  const SCHEMA_VER  = 1;
  const VER_KEY     = PREFIX + 'schemaVersion';

  // ── Internal helpers ────────────────────────────────────────────

  function _get(key) {
    try { return localStorage.getItem(PREFIX + key); } catch { return null; }
  }

  function _set(key, val) {
    try { localStorage.setItem(PREFIX + key, String(val)); } catch { /* quota */ }
  }

  function _getJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function _setJSON(key, val) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch { /* quota */ }
  }

  function _remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
  }

  // ── Migration from legacy keys ───────────────────────────────────

  function _migrate() {
    const ver = parseInt(_get('schemaVersion') || '0', 10);
    if (ver >= SCHEMA_VER) return;

    // v0 → v1: import old match-3 scores
    try {
      const oldHS = localStorage.getItem('infinityPuzzle_highScore');
      const oldBL = localStorage.getItem('infinityPuzzle_bestLevel');
      const oldSnd = localStorage.getItem('infinityPuzzle_soundOn');
      if (oldHS) _set('modes.match.highScore', oldHS);
      if (oldBL) _set('modes.match.bestLevel', oldBL);
      if (oldSnd) _set('settings.sfx', oldSnd);
    } catch { /* ignore */ }

    _set('schemaVersion', SCHEMA_VER);
  }

  // ── Public API ───────────────────────────────────────────────────

  return {
    init() { _migrate(); },

    // Generic read/write
    get:    _get,
    set:    _set,
    getJSON: _getJSON,
    setJSON: _setJSON,
    remove: _remove,

    // Mode-specific helpers
    getModeData(modeId, fallback = {}) {
      return _getJSON('modes.' + modeId, fallback);
    },
    setModeData(modeId, data) {
      _setJSON('modes.' + modeId, data);
    },
    getModeField(modeId, field, fallback) {
      const data = _getJSON('modes.' + modeId, {});
      return field in data ? data[field] : fallback;
    },
    setModeField(modeId, field, value) {
      const data = _getJSON('modes.' + modeId, {});
      data[field] = value;
      _setJSON('modes.' + modeId, data);
    },

    // Economy
    getDust() { return parseInt(_get('economy.dust') || '0', 10) || 0; },
    setDust(n) { _set('economy.dust', Math.max(0, Math.floor(n))); },

    // Settings
    getSettings() {
      return _getJSON('settings', { sfx: true, music: false, haptics: true, colorblind: false });
    },
    saveSettings(s) { _setJSON('settings', s); },

    // Unlocks
    getUnlocks() { return _getJSON('unlocks', { themes: [], particles: [], borders: [] }); },
    saveUnlocks(u) { _setJSON('unlocks', u); },

    // Equipped cosmetics
    getEquipped() { return _getJSON('equipped', { theme: 'default', particles: 'default', border: 'none' }); },
    saveEquipped(e) { _setJSON('equipped', e); },

    // Daily streak
    getDailyStreak() { return _getJSON('daily.streak', { count: 0, lastDate: null, perMode: {} }); },
    saveDailyStreak(s) { _setJSON('daily.streak', s); },

    // Leaderboard
    getLeaderboard(modeId) { return _getJSON('lb.' + modeId, []); },
    saveLeaderboard(modeId, entries) { _setJSON('lb.' + modeId, entries); },
  };
})();
