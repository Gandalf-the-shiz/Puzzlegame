/**
 * settings.js — Player preferences with localStorage persistence
 *
 * Exposes a singleton `Settings` used by both the match-3 game and hub modes.
 *
 * Hub modes call:
 *   Settings.isSfxOn()       Settings.isHapticsOn()    Settings.isColorblind()
 *   Settings.hapticPulse(ms) Settings.get()             Settings.set(key, val)
 *
 * Match-3 game calls:
 *   Settings.getSoundOn()    Settings.getMusicOn()      Settings.getHapticsOn()
 *   Settings.getColorblind() Settings.vibrate(pattern)
 */

'use strict';

class SettingsManager {
  // ─── Internal key accessors ──────────────────────────────────────────────

  get(key) {
    const s = GameStorage.getSettings();
    // Map hub keys to internal keys
    if (key === 'sfx')        return s.soundOn        !== false;
    if (key === 'music')      return s.musicOn         === true;
    if (key === 'haptics')    return s.hapticsOn       !== false;
    if (key === 'colorblind') return s.colorblindMode  === true;
    return s[key];
  }

  set(key, value) {
    // Map hub keys to internal keys
    if (key === 'sfx')        { GameStorage.setSetting('soundOn',        value); return; }
    if (key === 'music')      { GameStorage.setSetting('musicOn',         value); return; }
    if (key === 'haptics')    { GameStorage.setSetting('hapticsOn',       value); return; }
    if (key === 'colorblind') { GameStorage.setSetting('colorblindMode',  value); return; }
    GameStorage.setSetting(key, value);
  }

  /** Return settings as a hub-friendly object { sfx, music, haptics, colorblind }. */
  getAll() {
    const s = GameStorage.getSettings();
    return {
      sfx:        s.soundOn        !== false,
      music:      s.musicOn         === true,
      haptics:    s.hapticsOn       !== false,
      colorblind: s.colorblindMode  === true,
    };
  }

  // ─── Match-3 API ─────────────────────────────────────────────────────────

  getSoundOn()     { return GameStorage.getSettings().soundOn        !== false; }
  getMusicOn()     { return GameStorage.getSettings().musicOn         === true;  }
  getHapticsOn()   { return GameStorage.getSettings().hapticsOn       !== false; }
  getColorblind()  { return GameStorage.getSettings().colorblindMode  === true;  }

  setSoundOn(v)    { GameStorage.setSetting('soundOn',        v); }
  setMusicOn(v)    { GameStorage.setSetting('musicOn',         v); }
  setHapticsOn(v)  { GameStorage.setSetting('hapticsOn',       v); }
  setColorblind(v) { GameStorage.setSetting('colorblindMode',  v); }

  /**
   * Trigger device vibration if haptics are enabled.
   * @param {number|number[]} pattern — ms pattern passed to navigator.vibrate
   */
  vibrate(pattern = 30) {
    if (!this.getHapticsOn()) return;
    if (navigator && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  // ─── Hub mode API ─────────────────────────────────────────────────────────

  isSfxOn()       { return this.getSoundOn(); }
  isHapticsOn()   { return this.getHapticsOn(); }
  isColorblind()  { return this.getColorblind(); }

  /**
   * Short haptic pulse — hub mode alias for vibrate().
   * @param {number} ms - duration in milliseconds
   */
  hapticPulse(ms = 20) { this.vibrate(ms); }

  // ─── load/save (no-op shims for legacy callers) ───────────────────────────
  load()   { /* settings always come from GameStorage */ }
  save()   { /* settings are saved immediately on set() */ }
}

const Settings = new SettingsManager();
