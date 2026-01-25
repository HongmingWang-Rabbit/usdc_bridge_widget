import { defineChain } from "viem";
import {
  mainnet,
  arbitrum,
  avalanche,
  base,
  optimism,
  polygon,
  linea,
  sei,
  worldchain,
  ink,
  sonic,
  xdc,
  // Testnets
  sepolia,
  arbitrumSepolia,
  avalancheFuji,
  baseSepolia,
  optimismSepolia,
  polygonAmoy,
} from "viem/chains";
import type { BridgeChainConfig } from "./types";
import {
  USDC_ADDRESSES,
  TOKEN_MESSENGER_ADDRESSES,
  CHAIN_ICONS,
} from "./constants";

// Custom chain definitions for chains not yet in viem/chains
export const unichain = defineChain({
  id: 130,
  name: "Unichain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.unichain.org"] },
  },
  blockExplorers: {
    default: { name: "Uniscan", url: "https://uniscan.xyz" },
  },
});

export const hyperEvm = defineChain({
  id: 999,
  name: "HyperEVM",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.hyperliquid.xyz/evm"] },
  },
  blockExplorers: {
    default: { name: "Hyperscan", url: "https://hyperscan.xyz" },
  },
});

export const plume = defineChain({
  id: 98866,
  name: "Plume",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.plume.org"] },
  },
  blockExplorers: {
    default: { name: "Plume Explorer", url: "https://explorer.plume.org" },
  },
});

export const monad = defineChain({
  id: 10200,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://explorer.monad.xyz" },
  },
});

export const codex = defineChain({
  id: 81224,
  name: "Codex",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.codex.storage"] },
  },
  blockExplorers: {
    default: { name: "Codex Explorer", url: "https://explorer.codex.storage" },
  },
});

// Helper to create chain configs
export function createChainConfig(
  chain: import("viem").Chain,
  options?: {
    usdcAddress?: `0x${string}`;
    tokenMessengerAddress?: `0x${string}`;
    iconUrl?: string;
  }
): BridgeChainConfig {
  return {
    chain,
    usdcAddress: options?.usdcAddress || USDC_ADDRESSES[chain.id],
    tokenMessengerAddress:
      options?.tokenMessengerAddress || TOKEN_MESSENGER_ADDRESSES[chain.id],
    iconUrl: options?.iconUrl || CHAIN_ICONS[chain.id],
  };
}

// All supported CCTP chains
// Note: Monad is defined but not included in defaults as Circle Bridge Kit doesn't support it yet
export const DEFAULT_CHAIN_CONFIGS: BridgeChainConfig[] = [
  createChainConfig(mainnet),
  createChainConfig(arbitrum),
  createChainConfig(base),
  createChainConfig(optimism),
  createChainConfig(polygon),
  createChainConfig(avalanche),
  createChainConfig(linea),
  createChainConfig(sonic),
  createChainConfig(worldchain),
  createChainConfig(sei),
  createChainConfig(xdc),
  createChainConfig(ink),
  createChainConfig(unichain),
  createChainConfig(hyperEvm),
  createChainConfig(plume),
  createChainConfig(codex),
];

// Re-export viem chains for convenience
export {
  mainnet,
  arbitrum,
  avalanche,
  base,
  optimism,
  polygon,
  linea,
  sei,
  worldchain,
  ink,
  sonic,
  xdc,
};

// =============================================================================
// TESTNET CHAINS
// =============================================================================

// Testnet USDC addresses (Circle's testnet USDC)
const TESTNET_USDC_ADDRESSES: Record<number, `0x${string}`> = {
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia
  421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Arbitrum Sepolia
  43113: "0x5425890298aed601595a70AB815c96711a31Bc65", // Avalanche Fuji
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
  11155420: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7", // Optimism Sepolia
  80002: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // Polygon Amoy
};

// Testnet TokenMessenger V2 address (same across testnets)
const TESTNET_TOKEN_MESSENGER_V2_ADDRESS: `0x${string}` =
  "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5";

/**
 * Create a testnet chain configuration
 */
export function createTestnetChainConfig(
  chain: import("viem").Chain,
  options?: {
    usdcAddress?: `0x${string}`;
    tokenMessengerAddress?: `0x${string}`;
    iconUrl?: string;
  }
): BridgeChainConfig {
  return {
    chain,
    usdcAddress: options?.usdcAddress || TESTNET_USDC_ADDRESSES[chain.id],
    tokenMessengerAddress:
      options?.tokenMessengerAddress || TESTNET_TOKEN_MESSENGER_V2_ADDRESS,
    iconUrl: options?.iconUrl || CHAIN_ICONS[chain.id],
  };
}

/**
 * Testnet chain configurations for development and testing.
 * These use Circle's testnet USDC and TokenMessenger contracts.
 *
 * @example
 * import { TESTNET_CHAIN_CONFIGS } from './chains';
 * <BridgeWidget chains={TESTNET_CHAIN_CONFIGS} />
 */
export const TESTNET_CHAIN_CONFIGS: BridgeChainConfig[] = [
  createTestnetChainConfig(sepolia),
  createTestnetChainConfig(arbitrumSepolia),
  createTestnetChainConfig(avalancheFuji),
  createTestnetChainConfig(baseSepolia),
  createTestnetChainConfig(optimismSepolia),
  createTestnetChainConfig(polygonAmoy),
];

// Re-export testnet chains
export {
  sepolia,
  arbitrumSepolia,
  avalancheFuji,
  baseSepolia,
  optimismSepolia,
  polygonAmoy,
};
