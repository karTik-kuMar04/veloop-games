import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Coins, Lock, Play, Trophy } from "lucide-react"
import { getGame } from "../data/games"
import { useWallet } from "../store/WalletContext"
import styles from "./GameDetail.module.css"

export default function GameDetail() {
  const { id } = useParams()
  const game = getGame(id)
  const navigate = useNavigate()
  const { bestScores } = useWallet()

  if (!game) {
    return (
      <main className="vl-page">
        <p>Game not found.</p>
        <Link to="/">Back to home</Link>
      </main>
    )
  }

  const best = bestScores[game.id] || 0

  return (
    <main className={styles.page}>
      <div className={styles.hero} style={{ "--accent": game.accent }}>
        <img src={game.banner || "/placeholder.svg"} alt="" className={styles.heroImg} aria-hidden="true" />


        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>

        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>{game.category}</span>
          <h1 className={styles.title}>{game.title}</h1>
          <p className={styles.tagline}>{game.tagline}</p>
        </div>
      </div>

      <div className={styles.body}>
        <p className={styles.short}>{game.short}</p>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <Coins size={18} className={styles.coinIcon} />
            <div className={styles.statText}>
              <strong>+{game.xp} XP</strong>
              <span>per session</span>
            </div>
          </div>
          <div className={styles.stat}>
            <Trophy size={18} className={styles.trophyIcon} />
            <div className={styles.statText}>
              <strong>{best.toLocaleString()}</strong>
              <span>your best</span>
            </div>
          </div>
        </div>

        <div className={styles.ctaRow}>
          {game.playable ? (
            <button
              type="button"
              className={styles.playCta}
              style={{ "--accent": game.accent }}
              onClick={() => navigate(`/play/${game.id}`)}
            >
              <Play size={20} fill="currentColor" strokeWidth={0} /> Play now
            </button>
          ) : (
            <div className={styles.locked}>
              <Lock size={16} />
              <span>This title is coming soon. Try our playable games to start earning coins.</span>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}