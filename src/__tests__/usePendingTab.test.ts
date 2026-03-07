import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePendingTab } from "../usePendingTab";
import type { PendingBridgeRecord, PendingClaimRecord } from "../storage";
import type { BridgeResult as BridgeKitResult } from "@circle-fin/bridge-kit";

const mockBridgeResult = {
  amount: "100",
  token: "USDC",
  state: "pending",
  provider: "CCTPV2BridgingProvider",
  source: { address: "0x123", chain: { name: "Ethereum" } },
  destination: { address: "0x456", chain: { name: "Base" } },
  steps: [],
} as BridgeKitResult;

function makeBridge(overrides: Partial<PendingBridgeRecord> = {}): PendingBridgeRecord {
  return {
    id: "bridge-1",
    walletAddress: "0xuser",
    sourceChainId: 1,
    destChainId: 8453,
    amount: "100",
    bridgeResult: mockBridgeResult,
    createdAt: 1000,
    updatedAt: 2000,
    status: "recovery-pending",
    ...overrides,
  };
}

function makeClaim(overrides: Partial<PendingClaimRecord> = {}): PendingClaimRecord {
  return {
    id: "claim-1",
    walletAddress: "0xuser",
    sourceChainId: 1,
    burnTxHash: "0xabc",
    createdAt: 1000,
    updatedAt: 3000,
    status: "attestation-ready",
    ...overrides,
  };
}

describe("usePendingTab", () => {
  it("returns empty list when no items exist", () => {
    const { result } = renderHook(() => usePendingTab([], []));
    expect(result.current.items).toHaveLength(0);
    expect(result.current.actionableCount).toBe(0);
  });

  it("combines bridge and claim items", () => {
    const { result } = renderHook(() =>
      usePendingTab([makeBridge()], [makeClaim()])
    );
    expect(result.current.items).toHaveLength(2);
  });

  it("sorts items by updatedAt descending", () => {
    const bridge = makeBridge({ updatedAt: 1000 });
    const claim = makeClaim({ updatedAt: 3000 });
    const { result } = renderHook(() => usePendingTab([bridge], [claim]));

    expect(result.current.items[0].type).toBe("claim");
    expect(result.current.items[1].type).toBe("bridge");
  });

  describe("bridge status mapping", () => {
    it("maps recovery-pending to actionable Resume", () => {
      const { result } = renderHook(() =>
        usePendingTab([makeBridge({ status: "recovery-pending" })], [])
      );
      const item = result.current.items[0];
      expect(item.displayStatus).toBe("Recovery needed");
      expect(item.actionable).toBe(true);
      expect(item.actionLabel).toBe("Resume");
      expect(item.actionType).toBe("resume");
      expect(item.isPolling).toBe(false);
      expect(item.statusVariant).toBe("primary");
    });

    it("maps failed with possibly-completed hint", () => {
      const { result } = renderHook(() =>
        usePendingTab(
          [makeBridge({ status: "failed", failureHint: "possibly-completed" })],
          []
        )
      );
      const item = result.current.items[0];
      expect(item.displayStatus).toBe("May be completed");
      expect(item.actionable).toBe(false);
      expect(item.statusVariant).toBe("success");
    });

    it("maps failed without hint", () => {
      const { result } = renderHook(() =>
        usePendingTab([makeBridge({ status: "failed" })], [])
      );
      const item = result.current.items[0];
      expect(item.displayStatus).toBe("Failed");
      expect(item.actionable).toBe(false);
      expect(item.statusVariant).toBe("error");
    });

    it("maps in-progress", () => {
      const { result } = renderHook(() =>
        usePendingTab([makeBridge({ status: "in-progress" })], [])
      );
      const item = result.current.items[0];
      expect(item.displayStatus).toBe("In progress");
      expect(item.actionable).toBe(false);
      expect(item.statusVariant).toBe("muted");
    });
  });

  describe("claim status mapping", () => {
    it("maps fetching-attestation to Cancel", () => {
      const { result } = renderHook(() =>
        usePendingTab([], [makeClaim({ status: "fetching-attestation" })])
      );
      const item = result.current.items[0];
      expect(item.displayStatus).toBe("Fetching attestation...");
      expect(item.actionable).toBe(true);
      expect(item.actionLabel).toBe("Cancel");
      expect(item.actionType).toBe("cancel");
      expect(item.isPolling).toBe(true);
      expect(item.statusVariant).toBe("muted");
    });

    it("maps attestation-ready to Claim", () => {
      const { result } = renderHook(() =>
        usePendingTab([], [makeClaim({ status: "attestation-ready" })])
      );
      const item = result.current.items[0];
      expect(item.displayStatus).toBe("Ready to claim");
      expect(item.actionable).toBe(true);
      expect(item.actionLabel).toBe("Claim");
      expect(item.actionType).toBe("execute");
      expect(item.isPolling).toBe(false);
      expect(item.statusVariant).toBe("success");
    });

    it("maps claiming to non-actionable and non-dismissable with polling", () => {
      const { result } = renderHook(() =>
        usePendingTab([], [makeClaim({ status: "claiming" })])
      );
      const item = result.current.items[0];
      expect(item.displayStatus).toBe("Claiming...");
      expect(item.actionable).toBe(false);
      expect(item.dismissable).toBe(false);
      expect(item.isPolling).toBe(true);
      expect(item.statusVariant).toBe("muted");
    });

    it("maps error without attestation to Retry", () => {
      const { result } = renderHook(() =>
        usePendingTab([], [makeClaim({ status: "error" })])
      );
      const item = result.current.items[0];
      expect(item.displayStatus).toBe("Error");
      expect(item.actionable).toBe(true);
      expect(item.actionLabel).toBe("Retry");
      expect(item.actionType).toBe("retry");
      expect(item.statusVariant).toBe("error");
    });

    it("maps error with attestation to Claim (execute)", () => {
      const { result } = renderHook(() =>
        usePendingTab([], [makeClaim({
          status: "error",
          attestation: { message: "0xmsg", attestation: "0xatt", status: "complete" },
        })])
      );
      const item = result.current.items[0];
      expect(item.displayStatus).toBe("Error");
      expect(item.actionable).toBe(true);
      expect(item.actionLabel).toBe("Claim");
      expect(item.actionType).toBe("execute");
      expect(item.statusVariant).toBe("error");
    });
  });

  describe("actionableCount", () => {
    it("counts actionable items", () => {
      const { result } = renderHook(() =>
        usePendingTab(
          [makeBridge({ id: "b1", status: "recovery-pending" })],
          [
            makeClaim({ id: "c1", status: "attestation-ready" }),
            makeClaim({ id: "c2", status: "claiming" }),
          ]
        )
      );
      // bridge recovery-pending (1) + claim attestation-ready (1) = 2
      expect(result.current.actionableCount).toBe(2);
    });

    it("returns 0 when no items are actionable", () => {
      const { result } = renderHook(() =>
        usePendingTab(
          [makeBridge({ status: "failed" })],
          [makeClaim({ status: "claiming" })]
        )
      );
      expect(result.current.actionableCount).toBe(0);
    });
  });

  it("preserves raw reference", () => {
    const bridge = makeBridge();
    const claim = makeClaim();
    const { result } = renderHook(() => usePendingTab([bridge], [claim]));

    const bridgeItem = result.current.items.find((i) => i.type === "bridge");
    const claimItem = result.current.items.find((i) => i.type === "claim");

    expect(bridgeItem!.raw).toBe(bridge);
    expect(claimItem!.raw).toBe(claim);
  });
});
