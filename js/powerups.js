/**
 * powerups.js — Powerup definitions + run-time charge management
 *
 * Three powerups with limited charges per run:
 *   💣 Bomb Blast — clear a 3×3 area around a tapped cell
 *   🔀 Shuffle    — re-roll the entire board
 *   ↩️ Undo       — revert the board to the state before the last move
 *
 * Hardcore mode gives zero Bomb Blast charges and fewer Undo charges.
 */

'use strict';

const POWERUP_DEFS = Object.freeze([
  {
    id:              'bomb_blast',
    name:            'Bomb Blast',
    emoji:           '💣',
    description:     'Destroy all blocks in a 3×3 area',
    color:           '#FF4757',
    maxCharges:      1,  // endless / daily
    hardcoreCharges: 0,  // none in hardcore
    requiresTap:     true, // player taps a target cell after activation
  },
  {
    id:              'shuffle',
    name:            'Shuffle',
    emoji:           '🔀',
    description:     'Re-roll every block on the board',
    color:           '#1E90FF',
    maxCharges:      1,
    hardcoreCharges: 1,
    requiresTap:     false,
  },
  {
    id:              'undo',
    name:            'Undo',
    emoji:           '↩️',
    description:     'Take back your last move',
    color:           '#2ED573',
    maxCharges:      2,
    hardcoreCharges: 1,
    requiresTap:     false,
  },
]);

class PowerupManager {
  constructor() {
    /** Map of powerupId → remaining charges for this run */
    this.charges   = {};
    /** Whether the player is currently targeting a cell for Bomb Blast */
    this.targeting = false;
    /** Which powerupId is being targeted */
    this.pendingId = null;
    /** Saved board grid for Undo (2D array of Block or null) */
    this._undoGrid = null;
    /** Saved board grid before any powerup was used (for undo) */
    this._preUndoGrid = null;
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  /**
   * Set up charges for a new run.
   * @param {boolean} isHardcore
   */
  init(isHardcore = false) {
    this.charges   = {};
    this.targeting = false;
    this.pendingId = null;
    this._undoGrid = null;
    for (const def of POWERUP_DEFS) {
      this.charges[def.id] = isHardcore ? def.hardcoreCharges : def.maxCharges;
    }
  }

  // ─── Query ───────────────────────────────────────────────────────────────

  getDefs()             { return POWERUP_DEFS; }
  getDef(id)            { return POWERUP_DEFS.find(d => d.id === id) || null; }
  getCharges(id)        { return this.charges[id] || 0; }
  canUse(id)            { return (this.charges[id] || 0) > 0; }
  hasAnyCharges()       { return POWERUP_DEFS.some(d => this.canUse(d.id)); }

  // ─── Use ─────────────────────────────────────────────────────────────────

  /**
   * Spend one charge. Returns false if no charges left.
   */
  use(id) {
    if (!this.canUse(id)) return false;
    this.charges[id]--;
    return true;
  }

  // ─── Undo state ──────────────────────────────────────────────────────────

  /**
   * Save the current board state so it can be restored by Undo.
   * Clones the grid (Block.clone() preserves type/color/value).
   * @param {Block[][]} grid
   */
  saveUndoState(grid) {
    this._undoGrid = grid.map(row =>
      row.map(block => (block ? block.clone() : null))
    );
  }

  /**
   * Restore the saved board state. Returns the cloned grid, or null if none saved.
   * @returns {Block[][]|null}
   */
  popUndoState() {
    if (!this._undoGrid) return null;
    const g = this._undoGrid;
    this._undoGrid = null; // single-use
    return g;
  }

  hasUndoState() { return this._undoGrid !== null; }
}

const Powerups = new PowerupManager();
