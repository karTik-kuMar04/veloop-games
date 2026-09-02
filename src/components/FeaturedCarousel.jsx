import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"
import PlayBand from "./PlayBand"
import styles from "./FeaturedCarousel.module.css"

/**
 * Auto-advancing hero carousel of featured games. Pauses on hover/focus,
 * supports manual arrows and dot navigation, and reveals the coded PlayBand.
 */
export default function FeaturedCarousel({ games, interval = 5000 }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const navigate = useNavigate()
  const timer = useRef(null)

  const next = useCallback(() => setIndex((i) => (i + 1) % games.length), [games.length])
  const prev = () => setIndex((i) => (i - 1 + games.length) % games.length)

  useEffect(() => {
    if (paused) return
    timer.current = setInterval(next, interval)
    return () => clearInterval(timer.current)
  }, [paused, next, interval])

  const active = games[index]

  return (
    <section
      className={styles.wrap}
      aria-roledescription="carousel"
      aria-label="Featured games"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className={styles.stage} style={{ "--accent": active.accent }}>
        {games.map((g, i) => (
          <div
            key={g.id}
            className={`${styles.slide} ${i === index ? styles.slideActive : ""}`}
            aria-hidden={i !== index}
          >
            <img src={g.banner || "/placeholder.svg"} alt={`${g.title} poster`} className={styles.bg} />
            <div className={styles.scrim} />
            <div className={styles.content}>
              <span className={styles.eyebrow}>{g.category} · +{g.xp} XP</span>
              <h2 className={styles.title}>{g.title}</h2>
              <p className={styles.tag}>{g.tagline}</p>
              <p className={styles.desc}>{g.short}</p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.cta}
                  style={{ "--accent": g.accent }}
                  onClick={() => navigate(`/game/${g.id}`)}
                >
                  {g.playable ? "Play Now" : "View Game"}
                </button>
                {g.playable && <span className={styles.badge}>Fully Playable</span>}
              </div>
            </div>
          </div>
        ))}

        <button type="button" className={`${styles.arrow} ${styles.left}`} onClick={prev} aria-label="Previous game">
          <ChevronLeft size={22} />
        </button>
        <button type="button" className={`${styles.arrow} ${styles.right}`} onClick={next} aria-label="Next game">
          <ChevronRight size={22} />
        </button>
      </div>

      <div className={styles.dots} role="tablist" aria-label="Choose featured game">
        {games.map((g, i) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={i === index}
            aria-label={`Show ${g.title}`}
            className={`${styles.dot} ${i === index ? styles.dotActive : ""}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  )
}
