import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecovery } from "../useRecovery";

// Mock wagmi
const mockUseAccount = vi.fn();
vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}));

// Mock storage
const mockLoadPendingBridges = vi.fn();
const mockLoadPendingBridgeById = vi.fn();
const mockRemovePendingBridge = vi.fn();
const mockUpdatePendingBridge = vi.fn();
const mockCleanupStaleBridges = vi.fn();

vi.mock("../storage", () => ({
  loadPendingBridges: (...args: unknown[]) => mockLoadPendingBridges(...args),
  loadPendingBridgeById: (...args: unknown[]) => mockLoadPendingBridgeById(...args),
  removePendingBridge: (...args: unknown[]) => mockRemovePendingBridge(...args),
  updatePendingBridge: (...args: unknown[]) => mockUpdatePendingBridge(...args),
  cleanupStaleBridges: () => mockCleanupStaleBridges(),
}));

// Mock Circle Bridge Kit
const mockRetry = vi.fn();
vi.mock("@circle-fin/bridge-kit", () => ({
  BridgeKit: vi.fn().mockImplementation(() => ({
    retry: (...args: unknown[]) => mockRetry(...args),
  })),
  resolveChainIdentifier: vi.fn((chain: string) => ({ name: chain, rpc: "mock" })),
  isRetryableError: vi.fn((err: unknown) => {
    if (err instanceof Error && err.message.includes("retryable")) return true;
    return false;
  }),
}));

// Mock adapter
vi.mock("@circle-fin/adapter-viem-v2", () => ({
  createViemAdapterFromProvider: vi.fn().mockResolvedValue({}),
}));

// Mock useBridge
vi.mock("../useBridge", () => ({
  getBridgeChain: vi.fn((chainId: number) => {
    const map: Record<number, string> = { 1: "Ethereum", 8453: "Base", 1329: "Sei" };
    return map[chainId];
  }),
}));

// Mock utils — toHexString must match real behavior: returns value as-is if already 0x-prefixed
vi.mock("../utils", () => ({
  isEIP1193Provider: vi.fn(() => true),
  toHexString: vi.fn((v: string | undefined) =>
    typeof v === "string" && v.startsWith("0x") ? v : undefined
  ),
}));

// Helper to create mock bridge records
function createRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    walletAddress: "0xuser",
    sourceChainId: 1,
    destChainId: 8453,
    amount: "100",
    bridgeResult: {
      source: { address: "0x1", chain: { name: "Ethereum" } },
      destination: { address: "0x2", chain: { name: "Base" } },
      steps: [
        { name: "approve", state: "success" },
        { name: "burn", state: "success", txHash: "0xabc" },
      ],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "recovery-pending" as const,
    ...overrides,
  };
}

