import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount, useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import {
  savePendingClaim,
  updatePendingClaim,
  loadPendingClaims,
  removePendingClaim,
  cleanupStaleClaims,
  type PendingClaimRecord,
} from "./storage";
import { pollAttestationOnce, formatUSDCAmount, MESSAGE_TRANSMITTER_ABI } from "./useClaim";
import {
  CCTP_DOMAIN_IDS,
  CCTP_DOMAIN_TO_CHAIN_ID,
  MESSAGE_TRANSMITTER_V2_ADDRESS,
  ATTESTATION_POLL_INTERVAL_MS,
  ATTESTATION_POLL_MAX_DURATION_MS,
} from "./constants";
import { getErrorMessage, ensureHexPrefix } from "./utils";

export interface UseClaimManagerOptions {
  enabled?: boolean;
  onClaimSuccess?: (params: {
    sourceChainId: number;
    destChainId: number;
    amount: string;
    claimTxHash: `0x${string}`;
  }) => void;
  onClaimError?: (error: Error) => void;
  onPendingClaimDetected?: (claims: PendingClaimRecord[]) => void;
}

export interface UseClaimManagerResult {
  pendingClaims: PendingClaimRecord[];
  addClaim: (data: Omit<PendingClaimRecord, "id" | "createdAt" | "updatedAt">) => string | null;
  executeClaim: (id: string) => Promise<void>;
  dismissClaim: (id: string) => void;
  resumePolling: (id: string) => void;
  activeClaimId: string | null;
  refresh: () => void;
}

interface PollEntry {
  timer: ReturnType<typeof setTimeout> | null;
  abortController: AbortController;
  startTime: number;
}

