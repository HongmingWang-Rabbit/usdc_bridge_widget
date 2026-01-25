import type { Chain } from "viem";

export interface BridgeWidgetTheme {
  /** Primary accent color (hex) */
  primaryColor?: string;
  /** Secondary accent color (hex) */
  secondaryColor?: string;
  /** Background color (hex) */
  backgroundColor?: string;
  /** Card background color (hex) */
  cardBackgroundColor?: string;
  /** Text color (hex) */
  textColor?: string;
  /** Muted text color (hex) */
  mutedTextColor?: string;
  /** Border color (hex) */
  borderColor?: string;
  /** Success color (hex) */
  successColor?: string;
  /** Error color (hex) */
  errorColor?: string;
  /** Border radius (px) */
  borderRadius?: number;
  /** Font family */
  fontFamily?: string;
}

export interface BridgeChainConfig {
  /** Chain definition from viem */
  chain: Chain;
  /** USDC contract address on this chain */
  usdcAddress: `0x${string}`;
  /** Circle TokenMessenger address for CCTP */
  tokenMessengerAddress?: `0x${string}`;
  /** Optional chain icon URL */
  iconUrl?: string;
}

export interface BridgeWidgetProps {
  /** Array of supported chains with their USDC addresses */
  chains: BridgeChainConfig[];
  /** Default source chain ID */
  defaultSourceChainId?: number;
  /** Default destination chain ID */
  defaultDestinationChainId?: number;
  /** Called when bridge transaction is initiated */
  onBridgeStart?: (params: {
    sourceChainId: number;
    destChainId: number;
    amount: string;
    txHash?: string;
  }) => void;
  /** Called when bridge transaction completes successfully */
  onBridgeSuccess?: (params: {
    sourceChainId: number;
    destChainId: number;
    amount: string;
    txHash: string;
  }) => void;
  /** Called when bridge transaction fails */
  onBridgeError?: (error: Error) => void;
  /** Called when user connects wallet */
  onConnectWallet?: () => void;
  /** Custom theme overrides */
  theme?: BridgeWidgetTheme;
  /** Widget title */
  title?: string;
  /** Widget description */
  description?: string;
  /** Whether to show info card at bottom */
  showInfoCard?: boolean;
  /** Custom CSS class name */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
}

export interface BridgeEstimate {
  gasFee: string;
  bridgeFee: string;
  totalFee: string;
  estimatedTime: string;
}

export interface BridgeResult {
  state: "idle" | "pending" | "success" | "error";
  txHash?: string;
  error?: string;
}
