"use client"

import { useEffect, useRef, useState } from "react"
import type { PerpMarket, SomniaMarkets } from "@somnia-chain/markets-sdk"
import type { Address, WalletClient } from "viem"
import { createPublicClient, http } from "viem"
import { explainError, explainVoucherReason } from "@/lib/errors"
import { HIDEKI } from "@/lib/hideki"
import { interpret, type OrderDraft } from "@/lib/intent"
import { claimPaperUsdso, sizeAndPlacePerpOrder } from "@/lib/place"
import { prepareOrder } from "@/lib/prepare"
import { createHidekiMarkets, hidekiTestnet } from "@/lib/session"
import { matchMarket } from "@/lib/symbols"
import { formatRaw, formatStt, shortAddress } from "@/lib/units"
import { connectHideki, ensureHideki, injectedProvider, readChainId, WalletError } from "@/lib/wallet"

type CardStatus = "open" | "working" | "done" | "closed" | "failed"

type Card = {
  id: string
  kind: "order" | "claim"
  status: CardStatus
  lines: { label: string; value: string }[]
  note: string | null
}

type ChatMessage = {
  id: string
  role: "user" | "agent"
  text: string
  href?: string
  card?: Card
}

type Pending =
  | {
      kind: "order"
      market: PerpMarket
      isBid: boolean
      price: bigint
      quantity: bigint
      orderType: number
      symbol: string
      baseDecimals: number
    }
  | { kind: "claim"; marginBank: Address; symbol: string }

type Book = {
  status: "loading" | "ready" | "error"
  markets: PerpMarket[]
  error: string | null
}

const INTRO = [
  "Say a perp in plain language. I show the order and wait.",
  "getMaxPerpOrderSize and placePerpOrder run only after you confirm.",
  "",
  "Example: long 0.001 BTC at 50000",
  "Say help for the rest.",
].join("\n")

const CHIPS = ["long 0.001 BTC at 50000", "markets", "claim paper USDso"]

function nid(): string {
  return crypto.randomUUID()
}

