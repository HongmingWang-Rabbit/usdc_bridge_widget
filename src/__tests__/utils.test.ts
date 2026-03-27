import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatNumber,
  parseUSDCAmount,
  isValidPositiveAmount,
  getErrorMessage,
  isEIP1193Provider,
  toHexString,
  validateAmountInput,
  validateChainConfig,
  validateChainConfigs,
  ensureHexPrefix,
  createPublicClientGetter,
  MAX_USDC_AMOUNT,
} from "../utils";
import type { BridgeChainConfig } from "../types";
import { getPublicClient } from "wagmi/actions";
import type { Config } from "wagmi";

vi.mock("wagmi/actions", () => ({
  getPublicClient: vi.fn(),
}));

const mockGetPublicClient = vi.mocked(getPublicClient);

describe("formatNumber", () => {
  it("formats integers with decimal places", () => {
    expect(formatNumber(1000)).toBe("1,000.00");
  });

  it("formats decimal numbers", () => {
    expect(formatNumber(1234.567, 2)).toBe("1,234.57");
  });

  it("formats string numbers", () => {
    expect(formatNumber("1000.5", 2)).toBe("1,000.50");
  });

  it("returns '0' for NaN", () => {
    expect(formatNumber("invalid")).toBe("0");
    expect(formatNumber(NaN)).toBe("0");
  });

  it("respects custom decimal places", () => {
    expect(formatNumber(1234.56789, 4)).toBe("1,234.5679");
    expect(formatNumber(1234.5, 0)).toBe("1,235");
  });

  it("handles zero correctly", () => {
    expect(formatNumber(0)).toBe("0.00");
    expect(formatNumber("0")).toBe("0.00");
  });
});

describe("parseUSDCAmount", () => {
  it("parses valid amount strings", () => {
    expect(parseUSDCAmount("100")).toBe(100000000n);
    expect(parseUSDCAmount("1.5")).toBe(1500000n);
    expect(parseUSDCAmount("0.000001")).toBe(1n);
  });

  it("returns null for empty string", () => {
    expect(parseUSDCAmount("")).toBe(null);
  });

  it("returns null for negative amounts", () => {
    expect(parseUSDCAmount("-100")).toBe(null);
  });

  it("returns null for invalid strings", () => {
    expect(parseUSDCAmount("abc")).toBe(null);
    expect(parseUSDCAmount("1.2.3")).toBe(null);
  });

  it("handles zero", () => {
    expect(parseUSDCAmount("0")).toBe(0n);
  });
});

