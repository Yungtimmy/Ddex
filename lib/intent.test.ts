import assert from "node:assert/strict"
import { test } from "node:test"
import { interpret, type OrderDraft } from "./intent"

function order(reply: ReturnType<typeof interpret>): OrderDraft {
  assert.equal(reply.effect, "ready_order")
  assert.equal(reply.draft?.kind, "order")
  return reply.draft as OrderDraft
}

test("parses a limit long", () => {
  const draft = order(interpret("long 0.001 BTC at 50000", null))
  assert.equal(draft.isBid, true)
  assert.equal(draft.symbol, "btc")
  assert.equal(draft.quantity, "0.001")
  assert.equal(draft.price, "50000")
  assert.equal(draft.orderType, "limit")
})

test("parses a market short and a minimum bid", () => {
  const market = order(interpret("short 1 ETH market", null))
  assert.equal(market.isBid, false)
  assert.equal(market.symbol, "eth")
  assert.equal(market.quantity, "1")
  assert.equal(market.orderType, "market")
  assert.equal(market.price, undefined)

  const min = order(interpret("bid minimum SOL at 150", null))
  assert.equal(min.useMin, true)
  assert.equal(min.symbol, "sol")
  assert.equal(min.price, "150")
  assert.equal(min.isBid, true)
})

test("fills a partial order on the next message", () => {
  const first = interpret("long btc", null)
  assert.equal(first.effect, "none")
  assert.match(first.text, /Still need/)
  const draft = order(interpret("0.001 at 50k", first.draft))
  assert.equal(draft.quantity, "0.001")
  assert.equal(draft.price, "50000")
  assert.equal(draft.symbol, "btc")
})

test("confirm and cancel only apply to a pending draft", () => {
  assert.match(interpret("yes", null).text, /nothing to confirm/i)
  const pending = order(interpret("long 0.001 BTC at 50000", null))
  assert.equal(interpret("please confirm", pending).effect, "confirm")
  assert.equal(interpret("cancel it", pending).effect, "discard")
  assert.match(interpret("cancel", null).text, /does not cancel an order already on the book/)
})

test("claim, markets, and balance are not orders", () => {
  assert.equal(interpret("claim paper USDso", null).effect, "ready_claim")
  assert.equal(interpret("what markets are live", null).effect, "markets")
  assert.equal(interpret("what is my STT balance", null).effect, "balance")
  assert.equal(interpret("help", null).effect, "none")
})

test("post-only, bound, and slippage", () => {
  const post = order(interpret("post only long 0.01 ETH at 3000", null))
  assert.equal(post.orderType, "postOnly")
  assert.equal(post.price, "3000")

  const bound = order(interpret("market buy 0.001 BTC bound 100000", null))
  assert.equal(bound.orderType, "market")
  assert.equal(bound.price, "100000")
  assert.equal(bound.quantity, "0.001")

  const slip = order(interpret("short 1 SOL market with 2% slippage", null))
  assert.equal(slip.slippageBps, 200)
  assert.equal(slip.orderType, "market")
  assert.equal(slip.symbol, "sol")
})
