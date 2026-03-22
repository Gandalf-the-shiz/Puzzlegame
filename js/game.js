/**
 * game.js — Main game controller and loop
 *
 * Modes: 'endless' | 'daily' | 'hardcore'
 */

'use strict';

const GameState = Object.freeze({
  START:      'start',
  PLAYING:    'playing',
  ANIMATING:  'animating',
  GAME_OVER:  'game_over',
  POWERUP_AIM:'powerup_aim', // waiting for player to tap a target cell
});

class Game {
  constructor() {
    // Apply equipped theme on boot
    Unlocks.applyEquippedTheme();

    // Core systems
    this.board     = new Board(GRID_COLS, GRID_ROWS); // placeholder for renderer
    this.score     = null;
    this.levels    = null;
    this.particles = new ParticleSystem();

    // Canvas + rendering
    this.canvas   = document.getElementById('game-canvas');
    this.renderer = new Renderer(this.canvas, this.board, this.particles);

    // Input
    this.input = new InputHandler(this.canvas, this.renderer);
    this.input.onCellTap = this._onCellTap.bind(this);

    // Audio
    this.audio = new AudioManager();

    // State
    this.state    = GameState.START;
    this.mode     = 'endless';
    this.selected = null;

    // Powerup aim state
    this._aimingPowerup = null; // powerup id being targeted

    // Loop timing
    this._lastTime   = 0;
    this._animLocked = false;
    this._rafId      = null;

    // UI refs
    this.ui = this._collectUI();

    // Wire callbacks
    this._wireUIEvents();

    // Disable game input on start screen
    this.input.disable();

    // Init display
    this._updateStartScreen();

    // Apply start screen music if enabled
    if (Settings.getMusicOn()) this.audio.startMusic();

    // Start render loop
    this._loop(0);
  }

  // ─── UI collection ─────────────────────────────────────────────────────────

  _collectUI() {
    const q = id => document.getElementById(id);
    return {
      // Header
      scoreEl:       q('score'),
      highScoreEl:   q('high-score'),
      levelEl:       q('level'),
      modeLabel:     q('mode-label'),
      dustHeader:    q('header-dust'),
      // Combo
      comboEl:       q('combo'),
      comboMsgEl:    q('combo-msg'),
      // Toolbar
      muteBtn:       q('mute-btn'),
      musicBtn:      q('music-btn'),
      newGameBtn:    q('new-game-btn'),
      menuBtn:       q('menu-btn'),
      // Powerup bar
      powerupBar:    q('powerup-bar'),
      ppBombBtn:     q('pp-bomb'),
      ppShuffleBtn:  q('pp-shuffle'),
      ppUndoBtn:     q('pp-undo'),
      ppAimHint:     q('pp-aim-hint'),
      // Start screen
      startScreen:   q('start-screen'),
      startDust:     q('start-dust'),
      startStreak:   q('start-streak'),
      // Game Over
      gameOver:      q('game-over'),
      gameOverTitle: q('game-over-title'),
      gameOverMsg:   q('game-over-msg'),
      finalScore:    q('final-score'),
      finalHigh:     q('final-high'),
      finalDust:     q('final-dust'),
      finalRank:     q('final-rank'),
      leaderboardEl: q('lb-entries'),
      replayBtn:     q('replay-btn'),
      menuFromGoBtn: q('menu-from-go-btn'),
      newHighBanner: q('new-high-banner'),
      // Overlays
      levelUpEl:     q('level-up'),
      // Settings
      settingsOverlay: q('settings-overlay'),
      stSoundToggle:   q('st-sound'),
      stMusicToggle:   q('st-music'),
      stHapticsToggle: q('st-haptics'),
      stColorblind:    q('st-colorblind'),
      closeSettings:   q('close-settings'),
      // Shop
      shopOverlay:     q('shop-overlay'),
      shopTabs:        q('shop-tabs'),
      shopItems:       q('shop-items'),
      shopDust:        q('shop-dust'),
      closeShop:       q('close-shop'),
      // Confirm popup
      confirmOverlay:  q('confirm-overlay'),
      confirmMsg:      q('confirm-msg'),
      confirmYes:      q('confirm-yes'),
      confirmNo:       q('confirm-no'),
      // Daily complete banner
      dailyBanner:     q('daily-banner'),
    };
  }

