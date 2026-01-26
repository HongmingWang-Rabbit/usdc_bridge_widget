# USDC Bridge Widget

A reusable React widget for cross-chain USDC transfers powered by Circle's CCTP (Cross-Chain Transfer Protocol).

## Features

- Cross-chain USDC transfers with native token minting
- No bridge fees (only gas costs)
- Customizable theme and styling
- Built-in chain switching
- TypeScript support
- Works with any wagmi-compatible wallet

## Installation

```bash
npm install @honeypot-finance/usdc-bridge-widget
# or
yarn add @honeypot-finance/usdc-bridge-widget
# or
pnpm add @honeypot-finance/usdc-bridge-widget
```

### Peer Dependencies

Make sure you have these peer dependencies installed:

```bash
npm install react react-dom wagmi viem @tanstack/react-query
```

## Quick Start

```tsx
import { BridgeWidget } from "@honeypot-finance/usdc-bridge-widget";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, arbitrum, base, optimism, polygon } from "viem/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";

// Create wagmi config
const config = createConfig({
  chains: [mainnet, arbitrum, base, optimism, polygon],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
  },
});

const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {/* Minimal - uses all 17 CCTP chains by default */}
        <BridgeWidget />

        {/* Or with options */}
        <BridgeWidget
          defaultSourceChainId={1}
          defaultDestinationChainId={8453}
          onBridgeSuccess={({ txHash, amount }) => {
            console.log(`Bridged ${amount} USDC: ${txHash}`);
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

## Props

### BridgeWidgetProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `chains` | `BridgeChainConfig[]` | All CCTP chains | Array of supported chains |
| `defaultSourceChainId` | `number` | First chain | Default source chain ID |
| `defaultDestinationChainId` | `number` | Second chain | Default destination chain ID |
| `onBridgeStart` | `function` | - | Called when bridge starts |
| `onBridgeSuccess` | `function` | - | Called on successful bridge |
| `onBridgeError` | `function` | - | Called on bridge error |
| `onConnectWallet` | `function` | - | Called when "Connect Wallet" clicked |
| `theme` | `BridgeWidgetTheme` | Default theme | Custom theme overrides |
| `borderless` | `boolean` | `false` | Remove borders/shadows for seamless integration |
| `className` | `string` | - | Custom CSS class |
| `style` | `CSSProperties` | - | Custom inline styles |

### BridgeChainConfig

```ts
interface BridgeChainConfig {
  chain: Chain;                      // viem Chain object
  usdcAddress: `0x${string}`;        // USDC contract address
  tokenMessengerAddress?: `0x${string}`; // Circle TokenMessenger address
  iconUrl?: string;                  // Optional chain icon URL
}
```

### BridgeWidgetTheme

```ts
interface BridgeWidgetTheme {
  primaryColor?: string;      // Default: "#6366f1"
  secondaryColor?: string;    // Default: "#a855f7"
  backgroundColor?: string;   // Default: "rgba(15, 15, 25, 0.8)"
  cardBackgroundColor?: string;
  textColor?: string;         // Default: "#ffffff"
  mutedTextColor?: string;
  borderColor?: string;
  successColor?: string;      // Default: "#22c55e"
  errorColor?: string;        // Default: "#ef4444"
  hoverColor?: string;        // Default: "rgba(255, 255, 255, 0.05)"
  borderRadius?: number;      // Default: 12
  fontFamily?: string;
}
```

## Custom Chain Configuration

```tsx
import { BridgeWidget, createChainConfig, USDC_ADDRESSES } from "@honeypot-finance/usdc-bridge-widget";
import { mainnet, arbitrum, base } from "viem/chains";
import { defineChain } from "viem";

// Use helper function
const chains = [
  createChainConfig(mainnet, {
    iconUrl: "https://example.com/eth-icon.png",
  }),
  createChainConfig(arbitrum),
  createChainConfig(base),
];

// Or define manually
const customChain = defineChain({
  id: 12345,
  name: "Custom Chain",
  // ... other chain config
});

