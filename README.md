# dreamdex-proof

Minimal proof that we build on dreamDEX via the official Somnia Markets SDK
([`@somnia-chain/markets-sdk`](https://www.npmjs.com/package/@somnia-chain/markets-sdk) v0.32.1, the version the dreamDEX app runs).
Built for the [dreamDEX x Somnia Perps Builder Bounty](https://dorahacks.io/hackathon/dreamdex-perps-bounty/detail).

## What it does
`proof.ts` is a one-shot script (no server):
1. Connects to Hideki / Somnia Tokyo testnet (chain `50383`) with `SomniaMarkets`.
2. Lists every perp market via `client.listPerpMarkets()`.
3. With `--place`: claims the one-time 1,000 paper USDso perps credit (`trader.claimPerpVoucher`),
   sizes against `getMaxPerpOrderSize`, and places ONE small resting BTC bid with `trader.placePerpOrder`.

Testnet only. Paper USDso only. No real funds.

## Run
```bash
npm install
npm run read     # read-only: wallet, STT balance, perp markets
npm run place    # claim paper USDso + place one order (needs STT for gas)
```
The key is read from `/workspace/.secrets/dreamdex_testnet_key` (override with `KEY_PATH`). Never commit it.
Gas: the SDK wants about 0.6 STT on hand per write (refunded unused). See [`feedback/001`](feedback/001-write-preflight-requires-0.6-stt.md).

## References
- dreamDEX perps for developers (Hideki): https://app.testnet.dreamdex.io/docs/developers/perps-testnet/README.md
- Somnia network info: https://new.docs.somnia.network/network-info

The SDK's Shannon funding guide (https://prd.smk.somnia.host/docs/typescript/how-to/get-testnet-funds) mints Shannon USDso on chain 50312. Hideki perps do not use that token. See [`feedback/002`](feedback/002-sdk-quickstart-targets-shannon-not-hideki.md).

## X posts
Build-in-public posts tagging [@DreamDEXSomnia](https://x.com/DreamDEXSomnia):
- _TBD: link to first post_
- _TBD_

## Feedback track

Judges for the DoraHacks Feedback track: start at [`feedback/README.md`](feedback/README.md).

That folder is one Markdown file per issue (bug, SDK or API problem, docs gap, missing feature) against dreamDEX perps on Hideki testnet. dreamDEX pays an accepted item only when they can reproduce it. Critical or major items and other items are scored separately; duplicates are closed. The notes here were checked on 30 Oct 2026 from `proof.ts`, `bridge.ts`, `@somnia-chain/markets-sdk` 0.32.1, and the Hideki developer docs. They are public reads and source findings. This repo does not claim a live fill, and opening this PR does not submit the bounty.

Send security vulnerabilities to security@dreamdex.io, not into `feedback/`. The MVP track (a perps app, live orders, X posts) is separate and can land later.
