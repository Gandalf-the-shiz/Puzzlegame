/**
 * utils.js — Shared utilities, constants, and configuration
 */

'use strict';

const GRID_COLS = 6;
const GRID_ROWS = 6;

// Block types
const BlockType = Object.freeze({
  NORMAL:   'normal',
  NUMBER:   'number',
  BLOCKER:  'blocker',
  BOMB:     'bomb',
  RAINBOW:  'rainbow',
});

// Vibrant color palette — index maps to difficulty unlock level
const COLORS = [
  '#FF4757', // red      — unlocked at level 1
  '#2ED573', // green    — unlocked at level 1
  '#1E90FF', // blue     — unlocked at level 1
  '#FFA502', // orange   — unlocked at level 1
  '#A29BFE', // purple   — unlocked at level 3
  '#FF6B81', // pink     — unlocked at level 5
  '#00CEC9', // teal     — unlocked at level 7
  '#FDCB6E', // yellow   — unlocked at level 9
];

const COLOR_NAMES = ['Red','Green','Blue','Orange','Purple','Pink','Teal','Yellow'];

// Darker shade per color for glow/shadow effects
const COLORS_DARK = [
  '#c0392b',
  '#1e8449',
  '#1565c0',
  '#e67e22',
  '#6c3483',
  '#c0392b',
  '#00897b',
  '#f39c12',
];

const BLOCKER_COLOR   = '#636e72';
const BOMB_COLOR      = '#2d3436';
const RAINBOW_COLOR   = null; // drawn with gradient

// Combo messages — key is minimum combo needed
const COMBO_MESSAGES = [
  { min: 2,  msg: 'Nice! 😎',                color: '#2ED573' },
  { min: 3,  msg: 'Awesome! 🔥',             color: '#FFA502' },
  { min: 5,  msg: 'LEGENDARY! ⚡',            color: '#FF4757' },
  { min: 7,  msg: 'UNSTOPPABLE! 💥',          color: '#A29BFE' },
  { min: 10, msg: 'ARE YOU A WIZARD?! 🧙‍♂️',   color: '#1E90FF' },
  { min: 15, msg: 'ABSOLUTELY UNHINGED! 🔥',  color: '#FF6B81' },
  { min: 20, msg: 'CALL THE POLICE! 🚨',      color: '#FDCB6E' },
];

// Rotating game-over messages
const GAME_OVER_MESSAGES = [
  "The blocks have won… this time. 😤",
  "Your fingers need a gym membership. 💪",
  "Error 404: Skills not found. 🤖",
  "The board is too stacked — just like you. 😏",
  "Gravity: 1  You: 0 🪐",
  "Even Einstein would've struggled. 🧠",
  "404: Moves not found. Try rebooting brain. 🧠",
  "Press F to pay respects. 😢",
  "You died doing what you loved: losing. 💀",
  "The puzzle wins today. Tomorrow? Maybe you. 🎲",
];

// Milestone messages at score thresholds
const MILESTONES = [
  { score: 500,   msg: '🎉 500 Club!',           color: '#2ED573' },
  { score: 1000,  msg: '🔥 1K Legend!',           color: '#FFA502' },
  { score: 2500,  msg: '⚡ 2500 Shock!',          color: '#FF4757' },
  { score: 5000,  msg: '🧙 5K Wizard!',           color: '#A29BFE' },
  { score: 10000, msg: '👑 10K ROYALTY!',          color: '#FDCB6E' },
  { score: 25000, msg: '🛸 25K ALIEN BRAIN!',      color: '#1E90FF' },
];

// Easing functions for animations
const Easing = {
  linear:   t => t,
  easeIn:   t => t * t,
  easeOut:  t => t * (2 - t),
  easeInOut:t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t,
  bounce:   t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1/d1)       return n1*t*t;
    if (t < 2/d1)       return n1*(t-=1.5/d1)*t+0.75;
    if (t < 2.5/d1)     return n1*(t-=2.25/d1)*t+0.9375;
    return n1*(t-=2.625/d1)*t+0.984375;
  },
  elastic:  t => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10*t-10)*Math.sin((t*10-10.75)*(2*Math.PI)/3);
  },
};

/**
 * Linear interpolation
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Clamp value between min and max
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Pick a random element from an array
 */
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Shuffle array in-place (Fisher-Yates)
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Return a random integer in [min, max] inclusive
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a rainbow gradient string for canvas fillStyle
 */
function makeRainbowGradient(ctx, x, y, size) {
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0,    '#FF4757');
  grad.addColorStop(0.17, '#FFA502');
  grad.addColorStop(0.33, '#FDCB6E');
  grad.addColorStop(0.5,  '#2ED573');
  grad.addColorStop(0.67, '#1E90FF');
  grad.addColorStop(0.83, '#A29BFE');
  grad.addColorStop(1,    '#FF6B81');
  return grad;
}

/**
 * Format a large number with commas
 */
function formatNumber(n) {
  return n.toLocaleString();
}

/**
 * Get the combo message for a given combo count
 */
function getComboMessage(combo) {
  let best = null;
  for (const entry of COMBO_MESSAGES) {
    if (combo >= entry.min) best = entry;
  }
  return best;
}

/**
 * Get a random game-over message
 */
function getGameOverMessage() {
  return randomPick(GAME_OVER_MESSAGES);
}

/**
 * Check if a milestone was just hit (score crossed the threshold)
 */
function getMilestone(prevScore, newScore) {
  for (const m of MILESTONES) {
    if (prevScore < m.score && newScore >= m.score) return m;
  }
  return null;
}
