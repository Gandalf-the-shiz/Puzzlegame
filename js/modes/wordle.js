/**
 * wordle.js — Wordle-like daily 5-letter word guessing mode
 *
 * 6 tries, 5 letters, on-screen keyboard, shareable results.
 * Daily word chosen by date seed from WORDLE_ANSWERS pool.
 */

'use strict';

const WordleMode = (() => {
  const MODE_ID    = 'wordle';
  const WORD_LEN   = 5;
  const MAX_GUESSES = 6;

  let _root    = null;
  let _ctx     = null;
  let _answer  = '';
  let _guesses = [];     // array of strings (submitted guesses)
  let _current = '';     // current input string
  let _won     = false;
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
    _isDaily = !!opts.daily;
    _guesses = [];
    _current = '';
    _won     = false;
    _over    = false;
    _dustEarned = 0;

    const seed = opts.seed != null ? opts.seed
      : Daily.seedForDate(Daily.todayStr(), MODE_ID);
    const rng  = Daily.seededRng(seed);
    const idx  = Math.floor(rng() * WORDLE_ANSWERS.length);
    _answer    = WORDLE_ANSWERS[idx];

    _renderBoard();
    _renderKeyboard();
    _root.querySelector('#wrd-result') && _root.querySelector('#wrd-result').classList.add('hidden');
  }

  // ── Rendering ───────────────────────────────────────────────────

  function _render() {
    _root.innerHTML = `
      <div class="wordle-wrap">
        <div class="mode-header">
          <button class="btn btn-secondary btn-sm" id="wrd-back">← Hub</button>
          <h2 class="mode-title">Wordle</h2>
          <div class="wrd-streak" id="wrd-streak"></div>
        </div>
        <p class="conn-subtitle">Guess the 5-letter word in 6 tries</p>
        <div class="wrd-board" id="wrd-board"></div>
        <div class="wrd-keyboard" id="wrd-keyboard"></div>
        <div class="wrd-result hidden" id="wrd-result"></div>
      </div>`;

    _root.querySelector('#wrd-back').addEventListener('click', () => {
      if (_ctx && _ctx.goHub) _ctx.goHub();
    });
  }

  function _renderBoard() {
    const board = _root.querySelector('#wrd-board');
    if (!board) return;
    board.innerHTML = '';

    // Streak
    const streakEl = _root.querySelector('#wrd-streak');
    if (streakEl) {
      const s = Daily.getStreak();
      streakEl.textContent = s.count > 0 ? `🔥 ${s.count}` : '';
    }

    for (let row = 0; row < MAX_GUESSES; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'wrd-row';
      for (let col = 0; col < WORD_LEN; col++) {
        const cell = document.createElement('div');
        cell.className = 'wrd-cell';
        cell.id = `wrd-cell-${row}-${col}`;

        if (row < _guesses.length) {
          const guess = _guesses[row];
          const letter = guess[col] || '';
          cell.textContent = letter;
          const state = _evaluateLetter(guess, col);
          cell.classList.add('wrd-' + state);
        } else if (row === _guesses.length) {
          // Current input row
          cell.textContent = _current[col] || '';
          if (_current[col]) cell.classList.add('wrd-filled');
        }

        rowEl.appendChild(cell);
      }
      board.appendChild(rowEl);
    }
  }

  function _renderKeyboard() {
    const kb = _root.querySelector('#wrd-keyboard');
    if (!kb) return;
    kb.innerHTML = '';

    const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', '↵ZXCVBNM⌫'];

    // Determine letter states from guesses
    const letterStates = {};
    _guesses.forEach(guess => {
      for (let i = 0; i < WORD_LEN; i++) {
        const ch = guess[i];
        const st = _evaluateLetter(guess, i);
        // Priority: correct > present > absent
        const priority = { correct: 3, present: 2, absent: 1 };
        if (!letterStates[ch] || priority[st] > priority[letterStates[ch]]) {
          letterStates[ch] = st;
        }
      }
    });

    ROWS.forEach(rowStr => {
      const rowEl = document.createElement('div');
      rowEl.className = 'wrd-kb-row';
      [...rowStr].forEach(ch => {
        const btn = document.createElement('button');
        btn.className = 'wrd-kb-key';
        btn.textContent = ch;
        if (ch === '↵') { btn.classList.add('wrd-kb-wide'); btn.dataset.key = 'ENTER'; }
        else if (ch === '⌫') { btn.classList.add('wrd-kb-wide'); btn.dataset.key = 'BACKSPACE'; }
        else {
          btn.dataset.key = ch;
          if (letterStates[ch]) btn.classList.add('wrd-' + letterStates[ch]);
        }
        btn.addEventListener('click', () => _handleKey(btn.dataset.key));
        rowEl.appendChild(btn);
      });
      kb.appendChild(rowEl);
    });
  }

  // ── Letter evaluation ────────────────────────────────────────────

  function _evaluateLetter(guess, col) {
    const letter = guess[col];
    if (!letter || !_answer) return 'empty';
    if (_answer[col] === letter) return 'correct';
    if (_answer.includes(letter)) return 'present';
    return 'absent';
  }

  /** Get full evaluation array for a guess */
  function _evaluateGuess(guess) {
    const result = Array(WORD_LEN).fill('absent');
    const answerArr = [..._answer];
    const guessArr  = [...guess];
    const used = Array(WORD_LEN).fill(false);

    // Pass 1: mark correct
    for (let i = 0; i < WORD_LEN; i++) {
      if (guessArr[i] === answerArr[i]) {
        result[i] = 'correct';
        used[i] = true;
        answerArr[i] = null;
      }
    }
    // Pass 2: mark present
    for (let i = 0; i < WORD_LEN; i++) {
      if (result[i] === 'correct') continue;
      const j = answerArr.indexOf(guessArr[i]);
      if (j >= 0) {
        result[i] = 'present';
        answerArr[j] = null;
      }
    }
    return result;
  }

  // ── Input handling ───────────────────────────────────────────────

  function _handleKey(key) {
    if (_over) return;
    if (key === 'ENTER') {
      _submitGuess();
    } else if (key === 'BACKSPACE') {
      _current = _current.slice(0, -1);
      _renderBoard();
    } else if (/^[A-Z]$/.test(key) && _current.length < WORD_LEN) {
      _current += key;
      _renderBoard();
      Settings.hapticPulse(5);
    }
  }

  // Physical keyboard support
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

    // Validate word
    const valid = WORDLE_VALID.includes(_current) || WORDLE_ANSWERS.includes(_current);
    if (!valid) {
      _shakeRow(_guesses.length);
      _showMessage('Not in word list!');
      return;
    }

    _guesses.push(_current);
    _current = '';

    const won = _guesses[_guesses.length - 1] === _answer;
    _won = won;

    _renderBoard();
    _renderKeyboard();

    if (won) {
      setTimeout(() => _onComplete(true), 600);
    } else if (_guesses.length >= MAX_GUESSES) {
      setTimeout(() => _onComplete(false), 600);
    }
  }

  function _shakeRow(row) {
    const rowEl = _root && _root.querySelector('#wrd-board') &&
      _root.querySelector('#wrd-board').children[row];
    if (!rowEl) return;
    rowEl.classList.add('wrd-shake');
    setTimeout(() => rowEl.classList.remove('wrd-shake'), 500);
    Settings.hapticPulse(50);
  }

  function _showMessage(msg) {
    const el = _root && _root.querySelector('#wrd-result');
    if (!el) return;
    el.classList.remove('hidden');
    el.innerHTML = `<span style="color:#f87171">${msg}</span>`;
    setTimeout(() => el.classList.add('hidden'), 2000);
  }

  // ── Completion ───────────────────────────────────────────────────

  function _onComplete(won) {
    _over = true;

    const dust = Economy.rewardWordle(_guesses.length, won, _isDaily, won && _isDaily);
    _dustEarned = dust;

    let streakResult = null;
    if (_isDaily && won) {
      streakResult = Daily.recordDailyCompletion(MODE_ID);
    }

    const result = _root && _root.querySelector('#wrd-result');
    if (result) {
      result.classList.remove('hidden');
      result.innerHTML = `
        <div class="result-card ${won ? 'success' : 'fail'}">
          <div class="result-title">${won ? '🎉 Genius!' : '😞 ' + _answer}</div>
          <div class="result-dust">+${_dustEarned} ✨ Wizard Dust</div>
          ${streakResult ? `<div class="result-streak">🔥 Streak: ${streakResult.streak} days</div>` : ''}
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn btn-secondary" id="wrd-share">📋 Share</button>
            <button class="btn btn-primary"   id="wrd-retry">🔄 Again</button>
          </div>
        </div>`;

      result.querySelector('#wrd-share').addEventListener('click', _share);
      result.querySelector('#wrd-retry').addEventListener('click', () => {
        result.classList.add('hidden');
        start({ daily: _isDaily });
      });
    }

    Leaderboard.addEntry(MODE_ID, {
      score: won ? (MAX_GUESSES - _guesses.length + 1) * 100 : 0,
      label: Daily.todayStr(),
    });

    if (_ctx && _ctx.onModeComplete) {
      _ctx.onModeComplete({ modeId: MODE_ID, score: _guesses.length, dustEarned: _dustEarned });
    }
  }

  function _share() {
    const EMOJI = { correct: '🟩', present: '🟨', absent: '⬛' };
    const date  = Daily.todayStr();
    const tries = _won ? String(_guesses.length) : 'X';
    let text    = `Wordle ${date} ${tries}/${MAX_GUESSES}\n\n`;

    _guesses.forEach(guess => {
      const eval_ = _evaluateGuess(guess);
      text += eval_.map(s => EMOJI[s] || '⬛').join('') + '\n';
    });

    try {
      navigator.clipboard.writeText(text).then(() => alert('Copied!'));
    } catch {
      prompt('Copy your result:', text);
    }
  }

  // Expose keyboard listener for app.js to attach/detach
  function onKeydown(e) { _onKeydown(e); }

  return { id: MODE_ID, mount, unmount, start, onKeydown };
})();
