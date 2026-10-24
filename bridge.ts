// One-shot: bridge testnet STT from Shannon (50312) to Hideki/Tokyo (50383) for gas.
import { readFileSync } from "node:fs"
import { BridgeToken, ChainId, createBridgeTransfer, sendBridgeStep, somniaShannon } from "@somnia-chain/markets-sdk/chains"
import { createPublicClient, http, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
const account = privateKeyToAccount(readFileSync(process.env.KEY_PATH ?? "/workspace/.secrets/dreamdex_testnet_key", "utf8").trim() as `0x${string}`)
const shannon = createPublicClient({ chain: somniaShannon, transport: http() })
const plan = createBridgeTransfer({ token: BridgeToken.STT, from: ChainId.somniaShannon, to: ChainId.hidekiTestnet, amount: parseEther(process.env.AMOUNT ?? "2"), recipient: account.address })
if (plan.approveStep) console.log("approve tx:", (await sendBridgeStep(shannon, plan.approveStep, { account })).transactionHash)
const r = await sendBridgeStep(shannon, plan.bridgeStep, { account })
console.log("bridge tx:", r.transactionHash, r.status)
