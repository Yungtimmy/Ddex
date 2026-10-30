# Bridging STT to Hideki reports success on the Shannon receipt, before Hideki is credited

Severity: major
Area: docs

## Steps to reproduce

1. Read `bridge.ts` in this repo. It builds `createBridgeTransfer({ token: BridgeToken.STT, from: ChainId.somniaShannon, to: ChainId.hidekiTestnet, amount: parseEther(process.env.AMOUNT ?? "2"), recipient })` and logs `sendBridgeStep(...).status`.
2. Read `SendBridgeStepOptions` and the bridge guide shipped in `@somnia-chain/markets-sdk@0.32.1` (`docs/BRIDGE.md`).
3. Inspect the plan's destination. On 2026-10-30 that destination was the Hideki native STT router below.
4. Run the script with a Shannon key, then immediately read the recipient's Hideki STT balance.

## Expected

The perps developer page tells a builder how a script gets Hideki STT. The call it recommends resolves when the Hideki wallet can pay for `claimPerpVoucher` / `placePerpOrder`. A success log means the gas is there.

## Actual

The perps page's only gas instruction is the app: sign in at app.testnet.dreamdex.io, Link a Bot, then "Send it … for gas" or Top up. There is no mention of `createBridgeTransfer`, Shannon chain id 50312, or a wait for the relayer.

The programmatic path this repo uses behaves like this:

- `sendBridgeStep` waits for the **Shannon** receipt (`eth_sendRawTransactionSync` when the node has it). `docs/BRIDGE.md` says delivery is asynchronous: the origin transaction escrows and dispatches, and the far side is credited seconds later. The transaction you send does not wait for it.
- STT is `model: "native"` on both sides. `requiresDestinationLiquidity` is true. Delivery is paid from the Hideki router's own STT balance. If that balance is short, `process()` reverts and the transfer sits until the router is seeded. `bridge.ts` does not read `plan.destination.requiresDestinationLiquidity` or the router balance. The SDK guide says a caller who sends the planner transactions themselves has to do that check. `exchange.bridge.transfer` does it; `sendBridgeStep` does not.
- The Shannon signer must hold the bridged `value` **plus** the 0.6 STT fee envelope from note 001. The default in `bridge.ts` is 2 STT of value, so Shannon needs about 2.6 STT before the origin transaction is admitted. A Shannon faucet drip sized to the perps page's 0.003 STT figure cannot bridge.
- The Hideki router was not short on the day this was checked. That is included so the note is not read as "the router is empty".

| Field | Value on 2026-10-30 |
| --- | --- |
| Destination network | `hideki2testnet` (chain id 50383) |
| Router | `0xB04373932bc05347757da6b8a226d7657584aB35` |
| `requiresDestinationLiquidity` | true |
| Router STT balance | 99931835.328758295879056803 STT (`99931835328758295879056803` wei) |

A Shannon receipt of `success` followed at once by `proof.ts --place` can still throw "No STT for gas" on Hideki, because `proof.ts` only checks the Hideki balance and the bridge script only checks the Shannon receipt.

The package chains walkthrough does document the bridge, including the 0.6 STT comment, and it is not linked from the perps page.

## Evidence

- `bridge.ts` (this repo): logs `r.transactionHash` and `r.status` from `sendBridgeStep` on a Shannon public client.
- SDK `docs/BRIDGE.md`: "The transaction you send does not wait for it." Native-route liquidity section, and the relayer as a liveness dependency (`quoteGasPayment` is 0; the relayer pays delivery gas).
- SDK `dist/chains/bridge/registry.js`, STT Hideki entry: router `0xB04373932bc05347757da6b8a226d7657584aB35`.
- Hideki `getBalance` of that router, 2026-10-30, HTTP RPC.
- Perps "Get test funds": https://app.testnet.dreamdex.io/docs/developers/perps-testnet/README.md
- No bridge transaction hash is attached.

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Origin: Shannon, chain id 50312
- Destination: Hideki testnet, chain id 50383
- Wallet: none for the balance read

## Suggested fix

On the perps gas section, document the headless path next to the app button: bridge STT Shannon → Hideki with `createBridgeTransfer`, require the origin to cover `amount + 0.6 STT`, check the Hideki router's balance when `requiresDestinationLiquidity` is set, and wait until `delivered(messageId)` (or until the recipient's Hideki balance moves) before treating the transfer as gas. Make `sendBridgeStep`'s return value say which chain confirmed.
