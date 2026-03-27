import { USDC_DECIMALS, MAX_USDC_AMOUNT, DEFAULT_LOCALE } from "./constants";
import { parseUnits, isAddress, createPublicClient, http } from "viem";
import type { Chain, PublicClient, EIP1193Provider } from "viem";
import type { Config } from "wagmi";
import { getPublicClient as getWagmiPublicClient } from "wagmi/actions";
import type { BridgeChainConfig } from "./types";

export { type EIP1193Provider } from "viem";

// Re-export amount constants for backwards compatibility
export { MAX_USDC_AMOUNT, MIN_USDC_AMOUNT } from "./constants";

/**
 * JSON.stringify replacer that converts BigInt values to strings.
 * Bridge Kit SDK may return BigInt values that crash standard JSON.stringify.
 */
export const bigIntReplacer = (_key: string, value: unknown): unknown =>
  typeof value === "bigint" ? value.toString() : value;

/**
 * Format a number for display with locale-aware formatting
 *
 * @param value - The number or string to format
 * @param decimals - Number of decimal places (default: 2)
 * @param locale - Optional locale string (e.g., 'en-US', 'de-DE'). Defaults to 'en-US' for consistent financial display.
 * @returns Formatted number string
 *
 * @example
 * formatNumber(1234.567) // "1,234.57"
 * formatNumber(1234.567, 4) // "1,234.5670"
 * formatNumber(1234.567, 2, 'de-DE') // "1.234,57"
 */
export function formatNumber(
  value: string | number,
  decimals: number = 2,
  locale: string = DEFAULT_LOCALE,
): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return num.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Validate and sanitize an amount input string.
 * Ensures the value is a valid positive decimal with max 6 decimal places.
 *
 * @param value - The input string to validate
 * @returns Object with isValid flag and sanitized value
 */
export function validateAmountInput(value: string): {
  isValid: boolean;
  sanitized: string;
  error?: string;
} {
  // Empty is valid (user clearing input)
  if (value === "") {
    return { isValid: true, sanitized: "" };
  }

  // Reject scientific notation
  if (/[eE]/.test(value)) {
    return {
      isValid: false,
      sanitized: "",
      error: "Scientific notation not allowed",
    };
  }

  // Reject negative signs
  if (value.includes("-")) {
    return {
      isValid: false,
      sanitized: "",
      error: "Negative values not allowed",
    };
  }

  // Allow partial input like "." or "0."
  if (value === "." || value === "0.") {
    return { isValid: true, sanitized: value };
  }

  // Check for valid decimal format
  if (!/^[0-9]*\.?[0-9]*$/.test(value)) {
    return { isValid: false, sanitized: "", error: "Invalid characters" };
  }

  // Check decimal places (max 6 for USDC)
  const parts = value.split(".");
  if (parts.length === 2 && parts[1].length > USDC_DECIMALS) {
    return {
      isValid: false,
      sanitized: `${parts[0]}.${parts[1].slice(0, USDC_DECIMALS)}`,
      error: `Maximum ${USDC_DECIMALS} decimal places`,
    };
  }

  // Check max value
  const num = parseFloat(value);
  if (!isNaN(num) && num > parseFloat(MAX_USDC_AMOUNT)) {
    return {
      isValid: false,
      sanitized: value,
      error: "Amount exceeds maximum",
    };
  }

  // Sanitize leading zeros (except for "0." case)
  let sanitized = value;
  if (
    sanitized.length > 1 &&
    sanitized.startsWith("0") &&
    sanitized[1] !== "."
  ) {
    sanitized = sanitized.replace(/^0+/, "") || "0";
  }

  return { isValid: true, sanitized };
}

/**
 * Safely parse a USDC amount string to bigint
 * Returns null if parsing fails
 */
export function parseUSDCAmount(amount: string): bigint | null {
  try {
    if (!amount || parseFloat(amount) < 0) return null;
    return parseUnits(amount, USDC_DECIMALS);
  } catch {
    return null;
  }
}

/**
 * Check if a string is a valid positive number
 */
export function isValidPositiveAmount(amount: string): boolean {
  if (!amount) return false;
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "An unknown error occurred";
}

/**
 * Validation result for chain config
 */