  // ─── UI event wiring ───────────────────────────────────────────────────────

  _wireUIEvents() {
    // Start screen buttons
    document.getElementById('play-endless-btn').addEventListener('click', () => this.startGame('endless'));
    document.getElementById('play-daily-btn').addEventListener('click',   () => this.startGame('daily'));
    document.getElementById('play-hardcore-btn').addEventListener('click',() => this.startGame('hardcore'));
    document.getElementById('open-shop-btn').addEventListener('click',    () => this.openShop());
    document.getElementById('open-settings-btn').addEventListener('click',() => this.openSettings());

    // Toolbar (in-game)
    this.ui.muteBtn.addEventListener('click',    () => this._toggleSound());
    this.ui.musicBtn.addEventListener('click',   () => this._toggleMusic());
    this.ui.newGameBtn.addEventListener('click', () => this.startGame(this.mode));
    this.ui.menuBtn.addEventListener('click',    () => this._goToMenu());

    // Powerup buttons
    this.ui.ppBombBtn.addEventListener('click',    () => this._activatePowerup('bomb_blast'));
    this.ui.ppShuffleBtn.addEventListener('click', () => this._activatePowerup('shuffle'));
    this.ui.ppUndoBtn.addEventListener('click',    () => this._activatePowerup('undo'));

    // Game over buttons
    this.ui.replayBtn.addEventListener('click',      () => this.startGame(this.mode));
    this.ui.menuFromGoBtn.addEventListener('click',  () => this._goToMenu());

    // Settings overlay
    this.ui.closeSettings.addEventListener('click',  () => this.closeSettings());
    this.ui.stSoundToggle.addEventListener('change', e => {
      Settings.setSoundOn(e.target.checked);
      if (!e.target.checked) this.audio.stopMusic();
      else if (Settings.getMusicOn()) this.audio.startMusic();
      this._updateMuteBtn();
    });
    this.ui.stMusicToggle.addEventListener('change', e => {
      Settings.setMusicOn(e.target.checked);
      e.target.checked ? this.audio.startMusic() : this.audio.stopMusic();
      this._updateMusicBtn();
    });
    this.ui.stHapticsToggle.addEventListener('change', e => Settings.setHapticsOn(e.target.checked));
    this.ui.stColorblind.addEventListener('change',   e => Settings.setColorblind(e.target.checked));

    // Shop overlay
    this.ui.closeShop.addEventListener('click', () => this.closeShop());

    // Resize
    window.addEventListener('resize', () => this.renderer.resize());
  }

  // ─── Game Lifecycle ────────────────────────────────────────────────────────

