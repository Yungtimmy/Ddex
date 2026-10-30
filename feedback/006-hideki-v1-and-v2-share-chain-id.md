# Hideki v1 and Hideki v2 share chain id 50383; the perps page never mentions `net_version`

Severity: major
Area: docs

## Steps to reproduce

1. Read the Network table on https://app.testnet.dreamdex.io/docs/developers/perps-testnet/README.md
2. On `https://api.hideki2.infra.testnet.somnia.network` call `eth_chainId` and `net_version`.
3. Read the comment on `hidekiTestnet` in `@somnia-chain/markets-sdk@0.32.1` (`dist/chains/definitions/hidekiTestnet.d.ts`) and the header of `dist/chains/bridge/registry.js`.
4. Add a wallet network using only chain id 50383 and an RPC that is still Hideki v1 (`api.hideki…`, not `api.hideki2…`). Compare `net_version` and block 1.

## Expected

The chain id on the perps page identifies the DreamDEX / Hideki deployment the contracts in that page belong to. A wallet, a bridge, or an explorer pointed at "chain 50383" is that deployment.

## Actual

Hideki was regenesis'd on 2026-09-17 ("hideki v2") **on the same chain id**. The SDK chain definition states:

- `eth_chainId` is `0xc4cf` (50383). `net_version` is not that number. v2 answers `50000259`. v1 answered `50000258`.
- A transaction signed for one genesis is valid on the other. The same address holds different contracts, because deployer nonces restarted. Tell the chains apart by height (or by block 1), not by chain id.
- v1's WebSocket (`api.hideki…/ws`, no `2`) already answers 502. The RPC in the perps table, `api.hideki2…`, is v2. The page never says there is another live chain with the same id.
- The bridge registry uses the same fact for Hyperlane: both lanes use domain 50383 and are separated only by network id. A validator signature for one is arithmetically valid metadata for the other. Hideki-side addresses were deliberately replayed, so an address matching a Hideki 1 record does not prove which lane you are on.

Measured on the documented v2 RPC, 2026-10-30:

| Call | Result |
| --- | --- |
| `eth_chainId` | `0xc4cf` (50383) |
| `net_version` | `50000259` |
| Block 1 hash | `0xa60bd432616fe5205e91031065ea1a2aa2ee9e42dcec3664d6cbe2e16a478f9c` |

That block-1 hash is not the retired v1 hash the SDK denylist rejects (`0x0ddf6446070d043158fd7aa80d3c835a9e446efdc05601f9ad67eebc9864a4ae` in `dist/client.js`). `hidekiTestnet.blockExplorers` is unset. The page's explorer cell is the bare string `explorer.testnet.somnia.network/tokyo` (no scheme). `https://explorer.testnet.somnia.network/tokyo` returned HTTP 200 on 2026-10-30; this note does not claim that site indexes v2.

`proof.ts` avoids the collision by importing `hidekiTestnet`, whose default HTTP and WebSocket URLs are the v2 endpoints. A builder who types chain id 50383 into a wallet from the docs table, and then picks an older public RPC, does not get that protection.

## Evidence

- Live RPC reads in the table above.
- `dist/chains/definitions/hidekiTestnet.d.ts`, the regenesis comment (network id, shared chain id, no `blockExplorers`).
- `dist/chains/bridge/registry.js`, the "two lanes" header (domain 50383 on both, network id 50000258 vs 50000259).
- `dist/client.js`, `RETIRED_GENESIS` for chain 50383.
- Perps Network table: https://app.testnet.dreamdex.io/docs/developers/perps-testnet/README.md

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- RPC: `https://api.hideki2.infra.testnet.somnia.network`
- Wallet: none

## Suggested fix

In the Network table, add `net_version` `50000259`, say Hideki v1 shares chain id 50383, and tell wallets to pin the `hideki2` RPC rather than the chain id alone. Put a full `https://` URL in the explorer cell, or drop it until `hidekiTestnet.blockExplorers` is set to a v2 explorer. The SDK already refuses the known v1 block-1 hash; the docs should say what that error looks like (`NotConfiguredError` naming Hideki v1) so it is not confused with note 007.
