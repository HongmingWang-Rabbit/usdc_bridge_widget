import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  savePendingBridge,
  updatePendingBridge,
  loadPendingBridges,
  loadPendingBridgeById,
  removePendingBridge,
  cleanupStaleBridges,
  savePendingClaim,
  updatePendingClaim,
  loadPendingClaims,
  loadPendingClaimById,
  removePendingClaim,
  cleanupStaleClaims,
} from "../storage";
import type { PendingBridgeRecord, PendingClaimRecord } from "../storage";
import type { BridgeResult as BridgeKitResult } from "@circle-fin/bridge-kit";

// Mock BridgeResult for tests
const mockBridgeResult = {
  amount: "100",
  token: "USDC",
  state: "pending",
  provider: "CCTPV2BridgingProvider",
  source: { address: "0x123", chain: { name: "Ethereum" } },
  destination: { address: "0x456", chain: { name: "Base" } },
  steps: [
    { name: "approve", state: "success" },
    { name: "burn", state: "success", txHash: "0xabc" },
  ],
} as BridgeKitResult;

const baseRecord = {
  walletAddress: "0xuser1",
  sourceChainId: 1,
  destChainId: 8453,
  amount: "100",
  bridgeResult: mockBridgeResult,
  status: "in-progress" as const,
};

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("savePendingBridge", () => {
    it("saves a record and returns it with id and timestamps", () => {
      const record = savePendingBridge(baseRecord);
      expect(record).not.toBeNull();
      expect(record!.id).toBeDefined();
      expect(record!.createdAt).toBeGreaterThan(0);
      expect(record!.updatedAt).toBeGreaterThan(0);
      expect(record!.walletAddress).toBe("0xuser1");
      expect(record!.amount).toBe("100");
    });

    it("adds the id to the index", () => {
      const record = savePendingBridge(baseRecord);
      const index = JSON.parse(localStorage.getItem("usdc_bridge_index")!);
      expect(index).toContain(record!.id);
    });

    it("evicts oldest records when over max limit", () => {
      // Save 51 records (limit is 50)
      const ids: string[] = [];
      for (let i = 0; i < 51; i++) {
        const rec = savePendingBridge({ ...baseRecord, amount: `${i}` });
        if (rec) ids.push(rec.id);
      }

      const index = JSON.parse(localStorage.getItem("usdc_bridge_index")!);
      expect(index.length).toBeLessThanOrEqual(50);
      // First record should have been evicted
      expect(localStorage.getItem(`usdc_bridge_tx_${ids[0]}`)).toBeNull();
    });
  });

  describe("updatePendingBridge", () => {
    it("updates the status of an existing record", () => {
      const record = savePendingBridge(baseRecord);
      const updated = updatePendingBridge(record!.id, { status: "recovery-pending" });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("recovery-pending");
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(record!.updatedAt);
    });

    it("updates the bridgeResult of an existing record", () => {
      const record = savePendingBridge(baseRecord);
      const newResult = { ...mockBridgeResult, state: "complete" } as BridgeKitResult;
      const updated = updatePendingBridge(record!.id, { bridgeResult: newResult });
      expect(updated).not.toBeNull();
      expect(updated!.bridgeResult.state).toBe("complete");
    });

    it("returns null for non-existent record", () => {
      const updated = updatePendingBridge("non-existent-id", { status: "failed" });
      expect(updated).toBeNull();
    });

    it("returns null for corrupted stored data", () => {
      localStorage.setItem("usdc_bridge_tx_corrupt", "not-json");
      expect(updatePendingBridge("corrupt", { status: "failed" })).toBeNull();
    });

    it("returns null for stored data with invalid shape", () => {
      localStorage.setItem(
        "usdc_bridge_tx_badshape",
        JSON.stringify({ foo: "bar" })
      );
      expect(updatePendingBridge("badshape", { status: "failed" })).toBeNull();
    });
  });

  describe("loadPendingBridges", () => {
    it("returns records matching the wallet address", () => {
      savePendingBridge(baseRecord);
      savePendingBridge({ ...baseRecord, walletAddress: "0xuser2" });

      const records = loadPendingBridges("0xuser1");
      expect(records).toHaveLength(1);
      expect(records[0].walletAddress).toBe("0xuser1");
    });

    it("is case-insensitive for wallet addresses", () => {
      savePendingBridge({ ...baseRecord, walletAddress: "0xUser1" });

      const records = loadPendingBridges("0xuser1");
      expect(records).toHaveLength(1);
    });

    it("excludes completed records", () => {
      const record = savePendingBridge(baseRecord);
      updatePendingBridge(record!.id, { status: "completed" });

      const records = loadPendingBridges("0xuser1");
      expect(records).toHaveLength(0);
    });

    it("returns empty array when no records exist", () => {
      const records = loadPendingBridges("0xuser1");
      expect(records).toHaveLength(0);
    });
  });

  describe("removePendingBridge", () => {
    it("removes a record and updates the index", () => {
      const record = savePendingBridge(baseRecord);
      const result = removePendingBridge(record!.id);
      expect(result).toBe(true);

      const index = JSON.parse(localStorage.getItem("usdc_bridge_index")!);
      expect(index).not.toContain(record!.id);
      expect(localStorage.getItem(`usdc_bridge_tx_${record!.id}`)).toBeNull();
    });

    it("handles removing non-existent records gracefully", () => {
      const result = removePendingBridge("non-existent-id");
      expect(result).toBe(true); // Still returns true since no error
    });
  });

  describe("cleanupStaleBridges", () => {
    it("removes records older than 7 days", () => {
      const record = savePendingBridge(baseRecord);
      // Manually set updatedAt to 8 days ago
      const raw = JSON.parse(localStorage.getItem(`usdc_bridge_tx_${record!.id}`)!);
      raw.updatedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
      localStorage.setItem(`usdc_bridge_tx_${record!.id}`, JSON.stringify(raw));

      const removed = cleanupStaleBridges();
      expect(removed).toBe(1);

      const records = loadPendingBridges("0xuser1");
      expect(records).toHaveLength(0);
    });

    it("keeps records newer than 7 days", () => {
      savePendingBridge(baseRecord);

      const removed = cleanupStaleBridges();
      expect(removed).toBe(0);

      const records = loadPendingBridges("0xuser1");
      expect(records).toHaveLength(1);
    });

    it("cleans up orphaned index entries", () => {
      const record = savePendingBridge(baseRecord);
      // Remove the data but keep the index entry
      localStorage.removeItem(`usdc_bridge_tx_${record!.id}`);

      const removed = cleanupStaleBridges();
      expect(removed).toBe(1);

      const index = JSON.parse(localStorage.getItem("usdc_bridge_index")!);
      expect(index).not.toContain(record!.id);
    });

    it("removes records with invalid shape", () => {
      // Manually insert an invalid-shape record into storage and index
      localStorage.setItem("usdc_bridge_tx_invalid", JSON.stringify({ foo: "bar" }));
      const index = JSON.parse(localStorage.getItem("usdc_bridge_index") ?? "[]");
      index.push("invalid");
      localStorage.setItem("usdc_bridge_index", JSON.stringify(index));

      const removed = cleanupStaleBridges();
      expect(removed).toBe(1);

      const newIndex = JSON.parse(localStorage.getItem("usdc_bridge_index")!);
      expect(newIndex).not.toContain("invalid");
    });

    it("returns 0 when no records need cleanup", () => {
      const removed = cleanupStaleBridges();
      expect(removed).toBe(0);
    });
  });

  describe("loadPendingBridgeById", () => {
    it("returns a record by its ID", () => {
      const saved = savePendingBridge(baseRecord);
      const loaded = loadPendingBridgeById(saved!.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(saved!.id);
      expect(loaded!.amount).toBe("100");
    });

    it("returns null for non-existent ID", () => {
      expect(loadPendingBridgeById("non-existent")).toBeNull();
    });

    it("returns null for corrupted data", () => {
      localStorage.setItem("usdc_bridge_tx_bad", "not-json");
      expect(loadPendingBridgeById("bad")).toBeNull();
    });

    it("returns null for valid JSON with wrong shape", () => {
      localStorage.setItem("usdc_bridge_tx_wrong", JSON.stringify({ foo: "bar" }));
      expect(loadPendingBridgeById("wrong")).toBeNull();
    });

    it("returns null for valid JSON missing status field", () => {
      localStorage.setItem(
        "usdc_bridge_tx_partial",
        JSON.stringify({ id: "partial", walletAddress: "0x1" })
      );
      expect(loadPendingBridgeById("partial")).toBeNull();
    });

    it("returns null for valid JSON with non-string id", () => {
      localStorage.setItem(
        "usdc_bridge_tx_numid",
        JSON.stringify({ id: 123, status: "in-progress", walletAddress: "0x1" })
      );
      expect(loadPendingBridgeById("numid")).toBeNull();
    });

    it("returns null for valid JSON missing walletAddress", () => {
      localStorage.setItem(
        "usdc_bridge_tx_noaddr",
        JSON.stringify({ id: "noaddr", status: "in-progress" })
      );
      expect(loadPendingBridgeById("noaddr")).toBeNull();
    });

    it("returns null for record missing bridgeResult or numeric fields", () => {
      localStorage.setItem(
        "usdc_bridge_tx_partial2",
        JSON.stringify({ id: "partial2", status: "in-progress", walletAddress: "0x1" })
      );
      expect(loadPendingBridgeById("partial2")).toBeNull();
    });

    it("returns null when sourceChainId is not a number", () => {
      localStorage.setItem(
        "usdc_bridge_tx_badchain",
        JSON.stringify({
          id: "badchain", status: "in-progress", walletAddress: "0x1",
          sourceChainId: "1", destChainId: 8453, amount: "100",
          updatedAt: Date.now(), bridgeResult: {},
        })
      );
      expect(loadPendingBridgeById("badchain")).toBeNull();
    });

    it("returns null when bridgeResult is null", () => {
      localStorage.setItem(
        "usdc_bridge_tx_nullbr",
        JSON.stringify({
          id: "nullbr", status: "in-progress", walletAddress: "0x1",
          sourceChainId: 1, destChainId: 8453, amount: "100",
          updatedAt: Date.now(), bridgeResult: null,
        })
      );
      expect(loadPendingBridgeById("nullbr")).toBeNull();
    });

    it("returns null when bridgeResult is an array", () => {
      localStorage.setItem(
        "usdc_bridge_tx_arraybr",
        JSON.stringify({
          id: "arraybr", status: "in-progress", walletAddress: "0x1",
          sourceChainId: 1, destChainId: 8453, amount: "100",
          createdAt: Date.now(), updatedAt: Date.now(), bridgeResult: [1, 2, 3],
        })
      );
      expect(loadPendingBridgeById("arraybr")).toBeNull();
    });

    it("returns null when bridgeResult is empty object (missing source/destination)", () => {
      localStorage.setItem(
        "usdc_bridge_tx_emptybr",
        JSON.stringify({
          id: "emptybr", status: "in-progress", walletAddress: "0x1",
          sourceChainId: 1, destChainId: 8453, amount: "100",
          createdAt: Date.now(), updatedAt: Date.now(), bridgeResult: {},
        })
      );
      expect(loadPendingBridgeById("emptybr")).toBeNull();
    });
  });

  describe("failureHint persistence", () => {
    it("stores and retrieves failureHint via updatePendingBridge", () => {
      const saved = savePendingBridge(baseRecord);
      const updated = updatePendingBridge(saved!.id, {
        status: "failed",
        failureHint: "possibly-completed",
      });
      expect(updated!.status).toBe("failed");
      expect(updated!.failureHint).toBe("possibly-completed");

      // Verify it persists in storage
      const loaded = loadPendingBridgeById(saved!.id);
      expect(loaded!.failureHint).toBe("possibly-completed");
    });

    it("preserves failureHint when updating only status", () => {
      const saved = savePendingBridge(baseRecord);
      updatePendingBridge(saved!.id, {
        status: "failed",
        failureHint: "possibly-completed",
      });

      // Update only status — failureHint should persist
      const updated = updatePendingBridge(saved!.id, { status: "failed" });
      expect(updated!.failureHint).toBe("possibly-completed");
    });

    it("returns records with failureHint via loadPendingBridges", () => {
      const saved = savePendingBridge(baseRecord);
      updatePendingBridge(saved!.id, {
        status: "failed",
        failureHint: "possibly-completed",
      });

      const records = loadPendingBridges("0xuser1");
      expect(records).toHaveLength(1);
      expect(records[0].failureHint).toBe("possibly-completed");
    });
  });
});

