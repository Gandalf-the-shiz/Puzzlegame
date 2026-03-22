/**
 * unlocks.js — Cosmetic item catalogue + equip/purchase logic
 *
 * All unlocks are purely cosmetic and do not affect gameplay balance.
 * Items are identified by a string ID stored in GameStorage.
 */

'use strict';

// ─── Themes ──────────────────────────────────────────────────────────────────

const THEMES = [
  {
    id:          'theme_default',
    name:        'Classic',
    emoji:       '🎮',
    description: 'The original dark magic palette',
    cost:        0,
    cssVars: {
      '--bg':      '#0d0d1a',
      '--surface': '#161629',
      '--accent':  '#7c3aed',
      '--accent2': '#06b6d4',
    },
    blockColors: null, // null = use default COLORS array
  },
  {
    id:          'theme_ocean',
    name:        'Ocean',
    emoji:       '🌊',
    description: 'Deep sea blues and teals',
    cost:        100,
    cssVars: {
      '--bg':      '#071528',
      '--surface': '#0d2040',
      '--accent':  '#0284c7',
      '--accent2': '#06b6d4',
    },
    blockColors: ['#0EA5E9','#22D3EE','#38BDF8','#7DD3FC','#0369A1','#0891B2','#164E63','#BAE6FD'],
  },
  {
    id:          'theme_sunset',
    name:        'Sunset',
    emoji:       '🌅',
    description: 'Warm oranges, reds, and purples',
    cost:        150,
    cssVars: {
      '--bg':      '#1a0a0a',
      '--surface': '#2d1515',
      '--accent':  '#dc2626',
      '--accent2': '#f97316',
    },
    blockColors: ['#EF4444','#F97316','#FBBF24','#DC2626','#EA580C','#D97706','#B45309','#FDE68A'],
  },
  {
    id:          'theme_forest',
    name:        'Forest',
    emoji:       '🌲',
    description: 'Earthy greens and browns',
    cost:        200,
    cssVars: {
      '--bg':      '#0a1a0a',
      '--surface': '#142814',
      '--accent':  '#16a34a',
      '--accent2': '#84cc16',
    },
    blockColors: ['#22C55E','#84CC16','#4ADE80','#86EFAC','#15803D','#65A30D','#166534','#BEF264'],
  },
  {
    id:          'theme_neon',
    name:        'Neon',
    emoji:       '⚡',
    description: 'Blinding cyberpunk neons',
    cost:        300,
    cssVars: {
      '--bg':      '#000000',
      '--surface': '#0a0a0a',
      '--accent':  '#ff00ff',
      '--accent2': '#00ffff',
    },
    blockColors: ['#FF00FF','#00FFFF','#FFFF00','#FF0088','#00FF88','#8800FF','#FF8800','#00FFAA'],
  },
];

// ─── Particle Styles ─────────────────────────────────────────────────────────

const PARTICLE_STYLES = [
  {
    id:          'particles_classic',
    name:        'Classic',
    emoji:       '✨',
    description: 'Round & square confetti',
    cost:        0,
  },
  {
    id:          'particles_stars',
    name:        'Stars',
    emoji:       '⭐',
    description: 'Shooting star trails',
    cost:        100,
  },
  {
    id:          'particles_confetti',
    name:        'Confetti',
    emoji:       '🎉',
    description: 'Long colorful strips',
    cost:        200,
  },
  {
    id:          'particles_sparkles',
    name:        'Sparkles',
    emoji:       '💫',
    description: 'Magical sparkle rings',
    cost:        300,
  },
];

// ─── Announcer Packs ─────────────────────────────────────────────────────────

