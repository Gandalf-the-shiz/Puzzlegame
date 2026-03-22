/**
 * watersort.js — Water Sort / Color Sort puzzle mode
 *
 * Pour colored water between tubes to sort all colors.
 * Procedurally generated levels using seeded RNG.
 * Tap a tube to select it, tap another to pour.
 */

'use strict';

const WaterSortMode = (() => {
  const MODE_ID    = 'watersort';
  const TUBE_CAP   = 4;   // max units per tube
  const EMPTY_TUBES = 2;  // extra empty tubes per level

  let _root      = null;
  let _ctx       = null;
  let _tubes     = [];   // array of arrays (top-of-stack = last element)
  let _selected  = -1;
  let _colors    = [];
  let _numColors = 4;
  let _levelNum  = 1;
  let _history   = [];   // for undo
  let _over      = false;
  let _isDaily   = false;
  let _dustEarned = 0;

  const COLOR_PALETTE = [
    '#ef4444','#3b82f6','#22c55e','#f59e0b',
    '#a855f7','#ec4899','#06b6d4','#84cc16',
    '#f97316','#6366f1',
  ];

  // ── Mount / Unmount ─────────────────────────────────────────────

  function mount(rootEl, ctx) {
    _root = rootEl;
    _ctx  = ctx;
    _render();
  }

  function unmount() {
    if (_root) _root.innerHTML = '';
    _root = null;
  }

  // ── Start ───────────────────────────────────────────────────────

  function start(opts = {}) {
    _isDaily  = !!opts.daily;
    _levelNum = opts.level || 1;
    _over     = false;
    _selected = -1;
    _history  = [];
    _dustEarned = 0;
    _numColors = Math.min(3 + Math.floor(_levelNum * 0.5), COLOR_PALETTE.length);

    const seed = opts.seed != null ? opts.seed
      : Daily.seedForDate(Daily.todayStr(), MODE_ID) + _levelNum * 1000;

    _colors = COLOR_PALETTE.slice(0, _numColors);
    _tubes  = _generateLevel(seed);
    _renderBoard();
    const resultEl = _root && _root.querySelector('#ws-result');
    if (resultEl) resultEl.innerHTML = '';
  }

  // ── Level generation ─────────────────────────────────────────────

  function _generateLevel(seed) {
    const rng = Daily.seededRng(seed);
    // Create sorted state
    const filled = [];
    for (let c = 0; c < _numColors; c++) {
      const tube = [];
      for (let i = 0; i < TUBE_CAP; i++) tube.push(c);
      filled.push(tube);
    }
    // Add empty tubes
    for (let i = 0; i < EMPTY_TUBES; i++) filled.push([]);

    // Shuffle by doing valid random pours
    const totalTubes = filled.length;
    for (let iter = 0; iter < 200; iter++) {
      const from = Math.floor(rng() * totalTubes);
      const to   = Math.floor(rng() * totalTubes);
      if (from === to) continue;
      _pour(filled, from, to);
    }

    return filled;
  }

  // ── Pour logic ───────────────────────────────────────────────────

  function _pour(tubes, from, to) {
    const src  = tubes[from];
    const dst  = tubes[to];
    if (!src.length) return false;
    if (dst.length >= TUBE_CAP) return false;

    const topSrc = src[src.length - 1];
    if (dst.length > 0 && dst[dst.length - 1] !== topSrc) return false;

    // Count how many of the top color to pour
    let count = 0;
    for (let i = src.length - 1; i >= 0; i--) {
      if (src[i] === topSrc) count++;
      else break;
    }

    // How many fit?
    const space = TUBE_CAP - dst.length;
    const pour  = Math.min(count, space);
    if (pour === 0) return false;

    for (let i = 0; i < pour; i++) {
      dst.push(src.pop());
    }
    return true;
  }

  function _canPour(from, to) {
    const src = _tubes[from];
    const dst = _tubes[to];
    if (from === to) return false;
    if (!src.length) return false;
    if (dst.length >= TUBE_CAP) return false;
    if (dst.length > 0 && dst[dst.length - 1] !== src[src.length - 1]) return false;
    // Don't move if tube is already sorted (all same color and full)
    if (src.every(c => c === src[0]) && src.length === TUBE_CAP && (!dst.length)) {
      // This prevents moving already-complete tubes; optional
    }
    return true;
  }

  function _isSorted() {
    return _tubes.every(tube => {
      if (tube.length === 0) return true;
      if (tube.length !== TUBE_CAP) return false;
      return tube.every(c => c === tube[0]);
    });
  }

  // ── Rendering ───────────────────────────────────────────────────

  function _render() {
    _root.innerHTML = `
      <div class="ws-wrap">
        <div class="mode-header">
          <button class="btn btn-secondary btn-sm" id="ws-back">← Hub</button>
          <h2 class="mode-title">Water Sort</h2>
          <span id="ws-level-label" class="ws-level-label">Level 1</span>
        </div>
        <div class="ws-actions">
          <button class="btn btn-sm btn-secondary" id="ws-undo">↩ Undo</button>
          <button class="btn btn-sm btn-secondary" id="ws-reset">🔄 Reset</button>
        </div>
        <div class="ws-tubes" id="ws-tubes"></div>
        <div id="ws-result" class="ws-result"></div>
      </div>`;

    _root.querySelector('#ws-back').addEventListener('click', () => {
      if (_ctx && _ctx.goHub) _ctx.goHub();
    });
    _root.querySelector('#ws-undo').addEventListener('click', _undo);
    _root.querySelector('#ws-reset').addEventListener('click', () => start({ daily: _isDaily, level: _levelNum }));
  }

  function _renderBoard() {
    const tubesEl = _root && _root.querySelector('#ws-tubes');
    if (!tubesEl) return;
    tubesEl.innerHTML = '';

    const levelLabel = _root.querySelector('#ws-level-label');
    if (levelLabel) levelLabel.textContent = `Level ${_levelNum}`;

    _tubes.forEach((tube, ti) => {
      const wrap = document.createElement('div');
      wrap.className = 'ws-tube' + (ti === _selected ? ' ws-selected' : '');

      // Liquid segments (bottom-to-top)
      for (let i = 0; i < TUBE_CAP; i++) {
        const seg = document.createElement('div');
        seg.className = 'ws-segment';
        const colorIdx = tube[i];
        seg.style.background = colorIdx != null ? _colors[colorIdx] : 'transparent';
        // Round bottom corners for lowest segment
        if (i === 0) seg.style.borderRadius = '0 0 6px 6px';
        wrap.appendChild(seg);
      }

      // Tube container outline
      const outline = document.createElement('div');
      outline.className = 'ws-tube-outline';
      wrap.appendChild(outline);

      wrap.addEventListener('click', () => _handleTubeTap(ti));
      tubesEl.appendChild(wrap);
    });
  }

  function _handleTubeTap(ti) {
    if (_over) return;

    if (_selected === -1) {
      if (!_tubes[ti].length) return;
      _selected = ti;
    } else if (_selected === ti) {
      _selected = -1;
    } else {
      if (_canPour(_selected, ti)) {
        // Save undo state
        _history.push(_tubes.map(t => [...t]));
        _pour(_tubes, _selected, ti);
        _selected = -1;
        Settings.hapticPulse(10);

        if (_isSorted()) {
          _onComplete();
        }
      } else {
        _selected = ti;
      }
    }
    _renderBoard();
  }

  function _undo() {
    if (!_history.length) return;
    _tubes    = _history.pop();
    _selected = -1;
    _renderBoard();
  }

  // ── Completion ───────────────────────────────────────────────────

  function _onComplete() {
    _over = true;
    Settings.hapticPulse(80);
    _dustEarned = Economy.rewardWaterSort(_levelNum, _isDaily, _isDaily);

    let streakResult = null;
    if (_isDaily) {
      streakResult = Daily.recordDailyCompletion(MODE_ID);
    }

    const result = _root && _root.querySelector('#ws-result');
    if (result) {
      result.innerHTML = `
        <div class="result-card success">
          <div class="result-title">🎉 Sorted!</div>
          <div class="result-dust">+${_dustEarned} ✨ Wizard Dust</div>
          ${streakResult ? `<div class="result-streak">🔥 Streak: ${streakResult.streak} days</div>` : ''}
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn btn-secondary" id="ws-replay">Replay</button>
            <button class="btn btn-primary"   id="ws-next">Next Level →</button>
          </div>
        </div>`;

      result.querySelector('#ws-replay').addEventListener('click', () => start({ daily: _isDaily, level: _levelNum }));
      result.querySelector('#ws-next').addEventListener('click', () => start({ daily: _isDaily, level: _levelNum + 1 }));
    }

    Leaderboard.addEntry(MODE_ID, { score: _levelNum * 100 - _history.length, label: `Level ${_levelNum}` });

    if (_ctx && _ctx.onModeComplete) {
      _ctx.onModeComplete({ modeId: MODE_ID, score: _levelNum, dustEarned: _dustEarned });
    }
  }

  return { id: MODE_ID, mount, unmount, start };
})();
