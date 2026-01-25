# USDC Bridge Widget Documentation

## Overview

This documentation covers the architecture and implementation details of the USDC Bridge Widget - a React component library for cross-chain USDC transfers using Circle's CCTP (Cross-Chain Transfer Protocol).

## Documentation Structure

- `edit-history/` - Daily session logs tracking changes made to the codebase

## Quick Links

- [Main README](../README.md) - Installation, usage, and API reference
- [CLAUDE.md](../CLAUDE.md) - Development guidelines and architecture overview

## Architecture Overview

### Core Components

| File | Purpose |
|------|---------|
| `BridgeWidget.tsx` | Main widget component with UI |
| `useBridge.ts` | Bridge execution via Circle SDK |
| `hooks.ts` | Balance, allowance, and estimation hooks |
| `chains.ts` | Chain configurations and custom definitions |
| `constants.ts` | USDC addresses, TokenMessenger addresses |
| `utils.ts` | Validation and formatting utilities |
| `theme.ts` | Theme system and presets |
| `types.ts` | TypeScript interfaces |

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
                ↓
         Success/Error Callbacks
```

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

The widget supports 16 CCTP V2 EVM chains:

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
