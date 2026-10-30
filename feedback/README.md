# Feedback track

Notes for the [dreamDEX x Somnia Perps Builder Bounty](https://dorahacks.io/hackathon/dreamdex-perps-bounty/detail) Feedback track. One file per issue. dreamDEX accepts an item only when they can reproduce it. The first valid report of an issue is the one that counts.

This folder is the repo copy of those notes. It does not submit anything to DoraHacks. It does not claim a live perp fill. No private key is included.

Security vulnerabilities belong in a private mail to [security@dreamdex.io](mailto:security@dreamdex.io), not in this folder.

## How the track works

| | |
| --- | --- |
| Where the notes live | `feedback/NNN-short-title.md` |
| What counts | Bugs, API and SDK issues, documentation gaps, missing features on dreamDEX perps |
| Network | Hideki testnet, the chain the app calls the DreamDEX region (chain id `50383`) |
| Pay, if accepted | Critical or major: $40. Other accepted items: $15. Track budget $1,500. Duplicates are closed. |
| What judges weigh | Severity, clarity, reproducibility, and whether it helps the perps product or the developer experience |

The MVP track (a perps bot or app, with live orders and X posts) is separate. These notes stand on their own if that build is still in progress.

## Where the notes come from

Checked on **2026-10-30** against:

- `@somnia-chain/markets-sdk` **0.32.1**, the version this repo pins and the version the perps docs say the app runs
- This repo's 24 Oct 2026 scripts: `proof.ts` (read markets, claim paper USDso, place one order) and `bridge.ts` (Shannon STT to Hideki)
- Developer docs: https://app.testnet.dreamdex.io/docs/developers/perps-testnet/README.md
- Public reads only: Hideki HTTP RPC, the Hideki indexer, and `symbol()` / `getOrderBookParameters` view calls. No wallet, no signed transaction.

| Read | Result that day |
| --- | --- |
| `eth_chainId` on `https://api.hideki2.infra.testnet.somnia.network` | `0xc4cf` (50383) |
| `net_version` on the same RPC | `50000259` |
| `eth_gasPrice` / block `baseFeePerGas` | 6 gwei (`6000000000` wei), Hideki and Shannon |
| Indexer `https://hideki-dev.smk.somnia.host/v1/graphql` | 21 `PERP` rows, `chain_metadata.chain_id` 50383, `latest_processed_block` 37204166 |
| Block 1 hash on that RPC | `0xa60bd432616fe5205e91031065ea1a2aa2ee9e42dcec3664d6cbe2e16a478f9c` |

## Notes

| File | Severity | Area | Finding |
| --- | --- | --- | --- |
| [001](001-write-preflight-requires-0.6-stt.md) | major | docs | An SDK write is admitted only when the wallet holds the 0.6 STT fee envelope. The perps page quotes a 0.0003–0.003 STT cost. |
| [002](002-sdk-quickstart-targets-shannon-not-hideki.md) | major | docs | The package README and the hosted "get testnet funds" guide configure Shannon (50312), not Hideki perps. |
| [003](003-hideki-collateral-constant-is-tusdc.md) | major | SDK | `SOMNIA_HIDEKI_TESTNET_ADDRESSES.collateral` is 6-decimal tUSDC. Every live perp market quotes 18-decimal USDso. |
| [004](004-voucher-reverts-missing-from-error-table.md) | major | SDK | `ClaimantNotFlat` and `ClaimantIsMainFunded` are missing from the SDK error table, so a failed paper-USDso claim has no `errorName`. |
| [005](005-stt-bridge-receipt-is-not-hideki-credit.md) | major | docs | `sendBridgeStep` resolves on the Shannon receipt. Hideki STT arrives later, and the perps page never documents this path. |
| [006](006-hideki-v1-and-v2-share-chain-id.md) | major | docs | Hideki v1 and v2 both use chain id 50383. The perps page does not mention `net_version` 50000259, which is what separates them. |
| [007](007-genesis-check-failed-masks-transport-errors.md) | normal | SDK | A failed block-1 read is reported as `genesis check failed`, including ordinary RPC and WebSocket failures. |
| [008](008-getorderbookparameters-is-one-struct.md) | normal | docs | `getOrderBookParameters()` returns one named struct. The perps page describes three ordered return values. |

001 and 005 are both about getting gas onto Hideki. They fail in different places: 001 is the balance a write needs once you are on Hideki; 005 is the bridge call that reports success before that balance exists.

## Template

Copy this for a new note. Keep the headings. Judges match on them.

```markdown
# Short title

Severity: critical | major | normal
Area: API | SDK | docs | app | contracts

## Steps to reproduce
1.

## Expected

## Actual

## Evidence

## Environment
SDK version, network (Hideki / Somnia Tokyo testnet), wallet address if a transaction was sent.

## Suggested fix
```
