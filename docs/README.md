# USDC Bridge Widget Documentation

## Overview

This documentation covers the architecture and implementation details of the USDC Bridge Widget - a React component library for cross-chain USDC transfers using Circle's CCTP (Cross-Chain Transfer Protocol).

## Documentation Structure

- `edit-history/` - Daily session logs tracking changes made to the codebase

## Quick Links

- [Main README](../README.md) - Installation, usage, and API reference
- [CLAUDE.md](../CLAUDE.md) - Development guidelines and architecture overview

## Integration Requirements

### Wagmi Configuration

The widget uses wagmi hooks and requires the parent app to provide a properly configured `WagmiProvider`. Key requirements:

1. **Multi-chain transports**: For balance fetching to work across all chains, your wagmi config must include transports for ALL chains displayed in the widget
2. **No auto-connect**: The widget does NOT auto-connect wallets - you must provide the `onConnectWallet` callback

```typescript
// Example wagmi config
import { http, createConfig } from 'wagmi';
import { mainnet, base, arbitrum, optimism } from 'wagmi/chains';

const config = createConfig({
  chains: [mainnet, base, arbitrum, optimism],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
  },
});
```

### Wallet Connection

The widget delegates wallet connection to the parent app. For different wallet libraries:

| Library | Integration |
|---------|-------------|
| RainbowKit | `<BridgeWidget onConnectWallet={openConnectModal} />` |
| ConnectKit | `<BridgeWidget onConnectWallet={open} />` |
| web3modal | `<BridgeWidget onConnectWallet={open} />` |

If `onConnectWallet` is not provided, a console warning will be logged when the user clicks "Connect Wallet".

## Architecture Overview

### Core Components

| File | Purpose |
|------|---------|
| `BridgeWidget.tsx` | Main widget component (~1250 lines), imports sub-components |
| `components/` | 8 extracted sub-components (ChainSelector, AmountInput, BridgeProgress, RecoveryBanner, PendingItemCard, etc.) |
| `widgetUtils.ts` | Shared helpers and constants for sub-components |
| `useBridge.ts` | Bridge execution via Circle SDK with persistence |
| `useRecovery.ts` | Recovery hook with error/success feedback |
| `useClaim.ts` | Manual USDC claim hook (paste burn tx → fetch attestation → mint) |
| `useClaimManager.ts` | Multi-claim persistence with background attestation polling |
| `usePendingTab.ts` | Unified aggregator merging bridge and claim records into `PendingItem[]` |
| `storage.ts` | SSR-safe localStorage CRUD using factory pattern for bridge and claim records |
| `hooks.ts` | Balance, allowance, and estimation hooks |
| `chains.ts` | Chain configurations and custom definitions |
| `constants.ts` | USDC addresses, TokenMessenger addresses, CCTP domain IDs |
| `utils.ts` | Validation, formatting, and provider utilities |
| `theme.ts` | Theme system and presets |
| `types.ts` | TypeScript interfaces |
| `icons.tsx` | SVG icon components |

### Data Flow

```
User Input → BridgeWidget
                ↓
         Amount Validation (utils.ts)
                ↓
         Balance Check (useUSDCBalance)
                ↓
         Allowance Check (useUSDCAllowance)
                ↓
    [If needed] Approval Transaction
                ↓
         Bridge Execution (useBridge)
                ↓
    Circle Bridge Kit SDK Events
    (approve → burn → attestation → mint)
         ↓               ↓
    BridgeProgress    localStorage (storage.ts)
    (stepper UI)      (persistence for recovery)
         ↓               ↓
    Success/Error     RecoveryBanner on next visit
    Callbacks         (useRecovery hook)
```

### Bridge Persistence & Recovery

The widget persists bridge state to localStorage so users can recover incomplete transfers after closing the tab:

1. **On burn** (point of no return): `PendingBridgeRecord` saved with partial `BridgeResult`
2. **During attestation/mint**: Steps progressively updated in persisted record
3. **On success**: Record removed, green success banner shown (auto-clears after 8s)
4. **On error**: Record kept as `"recovery-pending"` with user-friendly error message per-bridge
5. **On next page load**: `useRecovery` detects pending records, shows `RecoveryBanner`
6. **Resume**: Calls `kit.retry(record.bridgeResult, context)` to continue from last step

**Recovery feedback:**
- `lastSuccess`: Brief success message, auto-clears after 8 seconds
- `lastError`: Per-bridge error with `{ bridgeId, message }` — only shown on the matching banner
- `formatRecoveryError()` maps SDK errors to user-friendly messages (rejection, timeout, simulation failure)

**Props:**
- `enablePersistence` (default: `true`) - Toggle localStorage persistence
- `onPendingBridgeDetected` - Fires when incomplete bridges found
- `onRecoveryComplete` / `onRecoveryError` - Recovery lifecycle callbacks

### Manual Claim (Claim Tab)

The Claim tab allows users to manually recover USDC from CCTP burn transactions. Useful when:
- The bridge UI was closed before the mint step completed
- A third-party bridge produced a CCTP burn transaction
- The automatic recovery didn't work

**Flow:** Paste burn tx hash → parse CCTP message → poll attestation → switch chain → call `receiveMessage()` → USDC minted

**Hooks:**
- `useClaim(options)` — Single claim state machine: `idle → fetching-attestation → switching-chain → claiming → confirming → success`
- `useClaimManager(options)` — Manages multiple persisted claims with background attestation polling
- `usePendingTab(options)` — Aggregates bridge and claim records into unified `PendingItem[]` for the Pending tab

**CCTP message parsing:**
- V1: 116-byte header (8-byte nonce), version `0x00000000`
- V2: 148-byte header (32-byte nonce + finality fields), version `0x00000001`

### Storage Architecture

Both bridge and claim records use a shared `createStorageAdapter<TRecord>()` factory:

| Config | Bridge | Claim |
|--------|--------|-------|
| Prefix | `usdc_bridge_tx_` | `usdc_claim_tx_` |
| Index key | `usdc_bridge_index` | `usdc_claim_index` |
| Max records | 50 | 50 |
| Stale threshold | 7 days | 7 days |

Each adapter provides: `save`, `update`, `loadById`, `loadByWallet`, `remove`, `cleanupStale`

### Theme System

The widget supports full theme customization:

```typescript
interface BridgeWidgetTheme {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  cardBackgroundColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  borderColor?: string;
  successColor?: string;
  errorColor?: string;
  hoverColor?: string;
  borderRadius?: number;
  fontFamily?: string;
}
```

Pre-built presets: `dark`, `light`, `blue`, `green`

### Supported Chains

The widget supports 17 CCTP V2 EVM chains:

| Chain | ID | Status |
|-------|-----|--------|
| Ethereum | 1 | Active |
| Arbitrum | 42161 | Active |
| Base | 8453 | Active |
| Optimism | 10 | Active |
| Polygon | 137 | Active |
| Avalanche | 43114 | Active |
| Linea | 59144 | Active |
| Unichain | 130 | Active |
| Sonic | 146 | Active |
| World Chain | 480 | Active |
| Monad | 10200 | Defined (SDK pending) |
| Sei | 1329 | Active |
| XDC | 50 | Active |
| HyperEVM | 999 | Active |
| Ink | 57073 | Active |
| Plume | 98866 | Active |
| Codex | 81224 | Active |

### Testnet Support

Testnet configurations available for development:
- Sepolia
- Arbitrum Sepolia
- Avalanche Fuji
- Base Sepolia
- Optimism Sepolia
- Polygon Amoy

## Development

See [CLAUDE.md](../CLAUDE.md) for build commands and development setup.
