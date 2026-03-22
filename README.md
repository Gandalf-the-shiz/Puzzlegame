# 🧩 Puzzle Hub

> A **NYT Games–style puzzle platform** combining multiple puzzle modes — playable offline via GitHub Pages.

[**▶ Play Now**](https://gandalf-the-shiz.github.io/Puzzlegame/)

**No build tools · No npm · No CDN · Pure HTML/CSS/JS**

---

## 🎮 What Shipped

### Hub / Title Screen
- NYT-style tile grid of all 7 puzzle modes
- Shared top bar: Wizard Dust balance, Shop, Settings, Stats
- Daily streak counter and per-mode "Done today" badges

### Puzzle Modes

| Mode | Type | Description |
|------|------|-------------|
| ♾️ Infinity (match-3) | Endless / Daily / Hardcore | Original match-3 with powerups |
| 🔗 Connector | Daily | Find 4 groups of 4 words |
| 📝 Wordle | Daily | Guess the 5-letter word |
| 🔤 Word Grid | Daily | Mini crossword puzzle |
| 💣 Minesweeper | Endless | Clear the minefield |
| 🌈 Water Sort | Endless | Sort colors into tubes |
| 🀄 Mahjong | Endless | Classic tile matching |

### Match-3 (♾️ Infinity) Features
| Feature | Details |
|---------|---------|
| ♾️ Endless | Classic infinite match-3 |
| 📅 Daily Challenge | Same seeded board every day — build streaks! |
| 💀 Hardcore | Faster ramp, more blockers, fewer power-ups |
| ⚡ Power-ups | 💣 Bomb · 🔀 Shuffle · ↩️ Undo (limited charges) |
| 🏆 Leaderboard | Local top-10 per mode |

---

## 🚀 How to Run

### GitHub Pages
Just push to `main` — GitHub Pages serves `index.html` automatically.

### Locally
```bash
open index.html
# OR serve with any static server:
python3 -m http.server 8080
```

### Debug mode
- `?debug=1` — shows debug panel
- `?devDate=YYYY-MM-DD` — override today's date for testing daily puzzles

---

## 📁 Architecture

```
Puzzlegame/
├── index.html                     ← Single-page hub + all mode screens
├── css/style.css                  ← All styles (hub, modes, themes)
├── js/
│   ├── utils.js                   ← Match-3 constants (unchanged)
│   ├── block.js / board.js        ← Match-3 engine (unchanged)
│   ├── storage.js                 ← Versioned localStorage (single JSON blob)
│   ├── settings.js                ← Shared settings (SFX, haptics, colorblind)
│   ├── daily.js                   ← Daily seeds + streak tracking
│   ├── economy.js                 ← Wizard Dust economy
│   ├── unlocks.js                 ← Match-3 cosmetics catalogue
│   ├── powerups.js                ← Match-3 power-up definitions
│   ├── leaderboard.js             ← Local top-10 per mode
│   ├── app.js                     ← Hub router + screen management
│   ├── modes/
│   │   ├── connector.js
│   │   ├── wordle.js
│   │   ├── miniwordgrid.js
│   │   ├── minesweeper.js
│   │   ├── watersort.js
│   │   └── mahjong.js
│   └── (match-3 engine files)
│       score.js / levels.js / particles.js / audio.js
│       renderer.js / input.js / game.js
└── data/
    ├── connector-puzzles.js       ← 10 hand-authored Connector puzzles
    ├── wordle-words.js            ← 200+ answer words + valid guesses
    └── miniwordgrid-puzzles.js    ← 5 verified 5×5 mini crosswords
```

---

## 🔌 Mode Interface

Every hub mode implements:
```js
const MyMode = (() => {
  function mount(rootEl, ctx) { /* render into rootEl; use ctx.goHub(), ctx.onModeComplete() */ }
  function unmount() { /* clean up timers/listeners */ }
  function start(opts = {}) { /* opts: { daily, seed, difficulty, ... } */ }
  return { id: 'mymode', mount, unmount, start };
})();
```
`ctx.onModeComplete` expects: `{ modeId, score, dustEarned }`

---

## 💾 Save Schema (localStorage)

**One key:** `puzzlegame.save` (JSON, schema v2)

| Field | Type | Description |
|-------|------|-------------|
| `saveVersion` | int | Schema version (2) |
| `highScores` | object | `{ endless, daily, hardcore }` for match-3 |
| `bestLevel` | int | Match-3 best level |
| `dust` | int | Wizard Dust balance |
| `dailyStreak` | object | `{ count, lastDate, perMode: { modeId: date } }` |
| `unlockedItems` | string[] | Match-3 unlock IDs (e.g. `'theme_ocean'`) |
| `equippedItems` | object | Match-3 equipped items |
| `settings` | object | `{ soundOn, musicOn, hapticsOn, colorblindMode }` |
| `leaderboards` | object | Match-3 leaderboards `{ endless, daily, hardcore }` |
| `modeData` | object | Hub mode state (keyed by modeId) |
| `hubLb` | object | Hub mode leaderboards (keyed by modeId) |
| `hubCosmetics` | object | Hub shop unlocks + equipped `{ unlocks, equipped }` |

**Legacy keys migrated on first load:**
- `infinityPuzzle_highScore` → `highScores.endless`
- `infinityPuzzle_bestLevel` → `bestLevel`
- `infinityPuzzle_soundOn`   → `settings.soundOn`

---

## 📅 Daily Seed Logic

```js
// In daily.js — hub mode seeds (Mulberry32)
function seedForDate(dateStr, modeId) {
  const str = dateStr + ':' + modeId;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Match-3 seed (FNV-1a on date string)
function dateToSeed(dateStr) { ... }
```

- Same date + mode → same seed (deterministic)
- `?devDate=YYYY-MM-DD` overrides today's date for testing
- Retries unlimited; streak credit once per day per mode

---

## 💨 Wizard Dust & Shop

All modes earn **Wizard Dust**. Hub shop (`app.js`) handles:
- Cosmetic items: 3 themes, 2 particle styles, 2 UI borders
- Match-3 in-game shop (`unlocks.js`): themes, particles, announcers
- `Economy` module manages dust earn rates per mode

---

## ⚡ Match-3 Power-ups

| Power-up | Description | Endless/Daily | Hardcore |
|----------|-------------|---------------|----------|
| 💣 Bomb Blast | Destroy 3×3 area | 1 charge | 0 |
| 🔀 Shuffle | Re-roll board | 1 charge | 1 |
| ↩️ Undo | Revert last move | 2 charges | 1 |

---

## ➕ How to Add a New Puzzle Mode

1. Create `js/modes/mymode.js` implementing the Mode interface above
2. Add `<div id="screen-mymode" class="app-screen hidden mode-screen"></div>` to `index.html`
3. Load the script before `js/app.js`
4. Add to `modeMap` in `app.js`
5. Add a hub card entry in `_renderHubCards()` in `app.js`

---

## ⚠️ Known Limitations / TODO

### Content
- [ ] Expand Wordle word list (200 → 2000+ answers)
- [ ] Add more Connector puzzle packs (currently 10)
- [ ] Add more Mini Word Grid puzzles (currently 5; need 30+ for daily variety)

### Gameplay
- [ ] Wordle: hard mode (must use revealed letters)
- [ ] Wordle: save in-progress game state (refresh = lost progress)
- [ ] Minesweeper: chord mechanic (tap number to auto-clear matching flags)
- [ ] Water Sort: validate levels are always solvable
- [ ] Mahjong: validate boards are always solvable; more layout templates

### Integration
- [ ] Match-3 Infinity: call `Economy.rewardMatch()` from `game.js` on game over
- [ ] Match-3 daily challenge: use `DailyChallenge.completeDaily()` for streak credit

### Technical
- [ ] Service worker for offline play (PWA)
- [ ] PWA manifest for "Add to Home Screen"
- [ ] Water Sort: animated pour effect (currently instant)

---

## 🤖 Copilot Handoff

**Architecture:** Single static web app, no build tools. All JS uses plain `<script>` tags and globals. Script load order in `index.html` is critical.

**Key globals:**
| Global | File | Used by |
|--------|------|---------|
| `GameStorage` | `storage.js` | match-3 game |
| `Storage` | `storage.js` | alias for `GameStorage` (hub modes) |
| `Settings` | `settings.js` | all modes |
| `DailyChallenge` | `daily.js` | match-3 game |
| `Daily` | `daily.js` | alias for `DailyChallenge` (hub modes) |
| `Economy` | `economy.js` | all modes |
| `Leaderboard` | `leaderboard.js` | all modes |
| `App` | `app.js` | hub router |

**Script load order:**
```
utils.js → block.js → board.js → storage.js → settings.js → daily.js
→ economy.js → unlocks.js → powerups.js → leaderboard.js
→ data/*.js → js/modes/*.js → score.js → levels.js → particles.js
→ audio.js → renderer.js → input.js → game.js → app.js
```

**Where to continue:**
1. Expand word lists: add 2000+ words to `data/wordle-words.js`
2. Add more Connector puzzles to `data/connector-puzzles.js`
3. Integrate `Economy.rewardMatch()` call in `game.js` `_triggerGameOver()`
4. Water Sort solvability check in `watersort.js` `_generateLevel()`
5. PWA: add `manifest.json` and `sw.js`

---

*Built with ❤️ — pure vanilla HTML, CSS, and JavaScript. No dependencies.*
