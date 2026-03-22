/**
 * minesweeper.js — Touch-friendly Minesweeper mode
 *
 * Reveal cells by tap; flag/unflag by long-press or toggle button.
 * Difficulties: Easy (8×8/10), Medium (9×9/16), Hard (10×10/20)
 * Daily seed option; time tracked.
 */

'use strict';

const MinesweeperMode = (() => {
  const MODE_ID = 'minesweeper';

  const DIFFICULTIES = {
    easy:   { cols: 8, rows: 8, mines: 10 },
    medium: { cols: 9, rows: 9, mines: 16 },
    hard:   { cols: 10, rows: 10, mines: 20 },
  };

  let _root    = null;
  let _ctx     = null;
  let _diff    = 'easy';
  let _cols    = 8;
  let _rows    = 8;
  let _mines   = 10;
  let _board   = [];   // flat array: { mine, revealed, flagged, adj }
  let _started = false;
  let _over    = false;
  let _won     = false;
  let _startTime = 0;
  let _elapsed   = 0;
  let _timerInt  = null;
  let _flagMode  = false;
  let _isDaily   = false;
  let _dustEarned = 0;
  let _seed      = 0;

  // ── Mount / Unmount ─────────────────────────────────────────────

  function mount(rootEl, ctx) {
    _root = rootEl;
    _ctx  = ctx;
    _render();
  }

  function unmount() {
    _stopTimer();
    if (_root) _root.innerHTML = '';
    _root = null;
  }

  // ── Start ───────────────────────────────────────────────────────

  function start(opts = {}) {
    _isDaily = !!opts.daily;
    _diff    = opts.difficulty || 'easy';
    const d  = DIFFICULTIES[_diff] || DIFFICULTIES.easy;
    _cols    = d.cols;
    _rows    = d.rows;
    _mines   = d.mines;
    _started = false;
    _over    = false;
    _won     = false;
    _elapsed = 0;
    _flagMode = false;
    _dustEarned = 0;
    _seed    = opts.seed != null ? opts.seed
      : Daily.seedForDate(Daily.todayStr(), MODE_ID + _diff);

    _board   = _createEmptyBoard();
    _stopTimer();
    _renderBoard();
    _root.querySelector('#ms-result') && (_root.querySelector('#ms-result').innerHTML = '');
  }

  // ── Board creation ───────────────────────────────────────────────

  function _createEmptyBoard() {
    return Array.from({ length: _rows * _cols }, () => ({
      mine: false, revealed: false, flagged: false, adj: 0,
    }));
  }

  function _placeMines(safeIdx) {
    // Place mines using seeded RNG, avoiding safeIdx and its neighbors
    const rng = Daily.seededRng(_seed + safeIdx);
    const safe = new Set(_neighbors(safeIdx).concat(safeIdx));
    let placed = 0;
    while (placed < _mines) {
      const idx = Math.floor(rng() * (_rows * _cols));
      if (!safe.has(idx) && !_board[idx].mine) {
        _board[idx].mine = true;
        placed++;
      }
    }
    // Calculate adjacency
    for (let i = 0; i < _board.length; i++) {
      if (!_board[i].mine) {
        _board[i].adj = _neighbors(i).filter(n => _board[n].mine).length;
      }
    }
  }

  function _neighbors(idx) {
    const r = Math.floor(idx / _cols);
    const c = idx % _cols;
    const result = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < _rows && nc >= 0 && nc < _cols) {
          result.push(nr * _cols + nc);
        }
      }
    }
    return result;
  }

  // ── Rendering ───────────────────────────────────────────────────

  function _render() {
    _root.innerHTML = `
      <div class="ms-wrap">
        <div class="mode-header">
          <button class="btn btn-secondary btn-sm" id="ms-back">← Hub</button>
          <h2 class="mode-title">Minesweeper</h2>
          <div class="ms-info">
            <span id="ms-mines-left">💣 0</span>
            <span id="ms-timer">⏱ 0s</span>
          </div>
        </div>

        <div class="ms-difficulty">
          <button class="btn btn-sm btn-secondary ms-diff-btn" data-d="easy">Easy</button>
          <button class="btn btn-sm btn-secondary ms-diff-btn" data-d="medium">Medium</button>
          <button class="btn btn-sm btn-secondary ms-diff-btn" data-d="hard">Hard</button>
        </div>

        <div class="ms-toolbar">
          <button class="btn btn-sm btn-secondary" id="ms-flag-toggle">🚩 Flag Mode</button>
          <button class="btn btn-sm btn-secondary" id="ms-reset">🔄 New</button>
        </div>

        <div class="ms-grid-wrap">
          <div class="ms-grid" id="ms-grid"></div>
        </div>
        <div id="ms-result" class="ms-result"></div>
      </div>`;

    _root.querySelector('#ms-back').addEventListener('click', () => {
      if (_ctx && _ctx.goHub) _ctx.goHub();
    });
    _root.querySelector('#ms-flag-toggle').addEventListener('click', _toggleFlagMode);
    _root.querySelector('#ms-reset').addEventListener('click', () => start({ daily: _isDaily, difficulty: _diff }));

    _root.querySelectorAll('.ms-diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _diff = btn.dataset.d;
        start({ daily: _isDaily, difficulty: _diff });
      });
    });

    _renderBoard();
  }

  function _renderBoard() {
    const grid = _root && _root.querySelector('#ms-grid');
    if (!grid) return;
    grid.style.gridTemplateColumns = `repeat(${_cols}, 1fr)`;
    grid.innerHTML = '';

    _board.forEach((cell, idx) => {
      const el = document.createElement('button');
      el.className = 'ms-cell';

      if (cell.revealed) {
        el.classList.add('ms-revealed');
        if (cell.mine) {
          el.textContent = '💣';
          el.classList.add('ms-mine-hit');
        } else if (cell.adj > 0) {
          el.textContent = cell.adj;
          el.classList.add('ms-adj-' + cell.adj);
        }
      } else if (cell.flagged) {
        el.textContent = '🚩';
        el.classList.add('ms-flagged');
      } else {
        el.classList.add('ms-hidden');
      }

      el.addEventListener('click', () => _handleTap(idx));
      // Long press for flag on mobile
      let pressTimer = null;
      el.addEventListener('pointerdown', () => {
        pressTimer = setTimeout(() => { pressTimer = null; _flagCell(idx); }, 400);
      });
      el.addEventListener('pointerup', () => { if (pressTimer) clearTimeout(pressTimer); });
      el.addEventListener('pointerleave', () => { if (pressTimer) clearTimeout(pressTimer); });

      grid.appendChild(el);
    });

    _updateInfo();

    // Highlight selected difficulty button
    _root.querySelectorAll('.ms-diff-btn').forEach(btn => {
      btn.classList.toggle('btn-primary', btn.dataset.d === _diff);
      btn.classList.toggle('btn-secondary', btn.dataset.d !== _diff);
    });

    // Update flag toggle btn
    const ft = _root.querySelector('#ms-flag-toggle');
    if (ft) ft.classList.toggle('btn-primary', _flagMode);
  }

  function _updateInfo() {
    const minesLeft = _root.querySelector('#ms-mines-left');
    if (minesLeft) {
      const flagged = _board.filter(c => c.flagged).length;
      minesLeft.textContent = `💣 ${Math.max(0, _mines - flagged)}`;
    }
    const timer = _root.querySelector('#ms-timer');
    if (timer) timer.textContent = `⏱ ${_elapsed}s`;
  }

  // ── Interaction ─────────────────────────────────────────────────

  function _handleTap(idx) {
    if (_over) return;
    const cell = _board[idx];
    if (cell.revealed) return;

    if (_flagMode) {
      _flagCell(idx);
      return;
    }

    if (cell.flagged) return;

    // First tap: place mines
    if (!_started) {
      _placeMines(idx);
      _started = true;
      _startTime = Date.now();
      _startTimer();
    }

    if (_board[idx].mine) {
      _board[idx].revealed = true;
      _gameOver(false);
      return;
    }

    _reveal(idx);
    _renderBoard();
    _checkWin();
    Settings.hapticPulse(5);
  }

  function _flagCell(idx) {
    if (_over) return;
    const cell = _board[idx];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    _renderBoard();
    Settings.hapticPulse(15);
  }

  function _toggleFlagMode() {
    _flagMode = !_flagMode;
    _renderBoard();
  }

  function _reveal(idx) {
    const cell = _board[idx];
    if (cell.revealed || cell.flagged || cell.mine) return;
    cell.revealed = true;
    if (cell.adj === 0) {
      _neighbors(idx).forEach(n => _reveal(n));
    }
  }

  function _checkWin() {
    const allSafeCellsRevealed = _board.every(c => c.mine || c.revealed);
    if (allSafeCellsRevealed) _gameOver(true);
  }

  function _gameOver(won) {
    _over = true;
    _won  = won;
    _stopTimer();

    // Reveal all mines on loss
    if (!won) {
      _board.forEach(c => { if (c.mine) c.revealed = true; });
      Settings.hapticPulse(200);
    } else {
      Settings.hapticPulse(50);
    }

    _renderBoard();

    const cellsRevealed = _board.filter(c => c.revealed && !c.mine).length;
    _dustEarned = Economy.rewardMinesweeper(cellsRevealed, won, _isDaily, won && _isDaily);

    let streakResult = null;
    if (_isDaily && won) {
      streakResult = Daily.recordDailyCompletion(MODE_ID);
    }

    const result = _root && _root.querySelector('#ms-result');
    if (result) {
      result.innerHTML = `
        <div class="result-card ${won ? 'success' : 'fail'}">
          <div class="result-title">${won ? '🎉 Cleared!' : '💥 Boom!'}</div>
          <div class="result-time">Time: ${_elapsed}s</div>
          <div class="result-dust">+${_dustEarned} ✨ Wizard Dust</div>
          ${streakResult ? `<div class="result-streak">🔥 Streak: ${streakResult.streak} days</div>` : ''}
          <button class="btn btn-primary" id="ms-retry">🔄 Play Again</button>
        </div>`;
      result.querySelector('#ms-retry').addEventListener('click', () => start({ daily: _isDaily, difficulty: _diff }));
    }

    Leaderboard.addEntry(MODE_ID, { score: won ? Math.max(1000 - _elapsed * 5, 100) : 0, time: _elapsed, label: _diff }, won ? 'time' : 'score');
    if (_ctx && _ctx.onModeComplete) {
      _ctx.onModeComplete({ modeId: MODE_ID, score: _elapsed, dustEarned: _dustEarned });
    }
  }

  // ── Timer ────────────────────────────────────────────────────────

  function _startTimer() {
    _timerInt = setInterval(() => {
      _elapsed = Math.floor((Date.now() - _startTime) / 1000);
      _updateInfo();
    }, 1000);
  }

  function _stopTimer() {
    if (_timerInt) { clearInterval(_timerInt); _timerInt = null; }
  }

  return { id: MODE_ID, mount, unmount, start };
})();
