# The SDK quickstart and funding guide configure Shannon, not Hideki perps

Severity: major
Area: docs

## Steps to reproduce

1. Open the README installed with `@somnia-chain/markets-sdk@0.32.1`.
2. Follow the sentence "For testnet, swap all four".
3. Open the funding guide that README's package points at: https://prd.smk.somnia.host/docs/typescript/how-to/get-testnet-funds
4. Compare that setup with the Hideki perp markets returned by `https://hideki-dev.smk.somnia.host/v1/graphql`.

## Expected

The SDK version the perps page tells builders to install (0.32.1) has a testnet quickstart that reaches dreamDEX perps: chain id 50383, indexer `https://hideki-dev.smk.somnia.host/v1/graphql`, paper USDso via `claimPerpVoucher`, collateral `0xed7993A74dAe1e6656B704A424DcD8711aAf4F72`.

## Actual

The package README's testnet swap is a different stack:

| Setting | Package README "for testnet" | dreamDEX perps |
| --- | --- | --- |
| Chain | `somniaShannon` (50312) | `hidekiTestnet` (50383) |
| Indexer | `https://dev.smk.somnia.host/v1/graphql` | `https://hideki-dev.smk.somnia.host/v1/graphql` |
| WebSocket | `wss://api.infra.testnet.somnia.network/ws` | `wss://api.hideki2.infra.testnet.somnia.network/ws` |
| Addresses | `SOMNIA_TESTNET_ADDRESSES` | `SOMNIA_HIDEKI_TESTNET_ADDRESSES` |

The hosted funding guide then says to mint USDso at `0x9c32f3827a1a99f0cf9b213de8b53ec3d57bb171` and `depositMargin("BTC/USDso:USDso", 100)`. In the SDK bridge registry that address is Shannon USDso (`BridgeToken.USDso` on `ChainId.somniaShannon`). Hideki USDso, confirmed by `symbol()` on 2026-10-30 and by every perp row's `quoteToken`, is `0xed7993A74dAe1e6656B704A424DcD8711aAf4F72`.

A builder who starts from the npm page never calls `listPerpMarkets` against the Hideki indexer, never sees the 21 Hideki books, and mints a token the Hideki MarginBank does not use. The dreamDEX perps page has the right connect snippet, and it does not say that the SDK's own testnet quickstart is a different network.

`proof.ts` in this repo had to ignore that quickstart and hard-code `hidekiTestnet` plus the Hideki indexer. The chains walkthrough (`docs/CHAINS_WALKTHROUGH.md` in the same package) does target Hideki, then funds the session with HBTT, which is also not the perps collateral.

## Evidence

- `@somnia-chain/markets-sdk@0.32.1` `README.md`, "Create an exchange", the "For testnet, swap all four" paragraph.
- https://prd.smk.somnia.host/docs/typescript/how-to/get-testnet-funds — Shannon faucets, Shannon USDso mint, `depositMargin("BTC/USDso:USDso", 100)`.
- SDK `dist/chains/bridge/registry.js`: Shannon USDso `address: "0x9c32F3827A1a99f0cf9B213de8b53eC3d57bb171"`; Hideki USDso `address: "0xed7993A74dAe1e6656B704A424DcD8711aAf4F72"`.
- Indexer read, 2026-10-30: 21 perp rows, all `quoteSymbol: USDso`, all `quoteToken: 0xed7993a74dae1e6656b704a424dcd8711aaf4f72`, all `marginBank: 0x478769e1177c0773c43a593dccc4ad15f15f1394`.
- Perps connect snippet: https://app.testnet.dreamdex.io/docs/developers/perps-testnet/README.md

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network the bounty is on: Hideki testnet, chain id 50383
- Wallet: none

## Suggested fix

In the package README, replace the single "for testnet" sentence with two recipes: Shannon (`somniaShannon`, `dev.smk.somnia.host`) and Hideki perps (`hidekiTestnet`, `hideki-dev.smk.somnia.host`, `SOMNIA_HIDEKI_TESTNET_ADDRESSES`). Point the funding guide's perp section at `claimPerpVoucher` and the Hideki USDso address, and say the public `mint` it shows is the Shannon token.

On the dreamDEX perps page, add one line above the connect snippet: the SDK README's testnet example is Shannon, and copying it will not list these markets.
