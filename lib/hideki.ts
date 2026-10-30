/** Hideki testnet (the chain dreamDEX shows as Tokyo). Locked to the perps deployment. */
export const HIDEKI = {
  chainId: 50383,
  chainIdHex: "0xc4cf",
  name: "Hideki Testnet",
  rpcHttp: "https://api.hideki2.infra.testnet.somnia.network",
  rpcWs: "wss://api.hideki2.infra.testnet.somnia.network/ws",
  indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql",
  explorerTx: "https://explorer.testnet.somnia.network/tokyo/tx/",
  nativeSymbol: "STT",
  nativeDecimals: 18,
} as const
