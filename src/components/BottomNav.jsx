import { NavLink } from "react-router-dom"
import { Gamepad2, Gift, Home } from "lucide-react"
import styles from "./BottomNav.module.css"

const ITEMS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/games", label: "Games", icon: Gamepad2, end: false },
  { to: "/redeem", label: "Redeem", icon: Gift, end: false },
]

export default function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="Primary">
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ""}`}
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
