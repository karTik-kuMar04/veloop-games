import { useNavigate } from "react-router-dom"
import { Play, Sparkles } from "lucide-react"
import styles from "./PlayBand.module.css"

/**
 * The coded "Play Now" section that replaces the old baked-in XP / PLAY NOW
 * strip from the source posters. Rendered as live UI so it can carry accent
 * color, XP value, and routing per game.
 */
export default function PlayBand({ game, size = "md" }) {
  const navigate = useNavigate()

  const go = () => {
    if (game.playable) navigate(`/game/${game.id}`)
    else navigate(`/game/${game.id}`) // non-playable still opens a detail page
  }

  return (
    <div className={`${styles.band} ${size === "lg" ? styles.lg : ""}`}>
      <div className={styles.xp} style={{ "--accent": game.accent }}>
        <Sparkles size={size === "lg" ? 20 : 16} />
        <span className={styles.xpValue}>+{game.xp}</span>
        <span className={styles.xpLabel}>XP</span>
      </div>

      <button
        type="button"
        className={styles.playBtn}
        onClick={go}
        aria-label={`Play ${game.title}`}
        style={{ "--accent": game.accent }}
      >
        <Play size={size === "lg" ? 22 : 18} fill="currentColor" strokeWidth={0} />
        <span>Play Now</span>
      </button>
    </div>
  )
}
