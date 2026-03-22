/**
 * miniwordgrid-puzzles.js — Hand-authored mini crossword puzzle packs
 *
 * Grid: flat array of chars (left-to-right, top-to-bottom).
 *   '#' = black cell (blocker)
 *   Letter = solution letter
 *
 * Clues reference cells by `startCell` (flat index), NOT a pre-assigned number.
 * The clue number displayed in-game is auto-computed by miniwordgrid.js.
 * All grids are 5×5.
 *
 * Each puzzle has been manually verified: all words intersect correctly.
 * Pattern: 3 across words in rows 0,2,4 starting at col 1; 1 down word in col 1.
 */

'use strict';

const MINIWORDGRID_PUZZLES = [
  {
    id: 0,
    title: 'Puzzle 1',
    cols: 5,
    rows: 5,
    solution: [
      '#','S','A','G','E',
      '#','T','#','#','#',
      '#','A','R','E','A',
      '#','R','#','#','#',
      '#','S','T','A','R',
    ],
    // Down col1: STARS   Across: SAGE / AREA / STAR
    clues: {
      across: [
        { startCell:  1, clue: 'Cooking herb (also a wise person)' },
        { startCell: 11, clue: 'A region or zone' },
        { startCell: 21, clue: 'A celestial body (not the sun)' },
      ],
      down: [
        { startCell: 1, clue: 'Celestial lights (plural)' },
      ],
    },
  },
  {
    id: 1,
    title: 'Puzzle 2',
    cols: 5,
    rows: 5,
    solution: [
      '#','M','A','R','K',
      '#','U','#','#','#',
      '#','S','A','L','T',
      '#','I','#','#','#',
      '#','C','A','S','H',
    ],
    // Down col1: MUSIC   Across: MARK / SALT / CASH
    clues: {
      across: [
        { startCell:  1, clue: 'Leave a trace on a surface' },
        { startCell: 11, clue: 'White seasoning for food' },
        { startCell: 21, clue: 'Physical paper money' },
      ],
      down: [
        { startCell: 1, clue: 'Harmony of sounds' },
      ],
    },
  },
  {
    id: 2,
    title: 'Puzzle 3',
    cols: 5,
    rows: 5,
    solution: [
      '#','B','O','L','D',
      '#','R','#','#','#',
      '#','E','A','C','H',
      '#','A','#','#','#',
      '#','D','A','R','K',
    ],
    // Down col1: BREAD   Across: BOLD / EACH / DARK
    clues: {
      across: [
        { startCell:  1, clue: 'Daring and fearless' },
        { startCell: 11, clue: 'Every single one' },
        { startCell: 21, clue: 'Lacking light' },
      ],
      down: [
        { startCell: 1, clue: 'Sliced loaf for sandwiches' },
      ],
    },
  },
  {
    id: 3,
    title: 'Puzzle 4',
    cols: 5,
    rows: 5,
    solution: [
      '#','F','A','R','M',
      '#','R','#','#','#',
      '#','O','P','E','N',
      '#','S','#','#','#',
      '#','T','R','E','K',
    ],
    // Down col1: FROST   Across: FARM / OPEN / TREK
    clues: {
      across: [
        { startCell:  1, clue: 'Agricultural land for crops' },
        { startCell: 11, clue: 'Not shut; unlocked' },
        { startCell: 21, clue: 'A long, difficult journey on foot' },
      ],
      down: [
        { startCell: 1, clue: 'Morning ice crystals on grass' },
      ],
    },
  },
  {
    id: 4,
    title: 'Puzzle 5',
    cols: 5,
    rows: 5,
    solution: [
      '#','O','V','E','N',
      '#','C','#','#','#',
      '#','E','A','R','N',
      '#','A','#','#','#',
      '#','N','O','S','E',
    ],
    // Down col1: OCEAN   Across: OVEN / EARN / NOSE
    clues: {
      across: [
        { startCell:  1, clue: 'Baking appliance in a kitchen' },
        { startCell: 11, clue: 'To gain wages or a salary' },
        { startCell: 21, clue: 'Organ of smell on your face' },
      ],
      down: [
        { startCell: 1, clue: 'Vast body of salt water' },
      ],
    },
  },
];
