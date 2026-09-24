import { useCallback, useEffect, useRef, useState } from "react"
import { Undo2, Sparkles, Trophy } from "lucide-react"
import { getGame } from "../../data/games"
import { useWallet } from "../../store/WalletContext"
import { GameGuide, GameHome, GameHud, GameOver } from "../../components/game/GameShell"
import styles from "./MergeMaster.module.css"

const GAME = getGame("merge-master")
const SIZE = 4
const REVIVE_COST = 50
const COINS_PER_POINT = 1 / 40 // 1 coin per 40 points
const SLIDE_MS = 160

const GUIDE = [
  { title: "Slide the board", body: "Use arrow keys, WASD, or swipe to slide every tile in one direction." },
  { title: "Merge matches", body: "Two tiles with the same number merge into one worth double." },
  { title: "Unlock high tiles", body: "Merge high tiles (64+64→128) to trigger epic tier unlock effects!" },
  { title: "Undo mistakes", body: "Made a wrong slide? Use your 1 free undo per run (or 10 coins for more)." },
  { title: "Aim for 2048 & beyond", body: "Smash personal records to trigger celebratory graffiti rewards!" },
]

const TILE_COLORS = {
  2: "#475569",
  4: "#84cc16",
  8: "#10b981",
  16: "#06b6d4",
  32: "#0284c7",
  64: "#3b82f6",
  128: "#6366f1",
  256: "#8b5cf6",
  512: "#d946ef",
  1024: "#ec4899",
  2048: "#f59e0b",
  4096: "#f97316",
  8192: "#ef4444",
}

let tileSeq = 1
function newTile(value, r, c) {
  return { id: tileSeq++, value, r, c, isNew: true, merged: false, isNewMax: false }
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

function toGrid(tiles) {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
  for (const t of tiles) grid[t.r][t.c] = t
  return grid
}

function vibrate(pattern) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return
  try {
    navigator.vibrate(pattern)
  } catch {}
}

