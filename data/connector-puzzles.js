/**
 * connector-puzzles.js — Hand-authored Connector puzzle packs
 *
 * Format: array of puzzles. Each puzzle has 4 groups of 4 words.
 * Groups sorted by difficulty: 0=easiest (yellow), 3=hardest (purple).
 */

'use strict';

const CONNECTOR_PUZZLES = [
  {
    id: 0,
    groups: [
      { theme: 'Things in the sky', color: '#f59e0b', words: ['SUN', 'MOON', 'STAR', 'CLOUD'] },
      { theme: 'Types of music', color: '#22c55e', words: ['JAZZ', 'ROCK', 'BLUES', 'SOUL'] },
      { theme: '___ ball', color: '#3b82f6', words: ['FIRE', 'SNOW', 'FOOT', 'BASE'] },
      { theme: 'Things a wizard has', color: '#a855f7', words: ['WAND', 'ROBE', 'STAFF', 'HAT'] },
    ]
  },
  {
    id: 1,
    groups: [
      { theme: 'Colors', color: '#f59e0b', words: ['RED', 'BLUE', 'GREEN', 'PINK'] },
      { theme: 'Breakfast foods', color: '#22c55e', words: ['EGGS', 'TOAST', 'BACON', 'WAFFLE'] },
      { theme: 'Things with buttons', color: '#3b82f6', words: ['SHIRT', 'REMOTE', 'PHONE', 'COAT'] },
      { theme: 'Words that follow THUNDER', color: '#a855f7', words: ['BIRD', 'BOLT', 'STORM', 'CLAP'] },
    ]
  },
  {
    id: 2,
    groups: [
      { theme: 'Furniture', color: '#f59e0b', words: ['CHAIR', 'DESK', 'SOFA', 'BED'] },
      { theme: 'Card games', color: '#22c55e', words: ['POKER', 'SNAP', 'SPIT', 'WAR'] },
      { theme: 'Things that are round', color: '#3b82f6', words: ['WHEEL', 'COIN', 'GLOBE', 'DONUT'] },
      { theme: '___ fish', color: '#a855f7', words: ['SWORD', 'STAR', 'CAT', 'BLOW'] },
    ]
  },
  {
    id: 3,
    groups: [
      { theme: 'Hot things', color: '#f59e0b', words: ['FIRE', 'SUN', 'LAVA', 'STEAM'] },
      { theme: 'Olympic sports', color: '#22c55e', words: ['SWIM', 'DIVE', 'VAULT', 'HURDLE'] },
      { theme: 'Parts of a plant', color: '#3b82f6', words: ['ROOT', 'STEM', 'LEAF', 'SEED'] },
      { theme: 'Things you shout', color: '#a855f7', words: ['GOAL', 'FORE', 'BINGO', 'SNAP'] },
    ]
  },
  {
    id: 4,
    groups: [
      { theme: 'Things that fly', color: '#f59e0b', words: ['BIRD', 'PLANE', 'KITE', 'BEE'] },
      { theme: 'Shades of blue', color: '#22c55e', words: ['NAVY', 'SKY', 'TEAL', 'COBALT'] },
      { theme: 'Kitchen tools', color: '#3b82f6', words: ['PAN', 'WHISK', 'LADLE', 'KNIFE'] },
      { theme: 'Words with OVER', color: '#a855f7', words: ['GAME', 'COAT', 'HAUL', 'LOOK'] },
    ]
  },
  {
    id: 5,
    groups: [
      { theme: 'Baby animals', color: '#f59e0b', words: ['LAMB', 'FOAL', 'CUB', 'KID'] },
      { theme: 'Types of weather', color: '#22c55e', words: ['HAIL', 'SLEET', 'FOG', 'DRIZZLE'] },
      { theme: 'Things in a library', color: '#3b82f6', words: ['BOOK', 'SHELF', 'CARD', 'DESK'] },
      { theme: 'Sports without a ball', color: '#a855f7', words: ['POLO', 'GOLF', 'SQUASH', 'TENNIS'] },
    ]
  },
  {
    id: 6,
    groups: [
      { theme: 'Planets', color: '#f59e0b', words: ['MARS', 'VENUS', 'EARTH', 'SATURN'] },
      { theme: 'Types of hat', color: '#22c55e', words: ['CAP', 'BERET', 'FEDORA', 'BEANIE'] },
      { theme: 'Things that spin', color: '#3b82f6', words: ['TOP', 'FAN', 'WHEEL', 'DRILL'] },
      { theme: 'Gemstones', color: '#a855f7', words: ['RUBY', 'PEARL', 'OPAL', 'JADE'] },
    ]
  },
  {
    id: 7,
    groups: [
      { theme: 'Sweet things', color: '#f59e0b', words: ['HONEY', 'CANDY', 'JAM', 'SUGAR'] },
      { theme: 'Board games', color: '#22c55e', words: ['CHESS', 'GO', 'RISK', 'CLUE'] },
      { theme: 'Parts of a shoe', color: '#3b82f6', words: ['SOLE', 'HEEL', 'TOE', 'LACE'] },
      { theme: 'Collective nouns for animals', color: '#a855f7', words: ['PRIDE', 'FLOCK', 'PACK', 'SWARM'] },
    ]
  },
  {
    id: 8,
    groups: [
      { theme: 'Things on a map', color: '#f59e0b', words: ['ROAD', 'RIVER', 'HILL', 'LAKE'] },
      { theme: 'Fast things', color: '#22c55e', words: ['JET', 'CHEETAH', 'BULLET', 'FLASH'] },
      { theme: 'Things that are cold', color: '#3b82f6', words: ['ICE', 'SNOW', 'FROST', 'SLEET'] },
      { theme: 'Parts of a sentence', color: '#a855f7', words: ['NOUN', 'VERB', 'CLAUSE', 'PHRASE'] },
    ]
  },
  {
    id: 9,
    groups: [
      { theme: 'Things on a beach', color: '#f59e0b', words: ['SAND', 'WAVE', 'SHELL', 'PIER'] },
      { theme: 'Words meaning angry', color: '#22c55e', words: ['MAD', 'CROSS', 'LIVID', 'IRATE'] },
      { theme: 'Things in space', color: '#3b82f6', words: ['STAR', 'COMET', 'MOON', 'NEBULA'] },
      { theme: 'Kitchen appliances', color: '#a855f7', words: ['OVEN', 'TOASTER', 'BLENDER', 'KETTLE'] },
    ]
  },
];