describe("isValidPositiveAmount", () => {
  it("returns true for positive numbers", () => {
    expect(isValidPositiveAmount("100")).toBe(true);
    expect(isValidPositiveAmount("0.001")).toBe(true);
  });

  it("returns false for zero", () => {
    expect(isValidPositiveAmount("0")).toBe(false);
  });

  it("returns false for negative numbers", () => {
    expect(isValidPositiveAmount("-100")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidPositiveAmount("")).toBe(false);
  });

  it("returns false for invalid strings", () => {
    expect(isValidPositiveAmount("abc")).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("extracts message from Error objects", () => {
    expect(getErrorMessage(new Error("Test error"))).toBe("Test error");
  });

  it("returns string errors as-is", () => {
    expect(getErrorMessage("String error")).toBe("String error");
  });

  it("extracts message from error-like objects", () => {
    expect(getErrorMessage({ message: "Object error" })).toBe("Object error");
  });

  it("returns default message for unknown errors", () => {
    expect(getErrorMessage(null)).toBe("An unknown error occurred");
    expect(getErrorMessage(undefined)).toBe("An unknown error occurred");
    expect(getErrorMessage(123)).toBe("An unknown error occurred");
  });
});

describe("validateAmountInput", () => {
  it("accepts empty string", () => {
    const result = validateAmountInput("");
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe("");
  });

  it("accepts valid decimal numbers", () => {
    expect(validateAmountInput("100").isValid).toBe(true);
    expect(validateAmountInput("100.50").isValid).toBe(true);
    expect(validateAmountInput("0.000001").isValid).toBe(true);
  });

  it("rejects scientific notation", () => {
    const result = validateAmountInput("1e6");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Scientific notation not allowed");
  });

  it("rejects negative values", () => {
    const result = validateAmountInput("-100");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Negative values not allowed");
  });

  it("accepts partial input like '.' and '0.'", () => {
    expect(validateAmountInput(".").isValid).toBe(true);
    expect(validateAmountInput("0.").isValid).toBe(true);
  });

  it("truncates to max 6 decimal places", () => {
    const result = validateAmountInput("1.12345678");
    expect(result.isValid).toBe(false);
    expect(result.sanitized).toBe("1.123456");
    expect(result.error).toBe("Maximum 6 decimal places");
  });

  it("removes leading zeros", () => {
    const result = validateAmountInput("007");
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe("7");
  });

  it("preserves 0. prefix", () => {
    const result = validateAmountInput("0.5");
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe("0.5");
  });
});

describe("validateChainConfig", () => {
  const validConfig: BridgeChainConfig = {
    chain: { id: 1, name: "Ethereum" } as BridgeChainConfig["chain"],
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    tokenMessengerAddress: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
  };

  it("accepts valid chain config", () => {
    const result = validateChainConfig(validConfig);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing chain object", () => {
    const result = validateChainConfig({
      chain: undefined as unknown as BridgeChainConfig["chain"],
      usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Chain object is required");
  });

  it("rejects invalid chain ID", () => {
    const result = validateChainConfig({
      ...validConfig,
      chain: { id: -1, name: "Test" } as BridgeChainConfig["chain"],
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid chain ID"))).toBe(true);
  });

  it("rejects missing USDC address", () => {
    const result = validateChainConfig({
      chain: { id: 1, name: "Ethereum" } as BridgeChainConfig["chain"],
      usdcAddress: "" as `0x${string}`,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("USDC address is required"))).toBe(true);
  });

  it("rejects invalid USDC address format", () => {
    const result = validateChainConfig({
      ...validConfig,
      usdcAddress: "invalid-address" as `0x${string}`,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid USDC address"))).toBe(true);
  });
});

describe("validateChainConfigs", () => {
  const validConfigs: BridgeChainConfig[] = [
    {
      chain: { id: 1, name: "Ethereum" } as BridgeChainConfig["chain"],
      usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
    {
      chain: { id: 8453, name: "Base" } as BridgeChainConfig["chain"],
      usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
  ];

  it("accepts valid chain configs array", () => {
    const result = validateChainConfigs(validConfigs);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects non-array input", () => {
    const result = validateChainConfigs("not an array" as unknown as BridgeChainConfig[]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Chain configs must be an array");
  });

  it("rejects empty array", () => {
    const result = validateChainConfigs([]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("At least one chain configuration is required");
  });

  it("rejects single chain (need at least 2 for bridging)", () => {
    const result = validateChainConfigs([validConfigs[0]]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("At least two chains are required for bridging");
  });

  it("rejects duplicate chain IDs", () => {
    const result = validateChainConfigs([
      validConfigs[0],
      { ...validConfigs[0] }, // Same chain ID
    ]);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate chain ID"))).toBe(true);
  });
});

describe("isEIP1193Provider", () => {
  it("returns true for valid EIP-1193 provider", () => {
    const provider = { request: async () => {} };
    expect(isEIP1193Provider(provider)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isEIP1193Provider(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isEIP1193Provider(undefined)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isEIP1193Provider("string")).toBe(false);
    expect(isEIP1193Provider(123)).toBe(false);
  });

  it("returns false for object without request", () => {
    expect(isEIP1193Provider({ foo: "bar" })).toBe(false);
  });

  it("returns false for object with non-function request", () => {
    expect(isEIP1193Provider({ request: "not a function" })).toBe(false);
  });
});

describe("toHexString", () => {
  it("returns the value as hex type when it starts with 0x", () => {
    expect(toHexString("0xabc123")).toBe("0xabc123");
  });

  it("returns undefined for strings without 0x prefix", () => {
    expect(toHexString("abc123")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(toHexString(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(toHexString("")).toBeUndefined();
  });

  it("handles 0x alone", () => {
    expect(toHexString("0x")).toBe("0x");
  });
});

describe("ensureHexPrefix", () => {
  it("returns input unchanged when it already has 0x prefix", () => {
    expect(ensureHexPrefix("0xabc123")).toBe("0xabc123");
  });

  it("adds 0x prefix when missing", () => {
    expect(ensureHexPrefix("abc123")).toBe("0xabc123");
  });

  it("handles empty string", () => {
    expect(ensureHexPrefix("")).toBe("0x");
  });

  it("does not double-prefix", () => {
    expect(ensureHexPrefix("0x0xabc")).toBe("0x0xabc");
  });
});

describe("createPublicClientGetter", () => {
  const mockConfig = {} as Config;
  const mockChain = { id: 1, name: "Ethereum" } as import("viem").Chain;
  // A chain with rpcUrls for fallback tests (viem's createPublicClient needs this)
  const chainWithRpc = {
    id: 1329,
    name: "Sei",
    nativeCurrency: { name: "Sei", symbol: "SEI", decimals: 18 },
    rpcUrls: { default: { http: ["https://evm-rpc.sei-apis.com"] } },
  } as import("viem").Chain;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a function", () => {
    const getter = createPublicClientGetter(mockConfig);
    expect(typeof getter).toBe("function");
  });

  it("delegates to wagmi getPublicClient when transport is configured", () => {
    const mockClient = { type: "publicClient" };
    mockGetPublicClient.mockReturnValue(mockClient as never);

    const getter = createPublicClientGetter(mockConfig);
    const result = getter({ chain: mockChain });

    expect(mockGetPublicClient).toHaveBeenCalledWith(mockConfig, { chainId: 1 });
    expect(result).toBe(mockClient);
  });

  it("falls back to a default public client when wagmi throws", () => {
    mockGetPublicClient.mockImplementation(() => {
      throw new Error("No transport configured for chain 1329");
    });

    const getter = createPublicClientGetter(mockConfig);
    const result = getter({ chain: chainWithRpc });

    // Should return a PublicClient (not throw or return undefined)
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });

  it("falls back when wagmi returns undefined", () => {
    mockGetPublicClient.mockReturnValue(undefined as never);

    const getter = createPublicClientGetter(mockConfig);
    const result = getter({ chain: chainWithRpc });

    // Should return a fallback client, not undefined
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });
});
