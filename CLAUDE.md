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
- `src/BridgeWidget.tsx` - Main widget component (~1250 lines), imports sub-components from `components/`
- `src/hooks.ts` - React hooks for USDC balance, allowance, and deprecated bridge estimation
- `src/useBridge.ts` - Bridge execution hook using Circle's Bridge Kit SDK with event handling and persistence
- `src/useRecovery.ts` - Recovery hook for resuming incomplete bridge transfers (error/success feedback)
- `src/useClaim.ts` - Manual USDC claim hook (paste burn tx hash → fetch attestation → call receiveMessage)
- `src/useClaimManager.ts` - Multi-claim persistence manager with background attestation polling
- `src/usePendingTab.ts` - Unified aggregator merging bridge and claim records into `PendingItem[]`
- `src/storage.ts` - SSR-safe localStorage CRUD using factory pattern for bridge and claim records
- `src/widgetUtils.ts` - Shared helpers (getBorderlessStyles, getChainNameFromConfigs) and constants for sub-components
- `src/types.ts` - TypeScript interfaces for props, theme, chain configs, and claim state
- `src/chains.ts` - Chain configurations, custom chain definitions, and testnet support
- `src/constants.ts` - USDC addresses, TokenMessenger addresses, CCTP domain IDs, chain icons, and constants
- `src/utils.ts` - Utility functions (formatNumber, validateAmountInput, validateChainConfigs, isEIP1193Provider, toHexString, getErrorMessage, ensureHexPrefix)
- `src/theme.ts` - Theme system with presets (dark, light, blue, green)
- `src/icons.tsx` - SVG icon components (ChevronDown, Swap, Spinner, Check, Error, ExternalLink, Wallet, Warning, Search)
- `src/components/` - Extracted sub-components:
  - `ChainIcon.tsx` - Chain logo with fallback initial letter
  - `BalanceSpinner.tsx` - CSS keyframe-injected loading spinner
  - `ChainSelector.tsx` - Dropdown with search, balance display, keyboard navigation
  - `SwapButton.tsx` - Source/destination swap button
  - `AmountInput.tsx` - Amount input with max button and validation
  - `BridgeProgress.tsx` - 4-step stepper (Approve→Burn→Attestation→Mint)
  - `RecoveryBanner.tsx` - Banner for pending bridge recovery with error/success feedback
  - `PendingItemCard.tsx` - Card for individual pending items with actions and tx hash copy
- `src/__tests__/` - Test files for all modules (356 tests across 13 files)

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
import { useAccount } from 'wagmi';

function App() {
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useAccount();

  const handleConnectWallet = () => {
    if (!isConnected) {
      openConnectModal?.();
    }
  };

  return <BridgeWidget onConnectWallet={handleConnectWallet} />;
}
```

**Reconnection Handling:**
- Widget detects `reconnecting` and `connecting` states from wagmi
- Shows "Connecting..." button text during reconnection (prevents UI flicker)
- Prevents `onConnectWallet` callback from being called during reconnection
- Uses `useAccountEffect` for connection/disconnection events
- On disconnect: clears form state (amount, error, txHash) and resets bridge

The widget fully integrates Circle's Bridge Kit for cross-chain USDC transfers. The `useBridge` hook handles:
- Wallet provider detection and validation
- Event-driven status updates (approving, burning, fetching-attestation, minting)
- Proper cleanup of event listeners on unmount or error
- Optional localStorage persistence of in-progress bridge state for recovery

### Bridge Persistence & Recovery

The widget persists bridge state to localStorage so users can recover incomplete transfers (e.g., after closing tab during attestation). This feature is enabled by default (`enablePersistence` prop).

**How it works:**
1. After the burn transaction (point of no return), a `PendingBridgeRecord` is saved to localStorage
2. Event handlers progressively update the `bridgeResult.steps` array as each step completes
3. On success, the record is removed. On error, the record is kept with `recovery-pending` status
4. On next page load, `useRecovery` detects pending records and shows a `RecoveryBanner`
5. User can click "Resume" which calls `kit.retry(record.bridgeResult, { from: adapter, to: adapter })`

**Storage details:**
- Key format: `usdc_bridge_tx_{uuid}` with index at `usdc_bridge_index`
- Claim records: `usdc_claim_tx_{uuid}` with index at `usdc_claim_index`
- Both use a shared `createStorageAdapter()` factory (DRY pattern)
- Max 50 records per type (oldest evicted when exceeded)
- Stale records (>7 days) are cleaned up automatically
- SSR-safe: all localStorage access is guarded with `typeof window` checks

**Widget props for persistence:**
- `enablePersistence?: boolean` (default: true)
- `onPendingBridgeDetected?: (bridges: PendingBridgeRecord[]) => void`
- `onRecoveryComplete?: (params: { sourceChainId, destChainId, amount, txHash? }) => void`
- `onRecoveryError?: (error: Error) => void`

**Recovery feedback:**
- `useRecovery` provides `lastError` (per-bridge, `{ bridgeId, message }`) and `lastSuccess` (auto-clears after 8s)
- `formatRecoveryError()` maps SDK errors to user-friendly messages (rejection, timeout, simulation failure)
- `RecoveryBanner` shows green success banner or per-bridge error inline

**Advanced consumers** can import storage utilities directly:
```typescript
import { savePendingBridge, loadPendingBridges, useRecovery } from '@hongming-wang/usdc-bridge-widget';
```

### Manual Claim (Claim Tab)

The widget includes a Claim tab for manually recovering USDC from completed CCTP burns. This is useful when the bridge UI was closed before the mint step, or when using third-party bridges that produce CCTP burn transactions.

**How it works:**
1. User pastes a burn transaction hash from the source chain
2. `useClaim` fetches the CCTP message from the transaction and parses it (V1/V2 format)
3. Polls Circle's Iris API for the attestation signature
4. Switches wallet to destination chain if needed
5. Calls `receiveMessage()` on the MessageTransmitter contract to mint USDC

**Hooks:**
- `useClaim(options)` - Single claim execution with state machine
- `useClaimManager(options)` - Multi-claim persistence with background attestation polling
- `usePendingTab(options)` - Aggregates bridge and claim records into unified `PendingItem[]`

**CCTP V1/V2 message parsing:**
- Version detected from first 4 bytes of message
- V1: 116-byte header (8-byte nonce)
- V2: 148-byte header (32-byte nonce + `minFinalityThreshold` + `finalityLevel`)

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

### Balance Query Configuration

The `useAllUSDCBalances` hook uses optimized react-query settings:
- `enabled`: Only runs when address exists, isConnected is true, and contracts are configured
- `refetchOnWindowFocus: true`: Refreshes balances when user returns to tab
- `refetchOnReconnect: true`: Refreshes balances on network reconnection
- `staleTime: 5000`: Prevents excessive refetches while keeping data fresh

### Deprecation Notes

- `useBridgeEstimate` - Deprecated, use `useBridgeQuote` from `useBridge.ts` instead
- `useFormatNumber` - Deprecated, use `formatNumber` utility function directly
