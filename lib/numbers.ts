/** Parse a human amount: `50000`, `50,000`, `50k`, `1.5k`. Returns a decimal string. */
export function parseHumanNumber(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase().replace(/_/g, "")
  if (!/^(\d+)(?:\.(\d+))?k?$/.test(trimmed)) return null
  const k = trimmed.endsWith("k")
  const body = k ? trimmed.slice(0, -1) : trimmed
  const [whole, frac = ""] = body.split(".")
  if (!k) return frac ? `${whole}.${frac}` : whole
  const digits = `${whole}${frac}`
  const point = whole.length + 3
  const padded = digits.padEnd(point, "0")
  const head = padded.slice(0, point).replace(/^0+(?=\d)/, "")
  const tail = padded.slice(point).replace(/0+$/, "")
  return tail ? `${head}.${tail}` : head
}

export function stripGrouping(text: string): string {
  let next = text
  let prev = ""
  while (next !== prev) {
    prev = next
    next = next.replace(/(\d),(\d)/g, "$1$2")
  }
  return next
}
