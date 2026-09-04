import { useCallback, useEffect, useRef, useState } from "react"
import { getGame } from "../../data/games"
import { useWallet } from "../../store/WalletContext"
import { GameGuide, GameHome, GameHud, GameOver } from "../../components/game/GameShell"
import styles from "./MergeMaster.module.css"

const GAME = getGame("merge-master")
const SIZE = 4
const REVIVE_COST = 50
const COINS_PER_POINT = 1 / 40 // 1 coin per 40 points

const GUIDE = [
  { title: "Slide the board", body: "Use arrow keys or swipe to slide every tile in one direction." },
  { title: "Merge matches", body: "Two tiles with the same number merge into one worth double." },
  { title: "Keep space open", body: "A new tile appears after each move. Fill the board and it is game over." },
  { title: "Earn coins", body: "Your final score converts to shared Game Coins — 1 coin per 40 points." },
]

const TILE_COLORS = {
  2: "#64748b",
  4: "#84cc16",
  8: "#22c55e",
  16: "#10b981",
  32: "#06b6d4",
  64: "#0ea5e9",
  128: "#3b82f6",
  256: "#6366f1",
  512: "#8b5cf6",
  1024: "#d946ef",
  2048: "#f59e0b",
  4096: "#f97316",
  8192: "#ef4444",
}
let tileSeq = 1
function newTile(value, r, c) {
  return { id: tileSeq++, value, r, c, isNew: true, merged: false }
}

function emptyCells(tiles) {
  const occupied = new Set(tiles.map((t) => `${t.r}-${t.c}`))
  const cells = []
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!occupied.has(`${r}-${c}`)) cells.push({ r, c })
  return cells
}

function spawnTile(tiles) {
  const cells = emptyCells(tiles)
  if (!cells.length) return tiles
  const { r, c } = cells[Math.floor(Math.random() * cells.length)]
  return [...tiles, newTile(Math.random() < 0.9 ? 2 : 4, r, c)]
}

function initBoard() {
  let tiles = []
  tiles = spawnTile(tiles)
  tiles = spawnTile(tiles)
  return tiles
}

// Move logic operating on a grid of values
function toGrid(tiles) {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
  for (const t of tiles) grid[t.r][t.c] = t
  return grid
}

function move(tiles, dir) {
  // dir: 'left','right','up','down'
  const grid = toGrid(tiles)
  let moved = false
  let gained = 0
  const result = []

  const lines = []
  if (dir === "left" || dir === "right") {
    for (let r = 0; r < SIZE; r++) {
      const row = []
      for (let c = 0; c < SIZE; c++) row.push(grid[r][c])
      lines.push({ cells: dir === "left" ? row : row.reverse(), r, reversed: dir === "right", axis: "row" })
    }
  } else {
    for (let c = 0; c < SIZE; c++) {
      const col = []
      for (let r = 0; r < SIZE; r++) col.push(grid[r][c])
      lines.push({ cells: dir === "up" ? col : col.reverse(), c, reversed: dir === "down", axis: "col" })
    }
  }

  for (const line of lines) {
    const existing = line.cells.filter(Boolean)
    const merged = []
    let i = 0
    while (i < existing.length) {
      if (i + 1 < existing.length && existing[i].value === existing[i + 1].value) {
        const value = existing[i].value * 2
        gained += value
        merged.push({ value, from: [existing[i], existing[i + 1]] })
        i += 2
      } else {
        merged.push({ value: existing[i].value, from: [existing[i]] })
        i += 1
      }
    }
    // place merged into positions 0..merged.length-1
    for (let idx = 0; idx < SIZE; idx++) {
      const slot = merged[idx]
      let pos = idx
      if (line.reversed) pos = SIZE - 1 - idx
      if (!slot) continue
      let r, c
      if (line.axis === "row") {
        r = line.r
        c = pos
      } else {
        r = pos
        c = line.c
      }
      const isMerge = slot.from.length === 2
      const srcTile = slot.from[0]
      if (srcTile.r !== r || srcTile.c !== c || isMerge) moved = true
      result.push({
        id: srcTile.id,
        value: slot.value,
        r,
        c,
        isNew: false,
        merged: isMerge,
      })
    }
  }

  return { tiles: result, moved, gained }
}

function hasMoves(tiles) {
  if (emptyCells(tiles).length) return true
  const grid = toGrid(tiles)
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c]?.value
      if (c + 1 < SIZE && grid[r][c + 1]?.value === v) return true
      if (r + 1 < SIZE && grid[r + 1][c]?.value === v) return true
    }
  }
  return false
}

