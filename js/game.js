/**
 * game.js — Main game controller and loop
 */

'use strict';

const GameState = Object.freeze({
  START:     'start',
  PLAYING:   'playing',
  ANIMATING: 'animating',  // mid-animation, input locked
  GAME_OVER: 'game_over',
});

class Game {
  constructor() {
    // Core systems
    this.board     = new Board(GRID_COLS, GRID_ROWS);
    this.score     = new ScoreManager();
    this.levels    = new LevelManager();
    this.particles = new ParticleSystem();

    // Canvas + rendering
    this.canvas   = document.getElementById('game-canvas');
    this.renderer = new Renderer(this.canvas, this.board, this.particles);

    // Input
    this.input = new InputHandler(this.canvas, this.renderer);
    this.input.onCellTap = this._onCellTap.bind(this);

    // Audio
    this.audio = new AudioManager();

    // Game state
    this.state    = GameState.START;
    this.selected = null; // {r, c} of currently selected block

    // Loop timing
    this._lastTime    = 0;
    this._rafId       = null;
    this._animLocked  = false;

    // UI element references
    this.ui = {
      scoreEl:      document.getElementById('score'),
      highScoreEl:  document.getElementById('high-score'),
      levelEl:      document.getElementById('level'),
      comboEl:      document.getElementById('combo'),
      comboMsgEl:   document.getElementById('combo-msg'),
      muteBtn:      document.getElementById('mute-btn'),
      newGameBtn:   document.getElementById('new-game-btn'),
      startScreen:  document.getElementById('start-screen'),
      gameOver:     document.getElementById('game-over'),
      finalScore:   document.getElementById('final-score'),
      finalHigh:    document.getElementById('final-high'),
      gameOverMsg:  document.getElementById('game-over-msg'),
      newHighBanner:document.getElementById('new-high-banner'),
      playBtn:      document.getElementById('play-btn'),
      replayBtn:    document.getElementById('replay-btn'),
      startHigh:    document.getElementById('start-high-score'),
      levelUpEl:    document.getElementById('level-up'),
    };

    // Wire up score callbacks
    this.score.onScore = (pts, total) => {
      this._updateScoreUI(total);
      this.levels.checkLevelUp(total);
      this._updateHighScoreUI();
    };
    this.score.onCombo = (combo, msg) => {
      this._showComboMessage(msg);
      if (combo > 0) this.audio.playCombo(combo);
    };
    this.score.onHighScore = (hs) => {
      this._showNewHighScore();
      this.audio.playHighScore();
    };

    // Wire up level callbacks
    this.levels.onLevelUp = (lvl) => {
      this._onLevelUp(lvl);
    };

    // UI event listeners
    this.ui.playBtn.addEventListener('click',    () => this.startGame());
    this.ui.replayBtn.addEventListener('click',  () => this.startGame());
    this.ui.newGameBtn.addEventListener('click', () => this.startGame());
    this.ui.muteBtn.addEventListener('click',    () => this._toggleMute());

    // Resize handler
    window.addEventListener('resize', () => {
      this.renderer.resize();
    });

    // Initialize UI
    this._updateHighScoreUI();
    this._updateStartScreen();

    // Start render loop
    this._loop(0);
  }

  // ─── Game Lifecycle ────────────────────────────────────────────────────────

  startGame() {
    // Reset everything
    this.board  = new Board(GRID_COLS, GRID_ROWS);
    this.score.reset();
    this.levels.reset();
    this.particles.clear();
    this.selected = null;
    this._animLocked = false;

    // Re-wire renderer to new board
    this.renderer.board = this.board;
    this.renderer.selectedCell = null;

    // Update UI
    this._updateScoreUI(0);
    this._updateLevelUI(1);
    this._updateHighScoreUI();
    this._hideComboMessage();

    // Hide overlays
    this.ui.startScreen.classList.add('hidden');
    this.ui.gameOver.classList.add('hidden');
    this.ui.newHighBanner.classList.add('hidden');

    this.state = GameState.PLAYING;
    this.input.enable();

    // Trigger play button audio init
    this.audio._getCtx();
  }

