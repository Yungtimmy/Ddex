import { parseUnits, type Address } from "viem"
import type { OrderDraft } from "./intent"
import { orderTypeCode, orderTypeLabel } from "./order-type"
import { alignPrice, alignQuantity, applySlippage, asRaw, formatRaw } from "./units"

export type MarketShape = {
  baseSymbol: string | null
  quoteSymbol: string | null
  baseDecimals: number
  quoteDecimals: number
  tickSize: string
  lotSize: string
  minQuantity: string
  poolAddress: Address
  marginBank: Address
  markPrice: string | null
}

export type PreparedOrder = {
  symbol: string
  quoteSymbol: string
  pool: Address
  marginBank: Address
  isBid: boolean
  price: bigint
  quantity: bigint
  orderType: number
  orderTypeLabel: string
  priceLabel: string
  quantityLabel: string
  markLabel: string | null
  baseDecimals: number
  alignment: string | null
}

export type PrepareResult = { ok: true; order: PreparedOrder } | { ok: false; error: string }

/** Build the exact order the card will ask the user to confirm. No chain writes. */
export function prepareOrder(draft: OrderDraft, market: MarketShape): PrepareResult {
  if (draft.isBid === undefined || !draft.symbol) {
    return { ok: false, error: "The order is incomplete." }
  }
  const symbol = market.baseSymbol ?? draft.symbol.toUpperCase()
  const quoteSymbol = market.quoteSymbol ?? "quote"
  const tick = asRaw(market.tickSize)
  const lot = asRaw(market.lotSize)
  const min = asRaw(market.minQuantity)
  if (tick === null || lot === null || min === null) {
    return { ok: false, error: `${symbol} has a tick or lot this app cannot align. The order was not built.` }
  }

  let requestedQty: bigint
  try {
    requestedQty = draft.useMin ? min : parseUnits(draft.quantity ?? "", market.baseDecimals)
  } catch {
    return {
      ok: false,
      error: `Size "${draft.quantity ?? ""}" does not fit this market (${market.baseDecimals} base decimals).`,
    }
  }
  const quantity = alignQuantity(requestedQty, lot, min)

  const notes: string[] = []
  let requestedPrice: bigint
  if (draft.orderType === "market" && !draft.price) {
    const mark = asRaw(market.markPrice)
    if (mark === null || mark === 0n) {
      return {
        ok: false,
        error: `${symbol} has no indexed mark. Give a bound, for example: market long 0.001 ${symbol} bound 100000.`,
      }
    }
    requestedPrice = applySlippage(mark, draft.isBid, draft.slippageBps)
    notes.push(
      `The bound is the indexed mark ${draft.isBid ? "plus" : "minus"} ${draft.slippageBps / 100}%.`,
    )
  } else {
    try {
      requestedPrice = parseUnits(draft.price ?? "", market.quoteDecimals)
    } catch {
      return {
        ok: false,
        error: `Price "${draft.price ?? ""}" does not fit this market (${market.quoteDecimals} quote decimals).`,
      }
    }
  }

  const price = alignPrice(requestedPrice, tick, draft.isBid)
  if (price !== requestedPrice) notes.push("The price was aligned to the market tick.")
  if (quantity !== requestedQty) notes.push("The size was raised onto the lot grid (and the minimum, if it was below it).")
  if (price <= 0n) return { ok: false, error: "The price aligns to 0 on this tick. Raise it." }
  if (quantity <= 0n) return { ok: false, error: "The size aligns to 0 on this lot. Raise it." }

  const mark = asRaw(market.markPrice)
  return {
    ok: true,
    order: {
      symbol,
      quoteSymbol,
      pool: market.poolAddress,
      marginBank: market.marginBank,
      isBid: draft.isBid,
      price,
      quantity,
      orderType: orderTypeCode(draft.orderType),
      orderTypeLabel: orderTypeLabel(draft.orderType),
      priceLabel: `${formatRaw(price, market.quoteDecimals)} ${quoteSymbol}`,
      quantityLabel: `${formatRaw(quantity, market.baseDecimals)} ${symbol}`,
      markLabel: mark && mark > 0n ? `${formatRaw(mark, market.quoteDecimals, 2)} ${quoteSymbol}` : null,
      baseDecimals: market.baseDecimals,
      alignment: notes.length ? notes.join(" ") : null,
    },
  }
}