export default function MergeMaster() {
  const { earn, recordScore, bestScores, coins, spend } = useWallet()
  const [screen, setScreen] = useState("home")
  const [tiles, setTiles] = useState([])
  const [score, setScore] = useState(0)
  const [coinsEarned, setCoinsEarned] = useState(0)
  const touchRef = useRef(null)
  const scoreRef = useRef(0)

  const best = bestScores[GAME.id] || 0

  const endRun = useCallback(
    (finalScore, viaRevive) => {
      const earnedCoins = Math.floor(finalScore * COINS_PER_POINT)
      setCoinsEarned(earnedCoins)
      if (earnedCoins > 0) earn(earnedCoins, `Merge Master · ${finalScore} pts`, GAME.xp)
      recordScore(GAME.id, finalScore)
      setScreen(viaRevive ? "over" : "revive")
    },
    [earn, recordScore],
  )

  const doMove = useCallback(
    (dir) => {
      setTiles((prev) => {
        const { tiles: moved, moved: didMove, gained } = move(prev, dir)
        if (!didMove) return prev
        const next = spawnTile(moved)
        const newScore = scoreRef.current + gained
        scoreRef.current = newScore
        setScore(newScore)
        if (!hasMoves(next)) {
          // defer end so the last tile renders
          setTimeout(() => endRun(newScore, false), 120)
        }
        return next
      })
    },
    [endRun],
  )

  useEffect(() => {
    if (screen !== "playing") return
    function onKey(e) {
      const map = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        a: "left",
        d: "right",
        w: "up",
        s: "down",
      }
      const dir = map[e.key]
      if (dir) {
        e.preventDefault()
        doMove(dir)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [screen, doMove])

  function onTouchStart(e) {
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchEnd(e) {
    if (!touchRef.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchRef.current.x
    const dy = t.clientY - touchRef.current.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    if (Math.max(absX, absY) < 24) return
    if (absX > absY) doMove(dx > 0 ? "right" : "left")
    else doMove(dy > 0 ? "down" : "up")
    touchRef.current = null
  }

  function beginRun() {
    tileSeq = 1
    scoreRef.current = 0
    setScore(0)
    setCoinsEarned(0)
    setTiles(initBoard())
    setScreen("playing")
  }

  function handleRevive() {
    if (!spend(REVIVE_COST, "Revive · Merge Master")) return
    // clear the 4 highest tiles to give breathing room
    setTiles((prev) => {
      const sorted = [...prev].sort((a, b) => b.value - a.value)
      const removeIds = new Set(sorted.slice(0, 4).map((t) => t.id))
      return prev.filter((t) => !removeIds.has(t.id))
    })
    setScreen("playing")
  }

  if (screen === "home") {
    return <GameHome game={GAME} best={best} onStart={beginRun} onGuide={() => setScreen("guide")} />
  }
  if (screen === "guide") {
    return <GameGuide game={{ ...GAME, coinsPer: "40" }} steps={GUIDE} onStart={beginRun} onBack={() => setScreen("home")} />
  }

  return (
    <div className={styles.stage} style={{ "--accent": GAME.accent }}>
      <GameHud
        game={GAME}
        score={score}
        onQuit={() => setScreen("home")}
      />

      <div className={styles.boardWrap}>
        <div
          className={styles.board}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          role="application"
          aria-label="Merge Master board"
        >
          {Array.from({ length: SIZE * SIZE }).map((_, i) => (
            <div key={i} className={styles.cell} />
          ))}
          {tiles.map((t) => (
            <div
              key={t.id}
              className={`${styles.tile} ${t.merged ? styles.merged : ""} ${t.isNew ? styles.new : ""}`}
              style={{
                "--r": t.r,
                "--c": t.c,
                background: `linear-gradient(
                  145deg,
                  ${TILE_COLORS[t.value] || "#ef4444"},
                  color-mix(
                    in srgb,
                    ${TILE_COLORS[t.value] || "#ef4444"} 72%,
                    #000 28%
                  )
                )`,
                color: t.value <= 4 ? "#f8fafc" : "#08110d",
                fontSize:
                  t.value >= 1024
                    ? "1.5rem"
                    : t.value >= 128
                      ? "1.8rem"
                      : "2.3rem",
              }}
            >
              {t.value}
            </div>
          ))}
        </div>

        <div className={styles.controls}>
          <button type="button" onClick={() => doMove("up")} aria-label="Up">▲</button>
          <div className={styles.controlRow}>
            <button type="button" onClick={() => doMove("left")} aria-label="Left">◀</button>
            <button type="button" onClick={() => doMove("down")} aria-label="Down">▼</button>
            <button type="button" onClick={() => doMove("right")} aria-label="Right">▶</button>
          </div>
          <p className={styles.hint}>Arrow keys, WASD, or swipe to play.</p>
        </div>
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