# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run build       # Build for production (CJS, ESM, types)
npm run dev         # Watch mode for development
npm run typecheck   # Type check without emitting
npm test            # Run tests with vitest
```

## Demo App

A local demo app exists in `demo/` (gitignored). To run it:

```bash
cd demo
npm install
npm run dev         # Opens at http://localhost:5173
```

The demo imports the widget source directly from `../../src` for live testing.

## Architecture

This is a React component library that provides a USDC cross-chain bridge widget using Circle's CCTP (Cross-Chain Transfer Protocol). The package is built with tsup and exports both CommonJS and ESM formats.

### File Structure

- `src/index.tsx` - Main exports and re-exports from all modules
- `src/BridgeWidget.tsx` - Main widget component with sub-components (ChainSelector, SwapButton, AmountInput, ChainIcon)
- `src/hooks.ts` - React hooks for USDC balance, allowance, and deprecated bridge estimation
- `src/useBridge.ts` - Bridge execution hook using Circle's Bridge Kit SDK with event handling
- `src/types.ts` - TypeScript interfaces for props, theme, and chain configs
- `src/chains.ts` - Chain configurations, custom chain definitions, and testnet support
- `src/constants.ts` - USDC addresses, TokenMessenger addresses, chain icons, and constants
- `src/utils.ts` - Utility functions (formatNumber, validateAmountInput, validateChainConfigs)
- `src/theme.ts` - Theme system with presets (dark, light, blue, green)
- `src/icons.tsx` - SVG icon components
- `src/__tests__/` - Test files for all modules

### Key Dependencies

The widget relies on peer dependencies that the consuming app must provide:
- `wagmi` (v2+) - Wallet connection and contract interactions
- `viem` (v2+) - Ethereum utilities and chain definitions
- `@tanstack/react-query` (v5+) - Data fetching

Direct dependencies:
- `@circle-fin/bridge-kit` - Circle's CCTP SDK for cross-chain transfers
- `@circle-fin/adapter-viem-v2` - Viem adapter for Bridge Kit

### Integration Notes

The widget uses wagmi hooks and requires the parent app to provide a properly configured `WagmiProvider`. The widget does NOT auto-connect wallets - parent apps must provide the `onConnectWallet` callback.

**Wagmi Config Requirements:**
- The widget reads from the parent's `WagmiProvider` context
- For multi-chain balance fetching to work, wagmi config must include transports for ALL chains displayed in the widget
- Wallet connection is delegated to the parent app via `onConnectWallet` prop

**Example wagmi config for multi-chain support:**
```typescript
import { http, createConfig } from 'wagmi';
import { mainnet, base, arbitrum, optimism } from 'wagmi/chains';

const config = createConfig({
  chains: [mainnet, base, arbitrum, optimism],
  transports: {
    // Use default public RPCs or provide custom URLs for reliability
    [mainnet.id]: http(), // or http('https://eth.llamarpc.com')
    [base.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
  },
});
```

**Wallet Connection (RainbowKit example):**
```tsx
import { useConnectModal } from '@rainbow-me/rainbowkit';

function App() {
  const { openConnectModal } = useConnectModal();
  return <BridgeWidget onConnectWallet={openConnectModal} />;
}
```

The widget fully integrates Circle's Bridge Kit for cross-chain USDC transfers. The `useBridge` hook handles:
- Wallet provider detection and validation
- Event-driven status updates (approving, burning, fetching-attestation, minting)
- Proper cleanup of event listeners on unmount or error

Supported chains are pre-configured with USDC and TokenMessenger addresses in `USDC_ADDRESSES` and `TOKEN_MESSENGER_ADDRESSES` constants. The widget uses CCTP V2 which has a single `TOKEN_MESSENGER_V2_ADDRESS` across all chains. Legacy V1 addresses are preserved in `TOKEN_MESSENGER_V1_ADDRESSES` for reference.

### Theme System

The theme supports customization of:
- Colors: primary, secondary, background, cardBackground, text, mutedText, border, success, error, hover
- Sizing: borderRadius
- Typography: fontFamily

Pre-built presets available: `dark` (default), `light`, `blue`, `green`

### UI Customization

- `borderless` prop: Removes all borders, shadows, and backgrounds for seamless integration
- Balance display is hidden when wallet is not connected (improved UX)
- Loading states only show when wallet is connected and query is running

### Deprecation Notes

- `useBridgeEstimate` - Deprecated, use `useBridgeQuote` from `useBridge.ts` instead
- `useFormatNumber` - Deprecated, use `formatNumber` utility function directly