  startGame(mode = 'endless') {
    this.mode = mode;

    // Create fresh systems
    const isHardcore = (mode === 'hardcore');
    this.levels    = new LevelManager(isHardcore);
    this.score     = new ScoreManager(mode);
    this.particles.clear();
    this.selected       = null;
    this._animLocked    = false;
    this._aimingPowerup = null;

    // Create board — daily mode uses seeded board
    if (mode === 'daily') {
      this.board = DailyChallenge.withSeededRng(() => new Board(GRID_COLS, GRID_ROWS));
    } else {
      this.board = new Board(GRID_COLS, GRID_ROWS);
    }

    this.renderer.board        = this.board;
    this.renderer.selectedCell = null;

    // Init powerups
    Powerups.init(isHardcore);

    // Wire score callbacks
    this.score.onScore = (pts, total) => {
      this._updateScoreUI(total);
      this.levels.checkLevelUp(total);
      this._updateHighScoreUI();
    };
    this.score.onCombo = (combo, msg) => {
      this._showComboMessage(msg);
      if (combo > 0) {
        this.audio.playCombo(combo);
        this.renderer.triggerShake(3, 0.15, combo * 0.5);
      }
    };
    this.score.onHighScore = () => {
      this._showNewHighScore();
      this.audio.playHighScore();
    };

    // Wire level callbacks
    this.levels.onLevelUp = lvl => {
      this._onLevelUp(lvl);
      this.score.onLevelUp();
    };

    // Update UI
    this._updateScoreUI(0);
    this._updateLevelUI(1);
    this._updateHighScoreUI();
    this._hideComboMessage();
    this._updatePowerupBar();
    this._updateModeLabel();
    this._updateMuteBtn();
    this._updateMusicBtn();
    this._updateDustHeader();

    // Hide overlays
    this.ui.startScreen.classList.add('hidden');
    this.ui.gameOver.classList.add('hidden');
    this.ui.newHighBanner.classList.add('hidden');
    this.ui.dailyBanner.classList.add('hidden');
    if (this.ui.ppAimHint) this.ui.ppAimHint.classList.add('hidden');

    this.state = GameState.PLAYING;
    this.input.enable();

    // Start AudioContext after user gesture
    this.audio._getCtx();
    if (Settings.getMusicOn()) this.audio.startMusic();
  }

  async _triggerGameOver() {
    this.state = GameState.GAME_OVER;
    this.input.disable();
    this.selected = null;
    this.renderer.selectedCell = null;

    this.audio.playGameOver();
    this.renderer.triggerShake(12, 0.5);

    // Handle daily completion
    let dailyCompleted = false;
    let newStreakCount  = 0;
    if (this.mode === 'daily' && !DailyChallenge.isDailyCompleted()) {
      newStreakCount  = DailyChallenge.completeDaily();
      dailyCompleted  = true;
    }

    // Commit dust
    const dustEarned = this.score.commitDust(dailyCompleted);

    // Update best level
    this.score.updateBestLevel(this.levels.level);

    // Add to leaderboard
    const rank = Leaderboard.addEntry(
      this.mode,
      this.score.score,
      this.levels.level,
      this.mode === 'daily' ? DailyChallenge.getToday() : null
    );

    await this._sleep(600);

    // Populate game over overlay
    this.ui.finalScore.textContent  = formatNumber(this.score.score);
    this.ui.finalHigh.textContent   = formatNumber(this.score.highScore);
    this.ui.finalDust.textContent   = `+${dustEarned} 💨`;
    this.ui.gameOverTitle.textContent = dailyCompleted ? '🌟 Daily Done!' : '💀 Game Over!';
    this.ui.gameOverMsg.textContent  = Unlocks.getGameOverMsg();

    if (rank > 0 && rank <= 10) {
      this.ui.finalRank.textContent = `#${rank} on Leaderboard!`;
      this.ui.finalRank.classList.remove('hidden');
    } else {
      this.ui.finalRank.classList.add('hidden');
    }

    if (dailyCompleted && newStreakCount > 0) {
      this.ui.dailyBanner.textContent = `🔥 ${newStreakCount}-Day Streak!`;
      this.ui.dailyBanner.classList.remove('hidden');
    }

    // Render leaderboard
    Leaderboard.renderInto(this.ui.leaderboardEl, this.mode, rank);

    // Show "new high score" banner inline
    if (this.score.score >= this.score.highScore && this.score.score > 0) {
      this.ui.newHighBanner.classList.remove('hidden');
    } else {
      this.ui.newHighBanner.classList.add('hidden');
    }

    this.ui.gameOver.classList.remove('hidden');

    // Update dust in header
    this._updateDustHeader();
  }

  _goToMenu() {
    this.state    = GameState.START;
    this.selected = null;
    if (this.renderer) this.renderer.selectedCell = null;
    this.input.disable();
    this.audio.stopMusic();

    this.ui.gameOver.classList.add('hidden');
    this.ui.startScreen.classList.remove('hidden');
    this.ui.dailyBanner.classList.add('hidden');
    this._updateStartScreen();
  }