describe("useRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccount.mockReturnValue({
      address: "0xUser",
      isConnected: true,
      connector: {
        getProvider: vi.fn().mockResolvedValue({ request: vi.fn() }),
      },
    });
    mockLoadPendingBridges.mockReturnValue([]);
    mockLoadPendingBridgeById.mockReturnValue(null);
    mockCleanupStaleBridges.mockReturnValue(0);
  });

  describe("initialization", () => {
    it("initializes with empty state", () => {
      const { result } = renderHook(() => useRecovery());
      expect(result.current.pendingBridges).toEqual([]);
      expect(result.current.isRecovering).toBe(false);
    });

    it("loads pending bridges on mount when enabled and connected", () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);

      const { result } = renderHook(() => useRecovery());
      expect(mockCleanupStaleBridges).toHaveBeenCalled();
      expect(mockLoadPendingBridges).toHaveBeenCalledWith("0xUser");
      expect(result.current.pendingBridges).toHaveLength(1);
    });

    it("does not load bridges when disabled", () => {
      renderHook(() => useRecovery({ enabled: false }));
      expect(mockLoadPendingBridges).not.toHaveBeenCalled();
    });

    it("does not load bridges when disconnected", () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
        connector: null,
      });
      renderHook(() => useRecovery());
      expect(mockLoadPendingBridges).not.toHaveBeenCalled();
    });

    it("calls onPendingBridgeDetected when bridges are found", () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      const onPendingBridgeDetected = vi.fn();

      renderHook(() => useRecovery({ onPendingBridgeDetected }));
      expect(onPendingBridgeDetected).toHaveBeenCalledWith([record]);
    });

    it("does not call onPendingBridgeDetected when no bridges exist", () => {
      const onPendingBridgeDetected = vi.fn();
      renderHook(() => useRecovery({ onPendingBridgeDetected }));
      expect(onPendingBridgeDetected).not.toHaveBeenCalled();
    });
  });

  describe("dismissBridge", () => {
    it("removes a bridge from storage and state", () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);

      const { result } = renderHook(() => useRecovery());
      expect(result.current.pendingBridges).toHaveLength(1);

      act(() => {
        result.current.dismissBridge("rec-1");
      });

      expect(mockRemovePendingBridge).toHaveBeenCalledWith("rec-1");
      expect(result.current.pendingBridges).toHaveLength(0);
    });
  });

  describe("retryBridge", () => {
    it("reads record from storage (source of truth)", async () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      mockLoadPendingBridgeById.mockReturnValue(record);
      mockRetry.mockResolvedValue({
        steps: [
          { name: "approve", state: "noop" },
          { name: "burn", state: "noop" },
          { name: "fetchAttestation", state: "success" },
          { name: "mint", state: "success", txHash: "0xmint123" },
        ],
      });

      const { result } = renderHook(() => useRecovery());

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });

      expect(mockLoadPendingBridgeById).toHaveBeenCalledWith("rec-1");
    });

    it("does nothing if record not found in storage", async () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      mockLoadPendingBridgeById.mockReturnValue(null);

      const { result } = renderHook(() => useRecovery());

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });

      expect(mockRetry).not.toHaveBeenCalled();
    });

    it("removes record on successful retry", async () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      mockLoadPendingBridgeById.mockReturnValue(record);
      mockRetry.mockResolvedValue({
        steps: [
          { name: "approve", state: "noop" },
          { name: "burn", state: "noop" },
          { name: "fetchAttestation", state: "success" },
          { name: "mint", state: "success", txHash: "0xmint" },
        ],
      });

      const onRecoveryComplete = vi.fn();
      const { result } = renderHook(() => useRecovery({ onRecoveryComplete }));

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });

      expect(mockRemovePendingBridge).toHaveBeenCalledWith("rec-1");
      expect(onRecoveryComplete).toHaveBeenCalledWith({
        sourceChainId: 1,
        destChainId: 8453,
        amount: "100",
        txHash: "0xmint",
      });
    });

    it("keeps as recovery-pending when retry resolves but steps did not all succeed", async () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      mockLoadPendingBridgeById.mockReturnValue(record);
      mockRetry.mockResolvedValue({
        steps: [
          { name: "approve", state: "noop" },
          { name: "burn", state: "noop" },
          { name: "fetchAttestation", state: "success" },
          { name: "mint", state: "error", errorMessage: "mint step failed: Simulation failed on Base" },
        ],
      });

      const onRecoveryError = vi.fn();
      const { result } = renderHook(() => useRecovery({ onRecoveryError }));

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });

      expect(mockUpdatePendingBridge).toHaveBeenCalledWith("rec-1", {
        bridgeResult: expect.anything(),
        status: "recovery-pending",
      });
      expect(onRecoveryError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Recovery failed at mint"),
        })
      );
    });

    it("keeps as recovery-pending when a non-mint step fails", async () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      mockLoadPendingBridgeById.mockReturnValue(record);
      mockRetry.mockResolvedValue({
        steps: [
          { name: "approve", state: "noop" },
          { name: "burn", state: "error", errorMessage: "Burn tx reverted" },
        ],
      });

      const onRecoveryError = vi.fn();
      const { result } = renderHook(() => useRecovery({ onRecoveryError }));

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });

      expect(mockUpdatePendingBridge).toHaveBeenCalledWith("rec-1", {
        bridgeResult: expect.anything(),
        status: "recovery-pending",
      });
      expect(onRecoveryError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Recovery failed at burn"),
        })
      );
    });

    it("keeps as recovery-pending on non-retryable error (user can still retry)", async () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      mockLoadPendingBridgeById.mockReturnValue(record);
      mockRetry.mockRejectedValue(new Error("Retry not supported for this result"));

      const onRecoveryError = vi.fn();
      const { result } = renderHook(() => useRecovery({ onRecoveryError }));

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });

      expect(mockUpdatePendingBridge).toHaveBeenCalledWith("rec-1", {
        status: "recovery-pending",
      });
      expect(onRecoveryError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Retry not supported for this result",
        })
      );
    });

    it("keeps record as recovery-pending on retryable error", async () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      mockLoadPendingBridgeById.mockReturnValue(record);
      mockRetry.mockRejectedValue(new Error("retryable network error"));

      const onRecoveryError = vi.fn();
      const { result } = renderHook(() => useRecovery({ onRecoveryError }));

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });

      expect(mockUpdatePendingBridge).toHaveBeenCalledWith("rec-1", {
        status: "recovery-pending",
      });
      expect(onRecoveryError).toHaveBeenCalled();
    });

    it("passes txHash as undefined when mint step has no txHash", async () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      mockLoadPendingBridgeById.mockReturnValue(record);
      mockRetry.mockResolvedValue({
        steps: [
          { name: "approve", state: "noop" },
          { name: "burn", state: "noop" },
          { name: "fetchAttestation", state: "success" },
          { name: "mint", state: "success" },
        ],
      });

      const onRecoveryComplete = vi.fn();
      const { result } = renderHook(() => useRecovery({ onRecoveryComplete }));

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });

      expect(onRecoveryComplete).toHaveBeenCalledWith({
        sourceChainId: 1,
        destChainId: 8453,
        amount: "100",
        txHash: undefined,
      });
    });

    it("sets isRecovering during retry and resets after", async () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      mockLoadPendingBridgeById.mockReturnValue(record);
      mockRetry.mockResolvedValue({
        steps: [{ name: "mint", state: "success", txHash: "0x1" }],
      });

      const { result } = renderHook(() => useRecovery());

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });

      expect(result.current.isRecovering).toBe(false);
    });

    it("sets lastSuccess on successful retry", async () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      mockLoadPendingBridgeById.mockReturnValue(record);
      mockRetry.mockResolvedValue({
        steps: [
          { name: "approve", state: "noop" },
          { name: "burn", state: "noop" },
          { name: "fetchAttestation", state: "success" },
          { name: "mint", state: "success", txHash: "0xmint" },
        ],
      });

      const { result } = renderHook(() => useRecovery());

      expect(result.current.lastSuccess).toBeNull();

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });

      expect(result.current.lastSuccess).toContain("100 USDC bridged successfully");
    });

    it("sets lastError scoped to bridge ID on failed retry", async () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      mockLoadPendingBridgeById.mockReturnValue(record);
      mockRetry.mockResolvedValue({
        steps: [
          { name: "mint", state: "error", errorMessage: "Simulation failed on Base" },
        ],
      });

      const { result } = renderHook(() => useRecovery());

      expect(result.current.lastError).toBeNull();

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });

      expect(result.current.lastError).not.toBeNull();
      expect(result.current.lastError!.bridgeId).toBe("rec-1");
      expect(result.current.lastError!.message).toContain("simulation failed");
    });

    it("sets user-friendly lastError for user rejection", async () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      mockLoadPendingBridgeById.mockReturnValue(record);
      mockRetry.mockRejectedValue(new Error("User rejected the request"));

      const { result } = renderHook(() => useRecovery());

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });

      expect(result.current.lastError).not.toBeNull();
      expect(result.current.lastError!.message).toBe("Transaction was rejected. Please try again.");
    });

    it("clears lastError and lastSuccess on new retry attempt", async () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([record]);
      mockLoadPendingBridgeById.mockReturnValue(record);

      // First: fail
      mockRetry.mockRejectedValueOnce(new Error("some error"));

      const { result } = renderHook(() => useRecovery());

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });
      expect(result.current.lastError).not.toBeNull();

      // Second: succeed — lastError should be cleared before result
      mockRetry.mockResolvedValueOnce({
        steps: [{ name: "mint", state: "success", txHash: "0x1" }],
      });

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });
      expect(result.current.lastError).toBeNull();
      expect(result.current.lastSuccess).not.toBeNull();
    });

    it("does nothing when disconnected", async () => {
      mockUseAccount.mockReturnValue({
        address: "0xUser",
        isConnected: false,
        connector: null,
      });
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([]);
      mockLoadPendingBridgeById.mockReturnValue(record);

      const { result } = renderHook(() => useRecovery());

      await act(async () => {
        await result.current.retryBridge("rec-1");
      });

      expect(mockRetry).not.toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("reloads bridges from storage", () => {
      const record = createRecord();
      mockLoadPendingBridges.mockReturnValue([]);

      const { result } = renderHook(() => useRecovery());
      expect(result.current.pendingBridges).toHaveLength(0);

      mockLoadPendingBridges.mockReturnValue([record]);
      act(() => {
        result.current.refresh();
      });

      expect(result.current.pendingBridges).toHaveLength(1);
    });
  });
});
