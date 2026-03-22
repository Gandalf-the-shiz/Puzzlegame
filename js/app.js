/**
 * app.js — Hub routing, screen management, and shared UI
 *
 * Screens:
 *   #screen-hub      — tile grid of all modes
 *   #screen-match    — existing match-3 game
 *   #screen-connector, #screen-wordle, etc. — new modes
 *
 * All screen divs live in index.html.
 * app.js handles show/hide and passes ctx to modes.
 */

'use strict';

const App = (() => {
  let _currentMode = null;   // active mode object
  let _currentScreen = 'hub';
  let _wordleKeydownBound = null;

  // ── Context passed to every mode ────────────────────────────────
  const _ctx = {
    goHub() { App.showHub(); },
    onModeComplete(result) { App._onModeComplete(result); },
  };

  // ── Screens ──────────────────────────────────────────────────────

  const SCREENS = [
    'hub','match','connector','wordle','miniwordgrid','minesweeper','watersort','mahjong',
    'shop','settings','stats',
  ];

  function _showScreen(id) {
    SCREENS.forEach(s => {
      const el = document.getElementById('screen-' + s);
      if (el) el.classList.toggle('hidden', s !== id);
    });
    _currentScreen = id;
    window.scrollTo(0, 0);
  }

  // ── Hub ──────────────────────────────────────────────────────────

  function showHub() {
    // Unmount current mode
    if (_currentMode && _currentMode.unmount) _currentMode.unmount();
    _currentMode = null;

    // Remove Wordle keyboard listener
    if (_wordleKeydownBound) {
      document.removeEventListener('keydown', _wordleKeydownBound);
      _wordleKeydownBound = null;
    }

    _showScreen('hub');
    _renderHubCards();
    _updateDustDisplay();
  }

  function _renderHubCards() {
    const grid = document.getElementById('hub-cards');
    if (!grid) return;

    const today = Daily.todayStr();
    const streak = Daily.getStreak();
    const dust = Economy.getDust();

    const modes = [
      {
        id: 'match', name: '♾️ Infinity', desc: 'Endless match-3 madness',
        kind: 'endless', icon: '🎮', bestKey: 'match.highScore', bestLabel: 'Best',
      },
      {
        id: 'connector', name: 'Connector', desc: 'Find the 4 groups of 4',
        kind: 'daily', icon: '🔗', bestKey: null,
      },
      {
        id: 'wordle', name: 'Wordle', desc: 'Guess the 5-letter word',
        kind: 'daily', icon: '📝', bestKey: null,
      },
      {
        id: 'miniwordgrid', name: 'Word Grid', desc: 'Mini crossword puzzle',
        kind: 'daily', icon: '🔤', bestKey: null,
      },
      {
        id: 'minesweeper', name: 'Minesweeper', desc: 'Clear the minefield',
        kind: 'endless', icon: '💣', bestKey: null,
      },
      {
        id: 'watersort', name: 'Water Sort', desc: 'Sort colors into tubes',
        kind: 'endless', icon: '🌈', bestKey: null,
      },
      {
        id: 'mahjong', name: 'Mahjong', desc: 'Classic tile matching',
        kind: 'endless', icon: '🀄', bestKey: null,
      },
    ];

    grid.innerHTML = modes.map(m => {
      const completed = m.kind === 'daily' && Daily.hasCompletedToday(m.id);
      const lbBest    = Leaderboard.getBest(m.id);
      let bestStr = '';
      if (m.id === 'match') {
        const hs = Storage.getModeField('match', 'highScore', 0);
        if (hs) bestStr = `Best: ${hs.toLocaleString()}`;
      } else if (lbBest) {
        bestStr = `Best: ${lbBest.score.toLocaleString()}`;
      }

      return `<button class="hub-card${completed ? ' hub-card-done' : ''}" data-mode="${m.id}" aria-label="Play ${m.name}">
        <div class="hub-card-icon">${m.icon}</div>
        <div class="hub-card-name">${m.name}</div>
        <div class="hub-card-desc">${m.desc}</div>
        ${m.kind === 'daily' ? `<div class="hub-card-badge${completed ? ' done' : ' daily'}">
          ${completed ? '✅ Done' : '📅 Daily'}</div>` : ''}
        ${bestStr ? `<div class="hub-card-best">${bestStr}</div>` : ''}
      </button>`;
    }).join('');

    grid.querySelectorAll('.hub-card').forEach(card => {
      card.addEventListener('click', () => launchMode(card.dataset.mode));
    });
  }

  // ── Launch a mode ────────────────────────────────────────────────

  function launchMode(modeId) {
    if (_currentMode && _currentMode.unmount) _currentMode.unmount();
    _currentMode = null;

    if (_wordleKeydownBound) {
      document.removeEventListener('keydown', _wordleKeydownBound);
      _wordleKeydownBound = null;
    }

    if (modeId === 'match') {
      _showScreen('match');
      // Trigger renderer resize since canvas was hidden (0 dimensions)
      setTimeout(() => {
        if (window._game && window._game.renderer) {
          window._game.renderer.resize();
        }
      }, 0);
      return;
    }

    const modeMap = {
      connector:    typeof ConnectorMode    !== 'undefined' ? ConnectorMode    : null,
      wordle:       typeof WordleMode       !== 'undefined' ? WordleMode       : null,
      miniwordgrid: typeof MiniWordGridMode !== 'undefined' ? MiniWordGridMode : null,
      minesweeper:  typeof MinesweeperMode  !== 'undefined' ? MinesweeperMode  : null,
      watersort:    typeof WaterSortMode    !== 'undefined' ? WaterSortMode    : null,
      mahjong:      typeof MahjongMode      !== 'undefined' ? MahjongMode      : null,
    };

    const mode = modeMap[modeId];
    if (!mode) {
      alert(`Mode "${modeId}" not yet implemented.`);
      return;
    }

    _showScreen(modeId);
    const rootEl = document.getElementById('screen-' + modeId);
    if (!rootEl) return;

    _currentMode = mode;
    mode.mount(rootEl, _ctx);

    const seed = Daily.seedForDate(Daily.todayStr(), modeId);
    mode.start({ daily: true, seed });

    // Attach keyboard for Wordle
    if (modeId === 'wordle' && mode.onKeydown) {
      _wordleKeydownBound = mode.onKeydown.bind(mode);
      document.addEventListener('keydown', _wordleKeydownBound);
    }
  }

  // ── Mode completion callback ─────────────────────────────────────

  function _onModeComplete({ modeId, score, dustEarned }) {
    _updateDustDisplay();
    _renderHubCards(); // Refresh hub cards (e.g., "done" badges)
  }

  // ── Dust display ─────────────────────────────────────────────────

  function _updateDustDisplay() {
    const el = document.getElementById('hub-dust');
    if (el) el.textContent = `✨ ${Economy.getDust().toLocaleString()}`;
    // Also update in-game dust displays
    document.querySelectorAll('.dust-display').forEach(el => {
      el.textContent = `✨ ${Economy.getDust().toLocaleString()}`;
    });
  }

  // ── Settings screen ──────────────────────────────────────────────

  function showSettings() {
    _showScreen('settings');
    _renderSettings();
  }

  function _renderSettings() {
    const root = document.getElementById('screen-settings');
    if (!root) return;
    const s = Settings.getAll();
    root.innerHTML = `
      <div class="settings-wrap">
        <div class="mode-header">
          <button class="btn btn-secondary btn-sm" id="set-back">← Hub</button>
          <h2 class="mode-title">Settings</h2>
        </div>
        <div class="settings-list">
          <label class="settings-row">
            <span>🔊 Sound FX</span>
            <input type="checkbox" id="set-sfx" ${s.sfx ? 'checked' : ''}>
          </label>
          <label class="settings-row">
            <span>📳 Haptics</span>
            <input type="checkbox" id="set-haptics" ${s.haptics ? 'checked' : ''}>
          </label>
          <label class="settings-row">
            <span>🎨 Colorblind Mode</span>
            <input type="checkbox" id="set-colorblind" ${s.colorblind ? 'checked' : ''}>
          </label>
        </div>
        <button class="btn btn-secondary" style="margin-top:16px" id="set-reset">⚠️ Reset All Progress</button>
      </div>`;

    root.querySelector('#set-back').addEventListener('click', showHub);
    root.querySelector('#set-sfx').addEventListener('change', e => Settings.set('sfx', e.target.checked));
    root.querySelector('#set-haptics').addEventListener('change', e => Settings.set('haptics', e.target.checked));
    root.querySelector('#set-colorblind').addEventListener('change', e => {
      Settings.set('colorblind', e.target.checked);
      document.body.classList.toggle('colorblind', e.target.checked);
    });
    root.querySelector('#set-reset').addEventListener('click', () => {
      if (confirm('Reset ALL progress? This cannot be undone.')) {
        localStorage.clear();
        location.reload();
      }
    });
  }

  // ── Stats screen ─────────────────────────────────────────────────

  function showStats() {
    _showScreen('stats');
    _renderStats();
  }

  function _renderStats() {
    const root = document.getElementById('screen-stats');
    if (!root) return;
    const streak = Daily.getStreak();

    const modes = ['match','connector','wordle','miniwordgrid','minesweeper','watersort','mahjong'];
    const rows  = modes.map(m => {
      const best = Leaderboard.getBest(m);
      return `<tr><td>${m}</td><td>${best ? best.score.toLocaleString() : '—'}</td></tr>`;
    }).join('');

    root.innerHTML = `
      <div class="settings-wrap">
        <div class="mode-header">
          <button class="btn btn-secondary btn-sm" id="stats-back">← Hub</button>
          <h2 class="mode-title">Stats</h2>
        </div>
        <div class="stats-streak">
          <div class="stats-streak-count">🔥 ${streak.count}</div>
          <div class="stats-streak-label">Daily Streak</div>
        </div>
        <div class="stats-dust">
          <span class="dust-display">✨ ${Economy.getDust().toLocaleString()}</span>
          <span style="color:var(--text-muted);font-size:13px"> Wizard Dust</span>
        </div>
        <table class="stats-table">
          <thead><tr><th>Mode</th><th>Best Score</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    root.querySelector('#stats-back').addEventListener('click', showHub);
  }

  // ── Shop screen (Unlocks) ────────────────────────────────────────

  function showShop() {
    _showScreen('shop');
    _renderShop();
  }

  function _renderShop() {
    const root = document.getElementById('screen-shop');
    if (!root) return;
    const dust = Economy.getDust();

    const ITEMS = [
      { id: 'theme-sunset',   name: 'Sunset Theme',    cost: 100, emoji: '🌅', type: 'theme' },
      { id: 'theme-ocean',    name: 'Ocean Theme',     cost: 150, emoji: '🌊', type: 'theme' },
      { id: 'theme-forest',   name: 'Forest Theme',    cost: 150, emoji: '🌲', type: 'theme' },
      { id: 'particles-stars',name: 'Star Particles',  cost: 80,  emoji: '⭐', type: 'particles' },
      { id: 'particles-hearts',name: 'Heart Particles',cost: 80,  emoji: '❤️', type: 'particles' },
      { id: 'border-gold',    name: 'Gold Border',     cost: 120, emoji: '✨', type: 'border' },
      { id: 'border-rainbow', name: 'Rainbow Border',  cost: 200, emoji: '🌈', type: 'border' },
    ];

    const unlocks  = Storage.getUnlocks();
    const equipped = Storage.getHubEquipped();
    const ownedAll = [...(unlocks.themes || []), ...(unlocks.particles || []), ...(unlocks.borders || [])];

    root.innerHTML = `
      <div class="settings-wrap">
        <div class="mode-header">
          <button class="btn btn-secondary btn-sm" id="shop-back">← Hub</button>
          <h2 class="mode-title">Shop</h2>
          <span class="dust-display" style="font-size:14px;font-weight:700">✨ ${dust.toLocaleString()}</span>
        </div>
        <div class="shop-grid" id="shop-grid">
          ${ITEMS.map(item => {
            const owned    = ownedAll.includes(item.id);
            const isEquip  = equipped[item.type] === item.id;
            return `<div class="shop-item${owned ? ' owned' : ''}${isEquip ? ' equipped' : ''}" data-id="${item.id}" data-cost="${item.cost}" data-type="${item.type}">
              <div class="shop-item-icon">${item.emoji}</div>
              <div class="shop-item-name">${item.name}</div>
              <div class="shop-item-cost">${owned ? (isEquip ? '✅ On' : '↖ Equip') : `✨ ${item.cost}`}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;

    root.querySelector('#shop-back').addEventListener('click', showHub);

    root.querySelectorAll('.shop-item').forEach(el => {
      el.addEventListener('click', () => {
        const id   = el.dataset.id;
        const cost = parseInt(el.dataset.cost, 10);
        const type = el.dataset.type;
        const already = ownedAll.includes(id);

        if (!already) {
          if (!Economy.spendDust(cost)) {
            el.classList.add('shop-item-shake');
            setTimeout(() => el.classList.remove('shop-item-shake'), 500);
            return;
          }
          // Add to unlocks
          const u = Storage.getUnlocks();
          (u[type + 's'] || (u[type + 's'] = [])).push(id);
          Storage.saveUnlocks(u);
        }

        // Equip
        const e = Storage.getHubEquipped();
        e[type] = id;
        Storage.saveHubEquipped(e);
        _applyCosmetics();
        _renderShop(); // refresh
        _updateDustDisplay();
      });
    });
  }

  // ── Cosmetics ────────────────────────────────────────────────────

  function _applyCosmetics() {
    const e = Storage.getHubEquipped();
    document.body.dataset.theme     = e.theme     || 'default';
    document.body.dataset.particles = e.particles || 'default';
    document.body.dataset.border    = e.border    || 'none';
  }

  // ── Debug panel ──────────────────────────────────────────────────

  function _initDebug() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('debug')) return;

    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#000d;color:#0f0;font:12px monospace;padding:8px;z-index:9999;max-height:40vh;overflow:auto';
    panel.innerHTML = `
      <b>🐛 DEBUG</b> | date: ${Daily.todayStr()} | dust: ${Economy.getDust()}<br>
      <button onclick="Economy.addDust(100);document.getElementById('debug-panel').querySelector('span').textContent=Economy.getDust()">+100 Dust</button>
      <span>${Economy.getDust()}</span>
      | seed(connector): ${Daily.seedForDate(Daily.todayStr(),'connector')}
      | seed(wordle): ${Daily.seedForDate(Daily.todayStr(),'wordle')}
    `;
    document.body.appendChild(panel);
  }

  // ── Init ─────────────────────────────────────────────────────────

  function init() {
    // GameStorage auto-initializes on construction; Settings/Daily are stateless
    _applyCosmetics();
    if (Settings.isColorblind()) document.body.classList.add('colorblind');

    Economy.onChange(_updateDustDisplay);

    // Hub button listeners
    document.getElementById('hub-settings-btn').addEventListener('click', showSettings);
    document.getElementById('hub-stats-btn').addEventListener('click', showStats);
    document.getElementById('hub-shop-btn').addEventListener('click', showShop);

    // Match mode "back to hub" button (injected into match screen header)
    const matchBack = document.getElementById('match-back-btn');
    if (matchBack) matchBack.addEventListener('click', showHub);

    showHub();
    _initDebug();
  }

  return { init, showHub, launchMode, showSettings, showStats, showShop, _onModeComplete };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
