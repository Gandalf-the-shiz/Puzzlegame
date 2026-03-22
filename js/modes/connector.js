/**
 * connector.js — Connections-like puzzle mode
 *
 * 16 words arranged in a 4×4 grid; find 4 groups of 4 that share a theme.
 * Daily puzzle selected by seed; unlimited retries; streak credit once/day.
 */

'use strict';

const ConnectorMode = (() => {
  const MODE_ID   = 'connector';
  const MAX_MISTAKES = 4;

  let _root      = null;
  let _ctx       = null;
  let _puzzle    = null;
  let _words     = [];     // flat shuffled array of 16 words
  let _selected  = [];     // indices of currently selected words
  let _solved    = [];     // group indices solved
  let _mistakes  = 0;
  let _isDaily   = false;
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
    _mistakes = 0;
    _selected = [];
    _solved   = [];
    _dustEarned = 0;

    // Pick puzzle by seed (daily) or random
    const seed = opts.seed != null ? opts.seed
      : Daily.seedForDate(Daily.todayStr(), MODE_ID);
    const rng = Daily.seededRng(seed);
    const idx = Math.floor(rng() * CONNECTOR_PUZZLES.length);
    _puzzle = CONNECTOR_PUZZLES[idx];

    // Flatten and shuffle words
    const allWords = _puzzle.groups.flatMap(g => g.words.map(w => ({ word: w, groupIdx: _puzzle.groups.indexOf(g) })));
    _words = Daily.seededShuffle(allWords, Daily.seededRng(seed + 1));

    _renderBoard();
    _updateStatus();
  }

  // ── Rendering ───────────────────────────────────────────────────

  function _render() {
    _root.innerHTML = `
      <div class="connector-wrap">
        <div class="mode-header">
          <button class="btn btn-secondary btn-sm" id="conn-back">← Hub</button>
          <h2 class="mode-title">Connector</h2>
          <div class="conn-streak" id="conn-streak"></div>
        </div>
        <p class="conn-subtitle">Find 4 groups of 4 related words</p>
        <div class="conn-status" id="conn-status"></div>
        <div class="conn-grid" id="conn-grid"></div>
        <div class="conn-actions">
          <button class="btn btn-secondary" id="conn-deselect">Deselect All</button>
          <button class="btn btn-primary"   id="conn-submit">Submit</button>
        </div>
        <div class="conn-result hidden" id="conn-result"></div>
        <div class="conn-share hidden" id="conn-share-wrap">
          <button class="btn btn-secondary" id="conn-share">📋 Share</button>
        </div>
      </div>`;

    _root.querySelector('#conn-back').addEventListener('click', () => {
      if (_ctx && _ctx.goHub) _ctx.goHub();
    });
    _root.querySelector('#conn-submit').addEventListener('click', _submit);
    _root.querySelector('#conn-deselect').addEventListener('click', _deselect);
  }

  function _renderBoard() {
    const grid = _root.querySelector('#conn-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Render solved groups first
    for (const gIdx of _solved) {
      const g = _puzzle.groups[gIdx];
      const row = document.createElement('div');
      row.className = 'conn-solved-row';
      row.style.background = g.color;
      row.innerHTML = `<div class="conn-solved-theme">${g.theme}</div>
        <div class="conn-solved-words">${g.words.join(' · ')}</div>`;
      grid.appendChild(row);
    }

    // Render unsolved words
    _words.forEach((item, i) => {
      if (_solved.includes(item.groupIdx)) return;
      const btn = document.createElement('button');
      btn.className = 'conn-word' + (_selected.includes(i) ? ' selected' : '');
      btn.textContent = item.word;
      btn.dataset.idx = i;
      btn.addEventListener('click', () => _toggleWord(i));
      grid.appendChild(btn);
    });

    // Update streak display
    const streakEl = _root.querySelector('#conn-streak');
    if (streakEl) {
      const s = Daily.getStreak();
      streakEl.textContent = s.count > 0 ? `🔥 ${s.count}` : '';
    }
  }

  function _updateStatus() {
    const el = _root.querySelector('#conn-status');
    if (!el) return;
    const pips = Array.from({ length: MAX_MISTAKES }, (_, i) =>
      `<span class="mistake-pip${i < _mistakes ? ' used' : ''}"></span>`
    ).join('');
    el.innerHTML = `Mistakes remaining: ${pips}`;
  }

  // ── Interaction ─────────────────────────────────────────────────

  function _toggleWord(i) {
    const item = _words[i];
    if (_solved.includes(item.groupIdx)) return;

    const pos = _selected.indexOf(i);
    if (pos >= 0) {
      _selected.splice(pos, 1);
    } else if (_selected.length < 4) {
      _selected.push(i);
    }
    _renderBoard();
    Settings.hapticPulse(10);
  }

  function _deselect() {
    _selected = [];
    _renderBoard();
  }

  function _submit() {
    if (_selected.length !== 4) {
      _flashStatus('Select exactly 4 words!');
      return;
    }

    // Check if all selected belong to the same group
    const groupIndices = _selected.map(i => _words[i].groupIdx);
    const allSame = groupIndices.every(g => g === groupIndices[0]);

    if (allSame) {
      // Correct!
      _solved.push(groupIndices[0]);
      _selected = [];
      _dustEarned += Economy.rewardConnector(1, _isDaily, false);
      Settings.hapticPulse(30);

      if (_solved.length === 4) {
        _onComplete();
      } else {
        _renderBoard();
        _flashStatus('✅ Correct!');
      }
    } else {
      // Wrong
      _mistakes++;
      Settings.hapticPulse(80);
      _selected = [];

      // Check if one away
      const counts = {};
      groupIndices.forEach(g => { counts[g] = (counts[g] || 0) + 1; });
      const maxCount = Math.max(...Object.values(counts));
      const msg = maxCount === 3 ? '❌ One away!' : '❌ Wrong!';

      _renderBoard();
      _flashStatus(msg);
      _updateStatus();

      if (_mistakes >= MAX_MISTAKES) {
        _onFail();
      }
    }
  }

  function _flashStatus(msg) {
    const el = _root.querySelector('#conn-status');
    if (!el) return;
    const orig = el.innerHTML;
    el.innerHTML = `<span style="color:#f87171">${msg}</span>`;
    setTimeout(() => { if (el) el.innerHTML = orig; }, 1200);
  }

  // ── Completion ───────────────────────────────────────────────────

  function _onComplete() {
    _renderBoard();

    // Daily streak
    let streakResult = null;
    if (_isDaily) {
      streakResult = Daily.recordDailyCompletion(MODE_ID);
      const bonus = Economy.rewardConnector(0, true, true);
      _dustEarned += bonus;
    }

    const result = _root.querySelector('#conn-result');
    if (result) {
      result.classList.remove('hidden');
      result.innerHTML = `
        <div class="result-card success">
          <div class="result-title">🎉 Solved!</div>
          <div class="result-dust">+${_dustEarned} ✨ Wizard Dust earned</div>
          ${streakResult ? `<div class="result-streak">🔥 Streak: ${streakResult.streak} days</div>` : ''}
          <div class="result-mistakes">Mistakes: ${_mistakes}/${MAX_MISTAKES}</div>
        </div>`;
    }

    const shareWrap = _root.querySelector('#conn-share-wrap');
    if (shareWrap) {
      shareWrap.classList.remove('hidden');
      _root.querySelector('#conn-share').addEventListener('click', _share);
    }

    // Add to leaderboard (score = groups * 10 - mistakes * 5)
    const score = _puzzle.groups.length * 10 - _mistakes * 5;
    Leaderboard.addEntry(MODE_ID, { score, label: Daily.todayStr() });

    if (_ctx && _ctx.onModeComplete) {
      _ctx.onModeComplete({ modeId: MODE_ID, score, dustEarned: _dustEarned });
    }
  }

  function _onFail() {
    _renderBoard();
    const result = _root.querySelector('#conn-result');
    if (result) {
      result.classList.remove('hidden');
      result.innerHTML = `
        <div class="result-card fail">
          <div class="result-title">😞 Better luck next time!</div>
          <div class="result-dust">+${_dustEarned} ✨ Wizard Dust earned</div>
          <button class="btn btn-primary" id="conn-retry">🔄 Retry</button>
        </div>`;
      const retryBtn = result.querySelector('#conn-retry');
      if (retryBtn) retryBtn.addEventListener('click', () => start({ daily: _isDaily }));
    }
  }

  function _share() {
    // Map group index to emoji by difficulty order (0=yellow,1=green,2=blue,3=purple)
    const groupEmoji = ['🟨', '🟩', '🟦', '🟪'];
    const date = Daily.todayStr();
    let text = `Connector ${date}\n`;
    text += _solved.map(gIdx => {
      const emoji = groupEmoji[gIdx] || '⬜';
      return emoji + emoji + emoji + emoji;
    }).join('\n');
    text += `\nMistakes: ${_mistakes}`;
    try {
      navigator.clipboard.writeText(text).then(() => _flashStatus('✅ Copied!'));
    } catch {
      prompt('Copy your result:', text);
    }
  }

  return { id: MODE_ID, mount, unmount, start };
})();