const ANNOUNCER_PACKS = [
  {
    id:          'announcer_wizard',
    name:        'Wizard',
    emoji:       '🧙',
    description: 'Mystical & dramatic',
    cost:        0,
    comboMessages: [
      { min: 2,  msg: 'Nice! 😎',                color: '#2ED573' },
      { min: 3,  msg: 'Awesome! 🔥',             color: '#FFA502' },
      { min: 5,  msg: 'LEGENDARY! ⚡',            color: '#FF4757' },
      { min: 7,  msg: 'UNSTOPPABLE! 💥',          color: '#A29BFE' },
      { min: 10, msg: 'ARE YOU A WIZARD?! 🧙',   color: '#1E90FF' },
      { min: 15, msg: 'ABSOLUTELY UNHINGED! 🔥',  color: '#FF6B81' },
      { min: 20, msg: 'CALL THE POLICE! 🚨',      color: '#FDCB6E' },
    ],
    gameOverMessages: [
      "The blocks have won… this time. 😤",
      "Your fingers need a gym membership. 💪",
      "Error 404: Skills not found. 🤖",
      "Even Einstein would've struggled. 🧠",
      "Press F to pay respects. 😢",
      "You died doing what you loved: losing. 💀",
      "The puzzle wins today. Tomorrow? Maybe you. 🎲",
      "404: Moves not found. Try rebooting brain. 🧠",
    ],
  },
  {
    id:          'announcer_sports',
    name:        'Sports',
    emoji:       '🏆',
    description: 'Sports commentator hype',
    cost:        100,
    comboMessages: [
      { min: 2,  msg: 'NICE PLAY! 🏆',            color: '#2ED573' },
      { min: 3,  msg: 'INCREDIBLE! 🎯',            color: '#FFA502' },
      { min: 5,  msg: 'THAT\'S INSANE! 🏅',        color: '#FF4757' },
      { min: 7,  msg: 'CROWD GOES WILD! 📣',       color: '#A29BFE' },
      { min: 10, msg: 'WHAT A PLAYER! 🥇',         color: '#1E90FF' },
      { min: 15, msg: 'HALL OF FAME! 🏆',          color: '#FF6B81' },
      { min: 20, msg: 'WORLD RECORD!! 🌍',         color: '#FDCB6E' },
    ],
    gameOverMessages: [
      "Game over! You'll do better next time, champ! 🏆",
      "The scoreboard doesn't lie. Keep training! 💪",
      "Tough loss. But champions never quit! 🏅",
      "That's the game! Head back to training camp. 📋",
      "Eliminated! The comeback starts now. 🔥",
    ],
  },
  {
    id:          'announcer_robot',
    name:        'Robot',
    emoji:       '🤖',
    description: 'Cold machine analysis',
    cost:        200,
    comboMessages: [
      { min: 2,  msg: 'SEQUENCE VALID. ✅',        color: '#2ED573' },
      { min: 3,  msg: 'EFFICIENCY +300% 📊',       color: '#FFA502' },
      { min: 5,  msg: 'OVERHEAT WARNING! 🌡️',      color: '#FF4757' },
      { min: 7,  msg: 'CORE MELTDOWN! ☢️',         color: '#A29BFE' },
      { min: 10, msg: 'SYSTEM OVERLOAD! 💻',        color: '#1E90FF' },
      { min: 15, msg: 'REALITY.EXE CRASHED 💥',    color: '#FF6B81' },
      { min: 20, msg: 'SIMULATION BROKEN! 🔴',     color: '#FDCB6E' },
    ],
    gameOverMessages: [
      "PROGRAM TERMINATED. REBOOT REQUIRED. 🔴",
      "CRITICAL FAILURE. PERFORMANCE: 0.02%. 📉",
      "SIMULATION ENDED. HUMAN ERROR DETECTED. 🤖",
      "ANALYSIS: YOU NEED UPGRADES. 🔧",
      "GAME OVER. INITIATING MEMORY WIPE… 💾",
    ],
  },
];

// ─── UnlocksManager ──────────────────────────────────────────────────────────

class UnlocksManager {
  // ─── Catalogue accessors ─────────────────────────────────────────────────

  getAllThemes()         { return THEMES; }
  getAllParticleStyles() { return PARTICLE_STYLES; }
  getAllAnnouncers()     { return ANNOUNCER_PACKS; }

  getTheme(id)          { return THEMES.find(t => t.id === id)          || THEMES[0]; }
  getParticleStyle(id)  { return PARTICLE_STYLES.find(p => p.id === id) || PARTICLE_STYLES[0]; }
  getAnnouncer(id)      { return ANNOUNCER_PACKS.find(a => a.id === id) || ANNOUNCER_PACKS[0]; }

  // ─── Equipped items ───────────────────────────────────────────────────────

  getEquippedTheme() {
    return this.getTheme(GameStorage.getEquipped().theme || 'theme_default');
  }

  getEquippedParticleStyle() {
    return this.getParticleStyle(GameStorage.getEquipped().particles || 'particles_classic');
  }

  getEquippedAnnouncer() {
    return this.getAnnouncer(GameStorage.getEquipped().announcer || 'announcer_wizard');
  }

  /** Return active block color palette (null = use default COLORS). */
  getActiveBlockColors() {
    return this.getEquippedTheme().blockColors || null;
  }

  // ─── Apply theme to DOM ───────────────────────────────────────────────────

  applyEquippedTheme() {
    const theme = this.getEquippedTheme();
    const root  = document.documentElement;
    for (const [prop, val] of Object.entries(theme.cssVars || {})) {
      root.style.setProperty(prop, val);
    }
  }

  // ─── Purchase ─────────────────────────────────────────────────────────────

  /**
   * Purchase a cosmetic item with Wizard Dust.
   * @returns {{ success: boolean, reason?: string }}
   */
  purchase(itemId) {
    if (GameStorage.isUnlocked(itemId)) {
      return { success: false, reason: 'already_owned' };
    }
    const item = [...THEMES, ...PARTICLE_STYLES, ...ANNOUNCER_PACKS].find(i => i.id === itemId);
    if (!item) return { success: false, reason: 'not_found' };
    if (!GameStorage.spendDust(item.cost)) {
      return { success: false, reason: 'insufficient_dust' };
    }
    GameStorage.unlock(itemId);
    return { success: true };
  }

  // ─── Equip ────────────────────────────────────────────────────────────────

  /**
   * Equip a cosmetic item (must be unlocked).
   * @param {'theme'|'particles'|'announcer'} category
   * @param {string} itemId
   * @returns {boolean} success
   */
  equip(category, itemId) {
    if (!GameStorage.isUnlocked(itemId)) return false;
    GameStorage.equip(category, itemId);
    if (category === 'theme') this.applyEquippedTheme();
    return true;
  }

  // ─── Announcer helpers ────────────────────────────────────────────────────

  /** Get the combo message object for the given combo count, using equipped announcer. */
  getComboMsg(combo) {
    const msgs = this.getEquippedAnnouncer().comboMessages;
    let best = null;
    for (const entry of msgs) {
      if (combo >= entry.min) best = entry;
    }
    return best;
  }

  /** Get a random game-over message from the equipped announcer. */
  getGameOverMsg() {
    const msgs = this.getEquippedAnnouncer().gameOverMessages;
    return msgs[Math.floor(Math.random() * msgs.length)];
  }
}

const Unlocks = new UnlocksManager();
