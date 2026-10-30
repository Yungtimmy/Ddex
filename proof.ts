// CLI twin of the chat's place path. `--place` is the confirmation.
// The web app never reads this key; it signs with the connected wallet.
import { createPublicClient, formatEther, http, parseUnits } from "viem"
import { readPrivateKey } from "./lib/key"
import { ORDER_TYPE } from "./lib/order-type"
import { claimPaperUsdso, sizeAndPlacePerpOrder } from "./lib/place"
import { createHidekiMarkets, hidekiTestnet } from "./lib/session"

const place = process.argv.includes("--place")
const markets = createHidekiMarkets({ privateKey: readPrivateKey() })

try {
  const account = markets.walletAddress
  if (!account) throw new Error("The SDK did not derive a wallet from the key.")
  console.log("wallet:", account)

  const pub = createPublicClient({ chain: hidekiTestnet, transport: http() })
  const stt = await pub.getBalance({ address: account })
  console.log("STT balance:", formatEther(stt))

  const perps = await markets.client.listPerpMarkets()
  console.log(`perp markets (${perps.length}):`)
  for (const market of perps) console.log(" -", market.baseSymbol, market.poolAddress)

  const btc = perps.find((market) => market.baseSymbol === "BTC")
  if (!btc) throw new Error("No BTC perp market listed")
  if (!place) {
    console.log("read-only run; pass --place to claim paper USDso and order")
  } else {
    if (stt === 0n) throw new Error("No STT for gas; fund the wallet first")
    const eligibility = await markets.client.getPerpVoucherEligibility(btc.marginBank, account)
    if (eligibility.eligible) {
      console.log("claim voucher:", await claimPaperUsdso({ markets, marginBank: btc.marginBank, confirmed: true }))
    } else {
      console.log("voucher:", eligibility.reason)
    }
    const price = parseUnits(process.env.PRICE ?? "50000", btc.quoteDecimals)
    const placed = await sizeAndPlacePerpOrder({
      markets,
      account,
      market: btc,
      isBid: true,
      price,
      quantity: BigInt(btc.minQuantity),
      orderType: ORDER_TYPE.LIMIT,
      confirmed: true,
    })
    console.log("order result:", placed)
  }
} finally {
  await markets.close()
}
