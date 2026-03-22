/**
 * miniwordgrid.js — Mini Word Grid (mini crossword-like) mode
 *
 * Fill in a small crossword grid from hand-authored puzzle packs.
 * Validation and completion celebration.
 */

'use strict';

const MiniWordGridMode = (() => {
  const MODE_ID = 'miniwordgrid';

  let _root    = null;
  let _ctx     = null;
  let _puzzle  = null;
  let _grid    = [];   // flat array matching puzzle.solution (user input)
  let _over    = false;
  let _isDaily = false;
  let _dustEarned = 0;

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
    _isDaily    = !!opts.daily;
    _over       = false;
    _dustEarned = 0;

    const seed = opts.seed != null ? opts.seed
      : Daily.seedForDate(Daily.todayStr(), MODE_ID);
    const rng  = Daily.seededRng(seed);
    const idx  = Math.floor(rng() * MINIWORDGRID_PUZZLES.length);
    _puzzle    = MINIWORDGRID_PUZZLES[idx];

    // Init user grid: blank for letter cells, null for blockers
    _grid = _puzzle.solution.map(c => c === '#' ? null : '');

    _renderBoard();
    const resultEl = _root && _root.querySelector('#mwg-result');
    if (resultEl) resultEl.innerHTML = '';
  }

  // ── Rendering ───────────────────────────────────────────────────

  function _render() {
    _root.innerHTML = `
      <div class="mwg-wrap">
        <div class="mode-header">
          <button class="btn btn-secondary btn-sm" id="mwg-back">← Hub</button>
          <h2 class="mode-title">Word Grid</h2>
        </div>
        <div class="mwg-layout">
          <div class="mwg-grid-wrap">
            <div class="mwg-grid" id="mwg-grid"></div>
          </div>
          <div class="mwg-clues" id="mwg-clues"></div>
        </div>
        <div class="mwg-actions">
          <button class="btn btn-secondary" id="mwg-check">✓ Check</button>
          <button class="btn btn-primary"   id="mwg-reveal">👁 Reveal</button>
        </div>
        <div id="mwg-result" class="mwg-result"></div>
      </div>`;

    _root.querySelector('#mwg-back').addEventListener('click', () => {
      if (_ctx && _ctx.goHub) _ctx.goHub();
    });
    _root.querySelector('#mwg-check').addEventListener('click', _check);
    _root.querySelector('#mwg-reveal').addEventListener('click', _reveal);
  }

  function _renderBoard() {
    if (!_puzzle) return;
    const gridEl  = _root && _root.querySelector('#mwg-grid');
    const cluesEl = _root && _root.querySelector('#mwg-clues');
    if (!gridEl || !cluesEl) return;

    const { cols, rows, solution } = _puzzle;
    gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gridEl.innerHTML = '';

    // Compute cell numbers (standard crossword numbering)
    const cellNums = _computeCellNumbers(solution, cols, rows);

    solution.forEach((sol, i) => {
      const cell = document.createElement('div');
      if (sol === '#') {
        cell.className = 'mwg-cell mwg-black';
      } else {
        cell.className = 'mwg-cell';
        const num = cellNums[i];
        if (num) {
          const numEl = document.createElement('span');
          numEl.className = 'mwg-cell-num';
          numEl.textContent = num;
          cell.appendChild(numEl);
        }
        const inp = document.createElement('input');
        inp.type      = 'text';
        inp.maxLength = 1;
        inp.className = 'mwg-input';
        inp.value     = _grid[i] || '';
        inp.dataset.idx = i;
        inp.addEventListener('input', e => {
          const val = e.target.value.toUpperCase().slice(-1);
          _grid[i]  = val;
          e.target.value = val;
          // Move focus right or down
          _advanceFocus(i, cols, rows, solution);
        });
        inp.addEventListener('keydown', e => {
          if (e.key === 'Backspace' && !_grid[i]) {
            _moveFocusBack(i, cols, solution);
          }
        });
        cell.appendChild(inp);
      }
      gridEl.appendChild(cell);
    });

    // Render clues
    cluesEl.innerHTML = `
      <div class="mwg-clue-section">
        <div class="mwg-clue-heading">Across</div>
        ${_puzzle.clues.across.map(c => `<div class="mwg-clue"><span class="mwg-clue-num">${c.num}</span>${c.clue}</div>`).join('')}
      </div>
      <div class="mwg-clue-section">
        <div class="mwg-clue-heading">Down</div>
        ${_puzzle.clues.down.map(c => `<div class="mwg-clue"><span class="mwg-clue-num">${c.num}</span>${c.clue}</div>`).join('')}
      </div>`;
  }

  function _computeCellNumbers(solution, cols, rows) {
    const nums = Array(solution.length).fill(0);
    let n = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (solution[i] === '#') continue;
        const acrossStart =
          (c === 0 || solution[i - 1] === '#') &&
          (c + 1 < cols && solution[i + 1] !== '#');
        const downStart =
          (r === 0 || solution[i - cols] === '#') &&
          (r + 1 < rows && solution[i + cols] !== '#');
        if (acrossStart || downStart) nums[i] = n++;
      }
    }
    return nums;
  }

  function _advanceFocus(i, cols, rows, solution) {
    // Try moving right first, then down
    const right = i + 1;
    if (right < solution.length && solution[right] !== '#') {
      const inp = _root.querySelector(`[data-idx="${right}"]`);
      if (inp) { inp.focus(); return; }
    }
    const down = i + cols;
    if (down < solution.length && solution[down] !== '#') {
      const inp = _root.querySelector(`[data-idx="${down}"]`);
      if (inp) inp.focus();
    }
  }

  function _moveFocusBack(i, cols, solution) {
    const left = i - 1;
    if (left >= 0 && solution[left] !== '#') {
      const inp = _root.querySelector(`[data-idx="${left}"]`);
      if (inp) inp.focus();
    }
  }

  // ── Check / Reveal ───────────────────────────────────────────────

  function _check() {
    if (!_puzzle) return;
    let allCorrect = true;
    const gridEl = _root && _root.querySelector('#mwg-grid');
    if (!gridEl) return;

    _puzzle.solution.forEach((sol, i) => {
      if (sol === '#') return;
      const inp = gridEl.querySelector(`[data-idx="${i}"]`);
      if (!inp) return;
      const userVal = (_grid[i] || '').toUpperCase();
      const correct = userVal === sol.toUpperCase();
      inp.parentElement.classList.toggle('mwg-correct', correct && !!userVal);
      inp.parentElement.classList.toggle('mwg-wrong',   !correct && !!userVal);
      if (!correct) allCorrect = false;
    });

    if (allCorrect && _grid.every((v, i) => _puzzle.solution[i] === '#' || v !== '')) {
      _onComplete();
    }
  }

  function _reveal() {
    if (!_puzzle) return;
    _puzzle.solution.forEach((sol, i) => {
      if (sol === '#') return;
      _grid[i] = sol;
    });
    _renderBoard();
    _onComplete();
  }

  // ── Completion ───────────────────────────────────────────────────

  function _onComplete() {
    if (_over) return;
    _over = true;

    const cellsFilled = _grid.filter((v, i) => _puzzle.solution[i] !== '#' && v).length;
    _dustEarned = Economy.rewardMiniWordGrid(cellsFilled, _isDaily, _isDaily);

    let streakResult = null;
    if (_isDaily) {
      streakResult = Daily.recordDailyCompletion(MODE_ID);
    }

    Settings.hapticPulse(60);

    const result = _root && _root.querySelector('#mwg-result');
    if (result) {
      result.innerHTML = `
        <div class="result-card success">
          <div class="result-title">🎉 Completed!</div>
          <div class="result-dust">+${_dustEarned} ✨ Wizard Dust</div>
          ${streakResult ? `<div class="result-streak">🔥 Streak: ${streakResult.streak} days</div>` : ''}
          <button class="btn btn-primary" id="mwg-retry">🔄 Next Puzzle</button>
        </div>`;
      result.querySelector('#mwg-retry').addEventListener('click', () => {
        const nextSeed = Daily.seedForDate(Daily.todayStr(), MODE_ID) + Math.floor(Math.random() * 1000);
        start({ daily: _isDaily, seed: nextSeed });
      });
    }

    Leaderboard.addEntry(MODE_ID, { score: cellsFilled * 10, label: Daily.todayStr() });
    if (_ctx && _ctx.onModeComplete) {
      _ctx.onModeComplete({ modeId: MODE_ID, score: cellsFilled, dustEarned: _dustEarned });
    }
  }

  return { id: MODE_ID, mount, unmount, start };
})();
