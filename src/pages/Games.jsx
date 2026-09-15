import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  BookOpen,
  Coins,
  Flame,
  Gamepad2,
  Gift,
  Lock,
  MousePointer,
  Play,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react"
import { GAMES, PLAYABLE_GAMES } from "../data/games"
import { useWallet } from "../store/WalletContext"
import CoinBadge from "../components/CoinBadge"
import styles from "./Games.module.css"

export default function Games() {
  const navigate = useNavigate()
  const { bestScores, coins } = useWallet()
  const [selectedGameId, setSelectedGameId] = useState("all")

  const nonPlayableGames = useMemo(() => GAMES.filter((g) => !g.playable), [])

  const displayedGames = useMemo(() => {
    if (selectedGameId === "all") return PLAYABLE_GAMES
    return PLAYABLE_GAMES.filter((g) => g.id === selectedGameId)
  }, [selectedGameId])

  return (
    <main className={styles.page}>
      {/* Hero Header */}
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroContent}>
          <div className={styles.heroEyebrow}>
            <Sparkles size={16} className={styles.heroEyebrowIcon} />
            <span>Playable Games Arena</span>
          </div>
          <h1 className={styles.heroTitle}>
            Play, Compete & Earn <span className={styles.heroTitleAccent}>Game Coins</span>
          </h1>
          <p className={styles.heroDesc}>
            Jump straight into our browser-native playable games with instant loading, zero installs,
            and shared rewards. Master the rules, climb your personal bests, and stack Game Coins to redeem
            exclusive prizes.
          </p>
        </div>

        {/* Live Arena Stats Bar */}
        <div className={styles.statsPills}>
          <div className={styles.statPill}>
            <Gamepad2 size={16} className={styles.statPillIcon} />
            <span><strong>{PLAYABLE_GAMES.length}</strong> Ready to Play</span>
          </div>
          <div className={styles.statPill}>
            <Coins size={16} className={styles.statPillIcon} />
            <span>Shared Wallet: <CoinBadge coins={coins} size="sm" /></span>
          </div>
          <div className={styles.statPill}>
            <Zap size={16} className={styles.statPillIcon} />
            <span><strong>+20 XP</strong> per Game Session</span>
          </div>
        </div>
      </header>

      {/* Filter / Quick Switcher */}
      <div className={styles.filterBar}>
        <div className={styles.filterTabs} role="tablist" aria-label="Filter playable games">
          <button
            type="button"
            role="tab"
            aria-selected={selectedGameId === "all"}
            className={`${styles.filterBtn} ${selectedGameId === "all" ? styles.filterBtnActive : ""}`}
            onClick={() => setSelectedGameId("all")}
          >
            <Gamepad2 size={16} />
            <span>All Playable ({PLAYABLE_GAMES.length})</span>
          </button>
          {PLAYABLE_GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              role="tab"
              aria-selected={selectedGameId === game.id}
              className={`${styles.filterBtn} ${selectedGameId === game.id ? styles.filterBtnActive : ""}`}
              onClick={() => setSelectedGameId(game.id)}
            >
              <span>{game.title}</span>
            </button>
          ))}
        </div>

        <span className={styles.gamesCount}>
          Showing {displayedGames.length} of {PLAYABLE_GAMES.length} playable games
        </span>
      </div>

      {/* Detailed Playable Games Showcase */}
      <section className={styles.gamesList} aria-label="Playable games list">
        {displayedGames.map((game) => {
          const bestScore = bestScores[game.id] || 0

          return (
            <article
              key={game.id}
              className={styles.gameCard}
              style={{ "--accent": game.accent }}
            >
              {/* Game Banner Header */}
              <div className={styles.cardBanner}>
                <img
                  src={game.banner || "/placeholder.svg"}
                  alt={`${game.title} cover`}
                  className={styles.bannerImg}
                  width={1280}
                  height={720}
                  decoding="async"
                />
                <div className={styles.bannerScrim} />
                <div className={styles.bannerAccentGlow} />

                <div className={styles.bannerContent}>
                  <div className={styles.bannerTopRow}>
                    <div className={styles.badgesGroup}>
                      <span className={styles.categoryBadge}>{game.category}</span>
                      <span className={styles.liveBadge}>
                        <span className={styles.liveDot} /> Ready to Play
                      </span>
                    </div>

                    {game.controls && (
                      <span className={styles.controlsPill}>
                        <MousePointer size={14} /> {game.controls}
                      </span>
                    )}
                  </div>

                  <h2 className={styles.cardTitle}>{game.title}</h2>
                  <p className={styles.cardTagline}>{game.tagline}</p>
                  <p className={styles.cardShort}>{game.short}</p>
                </div>
              </div>

              {/* Game Body with Highlights, Rules & Rewards */}
              <div className={styles.cardBody}>
                {/* Stats / Highlights Row */}
                <div className={styles.highlightsBar}>
                  <div className={styles.highlightItem}>
                    <div className={styles.highlightIconWrap}>
                      <Trophy size={20} />
                    </div>
                    <div className={styles.highlightMeta}>
                      <span>Personal Best</span>
                      <strong>{bestScore.toLocaleString()} pts</strong>
                    </div>
                  </div>

                  <div className={styles.highlightItem}>
                    <div className={styles.highlightIconWrap}>
                      <Coins size={20} />
                    </div>
                    <div className={styles.highlightMeta}>
                      <span>Coin Conversion</span>
                      <strong>1 Coin / {game.coinsPer || 10} pts</strong>
                    </div>
                  </div>

                  <div className={styles.highlightItem}>
                    <div className={styles.highlightIconWrap}>
                      <Zap size={20} />
                    </div>
                    <div className={styles.highlightMeta}>
                      <span>Session Reward</span>
                      <strong>+{game.xp} XP</strong>
                    </div>
                  </div>
                </div>

                {/* Rules & Rewards Split Grid */}
                <div className={styles.sectionGrid}>
                  {/* Rules Block */}
                  <div className={styles.blockCard}>
                    <div className={styles.blockHeader}>
                      <h3 className={styles.blockTitle}>
                        <BookOpen size={18} className={styles.blockTitleIcon} />
                        <span>Game Rules & How to Play</span>
                      </h3>
                      <span className={styles.blockBadge}>Quick Guide</span>
                    </div>

                    <ol className={styles.rulesList}>
                      {game.rules?.map((rule, idx) => (
                        <li key={idx} className={styles.ruleItem}>
                          <span className={styles.ruleNumber}>{idx + 1}</span>
                          <div className={styles.ruleText}>
                            <strong>{rule.title}</strong>
                            <p>{rule.desc}</p>
                          </div>
                        </li>
                      )) || (
                        <li className={styles.ruleItem}>
                          <span className={styles.ruleNumber}>1</span>
                          <div className={styles.ruleText}>
                            <strong>Standard Rules</strong>
                            <p>Play to achieve your highest score and convert points to coins.</p>
                          </div>
                        </li>
                      )}
                    </ol>
                  </div>

                  {/* Rewards Block */}
                  <div className={styles.blockCard}>
                    <div className={styles.blockHeader}>
                      <h3 className={styles.blockTitle}>
                        <Gift size={18} className={styles.blockTitleIcon} />
                        <span>Rewards & Shared Economy</span>
                      </h3>
                      <span className={styles.blockBadge}>Universal Wallet</span>
                    </div>

                    <div className={styles.rewardsGrid}>
                      {game.rewards?.map((reward, idx) => (
                        <div
                          key={idx}
                          className={`${styles.rewardItem} ${reward.highlight ? styles.rewardHighlight : ""}`}
                        >
                          <span className={styles.rewardLabel}>{reward.label}</span>
                          <strong className={styles.rewardValue}>{reward.value}</strong>
                        </div>
                      )) || (
                        <div className={`${styles.rewardItem} ${styles.rewardHighlight}`}>
                          <span className={styles.rewardLabel}>Coins Rate</span>
                          <strong className={styles.rewardValue}>1 Coin / 10 pts</strong>
                        </div>
                      )}
                    </div>

                    <div className={styles.rewardsCallout}>
                      <Coins size={18} className={styles.rewardsCalloutIcon} />
                      <span>
                        Coins earned in <strong>{game.title}</strong> automatically sync to your account.
                        Spend them on boosters, spins, and gift cards in the Redeem store.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className={styles.cardActions}>
                  <div className={styles.actionButtons}>
                    <button
                      type="button"
                      className={styles.playBtn}
                      onClick={() => navigate(`/play/${game.id}`)}
                    >
                      <Play size={20} fill="currentColor" strokeWidth={0} />
                      <span>Play Now</span>
                    </button>

                    <button
                      type="button"
                      className={styles.detailBtn}
                      onClick={() => navigate(`/game/${game.id}`)}
                    >
                      <Flame size={16} />
                      <span>View Details</span>
                    </button>
                  </div>

                  <div className={styles.actionNote}>
                    <span className={styles.xpBadge}>+{game.xp} XP</span>
                    <span>Instant browser launch</span>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      {/* Coming Soon Teaser Section */}
      <section className={styles.catalogSection} aria-label="Upcoming games preview">
        <div className={styles.catalogHead}>
          <h2 className={styles.catalogTitle}>
            <Lock size={18} />
            <span>More Arcade Titles in Development</span>
          </h2>
          <span className={styles.gamesCount}>
            {nonPlayableGames.length} Upcoming Games
          </span>
        </div>

        <div className={styles.catalogGrid}>
          {nonPlayableGames.map((game) => (
            <div
              key={game.id}
              className={styles.catalogCard}
              onClick={() => navigate(`/game/${game.id}`)}
              style={{ cursor: "pointer" }}
            >
              <div className={styles.catalogCardImgWrap}>
                <img
                  src={game.banner || "/placeholder.svg"}
                  alt={game.title}
                  className={styles.catalogCardImg}
                  loading="lazy"
                />
                <span className={styles.catalogLockBadge}>
                  <Lock size={12} /> Coming Soon
                </span>
              </div>
              <div className={styles.catalogCardBody}>
                <span className={styles.catalogCardCategory}>{game.category}</span>
                <h3 className={styles.catalogCardTitle}>{game.title}</h3>
                <p className={styles.catalogCardShort}>{game.short}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
