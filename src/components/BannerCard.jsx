import { Link } from "react-router-dom"
import PlayBand from "./PlayBand"
import styles from "./BannerCard.module.css"

/**
 * A single game banner: cropped poster artwork on top, coded PlayBand below.
 * The old "+20 XP / PLAY NOW" strip was cropped out of the source image and
 * is now rebuilt as live UI.
 */
export default function BannerCard({ game }) {
  return (
    <article className={styles.card} style={{ "--accent": game.accent }}>
      <Link to={`/game/${game.id}`} className={styles.art} aria-label={`${game.title} — ${game.tagline}`}>
        <img src={game.banner || "/placeholder.svg"} alt={`${game.title} poster`} loading="lazy" />
        {game.playable && <span className={styles.playableTag}>Playable</span>}
        <span className={styles.cat}>{game.category}</span>
      </Link>
      <PlayBand game={game} />
    </article>
  )
}
