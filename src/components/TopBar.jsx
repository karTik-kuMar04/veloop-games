import { Link, NavLink, useNavigate } from "react-router-dom"
import { Gamepad2, Gift, Home } from "lucide-react"
import { useWallet } from "../store/WalletContext"
import CoinBadge from "./CoinBadge"
import styles from "./TopBar.module.css"

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/games", label: "Games", icon: Gamepad2, end: false },
  { to: "/redeem", label: "Redeem", icon: Gift, end: false },
]

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

        {/* Centred segmented nav — desktop/tablet only. Hidden on mobile;
            BottomNav is the sole wayfinding surface there. */}
        <nav className={styles.nav} aria-label="Primary">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`}
            >
              <Icon size={16} strokeWidth={2.3} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button type="button" className={styles.walletBtn} onClick={() => navigate("/redeem")}>
          <CoinBadge coins={coins} />
        </button>
      </div>
    </header>
  )
}