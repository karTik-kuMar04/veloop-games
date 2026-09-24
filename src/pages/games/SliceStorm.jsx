import { useCallback, useEffect, useRef, useState } from "react"
import { Heart, Pause, Play, RotateCcw } from "lucide-react"
import { getGame } from "../../data/games"
import { useWallet } from "../../store/WalletContext"
import { GameGuide, GameHome, GameHud, GameOver } from "../../components/game/GameShell"
import styles from "./SliceStorm.module.css"

const GAME = getGame("slice-storm")
const REVIVE_COST = 50
const COINS_PER_POINT = 1 / 5 // 1 coin per 5 points
const START_LIVES = 3

const GUIDE = [
  { title: "Swipe to slice", body: "Drag across the screen to cut flying fruit. Each slice scores points." },
  { title: "Chain combos", body: "Slice several fruit in one swipe for bonus combo points." },
  { title: "Freeze & Golden fruit", body: "Slice blue ice orbs to freeze fruit in midair! Slice golden fruit for double points." },
  { title: "Avoid bombs", body: "Slicing a bomb ends a life. Miss too many fruit and it is game over." },
  { title: "Bank your coins", body: "Every 5 points converts into 1 shared Game Coin at the end of a run." },
]

// ---------------------------------------------------------------------------
// Fruit catalogue — each entry is a small "recipe" the renderer uses to draw
// a recognizable fruit instead of a flat circle. Colors are picked to read
// clearly against the dark stage background.
// ---------------------------------------------------------------------------
const FRUIT_KINDS = [
  {
    id: "watermelon",
    rind: "#1b7a3d",
    rindDark: "#0e5227",
    flesh: "#ef5a6f",
    fleshDark: "#c93850",
    seeds: "#2b1810",
    hasStripes: true,
  },
  {
    id: "orange",
    rind: "#f2932e",
    rindDark: "#c66d13",
    flesh: "#ffb648",
    fleshDark: "#f2932e",
    seeds: "#8a5a1e",
    hasSegments: true,
  },
  {
    id: "apple",
    rind: "#e0334d",
    rindDark: "#a81f36",
    flesh: "#fdf3d0",
    fleshDark: "#e9dcab",
    seeds: "#4a2c17",
    hasStem: true,
  },
  {
    id: "kiwi",
    rind: "#7a5a34",
    rindDark: "#5a3f22",
    flesh: "#bcd94a",
    fleshDark: "#8fae2e",
    seeds: "#241a08",
    hasKiwiSeeds: true,
  },
  {
    id: "plum",
    rind: "#6d3fa0",
    rindDark: "#4a2670",
    flesh: "#ffd9a8",
    fleshDark: "#f0b96e",
    seeds: "#5a3210",
    hasStem: true,
  },
]

const FREEZE_KIND = {
  id: "freeze",
  rind: "#38bdf8",
  rindDark: "#0284c7",
  flesh: "#7dd3fc",
  fleshDark: "#0369a1",
  seeds: "#e0f2fe",
  isFreeze: true,
}

const GOLDEN_KIND = {
  id: "golden",
  rind: "#facc15",
  rindDark: "#ca8a04",
  flesh: "#fef08a",
  fleshDark: "#eab308",
  seeds: "#713f12",
  isGolden: true,
}

function rand(min, max) {
  return Math.random() * (max - min) + min
}
function randInt(min, max) {
  return Math.floor(rand(min, max + 1))
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}
function lerp(a, b, t) {
  return a + (b - a) * t
}

// ---------------------------------------------------------------------------
// Haptics: navigator.vibrate() feature detection and safety checks
// ---------------------------------------------------------------------------
function vibrate(pattern) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (prefersReducedMotion) return
  navigator.vibrate(pattern)
}

