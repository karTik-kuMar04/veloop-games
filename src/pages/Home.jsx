import { useMemo, useState } from "react"
import { GAMES } from "../data/games"
import GameMarquee from "../components/GameMarquee"
import PlayableSpotlight from "../components/PlayableSpotlight"
import BannerCard from "../components/BannerCard"
import styles from "./Home.module.css"

const CATEGORIES = ["All", ...Array.from(new Set(GAMES.map((g) => g.category)))]

export default function Home() {
  const [filter, setFilter] = useState("All")

  const playable = useMemo(() => GAMES.filter((g) => g.playable), [])

  const visible = useMemo(
    () => (filter === "All" ? GAMES : GAMES.filter((g) => g.category === filter)),
    [filter],
  )

  return (
    <main className="vl-page">
      <GameMarquee games={GAMES} />

      <PlayableSpotlight games={playable} />

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
        {visible.map((g, i) => (
          <BannerCard key={g.id} game={g} index={i} />
        ))}
      </div>
    </main>
  )
}