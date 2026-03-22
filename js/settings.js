/**
 * settings.js — Player preferences with localStorage persistence
 */

'use strict';

class SettingsManager {
  get(key)         { return GameStorage.getSettings()[key]; }
  set(key, value)  { GameStorage.setSetting(key, value); }

  getSoundOn()     { return this.get('soundOn')        !== false; }
  getMusicOn()     { return this.get('musicOn')        === true;  }
  getHapticsOn()   { return this.get('hapticsOn')      !== false; }
  getColorblind()  { return this.get('colorblindMode') === true;  }

  setSoundOn(v)    { this.set('soundOn',        v); }
  setMusicOn(v)    { this.set('musicOn',         v); }
  setHapticsOn(v)  { this.set('hapticsOn',       v); }
  setColorblind(v) { this.set('colorblindMode',  v); }

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
}

const Settings = new SettingsManager();
