import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Coins, Play, RotateCcw } from "lucide-react";
import CoinBadge from "../CoinBadge";
import { useWallet } from "../../store/WalletContext";
import styles from "./GameShell.module.css";

/**
 * Reusable flow wrapper for a fully playable game.
 * Screens: "home" -> "guide" -> "playing" -> "revive"/"over".
 * The concrete game passes its own board via `children` and drives screens
 * through the render-prop API.
 */
export function GameHome({ game, best, onStart, onGuide }) {
  const navigate = useNavigate()

  return (
    <div
      className={`${styles.screen}`}
      style={{ "--accent": game.accent }}
    >
      <button
        type="button"
        className={styles.back}
        onClick={() => navigate("/")}
      >
        <ArrowLeft size={17} />
        <span>Home</span>
      </button>

      <div className={styles.hero}>
        <div className={styles.heroArtWrap}>
          <img
            src={game.banner || "/placeholder.svg"}
            alt=""
            className={styles.heroArt}
            aria-hidden="true"
            width={800}
            height={800}
            decoding="async"
          />

          <div className={styles.artGlow} />
        </div>

        <div className={styles.heroBody}>
          <div className={styles.heroMeta}>
            <span className="vl-eyebrow">
              {game.category}
            </span>

            <span className={styles.liveDot}>
              <span />
              Ready to play
            </span>
          </div>

          <h1 className={styles.title}>
            {game.title}
          </h1>

          <p className={styles.tagline}>
            {game.tagline}
          </p>

          <p className={styles.short}>
            {game.short}
          </p>

          <div className={styles.best}>
            <span>Personal best</span>
            <strong>{best.toLocaleString()}</strong>
          </div>

          <div className={styles.homeActions}>
            <button
              type="button"
              className={styles.primary}
              onClick={onStart}
            >
              <Play
                size={20}
                fill="currentColor"
                strokeWidth={0}
              />
              Play now
            </button>

            <button
              type="button"
              className={styles.ghost}
              onClick={onGuide}
            >
              <BookOpen size={18} />
              How to play
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function GameGuide({ game, steps, onStart, onBack }) {
  return (
    <div className={styles.screen} style={{ "--accent": game.accent }}>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </button>
      <div className={styles.guideCard}>
        <h2 className={styles.guideTitle}>How to play {game.title}</h2>
        <ol className={styles.steps}>
          {steps.map((s, i) => (
            <li key={i}>
              <span className={styles.stepNum}>{i + 1}</span>
              <div>
                <strong>{s.title}</strong>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className={styles.coinNote}>
          <Coins size={18} />
          <span>
            Earn <strong>1 Game Coin</strong> for every {game.coinsPer || "10"}{" "}
            points. Coins are shared across every game and spendable in the
            Redeem center.
          </span>
        </div>
        <button type="button" className={styles.primary} onClick={onStart}>
          <Play size={20} fill="currentColor" strokeWidth={0} /> Start playing
        </button>
      </div>
    </div>
  );
}

export function GameOver({
  game,
  score,
  coinsEarned,
  isRevive,
  onRevive,
  onRetry,
  onHome,
}) {
  const { coins } = useWallet();
  return (
    <div className={styles.overlay}>
      <div className={styles.overCard} style={{ "--accent": game.accent }}>
        <span className="vl-eyebrow">
          {isRevive ? "🔥 Last chance" : "Run complete"}
        </span>
        <h2 className={styles.overTitle}>
          {isRevive ? "Keep the run alive?" : "Nice run!"}
        </h2>

        <div className={styles.finalScore}>
          <span>FINAL SCORE</span>
          <strong>{score.toLocaleString()}</strong>
        </div>

        <div className={styles.overStats}>
          <div>
            <span>Coins earned</span>
            <strong className={styles.coinValue}>
              +{coinsEarned}
            </strong>
          </div>

          <div>
            <span>Best</span>
            <strong>
              {Math.max(score, 0).toLocaleString()}
            </strong>
          </div>
        </div>

        <div className={styles.walletRow}>
          <CoinBadge coins={coins} />
        </div>

        {isRevive ? (
          <div className={styles.overActions}>
            <button
              type="button"
              className={styles.reviveBtn}
              onClick={onRevive}
            >
              <RotateCcw size={18} /> Revive (50 coins)
            </button>
            <button type="button" className={styles.ghost} onClick={onRetry}>
              No thanks, restart
            </button>
            <button
              type="button"
              className={styles.quitBtn}
              onClick={onHome}
            >
              <ArrowLeft size={17} />
              Quit game
            </button>
          </div>
        ) : (
          <div className={styles.overActions}>
            <button type="button" className={styles.primary} onClick={onRetry}>
              <RotateCcw size={18} /> Play again
            </button>
            <button
              type="button"
              className={styles.ghost}
              onClick={onHome}
            >
              <ArrowLeft size={17} />
              Quit game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function GameHud({ game, score, extra, onQuit }) {
  return (
    <>
      <button
        type="button"
        className={styles.cornerQuit}
        onClick={onQuit}
        aria-label="Quit game"
      >
        <ArrowLeft size={20} strokeWidth={2.5} />
      </button>

      <div className={styles.hud}>
        <div className={styles.hudGame}>{game.title}</div>

        <div className={styles.hudScore}>
          <span>Score</span>
          <strong>{score.toLocaleString()}</strong>
        </div>

        {extra}
      </div>
    </>
  );
}
