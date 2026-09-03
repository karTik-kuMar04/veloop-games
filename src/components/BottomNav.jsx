import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { Gamepad2, Gift, Home } from "lucide-react"
import styles from "./BottomNav.module.css"

const ITEMS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/games", label: "Games", icon: Gamepad2, end: false },
  { to: "/redeem", label: "Redeem", icon: Gift, end: false },
]

// Matches a route to an item index the same way NavLink's `end` rule would,
// so the coin knows where to land on first paint (before any ref measuring).
function matchIndex(pathname) {
  const hit = ITEMS.findIndex(({ to, end }) =>
    end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
  )
  return hit === -1 ? 0 : hit
}

export default function BottomNav() {
  const location = useLocation()
  const activeIndex = matchIndex(location.pathname)

  const trackRef = useRef(null)
  const itemRefs = useRef([])
  const [coin, setCoin] = useState({ x: 0, width: 0, ready: false })

  useLayoutEffect(() => {
    const el = itemRefs.current[activeIndex]
    const track = trackRef.current
    if (!el || !track) return
    const elBox = el.getBoundingClientRect()
    const trackBox = track.getBoundingClientRect()
    setCoin({
      x: elBox.left - trackBox.left,
      width: elBox.width,
      ready: true,
    })
  }, [activeIndex])

  // Re-measure on resize since the pill's width is content-driven.
  useEffect(() => {
    const onResize = () => {
      const el = itemRefs.current[activeIndex]
      const track = trackRef.current
      if (!el || !track) return
      const elBox = el.getBoundingClientRect()
      const trackBox = track.getBoundingClientRect()
      setCoin((c) => ({ ...c, x: elBox.left - trackBox.left, width: elBox.width }))
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [activeIndex])

  return (
    <nav className={styles.dock} aria-label="Primary">
      <div className={styles.track} ref={trackRef}>
        <span
          className={styles.coin}
          style={{
            transform: `translateX(${coin.x}px)`,
            width: coin.width,
            opacity: coin.ready ? 1 : 0,
          }}
          aria-hidden="true"
        />
        {ITEMS.map(({ to, label, icon: Icon, end }, i) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            ref={(node) => (itemRefs.current[i] = node)}
            className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ""}`}
          >
            <Icon size={20} strokeWidth={2.3} className={styles.icon} />
            <span className={styles.label}>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}