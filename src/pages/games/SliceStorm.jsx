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

const FRUIT_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#a855f7", "#ec4899"]

function rand(min, max) {
  return Math.random() * (max - min) + min
}

export default function SliceStorm() {
  const { earn, recordScore, bestScores, coins, spend } = useWallet()
  const [screen, setScreen] = useState("home") // home | guide | playing | revive | over
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [combo, setCombo] = useState(0)
  const [coinsEarned, setCoinsEarned] = useState(0)

  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const stateRef = useRef({
    objects: [],
    blade: [],
    slicing: false,
    lastSpawn: 0,
    score: 0,
    lives: START_LIVES,
    running: false,
    spawnGap: 900,
  })

  const best = bestScores[GAME.id] || 0

  const endRun = useCallback(
    (finalScore, viaRevive) => {
      cancelAnimationFrame(rafRef.current)
      stateRef.current.running = false
      const earnedCoins = Math.floor(finalScore * COINS_PER_POINT)
      setCoinsEarned(earnedCoins)
      if (earnedCoins > 0) earn(earnedCoins, `Slice Storm · ${finalScore} pts`, GAME.xp)
      recordScore(GAME.id, finalScore)
      setScreen(viaRevive ? "over" : "revive")
    },
    [earn, recordScore],
  )

  // Main game loop
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

    function spawn(w) {
      const isBomb = Math.random() < 0.16
      const x = rand(w * 0.15, w * 0.85)
      s.objects.push({
        x,
        y: 0,
        r: rand(26, 38),
        vx: rand(-0.06, 0.06),
        vy: rand(0.32, 0.46),
        g: 0.00045,
        vyReal: 0,
        color: isBomb ? "#1f2937" : FRUIT_COLORS[Math.floor(Math.random() * FRUIT_COLORS.length)],
        bomb: isBomb,
        sliced: false,
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.05, 0.05),
      })
    }

    function frame(now) {
      if (!s.running) return
      const dt = Math.min(now - last, 40)
      last = now
      const w = canvas.width
      const h = canvas.height

      ctx.clearRect(0, 0, w, h)

      // spawn
      s.lastSpawn += dt
      if (s.lastSpawn > s.spawnGap) {
        s.lastSpawn = 0
        spawn(w)
        s.spawnGap = Math.max(420, s.spawnGap - 6)
      }

      // launch physics: objects thrown from bottom
      for (const o of s.objects) {
        if (o.vyReal === 0) {
          // initialize a bottom-launch trajectory once
          o.y = h + o.r
          o.vyReal = -rand(0.95, 1.25) * dpr
          o.vx = rand(-0.25, 0.25) * dpr
          o.launchX = o.x
        }
        o.vyReal += 0.0022 * dpr * dt
        o.y += o.vyReal * dt
        o.x += o.vx * dt
        o.rot += o.vr

        if (!o.sliced) {
          ctx.save()
          ctx.translate(o.x, o.y)
          ctx.rotate(o.rot)
          if (o.bomb) {
            ctx.fillStyle = "#111827"
            ctx.beginPath()
            ctx.arc(0, 0, o.r, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = "#f59e0b"
            ctx.fillRect(-2 * dpr, -o.r - 8 * dpr, 4 * dpr, 8 * dpr)
            ctx.strokeStyle = "#ef4444"
            ctx.lineWidth = 3 * dpr
            ctx.stroke()
          } else {
            const grad = ctx.createRadialGradient(-o.r * 0.3, -o.r * 0.3, o.r * 0.2, 0, 0, o.r)
            grad.addColorStop(0, "#ffffff88")
            grad.addColorStop(0.2, o.color)
            grad.addColorStop(1, o.color)
            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(0, 0, o.r, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.restore()
        }
      }

      // remove off-screen & count misses
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

      // draw blade trail
      if (s.blade.length > 1) {
        ctx.strokeStyle = "#fef08a"
        ctx.lineWidth = 4 * dpr
        ctx.lineCap = "round"
        ctx.beginPath()
        ctx.moveTo(s.blade[0].x, s.blade[0].y)
        for (let i = 1; i < s.blade.length; i++) ctx.lineTo(s.blade[i].x, s.blade[i].y)
        ctx.stroke()
      }
      // fade blade
      if (s.blade.length) s.blade = s.blade.slice(-12)

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
      s.blade.push({ x: px, y: py })

      let hitThisMove = 0
      for (const o of s.objects) {
        if (o.sliced) continue
        const d = Math.hypot(o.x - px, o.y - py)
        if (d < o.r + 6 * dpr) {
          o.sliced = true
          if (o.bomb) {
            s.lives -= 1
            setLives(s.lives)
            if (s.lives <= 0) {
              endRun(s.score, false)
              return
            }
          } else {
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
    stateRef.current = {
      objects: [],
      blade: [],
      slicing: false,
      lastSpawn: 0,
      score: 0,
      lives: START_LIVES,
      running: false,
      spawnGap: 900,
    }
    setScore(0)
    setLives(START_LIVES)
    setCombo(0)
    setCoinsEarned(0)
    setScreen("playing")
  }

  function handleRevive() {
    if (!spend(REVIVE_COST, "Revive · Slice Storm")) return
    const s = stateRef.current
    s.objects = []
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
