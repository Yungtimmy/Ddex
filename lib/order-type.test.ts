import assert from "node:assert/strict"
import { test } from "node:test"
import { ORDER_TYPE as SDK_ORDER_TYPE } from "@somnia-chain/markets-sdk"
import { ORDER_TYPE } from "./order-type"

test("local order types match the Markets SDK", () => {
  assert.equal(ORDER_TYPE.LIMIT, SDK_ORDER_TYPE.LIMIT)
  assert.equal(ORDER_TYPE.MARKET, SDK_ORDER_TYPE.MARKET)
  assert.equal(ORDER_TYPE.POST_ONLY, SDK_ORDER_TYPE.POST_ONLY)
})
