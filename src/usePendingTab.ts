import { useMemo } from "react";
import type { PendingBridgeRecord, PendingClaimRecord } from "./storage";

export type PendingItemType = "bridge" | "claim";

/** Semantic action type for pending items — used for dispatch instead of matching on label strings. */
export type PendingActionType = "resume" | "execute" | "retry" | "cancel";

/** Semantic status variant for theming — mapped to theme colors by the consumer. */
export type PendingStatusVariant = "primary" | "success" | "error" | "muted";

export interface PendingItem {
  type: PendingItemType;
  id: string;
  sourceChainId: number;
  destChainId?: number;
  amount?: string;
  /** Transaction hash (burn tx for bridges, burn tx for claims). */
  txHash?: string;
  updatedAt: number;
  displayStatus: string;
  actionable: boolean;
  actionLabel?: string;
  /** Semantic action type for programmatic dispatch (avoids matching on actionLabel strings). */
  actionType?: PendingActionType;
  dismissable: boolean;
  /** Whether the item is in a polling/in-flight state (show spinner). */
  isPolling: boolean;
  /** Semantic status variant for theming (avoids unsafe type assertions in UI). */
  statusVariant: PendingStatusVariant;
  raw: PendingBridgeRecord | PendingClaimRecord;
}

export interface UsePendingTabResult {
  items: PendingItem[];
  actionableCount: number;
}

function mapBridgeItem(bridge: PendingBridgeRecord): PendingItem {
  const isFailed = bridge.status === "failed";
  // Legacy: no code path produces failureHint anymore, but old localStorage
  // records may still have it. Kept for backwards compatibility.
  const isPossiblyCompleted = isFailed && bridge.failureHint === "possibly-completed";

  let displayStatus: string;
  let actionable = false;
  let actionLabel: string | undefined;
  let actionType: PendingActionType | undefined;
  let statusVariant: PendingStatusVariant = "muted";
  const isPolling = bridge.status === "in-progress";

  if (isPossiblyCompleted) {
    displayStatus = "May be completed";
    statusVariant = "success";
  } else if (isFailed) {
    displayStatus = "Failed";
    statusVariant = "error";
  } else if (bridge.status === "recovery-pending") {
    displayStatus = "Recovery needed";
    actionable = true;
    actionLabel = "Resume";
    actionType = "resume";
    statusVariant = "primary";
  } else {
    displayStatus = "In progress";
  }

  // Extract burn txHash from the stored BridgeResult steps
  const burnStep = bridge.bridgeResult?.steps?.find(
    (s: { name?: string }) => s.name?.toLowerCase() === "burn"
  ) as { txHash?: string } | undefined;

  return {
    type: "bridge",
    id: bridge.id,
    sourceChainId: bridge.sourceChainId,
    destChainId: bridge.destChainId,
    amount: bridge.amount,
    txHash: burnStep?.txHash,
    updatedAt: bridge.updatedAt,
    displayStatus,
    actionable,
    actionLabel,
    actionType,
    dismissable: true,
    isPolling,
    statusVariant,
    raw: bridge,
  };
}

function mapClaimItem(claim: PendingClaimRecord): PendingItem {
  let displayStatus: string;
  let actionable = false;
  let actionLabel: string | undefined;
  let actionType: PendingActionType | undefined;
  let dismissable = true;
  let isPolling = false;
  let statusVariant: PendingStatusVariant = "muted";

  switch (claim.status) {
    case "fetching-attestation":
    case "attestation-pending":
      displayStatus = "Fetching attestation...";
      actionable = true;
      actionLabel = "Cancel";
      actionType = "cancel";
      isPolling = true;
      break;
    case "attestation-ready":
      displayStatus = "Ready to claim";
      actionable = true;
      actionLabel = "Claim";
      actionType = "execute";
      statusVariant = "success";
      break;
    case "claiming":
      displayStatus = "Claiming...";
      dismissable = false;
      isPolling = true;
      break;
    case "error":
      displayStatus = "Error";
      actionable = true;
      statusVariant = "error";
      // If attestation data exists, allow re-executing the claim directly;
      // otherwise re-poll for attestation.
      if (claim.attestation) {
        actionLabel = "Claim";
        actionType = "execute";
      } else {
        actionLabel = "Retry";
        actionType = "retry";
      }
      break;
    case "success": {
      // Filtered out by loadPendingClaims — should never reach here
      displayStatus = "Completed";
      statusVariant = "success";
      break;
    }
    default: {
      // Exhaustive check: if a new status is added, TypeScript will error here
      const _exhaustive: never = claim.status;
      displayStatus = _exhaustive;
    }
  }

  return {
    type: "claim",
    id: claim.id,
    sourceChainId: claim.sourceChainId,
    destChainId: claim.destinationChainId,
    amount: claim.amount,
    txHash: claim.burnTxHash,
    updatedAt: claim.updatedAt,
    displayStatus,
    actionable,
    actionLabel,
    actionType,
    dismissable,
    isPolling,
    statusVariant,
    raw: claim,
  };
}

export function usePendingTab(
  pendingBridges: PendingBridgeRecord[],
  pendingClaims: PendingClaimRecord[]
): UsePendingTabResult {
  const items = useMemo(() => {
    const bridgeItems = pendingBridges.map(mapBridgeItem);
    const claimItems = pendingClaims.map(mapClaimItem);
    const all = [...bridgeItems, ...claimItems];
    all.sort((a, b) => b.updatedAt - a.updatedAt);
    return all;
  }, [pendingBridges, pendingClaims]);

  const actionableCount = useMemo(
    () => items.filter((i) => i.actionable).length,
    [items]
  );

  return { items, actionableCount };
}