  // ─── Input Handler ─────────────────────────────────────────────────────────

  async _onCellTap(r, c) {
    // Handle powerup aim mode
    if (this.state === GameState.POWERUP_AIM) {
      await this._executeBombBlast(r, c);
      return;
    }

    if (this.state !== GameState.PLAYING || this._animLocked) return;
    if (!this.board.inBounds(r, c)) return;

    const block = this.board.get(r, c);

    if (!this.selected) {
      if (!block || !block.canMove()) {
        if (block) { this.audio.playDenied(); this.renderer.triggerShake(3, 0.1); }
        return;
      }
      this.selected = { r, c };
      this.renderer.selectedCell = { r, c };
      this.audio.playSelect();
      this.renderer.animatePulse(r, c);
      return;
    }

    const sel = this.selected;
    if (sel.r === r && sel.c === c) {
      this.selected = null;
      this.renderer.selectedCell = null;
      return;
    }

    if (this.board.isAdjacent(sel.r, sel.c, r, c)) {
      await this._attemptSwap(sel.r, sel.c, r, c);
    } else {
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
    this.selected    = null;
    this.renderer.selectedCell = null;

    // Save undo state BEFORE swap
    Powerups.saveUndoState(this.board.grid);

    const ok = this.board.swap(r1, c1, r2, c2);
    if (!ok) {
      this._animLocked = false;
      this.audio.playDenied();
      return;
    }

    await this.renderer.animateSwap(r1, c1, r2, c2);

    const groups = this.board.findMatches();
    if (groups.length === 0) {
      this.board.swap(r2, c2, r1, c1);
      await this.renderer.animateSwap(r2, c2, r1, c1);
      this.audio.playDenied();
      this.renderer.triggerShake(4, 0.15);
      this._animLocked = false;
      return;
    }

    this.score.resetChain();
    this.audio.resetCombo();
    await this._processMatches(groups, 0);

    this._animLocked = false;

    if (!this.board.hasValidMoves()) {
      const config = this.levels.getConfig();
      this.board.shuffleTop(config.colorPool);
      await this._sleep(200);
      if (!this.board.hasValidMoves()) {
        await this._triggerGameOver();
      }
    }

    this._updatePowerupBar();
  }

  async _processMatches(groups, chain) {
    const config   = this.levels.getConfig();
    const speedMul = config.speedMul;

    const cells = this.board.markMatches(groups);

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
          this.particles.emit(center.x, center.y, [color, '#FFFFFF'], 12);
        }
      }

      const pts = this.score.addMatchPoints(group.length, chain, this.levels.level);
      this.levels.checkLevelUp(this.score.score);