export function ChatApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "intro", role: "agent", text: INTRO }])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [address, setAddress] = useState<Address | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [stt, setStt] = useState<string | null>(null)
  const [marketLabel, setMarketLabel] = useState("loading perps…")
  const [marketError, setMarketError] = useState<string | null>(null)

  const draftRef = useRef<OrderDraft | { kind: "claim" } | null>(null)
  const busyRef = useRef(false)
  const addressRef = useRef<Address | null>(null)
  const walletRef = useRef<WalletClient | null>(null)
  const marketsClient = useRef<SomniaMarkets | null>(null)
  const book = useRef<Book>({ status: "loading", markets: [], error: null })
  const pending = useRef(new Map<string, Pending>())
  const openCardId = useRef<string | null>(null)
  const prepareGate = useRef<Promise<void> | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const publicClient = useRef(
    createPublicClient({ chain: hidekiTestnet, transport: http(HIDEKI.rpcHttp) }),
  )

  addressRef.current = address

  function pushMessage(message: ChatMessage) {
    setMessages((prev) => [...prev, message])
  }

  function pushAgent(text: string, extra?: Partial<ChatMessage>) {
    pushMessage({ id: nid(), role: "agent", text, ...extra })
  }

  function patchMessage(id: string, patch: Partial<ChatMessage> & { card?: Card }) {
    setMessages((prev) => prev.map((message) => (message.id === id ? { ...message, ...patch } : message)))
  }

  function applyBook(list: PerpMarket[]) {
    const markets = [...list].sort((a, b) => (a.baseSymbol ?? "").localeCompare(b.baseSymbol ?? ""))
    book.current = { status: "ready", markets, error: null }
    setMarketLabel(`${markets.length} perps`)
    setMarketError(null)
  }

  function applyBookError(error: unknown) {
    const text = explainError(error)
    book.current = { status: "error", markets: [], error: text }
    setMarketLabel("markets unavailable")
    setMarketError(text)
    return text
  }

  useEffect(() => {
    const markets = createHidekiMarkets()
    let active = true
    marketsClient.current = markets
    if (walletRef.current) markets.setSigner({ walletClient: walletRef.current })
    markets.client.listPerpMarkets().then(
      (list) => {
        if (!active) return
        applyBook(list)
      },
      (error: unknown) => {
        if (!active) return
        pushAgent(applyBookError(error))
      },
    )
    return () => {
      active = false
      if (marketsClient.current === markets) marketsClient.current = null
      void markets.close()
    }
    // The loader is mount-only. Retry uses retryMarkets().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!address) return
    let active = true
    publicClient.current.getBalance({ address }).then(
      (balance) => {
        if (active) setStt(formatStt(balance))
      },
      () => {
        if (active) setStt(null)
      },
    )
    return () => {
      active = false
    }
  }, [address])

  useEffect(() => {
    const provider = injectedProvider()
    if (!provider?.on) return
    const onAccounts = (accounts: unknown) => {
      const next = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : ""
      if (!next) {
        disconnect()
        return
      }
      if (addressRef.current && addressRef.current.toLowerCase() === next.toLowerCase()) return
      void connect()
    }
    const onChain = (hex: unknown) => {
      if (typeof hex === "string") setChainId(Number(hex))
    }
    provider.on("accountsChanged", onAccounts)
    provider.on("chainChanged", onChain)
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts)
      provider.removeListener?.("chainChanged", onChain)
    }
    // Listeners bind once. connect/disconnect read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages, busy])

  async function retryMarkets() {
    const stale = marketsClient.current
    const markets = createHidekiMarkets()
    marketsClient.current = markets
    if (walletRef.current) markets.setSigner({ walletClient: walletRef.current })
    if (stale && stale !== markets) void stale.close()
    book.current = { status: "loading", markets: [], error: null }
    setMarketLabel("loading perps…")
    setMarketError(null)
    try {
      applyBook(await markets.client.listPerpMarkets())
      pushAgent(`Loaded ${book.current.markets.length} perp markets.`)
    } catch (error) {
      pushAgent(applyBookError(error))
    }
  }

  async function connect() {
    const provider = injectedProvider()
    if (!provider) {
      pushAgent("No injected wallet. Install a browser wallet that speaks EIP-1193, then connect again.")
      return
    }
    try {
      const session = await connectHideki(provider)
      walletRef.current = session.walletClient
      addressRef.current = session.address
      setAddress(session.address)
      setChainId(session.chainId)
      marketsClient.current?.setSigner({ walletClient: session.walletClient })
    } catch (error) {
      pushAgent(explainError(error))
    }
  }

  function disconnect() {
    walletRef.current = null
    addressRef.current = null
    setAddress(null)
    setChainId(null)
    setStt(null)
    marketsClient.current?.setSigner({})
  }

  function closeOpen(text: string) {
    const id = openCardId.current
    if (!id) return
    pending.current.delete(id)
    openCardId.current = null
    setMessages((prev) =>
      prev.map((message) =>
        message.card?.id === id
          ? { ...message, text, card: { ...message.card, status: "closed" } }
          : message,
      ),
    )
  }

  function discardCard(id: string) {
    if (!pending.current.has(id) || openCardId.current !== id) return
    pending.current.delete(id)
    openCardId.current = null
    draftRef.current = null
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id && message.card
          ? { ...message, text: "Discarded. Nothing was sent.", card: { ...message.card, status: "closed" } }
          : message,
      ),
    )
  }

  async function presentOrder(draft: OrderDraft) {
    if (book.current.status !== "ready") {
      pushAgent(book.current.error ?? "Perp markets are still loading. Send the order again in a moment. Nothing was sent.")
      return
    }
    const market = matchMarket(draft.symbol ?? "", book.current.markets)
    if (!market) {
      const names = book.current.markets.map((item) => item.baseSymbol).filter(Boolean).join(", ")
      pushAgent(`No ${draft.symbol ?? "that"} perp on Hideki. Live markets: ${names || "none loaded"}.`)
      return
    }
    const prepared = prepareOrder(draft, market)
    if (!prepared.ok) {
      pushAgent(prepared.error)
      return
    }
    const order = prepared.order
    const id = nid()
    closeOpen("Replaced by a new order. Nothing was sent.")
    pending.current.set(id, {
      kind: "order",
      market,
      isBid: order.isBid,
      price: order.price,
      quantity: order.quantity,
      orderType: order.orderType,
      symbol: order.symbol,
      baseDecimals: order.baseDecimals,
    })
    openCardId.current = id
    const lines = [
      { label: "Side", value: order.isBid ? "Long" : "Short" },
      { label: "Size", value: order.quantityLabel },
      { label: "Price", value: order.priceLabel },
      { label: "Type", value: order.orderTypeLabel },
      { label: "Pool", value: shortAddress(order.pool) },
      { label: "Margin bank", value: shortAddress(order.marginBank) },
    ]
    if (order.markLabel) lines.push({ label: "Indexed mark", value: order.markLabel })
    pushMessage({
      id,
      role: "agent",
      text: "Confirm to place this order. Nothing is sent until you do.",
      card: {
        id,
        kind: "order",
        status: "open",
        lines,
        note: [
          order.alignment,
          "Confirm calls getMaxPerpOrderSize, then placePerpOrder only if this size fits.",
        ]
          .filter(Boolean)
          .join(" "),
      },
    })
  }

  async function presentClaim() {
    if (!addressRef.current) {
      pushAgent("Connect a wallet on Hideki first. Say claim again after that. Nothing was sent.")
      return
    }
    if (book.current.status !== "ready" || book.current.markets.length === 0) {
      pushAgent(book.current.error ?? "Perp markets are not loaded, so there is no margin bank to claim against.")
      return
    }
    const market = book.current.markets.find((item) => item.baseSymbol === "BTC") ?? book.current.markets[0]
    const markets = marketsClient.current
    if (!markets) {
      pushAgent("The Hideki client is not open. Retry markets, then say claim again.")
      return
    }
    try {
      const eligibility = await markets.client.getPerpVoucherEligibility(market.marginBank, addressRef.current)
      if (!eligibility.eligible) {
        draftRef.current = null
        pushAgent(explainVoucherReason(eligibility.reason))
        return
      }
      const id = nid()
      closeOpen("Replaced by the claim card. Nothing was sent.")
      pending.current.set(id, { kind: "claim", marginBank: market.marginBank, symbol: market.baseSymbol ?? "perp" })
      openCardId.current = id
      pushMessage({
        id,
        role: "agent",
        text: "Confirm to claim paper USDso. Nothing is sent until you do.",
        card: {
          id,
          kind: "claim",
          status: "open",
          lines: [
            { label: "Credit", value: `${formatRaw(eligibility.grantAmount, market.quoteDecimals)} ${market.quoteSymbol ?? "USDso"}` },
            { label: "Market", value: market.baseSymbol ?? "perp" },
            { label: "Margin bank", value: shortAddress(market.marginBank) },
          ],
          note: "Confirm sends claimPerpVoucher. It does not place an order.",
        },
      })
    } catch (error) {
      pushAgent(explainError(error))
    }
  }

  async function placeConfirmed(cardId: string) {
    if (busyRef.current) return
    const job = pending.current.get(cardId)
    if (!job || openCardId.current !== cardId) {
      pushAgent("There is no order waiting for confirmation.")
      return
    }
    busyRef.current = true
    setBusy(true)
    const working =
      job.kind === "order"
        ? "Checking getMaxPerpOrderSize. placePerpOrder runs only if this size fits."
        : "Sending the paper USDso claim."
    setMessages((prev) =>
      prev.map((message) =>
        message.id === cardId && message.card
          ? { ...message, text: working, card: { ...message.card, status: "working" } }
          : message,
      ),
    )
    try {
      const provider = injectedProvider()
      const account = addressRef.current
      const wallet = walletRef.current
      const markets = marketsClient.current
      if (!provider || !wallet || !account || !markets) {
        throw new WalletError("Connect a wallet on Hideki (chain 50383) first. Nothing was sent.")
      }
      const [, balance] = await Promise.all([
        ensureHideki(provider),
        publicClient.current.getBalance({ address: account }),
      ])
      if (balance === 0n) {
        throw new WalletError(
          "Not sent. This wallet has 0 STT, so it cannot pay Hideki gas. Bridge STT with npm run bridge, or use Send it for gas in the dreamDEX app.",
        )
      }
      markets.setSigner({ walletClient: wallet })
      if (job.kind === "claim") {
        const claimed = await claimPaperUsdso({
          markets,
          marginBank: job.marginBank,
          confirmed: true,
        })
        finish(cardId, "Paper USDso claim landed.", `${HIDEKI.explorerTx}${claimed.hash}`)
        await refreshStt(account)
        return
      }
      const placed = await sizeAndPlacePerpOrder({
        markets,
        account,
        market: job.market,
        isBid: job.isBid,
        price: job.price,
        quantity: job.quantity,
        orderType: job.orderType,
        confirmed: true,
        onSized: () => {
          patchMessage(cardId, { text: "Size fits. Approve placePerpOrder in your wallet." })
        },
      })
      const bits = [`Transaction ${placed.hash}.`]
      if (placed.orderId !== undefined) bits.push(`Resting order ${placed.orderId.toString()}.`)
      if (placed.fillCount > 0) bits.push(`${placed.fillCount} fill(s) in this transaction.`)
      bits.push(`Largest size at the check: ${formatRaw(placed.maxQuantity, job.baseDecimals)} ${job.symbol}.`)
      finish(cardId, bits.join(" "), `${HIDEKI.explorerTx}${placed.hash}`)
      await refreshStt(account)
    } catch (error) {
      const text = explainError(error)
      const rejected = text.startsWith("The wallet declined")
      const notSent = error instanceof Error && (error.name === "OrderNotSent" || error.name === "WalletError")
      if (rejected || notSent) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === cardId && message.card
              ? { ...message, text, card: { ...message.card, status: "open" } }
              : message,
          ),
        )
      } else {
        pending.current.delete(cardId)
        if (openCardId.current === cardId) openCardId.current = null
        draftRef.current = null
        setMessages((prev) =>
          prev.map((message) =>
            message.id === cardId && message.card
              ? {
                  ...message,
                  text: `${text} This card is closed. Say the order again if you still want it.`,
                  card: { ...message.card, status: "failed" },
                }
              : message,
          ),
        )
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function refreshStt(account: Address) {
    try {
      const next = await publicClient.current.getBalance({ address: account })
      setStt(formatStt(next))
    } catch {
      // The write already landed. Leave the header balance as it was.
    }
  }

  function finish(cardId: string, text: string, href: string) {
    pending.current.delete(cardId)
    if (openCardId.current === cardId) openCardId.current = null
    draftRef.current = null
    setMessages((prev) =>
      prev.map((message) =>
        message.id === cardId && message.card
          ? { ...message, text, href, card: { ...message.card, status: "done" } }
          : message,
      ),
    )
  }

  async function showMarkets() {
    if (book.current.status !== "ready") {
      await retryMarkets()
      return
    }
    const lines = book.current.markets.map((market) => {
      const min = /^\d+$/.test(market.minQuantity)
        ? formatRaw(BigInt(market.minQuantity), market.baseDecimals)
        : market.minQuantity
      return `${market.baseSymbol ?? "?"}  min ${min}  ${shortAddress(market.poolAddress)}`
    })
    pushAgent(lines.join("\n") || "The indexer returned no perp markets.")
  }

  async function showBalance() {
    const provider = injectedProvider()
    const account = addressRef.current
    if (!provider || !account) {
      pushAgent("Connect a wallet to read STT on Hideki.")
      return
    }
    try {
      const [balance, chain] = await Promise.all([
        publicClient.current.getBalance({ address: account }),
        readChainId(provider),
      ])
      setChainId(chain)
      setStt(formatStt(balance))
      pushAgent(`Wallet ${account}\nChain ${chain} (Hideki is ${HIDEKI.chainId})\nSTT ${formatStt(balance)}`)
    } catch (error) {
      pushAgent(explainError(error))
    }
  }

  async function submit(raw: string) {
    const text = raw.trim()
    if (!text || busyRef.current) return
    const reply = interpret(text, draftRef.current)
    draftRef.current = reply.draft
    pushMessage({ id: nid(), role: "user", text })
    if (reply.effect === "confirm") {
      if (prepareGate.current) await prepareGate.current
      const id = openCardId.current
      if (!id) {
        pushAgent(
          reply.draft?.kind === "claim"
            ? "Connect a wallet, then say claim again. Nothing was sent."
            : "There is no order waiting for confirmation.",
        )
        return
      }
      await placeConfirmed(id)
      return
    }
    busyRef.current = true
    setBusy(true)
    try {
      if (reply.effect === "discard") {
        const id = openCardId.current
        if (id) discardCard(id)
        else pushAgent(reply.text)
        return
      }
      if (reply.effect === "ready_order") {
        const task = presentOrder(reply.draft)
        prepareGate.current = task.then(() => undefined)
        await task
        return
      }
      if (reply.effect === "ready_claim") {
        const task = presentClaim()
        prepareGate.current = task.then(() => undefined)
        await task
        return
      }
      if (reply.effect === "markets") {
        await showMarkets()
        return
      }
      if (reply.effect === "balance") {
        await showBalance()
        return
      }
      pushAgent(reply.text)
    } finally {
      prepareGate.current = null
      busyRef.current = false
      setBusy(false)
    }
  }

  const wrongChain = chainId !== null && chainId !== HIDEKI.chainId

  return (
    <div className="hk-shell">
      <header className="hk-header">
        <div className="hk-header-inner">
          <div>
            <p className="hk-kicker">Hideki · chain {HIDEKI.chainId}</p>
            <h1>Perp orders, after you confirm</h1>
            <p className="hk-status">
              {marketLabel}
              {wrongChain ? ` · wallet is on ${chainId}` : ""}
              {address && stt !== null ? ` · ${stt} STT` : ""}
            </p>
          </div>
          <div className="hk-header-actions">
            {marketError ? (
              <button type="button" onClick={() => void retryMarkets()} disabled={busy}>
                Retry markets
              </button>
            ) : null}
            {address ? (
              <button type="button" onClick={disconnect} title={address}>
                {shortAddress(address)}
              </button>
            ) : (
              <button type="button" onClick={() => void connect()} disabled={busy}>
                Connect wallet
              </button>
            )}
          </div>
        </div>
        {marketError ? <p className="hk-banner">{marketError}</p> : null}
      </header>
      <main className="hk-main">
        <div className="hk-log" ref={logRef} aria-live="polite">
          {messages.map((message) => (
            <article key={message.id} className={`hk-msg hk-${message.role}`}>
              <p>{message.text}</p>
              {message.href ? (
                <a href={message.href} target="_blank" rel="noreferrer">
                  View transaction
                </a>
              ) : null}
              {message.card && message.card.status !== "closed" ? (
                <div className={`hk-card hk-card-${message.card.status}`}>
                  <dl>
                    {message.card.lines.map((line) => (
                      <div key={line.label}>
                        <dt>{line.label}</dt>
                        <dd>{line.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {message.card.note ? <p className="hk-note">{message.card.note}</p> : null}
                  {message.card.status === "open" ? (
                    <div className="hk-card-actions">
                      <button type="button" onClick={() => void placeConfirmed(message.card!.id)} disabled={busy}>
                        {message.card.kind === "claim" ? "Confirm claim" : "Confirm and place"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          draftRef.current = null
                          discardCard(message.card!.id)
                        }}
                        disabled={busy}
                      >
                        Discard
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
        <form
          className="hk-composer"
          onSubmit={(event) => {
            event.preventDefault()
            const next = input
            setInput("")
            void submit(next)
          }}
        >
          <label className="sr" htmlFor="order">
            Order
          </label>
          <input
            id="order"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="long 0.001 BTC at 50000"
            autoComplete="off"
            maxLength={500}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
        <div className="hk-chips">
          {CHIPS.map((chip) => (
            <button key={chip} type="button" disabled={busy} onClick={() => void submit(chip)}>
              {chip}
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
