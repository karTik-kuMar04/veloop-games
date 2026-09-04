# VELOOP Games

The Games Banner section for VELOOP Rewards — a horizontally auto-scrolling carousel of 13 games, with two of them (**Slice Storm** and **Merge Master**) fully playable end-to-end and backed by a shared Game Coins economy.

## Tech stack

- **React** + **Vite**
- **React Router** for navigation between the home carousel, individual game pages, and the redeem center
- **CSS Modules** (`.module.css`) for all component styling, built around a shared set of `--vl-*` design tokens (color, spacing, radius, shadow)
- **Lucide React** for icons

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view it locally (Vite's default port — check your terminal output if it differs).

To build for production:

```bash
npm run build
npm run preview
```

## Project structure

```
src/
  components/
    game/
      GameShell.jsx        # Shared flow wrapper for playable games:
                            # home -> guide -> countdown -> playing -> revive/over
    GameMarquee.jsx         # Slim auto-drifting ticker of all 13 games
    PlayableSpotlight.jsx   # Featured row for the 2 fully playable games
    BannerCard.jsx          # Individual game card in the catalog grid
    PlayBand.jsx            # Shared "+XP / Play Now" strip used across cards
    TopBar.jsx               # Desktop/tablet navigation header
    BottomNav.jsx            # Mobile-only tab bar (hidden on tablet/desktop)
  data/
    games.js                # Central catalog of all 13 games
  store/
    WalletContext.js         # Shared Game Coins balance, earn/spend logic
  screens/
    Home.jsx                 # Marquee + spotlight + filterable catalog grid
    games/
      SliceStorm.jsx          # Fruit-slicing arcade game
      MergeMaster.jsx         # 2048-style sliding tile merge game
```

## Games

### Slice Storm
Swipe to slice flying fruit, chain combos across a single swipe, and avoid slicing bombs. A 3-2-1 countdown leads into each run; running out of lives ends it. Coins convert from your final score.

### Merge Master
A 4x4 sliding-tile merge game — arrow keys, WASD, or swipe merge matching tiles into higher values. A move is only valid if it changes the board; the run ends when no merges or empty cells remain.

Both games share the same flow (home → how-to-play guide → countdown → gameplay → revive-or-game-over), the same Game Coins wallet, and a Revive option that costs coins to continue after a run ends.

## Game Coins

Coins are earned from gameplay and shared across every game in the catalog. Entering any playable game costs a fixed number of Tokens; coins are spent to Revive after a run ends, and are redeemable for rewards (VE, SVE, Gems, Tokens, Spins) in the Redeem center.

## Design

The app shell (home, navigation, redeem center) uses a dark, premium palette — deep navy and charcoal with gold, silver, and soft violet accents, no neon or rainbow gradients. Game home pages use a lighter theme distinct from the dashboard shell. The game catalog carousel uses dot indicators and swipe/drag/wheel navigation only — no arrow buttons, on any screen size.

The layout is responsive from 320px phones through tablet and desktop, with `TopBar` handling navigation on wider screens and `BottomNav` taking over below the tablet breakpoint.