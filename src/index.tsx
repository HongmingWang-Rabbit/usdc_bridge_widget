// Main widget export
export { BridgeWidget } from "./BridgeWidget";

// Types
export type {
  BridgeWidgetProps,
  BridgeWidgetTheme,
  BridgeChainConfig,
  BridgeEstimate,
  BridgeResult,
} from "./types";

// Hooks (for advanced usage)
export {
  useUSDCBalance,
  useAllUSDCBalances,
  useUSDCAllowance,
  /**
   * @deprecated Use `useBridgeQuote` instead
   */
  useBridgeEstimate,
  /**
   * @deprecated Use `formatNumber` from utils instead
   */
  useFormatNumber,
} from "./hooks";

// Bridge hook
export { useBridge, useBridgeQuote, getChainName } from "./useBridge";
export type { BridgeParams, BridgeState, BridgeEvent, UseBridgeResult, BridgeQuote } from "./useBridge";

// Utilities
export {
  formatNumber,
  getErrorMessage,
  parseUSDCAmount,
  isValidPositiveAmount,
  validateAmountInput,
  validateChainConfig,
  validateChainConfigs,
  MAX_USDC_AMOUNT,
  MIN_USDC_AMOUNT,
} from "./utils";
export type { ChainConfigValidationResult } from "./utils";

// Constants
export {
  USDC_DECIMALS,
  USDC_BRAND_COLOR,
  USDC_ADDRESSES,
  TOKEN_MESSENGER_V1_ADDRESSES,
  TOKEN_MESSENGER_V2_ADDRESS,
  TOKEN_MESSENGER_ADDRESSES,
  CHAIN_ICONS,
  DEFAULT_LOCALE,
} from "./constants";

// Chain configs and helpers
export {
  createChainConfig,
  DEFAULT_CHAIN_CONFIGS,
  // Custom chains
  unichain,
  hyperEvm,
  plume,
  monad,
  codex,
  // Re-exported viem chains
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
  // Testnet support
  createTestnetChainConfig,
  TESTNET_CHAIN_CONFIGS,
  sepolia,
  arbitrumSepolia,
  avalancheFuji,
  baseSepolia,
  optimismSepolia,
  polygonAmoy,
} from "./chains";

// Theme utilities
export {
  defaultTheme,
  mergeTheme,
  themePresets,
  THEME_COLORS,
  THEME_SIZING,
  THEME_FONTS,
} from "./theme";

// Icons (for custom implementations)
export {
  ChevronDownIcon,
  SwapIcon,
  SpinnerIcon,
  CheckIcon,
  ErrorIcon,
  ExternalLinkIcon,
  WalletIcon,
} from "./icons";
