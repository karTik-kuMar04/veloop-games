import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import { getGame } from "./data/games"
import TopBar from "./components/TopBar"
import BottomNav from "./components/BottomNav"
import Home from "./pages/Home"
import Redeem from "./pages/Redeem"
import GameDetail from "./pages/GameDetail"
import SliceStorm from "./pages/games/SliceStorm"
import MergeMaster from "./pages/games/MergeMaster"

// Full-screen playable routes hide the chrome so the game owns the viewport.
const PLAYABLE_ROUTES = {
  "slice-storm": SliceStorm,
  "merge-master": MergeMaster,
}

function GameRoute() {
  const location = useLocation()
  const id = location.pathname.split("/play/")[1]
  const game = getGame(id)
  if (!game || !game.playable) return <Navigate to="/" replace />
  const Comp = PLAYABLE_ROUTES[id]
  return <Comp />
}

export default function App() {
  const location = useLocation()
  const isPlaying = location.pathname.startsWith("/play/")

  if (isPlaying) {
    return (
      <Routes>
        <Route path="/play/:id" element={<GameRoute />} />
      </Routes>
    )
  }

  return (
    <div className="vl-app">
      <TopBar />
      <div className="vl-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games" element={<Home />} />
          <Route path="/redeem" element={<Redeem />} />
          <Route path="/game/:id" element={<GameDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  )
}
