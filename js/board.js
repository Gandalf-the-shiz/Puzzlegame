/**
 * board.js — Board/grid logic: matching, gravity, move validation
 */

'use strict';

class Board {
  /**
   * @param {number} cols
   * @param {number} rows
   */
  constructor(cols = GRID_COLS, rows = GRID_ROWS) {
    this.cols = cols;
    this.rows = rows;
    // 2D array [row][col], row 0 = top
    this.grid = [];
    this._init();
  }

  // ─── Initialization ────────────────────────────────────────────────────────

  /**
   * Fill the board with random blocks ensuring no initial matches
   */
  _init() {
    this.grid = Array.from({ length: this.rows }, () =>
      Array(this.cols).fill(null)
    );

    const colorPool = COLORS.slice(0, 4); // start with 4 colors
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        let block;
        let attempts = 0;
        do {
          block = Block.randomNormal(colorPool);
          attempts++;
        } while (attempts < 20 && this._wouldMatch(r, c, block));
        this.grid[r][c] = block;
      }
    }
  }

  /**
   * Check if placing a block at (r,c) would immediately create a match of 3+
   */
  _wouldMatch(r, c, block) {
    // Check horizontal
    if (c >= 2) {
      const l1 = this.grid[r][c-1];
      const l2 = this.grid[r][c-2];
      if (l1 && l2 && block.matches(l1) && block.matches(l2)) return true;
    }
    // Check vertical
    if (r >= 2) {
      const u1 = this.grid[r-1][c];
      const u2 = this.grid[r-2][c];
      if (u1 && u2 && block.matches(u1) && block.matches(u2)) return true;
    }
    return false;
  }

  // ─── Grid accessors ────────────────────────────────────────────────────────

  get(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
    return this.grid[r][c];
  }

  set(r, c, block) {
    this.grid[r][c] = block;
  }

  inBounds(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  // ─── Swap ──────────────────────────────────────────────────────────────────

  /**
   * Returns true if two positions are adjacent (horizontal or vertical)
   */
  isAdjacent(r1, c1, r2, c2) {
    return (Math.abs(r1 - r2) + Math.abs(c1 - c2)) === 1;
  }

  /**
   * Swap two blocks. Returns true if the swap is valid (adjacent + movable).
   * Does NOT check if the swap creates matches — caller handles that.
   */
  swap(r1, c1, r2, c2) {
    const a = this.get(r1, c1);
    const b = this.get(r2, c2);
    if (!a || !b) return false;
    if (!a.canMove() || !b.canMove()) return false;
    if (!this.isAdjacent(r1, c1, r2, c2)) return false;

    this.grid[r1][c1] = b;
    this.grid[r2][c2] = a;
    return true;
  }

  // ─── Match Finding ─────────────────────────────────────────────────────────

  /**
   * Find all groups of 3+ matching blocks.
   * Returns array of match groups: each group is an array of {r, c} objects.
   * Rainbow blocks participate in any match.
   */
  findMatches() {
    const matched = new Set(); // "r,c" strings to de-duplicate
    const groups  = [];

    // Horizontal runs
    for (let r = 0; r < this.rows; r++) {
      let run = [{ r, c: 0 }];
      for (let c = 1; c < this.cols; c++) {
        const prev = this.get(r, c - 1);
        const curr = this.get(r, c);
        if (prev && curr && this._blockMatch(prev, curr)) {
          run.push({ r, c });
        } else {
          if (run.length >= 3) this._addGroup(groups, matched, run);
          run = [{ r, c }];
        }
      }
      if (run.length >= 3) this._addGroup(groups, matched, run);
    }

    // Vertical runs
    for (let c = 0; c < this.cols; c++) {
      let run = [{ r: 0, c }];
      for (let r = 1; r < this.rows; r++) {
        const prev = this.get(r - 1, c);
        const curr = this.get(r, c);
        if (prev && curr && this._blockMatch(prev, curr)) {
          run.push({ r, c });
        } else {
          if (run.length >= 3) this._addGroup(groups, matched, run);
          run = [{ r, c }];
        }
      }
      if (run.length >= 3) this._addGroup(groups, matched, run);
    }

    return groups;
  }

  /**
   * Whether two blocks form part of the same match chain
   */
  _blockMatch(a, b) {
    if (!a || !b) return false;
    if (a.type === BlockType.BLOCKER || b.type === BlockType.BLOCKER) return false;
    if (a.type === BlockType.RAINBOW || b.type === BlockType.RAINBOW) return true;
    return a.matchKey() === b.matchKey();
  }

  /**
   * Add a run to groups, merging cells that already appear in existing groups
   */
  _addGroup(groups, matched, run) {
    // Check if any cell in this run belongs to an existing group
    const existingGroupIdx = new Set();
    for (const cell of run) {
      const key = `${cell.r},${cell.c}`;
      if (matched.has(key)) {
        // Find which group(s) this cell belongs to
        for (let i = 0; i < groups.length; i++) {
          if (groups[i].some(g => g.r === cell.r && g.c === cell.c)) {
            existingGroupIdx.add(i);
          }
        }
      }
    }

    if (existingGroupIdx.size === 0) {
      // New group
      const group = [];
      for (const cell of run) {
        group.push(cell);
        matched.add(`${cell.r},${cell.c}`);
      }
      groups.push(group);
    } else {
      // Merge into the lowest-indexed existing group
      const indices = [...existingGroupIdx].sort((a, b) => a - b);
      const primary = indices[0];
      for (const cell of run) {
        const key = `${cell.r},${cell.c}`;
        if (!matched.has(key)) {
          groups[primary].push(cell);
          matched.add(key);
        }
      }
      // Merge other groups into primary
      for (let i = indices.length - 1; i >= 1; i--) {
        const idx = indices[i];
        for (const cell of groups[idx]) {
          if (!groups[primary].some(g => g.r === cell.r && g.c === cell.c)) {
            groups[primary].push(cell);
          }
        }
        groups.splice(idx, 1);
      }
    }
  }

  /**
   * Mark all matched cells and expand BOMB blast radius
   * Returns flat array of {r,c} cells to remove
   */
  markMatches(groups) {
    const toRemove = new Set();
    const explosions = []; // positions of bomb blocks

    for (const group of groups) {
      for (const cell of group) {
        const key = `${cell.r},${cell.c}`;
        toRemove.add(key);
        const block = this.get(cell.r, cell.c);
        if (block && block.type === BlockType.BOMB) {
          explosions.push({ r: cell.r, c: cell.c });
        }
      }
    }

    // Expand bomb blasts (3x3 area)
    for (const pos of explosions) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = pos.r + dr;
          const nc = pos.c + dc;
          if (this.inBounds(nr, nc)) {
            const block = this.get(nr, nc);
            if (block && block.type !== BlockType.BLOCKER) {
              toRemove.add(`${nr},${nc}`);
            }
          }
        }
      }
    }

    // Mark blocks
    const cells = [];
    for (const key of toRemove) {
      const [r, c] = key.split(',').map(Number);
      const block = this.get(r, c);
      if (block) {
        block.matched = true;
        cells.push({ r, c, block });
      }
    }

    // Handle NUMBER merges: if a NUMBER group has 3+ same-value blocks,
    // they merge into one block of 2x the value instead of disappearing
    for (const group of groups) {
      const sample = this.get(group[0].r, group[0].c);
      if (sample && sample.type === BlockType.NUMBER && group.length >= 3) {
        // Keep one merged block at the first position
        const mergedValue = sample.value * 2;
        const keepPos = group[0];
        const merged = Block.number(mergedValue);
        // Un-mark the keeper so it stays on board with new value
        merged.matched = false;
        this.set(keepPos.r, keepPos.c, merged);
        // Remove the keeper from cells-to-remove
        const keepKey = `${keepPos.r},${keepPos.c}`;
        const idx = cells.findIndex(c => `${c.r},${c.c}` === keepKey);
        if (idx !== -1) cells.splice(idx, 1);
      }
    }

    return cells;
  }

  /**
   * Remove matched cells from the grid (set to null)
   */
  removeMatched() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c]?.matched) {
          this.grid[r][c] = null;
        }
      }
    }
  }

  // ─── Gravity ───────────────────────────────────────────────────────────────

  /**
   * Apply gravity: blocks fall down into empty cells.
   * Returns array of {block, fromR, fromC, toR, toC} for animation.
   */
  applyGravity() {
    const moves = [];
    for (let c = 0; c < this.cols; c++) {
      // Collect non-null blocks from bottom to top
      let writeRow = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--) {
        if (this.grid[r][c] !== null) {
          if (r !== writeRow) {
            moves.push({ block: this.grid[r][c], fromR: r, fromC: c, toR: writeRow, toC: c });
            this.grid[writeRow][c] = this.grid[r][c];
            this.grid[r][c] = null;
          }
          writeRow--;
        }
      }
    }
    return moves;
  }

  /**
   * Fill empty cells (null) with new blocks from the given color pool.
   * Returns array of {block, r, c} for animation.
   */
  fillEmpty(colorPool, levelConfig) {
    const spawned = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === null) {
          const block = this._spawnBlock(colorPool, levelConfig);
          block.justSpawned = true;
          this.grid[r][c] = block;
          spawned.push({ block, r, c });
        }
      }
    }
    return spawned;
  }

  /**
   * Spawn a block according to current level probabilities
   */
  _spawnBlock(colorPool, levelConfig) {
    const roll = Math.random();
    if (levelConfig.rainbowChance > 0 && roll < levelConfig.rainbowChance) {
      return Block.rainbow();
    }
    if (levelConfig.bombChance > 0 && roll < levelConfig.rainbowChance + levelConfig.bombChance) {
      return Block.bomb();
    }
    if (levelConfig.numberChance > 0 && roll < levelConfig.rainbowChance + levelConfig.bombChance + levelConfig.numberChance) {
      const values = [2, 4, 8];
      return Block.number(randomPick(values));
    }
    if (levelConfig.blockerChance > 0 && roll < levelConfig.rainbowChance + levelConfig.bombChance + levelConfig.numberChance + levelConfig.blockerChance) {
      return Block.blocker();
    }
    return Block.randomNormal(colorPool);
  }

  // ─── Move Validation ───────────────────────────────────────────────────────

  /**
   * Returns true if there's at least one valid swap on the board
   * that would create a match.
   */
  hasValidMoves() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        // Try swap right
        if (c + 1 < this.cols && this._swapCreatesMatch(r, c, r, c + 1)) return true;
        // Try swap down
        if (r + 1 < this.rows && this._swapCreatesMatch(r, c, r + 1, c)) return true;
      }
    }
    return false;
  }

  /**
   * Simulate a swap and check if it creates any match
   */
  _swapCreatesMatch(r1, c1, r2, c2) {
    const a = this.get(r1, c1);
    const b = this.get(r2, c2);
    if (!a || !b || !a.canMove()) return false;

    // Temporarily swap
    this.grid[r1][c1] = b;
    this.grid[r2][c2] = a;

    const matches = this.findMatches();
    const hasMatch = matches.length > 0;

    // Swap back
    this.grid[r1][c1] = a;
    this.grid[r2][c2] = b;

    return hasMatch;
  }

  /**
   * Force-clear a path (shuffle the top row) when no valid moves exist
   * but board isn't full (gives the player another chance)
   */
  shuffleTop(colorPool) {
    // Replace the top row with fresh blocks
    for (let c = 0; c < this.cols; c++) {
      this.grid[0][c] = Block.randomNormal(colorPool);
    }
  }

  /**
   * Count how many non-null cells are on the board
   */
  countFilled() {
    let n = 0;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.grid[r][c] !== null) n++;
    return n;
  }
}
