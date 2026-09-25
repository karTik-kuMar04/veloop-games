# 🎮 Veloop Games — Premium Arcade & Casual Gaming Platform

Welcome to **Veloop Games**, a modern, responsive web application built with **React 18**, **Vite**, and custom **CSS Modules**. The platform features fully playable arcade and puzzle games, a shared multi-game coin economy, real-time physics particle engines, high-score tracking, interactive tutorial overlays, revive systems, and an in-app Redeem Rewards center.

---

## 🚀 Quick Start (Running Locally)

Follow these steps to set up and run Veloop Games on your local machine:

### 1. Prerequisites
Ensure you have **Node.js** (v18.0.0 or higher) installed on your system.

### 2. Installation
Clone the repository and install the dependencies using `pnpm` or `npm`:

```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

### 3. Start Development Server
Launch the local Vite development server with hot module replacement (HMR):

```bash
# Using pnpm
pnpm dev

# Or using npm
npm run dev
```

Open your browser and navigate to:
👉 **`http://localhost:3000`** (or `http://localhost:5173`)

### 4. Production Build & Preview
To build the application for production and test the optimized bundle:

```bash
# Build production bundle
pnpm build

# Preview production build locally
pnpm preview
```

---

## 🛠️ Tech Stack & Technologies Used

| Technology / Library | Purpose & Implementation |
| :--- | :--- |
| **React 18** | Functional component architecture, custom hooks, and context providers. |
| **Vite 5** | High-performance build tooling, fast HMR, and production bundling. |
| **React Router DOM v6** | Client-side routing between Home, Game Catalog, Game Detail, and Redeem pages. |
| **Vanilla CSS Modules (`*.module.css`)** | Scoped modular CSS, custom CSS Variables, HSL color tokens, dark mode glassmorphism, and responsive breakpoints. |
| **HTML5 Canvas 2D API** | Custom high-DPR (Retina) game renderer for physics, slicing collisions, particles, and trajectory calculations. |
| **Context API + `useReducer`** | Global wallet state management (`WalletContext`) for coin banking, XP, transaction history, and persistent best scores. |
| **Lucide React** | Modern vector UI icon set across HUDs, menus, buttons, and reward badges. |
| **Framer Motion** | Fluid animations for modal overlays and UI transitions. |
| **LocalStorage API** | Automatic persistence of player currency, transaction logs, inventory items, and high scores across page reloads. |

---

## 🏗️ Architecture & Core System Features

### 1. 🪙 Unified Economy System (`WalletContext.jsx`)
- **Shared Currency (Game Coins)**: Every playable game converts in-game points directly into shared Game Coins at custom rates. Coins are stored centrally in a global React Context.
- **Revive System**: Players can spend **50 Game Coins** at the Game Over screen to revive their run with 1 life and keep their score.
- **XP Progression**: Playing runs awards XP to level up player profiles.
- **Transaction Logs**: Tracks the last 60 transactions (earnings, revives, store redemptions) with precise timestamps.
- **LocalStorage Persistence**: Currency balance and high scores survive browser reloads.

### 2. 🛡️ Reusable Game Shell Framework (`GameShell.jsx`)
- **Standard Lifecycle**: `GameHome` (hero presentation) ➔ `GameGuide` (interactive rules) ➔ `GameHud` / Gameplay ➔ `GameOver` / `Revive` Modal.
- **Game HUD**: Live score tracker, high score display, pause menu, quit button, and life counters.
- **High Score Celebration**: Triggers animated 3D graffiti high-score banners when breaking personal best records.

---

## 🎯 Fully Playable Games & Detailed Feature Breakdown

### 🍉 1. Slice Storm (Arcade Fruit Slicer)
*A high-velocity arcade slicing game featuring realistic 2D canvas fruit physics, freeze time, golden multiplier fruits, explosive bombs, and multi-slice combos.*

#### 📋 Rules to Play:
1. **Swipe / Drag to Slice**: Drag your mouse or swipe across touchscreen to slice flying fruits in real-time.
2. **3 Lives System**: You start with 3 hearts. Allowing an uncut fruit to fall off the bottom of the screen costs **1 Life**.
3. **Avoid Bombs**: Slicing an explosive bomb detonates it instantly and costs **1 Life**.
4. **Coin Banking**: Every **5 Points** converts into **1 Game Coin** upon run completion.

#### 🌟 Open, Hidden & Micro-Features:
- **🍉 5 Custom Hand-Drawn Fruit Recipes**:
  - *Watermelon*: Deep green striped rind with red flesh & black seeds.
  - *Orange*: Dimpled citrus peel texture with pulp segments.
  - *Apple*: Glossy red skin with stem and green leaf attached.
  - *Kiwi*: Fuzzy brown skin with bright green flesh and ring of kiwi seeds.
  - *Plum*: Deep purple body with golden inner core.
- **❄️ Apex Projectile Freeze Orb (Special Item)**:
  - Slicing a blue ice orb triggers a 5.0-second **Frost Mode** (`isFrozen`).
  - Fruits and bombs launch smoothly from below, rise to the high point (apex) of their parabolic trajectory, and **lock completely in place** in mid-air with an animated **Icy Frost Aura Ring** (`drawFrostOverlay`).
  - When the 5-second freeze expires, gravity and normal physics resume, and any uncut fruits resume falling down.
- **🌟 Golden Multiplier Fruit (Special Item)**:
  - Glowing golden fruit surrounded by a shimmering yellow aura. Slicing it awards **+2 Double Points** and golden sparkle particles.
- **⚡ Multi-Slice Combos**:
  - Slicing 2 or more fruits in a single continuous drag awards bonus combo points (`+Count Bonus`) accompanied by a floating `X× COMBO!` banner.