// ============================================================
// Claim persistence tests
// ============================================================

const baseClaimRecord = {
  walletAddress: "0xuser1",
  sourceChainId: 1,
  burnTxHash: "0xabc123",
  status: "attestation-ready" as const,
};

describe("claim storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("savePendingClaim", () => {
    it("saves a claim record and returns it with id and timestamps", () => {
      const record = savePendingClaim(baseClaimRecord);
      expect(record).not.toBeNull();
      expect(record!.id).toBeDefined();
      expect(record!.createdAt).toBeGreaterThan(0);
      expect(record!.updatedAt).toBeGreaterThan(0);
      expect(record!.walletAddress).toBe("0xuser1");
      expect(record!.burnTxHash).toBe("0xabc123");
    });

    it("adds the id to the claim index", () => {
      const record = savePendingClaim(baseClaimRecord);
      const index = JSON.parse(localStorage.getItem("usdc_claim_index")!);
      expect(index).toContain(record!.id);
    });

    it("evicts oldest claim records when over max limit", () => {
      const ids: string[] = [];
      for (let i = 0; i < 51; i++) {
        const rec = savePendingClaim({ ...baseClaimRecord, burnTxHash: `0x${i}` });
        if (rec) ids.push(rec.id);
      }

      const index = JSON.parse(localStorage.getItem("usdc_claim_index")!);
      expect(index.length).toBeLessThanOrEqual(50);
      expect(localStorage.getItem(`usdc_claim_tx_${ids[0]}`)).toBeNull();
    });
  });

  describe("updatePendingClaim", () => {
    it("updates the status of an existing claim", () => {
      const record = savePendingClaim(baseClaimRecord);
      const updated = updatePendingClaim(record!.id, { status: "claiming" });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("claiming");
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(record!.updatedAt);
    });

    it("updates attestation data", () => {
      const record = savePendingClaim(baseClaimRecord);
      const updated = updatePendingClaim(record!.id, {
        attestation: { message: "0xmsg", attestation: "0xatt", status: "complete" },
        destinationChainId: 8453,
        amount: "99",
      });
      expect(updated!.attestation!.message).toBe("0xmsg");
      expect(updated!.destinationChainId).toBe(8453);
      expect(updated!.amount).toBe("99");
    });

    it("returns null for non-existent claim", () => {
      expect(updatePendingClaim("non-existent", { status: "error" })).toBeNull();
    });

    it("returns null for corrupted stored data", () => {
      localStorage.setItem("usdc_claim_tx_corrupt", "not-json");
      expect(updatePendingClaim("corrupt", { status: "error" })).toBeNull();
    });
  });

  describe("loadPendingClaims", () => {
    it("returns claims matching the wallet address", () => {
      savePendingClaim(baseClaimRecord);
      savePendingClaim({ ...baseClaimRecord, walletAddress: "0xuser2" });

      const records = loadPendingClaims("0xuser1");
      expect(records).toHaveLength(1);
      expect(records[0].walletAddress).toBe("0xuser1");
    });

    it("is case-insensitive for wallet addresses", () => {
      savePendingClaim({ ...baseClaimRecord, walletAddress: "0xUser1" });
      const records = loadPendingClaims("0xuser1");
      expect(records).toHaveLength(1);
    });

    it("excludes successful claims", () => {
      const record = savePendingClaim(baseClaimRecord);
      updatePendingClaim(record!.id, { status: "success" });
      const records = loadPendingClaims("0xuser1");
      expect(records).toHaveLength(0);
    });

    it("returns empty array when no claims exist", () => {
      const records = loadPendingClaims("0xuser1");
      expect(records).toHaveLength(0);
    });
  });

  describe("loadPendingClaimById", () => {
    it("returns a claim by its ID", () => {
      const saved = savePendingClaim(baseClaimRecord);
      const loaded = loadPendingClaimById(saved!.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(saved!.id);
    });

    it("returns null for non-existent ID", () => {
      expect(loadPendingClaimById("non-existent")).toBeNull();
    });

    it("returns null for corrupted data", () => {
      localStorage.setItem("usdc_claim_tx_bad", "not-json");
      expect(loadPendingClaimById("bad")).toBeNull();
    });

    it("returns null for invalid shape", () => {
      localStorage.setItem("usdc_claim_tx_wrong", JSON.stringify({ foo: "bar" }));
      expect(loadPendingClaimById("wrong")).toBeNull();
    });
  });

  describe("removePendingClaim", () => {
    it("removes a claim and updates the index", () => {
      const record = savePendingClaim(baseClaimRecord);
      const result = removePendingClaim(record!.id);
      expect(result).toBe(true);

      const index = JSON.parse(localStorage.getItem("usdc_claim_index")!);
      expect(index).not.toContain(record!.id);
      expect(localStorage.getItem(`usdc_claim_tx_${record!.id}`)).toBeNull();
    });
  });

  describe("cleanupStaleClaims", () => {
    it("removes claims older than 7 days", () => {
      const record = savePendingClaim(baseClaimRecord);
      const raw = JSON.parse(localStorage.getItem(`usdc_claim_tx_${record!.id}`)!);
      raw.updatedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
      localStorage.setItem(`usdc_claim_tx_${record!.id}`, JSON.stringify(raw));

      const removed = cleanupStaleClaims();
      expect(removed).toBe(1);
    });

    it("keeps claims newer than 7 days", () => {
      savePendingClaim(baseClaimRecord);
      const removed = cleanupStaleClaims();
      expect(removed).toBe(0);
    });

    it("returns 0 when no claims need cleanup", () => {
      expect(cleanupStaleClaims()).toBe(0);
    });
  });

  describe("claim and bridge storage independence", () => {
    it("stores claims and bridges in separate namespaces", () => {
      savePendingBridge(baseRecord);
      savePendingClaim(baseClaimRecord);

      const bridges = loadPendingBridges("0xuser1");
      const claims = loadPendingClaims("0xuser1");

      expect(bridges).toHaveLength(1);
      expect(claims).toHaveLength(1);

      // Different IDs — no collision
      expect(bridges[0].id).not.toBe(claims[0].id);
    });
  });
});
