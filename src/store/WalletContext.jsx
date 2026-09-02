import { createContext, useContext, useEffect, useMemo, useReducer } from "react"

/**
 * Central Game Coin economy.
 * Every game credits coins here, and the Redeem center spends from here.
 * State is persisted to localStorage so a player's balance survives reloads
 * (game progress / currency — not user account data).
 */

const STORAGE_KEY = "veloop:wallet:v1"
const STARTING_COINS = 120

const WalletContext = createContext(null)

const initialState = {
  coins: STARTING_COINS,
  totalEarned: STARTING_COINS,
  xp: 0,
  history: [], // { id, type: 'earn'|'spend', amount, label, ts }
  inventory: {}, // rewardId -> quantity
  bestScores: {}, // gameId -> best score
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    return { ...initialState, ...JSON.parse(raw) }
  } catch {
    return initialState
  }
}

let counter = 0
const entryId = () => `${Date.now()}-${counter++}`

function reducer(state, action) {
  switch (action.type) {
    case "EARN": {
      const amount = Math.max(0, Math.round(action.amount))
      if (amount === 0) return state
      return {
        ...state,
        coins: state.coins + amount,
        totalEarned: state.totalEarned + amount,
        xp: state.xp + (action.xp || 0),
        history: [
          { id: entryId(), type: "earn", amount, label: action.label || "Earned coins", ts: Date.now() },
          ...state.history,
        ].slice(0, 60),
      }
    }
    case "SPEND": {
      const amount = Math.max(0, Math.round(action.amount))
      if (amount > state.coins) return state // guard: never go negative
      const inv = { ...state.inventory }
      if (action.rewardId) inv[action.rewardId] = (inv[action.rewardId] || 0) + 1
      return {
        ...state,
        coins: state.coins - amount,
        inventory: inv,
        history: [
          { id: entryId(), type: "spend", amount, label: action.label || "Redeemed reward", ts: Date.now() },
          ...state.history,
        ].slice(0, 60),
      }
    }
    case "RECORD_SCORE": {
      const prev = state.bestScores[action.gameId] || 0
      if (action.score <= prev) return state
      return { ...state, bestScores: { ...state.bestScores, [action.gameId]: action.score } }
    }
    case "RESET":
      return initialState
    default:
      return state
  }
}

export function WalletProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore quota errors */
    }
  }, [state])

  const value = useMemo(
    () => ({
      ...state,
      earn: (amount, label, xp = 0) => dispatch({ type: "EARN", amount, label, xp }),
      spend: (amount, label, rewardId) => dispatch({ type: "SPEND", amount, label, rewardId }),
      recordScore: (gameId, score) => dispatch({ type: "RECORD_SCORE", gameId, score }),
      canAfford: (amount) => state.coins >= amount,
      reset: () => dispatch({ type: "RESET" }),
    }),
    [state],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error("useWallet must be used within WalletProvider")
  return ctx
}