- **💣 Bomb Proximity Warning**:
  - Bombs near the peak of their trajectory pulse a glowing red danger warning ring (`warn` state) and trigger screen-shake + haptic vibration (`navigator.vibrate`) when detonated.
- **🏆 In-Game High Score Graffiti**:
  - Surpassing your personal best score during an active run instantly triggers a splattered `"⚡ NEW HIGH SCORE! ⚡"` graffiti popup across the canvas.

---

### 🧩 2. Merge Master (2048 Block Puzzle)
*A sleek, responsive 4x4 block sliding and merging puzzle game with spring-physics animation, combo alerts, high tile celebrations, and move history.*

#### 📋 Rules to Play:
1. **Slide the Board**: Press Arrow Keys, WASD, or swipe touch gestures to slide all grid tiles simultaneously.
2. **Merge Matching Tiles**: When two tiles with matching numbers collide, they combine into a single tile with double the value ($2 \rightarrow 4 \rightarrow 8 \rightarrow \dots \rightarrow 2048+$).
3. **Prevent Grid Lockout**: A new tile ($2$ or $4$) spawns in a random empty cell after every valid slide. The game ends when no moves or merges remain.
4. **Coin Banking**: Every **40 Points** converts into **1 Game Coin**.

#### 🌟 Open, Hidden & Micro-Features:
- **🎯 Hardware-Accelerated Sliding**: Uses CSS `transform: translate3d()` with custom spring bezier curves for fluid tile movement without layout shifts.
- **👑 New Highest Tile Crown & Shockwave**:
  - Merging a tile higher than your previous run record triggers a radial golden shockwave (`newMaxShockwave`), glowing golden border, and a bobbing golden crown sparkle.
- **↺ Single-Step Undo Button**:
  - Allows players to reverse their last move if a mis-swipe occurs, using an internal grid state history stack.
- **💥 Combo Multi-Merge Alert**:
  - Executing 3 or more merges in a single direction slide triggers a `"+X MULTI-MERGE!"` floating alert text.
- **📊 Real-time Stats**:
  - Live moves counter, current score tracking, and persistent best-score badge.

---

## 🎨 Upcoming Games Showcase (Catalog)

The home carousel and catalog include pre-launch preview cards for 11 additional titles:

| Game Title | Category | Tagline / Short Description |
| :--- | :--- | :--- |
| **Blade Master** | Arcade | Aim. Throw. Hit Perfect target precision! |
| **Nutcraft** | Puzzle | Twist and unscrew nuts and bolts. |
| **Bowlexa** | Sports | Aim, swing the rope, and knock down all pins. |
| **Block Crush** | Arcade | Smash blocks and clear chaotic levels. |
| **Cosmo Warrior** | Shooter | Blast alien invaders across the galaxy. |
| **Toilet Tactics** | Strategy | Defend the city and destroy waves of enemies. |
| **Word Hunt** | Word | Search hidden words and expand vocabulary. |
| **Bubble Blast Legend** | Arcade | Aim, shoot, and match color bubbles. |
| **Wormzy** | Puzzle | Guide Wormzy through tricky fruit mazes. |
| **Aqua Fill** | Puzzle | Draw physics lines to fill the glass with water. |
| **Realm Clash** | Strategy | Build your empire and conquer rival realms. |

---

## 🛍️ Redeem Center & Store Architecture

Players can visit the **Redeem Center** to spend their hard-earned Game Coins on digital items:

- **XP Boost Pack** (Cost: 100 Coins) — Adds +100 XP to account profile.
- **Gem Chest** (Cost: 250 Coins) — Unlocks premium gem currency.
- **VIP Player Title** (Cost: 500 Coins) — Unlocks exclusive badge styling.
- **Life Revive Pass** (Cost: 50 Coins) — Automatic revive token.

Includes a **Live Transaction History Log** displaying timestamped records of every earned score conversion and spent redemption.

---

## 📂 Project Directory Structure

```text
veloop-games/
├── index.html
├── package.json
├── vite.config.js
├── README.md
├── src/
│   ├── main.jsx                 # Vite entry point & React root render
│   ├── App.jsx                  # Main router setup & layout shell
│   ├── data/
│   │   └── games.js             # Central catalog database for all 13 games
│   ├── store/
│   │   └── WalletContext.jsx    # Global coin economy, XP, history & localStorage
│   ├── components/
│   │   ├── Navbar.jsx           # Top header navigation & live Coin balance
│   │   ├── BottomNav.jsx        # Mobile bottom navigation bar
│   │   ├── CoinBadge.jsx        # Animated coin counter display badge
│   │   └── game/
│   │       ├── GameShell.jsx    # Unified GameHome, GameGuide, GameHud & GameOver UI
│   │       └── GameShell.module.css
│   ├── pages/
│   │   ├── Home.jsx             # Platform landing page & hero games carousel
│   │   ├── Games.jsx            # Filterable games directory & category tabs
│   │   ├── GameDetail.jsx       # Individual game preview page
│   │   ├── Redeem.jsx           # Coin reward store & transaction log page
│   │   └── games/
│   │       ├── SliceStorm.jsx   # Fruit Ninja 2D canvas slicer engine
│   │       ├── SliceStorm.module.css
│   │       ├── MergeMaster.jsx  # 2048 tile merge puzzle engine
│   │       └── MergeMaster.module.css
│   └── styles/
│       ├── index.css            # Global CSS design tokens & reset
│       └── theme.css            # Color palettes & typography definitions
```

---

## 📝 Credits & License

Built with ❤️ by **Kartik Kumar** for the Veloop Gaming Assignment.
All game assets, UI components, and canvas mechanics designed and implemented from scratch.