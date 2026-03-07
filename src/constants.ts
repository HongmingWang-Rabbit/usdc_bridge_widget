// USDC token decimals
export const USDC_DECIMALS = 6;

// USDC brand color for icon
export const USDC_BRAND_COLOR = "#2775ca";

// Maximum USDC amount (100 billion - more than total supply)
export const MAX_USDC_AMOUNT = "100000000000";

// Minimum USDC amount for bridging
export const MIN_USDC_AMOUNT = "0.000001";

// Default locale for number formatting (consistent display in financial apps)
export const DEFAULT_LOCALE = "en-US";

// Default USDC addresses per chain
// Note: Not all chains listed here are supported by Circle Bridge Kit yet.
// Check DEFAULT_CHAIN_CONFIGS in chains.ts for currently supported chains.
export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  // Original chains
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Ethereum
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum
  43114: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // Avalanche
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Optimism
  137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Polygon
  59144: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", // Linea
  // New CCTP V2 chains
  130: "0x078D782b760474a361dDA0AF3839290b0EF57AD6", // Unichain
  146: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", // Sonic
  480: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1", // World Chain
  // Note: Monad is defined but not yet supported by Circle Bridge Kit SDK
  10200: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603", // Monad
  1329: "0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392", // Sei
  50: "0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1", // XDC
  999: "0xb88339CB7199b77E23DB6E890353E22632Ba630f", // HyperEVM
  57073: "0x2D270e6886d130D724215A266106e6832161EAEd", // Ink
  98866: "0x222365EF19F7947e5484218551B56bb3965Aa7aF", // Plume
  81224: "0xd996633a415985DBd7D6D12f4A4343E31f5037cf", // Codex
};

// Circle TokenMessenger V1 addresses (CCTP Legacy)
export const TOKEN_MESSENGER_V1_ADDRESSES: Record<number, `0x${string}`> = {
  1: "0xBd3fa81B58Ba92a82136038B25aDec7066af3155", // Ethereum
  42161: "0x19330d10D9Cc8751218eaf51E8885D058642E08A", // Arbitrum
  43114: "0x6B25532e1060CE10cc3B0A99e5683b91BFDe6982", // Avalanche
  8453: "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962", // Base
  10: "0x2B4069517957735bE00ceE0fadAE88a26365528f", // Optimism
  137: "0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE", // Polygon
};

// Circle TokenMessengerV2 address (CCTP V2 - same address on all supported chains)
export const TOKEN_MESSENGER_V2_ADDRESS: `0x${string}` =
  "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d";

// Combined TokenMessenger addresses (prefers V2)
export const TOKEN_MESSENGER_ADDRESSES: Record<number, `0x${string}`> = {
  // All CCTP V2 supported chains use the same address
  1: TOKEN_MESSENGER_V2_ADDRESS, // Ethereum
  42161: TOKEN_MESSENGER_V2_ADDRESS, // Arbitrum
  43114: TOKEN_MESSENGER_V2_ADDRESS, // Avalanche
  8453: TOKEN_MESSENGER_V2_ADDRESS, // Base
  10: TOKEN_MESSENGER_V2_ADDRESS, // Optimism
  137: TOKEN_MESSENGER_V2_ADDRESS, // Polygon
  59144: TOKEN_MESSENGER_V2_ADDRESS, // Linea
  130: TOKEN_MESSENGER_V2_ADDRESS, // Unichain
  146: TOKEN_MESSENGER_V2_ADDRESS, // Sonic
  480: TOKEN_MESSENGER_V2_ADDRESS, // World Chain
  10200: TOKEN_MESSENGER_V2_ADDRESS, // Monad
  1329: TOKEN_MESSENGER_V2_ADDRESS, // Sei
  50: TOKEN_MESSENGER_V2_ADDRESS, // XDC
  999: TOKEN_MESSENGER_V2_ADDRESS, // HyperEVM
  57073: TOKEN_MESSENGER_V2_ADDRESS, // Ink
  98866: TOKEN_MESSENGER_V2_ADDRESS, // Plume
  81224: TOKEN_MESSENGER_V2_ADDRESS, // Codex
};

// CCTP domain IDs per chain (from https://developers.circle.com/cctp/cctp-supported-blockchains)
export const CCTP_DOMAIN_IDS: Record<number, number> = {
  1: 0, // Ethereum
  43114: 1, // Avalanche
  10: 2, // Optimism
  42161: 3, // Arbitrum
  8453: 6, // Base
  137: 7, // Polygon
  130: 10, // Unichain
  59144: 11, // Linea
  81224: 12, // Codex
  146: 13, // Sonic
  480: 14, // World Chain
  10200: 15, // Monad
  1329: 16, // Sei
  50: 18, // XDC
  999: 19, // HyperEVM
  57073: 21, // Ink
  98866: 22, // Plume
};

// Reverse mapping: CCTP domain ID → chain ID
export const CCTP_DOMAIN_TO_CHAIN_ID: Record<number, number> = Object.fromEntries(
  Object.entries(CCTP_DOMAIN_IDS).map(([chainId, domainId]) => [domainId, Number(chainId)])
);

// MessageTransmitterV2 address (CCTP V2 - same address on all supported chains)
export const MESSAGE_TRANSMITTER_V2_ADDRESS: `0x${string}` =
  "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64";

// Circle Iris API for attestation lookups
export const CIRCLE_IRIS_API_URL = "https://iris-api.circle.com/v2/messages";

// Attestation polling configuration
export const ATTESTATION_POLL_INTERVAL_MS = 30_000;
export const ATTESTATION_POLL_MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Chain icon URLs (using DefiLlama's reliable CDN)
export const CHAIN_ICONS: Record<number, string> = {
  1: "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg", // Ethereum
  42161: "https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg", // Arbitrum
  43114: "https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg", // Avalanche
  8453: "https://icons.llamao.fi/icons/chains/rsz_base.jpg", // Base
  10: "https://icons.llamao.fi/icons/chains/rsz_optimism.jpg", // Optimism
  137: "https://icons.llamao.fi/icons/chains/rsz_polygon.jpg", // Polygon
  59144: "https://icons.llamao.fi/icons/chains/rsz_linea.jpg", // Linea
  130: "https://icons.llamao.fi/icons/chains/rsz_unichain.jpg", // Unichain
  146: "https://icons.llamao.fi/icons/chains/rsz_sonic.jpg", // Sonic
  480: "https://icons.llamao.fi/icons/chains/rsz_world-chain.jpg", // World Chain
  10200: "https://icons.llamao.fi/icons/chains/rsz_monad.jpg", // Monad
  1329: "https://icons.llamao.fi/icons/chains/rsz_sei.jpg", // Sei
  50: "https://icons.llamao.fi/icons/chains/rsz_xdc.jpg", // XDC
  999: "https://icons.llamao.fi/icons/chains/rsz_hyperevm.jpg", // HyperEVM
  57073: "https://icons.llamao.fi/icons/chains/rsz_ink.jpg", // Ink
  98866: "https://icons.llamao.fi/icons/chains/rsz_plume.jpg", // Plume
  81224:
    "https://raw.githubusercontent.com/0xa3k5/web3icons/main/packages/core/src/svgs/networks/branded/codex.svg", // Codex
};
