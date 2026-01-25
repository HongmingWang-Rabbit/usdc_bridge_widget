import { USDC_DECIMALS, MAX_USDC_AMOUNT, DEFAULT_LOCALE } from "./constants";
import { parseUnits, isAddress } from "viem";
import type { BridgeChainConfig } from "./types";

// Re-export amount constants for backwards compatibility
export { MAX_USDC_AMOUNT, MIN_USDC_AMOUNT } from "./constants";

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
  locale: string = DEFAULT_LOCALE
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
    return { isValid: false, sanitized: "", error: "Scientific notation not allowed" };
  }

  // Reject negative signs
  if (value.includes("-")) {
    return { isValid: false, sanitized: "", error: "Negative values not allowed" };
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
    return { isValid: false, sanitized: value, error: "Amount exceeds maximum" };
  }

  // Sanitize leading zeros (except for "0." case)
  let sanitized = value;
  if (sanitized.length > 1 && sanitized.startsWith("0") && sanitized[1] !== ".") {
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
  config: BridgeChainConfig
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
    errors.push(`USDC address is required for chain ${config.chain.name || config.chain.id}`);
  } else if (!isAddress(config.usdcAddress)) {
    errors.push(`Invalid USDC address for chain ${config.chain.name}: ${config.usdcAddress}`);
  }

  // Check TokenMessenger address (optional but validate if provided)
  if (config.tokenMessengerAddress && !isAddress(config.tokenMessengerAddress)) {
    errors.push(
      `Invalid TokenMessenger address for chain ${config.chain.name}: ${config.tokenMessengerAddress}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate an array of chain configurations.
 * Returns the first error found or success if all configs are valid.
 *
 * @param configs - Array of chain configurations to validate
 * @returns Validation result with all errors
 */
export function validateChainConfigs(
  configs: BridgeChainConfig[]
): ChainConfigValidationResult {
  const allErrors: string[] = [];

  if (!Array.isArray(configs)) {
    return { isValid: false, errors: ["Chain configs must be an array"] };
  }

  if (configs.length === 0) {
    return { isValid: false, errors: ["At least one chain configuration is required"] };
  }

  if (configs.length < 2) {
    return { isValid: false, errors: ["At least two chains are required for bridging"] };
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
