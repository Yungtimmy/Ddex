const ALIASES: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  ether: "ETH",
  solana: "SOL",
  doge: "DOGE",
  dogecoin: "DOGE",
  ripple: "XRP",
  cardano: "ADA",
  avalanche: "AVAX",
  binance: "BNB",
  chainlink: "LINK",
  pepe: "1000PEPE",
  near: "NEAR",
  stellar: "XLM",
  sui: "SUI",
  bnb: "BNB",
}

export type SymbolMarket = { baseSymbol: string | null; poolAddress: string }

export function canonicalSymbol(raw: string): string {
  const key = raw.trim().toLowerCase()
  return ALIASES[key] ?? key.toUpperCase()
}

export function matchMarket<T extends SymbolMarket>(raw: string, markets: readonly T[]): T | undefined {
  const target = canonicalSymbol(raw)
  return markets.find((market) => (market.baseSymbol ?? "").toUpperCase() === target)
}
