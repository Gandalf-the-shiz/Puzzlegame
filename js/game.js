/**
 * game.js — Match-3 game engine wiring
 *
 * Instantiates and connects Board, Renderer, InputHandler, AudioManager,
 * ScoreManager, LevelManager, ParticleSystem, and PowerupManager.
 * Handles the game loop, UI button bindings, overlays, and game-over flow.
 *
 * Exposed globals:
 *   window._game        — singleton Game instance (used by app.js for resize)
 *   startMatch3Game()   — utility to start a mode directly
 */

'use strict';

// ── Small DOM helpers (file-scoped) ──────────────────────────────────────────

function _btn(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

function _onChange(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', function (e) { fn(e.target.checked); });
}

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function _setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}

function _showEl(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function _hideEl(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// ── Game constructor ─────────────────────────────────────────────────────────

function Game() {
  // ── Long-lived subsystems ──────────────────────────────────────────
  this.particles = new ParticleSystem();
  this.audio     = new AudioManager();

  // ── Per-run objects (created/replaced in _startGame) ──────────────
  this.board    = null;
  this.renderer = null;
  this.input    = null;
  this.score    = null;
  this.levels   = null;

  // ── State machine ─────────────────────────────────────────────────
  this._mode         = 'endless';
  // 'idle' | 'playing' | 'animating' | 'gameover'
  this._state        = 'idle';
  this._animId       = null;
  this._lastTime     = 0;
  this._selectedCell = null;
  this._comboMsgTimer = null;
  this._pendingConfirmAction = null;

  // ── Resize handler (stored for cleanup) ───────────────────────────
  this.onResize = function () {
    if (this.renderer) this.renderer.resize();
  }.bind(this);
  window.addEventListener('resize', this.onResize);

  this._bindStaticUI();
  this._updateStartScreen();
  // Start screen is already visible (no 'hidden' class in HTML)
}

// ── Public stop API (called by app.js / prototype stub) ─────────────────────

Game.prototype.stop = function () {
  this._stopLoop();
  window.removeEventListener('resize', this.onResize);
  this.disableInput();
  this.stopMusic();
  this.hideOverlays();
};

Game.prototype.disableInput = function () {
  if (this.input) this.input.disable();
};

Game.prototype.stopMusic = function () {
  if (this.audio) this.audio.stopMusic();
};

Game.prototype.hideOverlays = function () {
  ['start-screen', 'game-over', 'settings-overlay', 'shop-overlay', 'confirm-overlay']
    .forEach(function (id) { _hideEl(id); });
};

// ── Static UI bindings (called once from constructor) ────────────────────────

Game.prototype._bindStaticUI = function () {
  var self = this;

  // Start screen mode buttons
  _btn('play-endless-btn',  function () { self._startGame('endless'); });
  _btn('play-daily-btn',    function () { self._startGame('daily'); });
  _btn('play-hardcore-btn', function () { self._startGame('hardcore'); });

  // Toolbar
  _btn('new-game-btn', function () { self._showStartScreen(); });
  _btn('mute-btn',     function () { self._toggleSound(); });
  _btn('music-btn',    function () { self._toggleMusic(); });
  _btn('menu-btn',     function () { self._showStartScreen(); });

  // Game-over actions
  _btn('replay-btn',       function () { self._startGame(self._mode); });
  _btn('menu-from-go-btn', function () { self._showStartScreen(); });

  // In-game settings overlay
  _btn('open-settings-btn', function () { self._showOverlay('settings-overlay'); });
  _btn('close-settings',    function () { self._hideOverlay('settings-overlay'); });

  // In-game shop overlay
  _btn('open-shop-btn', function () { self._openShop(); });
  _btn('close-shop',    function () { self._hideOverlay('shop-overlay'); });

  // Powerup buttons
  _btn('pp-bomb',    function () { self._activatePowerup('bomb_blast'); });
  _btn('pp-shuffle', function () { self._activatePowerup('shuffle'); });
  _btn('pp-undo',    function () { self._activatePowerup('undo'); });

  // Confirm powerup overlay
  _btn('confirm-yes', function () { self._onConfirmYes(); });
  _btn('confirm-no',  function () { self._onConfirmNo(); });

  // Settings checkboxes (in-game overlay)
  _onChange('st-sound', function (v) {
    Settings.setSoundOn(v);
    self._updateSoundBtn();
    if (!v) self.audio.stopMusic();
    else if (Settings.getMusicOn()) self.audio.startMusic();
  });
  _onChange('st-music', function (v) {
    Settings.setMusicOn(v);
    self._updateMusicBtn();
    if (v) self.audio.startMusic(); else self.audio.stopMusic();
  });
  _onChange('st-haptics',    function (v) { Settings.setHapticsOn(v); });
  _onChange('st-colorblind', function (v) {
    Settings.setColorblind(v);
    document.body.classList.toggle('colorblind', v);
  });
};

// ── Start screen ─────────────────────────────────────────────────────────────

Game.prototype._showStartScreen = function () {
  this._stopLoop();
  if (this.input) this.input.disable();
  this._updateStartScreen();
  this._showOverlay('start-screen');
};

Game.prototype._updateStartScreen = function () {
  _setText('start-hs-endless',  GameStorage.getHighScore('endless').toLocaleString());
  _setText('start-hs-daily',    GameStorage.getHighScore('daily').toLocaleString());
  _setText('start-hs-hardcore', GameStorage.getHighScore('hardcore').toLocaleString());
  _setText('start-dust', '\uD83D\uDCA8 ' + GameStorage.getDust().toLocaleString() + ' Wizard Dust');

  var info     = DailyChallenge.getStreakInfo();
  var streakEl = document.getElementById('start-streak');
  if (streakEl) {
    if (info.count > 0) {
      streakEl.textContent = '\uD83D\uDD25 ' + info.count + ' day streak';
      streakEl.classList.remove('hidden');
    } else {
      streakEl.classList.add('hidden');
    }
  }

  // Sync settings checkboxes
  _setChecked('st-sound',      Settings.getSoundOn());
  _setChecked('st-music',      Settings.getMusicOn());
  _setChecked('st-haptics',    Settings.getHapticsOn());
  _setChecked('st-colorblind', Settings.getColorblind());

  this._updateSoundBtn();
  this._updateMusicBtn();
};

// ── Game start / reset ───────────────────────────────────────────────────────

Game.prototype._startGame = function (mode) {
  this._mode  = mode;
  this._state = 'playing';
  this._selectedCell = null;

  this._hideOverlay('start-screen');
  this._hideOverlay('game-over');

  var isHardcore = (mode === 'hardcore');
  var isDaily    = (mode === 'daily');

  // ── Score & level managers ──────────────────────────────────────
  this.score  = new ScoreManager(mode);
  this.levels = new LevelManager(isHardcore);
  Powerups.init(isHardcore);

  var self = this;

  this.score.onScore = function (pts, total) {
    self._updateScoreDisplay();
    self.levels.checkLevelUp(total);
  };

  this.score.onCombo = function (combo, msg) {
    if (msg && msg.msg) self._showComboMsg(msg.msg, msg.color);
  };

  this.score.onHighScore = function () {
    self.audio.playHighScore();
    self._flashBanner('new-high-banner');
  };

  this.levels.onLevelUp = function (lvl) {
    self.score.onLevelUp();
    self.audio.playLevelUp();
    self._flashLevelUp(lvl);
    self._updateScoreDisplay();
  };

  // ── Board ───────────────────────────────────────────────────────
  if (isDaily) {
    this.board = DailyChallenge.withSeededRng(function () { return new Board(); });
  } else {
    this.board = new Board();
  }

  // ── Resolve canvas reference once ──────────────────────────────
  if (!this.canvas) {
    this.canvas = document.getElementById('game-canvas');
  }

  // ── Renderer (create once, update board ref on subsequent runs) ─
  if (!this.renderer) {
    this.renderer = new Renderer(this.canvas, this.board, this.particles);
  } else {
    this.renderer.board     = this.board;
    this.renderer.particles = this.particles;
    this.renderer.resize();
  }

  // ── Input (create once; reuse to avoid duplicate listeners) ─────
  if (!this.input) {
    this.input = new InputHandler(this.canvas, this.renderer);
  }
  this.input.onCellTap = function (r, c) { self._onCellTap(r, c); };
  this.input.enable();

  // ── UI state ───────────────────────────────────────────────────
  this.renderer.selectedCell = null;
  this.particles.clear();

  this._updateScoreDisplay();
  this._updatePowerupBar();

  var MODE_LABELS = { endless: '\u267E\uFE0F Endless', daily: '\uD83D\uDCC5 Daily', hardcore: '\uD83D\uDC80 Hardcore' };
  _setText('mode-label', MODE_LABELS[mode] || '');
  _hideEl('pp-aim-hint');

  // Music
  if (Settings.getMusicOn()) this.audio.startMusic();

  // Daily completion check
  if (isDaily && DailyChallenge.isDailyCompleted()) {
    this._flashBanner('daily-banner', '\uD83D\uDCC5 Daily Already Completed!');
  }

  this._startLoop();
};

// ── Game loop ────────────────────────────────────────────────────────────────

Game.prototype._startLoop = function () {
  this._stopLoop();
  this._lastTime = performance.now();
  var self = this;
  var tick = function (now) {
    var dt = Math.min((now - self._lastTime) / 1000, 0.1);
    self._lastTime = now;
    self._update(dt);
    self._animId = requestAnimationFrame(tick);
  };
  this._animId = requestAnimationFrame(tick);
};

Game.prototype._stopLoop = function () {
  if (this._animId) {
    cancelAnimationFrame(this._animId);
    this._animId = null;
  }
};

Game.prototype._update = function (dt) {
  if (this.score) this.score.tick();
  this.particles.update(dt);
  if (this.renderer) this.renderer.render(dt);
};

// ── Input / cell tap ─────────────────────────────────────────────────────────

Game.prototype._onCellTap = function (r, c) {
  if (this._state !== 'playing') return;

  // Bomb-blast targeting mode
  if (Powerups.targeting) {
    this._doBombBlast(r, c);
    return;
  }

  var block = this.board.get(r, c);
  if (!block || !block.canMove()) {
    this.audio.playDenied();
    return;
  }

  if (!this._selectedCell) {
    // First tap: select cell
    this._selectedCell = { r: r, c: c };
    this.renderer.selectedCell = { r: r, c: c };
    this.renderer.animatePulse(r, c);
    this.audio.playSelect();
  } else {
    var sel = this._selectedCell;
    this._selectedCell = null;
    this.renderer.selectedCell = null;

    if (sel.r === r && sel.c === c) {
      // Tapped same cell — deselect
      return;
    }

    if (this.board.isAdjacent(sel.r, sel.c, r, c)) {
      this._attemptSwap(sel.r, sel.c, r, c);
    } else {
      // Not adjacent — re-select new cell
      this._selectedCell = { r: r, c: c };
      this.renderer.selectedCell = { r: r, c: c };
      this.renderer.animatePulse(r, c);
      this.audio.playSelect();
    }
  }
};

// ── Swap & match cascade ─────────────────────────────────────────────────────

Game.prototype._attemptSwap = function (r1, c1, r2, c2) {
  this._state = 'animating';
  this.input.disable();

  // Save pre-swap state so Undo can restore it
  Powerups.saveUndoState(this.board.grid);

  if (!this.board.swap(r1, c1, r2, c2)) {
    Powerups.popUndoState(); // discard — invalid move
    this._state = 'playing';
    this.input.enable();
    return;
  }

  var self = this;
  this.renderer.animateSwap(r1, c1, r2, c2).then(function () {
    var groups = self.board.findMatches();
    if (groups.length === 0) {
      // No match — reverse the swap
      Powerups.popUndoState(); // discard — failed swap
      self.board.swap(r2, c2, r1, c1);
      self.renderer.animateSwap(r2, c2, r1, c1).then(function () {
        self.audio.playDenied();
        self._state = 'playing';
        self.input.enable();
      });
    } else {
      self.score.resetChain();
      self._processCascade(groups);
    }
  });
};

Game.prototype._processCascade = function (groups) {
  this._state = 'animating';
  var self  = this;
  var chain = this.score.chain;

  // Score each match group and emit particles
  for (var gi = 0; gi < groups.length; gi++) {
    var g      = groups[gi];
    var sample = this.board.get(g[0].r, g[0].c);
    var pts    = this.score.addMatchPoints(g.length, chain, this.levels.level);
    var pos    = this.renderer.cellCenter(g[0].r, g[0].c);

    if (sample && sample.type === BlockType.BOMB) {
      this.particles.emitBomb(pos.x, pos.y);
      this.audio.playBomb();
    } else if (sample && sample.type === BlockType.RAINBOW) {
      this.particles.emitRainbow(pos.x, pos.y);
      this.audio.playMatch(g.length);
    } else {
      var color = (sample && sample.color) ? sample.color : '#FDCB6E';
      this.particles.emit(pos.x, pos.y, [color], 10);
      this.audio.playMatch(g.length);
    }
    this.renderer.addFloatText('+' + pts, pos.x, pos.y - 20, '#FDCB6E', 18);
  }

  if (groups.length > 1) {
    this.audio.playCombo(this.score.combo);
    this.renderer.triggerShake(4, 0.2, groups.length);
  }

  // Mark matches (handles bomb explosions and NUMBER merges)
  var cells     = this.board.markMatches(groups);
  var speedMul  = this.levels.getConfig().speedMul;

  this.renderer.animateClear(cells, 0.25)
    .then(function () {
      self.board.removeMatched();
      self.score.nextChain();
      var moves = self.board.applyGravity();
      return self.renderer.animateFall(moves, speedMul);
    })
    .then(function () {
      var cfg     = self.levels.getConfig();
      var spawned = self.board.fillEmpty(cfg.colorPool, cfg);
      return self.renderer.animateSpawn(spawned, cfg.speedMul);
    })
    .then(function () {
      var nextGroups = self.board.findMatches();
      if (nextGroups.length > 0) {
        if (self.score.chain > 0) self.audio.playCascade(self.score.chain);
        self._processCascade(nextGroups);
      } else {
        self.score.resetChain();
        self._checkValidMoves();
      }
    });
};

Game.prototype._checkValidMoves = function () {
  if (!this.board.hasValidMoves()) {
    var cfg      = this.levels.getConfig();
    var attempts = 0;
    while (!this.board.hasValidMoves() && attempts < 5) {
      this.board.shuffleTop(cfg.colorPool);
      attempts++;
    }
    if (!this.board.hasValidMoves()) {
      this._gameOver();
      return;
    }
  }
  this._state = 'playing';
  this.input.enable();
  this._updateScoreDisplay();
  this._updatePowerupBar();
};

// ── Game over ────────────────────────────────────────────────────────────────

Game.prototype._gameOver = function () {
  this._state = 'gameover';
  this.input.disable();
  this.audio.playGameOver();
  this.audio.stopMusic();

  var finalScore = this.score.score;
  var dustEarned = this.score.commitDust(false);
  var rank       = Leaderboard.addMatchEntry(this._mode, finalScore, this.levels.level);

  if (this._mode === 'daily') DailyChallenge.completeDaily();

  _setText('final-score',  finalScore.toLocaleString());
  _setText('final-high',   GameStorage.getHighScore(this._mode).toLocaleString());
  _setText('final-dust',   '+' + dustEarned + ' \uD83D\uDCA8');
  _setText('game-over-msg', Unlocks.getGameOverMsg());

  var rankEl = document.getElementById('final-rank');
  if (rankEl) {
    if (rank > 0) {
      rankEl.textContent = rank === 1 ? '\uD83E\uDD47 #1 All Time!' : '#' + rank + ' on Leaderboard';
      rankEl.classList.remove('hidden');
    } else {
      rankEl.classList.add('hidden');
    }
  }

  var lbEl = document.getElementById('lb-entries');
  if (lbEl) Leaderboard.renderInto(lbEl, this._mode, rank);

  var replayBtn = document.getElementById('replay-btn');
  if (replayBtn) {
    if (this._mode === 'daily' && DailyChallenge.isDailyCompleted()) {
      replayBtn.disabled = true;
      replayBtn.textContent = '\uD83D\uDCC5 Already done today';
    } else {
      replayBtn.disabled = false;
      replayBtn.textContent = '\uD83D\uDD04 Play Again';
    }
  }

  this._showOverlay('game-over');
  this._updateStartScreen(); // refresh dust / high scores for when player returns
};

// ── Powerups ─────────────────────────────────────────────────────────────────

Game.prototype._activatePowerup = function (id) {
  if (this._state !== 'playing') return;
  if (!Powerups.canUse(id)) {
    this.audio.playDenied();
    return;
  }

  var def  = Powerups.getDef(id);
  var self = this;

  if (id === 'bomb_blast') {
    Powerups.targeting = true;
    Powerups.pendingId = id;
    _showEl('pp-aim-hint');
    // Canvas input stays enabled so the player can tap the target cell
    return;
  }

  if (id === 'shuffle') {
    this._confirmPowerup(def, function () {
      Powerups.use('shuffle');
      var cfg = self.levels.getConfig();
      self.board._init();
      self.audio.playPowerup();
      self.particles.emitPowerup(
        self.renderer.canvas.clientWidth  / 2,
        self.renderer.canvas.clientHeight / 2,
        '#1E90FF'
      );
      self._updatePowerupBar();
    });
    return;
  }

  if (id === 'undo') {
    this._confirmPowerup(def, function () {
      var grid = Powerups.popUndoState();
      if (!grid) return;
      Powerups.use('undo');
      self.board.grid = grid;
      self.audio.playPowerup();
      self.particles.emitPowerup(
        self.renderer.canvas.clientWidth  / 2,
        self.renderer.canvas.clientHeight / 2,
        '#2ED573'
      );
      self._updatePowerupBar();
    });
  }
};

Game.prototype._doBombBlast = function (r, c) {
  Powerups.targeting = false;
  Powerups.pendingId = null;
  _hideEl('pp-aim-hint');
  Powerups.use('bomb_blast');

  this._state = 'animating';
  this.input.disable();

  var cells = [];
  for (var dr = -1; dr <= 1; dr++) {
    for (var dc = -1; dc <= 1; dc++) {
      var nr = r + dr, nc = c + dc;
      if (this.board.inBounds(nr, nc)) {
        var block = this.board.get(nr, nc);
        if (block && block.type !== BlockType.BLOCKER) {
          block.matched = true;
          cells.push({ r: nr, c: nc, block: block });
        }
      }
    }
  }

  var pos  = this.renderer.cellCenter(r, c);
  this.particles.emitBomb(pos.x, pos.y);
  this.audio.playBomb();

  var self = this;
  this.renderer.animateClear(cells)
    .then(function () {
      self.board.removeMatched();
      var moves = self.board.applyGravity();
      return self.renderer.animateFall(moves, 1);
    })
    .then(function () {
      var cfg     = self.levels.getConfig();
      var spawned = self.board.fillEmpty(cfg.colorPool, cfg);
      return self.renderer.animateSpawn(spawned, 1);
    })
    .then(function () {
      var nextGroups = self.board.findMatches();
      if (nextGroups.length > 0) {
        self.score.resetChain();
        self._processCascade(nextGroups);
      } else {
        self._checkValidMoves();
      }
    });

  this._updatePowerupBar();
};

Game.prototype._confirmPowerup = function (def, onYes) {
  this._pendingConfirmAction = onYes;
  _setText('confirm-msg', 'Use ' + def.emoji + ' ' + def.name + '? ' + def.description);
  this.input.disable();
  this._showOverlay('confirm-overlay');
};

Game.prototype._onConfirmYes = function () {
  this._hideOverlay('confirm-overlay');
  if (this.input) this.input.enable();
  if (typeof this._pendingConfirmAction === 'function') {
    this._pendingConfirmAction();
    this._pendingConfirmAction = null;
  }
};

Game.prototype._onConfirmNo = function () {
  this._hideOverlay('confirm-overlay');
  this._pendingConfirmAction = null;
  if (this.input) this.input.enable();
};

// ── UI display updates ───────────────────────────────────────────────────────

Game.prototype._updateScoreDisplay = function () {
  if (!this.score) return;
  _setText('score',       this.score.score.toLocaleString());
  _setText('high-score',  this.score.highScore.toLocaleString());
  _setText('level',       this.levels ? this.levels.level : 1);
  _setText('header-dust', '\uD83D\uDCA8 ' + GameStorage.getDust().toLocaleString());
};

Game.prototype._updatePowerupBar = function () {
  var self = this;
  var map  = { bomb_blast: 'pp-bomb', shuffle: 'pp-shuffle', undo: 'pp-undo' };
  Powerups.getDefs().forEach(function (def) {
    var btn = document.getElementById(map[def.id]);
    if (!btn) return;
    var charges  = Powerups.getCharges(def.id);
    var chargeEl = btn.querySelector('.pp-charge');
    if (chargeEl) chargeEl.textContent = charges;
    btn.disabled = (charges === 0);
    btn.classList.toggle('pp-empty', charges === 0);
  });
};

Game.prototype._updateSoundBtn = function () {
  var btn = document.getElementById('mute-btn');
  if (btn) btn.textContent = Settings.getSoundOn() ? '\uD83D\uDD0A' : '\uD83D\uDD07';
};

Game.prototype._updateMusicBtn = function () {
  var btn = document.getElementById('music-btn');
  if (btn) btn.textContent = Settings.getMusicOn() ? '\uD83C\uDFB5' : '\uD83C\uDFB6';
};

Game.prototype._toggleSound = function () {
  this.audio.toggleSound();
  this._updateSoundBtn();
};

Game.prototype._toggleMusic = function () {
  this.audio.toggleMusic();
  this._updateMusicBtn();
};

Game.prototype._showComboMsg = function (msg, color) {
  var el = document.getElementById('combo-msg');
  if (el) {
    el.textContent  = msg;
    el.style.color  = color || '#FDCB6E';
  }
  var self = this;
  if (this._comboMsgTimer) clearTimeout(this._comboMsgTimer);
  this._comboMsgTimer = setTimeout(function () {
    var e = document.getElementById('combo-msg');
    if (e) e.textContent = '';
  }, 1500);
};

Game.prototype._flashBanner = function (id, text) {
  var el = document.getElementById(id);
  if (!el) return;
  if (text) el.textContent = text;
  el.classList.remove('hidden');
  setTimeout(function () { el.classList.add('hidden'); }, 3000);
};

Game.prototype._flashLevelUp = function (level) {
  var el = document.getElementById('level-up');
  if (!el) return;
  el.textContent = '\uD83C\uDD99 Level ' + level + '!';
  el.classList.remove('hidden');
  setTimeout(function () { el.classList.add('hidden'); }, 2000);
};

Game.prototype._showOverlay = function (id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
};

Game.prototype._hideOverlay = function (id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('hidden');
};

// ── In-game shop overlay ─────────────────────────────────────────────────────

Game.prototype._openShop = function () {
  this._renderShopOverlay('theme');
  this._showOverlay('shop-overlay');
};

Game.prototype._renderShopOverlay = function (activeTab) {
  var self     = this;
  activeTab    = activeTab || 'theme';
  var dustEl   = document.getElementById('shop-dust');
  var tabsEl   = document.getElementById('shop-tabs');
  var itemsEl  = document.getElementById('shop-items');
  if (!tabsEl || !itemsEl) return;

  if (dustEl) dustEl.textContent = '\uD83D\uDCA8 ' + GameStorage.getDust().toLocaleString() + ' Wizard Dust';

  var categories = [
    { id: 'theme',     label: '\uD83C\uDFA8 Themes',    items: Unlocks.getAllThemes() },
    { id: 'particles', label: '\u2728 Particles',        items: Unlocks.getAllParticleStyles() },
    { id: 'announcer', label: '\uD83C\uDFA4 Announcer',  items: Unlocks.getAllAnnouncers() },
  ];

  var renderItems = function (cat) {
    var equipped = GameStorage.getEquipped();
    var rows = cat.items.map(function (item) {
      var owned   = GameStorage.isUnlocked(item.id);
      var isEquip = equipped[cat.id] === item.id;
      return '<div class="shop-item' + (owned ? ' owned' : '') + (isEquip ? ' equipped' : '') + '" ' +
        'data-id="' + item.id + '" data-category="' + cat.id + '" data-cost="' + (item.cost || 0) + '">' +
        '<span class="shop-item-icon">' + item.emoji + '</span>' +
        '<span class="shop-item-name">' + item.name + '</span>' +
        '<span class="shop-item-desc">' + item.description + '</span>' +
        '<span class="shop-item-cost">' + (isEquip ? '\u2705 On' : (owned ? 'Equip \u2196' : '\uD83D\uDCA8 ' + item.cost)) + '</span>' +
        '</div>';
    }).join('');
    itemsEl.innerHTML = rows;

    itemsEl.querySelectorAll('.shop-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var id   = el.dataset.id;
        var cat2 = el.dataset.category;
        if (!GameStorage.isUnlocked(id)) {
          var result = Unlocks.purchase(id);
          if (!result.success) {
            el.classList.add('shop-item-shake');
            setTimeout(function () { el.classList.remove('shop-item-shake'); }, 400);
            return;
          }
        }
        Unlocks.equip(cat2, id);
        Unlocks.applyEquippedTheme();
        if (dustEl) dustEl.textContent = '\uD83D\uDCA8 ' + GameStorage.getDust().toLocaleString() + ' Wizard Dust';
        self._renderShopOverlay(activeTab);
      });
    });
  };

  tabsEl.innerHTML = categories.map(function (c) {
    return '<button class="shop-tab' + (c.id === activeTab ? ' active' : '') + '" data-cat="' + c.id + '">' + c.label + '</button>';
  }).join('');

  tabsEl.querySelectorAll('.shop-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeTab = btn.dataset.cat;
      tabsEl.querySelectorAll('.shop-tab').forEach(function (b) {
        b.classList.toggle('active', b.dataset.cat === activeTab);
      });
      var found = categories.filter(function (c) { return c.id === activeTab; })[0];
      if (found) renderItems(found);
    });
  });

  var found = categories.filter(function (c) { return c.id === activeTab; })[0];
  if (found) renderItems(found);
};

// ── Public utility (can be called externally) ────────────────────────────────

function startMatch3Game(mode) {
  if (window._game) {
    window._game._startGame(mode || 'endless');
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

function initMatch3Game() {
  if (!window._game) {
    try {
      window._game = new Game();
    } catch (e) {
      console.error('[PuzzleHub] Failed to init match-3 engine:', e);
    }
  }
  return window._game;
}

