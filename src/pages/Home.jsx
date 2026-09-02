import { useMemo, useState } from "react"
import { GAMES } from "../data/games"
import FeaturedCarousel from "../components/FeaturedCarousel"
import BannerCard from "../components/BannerCard"
import styles from "./Home.module.css"

const CATEGORIES = ["All", ...Array.from(new Set(GAMES.map((g) => g.category)))]

export default function Home() {
  const [filter, setFilter] = useState("All")

  const featured = useMemo(() => {
    // Lead with the two playable games, then a few visually strong posters.
    const playable = GAMES.filter((g) => g.playable)
    const rest = GAMES.filter((g) => !g.playable).slice(0, 3)
    return [...playable, ...rest]
  }, [])

  const visible = useMemo(
    () => (filter === "All" ? GAMES : GAMES.filter((g) => g.category === filter)),
    [filter],
  )

  return (
    <main className="vl-page">
      <FeaturedCarousel games={featured} />

      <div className={styles.head}>
        <div>
          <span className="vl-eyebrow">All games</span>
          <h1 className="vl-section-title">Pick a game. Earn Game Coins.</h1>
          <p className="vl-muted" style={{ margin: "0.35rem 0 0" }}>
            Every game rewards the same Game Coins — spend them together in the Redeem center.
          </p>
        </div>
      </div>

      <div className={styles.filters} role="tablist" aria-label="Filter games by category">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={filter === c}
            className={`${styles.filter} ${filter === c ? styles.filterActive : ""}`}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {visible.map((g) => (
          <BannerCard key={g.id} game={g} />
        ))}
      </div>
    </main>
  )
}