      const cx     = group.reduce((s, g) => s + g.c, 0) / group.length;
      const cy     = group.reduce((s, g) => s + g.r, 0) / group.length;
      const center = this.renderer.cellCenter(cy, cx);
      const color  = group.length >= 5 ? '#FF4757' : group.length >= 4 ? '#FFA502' : '#FDCB6E';
      this.renderer.addFloatText(`+${formatNumber(pts)}`, center.x, center.y, color, 22);
    }

    const maxSize = Math.max(...groups.map(g => g.length));
    this.audio.playMatch(maxSize);
    if (chain > 0) this.audio.playCascade(chain);

    await this.renderer.animateClear(cells, 0.2 / speedMul);

    this.board.removeMatched();
    const fallMoves = this.board.applyGravity();
    const spawned   = this.board.fillEmpty(config.colorPool, config);

    await Promise.all([
      fallMoves.length > 0 ? this.renderer.animateFall(fallMoves, speedMul)   : Promise.resolve(),
      spawned.length   > 0 ? this.renderer.animateSpawn(spawned,  speedMul)   : Promise.resolve(),
    ]);

    for (const s of spawned) s.block.justSpawned = false;

    const nextGroups = this.board.findMatches();
    if (nextGroups.length > 0) {
      this.score.nextChain();
      await this._sleep(80);
      await this._processMatches(nextGroups, chain + 1);
    }
  }

  // ─── Powerups ──────────────────────────────────────────────────────────────

  _activatePowerup(id) {
    if (this.state !== GameState.PLAYING || this._animLocked) return;
    if (!Powerups.canUse(id)) return;

    const def = Powerups.getDef(id);
    if (!def) return;

    // Show confirm popup
    this._showConfirm(
      `Use ${def.emoji} ${def.name}?\n${def.description}`,
      async () => {
        if (id === 'bomb_blast') {
          this._enterAimMode(id);
        } else if (id === 'shuffle') {
          await this._executeShuffle();
        } else if (id === 'undo') {
          await this._executeUndo();
        }
      }
    );
  }

  _enterAimMode(id) {
    this.state       = GameState.POWERUP_AIM;
    this._aimingPowerup = id;
    this.selected    = null;
    this.renderer.selectedCell = null;
    if (this.ui.ppAimHint) this.ui.ppAimHint.classList.remove('hidden');
  }

  async _executeBombBlast(r, c) {
    const id = this._aimingPowerup;
    this._aimingPowerup = null;
    this.state = GameState.PLAYING;
    if (this.ui.ppAimHint) this.ui.ppAimHint.classList.add('hidden');

    if (!Powerups.use(id)) return;

    this._animLocked = true;

    const cellsToClear = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (this.board.inBounds(nr, nc)) {
          const b = this.board.get(nr, nc);
          if (b && b.type !== BlockType.BLOCKER) {
            b.matched = true;
            cellsToClear.push({ r: nr, c: nc, block: b });
            const center = this.renderer.cellCenter(nr, nc);
            this.particles.emitBomb(center.x, center.y);
          }
        }
      }
    }

    const pts = this.score.addBombPoints(cellsToClear.length, this.levels.level);
    const center = this.renderer.cellCenter(r, c);
    this.renderer.addFloatText(`💣 +${formatNumber(pts)}`, center.x, center.y, '#FF4757', 24);
    this.renderer.triggerShake(10, 0.4);
    this.audio.playBomb();
    this.audio.playPowerup();
    this.particles.emitPowerup(center.x, center.y, '#FF4757');

    await this.renderer.animateClear(cellsToClear, 0.25);
    this.board.removeMatched();

    const config    = this.levels.getConfig();
    const fallMoves = this.board.applyGravity();
    const spawned   = this.board.fillEmpty(config.colorPool, config);

    await Promise.all([
      fallMoves.length > 0 ? this.renderer.animateFall(fallMoves, config.speedMul)  : Promise.resolve(),
      spawned.length   > 0 ? this.renderer.animateSpawn(spawned,  config.speedMul)  : Promise.resolve(),
    ]);
    for (const s of spawned) s.block.justSpawned = false;

    const nextGroups = this.board.findMatches();
    if (nextGroups.length > 0) {
      this.score.resetChain();
      await this._processMatches(nextGroups, 0);
    }

    this._animLocked = false;
    this._updatePowerupBar();

    if (!this.board.hasValidMoves()) {
      this.board.shuffleTop(config.colorPool);
      await this._sleep(200);
      if (!this.board.hasValidMoves()) await this._triggerGameOver();
    }
  }

  async _executeShuffle() {
    if (!Powerups.use('shuffle')) return;
    this._animLocked = true;

    const config = this.levels.getConfig();
    // Animate all blocks clearing
    const allCells = [];
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const b = this.board.get(r, c);
        if (b) { b.matched = true; allCells.push({ r, c, block: b }); }
      }
    }

    await this.renderer.animateClear(allCells, 0.3);
    this.board.removeMatched();

    // Refill
    const spawned = this.board.fillEmpty(config.colorPool, config);
    await this.renderer.animateSpawn(spawned, config.speedMul);
    for (const s of spawned) s.block.justSpawned = false;

    const center = this.renderer.cellCenter(
      Math.floor(this.board.rows / 2),
      Math.floor(this.board.cols / 2)
    );
    this.particles.emitPowerup(center.x, center.y, '#1E90FF');
    this.renderer.addFloatText('🔀 SHUFFLE!', center.x, center.y - 30, '#1E90FF', 24);
    this.audio.playPowerup();

    const cascades = this.board.findMatches();
    if (cascades.length > 0) {
      this.score.resetChain();
      await this._sleep(80);
      await this._processMatches(cascades, 0);
    }

    this._animLocked = false;
    this._updatePowerupBar();
  }

  async _executeUndo() {
    const savedGrid = Powerups.popUndoState();
    if (!savedGrid) return;
    if (!Powerups.use('undo')) return;

    this._animLocked = true;

    // Fade out current board
    const allCells = [];
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const b = this.board.get(r, c);
        if (b) { b.matched = true; allCells.push({ r, c, block: b }); }
      }
    }
    await this.renderer.animateClear(allCells, 0.2);

    // Restore saved grid
    this.board.grid = savedGrid;

    // Spawn-animate the restored blocks
    const toSpawn = [];
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const b = this.board.get(r, c);
        if (b) { b.justSpawned = true; toSpawn.push({ block: b, r, c }); }
      }
    }
    await this.renderer.animateSpawn(toSpawn, 1.5);
    for (const s of toSpawn) s.block.justSpawned = false;

    const center = this.renderer.cellCenter(
      Math.floor(this.board.rows / 2),
      Math.floor(this.board.cols / 2)
    );
    this.renderer.addFloatText('↩️ UNDO!', center.x, center.y - 30, '#2ED573', 24);
    this.particles.emitPowerup(center.x, center.y, '#2ED573');
    this.audio.playPowerup();

    this._animLocked = false;
    this._updatePowerupBar();
  }

  // ─── Level Up ──────────────────────────────────────────────────────────────

  _onLevelUp(level) {
    this.audio.playLevelUp();
    this._updateLevelUI(level);
    this._showLevelUpBanner(level);
    this.renderer.triggerShake(6, 0.25);
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

  // ─── Settings overlay ──────────────────────────────────────────────────────

  openSettings() {
    const s = Settings;
    this.ui.stSoundToggle.checked  = s.getSoundOn();
    this.ui.stMusicToggle.checked  = s.getMusicOn();
    this.ui.stHapticsToggle.checked= s.getHapticsOn();
    this.ui.stColorblind.checked   = s.getColorblind();
    this.ui.settingsOverlay.classList.remove('hidden');
  }

  closeSettings() {
    this.ui.settingsOverlay.classList.add('hidden');
  }

  // ─── Shop overlay ──────────────────────────────────────────────────────────

  openShop() {
    this._shopTab = 'themes';
    this._renderShop();
    this.ui.shopOverlay.classList.remove('hidden');
  }

  closeShop() {
    this.ui.shopOverlay.classList.add('hidden');
    Unlocks.applyEquippedTheme(); // ensure theme CSS is up to date
  }

  _renderShop() {
    this.ui.shopDust.textContent = `💨 ${formatNumber(GameStorage.getDust())} Wizard Dust`;

    // Render tab buttons
    const tabs = [
      { id: 'themes',     label: '🎨 Themes' },
      { id: 'particles',  label: '✨ Particles' },
      { id: 'announcers', label: '📣 Announcers' },
    ];
    this.ui.shopTabs.innerHTML = tabs.map(t =>
      `<button class="shop-tab${this._shopTab === t.id ? ' active' : ''}"
               data-tab="${t.id}">${t.label}</button>`
    ).join('');
    this.ui.shopTabs.querySelectorAll('.shop-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this._shopTab = btn.dataset.tab;
        this._renderShop();
      });
    });

    // Render items
    let items = [];
    if (this._shopTab === 'themes')     items = Unlocks.getAllThemes();
    if (this._shopTab === 'particles')  items = Unlocks.getAllParticleStyles();
    if (this._shopTab === 'announcers') items = Unlocks.getAllAnnouncers();

    const equipped = GameStorage.getEquipped();
    const dust     = GameStorage.getDust();

    const catMap = { themes: 'theme', particles: 'particles', announcers: 'announcer' };
    const cat    = catMap[this._shopTab];

    this.ui.shopItems.innerHTML = items.map(item => {
      const owned    = GameStorage.isUnlocked(item.id);
      const isEquip  = equipped[cat] === item.id;
      const canBuy   = !owned && dust >= item.cost;

      let btnHtml = '';
      if (isEquip) {
        btnHtml = `<button class="btn btn-primary shop-item-btn equipped" disabled>✅ Equipped</button>`;
      } else if (owned) {
        btnHtml = `<button class="btn btn-secondary shop-item-btn" data-action="equip" data-id="${item.id}" data-cat="${cat}">Equip</button>`;
      } else {
        btnHtml = `<button class="btn ${canBuy ? 'btn-primary' : 'btn-secondary'} shop-item-btn"
                    data-action="buy" data-id="${item.id}"
                    ${!canBuy ? 'disabled' : ''}>
                    💨 ${item.cost}
                  </button>`;
      }

      return `<div class="shop-item${isEquip ? ' equipped' : ''}">
        <div class="shop-item-emoji">${item.emoji}</div>
        <div class="shop-item-info">
          <div class="shop-item-name">${item.name}</div>
          <div class="shop-item-desc">${item.description}</div>
        </div>
        ${btnHtml}
      </div>`;
    }).join('');

    this.ui.shopItems.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id     = btn.dataset.id;
        const ct     = btn.dataset.cat;
        if (action === 'buy') {
          const result = Unlocks.purchase(id);
          if (result.success) {
            this._renderShop();
          }
        } else if (action === 'equip') {
          Unlocks.equip(ct, id);
          this._renderShop();
        }
      });
    });
  }

  // ─── Confirm popup ─────────────────────────────────────────────────────────

  /**
   * Show a confirmation dialog before an action (e.g., powerup use).
   * Uses AbortController so listeners are cleaned up without DOM cloning.
   */
  _showConfirm(message, onYes) {
    this.ui.confirmMsg.textContent = message;
    this.ui.confirmOverlay.classList.remove('hidden');

    // Use AbortController to cancel stale listeners on the next open
    if (this._confirmAbort) this._confirmAbort.abort();
    this._confirmAbort = new AbortController();
    const { signal } = this._confirmAbort;

    const dismiss = () => {
      this.ui.confirmOverlay.classList.add('hidden');
      if (this._confirmAbort) { this._confirmAbort.abort(); this._confirmAbort = null; }
    };

    this.ui.confirmYes.addEventListener('click', async () => {
      dismiss();
      await onYes();
    }, { signal });

    this.ui.confirmNo.addEventListener('click', () => dismiss(), { signal });
  }

  // ─── UI updates ────────────────────────────────────────────────────────────

  _updateScoreUI(score) {
    this.ui.scoreEl.textContent = formatNumber(score);
    this.ui.scoreEl.classList.add('pop');
    setTimeout(() => this.ui.scoreEl.classList.remove('pop'), 200);
  }

  _updateHighScoreUI() {
    this.ui.highScoreEl.textContent = formatNumber(this.score ? this.score.highScore : 0);
  }

  _updateLevelUI(level) {
    this.ui.levelEl.textContent = level;
  }

  _updateModeLabel() {
    const labels = { endless: '♾️ Endless', daily: '📅 Daily', hardcore: '💀 Hardcore' };
    if (this.ui.modeLabel) this.ui.modeLabel.textContent = labels[this.mode] || '';
  }

  _updateDustHeader() {
    if (this.ui.dustHeader) {
      this.ui.dustHeader.textContent = `💨 ${formatNumber(GameStorage.getDust())}`;
    }
  }

  _updateStartScreen() {
    // High scores per mode
    ['endless','daily','hardcore'].forEach(m => {
      const el = document.getElementById(`start-hs-${m}`);
      if (el) el.textContent = formatNumber(GameStorage.getHighScore(m));
    });

    // Dust
    if (this.ui.startDust) {
      this.ui.startDust.textContent = `💨 ${formatNumber(GameStorage.getDust())} Wizard Dust`;
    }

    // Streak
    const info = DailyChallenge.getStreakInfo();
    if (this.ui.startStreak) {
      if (info.count > 0) {
        this.ui.startStreak.textContent = `🔥 ${info.count}-Day Streak${info.completedToday ? ' ✅' : ''}`;
        this.ui.startStreak.classList.remove('hidden');
      } else {
        this.ui.startStreak.textContent = '';
        this.ui.startStreak.classList.add('hidden');
      }
    }

    // Daily button label
    const dailyBtn = document.getElementById('play-daily-btn');
    if (dailyBtn) {
      const done = DailyChallenge.isDailyCompleted();
      dailyBtn.textContent = done ? '📅 Daily (done ✅)' : '📅 Daily Challenge';
    }
  }

  _updatePowerupBar() {
    if (!this.ui.powerupBar) return;

    const defs = Powerups.getDefs();
    defs.forEach(def => {
      const charges = Powerups.getCharges(def.id);
      const idMap   = { bomb_blast: 'bomb', shuffle: 'shuffle', undo: 'undo' };
      const btnId   = `pp-${idMap[def.id]}`;
      const btn     = document.getElementById(btnId);
      if (!btn) return;

      const chargeEl = btn.querySelector('.pp-charge');
      if (chargeEl) chargeEl.textContent = charges;

      btn.disabled = charges <= 0;
      btn.style.opacity = charges <= 0 ? '0.4' : '1';
    });
  }

  _showComboMessage(msg) {
    const el = this.ui.comboEl;
    if (!el) return;
    if (typeof msg === 'object' && msg.msg) {
      el.textContent    = msg.msg;
      el.style.color    = msg.color || '#FDCB6E';
    } else {
      el.textContent    = typeof msg === 'string' ? msg : '';
      el.style.color    = '#FDCB6E';
    }
    el.classList.remove('hidden');
    el.classList.add('pop-in');
    clearTimeout(this._comboTimeout);
    this._comboTimeout = setTimeout(() => this._hideComboMessage(), 2500);
  }

  _hideComboMessage() {
    const el = this.ui.comboEl;
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('pop-in');
  }

  _showNewHighScore() {
    this.ui.newHighBanner.classList.remove('hidden');
    setTimeout(() => {
      if (this.state === GameState.PLAYING) {
        this.ui.newHighBanner.classList.add('hidden');
      }
    }, 2500);
  }

  _toggleSound() {
    const muted = this.audio.toggleSound();
    this._updateMuteBtn();
    if (this.ui.stSoundToggle) this.ui.stSoundToggle.checked = !muted;
  }

  _toggleMusic() {
    const on = this.audio.toggleMusic();
    this._updateMusicBtn();
    if (this.ui.stMusicToggle) this.ui.stMusicToggle.checked = on;
  }

  _updateMuteBtn() {
    if (this.ui.muteBtn) this.ui.muteBtn.textContent = Settings.getSoundOn() ? '🔊' : '🔇';
  }

  _updateMusicBtn() {
    if (this.ui.musicBtn) this.ui.musicBtn.textContent = Settings.getMusicOn() ? '🎵' : '🎵';
  }

  // ─── Game loop ─────────────────────────────────────────────────────────────

  _loop(timestamp) {
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.1);
    this._lastTime = timestamp;

    if (this.score) this.score.tick();
    this.particles.update(dt);
    if (this.renderer) this.renderer.render(dt);

    this._rafId = requestAnimationFrame(this._loop.bind(this));
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  _sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  window._game = new Game();
});