export default function SliceStorm() {
  const { earn, recordScore, bestScores, coins, spend, canAfford } = useWallet()
  const [screen, setScreen] = useState("home") // home | guide | countdown | playing | revive | over
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [comboInfo, setComboInfo] = useState(null) // { count, bonus } | null
  const [coinsEarned, setCoinsEarned] = useState(0)
  const [countdownValue, setCountdownValue] = useState(3) // 3, 2, 1, then "Go!"
  const [isPaused, setIsPaused] = useState(false)
  const [lifeLost, setLifeLost] = useState(false)
  const [prevBest, setPrevBest] = useState(0)
  const [showGraffiti, setShowGraffiti] = useState(false)

  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const stateRef = useRef(null)
  const goTimeoutRef = useRef(null)
  const lifeLostTimerRef = useRef(null)
  const isPausedRef = useRef(false)
  const startBestRef = useRef(0)
  isPausedRef.current = isPaused

  function triggerLifeLost() {
    setLifeLost(true)
    if (lifeLostTimerRef.current) clearTimeout(lifeLostTimerRef.current)
    lifeLostTimerRef.current = setTimeout(() => setLifeLost(false), 550)
  }

  function freshState() {
    return {
      objects: [], // whole fruit / bombs still flying
      halves: [], // sliced fruit halves flying apart
      particles: [], // juice droplets
      popups: [], // floating score text
      blade: [], // recent pointer points for the trail
      slicing: false,
      lastSpawn: 0,
      score: 0,
      lives: START_LIVES,
      running: false,
      spawnGap: 900,
      shake: 0, // screen-shake magnitude
      flash: 0, // red damage flash opacity
      freezeTimer: 0, // freeze duration in ms
      freezeCooldown: 0, // strict cooldown ms before next freeze item can spawn
      newRecordPopped: false,
      elapsed: 0,
      coinsAwarded: 0, // coins already credited in current run
    }
  }
  if (!stateRef.current) stateRef.current = freshState()

  const best = bestScores[GAME.id] || 0

  const endRun = useCallback(
    (finalScore, viaRevive, opts = {}) => {
      cancelAnimationFrame(rafRef.current)
      stateRef.current.running = false
      setIsPaused(false)
      const totalCoins = Math.floor(finalScore * COINS_PER_POINT)
      const prevAwarded = stateRef.current.coinsAwarded || 0
      const deltaCoins = Math.max(0, totalCoins - prevAwarded)
      stateRef.current.coinsAwarded = totalCoins
      setCoinsEarned(totalCoins)
      if (deltaCoins > 0) earn(deltaCoins, `Slice Storm · ${finalScore} pts`, GAME.xp)
      recordScore(GAME.id, finalScore)
      if (!opts.skipVibration) vibrate(120)
      setScreen(viaRevive ? "over" : "revive")
    },
    [earn, recordScore],
  )

  function lighten(hex, amt) {
    const c = hex.replace("#", "")
    const num = parseInt(c, 16)
    let r = (num >> 16) & 0xff
    let g = (num >> 8) & 0xff
    let b = num & 0xff
    r = Math.round(lerp(r, 255, amt))
    g = Math.round(lerp(g, 255, amt))
    b = Math.round(lerp(b, 255, amt))
    return `rgb(${r},${g},${b})`
  }

  // ---------------------------------------------------------------------
  // Drawing helpers
  // ---------------------------------------------------------------------
  function drawFreezeOrb(ctx, o, dpr) {
    const r = o.r
    ctx.save()
    ctx.translate(o.x, o.y)
    ctx.rotate(o.rot)

    // outer frosty halo
    ctx.save()
    ctx.globalAlpha = 0.45
    ctx.fillStyle = "#38bdf8"
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // crystal orb body
    const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05)
    body.addColorStop(0, "#f0f9ff")
    body.addColorStop(0.3, "#7dd3fc")
    body.addColorStop(0.7, "#0284c7")
    body.addColorStop(1, "#0c4a6e")
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()

    // 6-pointed snowflake
    ctx.save()
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = Math.max(2, r * 0.11)
    ctx.lineCap = "round"
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI / 3)
      ctx.beginPath()
      ctx.moveTo(-r * 0.65, 0)
      ctx.lineTo(r * 0.65, 0)
      ctx.stroke()
      // small ice crystal branch
      ctx.beginPath()
      ctx.moveTo(r * 0.4, -r * 0.18)
      ctx.lineTo(r * 0.5, 0)
      ctx.lineTo(r * 0.4, r * 0.18)
      ctx.moveTo(-r * 0.4, -r * 0.18)
      ctx.lineTo(-r * 0.5, 0)
      ctx.lineTo(-r * 0.4, r * 0.18)
      ctx.stroke()
    }
    ctx.restore()

    // glossy highlight
    ctx.save()
    ctx.globalAlpha = 0.7
    const hi = ctx.createRadialGradient(-r * 0.4, -r * 0.45, 0, -r * 0.4, -r * 0.45, r * 0.45)
    hi.addColorStop(0, "#ffffff")
    hi.addColorStop(1, "#ffffff00")
    ctx.fillStyle = hi
    ctx.beginPath()
    ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.35, r * 0.22, -0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.restore()
  }

  function drawGoldenFruit(ctx, o, dpr) {
    const r = o.r
    ctx.save()
    ctx.translate(o.x, o.y)
    ctx.rotate(o.rot)

    // golden aura
    ctx.save()
    ctx.globalAlpha = 0.4
    ctx.fillStyle = "#facc15"
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // golden body
    const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05)
    body.addColorStop(0, "#fef9c3")
    body.addColorStop(0.35, "#facc15")
    body.addColorStop(0.75, "#ca8a04")
    body.addColorStop(1, "#713f12")
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()

    // golden sparkle stars
    ctx.save()
    ctx.fillStyle = "#ffffff"
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2
      const dist = r * 0.55
      ctx.beginPath()
      ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, r * 0.08, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // glossy highlight
    ctx.save()
    ctx.globalAlpha = 0.8
    const hi = ctx.createRadialGradient(-r * 0.4, -r * 0.45, 0, -r * 0.4, -r * 0.45, r * 0.45)
    hi.addColorStop(0, "#ffffff")
    hi.addColorStop(1, "#ffffff00")
    ctx.fillStyle = hi
    ctx.beginPath()
    ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.35, r * 0.22, -0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.restore()
  }

  function drawFruit(ctx, o, dpr) {
    if (o.special === "freeze") {
      drawFreezeOrb(ctx, o, dpr)
      return
    }
    if (o.special === "golden") {
      drawGoldenFruit(ctx, o, dpr)
      return
    }

    const kind = o.kind
    const r = o.r

    ctx.save()
    ctx.translate(o.x, o.y)
    ctx.rotate(o.rot)

    // soft contact shadow
    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.fillStyle = "#000000"
    ctx.beginPath()
    ctx.ellipse(r * 0.12, r * 0.22, r * 0.9, r * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // base body gradient
    const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r * 1.05)
    body.addColorStop(0, lighten(kind.rind, 0.35))
    body.addColorStop(0.55, kind.rind)
    body.addColorStop(1, kind.rindDark)
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()

    // watermelon stripes
    if (kind.hasStripes) {
      ctx.save()
      ctx.clip()
      ctx.strokeStyle = kind.rindDark
      ctx.lineWidth = r * 0.16
      ctx.globalAlpha = 0.55
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath()
        ctx.ellipse(i * r * 0.32, 0, r * 0.22, r * 1.15, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }

    // orange dimpled texture
    if (kind.hasSegments) {
      ctx.save()
      ctx.clip()
      ctx.fillStyle = kind.rindDark
      ctx.globalAlpha = 0.35
      for (let i = 0; i < 22; i++) {
        const a = o.textureSeed[i * 2] * Math.PI * 2
        const rad = o.textureSeed[i * 2 + 1] * r * 0.85
        ctx.beginPath()
        ctx.arc(Math.cos(a) * rad, Math.sin(a) * rad, r * 0.035, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // stem + leaf
    if (kind.hasStem) {
      ctx.save()
      ctx.strokeStyle = "#5a3f22"
      ctx.lineWidth = Math.max(2, r * 0.09)
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(0, -r * 0.92)
      ctx.quadraticCurveTo(r * 0.08, -r * 1.15, r * 0.02, -r * 1.32)
      ctx.stroke()
      ctx.fillStyle = "#3f8a3f"
      ctx.beginPath()
      ctx.ellipse(r * 0.22, -r * 1.12, r * 0.22, r * 0.11, -0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // kiwi seeds
    if (kind.hasKiwiSeeds) {
      ctx.save()
      ctx.clip()
      ctx.fillStyle = "#c8dc7a"
      ctx.globalAlpha = 0.4
      for (let i = 0; i < 30; i++) {
        const a = o.textureSeed[i % o.textureSeed.length] * Math.PI * 2
        const rad = (((i * 37) % 100) / 100) * r * 0.9
        ctx.beginPath()
        ctx.arc(Math.cos(a + i) * rad, Math.sin(a + i) * rad, r * 0.025, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // glossy highlight
    ctx.save()
    ctx.globalAlpha = 0.5
    const hi = ctx.createRadialGradient(-r * 0.4, -r * 0.45, 0, -r * 0.4, -r * 0.45, r * 0.45)
    hi.addColorStop(0, "#ffffff")
    hi.addColorStop(1, "#ffffff00")
    ctx.fillStyle = hi
    ctx.beginPath()
    ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.4, r * 0.28, -0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.restore()
  }

  function drawFruitHalf(ctx, h) {
    const kind = h.kind
    const r = h.r
    ctx.save()
    ctx.translate(h.x, h.y)
    ctx.rotate(h.rot)
    ctx.globalAlpha = clamp(h.life / h.maxLife, 0, 1)

    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI, h.flip)
    ctx.closePath()

    const flesh = ctx.createLinearGradient(0, -r, 0, r)
    flesh.addColorStop(0, lighten(kind.flesh, 0.15))
    flesh.addColorStop(1, kind.fleshDark)
    ctx.fillStyle = flesh
    ctx.fill()

    ctx.lineWidth = Math.max(2, r * 0.14)
    ctx.strokeStyle = kind.rind
    ctx.beginPath()
    ctx.arc(0, 0, r - ctx.lineWidth / 2, 0, Math.PI, h.flip)
    ctx.stroke()

    ctx.fillStyle = kind.seeds
    for (let i = 0; i < h.seedDots.length; i += 2) {
      const sx = h.seedDots[i] * r * 0.7
      const sy = h.seedDots[i + 1] * r * 0.55 * (h.flip ? 1 : -1)
      ctx.beginPath()
      ctx.ellipse(sx, sy, r * 0.045, r * 0.07, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  function drawBomb(ctx, o) {
    const r = o.r
    ctx.save()
    ctx.translate(o.x, o.y)
    ctx.rotate(o.rot)

    ctx.save()
    ctx.globalAlpha = 0.22
    ctx.fillStyle = "#000000"
    ctx.beginPath()
    ctx.ellipse(r * 0.12, r * 0.22, r * 0.9, r * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    if (o.warn > 0) {
      ctx.save()
      ctx.globalAlpha = 0.35 * o.warn
      ctx.strokeStyle = "#ef4444"
      ctx.lineWidth = r * 0.22
      ctx.beginPath()
      ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r)
    body.addColorStop(0, "#3a4356")
    body.addColorStop(0.5, "#1b2130")
    body.addColorStop(1, "#05070c")
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.strokeStyle = "#0b0d14"
    ctx.lineWidth = r * 0.22
    ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.ellipse(0, r * 0.05, r * 0.98, r * 0.32, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    // fuse
    ctx.save()
    ctx.strokeStyle = "#8a6a3a"
    ctx.lineWidth = Math.max(2, r * 0.12)
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.95)
    ctx.quadraticCurveTo(r * 0.18, -r * 1.25, r * 0.06, -r * 1.5)
    ctx.stroke()
    ctx.restore()

    // spark at fuse tip
    const sparkPulse = 0.6 + 0.4 * Math.sin(o.sparkPhase)
    ctx.save()
    ctx.translate(r * 0.06, -r * 1.5)
    const spark = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.32 * sparkPulse)
    spark.addColorStop(0, "#fff6d0")
    spark.addColorStop(0.4, "#ffb648")
    spark.addColorStop(1, "#ffb64800")
    ctx.fillStyle = spark
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.32 * sparkPulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // glossy metallic highlight
    ctx.save()
    ctx.globalAlpha = 0.6
    const hi = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 0, -r * 0.35, -r * 0.4, r * 0.3)
    hi.addColorStop(0, "#ffffff")
    hi.addColorStop(1, "#ffffff00")
    ctx.fillStyle = hi
    ctx.beginPath()
    ctx.arc(-r * 0.35, -r * 0.4, r * 0.28, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.restore()
  }

  // ---------------------------------------------------------------------
  // Slice reaction
  // ---------------------------------------------------------------------
  function sliceFruit(s, o, dpr, hitAngle) {
    const isFreeze = o.special === "freeze"
    const isGolden = o.special === "golden"
    if (isFreeze) {
      s.freezeTimer = 5000 // 5 seconds freeze duration
      s.freezeCooldown = 12000 // 12s cooldown before next freeze orb can spawn
    }

    const kind = o.kind || FRUIT_KINDS[0]
    for (let side = 0; side < 2; side++) {
      const flip = side === 0
      const dir = side === 0 ? -1 : 1
      s.halves.push({
        kind,
        x: o.x,
        y: o.y,
        r: o.r,
        rot: o.rot + (flip ? -0.2 : 0.2),
        vr: dir * rand(0.06, 0.12),
        vx: o.vx + dir * rand(0.5, 1.1) * dpr + Math.cos(hitAngle) * dir * 0.4 * dpr,
        vy: o.vyReal * 0.6 - rand(0.1, 0.35) * dpr,
        g: 0.0015,
        flip,
        life: 1,
        maxLife: 1,
        decay: rand(0.012, 0.018),
        seedDots: o.seedDotsCache,
      })
    }

    const juiceColor = isFreeze ? "#38bdf8" : isGolden ? "#facc15" : kind.flesh
    const n = randInt(12, 18)
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2)
      const speed = rand(0.4, 1.8) * dpr
      s.particles.push({
        x: o.x,
        y: o.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - rand(0.2, 0.6) * dpr,
        g: 0.0018,
        r: rand(2, 5) * dpr,
        color: juiceColor,
        life: 1,
        decay: rand(0.02, 0.035),
      })
    }

    const popupText = isFreeze ? "FREEZE ❄️" : isGolden ? "+2 ✦" : "+1"
    const popupColor = isFreeze ? "#38bdf8" : isGolden ? "#fde047" : "#fef08a"
    s.popups.push({
      x: o.x,
      y: o.y,
      text: popupText,
      color: popupColor,
      life: 1,
      vy: -0.35 * dpr,
    })
  }

  function bombBurst(s, o, dpr) {
    const n = randInt(18, 24)
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2)
      const speed = rand(0.6, 2.4) * dpr
      s.particles.push({
        x: o.x,
        y: o.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        g: 0.0012,
        r: rand(2, 6) * dpr,
        color: i % 2 === 0 ? "#ff8a3d" : "#4b4b4b",
        life: 1,
        decay: rand(0.018, 0.03),
      })
    }
    s.shake = Math.max(s.shake, 14 * dpr)
    s.flash = 1
    vibrate([40, 40, 60])
  }

  // ---------------------------------------------------------------------
  // Main game loop
  // ---------------------------------------------------------------------
  const startLoop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function resize() {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
    }
    resize()

    const s = stateRef.current
    s.running = true
    let last = performance.now()

    function spawn(w, h) {
      const isBomb = Math.random() < 0.16
      let special = null
      if (!isBomb) {
        // Strict freeze rules:
        // 1. Never more than 1 freeze orb on screen at a time
        // 2. Never spawn while freeze is active
        // 3. Never spawn while freeze cooldown is ticking (14s after activation)
        const hasFreezeOnScreen = s.objects.some((obj) => !obj.sliced && obj.special === "freeze")
        const canSpawnFreeze = !hasFreezeOnScreen && s.freezeTimer <= 0 && s.freezeCooldown <= 0

        const roll = Math.random()
        if (canSpawnFreeze && roll < 0.035) {
          special = "freeze"
        } else if (roll < 0.12) {
          special = "golden"
        }
      }
      // Widen spawn across full playable stage (15% to 85% width)
      const x = rand(w * 0.15, w * 0.85)
      const minDim = Math.min(w, h)
      // Balanced arcade sizing so fruits are crisp and pleasant to slice
      const minR = Math.max(26, minDim * 0.06)
      const maxR = Math.max(40, minDim * 0.095)
      const r = rand(minR, maxR)
      const textureSeed = Array.from({ length: 44 }, () => Math.random())

      s.objects.push({
        x,
        y: 0,
        r,
        vx: 0,
        vyReal: 0,
        color: null,
        bomb: isBomb,
        special,
        kind: isBomb ? null : special === "freeze" ? FREEZE_KIND : special === "golden" ? GOLDEN_KIND : pick(FRUIT_KINDS),
        sliced: false,
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.05, 0.05),
        textureSeed,
        seedDotsCache: Array.from({ length: 10 }, () => rand(-1, 1)),
        sparkPhase: rand(0, Math.PI * 2),
        warn: 0,
      })
    }

    function frame(now) {
      if (!s.running) return
      if (isPausedRef.current) {
        last = now
        rafRef.current = requestAnimationFrame(frame)
        return
      }

      const dt = Math.min(now - last, 40)
      last = now
      s.elapsed += dt
      if (s.freezeCooldown > 0) {
        s.freezeCooldown = Math.max(0, s.freezeCooldown - dt)
      }
      const w = canvas.width
      const h = canvas.height

      // decaying screen shake offset
      s.shake *= 0.9
      if (s.shake < 0.05) s.shake = 0
      const shakeX = s.shake ? rand(-1, 1) * s.shake : 0
      const shakeY = s.shake ? rand(-1, 1) * s.shake : 0

      ctx.save()
      ctx.translate(shakeX, shakeY)

      // background gradient & vignette
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, "#0d1b2e")
      bg.addColorStop(1, "#152238")
      ctx.fillStyle = bg
      ctx.fillRect(-4 * dpr, -4 * dpr, w + 8 * dpr, h + 8 * dpr)
      const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75)
      vignette.addColorStop(0, "#00000000")
      vignette.addColorStop(1, "#00000055")
      ctx.fillStyle = vignette
      ctx.fillRect(-4 * dpr, -4 * dpr, w + 8 * dpr, h + 8 * dpr)

      // Freeze duration & frosty tint overlay
      const isFrozen = s.freezeTimer > 0
      if (isFrozen) {
        s.freezeTimer = Math.max(0, s.freezeTimer - dt)
        ctx.save()
        const frost = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.8)
        frost.addColorStop(0, "rgba(56, 189, 248, 0.08)")
        frost.addColorStop(1, "rgba(56, 189, 248, 0.28)")
        ctx.fillStyle = frost
        ctx.fillRect(-4 * dpr, -4 * dpr, w + 8 * dpr, h + 8 * dpr)

        ctx.font = `bold ${15 * dpr}px system-ui, sans-serif`
        ctx.fillStyle = "#bae6fd"
        ctx.textAlign = "center"
        const secLeft = (s.freezeTimer / 1000).toFixed(1)
        ctx.fillText(`❄️ FROZEN · ${secLeft}s`, w / 2, 45 * dpr)
        ctx.restore()
      }

      // Spawning with difficulty ramp (continues during freeze so items keep being thrown)
      s.lastSpawn += dt
      const rampProgress = clamp(s.elapsed / 15000, 0, 1)
      const minGap = lerp(560, 420, rampProgress)
      if (s.lastSpawn > s.spawnGap) {
        s.lastSpawn = 0
        spawn(w, h)
        s.spawnGap = Math.max(minGap, s.spawnGap - lerp(3, 6, rampProgress))
      }

      // ---- whole fruit / bombs: physics + warning state + draw ----
      for (const o of s.objects) {
        if (o.vyReal === 0) {
          const gravityPerMs = 0.0015 * dpr
          const targetHeight = rand(0.4, 0.75) * h
          o.launchX = o.x

          if (isFrozen) {
            // Throw directly into visible midair play area and suspend immovable!
            o.y = h - targetHeight
            o.vyReal = 0.05 * dpr // initial downward nudge for when freeze wears off
          } else {
            o.y = h + o.r
            o.vyReal = -Math.sqrt(2 * gravityPerMs * targetHeight)
          }

          // Inward launch angle based on launch position
          if (o.x < w * 0.35) {
            o.vx = rand(0.08, 0.28) * dpr
          } else if (o.x > w * 0.65) {
            o.vx = rand(-0.28, -0.08) * dpr
          } else {
            o.vx = rand(-0.15, 0.15) * dpr
          }
        }

        // Immovable in midair while frozen (0 movement/rotation); when freeze wears off, physics & gravity resume!
        const objDt = isFrozen ? 0 : dt
        o.vyReal += 0.0015 * dpr * objDt
        o.y += o.vyReal * objDt
        o.x += o.vx * objDt
        o.rot += o.vr * (isFrozen ? 0 : 1)
        o.sparkPhase += dt * 0.02

        if (o.bomb) {
          const nearTop = o.y < h * 0.35 && o.vyReal < 0
          o.warn = nearTop ? clamp(o.warn + dt * 0.006, 0, 1) : Math.max(0, o.warn - dt * 0.004)
        }

        if (!o.sliced) {
          if (o.bomb) drawBomb(ctx, o)
          else drawFruit(ctx, o, dpr)
        }
      }

      // remove off-screen whole objects & count misses (fruit only)
      s.objects = s.objects.filter((o) => {
        if (o.y > h + o.r * 2 && o.vyReal > 0) {
          if (!o.sliced && !o.bomb) {
            s.lives -= 1
            setLives(s.lives)
            triggerLifeLost()
            if (s.lives <= 0) {
              endRun(s.score, false)
              return false
            }
          }
          return false
        }
        return true
      })

      // ---- sliced halves ----
      for (const hlf of s.halves) {
        hlf.vy += hlf.g * dt
        hlf.x += hlf.vx * dt
        hlf.y += hlf.vy * dt
        hlf.rot += hlf.vr
        hlf.life -= hlf.decay
        drawFruitHalf(ctx, hlf)
      }
      s.halves = s.halves.filter((hlf) => hlf.life > 0 && hlf.y < h + hlf.r * 3)

      // ---- juice particles ----
      ctx.save()
      for (const p of s.particles) {
        p.vy += p.g * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.life -= p.decay
        ctx.globalAlpha = clamp(p.life, 0, 1)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      s.particles = s.particles.filter((p) => p.life > 0)

      // ---- score popups ----
      ctx.save()
      ctx.font = `bold ${26 * dpr}px system-ui, sans-serif`
      ctx.textAlign = "center"
      for (const pop of s.popups) {
        pop.y += pop.vy * dt
        pop.life -= dt * 0.0016
        ctx.globalAlpha = clamp(pop.life, 0, 1)
        ctx.fillStyle = pop.color || "#fef08a"
        ctx.fillText(pop.text, pop.x, pop.y)
      }
      ctx.restore()
      s.popups = s.popups.filter((pop) => pop.life > 0)

      // ---- blade trail ----
      if (s.blade.length > 1) {
        for (let i = 1; i < s.blade.length; i++) {
          const t = i / s.blade.length
          ctx.strokeStyle = `rgba(254, 240, 138, ${t})`
          ctx.lineWidth = 4 * dpr * t
          ctx.lineCap = "round"
          ctx.beginPath()
          ctx.moveTo(s.blade[i - 1].x, s.blade[i - 1].y)
          ctx.lineTo(s.blade[i].x, s.blade[i].y)
          ctx.stroke()
        }
      }
      if (s.blade.length) s.blade = s.blade.slice(-14)

      ctx.restore()

      // damage flash
      if (s.flash > 0) {
        ctx.save()
        ctx.globalAlpha = s.flash * 0.35
        ctx.fillStyle = "#ef4444"
        ctx.fillRect(0, 0, w, h)
        ctx.restore()
        s.flash *= 0.88
        if (s.flash < 0.02) s.flash = 0
      }

      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)

    return resize
  }, [endRun])

  useEffect(() => {
    if (screen !== "playing") return
    const cleanup = startLoop()
    const onResize = () => cleanup && cleanup()
    window.addEventListener("resize", onResize)
    return () => {
      cancelAnimationFrame(rafRef.current)
      stateRef.current.running = false
      window.removeEventListener("resize", onResize)
    }
  }, [screen, startLoop])

  // 3-2-1-Go countdown
  useEffect(() => {
    if (screen !== "countdown") return
    setCountdownValue(3)
    let value = 3
    const tick = window.setInterval(() => {
      value -= 1
      if (value <= 0) {
        window.clearInterval(tick)
        setCountdownValue("Go!")
        goTimeoutRef.current = window.setTimeout(() => setScreen("playing"), 500)
        return
      }
      setCountdownValue(value)
    }, 800)
    return () => {
      window.clearInterval(tick)
      if (goTimeoutRef.current) {
        window.clearTimeout(goTimeoutRef.current)
        goTimeoutRef.current = null
      }
    }
  }, [screen])

  // pointer slicing
  const handlePointer = useCallback(
    (clientX, clientY) => {
      if (isPausedRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const px = (clientX - rect.left) * dpr
      const py = (clientY - rect.top) * dpr
      const s = stateRef.current
      const prevPoint = s.blade[s.blade.length - 1]
      s.blade.push({ x: px, y: py })
      const hitAngle = prevPoint ? Math.atan2(py - prevPoint.y, px - prevPoint.x) : 0

      let hitThisMove = 0
      for (const o of s.objects) {
        if (o.sliced) continue
        const d = Math.hypot(o.x - px, o.y - py)
        if (d < o.r + 6 * dpr) {
          o.sliced = true
          if (o.bomb) {
            bombBurst(s, o, dpr)
            s.lives -= 1
            setLives(s.lives)
            triggerLifeLost()
            if (s.lives <= 0) {
              endRun(s.score, false, { skipVibration: true })
              return
            }
          } else {
            sliceFruit(s, o, dpr, hitAngle)
            hitThisMove += 1
            const pts = o.special === "golden" ? 2 : 1
            s.score += pts
          }
        }
      }
      if (hitThisMove > 0) {
        let bonus = 0
        if (hitThisMove > 1) {
          bonus = hitThisMove
          s.score += bonus
        }
        setScore(s.score)
        // Graffiti effect celebration when breaking personal best score
        if (startBestRef.current > 0 && s.score > startBestRef.current && !s.newRecordPopped) {
          s.newRecordPopped = true
          setShowGraffiti(true)
          window.setTimeout(() => setShowGraffiti(false), 2400)
        }
        if (hitThisMove > 1) {
          setComboInfo({ count: hitThisMove, bonus })
          if (handlePointer._t) window.clearTimeout(handlePointer._t)
          handlePointer._t = window.setTimeout(() => setComboInfo(null), 850)
        }
      }
    },
    [endRun],
  )

  function onPointerDown(e) {
    if (isPaused) return
    stateRef.current.slicing = true
    stateRef.current.blade = []
    const t = e.touches ? e.touches[0] : e
    handlePointer(t.clientX, t.clientY)
  }
  function onPointerMove(e) {
    if (isPaused || !stateRef.current.slicing) return
    const t = e.touches ? e.touches[0] : e
    handlePointer(t.clientX, t.clientY)
  }
  function onPointerUp() {
    stateRef.current.slicing = false
  }

  function beginRun() {
    stateRef.current = freshState()
    const currentBest = bestScores[GAME.id] || 0
    startBestRef.current = currentBest
    setPrevBest(currentBest)
    setShowGraffiti(false)
    setIsPaused(false)
    setScore(0)
    setLives(START_LIVES)
    setComboInfo(null)
    setCoinsEarned(0)
    setLifeLost(false)
    setScreen("countdown")
  }

  function handleRevive() {
    if (!canAfford(REVIVE_COST)) return
    const ok = spend(REVIVE_COST, "Revive · Slice Storm")
    if (!ok) return

    const s = stateRef.current
    s.objects = []
    s.halves = []
    s.particles = []
    s.popups = []
    s.blade = []
    s.slicing = false
    s.lives = 1
    s.lastSpawn = 0
    s.spawnGap = 900
    s.shake = 0
    s.flash = 0
    s.freezeTimer = 0

    setLives(1)
    setComboInfo(null)
    setIsPaused(false)

    if (screen === "playing") {
      cancelAnimationFrame(rafRef.current)
      s.running = false
      startLoop()
    } else {
      setScreen("playing")
    }
  }

  if (screen === "home") {
    return (
      <GameHome
        game={GAME}
        best={best}
        onStart={beginRun}
        onGuide={() => setScreen("guide")}
      />
    )
  }
  if (screen === "guide") {
    return <GameGuide game={{ ...GAME, coinsPer: "5" }} steps={GUIDE} onStart={beginRun} onBack={() => setScreen("home")} />
  }
  if (screen === "countdown") {
    return (
      <div className={styles.stage} style={{ "--accent": GAME.accent }}>
        <div className={styles.countdownWrap}>
          <div key={countdownValue} className={styles.countdownNumber}>
            {countdownValue}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.stage} style={{ "--accent": GAME.accent }}>
      <GameHud
        game={GAME}
        score={score}
        onQuit={() => {
          cancelAnimationFrame(rafRef.current)
          stateRef.current.running = false
          setScreen("home")
        }}
        extra={
          <div className={styles.hudActions}>
            <div
              className={`${styles.lives} ${lifeLost ? styles.lifeLostShake : ""}`}
              aria-label={`${lives} lives left`}
            >
              {Array.from({ length: START_LIVES }).map((_, i) => (
                <Heart
                  key={i}
                  size={19}
                  className={i < lives ? styles.heartActive : styles.heartEmpty}
                  fill={i < lives ? "currentColor" : "none"}
                />
              ))}
            </div>
            <button
              type="button"
              className={styles.pauseBtn}
              onClick={() => setIsPaused((p) => !p)}
              aria-label={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} />}
            </button>
          </div>
        }
      />

      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        />
        {showGraffiti && (
          <div className={styles.inGameGraffiti}>
            <div className={styles.inGameGraffitiSplatter} />
            <div className={styles.inGameGraffitiText}>
              ⚡ NEW HIGH SCORE! ⚡
            </div>
          </div>
        )}
        {comboInfo && (
          <div className={styles.combo}>
            <div className={styles.comboCount}>{comboInfo.count}× COMBO!</div>
            <div className={styles.comboBonus}>+{comboInfo.bonus} bonus</div>
          </div>
        )}
      </div>

      {isPaused && (
        <div className={styles.pauseOverlay}>
          <div className={styles.pauseCard}>
            <h2 className={styles.pauseTitle}>Game Paused</h2>
            <p className={styles.pauseText}>Take a quick breather. Ready to jump back in?</p>
            <div className={styles.pauseActions}>
              <button
                type="button"
                className={styles.primaryPauseBtn}
                onClick={() => setIsPaused(false)}
              >
                <Play size={18} fill="currentColor" /> Resume
              </button>
              <button
                type="button"
                className={styles.ghostPauseBtn}
                onClick={() => {
                  setIsPaused(false)
                  beginRun()
                }}
              >
                <RotateCcw size={17} /> Restart
              </button>
              <button
                type="button"
                className={styles.quitPauseBtn}
                onClick={() => {
                  setIsPaused(false)
                  cancelAnimationFrame(rafRef.current)
                  stateRef.current.running = false
                  setScreen("home")
                }}
              >
                Quit to menu
              </button>
            </div>
          </div>
        </div>
      )}

      {(screen === "revive" || screen === "over") && (
        <GameOver
          game={GAME}
          score={score}
          coinsEarned={coinsEarned}
          prevBest={prevBest}
          isRevive={screen === "revive" && coins >= REVIVE_COST}
          onRevive={handleRevive}
          onRetry={beginRun}
          onHome={() => setScreen("home")}
        />
      )}
    </div>
  )
}