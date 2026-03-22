# 🧩 Puzzle Hub

> A **NYT Games–style puzzle platform** — multiple puzzle modes in one static app, playable on mobile via GitHub Pages.

**Play at:** `https://gandalf-the-shiz.github.io/Puzzlegame/`  
**No build tools · No npm · No CDN · Pure HTML/CSS/JS**

---

## 🎮 What Shipped in This PR

### Hub / Title Screen
- NYT-style tile grid of all 7 puzzle modes
- Shared top bar: Wizard Dust balance, Shop, Settings, Stats
- Daily streak counter
- "Done today" badges on completed daily modes
- Best score display per mode

### Shared Systems
| System | File | Notes |
|--------|------|-------|
| Versioned storage | `js/storage.js` | Migrates legacy `infinityPuzzle_*` keys |
| Wizard Dust economy | `js/economy.js` | Earned across all modes |
| Daily seeds + streaks | `js/daily.js` | Deterministic by date; `?devDate=YYYY-MM-DD` override |
| Local leaderboards | `js/leaderboard.js` | Top 10 per mode |
| Settings | `js/settings.js` | SFX, haptics, colorblind mode |
| Hub router | `js/app.js` | Single-page screen management |

### Puzzle Modes (all playable v1)
| Mode | Type | File | Status |
|------|------|------|--------|
| ♾️ Infinity (match-3) | Endless | `js/game.js` (unchanged) | ✅ Full |
| 🔗 Connector | Daily | `js/modes/connector.js` | ✅ Full |
| 📝 Wordle | Daily | `js/modes/wordle.js` | ✅ Full |
| 🔤 Word Grid | Daily | `js/modes/miniwordgrid.js` | ✅ Full |
| 💣 Minesweeper | Endless | `js/modes/minesweeper.js` | ✅ Full |
| 🌈 Water Sort | Endless | `js/modes/watersort.js` | ✅ Full |
| 🀄 Mahjong | Endless | `js/modes/mahjong.js` | ✅ Full |

### Cosmetics Shop
- 3 color themes (Sunset, Ocean, Forest)
- 2 particle styles (Stars, Hearts)
- 2 UI borders (Gold, Rainbow)
- All purchasable with Wizard Dust

---

## 🚀 How to Run

### GitHub Pages
Just push to `main` — GitHub Pages serves `index.html` automatically.

### Locally
```bash
# No install needed — just open index.html in a browser
open index.html
# OR serve with any static server:
python3 -m http.server 8080
# then visit http://localhost:8080
```

### Debug mode
Add query params:
- `?debug=1` — shows debug panel (dust, seeds)
- `?devDate=2025-12-25` — override today's date for testing daily puzzles

---

## 📁 Architecture

```
Puzzlegame/
├── index.html                 ← Single-page hub + all mode screens
├── css/
│   └── style.css             ← All styles (hub + modes + themes)
├── js/
│   ├── utils.js              ← Shared constants (match-3 game)
│   ├── storage.js            ← Versioned localStorage (new)
│   ├── economy.js            ← Wizard Dust economy (new)
│   ├── daily.js              ← Daily seeds + streaks (new)
│   ├── leaderboard.js        ← Local top-10 per mode (new)
│   ├── settings.js           ← Shared settings (new)
│   ├── app.js                ← Hub router + screen management (new)
│   ├── modes/
│   │   ├── connector.js      ← Connections-like mode
│   │   ├── wordle.js         ← Wordle-like mode
│   │   ├── miniwordgrid.js   ← Mini crossword mode
│   │   ├── minesweeper.js    ← Minesweeper mode
│   │   ├── watersort.js      ← Water Sort mode
│   │   └── mahjong.js        ← Mahjong Solitaire mode
│   │
│   │   (existing match-3 engine — unchanged)
│   ├── block.js
│   ├── board.js
│   ├── score.js
│   ├── levels.js
│   ├── particles.js
│   ├── audio.js
│   ├── renderer.js
│   ├── input.js
│   └── game.js
└── data/
    ├── connector-puzzles.js  ← 10 hand-authored Connector puzzles
    ├── wordle-words.js       ← 200+ answer words + valid guesses
    └── miniwordgrid-puzzles.js ← 5 hand-authored 5×5 crosswords
```