  async _triggerGameOver() {
    this.state = GameState.GAME_OVER;
    this.input.disable();
    this.selected = null;
    this.renderer.selectedCell = null;

    this.audio.playGameOver();
    this.renderer.triggerShake(10, 0.5);

    // Brief pause before overlay
    await this._sleep(600);

    this.score.updateBestLevel(this.levels.level);

    this.ui.finalScore.textContent   = formatNumber(this.score.score);
    this.ui.finalHigh.textContent    = formatNumber(this.score.highScore);
    this.ui.gameOverMsg.textContent  = getGameOverMessage();

    if (this.score.score >= this.score.highScore && this.score.score > 0) {
      this.ui.newHighBanner.classList.remove('hidden');
    } else {
      this.ui.newHighBanner.classList.add('hidden');
    }

    this.ui.gameOver.classList.remove('hidden');
  }

  // ─── Input Handler ─────────────────────────────────────────────────────────

  async _onCellTap(r, c) {
    if (this.state !== GameState.PLAYING || this._animLocked) return;
    if (!this.board.inBounds(r, c)) return;

    const block = this.board.get(r, c);

    if (!this.selected) {
      // No block selected yet — select this one
      if (!block || !block.canMove()) {
        if (block) {
          this.audio.playDenied();
          this.renderer.triggerShake(3, 0.1);
        }
        return;
      }
      this.selected = { r, c };
      this.renderer.selectedCell = { r, c };
      this.audio.playSelect();
      this.renderer.animatePulse(r, c);
      return;
    }

    const sel = this.selected;

    // Tap same block — deselect
    if (sel.r === r && sel.c === c) {
      this.selected = null;
      this.renderer.selectedCell = null;
      return;
    }

    // Tap another block
    if (this.board.isAdjacent(sel.r, sel.c, r, c)) {
      // Try to swap
      await this._attemptSwap(sel.r, sel.c, r, c);
    } else {
      // Re-select new block
      if (block && block.canMove()) {
        this.selected = { r, c };
        this.renderer.selectedCell = { r, c };
        this.audio.playSelect();
        this.renderer.animatePulse(r, c);
      } else {
        this.selected = null;
        this.renderer.selectedCell = null;
      }
    }
  }

  // ─── Swap & Match Logic ────────────────────────────────────────────────────

  async _attemptSwap(r1, c1, r2, c2) {
    this._animLocked = true;
    this.selected = null;
    this.renderer.selectedCell = null;

    // Perform the swap
    const ok = this.board.swap(r1, c1, r2, c2);
    if (!ok) {
      this._animLocked = false;
      this.audio.playDenied();
      return;
    }

    // Animate the swap
    await this.renderer.animateSwap(r1, c1, r2, c2);

    // Check for matches
    const groups = this.board.findMatches();
    if (groups.length === 0) {
      // No match — swap back
      this.board.swap(r2, c2, r1, c1);
      await this.renderer.animateSwap(r2, c2, r1, c1);
      this.audio.playDenied();
      this.renderer.triggerShake(4, 0.15);
      this._animLocked = false;
      return;
    }

    // Valid swap: reset chain & combo timing
    this.score.resetChain();
    this.audio.resetCombo();

    // Process cascades
    await this._processMatches(groups, 0);

    this._animLocked = false;

    // Check for game over
    if (!this.board.hasValidMoves()) {
      // Try shuffling the top row to give one more chance
      const config = this.levels.getConfig();
      this.board.shuffleTop(config.colorPool);
      await this._sleep(200);

      if (!this.board.hasValidMoves()) {
        await this._triggerGameOver();
      }
    }
  }

