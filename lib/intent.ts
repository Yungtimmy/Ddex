import { parseHumanNumber, stripGrouping } from "./numbers"
import type { OrderStyle } from "./order-type"

export type OrderDraft = {
  kind: "order"
  symbol?: string
  isBid?: boolean
  quantity?: string
  useMin?: boolean
  price?: string
  orderType: OrderStyle
  slippageBps: number
}

export type Draft = OrderDraft | { kind: "claim" }

export type AgentReply =
  | { effect: "ready_order"; text: string; draft: OrderDraft }
  | { effect: "ready_claim"; text: string; draft: { kind: "claim" } }
  | { effect: "confirm"; text: string; draft: Draft }
  | { effect: "discard"; text: string; draft: null }
  | { effect: "markets" | "balance" | "none"; text: string; draft: Draft | null }

const CONFIRM = new Set([
  "yes",
  "y",
  "confirm",
  "confirmed",
  "place it",
  "send it",
  "do it",
  "go",
  "go ahead",
  "ship it",
  "ok",
  "okay",
  "yep",
  "yeah",
  "confirm and place",
])

const DISCARD = new Set([
  "no",
  "nope",
  "cancel",
  "discard",
  "stop",
  "never mind",
  "nevermind",
  "abort",
  "don't",
  "dont",
])

const SIDES: Record<string, boolean> = {
  long: true,
  buy: true,
  bid: true,
  short: false,
  sell: false,
  ask: false,
}

const STOP = new Set([
  "a",
  "an",
  "the",
  "on",
  "of",
  "for",
  "perp",
  "perps",
  "order",
  "orders",
  "please",
  "me",
  "to",
  "with",
  "and",
  "paper",
  "usdso",
  "usdc",
  "usdt",
  "credit",
  "hideki",
  "dreamdex",
  "tokyo",
  "somnia",
  "want",
  "i",
  "id",
  "like",
  "would",
  "can",
  "you",
  "your",
  "our",
  "place",
  "put",
  "set",
  "make",
  "open",
  "gtc",
  "my",
  "it",
  "its",
  "actually",
  "just",
  "some",
  "small",
  "resting",
  "stt",
  "gas",
  "wallet",
  "balance",
  "from",
  "into",
  "in",
  "is",
  "this",
  "that",
  "what",
  "which",
  "show",
  "read",
  "how",
  "where",
  "when",
  "why",
  "who",
  "does",
  "do",
  "did",
  "check",
  "tell",
  "give",
  "get",
  "markets",
  "list",
  "available",
  "live",
  "there",
  "are",
  "about",
  "claim",
  "voucher",
  "only",
  "now",
  "thanks",
  "thank",
])

const FILLER = new Set(["please", "now", "thanks", "thank", "you", "the", "order", "it", "this"])

export const HELP = [
  "Say the order in plain language. I show a card and wait.",
  "getMaxPerpOrderSize and placePerpOrder run only after you confirm.",
  "",
  "long 0.001 BTC at 50000",
  "short 1 ETH market",
  "bid minimum SOL at 150",
  "post only long 0.01 ETH at 3000",
  "market buy 0.001 BTC bound 100000",
  "",
  "Also: markets, balance, claim paper USDso.",
  "Confirm with the button or by saying confirm. Say cancel to drop the card.",
].join("\n")

type Patch = {
  symbol?: string
  isBid?: boolean
  useMin?: boolean
  orderType?: OrderStyle
  price?: string
  quantity?: string
  slippageBps?: number
  numbers: string[]
}

export function interpret(raw: string, pending: Draft | null): AgentReply {
  const text = normalize(raw)
  if (!text) return { effect: "none", text: "Type an order, or say help.", draft: pending }

  if (DISCARD.has(corePhrase(text))) {
    if (!pending) {
      return {
        effect: "none",
        text: "There is no pending order. This chat does not cancel an order already on the book.",
        draft: null,
      }
    }
    return { effect: "discard", text: "Discarded. Nothing was sent.", draft: null }
  }

  if (CONFIRM.has(corePhrase(text))) {
    if (!pending) return { effect: "none", text: "There is nothing to confirm.", draft: null }
    if (pending.kind === "claim") {
      return { effect: "confirm", text: "Confirming the paper USDso claim.", draft: pending }
    }
    const miss = missing(pending)
    if (miss) return { effect: "none", text: `${summarize(pending)} ${miss}`, draft: pending }
    return { effect: "confirm", text: "Confirming the order.", draft: pending }
  }

  if (isHelp(text)) return { effect: "none", text: HELP, draft: pending }

  const patch = parsePatch(text)
  if (patch && hasSignal(patch)) {
    const merged = applyNumbers(merge(pending, patch), patch.numbers)
    const miss = missing(merged)
    if (miss) return { effect: "none", text: `${summarize(merged)} ${miss}`, draft: merged }
    return { effect: "ready_order", text: `${summarize(merged)} Confirm to place it.`, draft: merged }
  }

  if (isClaim(text)) {
    return {
      effect: "ready_claim",
      text: "Checking whether this wallet can claim paper USDso.",
      draft: { kind: "claim" },
    }
  }
  if (isMarkets(text)) {
    return { effect: "markets", text: "Reading perp markets from the Hideki indexer.", draft: pending }
  }
  if (isBalance(text)) {
    return { effect: "balance", text: "Reading the wallet.", draft: pending }
  }

  return {
    effect: "none",
    text: "I didn't catch an order. Say help for examples.",
    draft: pending,
  }
}

