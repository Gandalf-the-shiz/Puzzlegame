/**
 * mahjong.js — Mahjong Solitaire mode
 *
 * Classic tile-matching solitaire:
 *   - Tiles removable when free on left/right and not covered.
 *   - Match identical tiles to remove them.
 *   - Seeded shuffling, 2 layouts (Turtle, Bridge).
 *   - Hint button, time + move tracking.
 */

'use strict';

const MahjongMode = (() => {
  const MODE_ID = 'mahjong';

  // ── Tile types (pairs) ───────────────────────────────────────────
  // We use 36 distinct values × 2 = 72 tiles for a typical layout.
  // Simpler: 18 pairs × 2 = 36 tiles for the Turtle layout.
  const TILE_TYPES = [
    '🀇','🀈','🀉','🀊','🀋','🀌','🀍','🀎','🀏',  // Man (1-9)
    '🀙','🀚','🀛','🀜','🀝','🀞','🀟','🀠','🀡',  // Pin (1-9)
    '🀐','🀑','🀒','🀓','🀔','🀕','🀖','🀗','🀘',  // Sou (1-9)
    '🀀','🀁','🀂','🀃',                             // Winds
    '🀄','🀅','🀆',                                  // Dragons
  ];

  // ── Layout definitions (layer, row, col for each tile) ──────────
  // TURTLE layout: 36 tiles in a turtle shape.
  // Each entry: [layer, row, col]  (layer 0 = bottom)
  const TURTLE_LAYOUT = [
    // Layer 0 — body rows
    [0,0,2],[0,0,3],[0,0,4],[0,0,5],
    [0,1,1],[0,1,2],[0,1,3],[0,1,4],[0,1,5],[0,1,6],
    [0,2,0],[0,2,1],[0,2,2],[0,2,3],[0,2,4],[0,2,5],[0,2,6],[0,2,7],
    [0,3,0],[0,3,1],[0,3,2],[0,3,3],[0,3,4],[0,3,5],[0,3,6],[0,3,7],
    [0,4,1],[0,4,2],[0,4,3],[0,4,4],[0,4,5],[0,4,6],
    [0,5,2],[0,5,3],[0,5,4],[0,5,5],
    // Layer 1 — shell
    [1,1,2],[1,1,3],[1,1,4],[1,1,5],
    [1,2,2],[1,2,3],[1,2,4],[1,2,5],
    [1,3,2],[1,3,3],[1,3,4],[1,3,5],
    [1,4,2],[1,4,3],[1,4,4],[1,4,5],
    // Layer 2 — top
    [2,2,3],[2,2,4],
    [2,3,3],[2,3,4],
    // Extra head + tail
    [0,2,8],[0,3,8],   // tail
    [0,2,-1],[0,3,-1], // head
  ];

  // Bridge layout: simpler 36-tile layout
  const BRIDGE_LAYOUT = [
    [0,0,0],[0,0,1],[0,0,2],[0,0,3],[0,0,4],[0,0,5],[0,0,6],[0,0,7],
    [0,1,0],[0,1,1],[0,1,2],[0,1,3],[0,1,4],[0,1,5],[0,1,6],[0,1,7],
    [0,2,0],[0,2,1],[0,2,2],[0,2,3],[0,2,4],[0,2,5],[0,2,6],[0,2,7],
    [0,3,0],[0,3,1],[0,3,2],[0,3,3],[0,3,4],[0,3,5],[0,3,6],[0,3,7],
    [1,0,1],[1,0,2],[1,0,3],[1,0,4],[1,0,5],[1,0,6],
    [1,1,1],[1,1,2],[1,1,3],[1,1,4],[1,1,5],[1,1,6],
    [2,0,2],[2,0,3],[2,0,4],[2,0,5],
    [2,1,2],[2,1,3],[2,1,4],[2,1,5],
    [3,0,3],[3,0,4],
  ];

  let _root      = null;
  let _ctx       = null;
  let _tiles     = [];      // { id, type, layer, row, col, removed }
  let _selected  = null;    // tile id
  let _hintIds   = [];      // ids of hint-highlighted tiles
  let _moves     = 0;
  let _startTime = 0;
  let _elapsed   = 0;
  let _timerInt  = null;
  let _over      = false;
  let _won       = false;
  let _isDaily   = false;
  let _dustEarned = 0;
  let _layoutName = 'turtle';

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
    _isDaily    = !!opts.daily;
    _layoutName = opts.layout || 'turtle';
    _selected   = null;
    _hintIds    = [];
    _moves      = 0;
    _elapsed    = 0;
    _over       = false;
    _won        = false;
    _dustEarned = 0;
    _stopTimer();

    const seed = opts.seed != null ? opts.seed
      : Daily.seedForDate(Daily.todayStr(), MODE_ID);

    const layout = _layoutName === 'bridge' ? BRIDGE_LAYOUT : TURTLE_LAYOUT;
    _tiles = _buildTiles(layout, seed);
    _startTime = Date.now();
    _startTimer();
    _renderBoard();

    const resultEl = _root && _root.querySelector('#mj-result');
    if (resultEl) resultEl.innerHTML = '';
  }

  // ── Tile building ────────────────────────────────────────────────

  function _buildTiles(layout, seed) {
    const rng = Daily.seededRng(seed);
    const n   = layout.length;

    // Build pairs of types
    const types = [];
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const t = TILE_TYPES[i % TILE_TYPES.length];
      types.push(t, t);
    }
    if (types.length < n) types.push(TILE_TYPES[0]);

    // Shuffle types
    const shuffled = Daily.seededShuffle(types.slice(0, n), rng);

    return layout.map((pos, i) => ({
      id:      i,
      type:    shuffled[i],
      layer:   pos[0],
      row:     pos[1],
      col:     pos[2],
      removed: false,
    }));
  }

  // ── Free tile detection ──────────────────────────────────────────

  function _isFree(tile) {
    if (tile.removed) return false;

    // Covered? Any tile on layer+1 overlapping this position
    const covered = _tiles.some(t =>
      !t.removed &&
      t.id !== tile.id &&
      t.layer === tile.layer + 1 &&
      Math.abs(t.row - tile.row) < 1 &&
      Math.abs(t.col - tile.col) < 1
    );
    if (covered) return false;

    // Blocked left AND right?
    const blockedLeft = _tiles.some(t =>
      !t.removed &&
      t.id !== tile.id &&
      t.layer === tile.layer &&
      t.row === tile.row &&
      t.col === tile.col - 1
    );
    const blockedRight = _tiles.some(t =>
      !t.removed &&
      t.id !== tile.id &&
      t.layer === tile.layer &&
      t.row === tile.row &&
      t.col === tile.col + 1
    );

    return !(blockedLeft && blockedRight);
  }

  function _getFreeTiles() {
    return _tiles.filter(t => !t.removed && _isFree(t));
  }

  function _findHint() {
    const free = _getFreeTiles();
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (free[i].type === free[j].type) return [free[i].id, free[j].id];
      }
    }
    return null;
  }

  // ── Rendering ───────────────────────────────────────────────────

  function _render() {
    _root.innerHTML = `
      <div class="mj-wrap">
        <div class="mode-header">
          <button class="btn btn-secondary btn-sm" id="mj-back">← Hub</button>
          <h2 class="mode-title">Mahjong</h2>
          <div class="mj-info">
            <span id="mj-tiles-left">🀄 0</span>
            <span id="mj-timer">⏱ 0s</span>
          </div>
        </div>

        <div class="mj-layout-btns">
          <button class="btn btn-sm btn-secondary mj-layout-btn" data-l="turtle">🐢 Turtle</button>
          <button class="btn btn-sm btn-secondary mj-layout-btn" data-l="bridge">🌉 Bridge</button>
        </div>

        <div class="mj-toolbar">
          <button class="btn btn-sm btn-secondary" id="mj-hint">💡 Hint</button>
          <button class="btn btn-sm btn-secondary" id="mj-reset">🔄 New</button>
        </div>

        <div class="mj-board-wrap">
          <div class="mj-board" id="mj-board"></div>
        </div>
        <div id="mj-result" class="mj-result"></div>
      </div>`;

    _root.querySelector('#mj-back').addEventListener('click', () => {
      if (_ctx && _ctx.goHub) _ctx.goHub();
    });
    _root.querySelector('#mj-hint').addEventListener('click', _showHint);
    _root.querySelector('#mj-reset').addEventListener('click', () => start({ daily: _isDaily, layout: _layoutName }));

    _root.querySelectorAll('.mj-layout-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _layoutName = btn.dataset.l;
        start({ daily: _isDaily, layout: _layoutName });
      });
    });
  }

  function _renderBoard() {
    const board = _root && _root.querySelector('#mj-board');
    if (!board) return;
    board.innerHTML = '';

    // Compute bounds
    const activeTiles = _tiles.filter(t => !t.removed);
    if (!activeTiles.length) return;

    const TILE_W = 44, TILE_H = 58, LAYER_OFFSET = 4;

    const minCol = Math.min(..._tiles.map(t => t.col));
    const minRow = Math.min(..._tiles.map(t => t.row));

    let hintIds = _hintIds;

    activeTiles.forEach(tile => {
      const free = _isFree(tile);
      const el   = document.createElement('button');
      el.className = 'mj-tile' +
        (!free ? ' mj-blocked' : '') +
        (tile.id === _selected ? ' mj-selected' : '') +
        (hintIds.includes(tile.id) ? ' mj-hint' : '');

      const x = (tile.col - minCol) * (TILE_W / 2) + tile.layer * LAYER_OFFSET;
      const y = (tile.row - minRow) * (TILE_H / 2) + tile.layer * LAYER_OFFSET;

      el.style.left   = x + 'px';
      el.style.top    = y + 'px';
      el.style.zIndex = tile.layer * 10 + (free ? 1 : 0);
      el.textContent  = tile.type;
      el.title        = free ? 'Click to select' : 'Blocked';

      if (free) el.addEventListener('click', () => _handleTileTap(tile.id));

      board.appendChild(el);
    });

    // Set board size
    const allCols = _tiles.map(t => (t.col - minCol) * (TILE_W / 2) + t.layer * LAYER_OFFSET + TILE_W);
    const allRows = _tiles.map(t => (t.row - minRow) * (TILE_H / 2) + t.layer * LAYER_OFFSET + TILE_H);
    board.style.width  = Math.max(...allCols) + 'px';
    board.style.height = Math.max(...allRows) + 'px';

    // Update info
    const left = _root.querySelector('#mj-tiles-left');
    if (left) left.textContent = `🀄 ${activeTiles.length}`;

    // Update layout buttons
    _root.querySelectorAll('.mj-layout-btn').forEach(btn => {
      btn.classList.toggle('btn-primary', btn.dataset.l === _layoutName);
      btn.classList.toggle('btn-secondary', btn.dataset.l !== _layoutName);
    });
  }

  function _showHintMessage(msg) {
    const result = _root && _root.querySelector('#mj-result');
    if (!result) return;
    result.innerHTML = `<span style="color:#f87171;font-size:13px">${msg}</span>`;
    setTimeout(() => { if (result) result.innerHTML = ''; }, 2000);
  }

  // ── Interaction ─────────────────────────────────────────────────

  function _handleTileTap(id) {
    if (_over) return;
    _hintIds = []; // clear hint on any tap
    const tile = _tiles.find(t => t.id === id);
    if (!tile || !_isFree(tile)) return;

    if (_selected === null) {
      _selected = id;
      Settings.hapticPulse(10);
    } else if (_selected === id) {
      _selected = null;
    } else {
      const selTile = _tiles.find(t => t.id === _selected);
      if (selTile && selTile.type === tile.type) {
        // Match!
        selTile.removed = true;
        tile.removed    = true;
        _selected = null;
        _moves++;
        Settings.hapticPulse(30);

        const remaining = _tiles.filter(t => !t.removed).length;
        if (remaining === 0) {
          _onComplete(true);
        } else if (!_findHint()) {
          // No valid moves
          setTimeout(() => _onComplete(false), 400);
        }
      } else {
        _selected = id;
      }
    }
    _renderBoard();
  }

  function _showHint() {
    const pair = _findHint();
    if (!pair) {
      _showHintMessage('No moves available!');
      return;
    }
    _hintIds = pair;
    _renderBoard();
    // Clear hint after 2 seconds
    setTimeout(() => { _hintIds = []; _renderBoard(); }, 2000);
  }

  // ── Completion ───────────────────────────────────────────────────

  function _onComplete(won) {
    _over = true;
    _won  = won;
    _stopTimer();
    Settings.hapticPulse(won ? 80 : 200);

    const pairsRemoved = _tiles.filter(t => t.removed).length / 2;
    _dustEarned = Economy.rewardMahjong(Math.floor(pairsRemoved), won, _isDaily, won && _isDaily);

    let streakResult = null;
    if (_isDaily && won) {
      streakResult = Daily.recordDailyCompletion(MODE_ID);
    }

    const result = _root && _root.querySelector('#mj-result');
    if (result) {
      result.innerHTML = `
        <div class="result-card ${won ? 'success' : 'fail'}">
          <div class="result-title">${won ? '🎉 Victory!' : '😞 No More Moves'}</div>
          <div class="result-time">Time: ${_elapsed}s | Moves: ${_moves}</div>
          <div class="result-dust">+${_dustEarned} ✨ Wizard Dust</div>
          ${streakResult ? `<div class="result-streak">🔥 Streak: ${streakResult.streak} days</div>` : ''}
          <button class="btn btn-primary" id="mj-retry">🔄 New Game</button>
        </div>`;
      result.querySelector('#mj-retry').addEventListener('click', () => start({ daily: _isDaily, layout: _layoutName }));
    }

    Leaderboard.addEntry(MODE_ID, { score: won ? Math.max(5000 - _elapsed * 5 - _moves * 2, 100) : 0, time: _elapsed });
    if (_ctx && _ctx.onModeComplete) {
      _ctx.onModeComplete({ modeId: MODE_ID, score: _moves, dustEarned: _dustEarned });
    }
  }

  // ── Timer ────────────────────────────────────────────────────────

  function _startTimer() {
    _timerInt = setInterval(() => {
      _elapsed = Math.floor((Date.now() - _startTime) / 1000);
      const t = _root && _root.querySelector('#mj-timer');
      if (t) t.textContent = `⏱ ${_elapsed}s`;
    }, 1000);
  }

  function _stopTimer() {
    if (_timerInt) { clearInterval(_timerInt); _timerInt = null; }
  }

  return { id: MODE_ID, mount, unmount, start };
})();