### Single-page app routing
- `index.html` contains all screens as `<div id="screen-{name}" class="app-screen [hidden]">`
- `app.js` shows/hides screens by toggling the `hidden` class
- The match-3 game lives entirely inside `#screen-match`
- Mode screens are empty `<div>`s — content is mounted/unmounted by each mode's JS

---

## 🔌 Mode Interface

Every mode module must implement:

```js
const MyMode = (() => {
  const MODE_ID = 'mymode';  // must match screen id suffix

  function mount(rootEl, ctx) {
    // Called once per launch. Render into rootEl.
    // ctx provides: ctx.goHub(), ctx.onModeComplete(result)
  }

  function unmount() {
    // Clean up timers, event listeners, etc.
  }

  function start(opts = {}) {
    // opts: { daily, seed, difficulty, ... }
    // Called after mount() and on replay.
  }

  return { id: MODE_ID, mount, unmount, start };
})();
```

`ctx.onModeComplete` expects: `{ modeId, score, dustEarned }`

To register a new mode in `app.js`, add it to the `modeMap` object and add a screen div in `index.html`:
```html
<div id="screen-mymode" class="app-screen hidden mode-screen"></div>
```

---

## 💾 Save Schema (localStorage)

**Schema version:** `1`  
**Key prefix:** `puzzlegame.`

| Key | Type | Description |
|-----|------|-------------|
| `puzzlegame.schemaVersion` | int | Migration version |
| `puzzlegame.economy.dust` | int | Wizard Dust balance |
| `puzzlegame.settings` | JSON | `{ sfx, music, haptics, colorblind }` |
| `puzzlegame.unlocks` | JSON | `{ themes[], particles[], borders[] }` |
| `puzzlegame.equipped` | JSON | `{ theme, particles, border }` |
| `puzzlegame.daily.streak` | JSON | `{ count, lastDate, perMode: { modeId: date } }` |
| `puzzlegame.modes.{id}` | JSON | Mode-specific data (high scores, etc.) |
| `puzzlegame.lb.{id}` | JSON | Leaderboard entries array (top 10) |
| `puzzlegame.modes.match.highScore` | int | Migrated from `infinityPuzzle_highScore` |

**Legacy keys migrated on first load:**
- `infinityPuzzle_highScore` → `puzzlegame.modes.match.highScore`
- `infinityPuzzle_bestLevel` → `puzzlegame.modes.match.bestLevel`
- `infinityPuzzle_soundOn` → `puzzlegame.settings.sfx`

---

## 📅 Daily Seed Logic

```js
// In daily.js
function seedForDate(dateStr, modeId) {
  // djb2-style hash of "YYYY-MM-DD:modeId"
  const str = dateStr + ':' + modeId;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Seeded RNG: Mulberry32
function seededRng(seed) {
  let s = seed >>> 0;
  return function () { /* Mulberry32 */ };
}
```

- Same date + mode always yields same seed (deterministic)
- `?devDate=YYYY-MM-DD` overrides today's date for testing
- Retries are unlimited; streak credit is given only once per day per mode

---

## ➕ How to Add a New Puzzle Mode

1. Create `js/modes/mymode.js` implementing the Mode interface above
2. Add `<div id="screen-mymode" class="app-screen hidden mode-screen"></div>` to `index.html`
3. Load the script in `index.html` before `js/app.js`
4. Add to `modeMap` in `app.js`:
   ```js
   mymode: typeof MyMode !== 'undefined' ? MyMode : null,
   ```
5. Add a card to `_renderHubCards()` in `app.js`:
   ```js
   { id: 'mymode', name: 'My Mode', desc: 'Description', kind: 'daily', icon: '🎯' }
   ```
6. Add dust rewards in `js/economy.js` if needed
7. If it has hand-authored data, add a file in `data/`

---

## ⚠️ Known Limitations / TODO

### Connector
- [ ] Add more puzzle packs (currently 10; daily cycles through them)
- [ ] One Away detection could highlight colors that are "close"

### Wordle
- [ ] Expand word list (currently 200 answers + 250 valid guesses; aim for 2000+)
- [ ] Add hard mode (must use revealed letters)
- [ ] Save in-progress game state (refresh = lost progress)

