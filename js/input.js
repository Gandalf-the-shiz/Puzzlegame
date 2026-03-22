/**
 * input.js — Touch/click input handling
 */

'use strict';

class InputHandler {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Renderer} renderer
   */
  constructor(canvas, renderer) {
    this.canvas   = canvas;
    this.renderer = renderer;

    // Callbacks set by Game
    this.onCellTap = null; // (r, c) => void

    // Throttle: ignore input within this many ms of last valid tap
    this.THROTTLE_MS    = 80;
    this._lastTapTime   = 0;
    this._enabled       = true;

    // Touch tracking for swipe detection
    this._touchStart    = null;

    this._bindEvents();
  }

  // ─── Event binding ─────────────────────────────────────────────────────────

  _bindEvents() {
    // Touch events (primary for mobile)
    this.canvas.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchend',   this._onTouchEnd.bind(this),   { passive: false });
    this.canvas.addEventListener('touchmove',  this._onTouchMove.bind(this),  { passive: false });

    // Mouse events (desktop fallback)
    this.canvas.addEventListener('mousedown',  this._onMouseDown.bind(this));
    this.canvas.addEventListener('mouseup',    this._onMouseUp.bind(this));
  }

  // ─── Touch handlers ────────────────────────────────────────────────────────

  _onTouchStart(e) {
    e.preventDefault();
    if (!this._enabled) return;
    const touch = e.changedTouches[0];
    this._touchStart = this._getCanvasPos(touch.clientX, touch.clientY);
  }

  _onTouchMove(e) {
    e.preventDefault(); // Prevent page scroll
  }

  _onTouchEnd(e) {
    e.preventDefault();
    if (!this._enabled || !this._touchStart) return;

    const touch = e.changedTouches[0];
    const end   = this._getCanvasPos(touch.clientX, touch.clientY);

    // If finger moved far enough, treat as a swipe
    const dx = end.x - this._touchStart.x;
    const dy = end.y - this._touchStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 20) {
      // Swipe: treat start point as origin cell, determine direction
      const startCell = this.renderer.pixelToGrid(this._touchStart.x, this._touchStart.y);
      if (startCell) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        let dr = 0, dc = 0;
        if (adx > ady) dc = dx > 0 ? 1 : -1;
        else            dr = dy > 0 ? 1 : -1;
        this._handleSwipe(startCell.r, startCell.c, dr, dc);
      }
    } else {
      // Tap
      this._handleTap(end.x, end.y);
    }

    this._touchStart = null;
  }

  // ─── Mouse handlers ────────────────────────────────────────────────────────

  _onMouseDown(e) {
    if (!this._enabled) return;
    this._mouseStart = this._getCanvasPos(e.clientX, e.clientY);
  }

  _onMouseUp(e) {
    if (!this._enabled || !this._mouseStart) return;
    const end = this._getCanvasPos(e.clientX, e.clientY);
    const dx  = end.x - this._mouseStart.x;
    const dy  = end.y - this._mouseStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 15) {
      // Mouse drag as swipe
      const startCell = this.renderer.pixelToGrid(this._mouseStart.x, this._mouseStart.y);
      if (startCell) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        let dr = 0, dc = 0;
        if (adx > ady) dc = dx > 0 ? 1 : -1;
        else            dr = dy > 0 ? 1 : -1;
        this._handleSwipe(startCell.r, startCell.c, dr, dc);
      }
    } else {
      this._handleTap(end.x, end.y);
    }
    this._mouseStart = null;
  }

  // ─── Tap / Swipe logic ─────────────────────────────────────────────────────

  _handleTap(px, py) {
    const now = Date.now();
    if (now - this._lastTapTime < this.THROTTLE_MS) return;
    this._lastTapTime = now;

    const cell = this.renderer.pixelToGrid(px, py);
    if (cell && this.onCellTap) {
      this.onCellTap(cell.r, cell.c);
    }
  }

  _handleSwipe(r, c, dr, dc) {
    const now = Date.now();
    if (now - this._lastTapTime < this.THROTTLE_MS) return;
    this._lastTapTime = now;

    const nr = r + dr;
    const nc = c + dc;

    // Bounds check: ensure the target cell is within the grid
    if (nr < 0 || nr >= this.renderer.board.rows ||
        nc < 0 || nc >= this.renderer.board.cols) return;

    // Emit two taps: origin and adjacent
    if (this.onCellTap) {
      this.onCellTap(r, c);
      this.onCellTap(nr, nc);
    }
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  /**
   * Convert client coordinates → canvas-relative pixel coordinates
   */
  _getCanvasPos(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  enable()  { this._enabled = true; }
  disable() { this._enabled = false; }
}
