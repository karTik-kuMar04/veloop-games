// Redemption catalog. Everything is priced in Game Coins — the single
// currency earned across every game in the platform.
export const REWARDS = [
  {
    id: "ve-small",
    name: "VE Coins Pack",
    desc: "500 VE coins dropped straight into your balance.",
    icon: "/assets/ve.png",
    cost: 250,
    tag: "In-game",
  },
  {
    id: "sve-pack",
    name: "Super VE Bundle",
    desc: "A premium stash of Super VE coins.",
    icon: "/assets/sve.png",
    cost: 600,
    tag: "In-game",
  },
  {
    id: "gems",
    name: "Gem Chest",
    desc: "A glittering chest of rare gems.",
    icon: "/assets/gems.png",
    cost: 900,
    tag: "Premium",
  },
  {
    id: "spins",
    name: "Spin Wheel x5",
    desc: "Five spins on the fortune wheel.",
    icon: "/assets/spins.png",
    cost: 400,
    tag: "Bonus",
  },
  {
    id: "token-pack",
    name: "Golden Tokens",
    desc: "Golden tokens for tournament entries.",
    icon: "/assets/token.png",
    cost: 750,
    tag: "Tournament",
  },
  {
    id: "coin-vault",
    name: "Coin Vault Boost",
    desc: "Double coin earnings for your next session.",
    icon: "/assets/coin.png",
    cost: 1200,
    tag: "Booster",
  },
]

export const getReward = (id) => REWARDS.find((r) => r.id === id)
