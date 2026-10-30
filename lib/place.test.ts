import assert from "node:assert/strict"
import { test } from "node:test"
import type { SomniaMarkets } from "@somnia-chain/markets-sdk"
import type { Address } from "viem"
import { OrderNotSent, sizeAndPlacePerpOrder } from "./place"

const market = {
  poolAddress: "0x0000000000000000000000000000000000000001" as Address,
  marginBank: "0x0000000000000000000000000000000000000002" as Address,
  baseSymbol: "BTC",
  baseDecimals: 8,
  tickSize: "1",
  lotSize: "1",
  minQuantity: "1",
}

const account = "0x0000000000000000000000000000000000000003" as Address

function fake(max: { priceable: boolean; placeable?: boolean; maxQuantity?: bigint; limitedBy?: string }) {
  const calls: string[] = []
  const markets = {
    client: {
      async getMaxPerpOrderSize() {
        calls.push("max")
        return max
      },
    },
    trader: {
      async placePerpOrder(args: { price: bigint; quantity: bigint }) {
        calls.push(`place:${args.price}:${args.quantity}`)
        return {
          hash: `0x${"ab".repeat(32)}`,
          receipt: { status: "success" },
          fills: [],
          orderId: 9n,
        }
      },
    },
  }
  return { calls, markets: markets as unknown as SomniaMarkets }
}

test("refuses before any chain call when confirmation is missing", async () => {
  const { calls, markets } = fake({ priceable: true, placeable: true, maxQuantity: 100n, limitedBy: "collateral" })
  await assert.rejects(
    () =>
      sizeAndPlacePerpOrder({
        markets,
        account,
        market,
        isBid: true,
        price: 100n,
        quantity: 5n,
        orderType: 0,
        confirmed: false as unknown as true,
      }),
    OrderNotSent,
  )
  assert.deepEqual(calls, [])
})

test("does not place when getMaxPerpOrderSize says the size does not fit", async () => {
  const { calls, markets } = fake({ priceable: true, placeable: true, maxQuantity: 4n, limitedBy: "collateral" })
  await assert.rejects(
    () =>
      sizeAndPlacePerpOrder({
        markets,
        account,
        market,
        isBid: true,
        price: 100n,
        quantity: 5n,
        orderType: 0,
        confirmed: true,
      }),
    /Not sent/,
  )
  assert.deepEqual(calls, ["max"])
})

test("does not place when the mark is not priceable", async () => {
  const { calls, markets } = fake({ priceable: false })
  await assert.rejects(
    () =>
      sizeAndPlacePerpOrder({
        markets,
        account,
        market,
        isBid: true,
        price: 100n,
        quantity: 5n,
        orderType: 0,
        confirmed: true,
      }),
    /mark is stale/,
  )
  assert.deepEqual(calls, ["max"])
})

test("places only after the size check passes", async () => {
  const { calls, markets } = fake({ priceable: true, placeable: true, maxQuantity: 10n, limitedBy: "collateral" })
  const placed = await sizeAndPlacePerpOrder({
    markets,
    account,
    market,
    isBid: true,
    price: 100n,
    quantity: 5n,
    orderType: 0,
    confirmed: true,
  })
  assert.deepEqual(calls, ["max", "place:100:5"])
  assert.equal(placed.orderId, 9n)
  assert.equal(placed.fillCount, 0)
})
