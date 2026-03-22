/**
 * miniwordgrid-puzzles.js — Hand-authored mini crossword puzzle packs
 *
 * Grid format: flat array of chars, left-to-right, top-to-bottom.
 * '#' = black cell (blocker).
 * Letters = solution letters.
 *
 * Clues: { across: [{num, clue}], down: [{num, clue}] }
 * Numbers follow standard crossword numbering (left-to-right, top-to-bottom).
 *
 * All grids are 5×5.
 */

'use strict';

const MINIWORDGRID_PUZZLES = [
  {
    id: 0,
    title: 'Puzzle 1',
    cols: 5,
    rows: 5,
    solution: [
      'C','A','T','S','#',
      'H','#','I','#','G',
      'E','E','R','S','O',
      'S','#','E','#','D',
      '#','B','D','O','G',
    ],
    clues: {
      across: [
        { num: 1, clue: 'Feline friends (plural)' },
        { num: 5, clue: 'Spirits up — "give ___"' },
        { num: 6, clue: '20-20 vision alternative' },
        { num: 7, clue: 'Canine pal (3)' },
      ],
      down: [
        { num: 1, clue: 'Test (plural)' },
        { num: 2, clue: 'Also' },
        { num: 3, clue: 'Pulled apart (past tense)' },
        { num: 4, clue: 'Celestial body' },
      ],
    },
  },
  {
    id: 1,
    title: 'Puzzle 2',
    cols: 5,
    rows: 5,
    solution: [
      'P','I','N','E','#',
      'A','#','O','#','S',
      'R','A','I','N','Y',
      'K','#','S','#','E',
      '#','B','E','E','S',
    ],
    clues: {
      across: [
        { num: 1, clue: 'Evergreen tree' },
        { num: 5, clue: 'Wet weather day' },
        { num: 6, clue: 'Buzzing insects (plural)' },
      ],
      down: [
        { num: 1, clue: 'Outdoor recreation area' },
        { num: 2, clue: 'Musical note or legume' },
        { num: 3, clue: 'Lack of noise' },
        { num: 4, clue: 'Affirmative response' },
      ],
    },
  },
  {
    id: 2,
    title: 'Puzzle 3',
    cols: 5,
    rows: 5,
    solution: [
      'S','T','A','R','#',
      'T','#','R','#','M',
      'O','V','E','N','S',
      'P','#','A','#','T',
      '#','C','N','A','P',
    ],
    clues: {
      across: [
        { num: 1, clue: 'Celestial light' },
        { num: 5, clue: 'Kitchen cookers (plural)' },
        { num: 6, clue: 'Quick sleep: power ___' },
      ],
      down: [
        { num: 1, clue: 'To halt' },
        { num: 2, clue: 'Craft or profession' },
        { num: 3, clue: 'Area of land' },
        { num: 4, clue: 'Tiny amount' },
      ],
    },
  },
  {
    id: 3,
    title: 'Puzzle 4',
    cols: 5,
    rows: 5,
    solution: [
      'W','A','V','E','#',
      'I','#','A','#','C',
      'N','O','S','E','S',
      'D','#','E','#','P',
      '#','D','E','E','P',
    ],
    clues: {
      across: [
        { num: 1, clue: 'Ocean motion' },
        { num: 5, clue: 'Facial features for smelling (plural)' },
        { num: 6, clue: 'Far below the surface' },
      ],
      down: [
        { num: 1, clue: 'Blowing air (as in a turbine)' },
        { num: 2, clue: 'Musical note (do-___)' },
        { num: 3, clue: 'Poetry or rhyme' },
        { num: 4, clue: 'Evening abbrev.' },
      ],
    },
  },
  {
    id: 4,
    title: 'Puzzle 5',
    cols: 5,
    rows: 5,
    solution: [
      'B','L','A','Z','E',
      'R','#','P','#','A',
      'A','S','P','E','N',
      'V','#','L','#','S',
      'E','A','E','S','Y',
    ],
    clues: {
      across: [
        { num: 1, clue: 'Roaring fire' },
        { num: 5, clue: 'White-barked tree' },
        { num: 6, clue: 'Not difficult' },
      ],
      down: [
        { num: 1, clue: 'Jacket or sports coat' },
        { num: 2, clue: 'Poisonous snake' },
        { num: 3, clue: 'Applied (something)' },
        { num: 4, clue: 'Direction (abbrev.)' },
      ],
    },
  },
];