### Mini Word Grid
- [ ] Add more puzzles (currently 5; need 30+ for daily variety)
- [ ] Auto-numbering could be smarter (currently hand-numbered)
- [ ] Mobile virtual keyboard doesn't auto-appear for grid inputs

### Minesweeper
- [ ] Add a "chord" mechanic (tap revealed number to auto-clear if flags match)
- [ ] Best time leaderboard per difficulty

### Water Sort
- [ ] Validate that generated levels are always solvable (current shuffle may create unsolvable states — needs solvability check)
- [ ] Add more colors / level scaling at higher levels
- [ ] Animated pour effect (currently instant)

### Mahjong
- [ ] Add more layout templates (currently Turtle + Bridge with ~50 tiles each)
- [ ] Validate that generated boards are always solvable
- [ ] Tile sets customization (currently emoji only)
- [ ] Improve free-tile detection — current algorithm uses position overlap but layout coords may need tuning

### Match-3 (Infinity)
- [ ] Hook into new economy system (currently earns Dust on game over only at hub card level)
- [ ] Add daily challenge (specific seed + score target = 15,000 pts)

### Hub
- [ ] Animated tile transitions when navigating
- [ ] Push notifications for daily streaks (PWA)
- [ ] "New" badge on first-time-seen modes

### Economy / Shop
- [ ] More cosmetic items (tile skins, announcer packs)
- [ ] Animated dust earn counter when completing modes
- [ ] Daily dust bonus (login reward)

### Technical
- [ ] Service worker for offline play
- [ ] PWA manifest for "Add to Home Screen"
- [ ] Keyboard navigation for all mode UIs

---

## 🤖 Copilot Handoff

**Context:** This is a single static web app (no build tools, no npm). All JS uses plain `<script>` tags and global variables. New files must be loaded in `index.html` in dependency order.

**Where to continue:**

1. **Most impactful next step:** Expand word lists for Wordle (add 2000+ words to `data/wordle-words.js`) and add 25+ Connector puzzles to `data/connector-puzzles.js` to give 6+ weeks of unique daily content.

2. **Water Sort solvability:** `js/modes/watersort.js` `_generateLevel()` shuffles by doing random pours. Add a post-generation check that the puzzle is solvable (backtracking solver), or switch to a "generate solved → reverse N steps" approach.

3. **Mahjong layout fixes:** The turtle/bridge layouts in `mahjong.js` use `[layer, row, col]` coordinates. The rendering math in `_renderBoard()` converts to pixel positions. Verify visually and adjust the layout arrays if tiles don't look right.

4. **Daily content:** Both Connector and Word Grid use seeded RNG to pick from a fixed puzzle array. Expanding those arrays is the easiest way to add content without code changes.

5. **Match-3 integration:** In `game.js` `_triggerGameOver()`, call `Economy.rewardMatch(this.score.score, false, false)` to award Dust when match-3 ends. The `Economy` global is available by the time `game.js` runs.

6. **PWA setup:** Add `manifest.json` and a service worker (`sw.js`) to enable "Add to Home Screen" and offline play on iOS/Android.

**Key globals available everywhere:**
- `Storage` — `storage.js`
- `Economy` — `economy.js`
- `Daily` — `daily.js`
- `Leaderboard` — `leaderboard.js`
- `Settings` — `settings.js`
- `App` — `app.js` (hub router)
- `CONNECTOR_PUZZLES` — `data/connector-puzzles.js`
- `WORDLE_ANSWERS`, `WORDLE_VALID` — `data/wordle-words.js`
- `MINIWORDGRID_PUZZLES` — `data/miniwordgrid-puzzles.js`

**Script load order in index.html:**
```
utils.js → storage.js → settings.js → daily.js → economy.js → leaderboard.js
→ data/*.js → js/modes/*.js → match-3 engine → app.js
```

---

## 📱 Browser Support

- iOS Safari 14+, Chrome for Android, Firefox, Edge
- GitHub Pages (static hosting)
- No WebAssembly, no WebGL, no service worker (yet)

---

*Built with ❤️ — pure vanilla HTML, CSS, and JavaScript. No dependencies.*
