/**
 * OrderBook order types. These match `ORDER_TYPE` in `@somnia-chain/markets-sdk`
 * (0 limit, 2 IOC/market, 3 post-only). `lib/order-type.test.ts` checks the constants.
 */
export const ORDER_TYPE = {
  LIMIT: 0,
  MARKET: 2,
  POST_ONLY: 3,
} as const

export type OrderStyle = "limit" | "market" | "postOnly"

export function orderTypeCode(style: OrderStyle): number {
  if (style === "market") return ORDER_TYPE.MARKET
  if (style === "postOnly") return ORDER_TYPE.POST_ONLY
  return ORDER_TYPE.LIMIT
}

export function orderTypeLabel(style: OrderStyle): string {
  if (style === "market") return "Market (IOC)"
  if (style === "postOnly") return "Post-only"
  return "Limit"
}
