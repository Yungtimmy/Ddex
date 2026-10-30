// One-shot: bridge testnet STT from Shannon (50312) to Hideki (50383) for gas.
// The Shannon receipt is not Hideki credit. See feedback/005.
import { BridgeToken, ChainId, createBridgeTransfer, sendBridgeStep, somniaShannon } from "@somnia-chain/markets-sdk/chains"
import { createPublicClient, http, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { readPrivateKey } from "./lib/key"

const account = privateKeyToAccount(readPrivateKey())
const shannon = createPublicClient({ chain: somniaShannon, transport: http() })
const plan = createBridgeTransfer({
  token: BridgeToken.STT,
  from: ChainId.somniaShannon,
  to: ChainId.hidekiTestnet,
  amount: parseEther(process.env.AMOUNT ?? "2"),
  recipient: account.address,
})
if (plan.approveStep) {
  console.log("approve tx:", (await sendBridgeStep(shannon, plan.approveStep, { account })).transactionHash)
}
const receipt = await sendBridgeStep(shannon, plan.bridgeStep, { account })
console.log("bridge tx:", receipt.transactionHash, receipt.status)
console.log("wallet:", account.address)
