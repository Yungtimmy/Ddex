import { formatUnits } from "viem"

/** Integer raw units, or null when the indexer string is not a whole number. */
export function asRaw(value: string | null | undefined): bigint | null {
  if (!value || !/^\d+$/.test(value)) return null
  return BigInt(value)
}

/** Bids snap down so the limit never pays more. Asks snap up so the limit never sells for less. */
export function alignPrice(price: bigint, tick: bigint, isBid: boolean): bigint {
  if (tick <= 0n) return price
  const rem = price % tick
  if (rem === 0n) return price
  return isBid ? price - rem : price + (tick - rem)
}

/** Raise onto the minimum and the lot grid. The size check still runs before any send. */
export function alignQuantity(quantity: bigint, lot: bigint, min: bigint): bigint {
  let next = quantity < min ? min : quantity
  if (lot > 0n && next % lot !== 0n) next += lot - (next % lot)
  return next
}

/** Mark ± slippage, in bps. Buys pay up to the mark plus slippage. Sells accept down to the mark minus it. */
export function applySlippage(mark: bigint, isBid: boolean, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.round(slippageBps)))
  const delta = (mark * bps) / 10_000n
  if (isBid) return mark + delta
  return mark > delta ? mark - delta : 0n
}

function trimFraction(text: string): string {
  if (!text.includes(".")) return text
  return text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
}

/** Human units. `maxFrac` rounds the fraction for display; omit it to keep the exact value. */
export function formatRaw(value: bigint, decimals: number, maxFrac?: number): string {
  const full = trimFraction(formatUnits(value, decimals))
  if (maxFrac === undefined || !full.includes(".")) return full
  const [whole, frac] = full.split(".")
  if (frac.length <= maxFrac) return full
  const keep = frac.slice(0, maxFrac)
  if (frac[maxFrac] < "5") return trimFraction(`${whole}.${keep}`)
  const rounded = BigInt(`${whole}${keep}`) + 1n
  const padded = rounded.toString().padStart(whole.length + keep.length, "0")
  const head = padded.slice(0, padded.length - maxFrac)
  const tail = padded.slice(padded.length - maxFrac)
  return trimFraction(`${head || "0"}.${tail}`)
}

export function formatStt(value: bigint): string {
  const text = formatRaw(value, 18)
  const [whole, frac = ""] = text.split(".")
  if (!frac) return whole
  return `${whole}.${frac.slice(0, 4)}`
}

export function shortAddress(value: string): string {
  if (value.length < 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}
