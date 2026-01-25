import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFormatNumber, useAllUSDCBalances } from "../hooks";
import type { BridgeChainConfig } from "../types";

// Create mock functions
const mockUseReadContracts = vi.fn();

// Mock wagmi hooks
vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({ address: "0x1234567890123456789012345678901234567890" })),
  useReadContract: vi.fn(() => ({
    data: 1000000000n,
    isLoading: false,
    refetch: vi.fn(),
  })),
  useReadContracts: () => mockUseReadContracts(),
  useWriteContract: vi.fn(() => ({
    writeContractAsync: vi.fn(),
    isPending: false,
  })),
  useWaitForTransactionReceipt: vi.fn(() => ({
    isLoading: false,
    isSuccess: false,
  })),
}));

describe("useFormatNumber", () => {
  it("returns a formatting function", () => {
    const { result } = renderHook(() => useFormatNumber());
    expect(typeof result.current).toBe("function");
  });

  it("formats numbers correctly", () => {
    const { result } = renderHook(() => useFormatNumber());
    expect(result.current(1000, 2)).toBe("1,000.00");
  });

  it("returns stable function reference", () => {
    const { result, rerender } = renderHook(() => useFormatNumber());
    const firstRef = result.current;
    rerender();
    expect(result.current).toBe(firstRef);
  });
});

describe("useAllUSDCBalances", () => {
  const mockChainConfigs: BridgeChainConfig[] = [
    {
      chain: { id: 1, name: "Ethereum" } as BridgeChainConfig["chain"],
      usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
    {
      chain: { id: 8453, name: "Base" } as BridgeChainConfig["chain"],
      usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReadContracts.mockReturnValue({
      data: [
        { status: "success", result: 1000000000n },
        { status: "success", result: 500000000n },
      ],
      isLoading: false,
      refetch: vi.fn(),
    });
  });

  it("returns balances for all chains", () => {
    const { result } = renderHook(() => useAllUSDCBalances(mockChainConfigs));

    expect(result.current.balances[1]).toBeDefined();
    expect(result.current.balances[8453]).toBeDefined();
    expect(result.current.balances[1].balance).toBe(1000000000n);
    expect(result.current.balances[8453].balance).toBe(500000000n);
  });

  it("formats balances correctly", () => {
    const { result } = renderHook(() => useAllUSDCBalances(mockChainConfigs));

    expect(result.current.balances[1].formatted).toBe("1000");
    expect(result.current.balances[8453].formatted).toBe("500");
  });

  it("returns loading state", () => {
    mockUseReadContracts.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useAllUSDCBalances(mockChainConfigs));
    expect(result.current.isLoading).toBe(true);
  });

  it("handles empty results", () => {
    mockUseReadContracts.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useAllUSDCBalances(mockChainConfigs));
    expect(result.current.balances).toEqual({});
  });

  it("handles failed contract calls", () => {
    mockUseReadContracts.mockReturnValue({
      data: [
        { status: "failure", error: new Error("Failed") },
        { status: "success", result: 500000000n },
      ],
      isLoading: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useAllUSDCBalances(mockChainConfigs));

    // Failed call should return 0
    expect(result.current.balances[1].balance).toBe(0n);
    expect(result.current.balances[1].formatted).toBe("0");
    // Successful call should work
    expect(result.current.balances[8453].balance).toBe(500000000n);
  });
});
