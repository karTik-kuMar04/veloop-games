import { useRef } from "react"
import { Link } from "react-router-dom"
import PlayBand from "./PlayBand"
import styles from "./BannerCard.module.css"

/**
 * A single game banner: cropped poster artwork on top, coded PlayBand below.
 * `index` drives a staggered fade/rise-in delay when the grid first mounts
 * (see .card's animation-delay in the stylesheet). Hover adds a subtle
 * mouse-position-driven tilt on pointer-fine devices only; touch devices
 * get the plain hover/press states with no tilt math running.
 */
export default function BannerCard({ game, index = 0 }) {
  const cardRef = useRef(null)

  function handlePointerMove(e) {
    const el = cardRef.current
    if (!el || e.pointerType !== "mouse") return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty("--tiltX", `${(-py * 8).toFixed(2)}deg`)
    el.style.setProperty("--tiltY", `${(px * 8).toFixed(2)}deg`)
  }

  function handlePointerLeave() {
    const el = cardRef.current
    if (!el) return
    el.style.setProperty("--tiltX", "0deg")
    el.style.setProperty("--tiltY", "0deg")
  }

  return (
    <article
      ref={cardRef}
      className={styles.card}
      style={{ "--accent": game.accent, "--delay": `${Math.min(index, 12) * 45}ms` }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Link to={`/game/${game.id}`} className={styles.art} aria-label={`${game.title} — ${game.tagline}`}>
        <img
          src={game.banner || "/placeholder.svg"}
          alt={`${game.title} poster`}
          width={600}
          height={800}
          loading={index < 4 ? "eager" : "lazy"}
          decoding="async"
        />
        {game.playable && <span className={styles.playableTag}>Playable</span>}
        <span className={styles.cat}>{game.category}</span>
      </Link>
      <PlayBand game={game} />
    </article>
  )
}