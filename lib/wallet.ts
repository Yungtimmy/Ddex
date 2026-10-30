import { createWalletClient, custom, getAddress, type Address, type WalletClient } from "viem"
import { HIDEKI } from "./hideki"
import { hidekiTestnet } from "./session"

export class WalletError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WalletError"
  }
}

export type Eip1193 = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
}

export function injectedProvider(): Eip1193 | null {
  if (typeof window === "undefined") return null
  const eth = (window as Window & { ethereum?: Eip1193 }).ethereum
  return eth ?? null
}

export async function connectHideki(provider: Eip1193): Promise<{
  address: Address
  chainId: number
  walletClient: WalletClient
}> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[]
  const first = accounts[0]
  if (!first) throw new WalletError("The wallet returned no account.")
  const address = getAddress(first)
  const chainId = await ensureHideki(provider)
  const walletClient = createWalletClient({
    account: address,
    chain: hidekiTestnet,
    transport: custom(provider),
  })
  return { address, chainId, walletClient }
}

export async function ensureHideki(provider: Eip1193): Promise<number> {
  const current = await readChainId(provider)
  if (current === HIDEKI.chainId) return current
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: HIDEKI.chainIdHex }],
    })
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 4902) {
      throw new WalletError(`Switch the wallet to ${HIDEKI.name} (chain ${HIDEKI.chainId}) before placing.`)
    }
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: HIDEKI.chainIdHex,
          chainName: HIDEKI.name,
          nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
          rpcUrls: [HIDEKI.rpcHttp],
        },
      ],
    })
  }
  const after = await readChainId(provider)
  if (after !== HIDEKI.chainId) {
    throw new WalletError(`The wallet is on chain ${after}. Hideki is ${HIDEKI.chainId}.`)
  }
  return after
}

export async function readChainId(provider: Eip1193): Promise<number> {
  const hex = (await provider.request({ method: "eth_chainId" })) as string
  return Number(hex)
}
