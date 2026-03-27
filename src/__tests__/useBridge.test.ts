import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBridge, useBridgeQuote, getBridgeChain, getChainName } from "../useBridge";

// Mock wagmi
vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({
    connector: {
      getProvider: vi.fn().mockResolvedValue({
        request: vi.fn(),
      }),
    },
    isConnected: true,
  })),
  useConfig: () => ({}),
}));

// Mock wagmi/actions
vi.mock("wagmi/actions", () => ({
  getPublicClient: vi.fn(),
}));

// Mock Circle Bridge Kit
vi.mock("@circle-fin/bridge-kit", () => ({
  BridgeKit: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    bridge: vi.fn().mockResolvedValue({ txHash: "0x123" }),
  })),
  BridgeChain: {
    Ethereum: "Ethereum",
    Arbitrum: "Arbitrum",
    Avalanche: "Avalanche",
    Base: "Base",
    Optimism: "Optimism",
    Polygon: "Polygon",
    Linea: "Linea",
    Unichain: "Unichain",
    Sonic: "Sonic",
    World_Chain: "World_Chain",
    Monad: "Monad",
    Sei: "Sei",
    XDC: "XDC",
    HyperEVM: "HyperEVM",
    Ink: "Ink",
    Plume: "Plume",
    Codex: "Codex",
  },
}));

// Mock adapter
vi.mock("@circle-fin/adapter-viem-v2", () => ({
  createViemAdapterFromProvider: vi.fn().mockResolvedValue({}),
}));

describe("getBridgeChain", () => {
  it("returns correct BridgeChain for known chain IDs", () => {
    expect(getBridgeChain(1)).toBe("Ethereum");
    expect(getBridgeChain(42161)).toBe("Arbitrum");
    expect(getBridgeChain(8453)).toBe("Base");
    expect(getBridgeChain(10)).toBe("Optimism");
    expect(getBridgeChain(137)).toBe("Polygon");
  });

  it("returns undefined for unknown chain IDs", () => {
    expect(getBridgeChain(99999)).toBeUndefined();
    expect(getBridgeChain(0)).toBeUndefined();
  });
});

describe("getChainName", () => {
  it("returns chain name for known chains", () => {
    expect(getChainName(1)).toBe("Ethereum");
    expect(getChainName(42161)).toBe("Arbitrum");
  });

  it("returns fallback name for unknown chains", () => {
    expect(getChainName(99999)).toBe("Chain_99999");
  });
});

describe("useBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with idle state", () => {
    const { result } = renderHook(() => useBridge());

    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.events).toEqual([]);
    expect(result.current.state.txHash).toBeUndefined();
    expect(result.current.state.error).toBeUndefined();
  });

  it("provides bridge function", () => {
    const { result } = renderHook(() => useBridge());
    expect(typeof result.current.bridge).toBe("function");
  });

  it("provides reset function", () => {
    const { result } = renderHook(() => useBridge());
    expect(typeof result.current.reset).toBe("function");
  });

  it("reset clears state back to idle", () => {
    const { result } = renderHook(() => useBridge());

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.events).toEqual([]);
  });
});

describe("useBridgeQuote", () => {
  it("returns null quote when inputs are invalid", () => {
    const { result } = renderHook(() =>
      useBridgeQuote(undefined, undefined, "")
    );

    expect(result.current.quote).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns null quote for zero amount", () => {
    const { result } = renderHook(() => useBridgeQuote(1, 8453, "0"));

    expect(result.current.quote).toBeNull();
  });

  it("returns null quote for negative amount", () => {
    const { result } = renderHook(() => useBridgeQuote(1, 8453, "-100"));

    expect(result.current.quote).toBeNull();
  });
});
