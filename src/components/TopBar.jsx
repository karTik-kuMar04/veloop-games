import { Link, NavLink, useNavigate } from "react-router-dom"
import { Gamepad2, Gift, Home } from "lucide-react"
import { useWallet } from "../store/WalletContext"
import CoinBadge from "./CoinBadge"
import styles from "./TopBar.module.css"

export default function TopBar() {
  const { coins } = useWallet()
  const navigate = useNavigate()

  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand} aria-label="Veloop Games home">
          <span className={styles.logoMark}>
            <Gamepad2 size={20} strokeWidth={2.5} />
          </span>
          <span className={styles.logoText}>
            Veloop<span className={styles.logoAccent}>Games</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          <NavLink to="/" end className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`}>
            <Home size={16} />
            <span>Home</span>
          </NavLink>
          <NavLink to="/redeem" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`}>
            <Gift size={16} />
            <span>Redeem</span>
          </NavLink>
        </nav>

        <button type="button" className={styles.walletBtn} onClick={() => navigate("/redeem")}>
          <CoinBadge coins={coins} />
        </button>
      </div>
    </header>
  )
}
