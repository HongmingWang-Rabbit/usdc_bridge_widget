// Main widget export
export { BridgeWidget } from "./BridgeWidget";

// Types
export type {
  BridgeWidgetProps,
  BridgeWidgetTheme,
  BridgeChainConfig,
  BridgeEstimate,
  BridgeResult,
  ClaimStatus,
  ClaimState,
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
export type { BridgeParams, BridgeState, BridgeEvent, UseBridgeResult, BridgeQuote, BridgePersistenceConfig } from "./useBridge";

// Recovery hook
export { useRecovery } from "./useRecovery";
export type { UseRecoveryResult, UseRecoveryOptions } from "./useRecovery";

// Claim hook (manual USDC recovery)
export { useClaim } from "./useClaim";
export type { UseClaimResult, UseClaimOptions } from "./useClaim";

// Claim manager hook (multi-claim persistence)
export { useClaimManager } from "./useClaimManager";
export type { UseClaimManagerResult, UseClaimManagerOptions } from "./useClaimManager";

// Pending tab hook (aggregator)
export { usePendingTab } from "./usePendingTab";
export type { UsePendingTabResult, PendingItem, PendingItemType, PendingActionType, PendingStatusVariant } from "./usePendingTab";

// Persistence storage utilities (for advanced consumers)
export {
  savePendingBridge,
  updatePendingBridge,
  loadPendingBridges,
  loadPendingBridgeById,
  removePendingBridge,
  cleanupStaleBridges,
  savePendingClaim,
  loadPendingClaims,
  removePendingClaim,
} from "./storage";
export type {
  PendingBridgeRecord,
  PendingBridgeStatus,
  PendingBridgeFailureHint,
  PendingClaimRecord,
  PendingClaimStatus,
} from "./storage";

// Utilities
export {
  formatNumber,
  getErrorMessage,
  parseUSDCAmount,
  isValidPositiveAmount,
  isEIP1193Provider,
  toHexString,
  validateAmountInput,
  validateChainConfig,
  validateChainConfigs,
  bigIntReplacer,
  MAX_USDC_AMOUNT,
  MIN_USDC_AMOUNT,
  ensureHexPrefix,
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
  CCTP_DOMAIN_IDS,
  CCTP_DOMAIN_TO_CHAIN_ID,
  MESSAGE_TRANSMITTER_V2_ADDRESS,
  CIRCLE_IRIS_API_URL,
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
  WarningIcon,
  SearchIcon,
} from "./icons";
