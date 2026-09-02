import { useState } from "react"
import { Check, Coins, History, ShoppingBag } from "lucide-react"
import { REWARDS } from "../data/rewards"
import { useWallet } from "../store/WalletContext"
import CoinBadge from "../components/CoinBadge"
import styles from "./Redeem.module.css"

export default function Redeem() {
  const { coins, totalEarned, spend, canAfford, inventory, history } = useWallet()
  const [toast, setToast] = useState(null)

  function handleRedeem(reward) {
    if (!canAfford(reward.cost)) return
    const ok = spend(reward.cost, `Redeemed ${reward.name}`, reward.id)
    if (ok) {
      setToast(`${reward.name} redeemed!`)
      setTimeout(() => setToast(null), 2200)
    }
  }

  const spendHistory = history.filter((h) => h.type === "spend")

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className="vl-eyebrow">Redemption Center</span>
          <h1 className={styles.title}>Spend your Game Coins</h1>
          <p className={styles.sub}>
            Every coin you earn across all games lands in one shared wallet. Cash it in for in-game currency,
            boosters, and tournament entries.
          </p>
        </div>
        <div className={styles.walletCard}>
          <CoinBadge coins={coins} size="lg" />
          <div className={styles.walletMeta}>
            <span>Total earned</span>
            <strong>{totalEarned.toLocaleString()}</strong>
          </div>
        </div>
      </header>

      <section className={styles.gridSection} aria-label="Rewards catalog">
        <div className={styles.grid}>
          {REWARDS.map((r) => {
            const affordable = coins >= r.cost
            const owned = inventory[r.id] || 0
            return (
              <article key={r.id} className={styles.card}>
                <div className={styles.tag}>{r.tag}</div>
                {owned > 0 && (
                  <div className={styles.owned}>
                    <Check size={12} /> {owned}
                  </div>
                )}
                <div className={styles.iconWrap}>
                  <img src={r.icon || "/placeholder.svg"} alt="" className={styles.rewardIcon} />
                </div>
                <h3 className={styles.rewardName}>{r.name}</h3>
                <p className={styles.rewardDesc}>{r.desc}</p>
                <div className={styles.priceRow}>
                  <span className={styles.price}>
                    <img src="/assets/coin.png" alt="" className={styles.coinMini} aria-hidden="true" />
                    {r.cost.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    className={styles.redeemBtn}
                    disabled={!affordable}
                    onClick={() => handleRedeem(r)}
                  >
                    <ShoppingBag size={15} />
                    {affordable ? "Redeem" : "Need more"}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className={styles.historySection} aria-label="Redemption history">
        <h2 className={styles.historyTitle}>
          <History size={18} /> Recent redemptions
        </h2>
        {spendHistory.length === 0 ? (
          <p className={styles.empty}>
            <Coins size={16} /> No redemptions yet. Play a game to start stacking coins.
          </p>
        ) : (
          <ul className={styles.historyList}>
            {spendHistory.slice(0, 8).map((h) => (
              <li key={h.id}>
                <span>{h.label}</span>
                <span className={styles.spent}>-{h.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {toast && (
        <div className={styles.toast} role="status">
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  )
}
