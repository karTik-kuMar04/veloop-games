import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Sparkles } from "lucide-react"
import PlayBand from "./PlayBand"
import styles from "./PlayableSpotlight.module.css"

/**
 * Spotlight row for the fully-playable games. On wide screens both cards
 * sit side by side (no carousel needed — there are only ever a couple of
 * these). On narrow screens it becomes a swipe/drag/wheel-scrollable strip
 * with dot indicators only, per the "no arrow buttons anywhere" carousel
 * requirement — the same mechanism already used by the game grid's own
 * internal carousel elsewhere in the app.
 */
export default function PlayableSpotlight({ games }) {
  const navigate = useNavigate()
  const trackRef = useRef(null)
  const [active, setActive] = useState(0)

  function handleScroll() {
    const el = trackRef.current
    if (!el) return
    const cardWidth = el.scrollWidth / games.length
    const idx = Math.round(el.scrollLeft / cardWidth)
    setActive(Math.min(games.length - 1, Math.max(0, idx)))
  }

  function goTo(i) {
    setActive(i)
    const el = trackRef.current
    if (!el || typeof el.scrollTo !== "function") return
    const cardWidth = el.scrollWidth / games.length
    el.scrollTo({ left: cardWidth * i, behavior: "smooth" })
  }

  return (
    <section className={styles.wrap} aria-label="Fully playable games">
      <div className={styles.heading}>
        <Sparkles size={18} className={styles.headingIcon} />
        <h2 className={styles.headingTitle}>Fully Playable</h2>
        <span className={styles.headingSub}>Jump straight in — no waiting</span>
      </div>

      <div className={styles.track} ref={trackRef} onScroll={handleScroll}>
        {games.map((g) => (
          <article key={g.id} className={styles.card} style={{ "--accent": g.accent }}>
            <button
              type="button"
              className={styles.art}
              onClick={() => navigate(`/game/${g.id}`)}
              aria-label={`${g.title} — ${g.tagline}`}
            >
              <img src={g.banner || "/placeholder.svg"} alt="" className={styles.artImg} />
              <div className={styles.artScrim} />
              <div className={styles.artContent}>
                <span className={styles.category}>{g.category}</span>
                <h3 className={styles.title}>{g.title}</h3>
                <p className={styles.tagline}>{g.tagline}</p>
              </div>
            </button>
            <PlayBand game={g} size="lg" />
          </article>
        ))}
      </div>

      {games.length > 1 && (
        <div className={styles.dots} role="tablist" aria-label="Choose spotlighted game">
          {games.map((g, i) => (
            <button
              key={g.id}
              role="tab"
              aria-selected={i === active}
              aria-label={`Show ${g.title}`}
              className={`${styles.dot} ${i === active ? styles.dotActive : ""}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}