# SDK writes need 0.6 STT on hand, not the 0.0003–0.003 STT the perps page quotes

Severity: major
Area: docs

## Steps to reproduce

1. Install `@somnia-chain/markets-sdk@0.32.1` and construct `SomniaMarkets` the way the perps developer page shows (`hidekiTestnet`, the Hideki indexer, `SOMNIA_HIDEKI_TESTNET_ADDRESSES`).
2. Fund the signer on Hideki with more STT than a perp transaction costs and less than 0.6 STT. 0.05 STT is the balance the SDK's own bridge helper cites as rejected.
3. Call any default SDK write. `trader.placePerpOrder`, `trader.claimPerpVoucher`, and `sendBridgeStep` all use the same ceiling. Leave `gas` and `maxFeePerGas` unset.
4. Read the rejection from the node.

Arithmetic, using the SDK defaults and the base fee measured on 2026-10-30:

| | Gas | Fee | STT locked up front |
| --- | --- | --- | --- |
| SDK admission check | 10,000,000 (`DEFAULT_GAS`) | 60 gwei (`DEFAULT_FEES.maxFeePerGas`) | **0.6** |
| Charged if the tx actually uses 1.56M gas at the live 6 gwei base fee | 1,560,000 | 6 gwei | 0.00936 |
| Upper end of the range printed on the perps page | — | — | 0.003 |

`10_000_000 * 60 gwei = 0.6 * 10^18 wei`.

## Expected

Following "Get test funds" on the perps developer page is enough to claim paper USDso and place the sample order. That page says gas is billed on what a transaction uses, not on its gas limit, and that perp-pool transactions measured on testnet cost between 0.0003 and 0.003 STT.

## Actual

The charge and the admission check are different numbers.

- Published SDK 0.32.1 sets `DEFAULT_GAS = 10_000_000n` and `DEFAULT_FEES.maxFeePerGas = 60_000_000_000n` (60 gwei). `dist/config.d.ts` says gas is never estimated, and that the mempool admits a transaction only when that ceiling is funded on top of the transaction `value`. Unused gas is refunded.
- `SendBridgeStepOptions` in `dist/chains/bridge/send.d.ts` says the same envelope in those words, and records a live measurement: a 0.05 STT account is rejected for insufficient balance.
- On 2026-10-30, `eth_gasPrice` and `baseFeePerGas` on Hideki (`https://api.hideki2.infra.testnet.somnia.network`) and on Shannon were both 6 gwei. At that base fee, the page's own "up to about 1.56M gas" `placeOrderFor` measurement costs about 0.00936 STT, which is already above the 0.003 STT top of the "Get test funds" range. The 10M ceiling would cost 0.06 STT if it were ever fully used. The wallet still has to hold 0.6 STT before the node accepts the raw transaction.
- A stop order adds a further 0.15 STT of `value` (stated in the same page's pitfalls, refunded on cancel). Sent through the SDK, that call needs 0.15 STT of value plus the 0.6 STT envelope.

This repo's 24 Oct 2026 proof was written around that envelope. `README.md` says the SDK wants about 0.6 STT on hand per write. `bridge.ts` defaults `AMOUNT` to 2 STT so the Hideki wallet clears the envelope with room for more than one write.

## Evidence

- Perps page, "Get test funds": https://app.testnet.dreamdex.io/docs/developers/perps-testnet/README.md
- Same page, "Leave plenty of gas": measured `placeOrderFor` usage up to about 1.56M gas, `eth_estimateGas` of 3.2M for a resting order and 7.7M for a multi-level IOC, bot kit gas limit 10,000,000. That section is about the limit to set on a raw call. It does not say the SDK's fixed 60 gwei ceiling makes 10M gas a 0.6 STT preflight.
- SDK source in the published 0.32.1 tarball: `dist/config.js` (`DEFAULT_FEES`, `DEFAULT_GAS`), `dist/config.d.ts`, `dist/chains/bridge/send.d.ts`.
- Live fee read, 2026-10-30, no wallet: Hideki and Shannon `baseFeePerGas = 6000000000`.
- No failed-transaction hash is attached. The node rejection is the step a reviewer with a lightly funded Hideki key can record.

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network: Hideki testnet (Somnia Tokyo), chain id 50383, `net_version` 50000259
- Wallet: none for this note

## Suggested fix

On the perps "Get test funds" section, state the admission rule next to the charged cost: an `@somnia-chain/markets-sdk` write signs a 10,000,000 gas ceiling at 60 gwei, so the signer needs 0.6 STT above `value` even though the receipt burns far less. Tell builders they can pass a lower `gas` on `placePerpOrder` / `claimPerpVoucher` when they have sized the call, and that a stop adds 0.15 STT of value on top of the envelope.

Keep the measured 0.0003–0.003 STT figure only if it still matches current Hideki base fee and the gas perp pools actually use. At 6 gwei it does not cover the 1.56M gas figure printed lower on the same page.
