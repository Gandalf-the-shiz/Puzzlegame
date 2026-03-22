# ♾️ Infinity Puzzle

> **A crazy-addictive match-3 puzzle game** with daily challenges, meta-progression, power-ups, and hardcore mode — playable entirely offline via GitHub Pages.

[**▶ Play Now**](https://gandalf-the-shiz.github.io/Puzzlegame/)

---

## 🎮 Game Modes

| Mode | Description |
|---|---|
| ♾️ **Endless** | Classic infinite match-3. Difficulty ramps up forever. |
| 📅 **Daily Challenge** | Same seeded board for every player each day. Build streaks! |
| 💀 **Hardcore** | Faster level ramp, more blockers, limited power-ups. |

---

## 📅 Daily Challenge & Streaks

- A new seeded board is generated each calendar day (consistent for every player).
- Playing the daily challenge counts towards your **streak counter**.
- Streaks are tracked even if you don't win — just play!
- **Streak Milestone Rewards:**
  | Streak | Reward |
  |--------|--------|
  | 3 days | 🌊 Ocean Theme + 50 💨 |
  | 7 days | ⭐ Stars Particles + 100 💨 |
  | 14 days | 🏆 Sports Announcer + 200 💨 |
  | 30 days | ⚡ Neon Theme + 500 💨 |

---

## 💨 Wizard Dust & Unlocks

**Wizard Dust** is the in-game currency earned by playing:
- 1 dust per 100 score points
- 5 dust per level-up
- 25 bonus dust for completing the Daily Challenge

### Shop Categories

| Category | Items |
|---|---|
| 🎨 **Themes** | Classic, 🌊 Ocean (100💨), 🌅 Sunset (150💨), 🌲 Forest (200💨), ⚡ Neon (300💨) |
| ✨ **Particles** | Classic, ⭐ Stars (100💨), 🎉 Confetti (200💨), 💫 Sparkles (300💨) |
| 📣 **Announcers** | 🧙 Wizard, 🏆 Sports (100💨), 🤖 Robot (200💨) |

All items are **purely cosmetic** — no pay-to-win.

---

## ⚡ Power-ups

Three power-ups per run with limited charges (use wisely!):

| Power-up | Description | Charges (Endless/Daily) | Charges (Hardcore) |
|---|---|---|---|
| 💣 **Bomb Blast** | Tap to destroy a 3×3 area | 1 | 0 |
| 🔀 **Shuffle** | Re-roll every block on the board | 1 | 1 |
| ↩️ **Undo** | Revert to the board before your last move | 2 | 1 |

A confirmation prompt appears before each use to prevent accidents.

---

## 🏆 Leaderboards

- **Local leaderboard** (top 10) stored in your browser for each mode.
- Shown on the Game Over screen with your current rank highlighted.
- No backend required — fully private and offline.

---

## ⚙️ Settings

| Setting | Default |
|---|---|
| 🔊 Sound Effects | On |
| 🎵 Background Music | Off |
| 📳 Haptics / Vibration | On |
| 👁️ Colorblind Palette | Off |

---

## 🏗️ Architecture

```
js/
  storage.js    — Versioned localStorage save/load with v1 migration
  settings.js   — Player preferences
  daily.js      — Deterministic daily seed (seeded PRNG) + streak logic
  unlocks.js    — Cosmetic catalogue (themes, particles, announcers)
  powerups.js   — Powerup definitions + run-time charge management
  leaderboard.js— Top-10 leaderboard per mode
  score.js      — Scoring, combos, Wizard Dust accumulation
  levels.js     — Progressive difficulty (Endless & Hardcore configs)
  particles.js  — Particle effects with 4 style modes
  audio.js      — Procedural SFX + optional background music
  renderer.js   — Canvas rendering with theme-aware block colours
  board.js      — Grid logic (matching, gravity, move validation)
  block.js      — Block types and behaviour
  input.js      — Touch + mouse input (tap & swipe)
  game.js       — Main controller: modes, power-ups, overlays, loop
css/
  style.css     — Mobile-first responsive UI
index.html      — Single-page app shell
```

### Save Schema (localStorage `puzzlegame.save`)

```json
{
  "saveVersion": 2,
  "highScores":   { "endless": 0, "daily": 0, "hardcore": 0 },
  "bestLevel":    1,
  "dust":         0,
  "dailyStreak":  { "count": 0, "lastDate": null },
  "unlockedItems": ["theme_default", "particles_classic", "announcer_wizard"],
  "equippedItems": { "theme": "theme_default", "particles": "particles_classic", "announcer": "announcer_wizard" },
  "settings":     { "soundOn": true, "musicOn": false, "hapticsOn": true, "colorblindMode": false },
  "leaderboards": { "endless": [], "daily": [], "hardcore": [] }
}
```

High scores from the original game (v1 `infinityPuzzle_highScore` key) are automatically migrated to the new format.

---

## 📱 GitHub Pages / Offline Play

- Works on **mobile Safari, Chrome, Firefox** — no installation required.
- Fully offline after first load (no CDN, no server).
- Safe-area insets for notched iPhones/Androids.
- Prevents accidental scroll/zoom on the game canvas.

---

## �� Developer Debug

Set `const DEBUG = true;` in `js/daily.js`, then add `?devDate=YYYY-MM-DD` to the URL to test daily challenge for any specific date.