function move(tiles, dir) {
  const grid = toGrid(tiles)
  let moved = false
  let gained = 0
  const animTiles = []
  const finalTiles = []
  const merges = []

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
      if (isMerge) {
        merges.push({ r, c, value: slot.value })
        animTiles.push({
          id: srcTile.id,
          value: srcTile.value,
          r,
          c,
          isNew: false,
          merged: false,
          isNewMax: false,
        })
        animTiles.push({
          id: slot.from[1].id,
          value: slot.from[1].value,
          r,
          c,
          isNew: false,
          merged: false,
          isNewMax: false,
          absorbed: true,
        })
        finalTiles.push({
          id: srcTile.id,
          value: slot.value,
          r,
          c,
          isNew: false,
          merged: true,
          isNewMax: false,
        })
      } else {
        const tile = {
          id: srcTile.id,
          value: srcTile.value,
          r,
          c,
          isNew: false,
          merged: false,
          isNewMax: false,
        }
        animTiles.push(tile)
        finalTiles.push({ ...tile })
      }
    }
  }

  return { animTiles, finalTiles, moved, gained, merges }
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
  const { earn, recordScore, bestScores, coins, spend, canAfford } = useWallet()
  const [screen, setScreen] = useState("home")
  const [tiles, setTiles] = useState([])
  const [score, setScore] = useState(0)
  const [moves, setMoves] = useState(0)
  const [history, setHistory] = useState(null)
  const [freeUndosLeft, setFreeUndosLeft] = useState(1)
  const [coinsEarned, setCoinsEarned] = useState(0)
  const [prevBest, setPrevBest] = useState(0)

  // Rich visual effect states
  const [popups, setPopups] = useState([]) // floating score popups
  const [newMaxAlert, setNewMaxAlert] = useState(null) // new highest tile celebration
  const [comboAlert, setComboAlert] = useState(null) // multi-merge combos
  const [showGraffiti, setShowGraffiti] = useState(false) // beating high score celebration
  const [shakeBoard, setShakeBoard] = useState(false)

  const touchRef = useRef(null)
  const scoreRef = useRef(0)
  const movesRef = useRef(0)
  const coinsAwardedRef = useRef(0)
  const revivedRef = useRef(false)
  const maxTileEverRef = useRef(4)
  const startBestRef = useRef(0)
  const newRecordPoppedRef = useRef(false)
  const slidingRef = useRef(false)
  const slideTimerRef = useRef(null)

  const best = bestScores[GAME.id] || 0

  const endRun = useCallback(
    (finalScore, viaRevive) => {
      const totalCoins = Math.floor(finalScore * COINS_PER_POINT)
      const prevAwarded = coinsAwardedRef.current || 0
      const deltaCoins = Math.max(0, totalCoins - prevAwarded)
      coinsAwardedRef.current = totalCoins
      setCoinsEarned(totalCoins)
      if (deltaCoins > 0) earn(deltaCoins, `Merge Master · ${finalScore} pts`, GAME.xp)
      recordScore(GAME.id, finalScore)
      setScreen(viaRevive ? "over" : "revive")
    },
    [earn, recordScore],
  )

  const doMove = useCallback(
    (dir) => {
      if (screen !== "playing" || slidingRef.current) return
      setTiles((prev) => {
        const { animTiles, finalTiles, moved: didMove, gained, merges } = move(prev, dir)
        if (!didMove) return prev

        slidingRef.current = true

        // Save history snapshot for undo
        setHistory({
          tiles: prev,
          score: scoreRef.current,
          moves: movesRef.current,
          maxTile: maxTileEverRef.current,
        })
        movesRef.current += 1
        setMoves(movesRef.current)

        const newScore = scoreRef.current + gained
        scoreRef.current = newScore
        setScore(newScore)

        // 1. Visual effect on beating personal best score
        if (startBestRef.current > 0 && newScore > startBestRef.current && !newRecordPoppedRef.current) {
          newRecordPoppedRef.current = true
          setShowGraffiti(true)
          vibrate([50, 40, 70])
          setTimeout(() => setShowGraffiti(false), 2400)
        }

        let nextMax = maxTileEverRef.current
        let unlockedMax = false

        // 2. Merges effects: floating score popups & combo check
        if (merges && merges.length > 0) {
          const now = Date.now()
          const mergePops = merges.map((m, idx) => ({
            id: `${now}-${idx}`,
            r: m.r,
            c: m.c,
            value: m.value,
          }))
          setPopups((p) => [...p, ...mergePops])
          setTimeout(() => {
            setPopups((p) => p.filter((item) => !mergePops.some((mp) => mp.id === item.id)))
          }, 850)

          if (merges.length >= 2) {
            setComboAlert(`${merges.length}× COMBO!`)
            vibrate([30, 30])
            setTimeout(() => setComboAlert(null), 1200)
          }

          // 3. New highest tile unlock check (e.g. 64+64 -> 128)
          let highestMerged = 0
          for (const m of merges) {
            if (m.value > highestMerged) highestMerged = m.value
          }

          if (highestMerged > nextMax) {
            nextMax = highestMerged
            unlockedMax = true
            maxTileEverRef.current = highestMerged
            setNewMaxAlert({
              value: highestMerged,
              color: TILE_COLORS[highestMerged] || "#ef4444",
            })
            setShakeBoard(true)
            vibrate([60, 40, 80, 50, 100])
            setTimeout(() => setShakeBoard(false), 450)
            setTimeout(() => setNewMaxAlert(null), 2500)
          } else {
            vibrate(25)
          }
        }

        if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
        slideTimerRef.current = setTimeout(() => {
          const settled = finalTiles.map((t) => ({
            ...t,
            isNewMax: unlockedMax && t.value === nextMax,
          }))
          const next = spawnTile(settled)
          setTiles(next)
          slidingRef.current = false
          if (!hasMoves(next)) {
            setTimeout(() => endRun(newScore, revivedRef.current), 180)
          }
        }, SLIDE_MS)

        return animTiles
      })
    },
    [screen, endRun],
  )

  function handleUndo() {
    if (screen !== "playing" || !history) return
    if (freeUndosLeft > 0) {
      setFreeUndosLeft((f) => f - 1)
    } else {
      if (!canAfford(10)) return
      const ok = spend(10, "Undo Move · Merge Master")
      if (!ok) return
    }
    setTiles(history.tiles)
    scoreRef.current = history.score
    setScore(history.score)
    movesRef.current = history.moves
    setMoves(history.moves)
    if (history.maxTile) maxTileEverRef.current = history.maxTile
    setHistory(null)
    setNewMaxAlert(null)
    slidingRef.current = false
    if (slideTimerRef.current) {
      clearTimeout(slideTimerRef.current)
      slideTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
    }
  }, [])

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
    if (screen !== "playing") return
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY }
  }

  function onTouchEnd(e) {
    if (screen !== "playing" || !touchRef.current) return
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
    movesRef.current = 0
    coinsAwardedRef.current = 0
    revivedRef.current = false
    const currentBest = bestScores[GAME.id] || 0
    startBestRef.current = currentBest
    newRecordPoppedRef.current = false
    setPrevBest(currentBest)
    setShowGraffiti(false)
    setNewMaxAlert(null)
    setComboAlert(null)
    setPopups([])
    setShakeBoard(false)
    setScore(0)
    setMoves(0)
    setHistory(null)
    setFreeUndosLeft(1)
    setCoinsEarned(0)
    slidingRef.current = false
    if (slideTimerRef.current) {
      clearTimeout(slideTimerRef.current)
      slideTimerRef.current = null
    }
    const initial = initBoard()
    maxTileEverRef.current = Math.max(...initial.map((t) => t.value), 4)
    setTiles(initial)
    setScreen("playing")
  }

  function handleRevive() {
    if (!canAfford(REVIVE_COST)) return
    if (!spend(REVIVE_COST, "Revive · Merge Master")) return
    revivedRef.current = true
    setTiles((prev) => {
      const sorted = [...prev].sort((a, b) => a.value - b.value)
      const removeIds = new Set(sorted.slice(0, 4).map((t) => t.id))
      return prev.filter((t) => !removeIds.has(t.id))
    })
    setScreen("playing")
  }

  const highestTile = tiles.length > 0 ? Math.max(...tiles.map((t) => t.value)) : 2

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
        extra={
          <div className={styles.hudStats}>
            <div
              className={styles.highestBadge}
              style={{
                background: `linear-gradient(135deg, ${TILE_COLORS[highestTile] || "#ef4444"}, color-mix(in srgb, ${TILE_COLORS[highestTile] || "#ef4444"} 65%, #000 35%))`,
              }}
              title="Highest tile on the board"
            >
              <span className={styles.badgeLabel}>MAX</span>
              <strong className={styles.badgeVal}>{highestTile}</strong>
            </div>
            <div className={styles.movesBox}>
              <span>Moves</span>
              <strong>{moves}</strong>
            </div>
          </div>
        }
      />

      <div className={styles.boardWrap}>
        <div className={styles.boardTopBar}>
          <div className={styles.boardPrompt}>
            Merge toward <strong>2048</strong>
          </div>
          <button
            type="button"
            className={styles.undoBtn}
            onClick={handleUndo}
            disabled={!history || (freeUndosLeft === 0 && !canAfford(10))}
            title={freeUndosLeft > 0 ? "1 Free undo available" : "Costs 10 coins"}
          >
            <Undo2 size={16} />
            <span>{freeUndosLeft > 0 ? "Undo (Free)" : "Undo (10 🪙)"}</span>
          </button>
        </div>

        {/* Ambient highest-tile glow effect container */}
        <div
          className={`${styles.boardContainer} ${shakeBoard ? styles.boardShake : ""}`}
          style={{ "--tile-glow": TILE_COLORS[highestTile] || "#22c55e" }}
        >
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
                className={`${styles.tileSlot} ${t.isNew ? styles.tileSlotSpawn : ""} ${t.absorbed ? styles.tileSlotAbsorbed : ""}`}
                style={{
                  "--r": t.r,
                  "--c": t.c,
                  zIndex: t.isNewMax ? 12 : t.merged ? 8 : t.absorbed ? 3 : 4,
                }}
              >
                <div
                  className={`
                    ${styles.tile}
                    ${t.merged ? styles.merged : ""}
                    ${t.isNew ? styles.new : ""}
                    ${t.isNewMax ? styles.newMax : ""}
                  `}
                  style={{
                    background: `linear-gradient(
                      145deg,
                      ${TILE_COLORS[t.value] || "#ef4444"},
                      color-mix(in srgb, ${TILE_COLORS[t.value] || "#ef4444"} 72%, #000 28%)
                    )`,
                    boxShadow:
                      t.value >= 128
                        ? `0 0 24px ${TILE_COLORS[t.value] || "#ef4444"}66, 0 10px 24px rgba(0, 0, 0, 0.4)`
                        : `0 8px 18px rgba(0, 0, 0, 0.28)`,
                    fontSize:
                      t.value >= 1024
                        ? "1.45rem"
                        : t.value >= 128
                          ? "1.75rem"
                          : "2.3rem",
                  }}
                >
                  {t.value}
                  {t.isNewMax && <span className={styles.crownSparkle}>👑</span>}
                </div>
              </div>
            ))}

            {/* Floating score popups */}
            {popups.map((p) => (
              <div
                key={p.id}
                className={styles.scorePopup}
                style={{
                  "--r": p.r,
                  "--c": p.c,
                }}
              >
                +{p.value}
              </div>
            ))}
          </div>

          {/* New highest tile unlock banner */}
          {newMaxAlert && (
            <div className={styles.newMaxBanner}>
              <div className={styles.newMaxBadge}>
                <span className={styles.newMaxIcon}>🌟</span>
                <div className={styles.newMaxText}>
                  <span className={styles.newMaxSub}>NEW RECORD TILE!</span>
                  <strong className={styles.newMaxVal}>{newMaxAlert.value}</strong>
                </div>
                <span className={styles.newMaxIcon}>🌟</span>
              </div>
            </div>
          )}

          {/* High Score Broken celebration banner */}
          {showGraffiti && (
            <div className={styles.inGameGraffiti}>
              <div className={styles.inGameGraffitiSplatter} />
              <div className={styles.inGameGraffitiText}>
                ⚡ NEW HIGH SCORE! ⚡
              </div>
            </div>
          )}

          {/* Multi-merge combo alert */}
          {comboAlert && (
            <div className={styles.comboAlert}>
              {comboAlert}
            </div>
          )}
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