// dreamDEX proof: read perp markets via @somnia-chain/markets-sdk and place ONE paper-USDso order
// on Hideki testnet ("Somnia Tokyo", chain 50383). Run once; no server.
import { readFileSync } from "node:fs"
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { createPublicClient, formatEther, http, parseUnits } from "viem"

const KEY_PATH = process.env.KEY_PATH ?? "/workspace/.secrets/dreamdex_testnet_key"
const place = process.argv.includes("--place")
const privateKey = readFileSync(KEY_PATH, "utf8").trim() as `0x${string}`

const markets = new SomniaMarkets({
  chain: hidekiTestnet,
  indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql",
  addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
  privateKey,
})
const account = markets.walletAddress!
console.log("wallet:", account)

const pub = createPublicClient({ chain: hidekiTestnet, transport: http() })
const stt = await pub.getBalance({ address: account })
console.log("STT balance:", formatEther(stt))

const perps = await markets.client.listPerpMarkets()
console.log(`perp markets (${perps.length}):`)
for (const m of perps) console.log(" -", m.baseSymbol, m.poolAddress)

const btc = perps.find((m) => m.baseSymbol === "BTC")
if (!btc) throw new Error("No BTC perp market listed")
if (!place) { console.log("read-only run; pass --place to claim paper USDso and order"); process.exit(0) }
if (stt === 0n) throw new Error("No STT for gas; fund the wallet first")

const elig = await markets.client.getPerpVoucherEligibility(btc.marginBank, account)
if (elig.eligible) console.log("claim voucher:", await markets.trader.claimPerpVoucher({ marginBank: btc.marginBank }))

// Small resting bid well below market so it won't fill; snapped to tickSize/lotSize.
const tick = BigInt(btc.tickSize), lot = BigInt(btc.lotSize)
let price = parseUnits(process.env.PRICE ?? "50000", btc.quoteDecimals); price -= price % tick
let quantity = BigInt(btc.minQuantity); if (quantity % lot) quantity += lot - (quantity % lot)
const max = await markets.client.getMaxPerpOrderSize({ pool: btc.poolAddress, marginBank: btc.marginBank, account, isBid: true, price })
if (!max.priceable) throw new Error("No live mark price")
if (!max.placeable || quantity > max.maxQuantity) throw new Error(`Order too large: ${max.limitedBy}`)
const res = await markets.trader.placePerpOrder({ pool: btc.poolAddress, isBid: true, price, quantity })
console.log("order result:", res)
