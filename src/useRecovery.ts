import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount, useConfig } from "wagmi";
import { BridgeKit, resolveChainIdentifier, isRetryableError } from "@circle-fin/bridge-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { isEIP1193Provider, toHexString, createPublicClientGetter } from "./utils";
import { getBridgeChain } from "./useBridge";
import {
  loadPendingBridges,
  loadPendingBridgeById,
  removePendingBridge,
  updatePendingBridge,
  cleanupStaleBridges,
  type PendingBridgeRecord,
} from "./storage";

// Timeout for kit.retry() — prevents infinite attestation polling
// when the burn tx doesn't exist on-chain. 2 minutes is enough to detect
// valid attestations (the actual CCTP attestation takes ~15 min, but the
// first polling response returns quickly with 404 or data).
const RETRY_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Format recovery error messages for display in the widget UI.
 * Strips SDK wrapping and maps common wallet errors to user-friendly messages.
 */
function formatRecoveryError(stepName: string | null, rawError: string): string {
  const lower = rawError.toLowerCase();

  // Common wallet error: user rejected the prompt
  if (lower.includes("user rejected") || lower.includes("user denied")) {
    return "Transaction was rejected. Please try again.";
  }

  // Timeout
  if (lower.includes("timed out")) {
    return "Recovery timed out. Please try again.";
  }

  // Simulation failure — extract the chain name if present
  const simMatch = rawError.match(/Simulation failed on (\w+)/i);
  if (simMatch) {
    return `Transaction simulation failed on ${simMatch[1]}. The transfer may have already been claimed, or try again later.`;
  }

  // Generic fallback with step name context
  if (stepName) {
    return `Recovery failed at ${stepName} step. Please try again.`;
  }
  return "Recovery failed. Please try again.";
}


export interface UseRecoveryResult {
  pendingBridges: PendingBridgeRecord[];
  retryBridge: (id: string) => Promise<void>;
  dismissBridge: (id: string) => void;
  isRecovering: boolean;
  /** Last recovery error — includes bridge ID and message, cleared on next retry attempt */
  lastError: { bridgeId: string; message: string } | null;
  /** Brief success message after recovery completes, cleared on next retry attempt */
  lastSuccess: string | null;
  /** Reload pending bridges from localStorage */
  refresh: () => void;
}

export interface UseRecoveryOptions {
  enabled?: boolean;
  onRecoveryComplete?: (params: {
    sourceChainId: number;
    destChainId: number;
    amount: string;
    txHash?: `0x${string}`;
  }) => void;
  onRecoveryError?: (error: Error) => void;
  onPendingBridgeDetected?: (bridges: PendingBridgeRecord[]) => void;
}