export function useClaimManager(options: UseClaimManagerOptions = {}): UseClaimManagerResult {
  const { enabled = true, onClaimSuccess, onClaimError, onPendingClaimDetected } = options;
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [pendingClaims, setPendingClaims] = useState<PendingClaimRecord[]>([]);
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);

  // Track pending claim tx for receipt confirmation
  const [pendingClaimTx, setPendingClaimTx] = useState<{
    id: string;
    hash: `0x${string}`;
    sourceChainId: number;
    destChainId: number;
    amount: string;
  } | null>(null);

  const { isSuccess: isClaimTxConfirmed } = useWaitForTransactionReceipt({
    hash: pendingClaimTx?.hash,
  });

  const pollMapRef = useRef<Map<string, PollEntry>>(new Map());
  const isMountedRef = useRef(true);
  // Guard against the confirmation effect firing twice for the same tx hash
  const lastConfirmedHashRef = useRef<string | null>(null);
  // Ref for currentChainId so executeClaim always reads the latest value
  const currentChainIdRef = useRef(currentChainId);
  currentChainIdRef.current = currentChainId;

  // Callback refs
  const onClaimSuccessRef = useRef(onClaimSuccess);
  onClaimSuccessRef.current = onClaimSuccess;
  const onClaimErrorRef = useRef(onClaimError);
  onClaimErrorRef.current = onClaimError;
  const onPendingClaimDetectedRef = useRef(onPendingClaimDetected);
  onPendingClaimDetectedRef.current = onPendingClaimDetected;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup all polls
      for (const [, entry] of pollMapRef.current) {
        if (entry.timer) clearTimeout(entry.timer);
        entry.abortController.abort();
      }
      pollMapRef.current.clear();
    };
  }, []);

  // Handle claim tx confirmation
  useEffect(() => {
    if (isClaimTxConfirmed && pendingClaimTx) {
      // Guard: don't process the same tx hash twice (prevents stale effect re-fire)
      if (lastConfirmedHashRef.current === pendingClaimTx.hash) return;
      lastConfirmedHashRef.current = pendingClaimTx.hash;

      const { id, hash, sourceChainId, destChainId, amount } = pendingClaimTx;
      removePendingClaim(id);
      setPendingClaims((prev) => prev.filter((c) => c.id !== id));

      onClaimSuccessRef.current?.({
        sourceChainId,
        destChainId,
        amount,
        claimTxHash: hash,
      });

      setPendingClaimTx(null);
      setActiveClaimId(null);
    }
  }, [isClaimTxConfirmed, pendingClaimTx]);

  // Keep a ref to pendingClaims so poll callbacks can read latest state
  const pendingClaimsRef = useRef(pendingClaims);
  pendingClaimsRef.current = pendingClaims;

  const stopPolling = useCallback((id: string) => {
    const entry = pollMapRef.current.get(id);
    if (entry) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.abortController.abort();
      pollMapRef.current.delete(id);
    }
  }, []);

  // Use a ref to break circular dependency: doPoll schedules itself via doPollRef
  const doPollRef = useRef<(id: string) => Promise<void>>();

  const doPoll = useCallback(
    async (id: string) => {
      const entry = pollMapRef.current.get(id);
      if (!entry) return;

      // Check timeout
      if (Date.now() - entry.startTime > ATTESTATION_POLL_MAX_DURATION_MS) {
        const timeoutError = "Attestation polling timed out. Try again later.";
        updatePendingClaim(id, {
          status: "error",
          error: timeoutError,
        });
        if (isMountedRef.current) {
          setPendingClaims((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, status: "error", error: timeoutError, updatedAt: Date.now() } : c
            )
          );
        }
        stopPolling(id);
        return;
      }

      // Load current record to get source chain info
      const claims = pendingClaimsRef.current;
      const claim = claims.find((c) => c.id === id);
      if (!claim) { stopPolling(id); return; }

      const domainId = CCTP_DOMAIN_IDS[claim.sourceChainId];
      if (domainId === undefined) { stopPolling(id); return; }

      // Helper to schedule the next poll iteration via ref
      const scheduleNext = () => {
        const e = pollMapRef.current.get(id);
        if (e) {
          e.timer = setTimeout(() => void doPollRef.current?.(id), ATTESTATION_POLL_INTERVAL_MS);
        }
      };

      try {
        const result = await pollAttestationOnce(domainId, claim.burnTxHash, entry.abortController.signal);
        if (!isMountedRef.current) return;
        if (!result) { scheduleNext(); return; }

        if (result.status === "not-found") {
          scheduleNext();
          return;
        }

        if (result.status === "pending") {
          updatePendingClaim(id, { status: "attestation-pending" });
          setPendingClaims((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, status: "attestation-pending", updatedAt: Date.now() } : c
            )
          );
          scheduleNext();
          return;
        }

        // complete — guard against missing fields before using them
        if (!result.message || !result.attestation) {
          scheduleNext();
          return;
        }

        const destinationChainId = result.destinationDomain !== undefined
          ? CCTP_DOMAIN_TO_CHAIN_ID[result.destinationDomain]
          : undefined;
        const formattedAmount = result.amount !== undefined ? formatUSDCAmount(result.amount) : undefined;

        const attestationData = {
          message: result.message,
          attestation: result.attestation,
          status: "complete",
        };

        updatePendingClaim(id, {
          status: "attestation-ready",
          attestation: attestationData,
          destinationChainId,
          amount: formattedAmount,
          mintRecipient: result.mintRecipient,
        });

        setPendingClaims((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: "attestation-ready" as const,
                  attestation: attestationData,
                  destinationChainId,
                  amount: formattedAmount,
                  mintRecipient: result.mintRecipient,
                  updatedAt: Date.now(),
                }
              : c
          )
        );
        stopPolling(id);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!isMountedRef.current) return;

        const errorMsg = getErrorMessage(err);
        updatePendingClaim(id, { status: "error", error: errorMsg });
        setPendingClaims((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, status: "error", error: errorMsg, updatedAt: Date.now() } : c
          )
        );
        stopPolling(id);
      }
    },
    // Only stopPolling is listed — all other reads use stable refs:
    // pendingClaimsRef, pollMapRef, isMountedRef, doPollRef.
    // setState/updatePendingClaim are stable by React/module guarantees.
    [stopPolling]
  );
  doPollRef.current = doPoll;

  const startPolling = useCallback(
    (id: string) => {
      // Don't start if already polling
      if (pollMapRef.current.has(id)) return;

      const entry: PollEntry = {
        timer: null,
        abortController: new AbortController(),
        startTime: Date.now(),
      };
      pollMapRef.current.set(id, entry);
      void doPollRef.current?.(id);
    },
    []
  );

  const loadClaims = useCallback(() => {
    if (!enabled || !isConnected || !address) {
      setPendingClaims([]);
      return;
    }

    cleanupStaleClaims();
    const claims = loadPendingClaims(address);
    setPendingClaims(claims);

    if (claims.length > 0) {
      onPendingClaimDetectedRef.current?.(claims);
    }

    // Resume polling for in-flight claims
    for (const claim of claims) {
      if (claim.status === "fetching-attestation" || claim.status === "attestation-pending") {
        startPolling(claim.id);
      }
    }
  }, [enabled, isConnected, address, startPolling]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const addClaim = useCallback(
    (data: Omit<PendingClaimRecord, "id" | "createdAt" | "updatedAt">): string | null => {
      // Deduplicate: don't add a claim if one with the same burnTxHash already exists
      const existing = pendingClaimsRef.current.find(
        (c) => c.burnTxHash === data.burnTxHash
      );
      if (existing) return existing.id;

      const saved = savePendingClaim(data);
      if (!saved) return null;

      setPendingClaims((prev) => [...prev, saved]);

      // Start polling if needed
      if (saved.status === "fetching-attestation" || saved.status === "attestation-pending") {
        startPolling(saved.id);
      }

      return saved.id;
    },
    [startPolling]
  );

  const executeClaim = useCallback(
    async (id: string) => {
      const claim = pendingClaimsRef.current.find((c) => c.id === id);
      if (!claim) return;

      // Allow re-execution from error state (retry) as well as attestation-ready
      if (claim.status !== "attestation-ready" && claim.status !== "error") {
        return;
      }

      if (!claim.attestation || !claim.destinationChainId) {
        const errorMsg = !claim.attestation
          ? "Attestation data is missing. Try fetching the attestation again."
          : "Destination chain is unknown. Try fetching the attestation again.";
        updatePendingClaim(id, { status: "error", error: errorMsg });
        setPendingClaims((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: "error" as const, error: errorMsg, updatedAt: Date.now() } : c))
        );
        return;
      }

      if (!isConnected) return;

      setActiveClaimId(id);

      // Switch chain if needed (read from ref to avoid stale closure)
      if (currentChainIdRef.current !== claim.destinationChainId) {
        try {
          await switchChainAsync({ chainId: claim.destinationChainId });
        } catch (err) {
          const errorMsg = `Failed to switch chain: ${getErrorMessage(err)}`;
          updatePendingClaim(id, { status: "error", error: errorMsg });
          setPendingClaims((prev) =>
            prev.map((c) => (c.id === id ? { ...c, status: "error", error: errorMsg, updatedAt: Date.now() } : c))
          );
          setActiveClaimId(null);
          return;
        }
      }

      updatePendingClaim(id, { status: "claiming" });
      setPendingClaims((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "claiming" as const, updatedAt: Date.now() } : c))
      );

      try {
        const messageHex = ensureHexPrefix(claim.attestation.message);
        const attestationHex = ensureHexPrefix(claim.attestation.attestation);

        const txHash = await writeContractAsync({
          address: MESSAGE_TRANSMITTER_V2_ADDRESS,
          abi: MESSAGE_TRANSMITTER_ABI,
          functionName: "receiveMessage",
          args: [messageHex, attestationHex],
          chainId: claim.destinationChainId,
        });

        // Track tx hash for receipt confirmation — success is set by the confirmation effect
        updatePendingClaim(id, { status: "claiming", claimTxHash: txHash });

        const claimAmount = claim.amount ?? "0";
        if (!claim.amount) {
          console.warn("[usdc-bridge] Claim amount is missing — attestation data may be incomplete.");
        }

        setPendingClaimTx({
          id,
          hash: txHash,
          sourceChainId: claim.sourceChainId,
          destChainId: claim.destinationChainId,
          amount: claimAmount,
        });
      } catch (err: unknown) {
        const errorMsg = getErrorMessage(err);
        updatePendingClaim(id, { status: "error", error: errorMsg });
        setPendingClaims((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: "error", error: errorMsg, updatedAt: Date.now() } : c))
        );
        onClaimErrorRef.current?.(err instanceof Error ? err : new Error(errorMsg));
        setActiveClaimId(null);
      }
    },
    // currentChainId read via ref; isConnected is a render value that guards the early return
    [isConnected, switchChainAsync, writeContractAsync]
  );

  const dismissClaim = useCallback((id: string) => {
    stopPolling(id);
    removePendingClaim(id);
    setPendingClaims((prev) => prev.filter((c) => c.id !== id));
  }, [stopPolling]);

  const resumePolling = useCallback(
    (id: string) => {
      const claim = pendingClaimsRef.current.find((c) => c.id === id);
      if (!claim) return;

      // Reset status to fetching-attestation and restart polling
      updatePendingClaim(id, { status: "fetching-attestation", error: undefined });
      setPendingClaims((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, status: "fetching-attestation" as const, error: undefined, updatedAt: Date.now() }
            : c
        )
      );
      startPolling(id);
    },
    [startPolling]
  );

  return {
    pendingClaims,
    addClaim,
    executeClaim,
    dismissClaim,
    resumePolling,
    activeClaimId,
    refresh: loadClaims,
  };
}
