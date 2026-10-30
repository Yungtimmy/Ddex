# `SOMNIA_HIDEKI_TESTNET_ADDRESSES.collateral` is 6-decimal tUSDC, not perp USDso

Severity: major
Area: SDK

## Steps to reproduce

1. Install `@somnia-chain/markets-sdk@0.32.1`.
2. Read `SOMNIA_HIDEKI_TESTNET_ADDRESSES.collateral` and `.testUsdc`.
3. On Hideki (`https://api.hideki2.infra.testnet.somnia.network`), call `name()`, `symbol()`, and `decimals()` on that address and on the perps collateral printed in the developer docs.
4. Read `quoteToken` from `listPerpMarkets()` (or the indexer query below).

## Expected

The address bundle the perps connect snippet tells you to pass (`addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES`) exposes the MarginBank collateral. The developer page labels that token "Collateral (USDso)" at `0xed7993A74dAe1e6656B704A424DcD8711aAf4F72`. A field named `collateral` on the Hideki bundle is that token, 18 decimals.

## Actual

Live `eth_call` on 2026-10-30:

| Constant or doc row | Address | `name` / `symbol` | Decimals |
| --- | --- | --- | --- |
| `SOMNIA_HIDEKI_TESTNET_ADDRESSES.collateral` | `0x9E9492cC533E8696A3b6afC7df730800DF75148f` | Test USDC / tUSDC | 6 |
| `SOMNIA_HIDEKI_TESTNET_ADDRESSES.testUsdc` | same address | Test USDC / tUSDC | 6 |
| Docs "Collateral (USDso)", and every perp `quoteToken` | `0xed7993A74dAe1e6656B704A424DcD8711aAf4F72` | USDso / USDso | 18 |

The bundle does contain the right `marginBank` (`0x478769E1177C0773c43A593DCCc4Ad15F15F1394`) and `perpPoolFactory` (`0xE631fAEE547baeE07353E290f0562ea67d856560`). It has no field for perp USDso, the voucher distributor (`0x2ACD9EFdA721450906bfE1bef3edE269636E42C4` on the perps page), the liquidation engine, or the insurance fund.

The perps page already says the bundle's `collateral` entry is a different token. It does not say which token, that it has 6 decimals, or that it is the same storage slot as `testUsdc`. Approving or sizing against `.collateral` for a perp pulls tUSDC. A quantity scaled with 18 decimals against a 6-decimal token is the same class of bug the page demonstrates with SOL: the pool does not revert with "wrong decimals".

`getPerpSystemConfig(marginBank)` and `quoteToken` on the market row are the correct reads. Nothing in the exported Hideki constant map is the shortcut.

## Evidence

- `dist/addresses.js` in `@somnia-chain/markets-sdk@0.32.1`, `SOMNIA_HIDEKI_TESTNET_ADDRESSES`.
- View calls above, Hideki HTTP RPC, 2026-10-30.
- Indexer: all 21 perp markets share `quoteToken` `0xed7993a74dae1e6656b704a424dcd8711aaf4f72` and `quoteDecimals` 18. `chain_metadata.latest_processed_block` was 37204166.
- Perps contract table and the `collateral` pitfall: https://app.testnet.dreamdex.io/docs/developers/perps-testnet/README.md

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network: Hideki testnet, chain id 50383
- Wallet: none

## Suggested fix

Add `perpCollateral` (and the voucher distributor, if it is stable) to `SOMNIA_HIDEKI_TESTNET_ADDRESSES`, or rename the current field so it cannot be read as the MarginBank token. In the pitfall, name it: "`collateral` and `testUsdc` are both 6-decimal tUSDC at `0x9E9492…`. Perp USDso is the market's `quoteToken`."
