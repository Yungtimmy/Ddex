import assert from "node:assert/strict"
import { test } from "node:test"
import type { Address } from "viem"
import type { OrderDraft } from "./intent"
import { prepareOrder, type MarketShape } from "./prepare"

const market: MarketShape = {
  baseSymbol: "BTC",
  quoteSymbol: "USDso",
  baseDecimals: 8,
  quoteDecimals: 2,
  tickSize: "10",
  lotSize: "1",
  minQuantity: "1",
  poolAddress: "0x0000000000000000000000000000000000000001" as Address,
  marginBank: "0x0000000000000000000000000000000000000002" as Address,
  markPrice: "10000",
}

const draft: OrderDraft = {
  kind: "order",
  symbol: "btc",
  isBid: true,
  quantity: "1.05",
  price: "1.05",
  orderType: "limit",
  slippageBps: 100,
}

test("aligns a limit before the card is shown", () => {
  const prepared = prepareOrder(draft, market)
  assert.equal(prepared.ok, true)
  if (!prepared.ok) return
  assert.equal(prepared.order.price, 100n)
  assert.equal(prepared.order.quantity, 105_000_000n)
  assert.equal(prepared.order.orderType, 0)
  assert.match(prepared.order.alignment ?? "", /tick/)
})

test("a market order without a mark asks for a bound", () => {
  const prepared = prepareOrder(
    { ...draft, orderType: "market", price: undefined, isBid: false },
    { ...market, markPrice: null },
  )
  assert.equal(prepared.ok, false)
})

test("a market order bounds the indexed mark", () => {
  const prepared = prepareOrder(
    { ...draft, orderType: "market", price: undefined, quantity: "1", isBid: true },
    market,
  )
  assert.equal(prepared.ok, true)
  if (!prepared.ok) return
  assert.equal(prepared.order.orderType, 2)
  assert.equal(prepared.order.price, 10100n)
})
