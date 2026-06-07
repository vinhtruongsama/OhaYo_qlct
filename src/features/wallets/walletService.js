export function createWallet({ name, balance = 0, icon, color }) {
  return {
    id: `wallet_${Date.now()}`,
    name,
    balance,
    icon,
    color
  };
}
