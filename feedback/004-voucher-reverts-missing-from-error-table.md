# Paper-USDso claim reverts `ClaimantNotFlat` and `ClaimantIsMainFunded` have no SDK error name

Severity: major
Area: SDK

## Steps to reproduce

1. Install `@somnia-chain/markets-sdk@0.32.1` and open `dist/contractErrorsAbi.js`.
2. Search for `ClaimantNotFlat` and `ClaimantIsMainFunded`.
3. Compare with `Trader.claimPerpVoucher` in `dist/trade.d.ts` and with `PerpVoucherIneligibleReason` in `dist/perp/voucher.d.ts`.
4. Live repro, with a Hideki key that holds the 0.6 STT envelope from note 001:
   1. `getPerpVoucherEligibility(marginBank, account)` on the BTC market's bank `0x478769E1177C0773c43A593DCCc4Ad15F15F1394`.
   2. If the reason is `notFlat`, leave the position or resting order in place and call `trader.claimPerpVoucher({ marginBank })`.
   3. If the account is flat and eligible, claim once, place the resting order from `proof.ts`, and call `claimPerpVoucher` again.
   4. Inspect `ContractRevertError`. For the two names below, `errorName` is empty and `data` starts with the selector.

## Expected

The developer page says any address can claim the 1,000 USDso credit once, as long as it holds no perp positions or orders. A claim that fails those rules reverts with an error the SDK decodes to a name, the way it decodes `AlreadyClaimed`, `BudgetExhausted`, and `CampaignInactive`.

## Actual

`getPerpVoucherEligibility` can return seven reasons: `dormant`, `notStarted`, `ended`, `notFlat`, `mainFunded`, `alreadyClaimed`, `budgetExhausted`. The dreamDEX sample only branches on `eligible` and never prints `reason`.

The SDK documents the matching reverts on `claim()`:

- `CampaignInactive`, `AlreadyClaimed`, `BudgetExhausted` are in `dist/contractErrorsAbi.js` (all zero-argument).
- `ClaimantNotFlat` and `ClaimantIsMainFunded` are not in that file. `dist/trade.d.ts` says so directly: "The SDK's bundled error table does not name the last two yet, so they arrive with raw `data` and no `errorName`." `getPerpVoucherEligibility` still reports them by name, which is why the docs tell you to read eligibility before sending. A claim that skips that read still mines (`trade.d.ts`: a failed claim still mines and costs gas).

Canonical selectors, `keccak256` of the zero-argument signatures, first 4 bytes. Sibling voucher errors in the table are zero-argument, and these two are written the same way in the SDK comments. If the on-chain error carries arguments, the selector will differ; the missing table rows will not.

| Error | Selector |
| --- | --- |
| `ClaimantNotFlat()` | `0x3f3d2141` |
| `ClaimantIsMainFunded()` | `0x1fac9b7d` |
| `AlreadyClaimed()` (present in the table) | `0x646cf558` |

`mainFunded` means the account carries principal from a linked main wallet (`ClaimantIsMainFunded`). The two funding programmes cannot share one balance. The perps page's claim snippet does not mention that reason. "Link a Bot" (an operator key) is a different feature; this note does not claim that linking a bot sets `mainFunded`.

## Evidence

- `node_modules/@somnia-chain/markets-sdk/dist/contractErrorsAbi.js` entries for `AlreadyClaimed`, `BudgetExhausted`, `CampaignInactive`. No `ClaimantNotFlat` or `ClaimantIsMainFunded` string in the package.
- `dist/trade.d.ts`, `claimPerpVoucher` throw list, the sentence quoted above.
- `dist/perp/voucher.d.ts`, `PerpVoucherIneligibleReason`.
- `dist/perp/voucher.js` returns `{ eligible: false, reason: "mainFunded" }` when the main-funded principal read is `> 0n`.
- Developer claim sample: https://app.testnet.dreamdex.io/docs/developers/perps-testnet/README.md
- No claim transaction is included. The table gap is visible from the published package; the broadcast is so a reviewer can attach a hash.

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network: Hideki testnet, chain id 50383
- MarginBank used by `proof.ts`: the BTC row's `marginBank`, `0x478769E1177C0773c43A593DCCc4Ad15F15F1394`
- Wallet: none for the static check

## Suggested fix

Add `ClaimantNotFlat` and `ClaimantIsMainFunded` to the bundled error ABI so `ContractRevertError.errorName` is set. On the perps page, branch on `eligibility.reason` the way `docs/PERPS.md` in the SDK already does, and list `mainFunded` next to "no positions or orders".
