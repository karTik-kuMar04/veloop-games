import { useNavigate } from "react-router-dom"
import styles from "./GameMarquee.module.css"

/**
 * A slim, continuously-drifting ticker of every game's icon + title.
 * Purely CSS-driven (no rAF/JS timers) so it costs nothing at runtime and
 * respects prefers-reduced-motion automatically via the stylesheet.
 * Purpose: give an immediate "there are lots of games here" signal in a
 * fraction of the vertical space a full auto-rotating hero banner used to
 * take, before the user even reaches the Spotlight or the grid.
 */
export default function GameMarquee({ games }) {
  const navigate = useNavigate()
  // Duplicate the list once so the CSS animation can loop seamlessly by
  // translating exactly -50%, with no visible seam or reset jump.
  const doubled = [...games, ...games]

  return (
    <div className={styles.wrap} role="region" aria-label="All games, scrolling">
      <div className={styles.track}>
        {doubled.map((g, i) => (
          <button
            key={`${g.id}-${i}`}
            type="button"
            className={styles.chip}
            style={{ "--accent": g.accent }}
            onClick={() => navigate(`/game/${g.id}`)}
            tabIndex={i < games.length ? 0 : -1}
            aria-hidden={i >= games.length}
          >
            <img
              src={g.banner || "/placeholder.svg"}
              alt=""
              className={styles.icon}
              width={28}
              height={28}
              loading={i < games.length ? "eager" : "lazy"}
              decoding="async"
            />
            <span className={styles.name}>{g.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}