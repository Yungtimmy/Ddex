import {
  SOMNIA_HIDEKI_TESTNET_ADDRESSES,
  SomniaMarkets,
  type SomniaMarketsSignerConfig,
  type SomniaMarketsWebSocketConstructor,
} from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { HIDEKI } from "./hideki"

export { hidekiTestnet }

/** One Hideki exchange. Browser sockets use the page's WebSocket. Node uses the SDK's own transport. */
export function createHidekiMarkets(signer?: SomniaMarketsSignerConfig): SomniaMarkets {
  if (hidekiTestnet.id !== HIDEKI.chainId) {
    throw new Error(`Refusing to start: hidekiTestnet is chain ${hidekiTestnet.id}, expected ${HIDEKI.chainId}.`)
  }
  return new SomniaMarkets({
    chain: hidekiTestnet,
    indexerUrl: HIDEKI.indexerUrl,
    addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
    ...(typeof window !== "undefined"
      ? { rpcWebSocketConstructor: window.WebSocket as unknown as SomniaMarketsWebSocketConstructor }
      : {}),
    ...signer,
  })
}
