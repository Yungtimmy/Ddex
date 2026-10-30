# `genesis check failed` is what the SDK reports when the block-1 read fails, not only when the genesis is wrong

Severity: normal
Area: SDK

## Steps to reproduce

1. In `@somnia-chain/markets-sdk@0.32.1`, read `makeGenesisCheck` in `dist/client.js`.
2. Construct `SomniaMarkets` with `chain: hidekiTestnet` and a WebSocket URL that does not complete. Two ways that match the perps page's pitfall: an HTTP-only proxy in front of `wss://api.hideki2.infra.testnet.somnia.network/ws`, or a `wsRpcUrl` that times out.
3. Call a chain read. `listPerpMarkets()` does not do this: it is an indexer GraphQL query (`dist/markets.js`, `PerpMarketsQuery`) and stays on HTTPS. `getPerpVoucherEligibility`, `getMaxPerpOrderSize`, and `placePerpOrder` do open the WebSocket. `proof.ts` hits those on the `--place` path.
4. Read the thrown error's message and `cause`.

## Expected

A transport failure names the failed URL and the RPC error (`SocketClosedError`, `TimeoutError`, HTTP 502). A retired Hideki v1 RPC names Hideki v1, which is what `RETIRED_GENESIS` is for (note 006).

## Actual

`makeGenesisCheck` reads block 1 once per chain id that has a retired genesis. Chain 50383 is on that list. The `getBlock({ blockNumber: 1n })` call sits in a catch:

- `BlockNotFoundError` is ignored (a node that no longer serves block 1 is treated as acceptable).
- Any other failure, including a failed WebSocket dial, is rethrown as `RpcError("getBlock", "genesis check failed", { cause })`.

The string a builder sees is `genesis check failed`. The perps page's pitfall uses that string for one case: an environment that only proxies HTTP. The same string is also a timeout, a 502, or a bad `wsRpcUrl`. The retired-genesis path is a different class (`NotConfiguredError` whose message asks for "an RPC on the current genesis" and names Hideki v1). Builders following the pitfall spend the debug cycle on genesis when the socket never opened.

`hidekiTestnet` already carries `rpcUrls.default.webSocket[0] = wss://api.hideki2.infra.testnet.somnia.network/ws`, and `createClient` uses that when `wsRpcUrl` is omitted (`dist/createClient.js`). The connect snippet on the perps page can omit `wsRpcUrl` and still be correct. The failure mode is a network path that cannot open that socket, reported under a genesis label.

The package README also says an indexer-only exchange never opens a WebSocket. That part is true for `listPerpMarkets`. It is not true for the next calls in the perps sample (`getPerpVoucherEligibility`, `getMaxPerpOrderSize`).

## Evidence

- `dist/client.js`, `makeGenesisCheck`, the `throw new RpcError("getBlock", "genesis check failed", { cause })` branch, and `RETIRED_GENESIS`.
- `dist/createClient.js`, `configuredWsUrl = config.wsRpcUrl ?? config.chain.rpcUrls.default.webSocket?.[0]`.
- `dist/markets.js`, `listPerpMarkets` → `IndexerRead.gqlRequest`.
- Perps pitfalls: https://app.testnet.dreamdex.io/docs/developers/perps-testnet/README.md
- No captured stack trace from a proxied run is included. The branch is in the published tarball; the repro is to point `wsRpcUrl` at a closed port and call `getPerpVoucherEligibility`.

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network: Hideki testnet, chain id 50383 (the chain id that enables the check)
- Wallet: a chain read such as `getPerpVoucherEligibility` needs an account address, not a signature

## Suggested fix

Rethrow the underlying `RpcError` / `TimeoutError` / `SocketClosedError` as the primary message, and reserve `genesis check failed` for a response that actually returned a denylisted block-1 hash. In the perps pitfall, say the check runs on the first chain read (not on `listPerpMarkets`) and that the `cause` is the transport error.
