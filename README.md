# Hideki perp chat

A Next.js chat agent for [dreamDEX perps](https://app.testnet.dreamdex.io/docs/developers/perps-testnet/README.md) on Somnia Hideki testnet (the DreamDEX region, chain `50383`). You say an order in plain language, confirm the card, and the app places a **real** perpetual through [`@somnia-chain/markets-sdk`](https://www.npmjs.com/package/@somnia-chain/markets-sdk) `~0.32.1`.

This is not a DEX screen. The book is the conversation.

Built for the [dreamDEX x Somnia Perps Builder Bounty](https://dorahacks.io/hackathon/dreamdex-perps-bounty/detail) MVP track. The Feedback track notes in [`feedback/`](feedback/README.md) are unchanged.

## What you confirm

Nothing is broadcast until you press **Confirm and place** or reply `confirm`.

1. The agent parses the sentence and shows the order (side, size, price, pool).
2. After that confirm, it calls `client.getMaxPerpOrderSize`.
3. `trader.placePerpOrder` runs only when that check says the size fits.

A failed size check, a stale mark, or a rejected wallet prompt does not send the order. The same gate is what `npm run place` calls. `--place` is the confirmation for the CLI.

The signer in the browser is the connected wallet. No private key is shipped, and the page never reads `PRIVATE_KEY`.

## Network

| | |
| --- | --- |
| Chain | Hideki testnet, `50383` (`0xc4cf`) |
| RPC | `https://api.hideki2.infra.testnet.somnia.network` |
| WebSocket | `wss://api.hideki2.infra.testnet.somnia.network/ws` |
| Indexer | `https://hideki-dev.smk.somnia.host/v1/graphql` |
| SDK chain | `hidekiTestnet` |
| Addresses | `SOMNIA_HIDEKI_TESTNET_ADDRESSES` |
| Gas | STT |
| Collateral | Paper USDso on the market's margin bank |

The SDK's first chain read uses the WebSocket. An HTTP-only proxy fails with `genesis check failed`.

## Runbook

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. **Connect wallet.** The button adds or switches to Hideki (`50383`) on an injected EIP-1193 wallet.
2. **STT for gas.** A write needs STT on Hideki. The SDK's fee envelope is about 0.6 STT on hand; unused gas is refunded. See [`feedback/001`](feedback/001-write-preflight-requires-0.6-stt.md). From a funded Shannon wallet:

   ```bash
   cp .env.example .env
   # put PRIVATE_KEY=0x... in .env, or set KEY_PATH
   npm run bridge
   ```

   The Shannon receipt is not Hideki credit yet. Wait for the STT to arrive. See [`feedback/005`](feedback/005-stt-bridge-receipt-is-not-hideki-credit.md). You can also use **Send it for gas** in the dreamDEX testnet app.
3. **Paper USDso.** In the chat: `claim paper USDso`, then confirm. One claim per address, and the account has to be flat.
4. **Place.** Example:

   ```text
   long 0.001 BTC at 50000
   ```

   Check the card. Confirm. Approve the wallet prompt. The reply includes the transaction hash.

Other phrases: `short 1 ETH market`, `bid minimum SOL at 150`, `post only long 0.01 ETH at 3000`, `markets`, `balance`, `help`, `cancel`.

### Production build

```bash
npm run build
npm start
```

No server secret is required. Vercel can build this as a normal Next.js App Router app. Chain calls happen in the browser.

### CLI (same SDK path)

```bash
npm run read     # wallet, STT, perp markets
npm run place    # claim paper USDso if eligible, then one resting BTC bid
PRICE=50000 npm run place
AMOUNT=2 npm run bridge
```

The key is `PRIVATE_KEY` or `KEY_PATH` (default `/workspace/.secrets/dreamdex_testnet_key`). `.env` is loaded for these scripts and is gitignored. `.env.example` lists the names only.

## Live proof

Fill this in after a confirmed order lands. Do not invent a hash.

| | |
| --- | --- |
| Wallet | `0x…` |
| Market | |
| Side / size / price | |
| placePerpOrder tx | `0x…` |
| Order id | |
| Explorer | https://explorer.testnet.somnia.network/tokyo/tx/0x… |
| When | YYYY-MM-DD |

Screenshot: the confirm card and the transaction hash in the chat.

## X posts

Drafts for [@DreamDEXSomnia](https://x.com/DreamDEXSomnia). Post them, then replace each link.

1. Shipping a chat on Hideki testnet: you say the perp in plain language, confirm the card, and it places a real order through @somnia-chain/markets-sdk. getMaxPerpOrderSize, then placePerpOrder. Paper USDso, chain 50383. @DreamDEXSomnia

   Posted: _TBD: https://x.com/…_

2. The confirm step is the whole product. Nothing hits the book until you accept the card. The agent then sizes against the live max and sends placePerpOrder from the connected wallet. @DreamDEXSomnia

   Posted: _TBD: https://x.com/…_

3. Hideki (Somnia Tokyo, 50383) plus dreamDEX perps. Not a DEX screen. A chat that only trades after you confirm. @DreamDEXSomnia

   Posted: _TBD: https://x.com/…_

## Layout

| Path | Role |
| --- | --- |
| `app/` | Next.js App Router page |
| `components/chat-app.tsx` | Chat, wallet, confirm card |
| `lib/intent.ts` | Plain-language parser, no API key |
| `lib/place.ts` | The only `getMaxPerpOrderSize` → `placePerpOrder` path |
| `proof.ts` | CLI read / place |
| `bridge.ts` | Shannon STT → Hideki |
| `feedback/` | Feedback-track notes, unchanged |

## References

- Perps on testnet: https://app.testnet.dreamdex.io/docs/developers/perps-testnet/README.md
- Somnia network info: https://new.docs.somnia.network/network-info
