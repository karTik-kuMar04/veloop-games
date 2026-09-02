import { useEffect, useRef, useState } from "react"
import styles from "./CoinBadge.module.css"

/**
 * Live coin balance pill. Animates a bump + floating "+N" whenever the
 * balance increases, giving the shared economy a tactile feel.
 */
export default function CoinBadge({ coins, size = "md" }) {
  const [bump, setBump] = useState(false)
  const [delta, setDelta] = useState(null)
  const prev = useRef(coins)

  useEffect(() => {
    const diff = coins - prev.current
    if (diff > 0) {
      setDelta(diff)
      setBump(true)
      const t = setTimeout(() => setBump(false), 500)
      const t2 = setTimeout(() => setDelta(null), 900)
      return () => {
        clearTimeout(t)
        clearTimeout(t2)
      }
    }
    prev.current = coins
  }, [coins])

  useEffect(() => {
    prev.current = coins
  })

  return (
    <div className={`${styles.badge} ${size === "lg" ? styles.lg : ""} ${bump ? styles.bump : ""}`}>
      <img src="/assets/coin.png" alt="" className={styles.icon} aria-hidden="true" />
      <span className={styles.value}>{coins.toLocaleString()}</span>
      <span className={styles.label}>coins</span>
      {delta != null && (
        <span className={styles.delta} aria-hidden="true">
          +{delta}
        </span>
      )}
    </div>
  )
}
