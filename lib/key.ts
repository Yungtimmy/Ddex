import { existsSync, readFileSync } from "node:fs"

const DEFAULT_KEY_PATH = "/workspace/.secrets/dreamdex_testnet_key"

/** Load `.env` for the CLI scripts. Existing process env wins. Never logs values. */
export function loadEnvFile(path = ".env"): void {
  if (!existsSync(path)) return
  const text = readFileSync(path, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    if (process.env[key] !== undefined) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

/**
 * CLI signer only (`npm run read`, `place`, `bridge`).
 * The web app does not call this. It signs with the connected browser wallet.
 */
export function readPrivateKey(): `0x${string}` {
  loadEnvFile()
  const fromEnv = process.env.PRIVATE_KEY?.trim()
  if (fromEnv) return normalizeKey(fromEnv)
  const path = process.env.KEY_PATH ?? DEFAULT_KEY_PATH
  try {
    return normalizeKey(readFileSync(path, "utf8"))
  } catch {
    throw new Error(
      `No CLI signer. Set PRIVATE_KEY, or KEY_PATH to a file containing the hex key (default ${DEFAULT_KEY_PATH}). The chat app uses a browser wallet and does not read a key.`,
    )
  }
}

function normalizeKey(raw: string): `0x${string}` {
  const key = raw.trim()
  if (/^[0-9a-fA-F]{64}$/.test(key)) return `0x${key}`
  if (/^0x[0-9a-fA-F]{64}$/.test(key)) return key as `0x${string}`
  throw new Error("The private key must be 32 bytes of hex, with or without a 0x prefix. It is not written to the repo.")
}
