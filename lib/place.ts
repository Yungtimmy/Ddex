import type { SomniaMarkets } from "@somnia-chain/markets-sdk"
import type { Address, Hash } from "viem"
import { explainLimit } from "./errors"
import type { MarketShape } from "./prepare"
import { alignPrice, alignQuantity, asRaw, formatRaw } from "./units"

export class OrderNotSent extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OrderNotSent"
  }
}

export type PlacedPerp = {
  hash: Hash
  orderId?: bigint
  fillCount: number
  price: bigint
  quantity: bigint
  maxQuantity: bigint
}

type PlaceMarket = Pick<
  MarketShape,
  "poolAddress" | "marginBank" | "baseSymbol" | "baseDecimals" | "tickSize" | "lotSize" | "minQuantity"
>

/**
 * The only path that sizes and places a perp.
 * `confirmed` has to be the literal `true` from a confirm button or a confirm message.
 * getMaxPerpOrderSize runs first. placePerpOrder runs only when that size fits.
 */
export async function sizeAndPlacePerpOrder(input: {
  markets: SomniaMarkets
  account: Address
  market: PlaceMarket
  isBid: boolean
  price: bigint
  quantity: bigint
  orderType: number
  confirmed: true
  onSized?: () => void
}): Promise<PlacedPerp> {
  if (input.confirmed !== true) {
    throw new OrderNotSent("Refusing to size or place without an explicit confirmation.")
  }

  const tick = asRaw(input.market.tickSize)
  const lot = asRaw(input.market.lotSize)
  const min = asRaw(input.market.minQuantity)
  if (tick === null || lot === null || min === null) {
    throw new OrderNotSent("This market's tick or lot is unreadable. The order was not sent.")
  }
  const price = alignPrice(input.price, tick, input.isBid)
  const quantity = alignQuantity(input.quantity, lot, min)
  if (price <= 0n || quantity <= 0n) {
    throw new OrderNotSent("The aligned price or size is 0. The order was not sent.")
  }

  const symbol = input.market.baseSymbol ?? "perp"
  const max = await input.markets.client.getMaxPerpOrderSize({
    pool: input.market.poolAddress,
    marginBank: input.market.marginBank,
    account: input.account,
    isBid: input.isBid,
    price,
  })
  if (!max.priceable) {
    throw new OrderNotSent("Not sent. The mark is stale or missing, so getMaxPerpOrderSize will not quote a size.")
  }
  if (!max.placeable || quantity > max.maxQuantity) {
    const largest = formatRaw(max.maxQuantity, input.market.baseDecimals)
    throw new OrderNotSent(
      `Not sent. This size is above what the account can place. Largest size: ${largest} ${symbol} (limited by ${explainLimit(max.limitedBy)}).`,
    )
  }

  input.onSized?.()
  const result = await input.markets.trader.placePerpOrder({
    pool: input.market.poolAddress,
    isBid: input.isBid,
    price,
    quantity,
    orderType: input.orderType,
  })
  if (result.receipt.status !== "success") {
    throw new OrderNotSent(`The transaction was mined and reverted (${result.hash}). The order is not on the book.`)
  }
  return {
    hash: result.hash,
    orderId: result.orderId,
    fillCount: result.fills.length,
    price,
    quantity,
    maxQuantity: max.maxQuantity,
  }
}

/** Claim the one-time paper USDso credit. Only after the user confirms the claim card. */
export async function claimPaperUsdso(input: {
  markets: SomniaMarkets
  marginBank: Address
  confirmed: true
}): Promise<{ hash: Hash }> {
  if (input.confirmed !== true) {
    throw new OrderNotSent("Refusing to claim without an explicit confirmation.")
  }
  const result = await input.markets.trader.claimPerpVoucher({ marginBank: input.marginBank })
  if (result.receipt.status !== "success") {
    throw new OrderNotSent(`The claim transaction reverted (${result.hash}).`)
  }
  return { hash: result.hash }
}
