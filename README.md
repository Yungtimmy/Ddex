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
Gas: the SDK wants about 0.6 STT on hand per write (refunded unused).

## References
- dreamDEX perps for developers: https://app.dreamdex.io/docs/developers/perps-testnet/README.md
- Getting testnet funds: https://prd.smk.somnia.host/docs/typescript/how-to/get-testnet-funds
- Somnia network info: https://new.docs.somnia.network/network-info

## X posts
Build-in-public posts tagging [@DreamDEXSomnia](https://x.com/DreamDEXSomnia):
- _TBD: link to first post_
- _TBD_

## Feedback
See [`feedback/`](feedback/README.md).