export interface ChainConfigValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate a single chain configuration.
 * Checks that required fields are present and addresses are valid.
 *
 * @param config - The chain configuration to validate
 * @returns Validation result with errors if any
 */
export function validateChainConfig(
  config: BridgeChainConfig,
): ChainConfigValidationResult {
  const errors: string[] = [];

  // Check required chain object
  if (!config.chain) {
    errors.push("Chain object is required");
    return { isValid: false, errors };
  }

  // Check chain ID
  if (typeof config.chain.id !== "number" || config.chain.id <= 0) {
    errors.push(`Invalid chain ID: ${config.chain.id}`);
  }

  // Check chain name
  if (!config.chain.name || typeof config.chain.name !== "string") {
    errors.push("Chain name is required");
  }

  // Check USDC address
  if (!config.usdcAddress) {
    errors.push(
      `USDC address is required for chain ${config.chain.name || config.chain.id}`,
    );
  } else if (!isAddress(config.usdcAddress)) {
    errors.push(
      `Invalid USDC address for chain ${config.chain.name}: ${config.usdcAddress}`,
    );
  }

  // Check TokenMessenger address (optional but validate if provided)
  if (
    config.tokenMessengerAddress &&
    !isAddress(config.tokenMessengerAddress)
  ) {
    errors.push(
      `Invalid TokenMessenger address for chain ${config.chain.name}: ${config.tokenMessengerAddress}`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Type guard for EIP-1193 compatible wallet providers.
 * Checks that the value is an object with a `request` function.
 */
export function isEIP1193Provider(
  provider: unknown,
): provider is EIP1193Provider {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "request" in provider &&
    typeof (provider as EIP1193Provider).request === "function"
  );
}

/**
 * Safely cast a string to a hex-prefixed address/hash type.
 * Returns undefined if the string doesn't start with "0x".
 */
export function toHexString(
  value: string | undefined,
): `0x${string}` | undefined {
  if (typeof value === "string" && value.startsWith("0x")) {
    return value as `0x${string}`;
  }
  return undefined;
}

/**
 * Validate an array of chain configurations.
 * Returns the first error found or success if all configs are valid.
 *
 * @param configs - Array of chain configurations to validate
 * @returns Validation result with all errors
 */
export function validateChainConfigs(
  configs: BridgeChainConfig[],
): ChainConfigValidationResult {
  const allErrors: string[] = [];

  if (!Array.isArray(configs)) {
    return { isValid: false, errors: ["Chain configs must be an array"] };
  }

  if (configs.length === 0) {
    return {
      isValid: false,
      errors: ["At least one chain configuration is required"],
    };
  }

  if (configs.length < 2) {
    return {
      isValid: false,
      errors: ["At least two chains are required for bridging"],
    };
  }

  // Check for duplicate chain IDs
  const chainIds = new Set<number>();
  for (const config of configs) {
    if (config.chain?.id) {
      if (chainIds.has(config.chain.id)) {
        allErrors.push(`Duplicate chain ID: ${config.chain.id}`);
      }
      chainIds.add(config.chain.id);
    }

    const result = validateChainConfig(config);
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Ensure a hex string has a 0x prefix.
 * Returns the input as a `0x${string}` type for use with viem/wagmi.
 */
export function ensureHexPrefix(hex: string): `0x${string}` {
  return (hex.startsWith("0x") ? hex : `0x${hex}`) as `0x${string}`;
}

/**
 * Create a `getPublicClient` callback for the Circle Bridge Kit adapter.
 *
 * Returns a function that resolves a viem `PublicClient` for a given chain
 * by first trying the parent app's wagmi config (which has the user's custom
 * RPC transports), then falling back to a default client using the chain's
 * built-in public RPC.
 *
 * @param wagmiConfig - The wagmi config from `useConfig()`
 */
export function createPublicClientGetter(
  wagmiConfig: Config,
): (params: { chain: Chain }) => PublicClient {
  return ({ chain }: { chain: Chain }): PublicClient => {
    try {
      const client = getWagmiPublicClient(wagmiConfig, { chainId: chain.id });
      if (client) return client as PublicClient;
    } catch {
      // wagmi config doesn't have a transport for this chain
    }
    // Fallback: create a client using the chain's default RPC
    return createPublicClient({ chain, transport: http() }) as PublicClient;
  };
}
