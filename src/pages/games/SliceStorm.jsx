import { useCallback, useEffect, useRef, useState } from "react"
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
// Haptics: navigator.vibrate() only exists on Chromium-based mobile browsers
// (Android Chrome, Samsung Internet, etc.) — iOS Safari and desktop browsers
// never implemented it and Safari's vendor position is to not support it, so
// this must feature-detect and silently no-op everywhere it's unavailable
// rather than throw. It also requires a real user gesture in the same event
// tick to fire at all, which both call sites below satisfy (a pointer-down
// slice handler, and a run-ending event that itself always originates from
// a slice or a spawn-triggered miss check inside that same handler chain).
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
  const { earn, recordScore, bestScores, coins, spend } = useWallet()
  const [screen, setScreen] = useState("home") // home | guide | countdown | playing | revive | over
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [combo, setCombo] = useState(0)
  const [coinsEarned, setCoinsEarned] = useState(0)
  const [countdownValue, setCountdownValue] = useState(3) // 3, 2, 1, then "Go!"

  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const stateRef = useRef(null)
  const goTimeoutRef = useRef(null) // pending "Go!" -> "playing" timeout during countdown

  function freshState() {
    return {
      objects: [], // whole fruit / bombs still flying
      halves: [], // sliced fruit halves flying apart
      particles: [], // juice droplets
      popups: [], // floating "+1" style score text
      blade: [], // recent pointer points for the trail
      slicing: false,
      lastSpawn: 0,
      score: 0,
      lives: START_LIVES,
      running: false,
      spawnGap: 900,
      shake: 0, // current screen-shake magnitude, decays each frame
      flash: 0, // red damage flash opacity, decays each frame
      elapsed: 0, // ms since run start, drives difficulty ramp
    }
  }
  if (!stateRef.current) stateRef.current = freshState()

  const best = bestScores[GAME.id] || 0

  const endRun = useCallback(
    (finalScore, viaRevive, opts = {}) => {
      cancelAnimationFrame(rafRef.current)
      stateRef.current.running = false
      const earnedCoins = Math.floor(finalScore * COINS_PER_POINT)
      setCoinsEarned(earnedCoins)
      if (earnedCoins > 0) earn(earnedCoins, `Slice Storm · ${finalScore} pts`, GAME.xp)
      recordScore(GAME.id, finalScore)
      // Longer single buzz for "the run just ended" — distinct from the
      // shorter double-pulse used for a bomb hit specifically, so a life
      // lost to a missed fruit (no bomb pulse) still gets its own cue.
      // Skipped when the caller already fired a bomb-hit vibration in the
      // same tick, since vibrate() replaces rather than queues patterns.
      if (!opts.skipVibration) vibrate(120)
      setScreen(viaRevive ? "over" : "revive")
    },
    [earn, recordScore],
  )

  // ---------------------------------------------------------------------
  // Drawing helpers — pure functions of (ctx, object). Kept outside the
  // frame loop body for readability; still called every frame per object,
  // so they stay simple canvas calls with no allocations beyond gradients.
  // ---------------------------------------------------------------------
  function drawFruit(ctx, o, dpr) {
    const kind = o.kind
    const r = o.r

    ctx.save()
    ctx.translate(o.x, o.y)
    ctx.rotate(o.rot)

    // soft contact shadow beneath the fruit, drawn first so it sits under it
    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.fillStyle = "#000000"
    ctx.beginPath()
    ctx.ellipse(r * 0.12, r * 0.22, r * 0.9, r * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // base body with a rounded gradient so it reads as spherical, not flat
    const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r * 1.05)
    body.addColorStop(0, lighten(kind.rind, 0.35))
    body.addColorStop(0.55, kind.rind)
    body.addColorStop(1, kind.rindDark)
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()

    // watermelon stripes: a handful of darker arcs following the curvature
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

    // orange dimpled texture: a scatter of tiny darker pores
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

    // apple / plum highlight stem + small leaf for silhouette recognizability
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

    // kiwi: fuzzy speckled rind
    if (kind.hasKiwiSeeds) {
      ctx.save()
      ctx.clip()
      ctx.fillStyle = "#c8dc7a"
      ctx.globalAlpha = 0.4
      for (let i = 0; i < 30; i++) {
        const a = o.textureSeed[i % o.textureSeed.length] * Math.PI * 2
        const rad = ((i * 37) % 100) / 100 * r * 0.9
        ctx.beginPath()
        ctx.arc(Math.cos(a + i) * rad, Math.sin(a + i) * rad, r * 0.025, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // glossy highlight — the single detail that most sells "round and shiny"
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
    // A half is drawn as the flesh cross-section (flat cut edge) with a rind
    // rim around the curved outside — this is what makes a "slice" read as
    // an actual cut rather than the whole fruit just fading out.
    const kind = h.kind
    const r = h.r
    ctx.save()
    ctx.translate(h.x, h.y)
    ctx.rotate(h.rot)
    ctx.globalAlpha = clamp(h.life / h.maxLife, 0, 1)

    ctx.beginPath()
    // half-circle: flat edge along local x-axis, dome on the +y or -y side
    ctx.arc(0, 0, r, 0, Math.PI, h.flip)
    ctx.closePath()

    const flesh = ctx.createLinearGradient(0, -r, 0, r)
    flesh.addColorStop(0, lighten(kind.flesh, 0.15))
    flesh.addColorStop(1, kind.fleshDark)
    ctx.fillStyle = flesh
    ctx.fill()

    // rind rim around the curved edge only
    ctx.lineWidth = Math.max(2, r * 0.14)
    ctx.strokeStyle = kind.rind
    ctx.beginPath()
    ctx.arc(0, 0, r - ctx.lineWidth / 2, 0, Math.PI, h.flip)
    ctx.stroke()

    // seed flecks on the cut face
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

    // contact shadow, same treatment as fruit for visual consistency
    ctx.save()
    ctx.globalAlpha = 0.22
    ctx.fillStyle = "#000000"
    ctx.beginPath()
    ctx.ellipse(r * 0.12, r * 0.22, r * 0.9, r * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // warning pulse in the last stretch before a bomb would exit the top —
    // gives the player a fair visual tell distinct from any fruit.
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

    // dark metallic body — distinctly angular highlight vs. fruit's soft glow
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r)
    body.addColorStop(0, "#3a4356")
    body.addColorStop(0.5, "#1b2130")
    body.addColorStop(1, "#05070c")
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()

    // riveted band around the middle for a "device" silhouette, not a fruit
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

    // spark at the fuse tip — a small animated glow, cheap but reads as "lit"
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

    // glossy highlight, harder-edged than fruit's to feel like metal not skin
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
  // Slice reaction: spawns two flying halves + a juice particle burst +
  // a floating score popup at the slice point.
  // ---------------------------------------------------------------------
  function sliceFruit(s, o, dpr, hitAngle) {
    const kind = o.kind
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
    const juiceColor = kind.flesh
    const n = randInt(10, 16)
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
    s.popups.push({
      x: o.x,
      y: o.y,
      text: "+1",
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
    // Short double-pulse: reads as a sharp "impact" distinct from the
    // longer single buzz used for the run actually ending (see endRun).
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
      const x = rand(w * 0.15, w * 0.85)
      const r = rand(38, 54)
      // Sized for the largest consumer: the orange dimple-texture loop reads
      // up to index (22 * 2 + 1) = 43, so this needs at least 44 entries.
      // The kiwi-seed loop indexes with modulo, so it's safe at any size.
      const textureSeed = Array.from({ length: 44 }, () => Math.random())
      s.objects.push({
        x,
        y: 0,
        r,
        vx: rand(-0.06, 0.06),
        vyReal: 0,
        color: null,
        bomb: isBomb,
        kind: isBomb ? null : pick(FRUIT_KINDS),
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
      const dt = Math.min(now - last, 40)
      last = now
      s.elapsed += dt
      const w = canvas.width
      const h = canvas.height

      // decaying screen shake offset, applied to the whole draw pass
      s.shake *= 0.9
      if (s.shake < 0.05) s.shake = 0
      const shakeX = s.shake ? rand(-1, 1) * s.shake : 0
      const shakeY = s.shake ? rand(-1, 1) * s.shake : 0

      ctx.save()
      ctx.translate(shakeX, shakeY)

      // background: soft vertical gradient + a faint vignette so fruit
      // reads clearly against depth instead of a flat/blank canvas
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

      // spawn, with difficulty ramp gentler for the first ~15s of a run
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
          o.y = h + o.r
          o.vyReal = -rand(0.75, 0.95) * dpr
          o.vx = rand(-0.2, 0.2) * dpr
          o.launchX = o.x
        }
        o.vyReal += 0.0015 * dpr * dt
        o.y += o.vyReal * dt
        o.x += o.vx * dt
        o.rot += o.vr
        o.sparkPhase += dt * 0.02

        // bombs pulse a warning ring once they're past the apex and in the
        // top third of the stage, moving fast enough that a miss is imminent
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
            if (s.lives <= 0) {
              endRun(s.score, false)
              return false
            }
          }
          return false
        }
        return true
      })

      // ---- sliced halves: physics + draw + cull ----
      for (const hlf of s.halves) {
        hlf.vy += hlf.g * dt
        hlf.x += hlf.vx * dt
        hlf.y += hlf.vy * dt
        hlf.rot += hlf.vr
        hlf.life -= hlf.decay
        drawFruitHalf(ctx, hlf)
      }
      s.halves = s.halves.filter((hlf) => hlf.life > 0 && hlf.y < h + hlf.r * 3)

      // ---- juice particles: physics + draw + cull ----
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
      ctx.font = `${28 * dpr}px system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.fillStyle = "#fef08a"
      for (const pop of s.popups) {
        pop.y += pop.vy * dt
        pop.life -= dt * 0.0016
        ctx.globalAlpha = clamp(pop.life, 0, 1)
        ctx.fillText(pop.text, pop.x, pop.y)
      }
      ctx.restore()
      s.popups = s.popups.filter((pop) => pop.life > 0)

      // ---- blade trail: fades from head to tail ----
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

      ctx.restore() // undo shake translate

      // damage flash drawn in screen space, unaffected by shake translate
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

  // 3-2-1-Go countdown, shown before a fresh run starts. Kept as its own
  // screen/effect entirely separate from startLoop — the canvas game loop
  // only ever starts once `screen` becomes "playing", so no fruit spawns
  // or physics run during the countdown itself. A revive skips this and
  // goes straight back to "playing" (see handleRevive), since interrupting
  // a continue with a countdown reads as a penalty, not a courtesy.
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
            if (s.lives <= 0) {
              // A bomb-hit vibration was already fired inside bombBurst
              // above, and endRun below would normally fire its own
              // separate "run ended" buzz — but navigator.vibrate()
              // cancels and replaces any in-progress pattern rather than
              // queuing after it, so calling both back-to-back here would
              // just truncate the first into an inaudible stub. Skip
              // endRun's vibration in this specific case and let the
              // bomb's own pulse play out in full instead.
              endRun(s.score, false, { skipVibration: true })
              return
            }
          } else {
            sliceFruit(s, o, dpr, hitAngle)
            hitThisMove += 1
            s.score += 1
          }
        }
      }
      if (hitThisMove > 0) {
        // combo bonus
        if (hitThisMove > 1) s.score += hitThisMove
        setScore(s.score)
        setCombo(hitThisMove)
        if (hitThisMove > 1) window.clearTimeout(handlePointer._t)
        handlePointer._t = window.setTimeout(() => setCombo(0), 700)
      }
    },
    [endRun],
  )

  function onPointerDown(e) {
    stateRef.current.slicing = true
    stateRef.current.blade = []
    const t = e.touches ? e.touches[0] : e
    handlePointer(t.clientX, t.clientY)
  }
  function onPointerMove(e) {
    if (!stateRef.current.slicing) return
    const t = e.touches ? e.touches[0] : e
    handlePointer(t.clientX, t.clientY)
  }
  function onPointerUp() {
    stateRef.current.slicing = false
  }

  function beginRun() {
    stateRef.current = freshState()
    setScore(0)
    setLives(START_LIVES)
    setCombo(0)
    setCoinsEarned(0)
    setScreen("countdown")
  }

  function handleRevive() {
    if (!spend(REVIVE_COST, "Revive · Slice Storm")) return
    const s = stateRef.current
    s.objects = []
    s.halves = []
    s.particles = []
    s.popups = []
    s.lives = 1
    s.running = false
    setLives(1)
    setScreen("playing")
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
          <div className={styles.lives} aria-label={`${lives} lives left`}>
            {Array.from({ length: START_LIVES }).map((_, i) => (
              <span key={i} className={i < lives ? styles.lifeOn : styles.lifeOff} />
            ))}
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
        {combo > 1 && <div className={styles.combo}>{`${combo}x combo!`}</div>}
      </div>

      {(screen === "revive" || screen === "over") && (
        <GameOver
          game={GAME}
          score={score}
          coinsEarned={coinsEarned}
          isRevive={screen === "revive" && coins >= REVIVE_COST}
          onRevive={handleRevive}
          onRetry={beginRun}
          onHome={() => setScreen("home")}
        />
      )}
    </div>
  )
}