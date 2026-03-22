/**
 * renderer.js — Canvas/DOM rendering with smooth animations
 */

'use strict';

// Animation states
const AnimState = Object.freeze({
  IDLE:    'idle',
  SWAP:    'swap',
  FALL:    'fall',
  CLEAR:   'clear',
  SHAKE:   'shake',
  SPAWN:   'spawn',
});

class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Board} board
   * @param {ParticleSystem} particles
   */
  constructor(canvas, board, particles) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    this.board     = board;
    this.particles = particles;

    // Block pixel size (computed from canvas dimensions)
    this.blockSize  = 0;
    this.offsetX    = 0; // padding to center grid
    this.offsetY    = 0;
    this.padding    = 4; // gap between blocks in px

    // Queued animations
    this._animations = []; // {type, progress, data, duration}
    this._shakeX = 0;
    this._shakeY = 0;
    this._shakeTime = 0;

    // Selected block highlight
    this.selectedCell = null; // {r, c}

    // Score float-up texts
    this._floatTexts = []; // {text, x, y, alpha, vy, color, size}

    // Screen shake state
    this._shakePower    = 0;
    this._shakeTime     = 0;
    this._shakeDuration = 0.3;
    this._shakeX        = 0;
    this._shakeY        = 0;

    this.resize();
  }

  // ─── Sizing ────────────────────────────────────────────────────────────────

  resize() {
    if (!this.board) return; // guard against null board during init
    const dpr = window.devicePixelRatio || 1;
    const w   = this.canvas.clientWidth;
    const h   = this.canvas.clientHeight;

    this.canvas.width  = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.scale(dpr, dpr);

    const cols = this.board.cols;
    const rows = this.board.rows;

    // Compute block size to fit grid in canvas
    const maxBlockW = Math.floor((w - this.padding * (cols + 1)) / cols);
    const maxBlockH = Math.floor((h - this.padding * (rows + 1)) / rows);
    this.blockSize  = Math.max(30, Math.min(maxBlockW, maxBlockH));

    const gridW = cols * this.blockSize + (cols + 1) * this.padding;
    const gridH = rows * this.blockSize + (rows + 1) * this.padding;

    this.offsetX = Math.floor((w - gridW) / 2);
    this.offsetY = Math.floor((h - gridH) / 2);
  }

  // ─── Coordinate conversion ─────────────────────────────────────────────────

  /**
   * Convert canvas pixel → grid {r, c}. Returns null if outside grid.
   */
  pixelToGrid(px, py) {
    const cols = this.board.cols;
    const rows = this.board.rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = this.offsetX + this.padding + c * (this.blockSize + this.padding);
        const y = this.offsetY + this.padding + r * (this.blockSize + this.padding);
        if (px >= x && px <= x + this.blockSize &&
            py >= y && py <= y + this.blockSize) {
          return { r, c };
        }
      }
    }
    return null;
  }

  /**
   * Get top-left pixel of a grid cell
   */
  gridToPixel(r, c) {
    return {
      x: this.offsetX + this.padding + c * (this.blockSize + this.padding),
      y: this.offsetY + this.padding + r * (this.blockSize + this.padding),
    };
  }

  /**
   * Center pixel of a grid cell
   */
  cellCenter(r, c) {
    const pos = this.gridToPixel(r, c);
    return { x: pos.x + this.blockSize / 2, y: pos.y + this.blockSize / 2 };
  }

  // ─── Main render ───────────────────────────────────────────────────────────

  /**
   * Draw a full frame.
   * @param {number} dt — delta time in seconds
   */
  render(dt) {
    const ctx  = this.ctx;
    const w    = this.canvas.clientWidth;
    const h    = this.canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    // Only draw the board if one is attached
    if (!this.board) {
      this.particles.draw(ctx);
      return;
    }

    // Screen shake
    this._updateShake(dt);
    ctx.save();
    ctx.translate(this._shakeX, this._shakeY);

    // Board background
    this._drawBoardBg(w, h);

    // Grid cells + blocks
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const block = this.board.get(r, c);
        const pos   = this.gridToPixel(r, c);
        this._drawCell(ctx, pos.x, pos.y, block, r, c);
      }
    }

    // Particles (on top of blocks)
    this.particles.draw(ctx);

    // Float texts (score popups)
    this._updateAndDrawFloatTexts(ctx, dt);

    ctx.restore();
  }

  // ─── Board background ──────────────────────────────────────────────────────

  _drawBoardBg(w, h) {
    const ctx  = this.ctx;
    const cols = this.board.cols;
    const rows = this.board.rows;
    const gridW = cols * (this.blockSize + this.padding) + this.padding;
    const gridH = rows * (this.blockSize + this.padding) + this.padding;

    // Board shadow
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur    = 20;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle     = 'rgba(15, 15, 25, 0.85)';
    this._roundRect(ctx, this.offsetX, this.offsetY, gridW, gridH, 16);
    ctx.fill();
    ctx.restore();

    // Grid cell backgrounds
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const { x, y } = this.gridToPixel(r, c);
        ctx.fillStyle = (r + c) % 2 === 0
          ? 'rgba(255,255,255,0.04)'
          : 'rgba(255,255,255,0.02)';
        this._roundRect(ctx, x, y, this.blockSize, this.blockSize, 8);
        ctx.fill();
      }
    }
  }

  // ─── Block rendering ───────────────────────────────────────────────────────

  _drawCell(ctx, x, y, block, r, c) {
    if (!block) return;

    const isSelected = this.selectedCell &&
      this.selectedCell.r === r && this.selectedCell.c === c;

    const bs = this.blockSize;
    const anim = block.anim;

    // Apply animation offsets
    const drawX = x + (anim.offsetX || 0);
    const drawY = y + (anim.offsetY || 0);
    const scaleX = anim.scaleX || 1;
    const scaleY = anim.scaleY || 1;
    const alpha  = anim.alpha  !== undefined ? anim.alpha : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(drawX + bs / 2, drawY + bs / 2);
    ctx.scale(scaleX, scaleY);

    // Draw block body
    switch (block.type) {
      case BlockType.NORMAL:
        this._drawNormalBlock(ctx, 0, 0, bs, block.color, isSelected);
        break;
      case BlockType.NUMBER:
        this._drawNumberBlock(ctx, 0, 0, bs, block.value, isSelected);
        break;
      case BlockType.BLOCKER:
        this._drawBlockerBlock(ctx, 0, 0, bs);
        break;
      case BlockType.BOMB:
        this._drawBombBlock(ctx, 0, 0, bs);
        break;
      case BlockType.RAINBOW:
        this._drawRainbowBlock(ctx, 0, 0, bs, isSelected);
        break;
    }

    // Selected ring
    if (isSelected) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth   = 3;
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur  = 12;
      this._roundRect(ctx, -bs/2, -bs/2, bs, bs, 10);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Map a block's stored hex color through the currently equipped theme palette.
   * Falls back to the original hex color if no theme override is active.
   */
  _resolveColor(hexColor) {
    const themed = Unlocks.getActiveBlockColors();
    if (!themed) return hexColor;
    const idx = COLORS.indexOf(hexColor);
    return (idx >= 0 && idx < themed.length) ? themed[idx] : hexColor;
  }

  _drawNormalBlock(ctx, cx, cy, bs, color, selected) {
    color = this._resolveColor(color);
    const half = bs / 2;

    // Shadow
    ctx.shadowColor   = color;
    ctx.shadowBlur    = selected ? 20 : 8;
    ctx.shadowOffsetY = 3;

    // Gradient fill
    const grad = ctx.createLinearGradient(cx - half, cy - half, cx + half, cy + half);
    grad.addColorStop(0, this._lighten(color, 40));
    grad.addColorStop(1, this._darken(color, 20));
    ctx.fillStyle = grad;
    this._roundRect(ctx, cx - half, cy - half, bs, bs, 10);
    ctx.fill();

    // Shine
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const shine = ctx.createLinearGradient(cx - half, cy - half, cx, cy);
    shine.addColorStop(0, 'rgba(255,255,255,0.35)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    this._roundRect(ctx, cx - half, cy - half, bs * 0.5, bs * 0.5, 8);
    ctx.fill();

    // Outline
    ctx.strokeStyle = this._darken(color, 30);
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 0;
    this._roundRect(ctx, cx - half, cy - half, bs, bs, 10);
    ctx.stroke();
  }

  _drawNumberBlock(ctx, cx, cy, bs, value, selected) {
    // Pick color based on value
    const colorMap = {
      2: '#74B9FF', 4: '#0984E3', 8: '#00CEC9',
      16: '#55EFC4', 32: '#FDCB6E', 64: '#E17055',
      128: '#FD79A8', 256: '#A29BFE', 512: '#6C5CE7',
      1024: '#FAB1A0', 2048: '#FDCB6E',
    };
    const color = colorMap[value] || '#DFE6E9';
    this._drawNormalBlock(ctx, cx, cy, bs, color, selected);

    // Value text
    const half = bs / 2;
    const textSize = value >= 1000 ? bs * 0.22 : value >= 100 ? bs * 0.28 : bs * 0.36;
    ctx.fillStyle   = '#FFFFFF';
    ctx.font        = `bold ${textSize}px "Segoe UI", sans-serif`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur   = 4;
    ctx.fillText(String(value), cx, cy + 1);
  }

  _drawBlockerBlock(ctx, cx, cy, bs) {
    const half = bs / 2;
    ctx.shadowColor = '#2d3436';
    ctx.shadowBlur  = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#636e72';
    this._roundRect(ctx, cx - half, cy - half, bs, bs, 6);
    ctx.fill();

    // Cross pattern
    ctx.shadowBlur    = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#b2bec3';
    ctx.lineWidth   = 2;
    const margin = bs * 0.15;
    ctx.beginPath();
    ctx.moveTo(cx - half + margin, cy - half + margin);
    ctx.lineTo(cx + half - margin, cy + half - margin);
    ctx.moveTo(cx + half - margin, cy - half + margin);
    ctx.lineTo(cx - half + margin, cy + half - margin);
    ctx.stroke();
  }

  _drawBombBlock(ctx, cx, cy, bs) {
    const half = bs / 2;
    // Body
    ctx.fillStyle   = '#2d3436';
    ctx.shadowColor = '#FF4757';
    ctx.shadowBlur  = 12;
    this._roundRect(ctx, cx - half, cy - half, bs, bs, bs / 2);
    ctx.fill();

    // Fuse
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = '#b2bec3';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - half);
    ctx.quadraticCurveTo(cx + half * 0.6, cy - half * 1.4, cx + half * 0.3, cy - half * 1.6);
    ctx.stroke();

    // Spark
    ctx.fillStyle = '#FDCB6E';
    ctx.shadowColor = '#FDCB6E';
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.arc(cx + half * 0.3, cy - half * 1.6, 3, 0, Math.PI * 2);
    ctx.fill();

    // Emoji 💣
    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#FFFFFF';
    ctx.font       = `${bs * 0.42}px serif`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💣', cx, cy + 2);
  }

  _drawRainbowBlock(ctx, cx, cy, bs, selected) {
    const half = bs / 2;
    const grad = makeRainbowGradient(ctx, cx - half, cy - half, bs);
    ctx.fillStyle   = grad;
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur  = selected ? 24 : 16;
    this._roundRect(ctx, cx - half, cy - half, bs, bs, 10);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#FFFFFF';
    ctx.font       = `${bs * 0.42}px serif`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌈', cx, cy + 2);
  }

  // ─── Screen shake ──────────────────────────────────────────────────────────

  /**
   * Trigger screen shake. comboScale multiplies intensity for big combos.
   */
  triggerShake(intensity = 8, duration = 0.3, comboScale = 1) {
    const scaled        = Math.min(intensity * Math.max(1, comboScale), 30);
    this._shakePower    = scaled;
    this._shakeTime     = duration;
    this._shakeDuration = duration;
  }

  _updateShake(dt) {
    if (this._shakeTime > 0) {
      this._shakeTime = Math.max(0, this._shakeTime - dt);
      const progress = this._shakeTime / (this._shakeDuration || 0.3);
      const power    = this._shakePower * progress;
      this._shakeX = (Math.random() - 0.5) * power;
      this._shakeY = (Math.random() - 0.5) * power;
    } else {
      this._shakeX = 0;
      this._shakeY = 0;
    }
  }

  // ─── Block animations ──────────────────────────────────────────────────────

  /**
   * Animate a swap between two blocks
   */
  animateSwap(r1, c1, r2, c2, duration = 0.15) {
    const p1 = this.gridToPixel(r1, c1);
    const p2 = this.gridToPixel(r2, c2);
    const b1 = this.board.get(r1, c1);
    const b2 = this.board.get(r2, c2);
    if (!b1 || !b2) return Promise.resolve();

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    b1.anim.offsetX = -dx;
    b1.anim.offsetY = -dy;
    b2.anim.offsetX =  dx;
    b2.anim.offsetY =  dy;

    return this._tweenBlocks(
      [{ block: b1, fromX: -dx, fromY: -dy, toX: 0, toY: 0 },
       { block: b2, fromX:  dx, fromY:  dy, toX: 0, toY: 0 }],
      duration,
      Easing.easeOut
    );
  }

  /**
   * Animate blocks falling into place
   */
  animateFall(moves, speedMul = 1) {
    const tweens = [];
    for (const move of moves) {
      const fromPx = this.gridToPixel(move.fromR, move.fromC);
      const toPx   = this.gridToPixel(move.toR,   move.toC);
      const dy     = fromPx.y - toPx.y;
      move.block.anim.offsetY = dy;
      tweens.push({ block: move.block, fromX: 0, fromY: dy, toX: 0, toY: 0 });
    }
    const duration = Math.max(0.1, 0.25 / speedMul);
    return this._tweenBlocks(tweens, duration, Easing.easeIn);
  }

  /**
   * Animate newly spawned blocks dropping in from above
   */
  animateSpawn(spawned, speedMul = 1) {
    const tweens = [];
    for (const s of spawned) {
      const pos = this.gridToPixel(s.r, s.c);
      const offY = -(pos.y + this.blockSize);
      s.block.anim.offsetY = offY;
      s.block.anim.alpha   = 0;
      tweens.push({ block: s.block, fromX: 0, fromY: offY, toX: 0, toY: 0, fromAlpha: 0, toAlpha: 1 });
    }
    const duration = Math.max(0.15, 0.3 / speedMul);
    return this._tweenBlocks(tweens, duration, Easing.easeOut);
  }

  /**
   * Animate blocks being cleared (scale down + fade)
   */
  animateClear(cells, duration = 0.25) {
    const tweens = cells.map(cell => ({
      block:      cell.block,
      fromScaleX: 1,
      fromScaleY: 1,
      toScaleX:   0,
      toScaleY:   0,
      fromAlpha:  1,
      toAlpha:    0,
    }));
    return this._tweenBlocks(tweens, duration, Easing.easeIn);
  }

  /**
   * Pulse animation (scale up then back) for a block (e.g., on selection)
   */
  async animatePulse(r, c) {
    const block = this.board.get(r, c);
    if (!block) return;
    await this._tweenBlocks([
      { block, fromScaleX: 1, fromScaleY: 1, toScaleX: 1.2, toScaleY: 1.2 }
    ], 0.1, Easing.easeOut);
    await this._tweenBlocks([
      { block, fromScaleX: 1.2, fromScaleY: 1.2, toScaleX: 1, toScaleY: 1 }
    ], 0.1, Easing.easeIn);
  }

  /**
   * Generic tween engine: animates block.anim fields over `duration` seconds
   */
  _tweenBlocks(tweens, duration, easeFn = Easing.linear) {
    return new Promise(resolve => {
      const start = performance.now();

      const tick = () => {
        const elapsed  = (performance.now() - start) / 1000;
        const t        = Math.min(elapsed / duration, 1);
        const te       = easeFn(t);

        for (const tw of tweens) {
          if (tw.fromX !== undefined)      tw.block.anim.offsetX = lerp(tw.fromX, tw.toX, te);
          if (tw.fromY !== undefined)      tw.block.anim.offsetY = lerp(tw.fromY, tw.toY, te);
          if (tw.fromScaleX !== undefined) tw.block.anim.scaleX  = lerp(tw.fromScaleX, tw.toScaleX, te);
          if (tw.fromScaleY !== undefined) tw.block.anim.scaleY  = lerp(tw.fromScaleY, tw.toScaleY, te);
          if (tw.fromAlpha !== undefined)  tw.block.anim.alpha   = lerp(tw.fromAlpha, tw.toAlpha, te);
        }

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          // Reset to clean state
          for (const tw of tweens) {
            tw.block.anim.offsetX = 0;
            tw.block.anim.offsetY = 0;
            if (tw.toScaleX !== undefined) tw.block.anim.scaleX = tw.toScaleX;
            if (tw.toScaleY !== undefined) tw.block.anim.scaleY = tw.toScaleY;
            if (tw.toAlpha  !== undefined) tw.block.anim.alpha  = tw.toAlpha;
          }
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  // ─── Float texts (score popups) ────────────────────────────────────────────

  addFloatText(text, x, y, color = '#FDCB6E', size = 20) {
    this._floatTexts.push({
      text, x, y, color, size,
      alpha: 1,
      vy: -80,
    });
  }

  _updateAndDrawFloatTexts(ctx, dt) {
    this._floatTexts = this._floatTexts.filter(ft => {
      ft.y     += ft.vy * dt;
      ft.alpha -= dt * 1.8;
      if (ft.alpha <= 0) return false;

      ctx.save();
      ctx.globalAlpha  = ft.alpha;
      ctx.font         = `bold ${ft.size}px "Segoe UI", sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = ft.color;
      ctx.shadowColor  = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur   = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
      return true;
    });
  }

  // ─── Canvas helpers ────────────────────────────────────────────────────────

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _lighten(hex, amount) {
    return this._shiftColor(hex, amount);
  }

  _darken(hex, amount) {
    return this._shiftColor(hex, -amount);
  }

  _shiftColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r   = clamp(((num >> 16) & 0xFF) + amount, 0, 255);
    const g   = clamp(((num >>  8) & 0xFF) + amount, 0, 255);
    const b   = clamp(( num        & 0xFF) + amount, 0, 255);
    return `rgb(${r},${g},${b})`;
  }
}