  /**
   * Process a set of matches (may cascade recursively)
   * @param {Array} groups  — match groups from Board.findMatches()
   * @param {number} chain  — cascade depth
   */
  async _processMatches(groups, chain) {
    const config   = this.levels.getConfig();
    const speedMul = config.speedMul;

    // Mark matched cells and get list of cells to remove
    const cells = this.board.markMatches(groups);

    // Emit particles and score for each group
    for (const group of groups) {
      for (const cell of group) {
        const block = this.board.get(cell.r, cell.c);
        if (!block) continue;
        const center = this.renderer.cellCenter(cell.r, cell.c);

        if (block.type === BlockType.RAINBOW) {
          this.particles.emitRainbow(center.x, center.y);
        } else if (block.type === BlockType.BOMB) {
          this.particles.emitBomb(center.x, center.y);
          this.audio.playBomb();
        } else {
          const color = block.color || '#FDCB6E';
          this.particles.emit(center.x, center.y, [color, '#FFFFFF'], 10);
        }
      }

      // Score this group
      const pts = this.score.addMatchPoints(group.length, chain, this.levels.level);
      this.levels.checkLevelUp(this.score.score);

      // Float text at center of group
      const cx = group.reduce((s, g) => s + g.c, 0) / group.length;
      const cy = group.reduce((s, g) => s + g.r, 0) / group.length;
      const center = this.renderer.cellCenter(cy, cx);
      const color  = group.length >= 5 ? '#FF4757' : group.length >= 4 ? '#FFA502' : '#FDCB6E';
      this.renderer.addFloatText(`+${formatNumber(pts)}`, center.x, center.y, color, 22);
    }

    // Play match sound + cascade
    const maxSize = Math.max(...groups.map(g => g.length));
    this.audio.playMatch(maxSize);
    if (chain > 0) this.audio.playCascade(chain);

    // Animate cleared blocks
    await this.renderer.animateClear(cells, 0.2 / speedMul);

    // Remove from board
    this.board.removeMatched();

    // Apply gravity
    const fallMoves = this.board.applyGravity();

    // Spawn new blocks
    const spawned = this.board.fillEmpty(config.colorPool, config);

    // Animate falling + spawning in parallel
    const [fallAnim, spawnAnim] = [
      fallMoves.length > 0 ? this.renderer.animateFall(fallMoves, speedMul) : Promise.resolve(),
      spawned.length   > 0 ? this.renderer.animateSpawn(spawned, speedMul)  : Promise.resolve(),
    ];
    await Promise.all([fallAnim, spawnAnim]);

    // Reset justSpawned flag
    for (const s of spawned) s.block.justSpawned = false;

    // Check for cascade matches
    const nextGroups = this.board.findMatches();
    if (nextGroups.length > 0) {
      this.score.nextChain();
      await this._sleep(80);
      await this._processMatches(nextGroups, chain + 1);
    }
  }

  // ─── Level Up ──────────────────────────────────────────────────────────────

  _onLevelUp(level) {
    this.audio.playLevelUp();
    this._updateLevelUI(level);
    this._showLevelUpBanner(level);
    this.renderer.triggerShake(5, 0.2);
    this.score.updateBestLevel(level);
  }

  _showLevelUpBanner(level) {
    const el = this.ui.levelUpEl;
    if (!el) return;
    el.textContent = `⬆️ LEVEL ${level}!`;
    el.classList.remove('hidden');
    el.classList.add('pop-in');
    setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove('pop-in');
    }, 1800);
  }

  // ─── UI Updates ────────────────────────────────────────────────────────────

  _updateScoreUI(score) {
    this.ui.scoreEl.textContent = formatNumber(score);
  }

  _updateHighScoreUI() {
    this.ui.highScoreEl.textContent = formatNumber(this.score.highScore);
  }

  _updateLevelUI(level) {
    this.ui.levelEl.textContent = level;
  }

  _updateStartScreen() {
    if (this.ui.startHigh) {
      this.ui.startHigh.textContent = formatNumber(this.score.highScore);
    }
  }

  _showComboMessage(msg) {
    if (typeof msg === 'object' && msg.msg) {
      // It's a combo or milestone message object
      this.ui.comboEl.textContent     = msg.msg;
      this.ui.comboEl.style.color     = msg.color || '#FDCB6E';
      this.ui.comboMsgEl.style.display = 'none';
    } else {
      this.ui.comboEl.textContent = typeof msg === 'string' ? msg : '';
    }
    this.ui.comboEl.classList.remove('hidden');
    this.ui.comboEl.classList.add('pop-in');

    clearTimeout(this._comboTimeout);
    this._comboTimeout = setTimeout(() => {
      this._hideComboMessage();
    }, 2500);
  }

  _hideComboMessage() {
    this.ui.comboEl.classList.add('hidden');
    this.ui.comboEl.classList.remove('pop-in');
  }

  _showNewHighScore() {
    this.ui.newHighBanner.classList.remove('hidden');
    setTimeout(() => {
      if (this.state === GameState.PLAYING) {
        this.ui.newHighBanner.classList.add('hidden');
      }
    }, 2500);
  }

  _toggleMute() {
    const muted = this.audio.toggleMute();
    this.ui.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  // ─── Game Loop ─────────────────────────────────────────────────────────────

  _loop(timestamp) {
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.1); // cap at 100ms
    this._lastTime = timestamp;

    // Tick score system (combo reset)
    this.score.tick();

    // Update physics/particles before rendering
    this.particles.update(dt);

    // Render
    this.renderer.render(dt);

    this._rafId = requestAnimationFrame(this._loop.bind(this));
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Boot the game when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window._game = new Game();
});
