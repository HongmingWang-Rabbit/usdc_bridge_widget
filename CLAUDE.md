# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run build       # Build for production (CJS, ESM, types)
npm run dev         # Watch mode for development
npm run typecheck   # Type check without emitting
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

- `src/index.tsx` - Main exports, chain constants (USDC addresses, TokenMessenger addresses), and helper functions
- `src/BridgeWidget.tsx` - Main widget component with sub-components (ChainSelector, SwapButton, AmountInput, EstimateDisplay)
- `src/hooks.ts` - React hooks for USDC balance, allowance, and bridge estimation
- `src/types.ts` - TypeScript interfaces for props, theme, and chain configs

### Key Dependencies

The widget relies on peer dependencies that the consuming app must provide:
- `wagmi` (v2+) - Wallet connection and contract interactions
- `viem` (v2+) - Ethereum utilities and chain definitions
- `@tanstack/react-query` (v5+) - Data fetching

### Integration Notes

The widget handles USDC approval flow but requires Circle's Bridge Kit (`@circle-fin/bridge-kit`) for actual cross-chain transfers. The `handleBridge` function in BridgeWidget.tsx shows where Bridge Kit integration would occur.

Supported chains are pre-configured with USDC and TokenMessenger addresses in `USDC_ADDRESSES` and `TOKEN_MESSENGER_ADDRESSES` constants. The widget uses CCTP V2 which has a single `TOKEN_MESSENGER_V2_ADDRESS` across all chains. Legacy V1 addresses are preserved in `TOKEN_MESSENGER_V1_ADDRESSES` for reference.
