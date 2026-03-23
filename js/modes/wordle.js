/**
 * wordle.js — Premium Wordle-like daily 5-letter word guessing mode
 *
 * Features:
 *  - Daily word (date-seeded) and free Practice mode
 *  - 6 tries, 5 letters, on-screen + physical keyboard
 *  - Correct two-pass letter evaluation (handles duplicate letters)
 *  - Tile-flip reveal animation (NYT-style)
 *  - Hard Mode (revealed hints must be used)
 *  - Stats & guess distribution histogram
 *  - Puzzle number display
 *  - Shareable emoji grid with puzzle number + hard mode indicator
 */

'use strict';

const WordleMode = (() => {
  const MODE_ID                  = 'wordle';
  const WORD_LEN                 = 5;
  const MAX_GUESSES              = 6;
  const EPOCH                    = new Date('2024-01-01T00:00:00Z'); // puzzle #1 reference date
  const FLIP_DELAY               = 300; // ms per tile flip stagger
  const FLIP_DUR                 = 350; // ms flip animation duration
  const PRACTICE_REWARD_MULTIPLIER = 0.5; // practice earns 50% of normal daily reward

  // ── State ───────────────────────────────────────────────────────
  let _root       = null;
  let _ctx        = null;
  let _answer     = '';
  let _guesses    = [];     // submitted guess strings
  let _current    = '';     // current input string
  let _won        = false;
  let _over       = false;
  let _isDaily    = false;
  let _isHard     = false;
  let _dustEarned = 0;
  let _isFlipping = false;  // block input during flip animation

  // ── Puzzle number ───────────────────────────────────────────────
  function _puzzleNumber() {
    const now = new Date();
    const utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.floor((utcNow - EPOCH.getTime()) / 86400000) + 1;
  }

  // ── Mount / Unmount ─────────────────────────────────────────────
  function mount(rootEl, ctx) {
    _root = rootEl;
    _ctx  = ctx;
    _isHard = _loadHardMode();
    _render();
  }

  function unmount() {
    if (_root) _root.innerHTML = '';
    _root = null;
  }

  // ── Start ───────────────────────────────────────────────────────
  function start(opts = {}) {
    _isDaily    = !!opts.daily;
    _guesses    = [];
    _current    = '';
    _won        = false;
    _over       = false;
    _dustEarned = 0;
    _isFlipping = false;

    if (_isDaily) {
      const seed = opts.seed != null ? opts.seed
        : Daily.seedForDate(Daily.todayStr(), MODE_ID);
      const rng = Daily.seededRng(seed);
      const idx = Math.floor(rng() * WORDLE_ANSWERS.length);
      _answer = WORDLE_ANSWERS[idx];
    } else {
      // Practice: random word not date-seeded
      const idx = Math.floor(Math.random() * WORDLE_ANSWERS.length);
      _answer = WORDLE_ANSWERS[idx];
    }

    _renderBoard();
    _renderKeyboard();
    _renderModeButtons();
    _renderPuzzleInfo();
    const resultEl = _root && _root.querySelector('#wrd-result');
    if (resultEl) resultEl.classList.add('hidden');
    const statsEl = _root && _root.querySelector('#wrd-stats');
    if (statsEl) statsEl.classList.add('hidden');
  }

  // ── Rendering ───────────────────────────────────────────────────
  function _render() {
    _root.innerHTML = `
      <div class="wordle-wrap">
        <div class="mode-header">
          <button class="btn btn-secondary btn-sm" id="wrd-back">&#8592; Hub</button>
          <div class="wrd-title-block">
            <h2 class="mode-title">Wordle</h2>
            <div class="wrd-puzzle-info" id="wrd-puzzle-info"></div>
          </div>
          <div class="wrd-header-right">
            <div class="wrd-streak" id="wrd-streak"></div>
            <button class="wrd-stats-btn" id="wrd-stats-btn" title="Stats">&#128202;</button>
          </div>
        </div>
        <div class="wrd-mode-buttons" id="wrd-mode-buttons"></div>
        <div class="wrd-hard-row">
          <label class="wrd-hard-label">
            <input type="checkbox" id="wrd-hard-toggle" class="wrd-hard-checkbox">
            <span class="wrd-hard-text">&#9889; Hard Mode</span>
          </label>
        </div>
        <p class="conn-subtitle">Guess the 5-letter word in 6 tries</p>
        <div class="wrd-board" id="wrd-board"></div>
        <div class="wrd-keyboard" id="wrd-keyboard"></div>
        <div class="wrd-result hidden" id="wrd-result"></div>
        <div class="wrd-stats hidden" id="wrd-stats"></div>
      </div>`;

    _root.querySelector('#wrd-back').addEventListener('click', () => {
      if (_ctx && _ctx.goHub) _ctx.goHub();
    });

    const hardToggle = _root.querySelector('#wrd-hard-toggle');
    hardToggle.checked = _isHard;
    hardToggle.addEventListener('change', () => {
      if (_guesses.length > 0) {
        hardToggle.checked = _isHard; // revert
        _showMessage('Hard mode can only be changed before guessing');
        return;
      }
      _isHard = hardToggle.checked;
      _saveHardMode(_isHard);
    });

    _root.querySelector('#wrd-stats-btn').addEventListener('click', _showStats);
  }

  function _renderModeButtons() {
    const el = _root && _root.querySelector('#wrd-mode-buttons');
    if (!el) return;
    el.innerHTML = `
      <button class="wrd-mode-btn ${_isDaily ? 'active' : ''}" id="wrd-daily-btn">&#128197; Daily</button>
      <button class="wrd-mode-btn ${!_isDaily ? 'active' : ''}" id="wrd-practice-btn">&#127922; Practice</button>`;
    el.querySelector('#wrd-daily-btn').addEventListener('click', () => {
      if (!_isDaily) start({ daily: true });
    });
    el.querySelector('#wrd-practice-btn').addEventListener('click', () => {
      if (_isDaily) start({ daily: false });
    });
  }

  function _renderPuzzleInfo() {
    const el = _root && _root.querySelector('#wrd-puzzle-info');
    if (!el) return;
    el.textContent = _isDaily ? '#' + _puzzleNumber() : 'Practice';
  }

  function _renderBoard() {
    const board = _root && _root.querySelector('#wrd-board');
    if (!board) return;
    board.innerHTML = '';

    const streakEl = _root.querySelector('#wrd-streak');
    if (streakEl) {
      const s = Daily.getStreak();
      streakEl.textContent = s.count > 0 ? '\uD83D\uDD25 ' + s.count : '';
    }

    for (let row = 0; row < MAX_GUESSES; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'wrd-row';
      for (let col = 0; col < WORD_LEN; col++) {
        const cell = document.createElement('div');
        cell.className = 'wrd-cell';
        cell.id = 'wrd-cell-' + row + '-' + col;

        if (row < _guesses.length) {
          const guess = _guesses[row];
          cell.textContent = guess[col] || '';
          const states = _evaluateGuess(guess);
          cell.classList.add('wrd-' + states[col]);
        } else if (row === _guesses.length) {
          cell.textContent = _current[col] || '';
          if (_current[col]) cell.classList.add('wrd-filled');
        }

        rowEl.appendChild(cell);
      }
      board.appendChild(rowEl);
    }
  }

  function _renderKeyboard() {
    const kb = _root && _root.querySelector('#wrd-keyboard');
    if (!kb) return;
    kb.innerHTML = '';

    const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', '\u21B5ZXCVBNM\u232B'];

    // Determine per-letter best state using two-pass evaluation
    const letterStates = {};
    _guesses.forEach(function(guess) {
      const states = _evaluateGuess(guess);
      const priority = { correct: 3, present: 2, absent: 1 };
      for (let i = 0; i < WORD_LEN; i++) {
        const ch = guess[i];
        const st = states[i];
        if (!letterStates[ch] || priority[st] > priority[letterStates[ch]]) {
          letterStates[ch] = st;
        }
      }
    });

    ROWS.forEach(function(rowStr) {
      const rowEl = document.createElement('div');
      rowEl.className = 'wrd-kb-row';
      [...rowStr].forEach(function(ch) {
        const btn = document.createElement('button');
        btn.className = 'wrd-kb-key';
        btn.textContent = ch;
        if (ch === '\u21B5') { btn.classList.add('wrd-kb-wide'); btn.dataset.key = 'ENTER'; }
        else if (ch === '\u232B') { btn.classList.add('wrd-kb-wide'); btn.dataset.key = 'BACKSPACE'; }
        else {
          btn.dataset.key = ch;
          if (letterStates[ch]) btn.classList.add('wrd-' + letterStates[ch]);
        }
        btn.addEventListener('click', function() { _handleKey(btn.dataset.key); });
        rowEl.appendChild(btn);
      });
      kb.appendChild(rowEl);
    });
  }

  // ── Letter evaluation (two-pass, handles duplicate letters) ──────
  function _evaluateGuess(guess) {
    const result   = Array(WORD_LEN).fill('absent');
    const ansArr   = _answer.split('');
    const guessArr = guess.split('');

    // Pass 1: exact matches (green)
    for (let i = 0; i < WORD_LEN; i++) {
      if (guessArr[i] === ansArr[i]) {
        result[i] = 'correct';
        ansArr[i] = null;
      }
    }
    // Pass 2: present but wrong position (yellow)
    for (let i = 0; i < WORD_LEN; i++) {
      if (result[i] === 'correct') continue;
      const j = ansArr.indexOf(guessArr[i]);
      if (j >= 0) {
        result[i] = 'present';
        ansArr[j] = null;
      }
    }
    return result;
  }

  // ── Hard mode validation ─────────────────────────────────────────
  function _hardModeError(guess) {
    if (!_isHard || _guesses.length === 0) return null;

    const greenRequired = {};  // position -> letter
    const yellowRequired = {}; // letter -> minimum count required

    _guesses.forEach(function(prev) {
      const states = _evaluateGuess(prev);
      for (let i = 0; i < WORD_LEN; i++) {
        if (states[i] === 'correct') greenRequired[i] = prev[i];
      }
      for (let i = 0; i < WORD_LEN; i++) {
        if (states[i] === 'present') {
          yellowRequired[prev[i]] = (yellowRequired[prev[i]] || 0) + 1;
        }
      }
    });

    for (const pos in greenRequired) {
      if (guess[pos] !== greenRequired[pos]) {
        return 'Hard mode: ' + greenRequired[pos] + ' must be in position ' + (Number(pos) + 1);
      }
    }

    for (const letter in yellowRequired) {
      const inGuess = guess.split('').filter(function(c) { return c === letter; }).length;
      if (inGuess < yellowRequired[letter]) {
        return 'Hard mode: guess must contain ' + letter;
      }
    }

    return null;
  }

  // ── Input handling ───────────────────────────────────────────────
  function _handleKey(key) {
    if (_over || _isFlipping) return;
    if (key === 'ENTER') {
      _submitGuess();
    } else if (key === 'BACKSPACE') {
      _current = _current.slice(0, -1);
      _renderBoard();
    } else if (/^[A-Z]$/.test(key) && _current.length < WORD_LEN) {
      _current += key;
      _renderBoard();
      // Pop animation on the typed cell
      const row = _guesses.length;
      const col = _current.length - 1;
      const cell = _root && _root.querySelector('#wrd-cell-' + row + '-' + col);
      if (cell) {
        cell.classList.add('wrd-pop');
        setTimeout(function() { cell.classList.remove('wrd-pop'); }, 100);
      }
      Settings.hapticPulse(5);
    }
  }

  function _onKeydown(e) {
    if (!_root) return;
    const key = e.key.toUpperCase();
    if (key === 'ENTER') _handleKey('ENTER');
    else if (key === 'BACKSPACE') _handleKey('BACKSPACE');
    else if (/^[A-Z]$/.test(key)) _handleKey(key);
  }

  function _submitGuess() {
    if (_current.length < WORD_LEN) {
      _shakeRow(_guesses.length);
      return;
    }

    if (!WORDLE_VALID.includes(_current) && !WORDLE_ANSWERS.includes(_current)) {
      _shakeRow(_guesses.length);
      _showMessage('Not in word list!');
      return;
    }

    const hardErr = _hardModeError(_current);
    if (hardErr) {
      _shakeRow(_guesses.length);
      _showMessage(hardErr);
      return;
    }

    const guess = _current;
    _guesses.push(guess);
    _current = '';

    const won = guess === _answer;
    _won = won;

    // Flip animation then update keyboard and trigger completion
    _isFlipping = true;
    const states = _evaluateGuess(guess);
    const rowIdx = _guesses.length - 1;
    _flipRow(rowIdx, states, function() {
      _isFlipping = false;
      _renderKeyboard();
      if (won) {
        _celebrateWin(rowIdx);
        setTimeout(function() { _onComplete(true); }, 400);
      } else if (_guesses.length >= MAX_GUESSES) {
        setTimeout(function() { _onComplete(false); }, 400);
      }
    });
  }

  // ── Tile flip animation ──────────────────────────────────────────
  function _flipRow(rowIdx, states, onDone) {
    const board = _root && _root.querySelector('#wrd-board');
    if (!board) { if (onDone) onDone(); return; }
    const rowEl = board.children[rowIdx];
    if (!rowEl) { if (onDone) onDone(); return; }

    const cells = rowEl.querySelectorAll('.wrd-cell');
    cells.forEach(function(cell, col) {
      setTimeout(function() {
        cell.classList.add('wrd-flip');
        // At midpoint apply color
        setTimeout(function() {
          cell.classList.add('wrd-' + states[col]);
          cell.classList.remove('wrd-filled');
        }, FLIP_DUR / 2);

        if (col === WORD_LEN - 1) {
          setTimeout(onDone, FLIP_DUR);
        }
      }, col * FLIP_DELAY);
    });
  }

  function _shakeRow(row) {
    const board = _root && _root.querySelector('#wrd-board');
    const rowEl = board && board.children[row];
    if (!rowEl) return;
    rowEl.classList.add('wrd-shake');
    setTimeout(function() { rowEl.classList.remove('wrd-shake'); }, 500);
    Settings.hapticPulse(50);
  }

  function _celebrateWin(rowIdx) {
    const board = _root && _root.querySelector('#wrd-board');
    const rowEl = board && board.children[rowIdx];
    if (!rowEl) return;
    const cells = rowEl.querySelectorAll('.wrd-cell');
    cells.forEach(function(cell, col) {
      setTimeout(function() {
        cell.classList.add('wrd-bounce');
        setTimeout(function() { cell.classList.remove('wrd-bounce'); }, 700);
      }, col * 80);
    });
  }

  function _showMessage(msg) {
    let toast = _root && _root.querySelector('.wrd-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'wrd-toast';
      if (_root) _root.querySelector('.wordle-wrap').appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('wrd-toast-visible');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function() { toast.classList.remove('wrd-toast-visible'); }, 2200);
  }

  // ── Completion ───────────────────────────────────────────────────
  function _onComplete(won) {
    _over = true;

    let dust;
    if (_isDaily) {
      dust = Economy.rewardWordle(_guesses.length, won, true, won);
      if (won && _isHard) {
        dust += 10;
        Economy.addDust(10);
      }
    } else {
      // Practice: ~50% of normal reward
      const base = won ? Math.max(1, (7 - _guesses.length) * 5 + 10) : 2;
      dust = Math.round(base * PRACTICE_REWARD_MULTIPLIER);
      Economy.addDust(dust);
    }
    _dustEarned = dust;

    let streakResult = null;
    if (_isDaily && won) {
      streakResult = Daily.recordDailyCompletion(MODE_ID);
    }

    _saveStats(won, _guesses.length);

    const result = _root && _root.querySelector('#wrd-result');
    if (result) {
      result.classList.remove('hidden');
      const puzzleLabel = _isDaily
        ? 'Wordle #' + _puzzleNumber() + (_isHard ? '*' : '')
        : 'Practice';
      result.innerHTML = `
        <div class="result-card ${won ? 'success' : 'fail'}">
          <div class="result-title">${won ? '\uD83C\uDF89 ' + _winTitle(_guesses.length) : '\uD83D\uDE1E ' + _answer}</div>
          <div class="wrd-result-puzzle">${puzzleLabel} \u2014 ${won ? _guesses.length : 'X'}/${MAX_GUESSES}</div>
          <div class="result-dust">+${_dustEarned} \u2728 Wizard Dust${_isHard && won ? ' (+Hard Mode bonus)' : ''}</div>
          ${streakResult ? '<div class="result-streak">\uD83D\uDD25 Streak: ' + streakResult.streak + ' days</div>' : ''}
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;justify-content:center;">
            <button class="btn btn-secondary" id="wrd-share">\uD83D\uDCCB Share</button>
            <button class="btn btn-secondary" id="wrd-stats-res">\uD83D\uDCCA Stats</button>
            <button class="btn btn-primary"   id="wrd-retry">\uD83D\uDD04 ${_isDaily ? 'Practice' : 'Again'}</button>
          </div>
        </div>`;

      result.querySelector('#wrd-share').addEventListener('click', _share);
      result.querySelector('#wrd-stats-res').addEventListener('click', _showStats);
      result.querySelector('#wrd-retry').addEventListener('click', function() {
        result.classList.add('hidden');
        start({ daily: false });
      });
    }

    Leaderboard.addEntry(MODE_ID, {
      score: won ? (MAX_GUESSES - _guesses.length + 1) * 100 : 0,
      label: _isDaily ? '#' + _puzzleNumber() : 'Practice',
    });

    if (_ctx && _ctx.onModeComplete) {
      _ctx.onModeComplete({ modeId: MODE_ID, score: _guesses.length, dustEarned: _dustEarned });
    }
  }

  function _winTitle(guesses) {
    const titles = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'];
    return titles[guesses - 1] || 'Nice!';
  }

  // ── Sharing ──────────────────────────────────────────────────────
  function _share() {
    const EMOJI = { correct: '\uD83D\uDFE9', present: '\uD83D\uDFE8', absent: '\u2B1B' };
    const tries  = _won ? String(_guesses.length) : 'X';
    const hard   = _isHard ? '*' : '';
    const header = _isDaily
      ? 'Puzzle Hub Wordle #' + _puzzleNumber() + hard + ' ' + tries + '/' + MAX_GUESSES
      : 'Puzzle Hub Wordle Practice' + hard + ' ' + tries + '/' + MAX_GUESSES;

    const rows = _guesses.map(function(guess) {
      return _evaluateGuess(guess).map(function(s) { return EMOJI[s] || '\u2B1B'; }).join('');
    });

    const text = header + '\n\n' + rows.join('\n');

    try {
      navigator.clipboard.writeText(text).then(function() { _showMessage('\u2705 Copied!'); });
    } catch (ex) {
      prompt('Copy your result:', text);
    }
  }

  // ── Stats ────────────────────────────────────────────────────────
  const STATS_KEY = 'wordle_stats_v1';

  function _loadStats() {
    try {
      const raw = Storage.get(STATS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0,0,0,0,0,0] };
  }

  function _saveStats(won, guessCount) {
    const s = _loadStats();
    s.played++;
    if (won) {
      s.wins++;
      s.streak++;
      if (s.streak > s.maxStreak) s.maxStreak = s.streak;
      const idx = Math.min(guessCount - 1, 5);
      s.dist[idx] = (s.dist[idx] || 0) + 1;
    } else {
      s.streak = 0;
    }
    Storage.set(STATS_KEY, JSON.stringify(s));
  }

  function _showStats() {
    const s = _loadStats();
    const statsEl = _root && _root.querySelector('#wrd-stats');
    if (!statsEl) return;

    const winPct = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
    const maxDist = Math.max(1, ...s.dist);

    const distBars = s.dist.map(function(count, i) {
      const pct = Math.round((count / maxDist) * 100);
      return '<div class="wrd-dist-row">'
        + '<div class="wrd-dist-label">' + (i + 1) + '</div>'
        + '<div class="wrd-dist-bar-wrap">'
        + '<div class="wrd-dist-bar" style="width:' + Math.max(pct, count > 0 ? 8 : 2) + '%">' + count + '</div>'
        + '</div></div>';
    }).join('');

    statsEl.innerHTML = `
      <div class="wrd-stats-panel">
        <div class="wrd-stats-header">
          <span>\uD83D\uDCCA Statistics</span>
          <button class="wrd-stats-close" id="wrd-stats-close">\u2715</button>
        </div>
        <div class="wrd-stats-grid">
          <div class="wrd-stat"><div class="wrd-stat-num">${s.played}</div><div class="wrd-stat-lbl">Played</div></div>
          <div class="wrd-stat"><div class="wrd-stat-num">${winPct}%</div><div class="wrd-stat-lbl">Win %</div></div>
          <div class="wrd-stat"><div class="wrd-stat-num">${s.streak}</div><div class="wrd-stat-lbl">Streak</div></div>
          <div class="wrd-stat"><div class="wrd-stat-num">${s.maxStreak}</div><div class="wrd-stat-lbl">Max</div></div>
        </div>
        <div class="wrd-dist-title">Guess Distribution</div>
        <div class="wrd-dist">${distBars}</div>
      </div>`;

    statsEl.classList.remove('hidden');
    statsEl.querySelector('#wrd-stats-close').addEventListener('click', function() {
      statsEl.classList.add('hidden');
    });
  }

  // ── Hard mode persistence ────────────────────────────────────────
  const HARD_KEY = 'wordle_hard_mode';
  function _loadHardMode() {
    try { return Storage.get(HARD_KEY) === '1'; } catch (e) { return false; }
  }
  function _saveHardMode(val) {
    try { Storage.set(HARD_KEY, val ? '1' : '0'); } catch (e) {}
  }

  // ── Public API ───────────────────────────────────────────────────
  function onKeydown(e) { _onKeydown(e); }

  return { id: MODE_ID, mount, unmount, start, onKeydown };
})();