export function useRecovery(options: UseRecoveryOptions = {}): UseRecoveryResult {
  const { enabled = true, onRecoveryComplete, onRecoveryError, onPendingBridgeDetected } = options;
  const { address, isConnected, connector } = useAccount();
  const wagmiConfig = useConfig();
  const [pendingBridges, setPendingBridges] = useState<PendingBridgeRecord[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastError, setLastError] = useState<{ bridgeId: string; message: string } | null>(null);
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Store configs and callbacks in refs to stabilize callback references
  const wagmiConfigRef = useRef(wagmiConfig);
  wagmiConfigRef.current = wagmiConfig;
  const onPendingBridgeDetectedRef = useRef(onPendingBridgeDetected);
  onPendingBridgeDetectedRef.current = onPendingBridgeDetected;
  const onRecoveryCompleteRef = useRef(onRecoveryComplete);
  onRecoveryCompleteRef.current = onRecoveryComplete;
  const onRecoveryErrorRef = useRef(onRecoveryError);
  onRecoveryErrorRef.current = onRecoveryError;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, []);

  const loadBridges = useCallback(() => {
    if (!enabled || !isConnected || !address) {
      setPendingBridges([]);
      return;
    }

    // Clean up stale records first
    cleanupStaleBridges();

    const bridges = loadPendingBridges(address);
    setPendingBridges(bridges);

    if (bridges.length > 0) {
      onPendingBridgeDetectedRef.current?.(bridges);
    }
  }, [enabled, isConnected, address]);

  // Load pending bridges on mount/address change
  useEffect(() => {
    loadBridges();
  }, [loadBridges]);

  const retryBridge = useCallback(
    async (id: string) => {
      // Read from localStorage (source of truth) to avoid stale in-memory list
      // if dismissBridge was called concurrently during an async retry flow.
      const record = loadPendingBridgeById(id);
      if (!record || !connector || !isConnected) {
        return;
      }

      setIsRecovering(true);
      setLastError(null);
      setLastSuccess(null);

      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      try {
        const provider = await connector.getProvider();
        if (!provider || !isEIP1193Provider(provider)) {
          throw new Error("Could not get wallet provider for recovery");
        }

        const adapter = await createViemAdapterFromProvider({
          provider,
          getPublicClient: createPublicClientGetter(wagmiConfigRef.current),
        });

        if (!isMountedRef.current) return;

        // Resolve full chain definitions from stored chain IDs.
        // The stored BridgeResult may have partial chain data (e.g., from handleBurn
        // before kit.bridge() resolved), so we reconstruct proper chain definitions
        // using Bridge Kit's resolveChainIdentifier.
        const sourceBridgeChain = getBridgeChain(record.sourceChainId);
        const destBridgeChain = getBridgeChain(record.destChainId);

        if (!sourceBridgeChain || !destBridgeChain) {
          throw new Error(
            `Unsupported chain for recovery: source=${record.sourceChainId}, dest=${record.destChainId}`
          );
        }

        const sourceChainDef = resolveChainIdentifier(sourceBridgeChain);
        const destChainDef = resolveChainIdentifier(destBridgeChain);

        // Patch the BridgeResult with full chain definitions
        const patchedResult = {
          ...record.bridgeResult,
          source: {
            ...record.bridgeResult.source,
            chain: sourceChainDef,
          },
          destination: {
            ...record.bridgeResult.destination,
            chain: destChainDef,
          },
        };

        // BridgeKit() requires no config for retry — it uses on-chain data from the BridgeResult
        const kit = new BridgeKit();

        const retryPromise = kit.retry(patchedResult, {
          from: adapter,
          to: adapter,
        });

        // Timeout guard: kit.retry() polls for attestation indefinitely if the
        // burn tx doesn't exist on-chain. Race against a timeout to avoid
        // leaving the UI in a stuck "Resuming..." state.
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error("Recovery timed out — the burn transaction may not have been confirmed on-chain. Please dismiss and try a new bridge.")),
            RETRY_TIMEOUT_MS,
          );
        });

        const result = await Promise.race([retryPromise, timeoutPromise]);
        clearTimeout(timeoutId);

        if (!isMountedRef.current) return;

        // Bridge Kit's retry() may resolve even when steps fail (same as bridge()).
        // Check that all steps actually completed before treating as success.
        const allStepsSucceeded = result.steps?.every(
          (s) => s.state === "success" || s.state === "noop"
        ) ?? false;

        if (allStepsSucceeded) {
          // All steps done - remove the record
          removePendingBridge(id);
          setPendingBridges((prev) => prev.filter((b) => b.id !== id));

          const mintStep = result.steps.find(
            (s) => s.name.toLowerCase() === "mint"
          );
          const txHash = toHexString(mintStep?.txHash);

          setLastSuccess(`Recovery complete! ${record.amount} USDC bridged successfully.`);
          // Auto-clear after 8 seconds so the banner doesn't persist forever
          if (successTimerRef.current) clearTimeout(successTimerRef.current);
          successTimerRef.current = setTimeout(() => {
            successTimerRef.current = null;
            if (isMountedRef.current) setLastSuccess(null);
          }, 8_000);

          onRecoveryCompleteRef.current?.({
            sourceChainId: record.sourceChainId,
            destChainId: record.destChainId,
            amount: record.amount,
            txHash,
          });
        } else {
          // Retry resolved but not all steps succeeded — keep as recovery-pending
          // so the user can try again via the Retry button.
          const failedStep = result.steps?.find((s) => s.state === "error");
          const stepName = failedStep?.name ?? "unknown";
          const rawStepError = failedStep?.errorMessage ?? "Step failed";
          // Strip redundant "X step failed: " prefix since we include step name
          const prefix = `${stepName} step failed: `;
          const stepError = rawStepError.toLowerCase().startsWith(prefix.toLowerCase())
            ? rawStepError.slice(prefix.length)
            : rawStepError;
          const userMsg = formatRecoveryError(stepName, stepError);

          updatePendingBridge(id, {
            bridgeResult: result,
            status: "recovery-pending",
          });
          setPendingBridges((prev) =>
            prev.map((b) =>
              b.id === id ? { ...b, status: "recovery-pending" as const, failureHint: undefined } : b
            )
          );
          setLastError({ bridgeId: id, message: userMsg });
          const err = new Error(`Recovery failed at ${stepName}: ${stepError}`);
          onRecoveryErrorRef.current?.(err);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (!isMountedRef.current) return;

        const errorMsg = error instanceof Error ? error.message : "Recovery failed";
        const userMsg = formatRecoveryError(null, errorMsg);

        if (isRetryableError(error)) {
          // Retryable error - keep record for another attempt
          updatePendingBridge(id, { status: "recovery-pending" });
          setLastError({ bridgeId: id, message: userMsg });
          onRecoveryErrorRef.current?.(error instanceof Error ? error : new Error(errorMsg));
        } else {
          // Non-retryable error — keep as recovery-pending so the user can
          // still retry. The Dismiss button is always available if they want
          // to give up.
          updatePendingBridge(id, { status: "recovery-pending" });
          setPendingBridges((prev) =>
            prev.map((b) =>
              b.id === id ? { ...b, status: "recovery-pending" as const, failureHint: undefined } : b
            )
          );

          setLastError({ bridgeId: id, message: userMsg });
          onRecoveryErrorRef.current?.(new Error(errorMsg));
        }
      } finally {
        if (isMountedRef.current) {
          setIsRecovering(false);
        }
      }
    },
    [connector, isConnected]
  );

  const dismissBridge = useCallback((id: string) => {
    removePendingBridge(id);
    setPendingBridges((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return {
    pendingBridges,
    retryBridge,
    dismissBridge,
    isRecovering,
    lastError,
    lastSuccess,
    refresh: loadBridges,
  };
}
