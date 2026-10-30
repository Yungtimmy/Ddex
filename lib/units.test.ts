import assert from "node:assert/strict"
import { test } from "node:test"
import { parseHumanNumber } from "./numbers"
import { alignPrice, alignQuantity, applySlippage, formatRaw } from "./units"

test("parses k-suffix amounts without binary float noise", () => {
  assert.equal(parseHumanNumber("50k"), "50000")
  assert.equal(parseHumanNumber("1.5k"), "1500")
  assert.equal(parseHumanNumber("0.5k"), "500")
  assert.equal(parseHumanNumber("1.25k"), "1250")
  assert.equal(parseHumanNumber("50000"), "50000")
  assert.equal(parseHumanNumber("nope"), null)
})

test("aligns price by side and quantity onto the lot", () => {
  assert.equal(alignPrice(105n, 10n, true), 100n)
  assert.equal(alignPrice(105n, 10n, false), 110n)
  assert.equal(alignPrice(100n, 10n, true), 100n)
  assert.equal(alignQuantity(5n, 4n, 4n), 8n)
  assert.equal(alignQuantity(2n, 4n, 4n), 4n)
  assert.equal(alignQuantity(9n, 4n, 4n), 12n)
})

test("slippage moves the mark in the trade direction", () => {
  assert.equal(applySlippage(10_000n, true, 100), 10_100n)
  assert.equal(applySlippage(10_000n, false, 100), 9_900n)
  assert.equal(formatRaw(1_500_000_000n, 8), "15")
  assert.equal(formatRaw(12_3456n, 4, 2), "12.35")
  assert.equal(formatRaw(19_999n, 3, 2), "20")
})
