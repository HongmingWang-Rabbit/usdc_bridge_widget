import type { Chain } from "viem";

/**
 * Theme configuration for the Bridge Widget.
 * All color values should be valid CSS color strings (hex, rgb, rgba, etc.).
 *
 * @example
 * const customTheme: BridgeWidgetTheme = {
 *   primaryColor: "#3b82f6",
 *   backgroundColor: "rgba(0, 0, 0, 0.9)",
 *   borderRadius: 16,
 * };
 */
export interface BridgeWidgetTheme {
  /** Primary accent color used for buttons and highlights (hex) */
  primaryColor?: string;
  /** Secondary accent color used for gradients (hex) */
  secondaryColor?: string;
  /** Main background color of the widget (hex or rgba) */
  backgroundColor?: string;
  /** Background color for cards and nested elements (hex or rgba) */
  cardBackgroundColor?: string;
  /** Primary text color (hex) */
  textColor?: string;
  /** Secondary/muted text color for labels (hex or rgba) */
  mutedTextColor?: string;
  /** Border color for inputs and containers (hex or rgba) */
  borderColor?: string;
  /** Color for success states and messages (hex) */
  successColor?: string;
  /** Color for error states and messages (hex) */
  errorColor?: string;
  /** Color for hover states (hex or rgba) */
  hoverColor?: string;
  /** Border radius in pixels for rounded corners */
  borderRadius?: number;
  /** Font family for all text in the widget */
  fontFamily?: string;
}

/**
 * Configuration for a supported blockchain in the bridge.
 * Contains chain metadata, USDC contract address, and CCTP TokenMessenger address.
 *
 * @example
 * const ethereumConfig: BridgeChainConfig = {
 *   chain: mainnet,
 *   usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
 *   tokenMessengerAddress: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
 *   iconUrl: "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
 * };
 */
export interface BridgeChainConfig {
  /** Chain definition from viem containing id, name, and network details */
  chain: Chain;
  /** USDC token contract address on this chain (checksummed) */
  usdcAddress: `0x${string}`;
  /** Circle TokenMessenger contract address for CCTP transfers */
  tokenMessengerAddress?: `0x${string}`;
  /** URL for the chain's icon/logo image (optional, falls back to initial) */
  iconUrl?: string;
}

/**
 * Props for the BridgeWidget component.
 *
 * @example
 * <BridgeWidget
 *   defaultSourceChainId={1}
 *   defaultDestinationChainId={8453}
 *   onBridgeSuccess={({ txHash }) => console.log('Success:', txHash)}
 *   onBridgeError={(error) => console.error('Error:', error)}
 *   theme={{ primaryColor: "#3b82f6" }}
 * />
 */
export interface BridgeWidgetProps {
  /**
   * Array of supported chains with their USDC addresses.
   * Defaults to all CCTP-supported chains from DEFAULT_CHAIN_CONFIGS.
   */
  chains?: BridgeChainConfig[];
  /** Chain ID to pre-select as the source chain */
  defaultSourceChainId?: number;
  /** Chain ID to pre-select as the destination chain */
  defaultDestinationChainId?: number;
  /**
   * Callback fired when a bridge transaction is initiated.
   * Called before approval (if needed) or bridge execution begins.
   */
  onBridgeStart?: (params: {
    /** Source chain ID */
    sourceChainId: number;
    /** Destination chain ID */
    destChainId: number;
    /** Amount being bridged (as string) */
    amount: string;
    /** Transaction hash (only present if tx already submitted) */
    txHash?: `0x${string}`;
  }) => void;
  /**
   * Callback fired when a bridge transaction completes successfully.
   * The txHash can be used to link to a block explorer.
   */
  onBridgeSuccess?: (params: {
    /** Source chain ID */
    sourceChainId: number;
    /** Destination chain ID */
    destChainId: number;
    /** Amount bridged (as string) */
    amount: string;
    /** Transaction hash of the successful bridge */
    txHash: `0x${string}`;
  }) => void;
  /**
   * Callback fired when a bridge transaction fails.
   * The error object contains details about what went wrong.
   */
  onBridgeError?: (error: Error) => void;
  /**
   * Callback fired when the user clicks "Connect Wallet".
   * If not provided, the widget will attempt to use wagmi's connectors.
   */
  onConnectWallet?: () => void;
  /** Custom theme overrides to customize the widget appearance */
  theme?: BridgeWidgetTheme;
  /** Custom CSS class name to apply to the widget container */
  className?: string;
  /** Custom inline styles to apply to the widget container */
  style?: React.CSSProperties;
}

/**
 * Estimated costs and timing for a bridge transfer.
 * Used by the deprecated useBridgeEstimate hook.
 *
 * @deprecated Use BridgeQuote from useBridge.ts instead
 */
export interface BridgeEstimate {
  /** Estimated gas fee (as formatted string) */
  gasFee: string;
  /** Protocol bridge fee (as formatted string) */
  bridgeFee: string;
  /** Total estimated fee including gas and protocol (as formatted string) */
  totalFee: string;
  /** Estimated time for the bridge to complete (e.g., "~15-20 minutes") */
  estimatedTime: string;
}

/**
 * Result state for a bridge operation.
 * Tracks the current state and any associated transaction hash or error.
 */
export interface BridgeResult {
  /** Current state of the bridge operation */
  state: "idle" | "pending" | "success" | "error";
  /** Transaction hash if a transaction has been submitted */
  txHash?: `0x${string}`;
  /** Error message if the operation failed */
  error?: string;
}
