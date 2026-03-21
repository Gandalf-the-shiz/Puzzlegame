# ♾️ Infinity Puzzle

> The endless, addicting, match-3 hybrid puzzle game — built for mobile browsers, playable anywhere.

**Open `index.html` in any browser to play!** No build tools, no install, no CDN — pure HTML/CSS/JS.

---

## 🎮 How to Play

1. **Tap** a colored block to select it (it glows)
2. **Tap** an adjacent block to swap them
3. **Match 3 or more** same-colored blocks in a row or column
4. Matched blocks disappear, new blocks fall in from above
5. Chain matches for **cascades** and massive combos!
6. The game ends when no valid moves remain

### Block Types
| Block | Effect |
|-------|--------|
| 🟥🟩🟦 Colored | Match 3+ same color for points |
| 🔢 Number | Match 3+ same value → merge into 2× value |
| 💣 Bomb | Explodes and clears a 3×3 area around it |
| 🌈 Rainbow | Matches any color! |
| ⬛ Blocker | Can't be moved — clear blocks around it |

### Controls
- **Tap** to select, **tap adjacent** to swap
- **Swipe** directly to swap in a direction
- Works with touch and mouse

---

## ✨ Features

- **Endless gameplay** — no time limit, just match until you run out of moves
- **Progressive difficulty** — new colors, special blocks, and faster refills unlock each level
- **Combo system** — chain matches within 3 seconds for multiplied points
  - 2× "Nice! 😎" → 5× "LEGENDARY! ⚡" → 10× "ARE YOU A WIZARD?! 🧙‍♂️" → 20× "CALL THE POLICE! 🚨"
- **Cascade chains** — matches that trigger more matches score exponentially higher
- **High score persistence** — your best score is saved in `localStorage` forever
- **Particle effects** — colorful explosions on every match
- **Screen shake** — satisfying feedback for powerful moves
- **Web Audio API sounds** — procedurally generated, no audio files needed
- **Mute toggle** — tap 🔊 to silence
- **Mobile-first** — designed for phone screens, works in portrait mode, safe area aware
- **No dependencies** — zero npm, zero build steps, zero CDN

---

## 📁 Architecture

```
Puzzlegame/
├── index.html        ← Entry point, minimal HTML shell
├── css/
│   └── style.css     ← Mobile-first responsive design
├── js/
│   ├── utils.js      ← Constants, color palette, easing functions
│   ├── block.js      ← Block class (NORMAL/NUMBER/BOMB/RAINBOW/BLOCKER)
│   ├── board.js      ← Grid logic: matching, gravity, move validation
│   ├── score.js      ← ScoreManager: combos, multipliers, localStorage
│   ├── levels.js     ← LevelManager: progressive difficulty curves
│   ├── particles.js  ← ParticleSystem: colorful explosion effects
│   ├── audio.js      ← AudioManager: Web Audio API sounds
│   ├── renderer.js   ← Canvas renderer: blocks, animations, tweening
│   ├── input.js      ← InputHandler: touch/mouse/swipe
│   └── game.js       ← Game controller: state machine, game loop
└── README.md
```

---

## 🏆 Scoring

| Action | Points |
|--------|--------|
| 3-block match | 30 pts |
| 4-block match | 80 pts |
| 5+ block match | 150+ pts |
| Cascade chain | +50% per depth |
| Combo (2+) | +25% per combo level |
| Level multiplier | +10% per level |

---

## 📱 Browser Support

Works in any modern mobile or desktop browser:
- Chrome, Firefox, Safari, Edge
- iOS Safari, Chrome for Android
- GitHub mobile browser

---

*Built with ❤️ — pure vanilla HTML, CSS, and JavaScript.*