const customChainConfig = {
  chain: customChain,
  usdcAddress: "0x..." as `0x${string}`,
  tokenMessengerAddress: "0x..." as `0x${string}`,
  iconUrl: "https://example.com/custom-icon.png",
};

<BridgeWidget chains={[...chains, customChainConfig]} />
```

## Custom Theme

```tsx
<BridgeWidget
  chains={DEFAULT_CHAIN_CONFIGS}
  theme={{
    primaryColor: "#00ff00",
    secondaryColor: "#00cc00",
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    fontFamily: "Inter, sans-serif",
  }}
/>
```

## Borderless Mode

Use the `borderless` prop for seamless integration into your existing UI. This removes all borders, shadows, and backgrounds from the widget container and its child components:

```tsx
<BridgeWidget borderless />

{/* Or combine with custom styling */}
<div className="my-custom-container">
  <BridgeWidget
    borderless
    style={{ padding: 0 }}
  />
</div>
```

## Callbacks

```tsx
<BridgeWidget
  chains={DEFAULT_CHAIN_CONFIGS}
  onBridgeStart={({ sourceChainId, destChainId, amount }) => {
    console.log(`Starting bridge: ${amount} USDC from ${sourceChainId} to ${destChainId}`);
  }}
  onBridgeSuccess={({ sourceChainId, destChainId, amount, txHash }) => {
    console.log(`Bridge successful! TX: ${txHash}`);
  }}
  onBridgeError={(error) => {
    console.error("Bridge failed:", error.message);
  }}
  onConnectWallet={() => {
    // Open your wallet modal
    openWalletModal();
  }}
/>
```

## Using Individual Hooks

The widget exports its internal hooks for advanced usage:

```tsx
import {
  useUSDCBalance,
  useAllUSDCBalances,
  useUSDCAllowance,
  useBridge,
  useBridgeQuote,
} from "@honeypot-finance/usdc-bridge-widget";

function CustomComponent() {
  const chainConfig = { chain: mainnet, usdcAddress: "0x..." };

  // Balance hooks
  const { balance, balanceFormatted } = useUSDCBalance(chainConfig);
  const { balances, isLoading } = useAllUSDCBalances([chainConfig]);

  // Allowance hook
  const { needsApproval, approve, isApproving } = useUSDCAllowance(chainConfig);

  // Bridge execution hook
  const { bridge, state, reset } = useBridge();
  // state.status: "idle" | "loading" | "approving" | "burning" | "fetching-attestation" | "minting" | "success" | "error"

  // Quote hook (returns static CCTP estimates)
  const { quote, isLoading: quoteLoading } = useBridgeQuote(1, 8453, "100");

  // Build your own UI
}
```

### Deprecated Hooks

The following hooks are deprecated and will be removed in a future version:

- `useBridgeEstimate` - Use `useBridgeQuote` instead
- `useFormatNumber` - Use the `formatNumber` utility function directly

## Supported Chains

The widget includes pre-configured USDC and TokenMessenger addresses for all CCTP V2 EVM chains:

| Chain | Chain ID |
|-------|----------|
| Ethereum | 1 |
| Arbitrum | 42161 |
| Base | 8453 |
| Optimism | 10 |
| Polygon | 137 |
| Avalanche | 43114 |
| Linea | 59144 |
| Unichain | 130 |
| Sonic | 146 |
| World Chain | 480 |
| Monad | 10200 |
| Sei | 1329 |
| XDC | 50 |
| HyperEVM | 999 |
| Ink | 57073 |
| Plume | 98866 |
| Codex | 81224 |

See [Circle CCTP Docs](https://developers.circle.com/cctp/cctp-supported-blockchains) for the latest supported chains

## Circle Bridge Kit Integration

For full bridge functionality, install Circle's Bridge Kit:

```bash
npm install @circle-fin/bridge-kit @circle-fin/adapter-viem-v2
```

Then integrate with the widget's callbacks to execute actual transfers.

## License

MIT
