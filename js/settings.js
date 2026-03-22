/**
 * settings.js — Shared settings (SFX, music, haptics, colorblind)
 */

'use strict';

const Settings = (() => {
  let _s = { sfx: true, music: false, haptics: true, colorblind: false };

  function load() {
    _s = Storage.getSettings();
    return _s;
  }

  function save() {
    Storage.saveSettings(_s);
  }

  function get() { return { ..._s }; }

  function set(key, val) {
    _s[key] = val;
    save();
  }

  function isSfxOn()       { return _s.sfx; }
  function isHapticsOn()   { return _s.haptics; }
  function isColorblind()  { return _s.colorblind; }

  /** Trigger a short haptic pulse if enabled and supported. */
  function hapticPulse(ms = 20) {
    if (!_s.haptics) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch {}
  }

  return { load, save, get, set, isSfxOn, isHapticsOn, isColorblind, hapticPulse };
})();
