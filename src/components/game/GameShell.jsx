import { useNavigate } from "react-router-dom"
import { ArrowLeft, BookOpen, Coins, Play, RotateCcw } from "lucide-react"
import CoinBadge from "../CoinBadge"
import { useWallet } from "../../store/WalletContext"
import styles from "./GameShell.module.css"

/**
 * Reusable flow wrapper for a fully playable game.
 * Screens: "home" -> "guide" -> "playing" -> "revive"/"over".
 * The concrete game passes its own board via `children` and drives screens
 * through the render-prop API.
 */
export function GameHome({ game, best, onStart, onGuide }) {
  const navigate = useNavigate()
  return (
    <div className={styles.screen} style={{ "--accent": game.accent }}>
      <button type="button" className={styles.back} onClick={() => navigate("/")}>
        <ArrowLeft size={16} /> All games
      </button>
      <div className={styles.hero}>
        <img src={game.banner || "/placeholder.svg"} alt="" className={styles.heroArt} aria-hidden="true" />
        <div className={styles.heroBody}>
          <span className="vl-eyebrow">{game.category} · Fully playable</span>
          <h1 className={styles.title}>{game.title}</h1>
          <p className={styles.tagline}>{game.tagline}</p>
          <div className={styles.best}>
            <span>Best score</span>
            <strong>{best.toLocaleString()}</strong>
          </div>
          <div className={styles.homeActions}>
            <button type="button" className={styles.primary} onClick={onStart}>
              <Play size={20} fill="currentColor" strokeWidth={0} /> Play
            </button>
            <button type="button" className={styles.ghost} onClick={onGuide}>
              <BookOpen size={18} /> How to play
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function GameGuide({ game, steps, onStart, onBack }) {
  return (
    <div className={styles.screen} style={{ "--accent": game.accent }}>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </button>
      <div className={styles.guideCard}>
        <h2 className={styles.guideTitle}>How to play {game.title}</h2>
        <ol className={styles.steps}>
          {steps.map((s, i) => (
            <li key={i}>
              <span className={styles.stepNum}>{i + 1}</span>
              <div>
                <strong>{s.title}</strong>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className={styles.coinNote}>
          <Coins size={18} />
          <span>
            Earn <strong>1 Game Coin</strong> for every {game.coinsPer || "10"} points. Coins are shared across
            every game and spendable in the Redeem center.
          </span>
        </div>
        <button type="button" className={styles.primary} onClick={onStart}>
          <Play size={20} fill="currentColor" strokeWidth={0} /> Start playing
        </button>
      </div>
    </div>
  )
}

export function GameOver({ game, score, coinsEarned, isRevive, onRevive, onRetry, onHome }) {
  const { coins } = useWallet()
  return (
    <div className={styles.overlay}>
      <div className={styles.overCard} style={{ "--accent": game.accent }}>
        <span className="vl-eyebrow">{isRevive ? "You can continue!" : "Run complete"}</span>
        <h2 className={styles.overTitle}>{isRevive ? "One more life?" : "Game Over"}</h2>

        <div className={styles.overStats}>
          <div>
            <span>Score</span>
            <strong>{score.toLocaleString()}</strong>
          </div>
          <div>
            <span>Coins earned</span>
            <strong className={styles.coinValue}>+{coinsEarned}</strong>
          </div>
        </div>

        <div className={styles.walletRow}>
          <CoinBadge coins={coins} />
        </div>

        {isRevive ? (
          <div className={styles.overActions}>
            <button type="button" className={styles.reviveBtn} onClick={onRevive}>
              <RotateCcw size={18} /> Revive (50 coins)
            </button>
            <button type="button" className={styles.ghost} onClick={onRetry}>
              No thanks, restart
            </button>
          </div>
        ) : (
          <div className={styles.overActions}>
            <button type="button" className={styles.primary} onClick={onRetry}>
              <RotateCcw size={18} /> Play again
            </button>
            <button type="button" className={styles.ghost} onClick={onHome}>
              Back to game home
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function GameHud({ game, score, extra, onQuit }) {
  return (
    <div className={styles.hud}>
      <button type="button" className={styles.hudBtn} onClick={onQuit} aria-label="Quit game">
        <ArrowLeft size={16} />
      </button>
      <div className={styles.hudScore}>
        <span>Score</span>
        <strong>{score.toLocaleString()}</strong>
      </div>
      {extra}
      <div className={styles.hudGame}>{game.title}</div>
    </div>
  )
}
