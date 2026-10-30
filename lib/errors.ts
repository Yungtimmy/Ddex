import { ContractRevertError, SomniaMarketsError } from "@somnia-chain/markets-sdk"
import { HIDEKI } from "./hideki"

const LIMITS: Record<string, string> = {
  collateral: "unlocked margin (collateral)",
  initialMargin: "initial margin",
  maxPositionSize: "the market's position cap",
  voucherBlocked: "paper USDso, which blocks this market",
  walletBalance: "the wallet's collateral balance",
  walletAllowance: "the wallet's allowance to the margin bank",
  mainWallet: "the linked main wallet",
  mainFundingBlocked: "an unpaid main-funding claim",
  restricted: "a close-only market",
  isolated: "isolated margin on another market",
}

const REVERTS: Record<string, string> = {
  InsufficientCollateral: "The margin bank does not have enough collateral for this order. Claim paper USDso or deposit margin, then try a smaller size.",
  ImmediateOrCancelNoFill: "The market order found nothing to fill and was cancelled. Widen the bound or use a limit.",
  MaxPositionSizeExceeded: "This order would pass the market's per-account position cap.",
  IsolatedMarketBlocked: "This account is isolated to another market, so this order cannot be placed.",
  ClaimantNotFlat: "The voucher claim needs a flat account: no open position and no resting order.",
  ClaimantIsMainFunded: "This wallet is funded by a linked main account, so it cannot claim paper USDso.",
  AlreadyClaimed: "This wallet has already claimed paper USDso.",
  BudgetExhausted: "The paper USDso budget is empty.",
  CampaignInactive: "The paper USDso claim window is not open.",
}

const VOUCHER: Record<string, string> = {
  dormant: "The paper USDso programme is off on this margin bank.",
  notStarted: "Paper USDso claims are not open yet.",
  ended: "The paper USDso claim window has closed.",
  notFlat: "This wallet already has a position or a resting order, so the voucher will not claim.",
  mainFunded: "This wallet is funded by a linked main account, so it cannot claim paper USDso.",
  alreadyClaimed: "This wallet has already claimed the paper USDso credit.",
  budgetExhausted: "The voucher budget is empty.",
}

export function explainLimit(limitedBy: string): string {
  return LIMITS[limitedBy] ?? limitedBy
}

export function explainVoucherReason(reason: string): string {
  return VOUCHER[reason] ?? `The voucher claim is not available (${reason}).`
}

export function explainError(error: unknown): string {
  if (isNamed(error, "OrderNotSent") || isNamed(error, "WalletError")) {
    return error.message
  }
  if (isUserRejected(error)) {
    return "The wallet declined the signature. Nothing was sent."
  }
  if (error instanceof ContractRevertError) {
    const known = error.errorName ? REVERTS[error.errorName] : undefined
    if (known) return known
    if (error.reason) return `The chain rejected the transaction: ${error.reason}`
    if (error.errorName) return `The chain rejected the transaction (${error.errorName}). Nothing was filled.`
    return "The chain rejected the transaction. Nothing was filled."
  }
  if (isNamed(error, "TransactionOutcomeUnknownError")) {
    return "The node did not say whether the transaction landed. Check the wallet before confirming again, or a second order may be sent."
  }

  const message = textOf(error)
  if (/genesis check failed/i.test(message)) {
    return `${message} The SDK's first chain read uses the Hideki WebSocket (${HIDEKI.rpcWs}). An HTTP-only proxy fails this way.`
  }
  if (/insufficient funds|exceeds the balance|fee envelope/i.test(message)) {
    return `${message} Hideki gas is STT. A write needs STT on hand (the SDK fee envelope is about 0.6 STT; unused gas is refunded). Bridge with npm run bridge, or top up from the dreamDEX app.`
  }
  if (error instanceof SomniaMarketsError || error instanceof Error) return message
  return "Something went wrong before the order was sent."
}

function isNamed(error: unknown, name: string): error is Error {
  return error instanceof Error && error.name === name
}

function isUserRejected(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const value = error as { name?: string; code?: number; shortMessage?: string; message?: string }
  if (value.name === "UserRejectedRequestError" || value.code === 4001) return true
  const text = `${value.shortMessage ?? ""} ${value.message ?? ""}`.toLowerCase()
  return text.includes("user rejected") || text.includes("user denied") || text.includes("rejected the request")
}

function textOf(error: unknown): string {
  if (error instanceof Error) {
    const short = (error as { shortMessage?: string }).shortMessage
    return short || error.message || "Unknown error."
  }
  return "Unknown error."
}