export function summarize(draft: OrderDraft): string {
  const side = draft.isBid === undefined ? "Side not set" : draft.isBid ? "Long" : "Short"
  const symbol = draft.symbol ? draft.symbol.toUpperCase() : "no market"
  const size = draft.useMin ? "minimum size" : draft.quantity ? `size ${draft.quantity}` : "no size"
  let price: string
  if (draft.orderType === "market") {
    price = draft.price ? `market, bound ${draft.price}` : `market (${draft.slippageBps / 100}% from the mark)`
  } else if (draft.orderType === "postOnly") {
    price = draft.price ? `post-only ${draft.price}` : "post-only, no price"
  } else {
    price = draft.price ? `limit ${draft.price}` : "no price"
  }
  return `${side} ${symbol}, ${size}, ${price}.`
}

function missing(draft: OrderDraft): string | null {
  const need: string[] = []
  if (!draft.symbol) need.push("a market (BTC, ETH, SOL, …)")
  if (draft.isBid === undefined) need.push("a side (long or short)")
  if (!draft.useMin && !draft.quantity) need.push("a size, or say minimum")
  if (draft.orderType !== "market" && !draft.price) need.push("a limit price (`at 50000`), or say market")
  if (need.length === 0) return null
  return `Still need ${need.join(", ")}.`
}

function merge(pending: Draft | null, patch: Patch): OrderDraft {
  const base: OrderDraft =
    pending?.kind === "order" ? pending : { kind: "order", orderType: "limit", slippageBps: 100 }
  const next: OrderDraft = {
    ...base,
    kind: "order",
    orderType: patch.orderType ?? base.orderType,
    slippageBps: patch.slippageBps ?? base.slippageBps,
  }
  if (patch.symbol) next.symbol = patch.symbol
  if (patch.isBid !== undefined) next.isBid = patch.isBid
  if (patch.useMin) {
    next.useMin = true
    next.quantity = undefined
  }
  if (patch.quantity) {
    next.quantity = patch.quantity
    next.useMin = false
  }
  if (patch.price) next.price = patch.price
  if (patch.orderType === "market" && patch.price === undefined && patch.numbers.length === 0) {
    next.price = undefined
  }
  return next
}

function applyNumbers(draft: OrderDraft, numbers: string[]): OrderDraft {
  const next = { ...draft }
  const rest = [...numbers]
  if (!next.useMin && !next.quantity && rest.length) next.quantity = rest.shift()
  if (!next.price && rest.length) next.price = rest.shift()
  if (rest.length && !next.useMin) next.quantity = rest.shift()
  return next
}

function hasSignal(patch: Patch): boolean {
  return Boolean(
    patch.symbol ||
      patch.isBid !== undefined ||
      patch.useMin ||
      patch.orderType ||
      patch.price ||
      patch.quantity ||
      patch.slippageBps !== undefined ||
      patch.numbers.length,
  )
}

function parsePatch(raw: string): Patch | null {
  let text = raw
  const patch: Patch = { numbers: [] }
  const slip = text.match(/(\d+(?:\.\d+)?)\s*(%|percent|bps)(?=$|\s)/)
  if (slip) {
    const amount = Number(slip[1])
    if (Number.isFinite(amount) && amount > 0) {
      const bps = slip[2] === "bps" ? Math.round(amount) : Math.round(amount * 100)
      patch.slippageBps = Math.min(5_000, Math.max(1, bps))
    }
    text = text.replace(slip[0], " ")
  }

  const tokens = text.split(" ").filter(Boolean)
  let mode: "any" | "price" | "size" = "any"
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].replace(/-perp$/, "")
    if (token === "at" || token === "@" || token === "price" || token === "bound") {
      mode = "price"
      continue
    }
    if (token === "size" || token === "qty" || token === "quantity") {
      mode = "size"
      continue
    }
    if (token === "min" || token === "minimum") {
      patch.useMin = true
      mode = "any"
      continue
    }
    if (token === "market" || token === "ioc") {
      patch.orderType = "market"
      continue
    }
    if (token === "limit") {
      patch.orderType = "limit"
      continue
    }
    if ((token === "post" && tokens[i + 1] === "only") || token === "postonly" || token === "post-only") {
      patch.orderType = "postOnly"
      if (token === "post") i += 1
      continue
    }
    if (token in SIDES && patch.isBid === undefined) {
      patch.isBid = SIDES[token]
      continue
    }
    if (isNumberToken(token)) {
      const parsed = parseHumanNumber(token)
      if (!parsed) continue
      if (mode === "price") patch.price = parsed
      else if (mode === "size") patch.quantity = parsed
      else patch.numbers.push(parsed)
      mode = "any"
      continue
    }
    if (token === "%" || STOP.has(token)) continue
    if (/^(?:\d+[a-z]|[a-z])[a-z0-9]{0,14}$/.test(token) && !patch.symbol) {
      patch.symbol = token
    }
  }
  return patch
}

function isNumberToken(token: string): boolean {
  return /^\d+(?:\.\d+)?k?$/.test(token)
}

function corePhrase(text: string): string {
  return text
    .split(" ")
    .filter((token) => !FILLER.has(token))
    .join(" ")
}

function normalize(raw: string): string {
  return stripGrouping(raw)
    .trim()
    .toLowerCase()
    .replace(/\$/g, "")
    .replace(/@/g, " @ ")
    .replace(/\//g, " ")
    .replace(/%/g, " % ")
    .replace(/[?!,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isHelp(text: string): boolean {
  return text === "help" || text === "?" || text === "what can you do" || text === "what can i say"
}

function isClaim(text: string): boolean {
  return /\b(claim|voucher)\b/.test(text) || /paper (usdso|credit)/.test(text)
}

function isMarkets(text: string): boolean {
  return text === "list" || /\bmarkets?\b/.test(text)
}

function isBalance(text: string): boolean {
  return text === "gas" || text === "wallet" || /\b(balance|stt)\b/.test(text)
}
