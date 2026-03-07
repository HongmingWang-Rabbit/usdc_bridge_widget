import type { BridgeResult as BridgeKitResult } from "@circle-fin/bridge-kit";
import { bigIntReplacer } from "./utils";

// Stale record threshold: 7 days
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

// Maximum number of records to keep (prevents unbounded localStorage growth)
const MAX_RECORDS = 50;

// ============================================================
// Shared infrastructure
// ============================================================

interface BaseRecord {
  id: string;
  walletAddress: string;
  createdAt: number;
  updatedAt: number;
  status: string;
}

function isSSR(): boolean {
  return typeof window === "undefined";
}

function getStorage(): Storage | null {
  if (isSSR()) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function loadIndex(storage: Storage, indexKey: string): string[] {
  try {
    const raw = storage.getItem(indexKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveIndex(storage: Storage, indexKey: string, index: string[]): void {
  try {
    storage.setItem(indexKey, JSON.stringify(index));
  } catch {
    // Storage full or unavailable - silently fail
  }
}

// ============================================================
// Generic storage adapter factory
// ============================================================

interface StorageAdapterConfig<TRecord extends BaseRecord> {
  prefix: string;
  indexKey: string;
  validator: (parsed: unknown) => parsed is TRecord;
  serialize: (record: TRecord) => string;
  completedStatus: string;
  logLabel: string;
}

interface StorageAdapter<TRecord extends BaseRecord> {
  save: (record: Omit<TRecord, "id" | "createdAt" | "updatedAt">) => TRecord | null;
  update: (id: string, updates: Partial<TRecord>) => TRecord | null;
  loadById: (id: string) => TRecord | null;
  loadByWallet: (walletAddress: string) => TRecord[];
  remove: (id: string) => boolean;
  cleanupStale: () => number;
}

function createStorageAdapter<TRecord extends BaseRecord>(
  config: StorageAdapterConfig<TRecord>
): StorageAdapter<TRecord> {
  const { prefix, indexKey, validator, serialize, completedStatus, logLabel } = config;

  function save(
    record: Omit<TRecord, "id" | "createdAt" | "updatedAt">
  ): TRecord | null {
    const storage = getStorage();
    if (!storage) return null;

    const id = generateId();
    const now = Date.now();
    const full = { ...record, id, createdAt: now, updatedAt: now } as TRecord;

    try {
      storage.setItem(`${prefix}${id}`, serialize(full));
      const index = loadIndex(storage, indexKey);
      index.push(id);

      // Evict oldest records if over the limit
      while (index.length > MAX_RECORDS) {
        const oldestId = index.shift()!;
        storage.removeItem(`${prefix}${oldestId}`);
      }

      saveIndex(storage, indexKey, index);
      return full;
    } catch (err) {
      console.error(`[usdc-bridge] Failed to save pending ${logLabel}:`, err);
      return null;
    }
  }

  function update(id: string, updates: Partial<TRecord>): TRecord | null {
    const storage = getStorage();
    if (!storage) return null;

    try {
      const raw = storage.getItem(`${prefix}${id}`);
      if (!raw) return null;
      const record = JSON.parse(raw);
      if (!validator(record)) return null;

      const updated = { ...record, ...updates, updatedAt: Date.now() } as TRecord;
      storage.setItem(`${prefix}${id}`, serialize(updated));
      return updated;
    } catch {
      return null;
    }
  }

  function loadById(id: string): TRecord | null {
    const storage = getStorage();
    if (!storage) return null;

    try {
      const raw = storage.getItem(`${prefix}${id}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!validator(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function loadByWallet(walletAddress: string): TRecord[] {
    const storage = getStorage();
    if (!storage) return [];

    const normalizedAddress = walletAddress.toLowerCase();
    const index = loadIndex(storage, indexKey);
    const records: TRecord[] = [];

    for (const id of index) {
      try {
        const raw = storage.getItem(`${prefix}${id}`);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!validator(parsed)) continue;
        if (parsed.walletAddress.toLowerCase() === normalizedAddress && parsed.status !== completedStatus) {
          records.push(parsed);
        }
      } catch {
        // Corrupted record - skip
      }
    }

    return records;
  }

  function remove(id: string): boolean {
    const storage = getStorage();
    if (!storage) return false;

    try {
      storage.removeItem(`${prefix}${id}`);
      const index = loadIndex(storage, indexKey);
      const newIndex = index.filter((i) => i !== id);
      saveIndex(storage, indexKey, newIndex);
      return true;
    } catch {
      return false;
    }
  }

  function cleanupStale(): number {
    const storage = getStorage();
    if (!storage) return 0;

    const index = loadIndex(storage, indexKey);
    const now = Date.now();
    const idsToRemove = new Set<string>();

    for (const id of index) {
      try {
        const raw = storage.getItem(`${prefix}${id}`);
        if (!raw) { idsToRemove.add(id); continue; }
        const parsed = JSON.parse(raw);
        if (!validator(parsed)) { idsToRemove.add(id); continue; }
        if (now - parsed.updatedAt > STALE_THRESHOLD_MS) { idsToRemove.add(id); }
      } catch {
        idsToRemove.add(id);
      }
    }

    if (idsToRemove.size === 0) return 0;

    for (const id of idsToRemove) {
      storage.removeItem(`${prefix}${id}`);
    }
    const newIndex = index.filter((id) => !idsToRemove.has(id));
    saveIndex(storage, indexKey, newIndex);

    return idsToRemove.size;
  }

  return { save, update, loadById, loadByWallet, remove, cleanupStale };
}

// ============================================================
// Bridge records
// ============================================================

export type PendingBridgeStatus = "in-progress" | "recovery-pending" | "completed" | "failed";

/**
 * @deprecated No longer produced — retained for reading legacy localStorage records.
 * UI components still handle this value for backwards compatibility.
 */
export type PendingBridgeFailureHint = "possibly-completed";

export interface PendingBridgeRecord {
  id: string;
  walletAddress: string; // lowercase 0x
  sourceChainId: number;
  destChainId: number;
  amount: string;
  bridgeResult: BridgeKitResult;
  createdAt: number;
  updatedAt: number;
  status: PendingBridgeStatus;
  failureHint?: PendingBridgeFailureHint;
}

/**
 * Shape validation to guard against corrupted or old-schema data.
 * Checks all fields accessed downstream: loadPendingBridgeById, loadPendingBridges,
 * cleanupStaleBridges, updatePendingBridge, and useRecovery's retryBridge.
 */
function isValidBridgeRecord(parsed: unknown): parsed is PendingBridgeRecord {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return false;
  }
  const r = parsed as PendingBridgeRecord;
  return (
    typeof r.id === "string" &&
    typeof r.status === "string" &&
    typeof r.walletAddress === "string" &&
    typeof r.sourceChainId === "number" &&
    typeof r.destChainId === "number" &&
    typeof r.amount === "string" &&
    typeof r.createdAt === "number" &&
    typeof r.updatedAt === "number" &&
    r.bridgeResult !== null &&
    typeof r.bridgeResult === "object" &&
    !Array.isArray(r.bridgeResult) &&
    r.bridgeResult.source !== null &&
    typeof r.bridgeResult.source === "object" &&
    r.bridgeResult.destination !== null &&
    typeof r.bridgeResult.destination === "object"
  );
}

const bridgeAdapter = createStorageAdapter<PendingBridgeRecord>({
  prefix: "usdc_bridge_tx_",
  indexKey: "usdc_bridge_index",
  validator: isValidBridgeRecord,
  serialize: (r) => JSON.stringify(r, bigIntReplacer),
  completedStatus: "completed",
  logLabel: "bridge",
});

export function savePendingBridge(
  record: Omit<PendingBridgeRecord, "id" | "createdAt" | "updatedAt">
): PendingBridgeRecord | null {
  return bridgeAdapter.save(record);
}

export function updatePendingBridge(
  id: string,
  updates: Partial<Pick<PendingBridgeRecord, "bridgeResult" | "status" | "failureHint">>
): PendingBridgeRecord | null {
  return bridgeAdapter.update(id, updates);
}

export function loadPendingBridgeById(id: string): PendingBridgeRecord | null {
  return bridgeAdapter.loadById(id);
}

export function loadPendingBridges(walletAddress: string): PendingBridgeRecord[] {
  return bridgeAdapter.loadByWallet(walletAddress);
}

export function removePendingBridge(id: string): boolean {
  return bridgeAdapter.remove(id);
}

export function cleanupStaleBridges(): number {
  return bridgeAdapter.cleanupStale();
}

// ============================================================
// Claim records
// ============================================================

export type PendingClaimStatus =
  | "fetching-attestation"
  | "attestation-pending"
  | "attestation-ready"
  | "claiming"
  | "success"
  | "error";

export interface PendingClaimRecord {
  id: string;
  walletAddress: string;
  sourceChainId: number;
  destinationChainId?: number;
  burnTxHash: string;
  amount?: string;
  attestation?: { message: string; attestation: string; status: string };
  mintRecipient?: string;
  claimTxHash?: `0x${string}`;
  createdAt: number;
  updatedAt: number;
  status: PendingClaimStatus;
  error?: string;
}

function isValidClaimRecord(parsed: unknown): parsed is PendingClaimRecord {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return false;
  }
  const r = parsed as PendingClaimRecord;
  return (
    typeof r.id === "string" &&
    typeof r.status === "string" &&
    typeof r.walletAddress === "string" &&
    typeof r.sourceChainId === "number" &&
    typeof r.burnTxHash === "string" &&
    typeof r.createdAt === "number" &&
    typeof r.updatedAt === "number"
  );
}

const claimAdapter = createStorageAdapter<PendingClaimRecord>({
  prefix: "usdc_claim_tx_",
  indexKey: "usdc_claim_index",
  validator: isValidClaimRecord,
  serialize: (r) => JSON.stringify(r),
  completedStatus: "success",
  logLabel: "claim",
});

export function savePendingClaim(
  record: Omit<PendingClaimRecord, "id" | "createdAt" | "updatedAt">
): PendingClaimRecord | null {
  return claimAdapter.save(record);
}

export function updatePendingClaim(
  id: string,
  updates: Partial<
    Pick<
      PendingClaimRecord,
      "status" | "attestation" | "destinationChainId" | "amount" | "mintRecipient" | "claimTxHash" | "error"
    >
  >
): PendingClaimRecord | null {
  return claimAdapter.update(id, updates);
}

export function loadPendingClaimById(id: string): PendingClaimRecord | null {
  return claimAdapter.loadById(id);
}

export function loadPendingClaims(walletAddress: string): PendingClaimRecord[] {
  return claimAdapter.loadByWallet(walletAddress);
}

export function removePendingClaim(id: string): boolean {
  return claimAdapter.remove(id);
}

export function cleanupStaleClaims(): number {
  return claimAdapter.cleanupStale();
}
