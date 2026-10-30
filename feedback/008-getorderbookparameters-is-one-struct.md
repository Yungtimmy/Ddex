# `getOrderBookParameters()` returns one named struct, not three ordered values

Severity: normal
Area: docs

## Steps to reproduce

1. On the perps developer page, section "Scale quantity by the base asset's decimals", read the sentence about `getOrderBookParameters()`.
2. Against the live BTC perp pool, call that view with the ABI the SDK ships.

Pool and ABI used on 2026-10-30:

- Pool: `0x4181dd08e73bbcdd1ba3e615a18f6abd941b94c0` (indexer row `baseSymbol: BTC`)
- RPC: `https://api.hideki2.infra.testnet.somnia.network`
- ABI line from `@somnia-chain/markets-sdk@0.32.1` `dist/readsAbi.js`:

```solidity
function getOrderBookParameters() view returns ((uint256 tickSize, uint256 minQuantity, uint256 lotSize))
```

That is a single tuple return, not three ABI outputs.

3. Decode with viem `readContract`. Then try to unpack it as a three-element array, which is what "in that order" leads a raw caller to write.

## Expected

The page is in the raw-calls section, so a positional unpack matches the chain:

```ts
const [tickSize, minQuantity, lotSize] = await client.readContract({
  address: pool,
  abi,
  functionName: "getOrderBookParameters",
})
```

## Actual

viem returns one object. The BTC pool returned:

```ts
{
  tickSize: 100000000000000000n, // 0.1 USDso at 18 quote decimals
  minQuantity: 13000n,           // 0.00013 BTC at 8 base decimals
  lotSize: 1000n                 // 0.00001 BTC
}
```

Those figures match the trader market table (BTC-PERP price tick 0.1, min size 0.00013 BTC) and the indexer row (`tickSize` `100000000000000000`, `minQuantity` `13000`, `lotSize` `1000`). The field order inside the struct is tick, min quantity, lot, which is what the page says. The return count is one value. Array-destructuring the object throws because it is not iterable. A caller who then builds `price` and `quantity` from `undefined` does not get an error that says the grid read was unpacked wrong. They get the scale failures the same section already describes (`InsufficientCollateral()`, or `ERC20: transfer amount exceeds balance` on the owner's own `placeOrder`).

The SDK already wraps this. `PerpMarket.tickSize`, `lotSize`, and `minQuantity` are decimal strings in raw units, and `roundPriceToTick` snaps a raw price onto the grid. The raw-calls section does not point at either.

The sample order higher on the page (`parseUnits("100000", btc.quoteDecimals)` and `parseUnits("0.001", btc.baseDecimals)`) does land on this BTC grid: 100000 USDso divides by the 0.1 tick, and 0.001 BTC divides by the 0.00001 lot and is above the 0.00013 minimum. The sample is fine for those literals. It does not snap, so any other price string is unprotected. `proof.ts` snaps with `price -= price % tick` for that reason.

## Evidence

- View call described above, 2026-10-30, no wallet.
- Indexer BTC row from `https://hideki-dev.smk.somnia.host/v1/graphql` (`latest_processed_block` 37204166).
- `dist/readsAbi.js` signature quoted above. There is a second copy of the same function in that file (spot and perp).
- Trader table: https://app.testnet.dreamdex.io/docs/trading/perps-testnet/README.md (BTC-PERP tick 0.1, min size 0.00013 BTC).
- Developer raw-calls section: https://app.testnet.dreamdex.io/docs/developers/perps-testnet/README.md

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1 and viem 2.x (`readContract` object decoding)
- Network: Hideki testnet, chain id 50383
- Pool: BTC perp `0x4181dd08e73bbcdd1ba3e615a18f6abd941b94c0`
- Wallet: none

## Suggested fix

Show the viem result as `{ tickSize, minQuantity, lotSize }`, and note that the Solidity return is one struct in the order tick, minimum, lot. Point raw callers at `roundPriceToTick` / the market row's decimal strings so a price that misses the tick fails in the client instead of as `InsufficientCollateral()`.
