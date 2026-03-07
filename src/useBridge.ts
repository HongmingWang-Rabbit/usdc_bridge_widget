import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { BridgeKit, BridgeChain } from "@circle-fin/bridge-kit";
import type { BridgeResult as BridgeKitResult } from "@circle-fin/bridge-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import type { BridgeChainConfig } from "./types";
import { isEIP1193Provider } from "./utils";
import {
  savePendingBridge,
  updatePendingBridge,
  removePendingBridge,
  loadPendingBridgeById,
} from "./storage";

// Maximum number of events to retain to prevent memory growth.
// 100 events is sufficient to track a full bridge lifecycle (approve, burn, attestation, mint)
// while preventing unbounded memory growth in long-running sessions.
const MAX_EVENTS = 100;

// Chain ID to BridgeChain enum mapping
// Bridge Kit uses specific chain identifiers from the BridgeChain enum
// NOTE: This mapping must be kept in sync with Circle's Bridge Kit SDK updates.
// When Circle adds new chains, add the corresponding mapping here.
const CHAIN_ID_TO_BRIDGE_CHAIN: Record<number, BridgeChain> = {
  1: BridgeChain.Ethereum,
  42161: BridgeChain.Arbitrum,
  43114: BridgeChain.Avalanche,
  8453: BridgeChain.Base,
  10: BridgeChain.Optimism,
  137: BridgeChain.Polygon,
  59144: BridgeChain.Linea,
  130: BridgeChain.Unichain,
  146: BridgeChain.Sonic,
  480: BridgeChain.World_Chain,
  // Note: Monad (10200) not yet supported in Circle Bridge Kit
  1329: BridgeChain.Sei,
  50: BridgeChain.XDC,
  999: BridgeChain.HyperEVM,
  57073: BridgeChain.Ink,
  98866: BridgeChain.Plume,
  81224: BridgeChain.Codex,
};

// Represents a single step in a BridgeResult from Bridge Kit
interface BridgeResultStep {
  name?: string;
  state?: string;
  txHash?: string;
  errorMessage?: string;
}

// Type guard for Bridge Kit event with txHash
interface BridgeEventWithTxHash {
  values?: {
    txHash?: string;
  };
}

function isBridgeEventWithTxHash(event: unknown): event is BridgeEventWithTxHash {
  return (
    typeof event === "object" &&
    event !== null &&
    ("values" in event ? typeof (event as BridgeEventWithTxHash).values === "object" : true)
  );
}

function extractTxHash(event: unknown): `0x${string}` | undefined {
  if (isBridgeEventWithTxHash(event) && event.values?.txHash) {
    const hash = event.values.txHash;
    if (typeof hash === "string" && hash.startsWith("0x")) {
      return hash as `0x${string}`;
    }
  }
  return undefined;
}

export function getBridgeChain(chainId: number): BridgeChain | undefined {
  return CHAIN_ID_TO_BRIDGE_CHAIN[chainId];
}

export function getChainName(chainId: number): string {
  const bridgeChain = CHAIN_ID_TO_BRIDGE_CHAIN[chainId];
  return bridgeChain || `Chain_${chainId}`;
}

export interface BridgeParams {
  sourceChainConfig: BridgeChainConfig;
  destChainConfig: BridgeChainConfig;
  amount: string;
  recipientAddress?: `0x${string}`;
}

export interface BridgeState {
  status: "idle" | "loading" | "approving" | "burning" | "fetching-attestation" | "minting" | "success" | "error";
  txHash?: `0x${string}`;
  error?: Error;
  events: BridgeEvent[];
}

export interface BridgeEvent {
  type: string;
  timestamp: number;
  data?: unknown;
}

// Bridge Kit may include a partial BridgeResult in thrown errors
function extractBridgeResultFromError(error: unknown): BridgeKitResult | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "result" in error &&
    typeof (error as { result: unknown }).result === "object" &&
    (error as { result: { steps?: unknown } }).result !== null &&
    Array.isArray((error as { result: { steps?: unknown[] } }).result.steps)
  ) {
    return (error as { result: BridgeKitResult }).result;
  }
  return undefined;
}

export interface BridgePersistenceConfig {
  walletAddress: string;
  sourceChainId: number;
  destChainId: number;
}

export interface UseBridgeResult {
  bridge: (params: BridgeParams) => Promise<void>;
  state: BridgeState;
  reset: () => void;
}

/**
 * Hook to execute USDC bridge transfers using Circle's Bridge Kit.
 *
 * @param persistence - Optional persistence config. When provided, the hook
 * saves bridge progress to localStorage so incomplete transfers can be recovered.
 */
export function useBridge(persistence?: BridgePersistenceConfig): UseBridgeResult {
  const { connector, isConnected } = useAccount();
  const [state, setState] = useState<BridgeState>({
    status: "idle",
    events: [],
  });

  // Track if component is mounted to avoid state updates after unmount
  const isMountedRef = useRef(true);

  // Track current bridge operation for cancellation
  const currentBridgeRef = useRef<{
    aborted: boolean;
    kit: BridgeKit | null;
  } | null>(null);

  // Track the pending bridge record ID for persistence updates
  const pendingRecordIdRef = useRef<string | null>(null);

  // Store persistence config in ref to avoid object identity issues in useCallback deps
  const persistenceRef = useRef(persistence);
  persistenceRef.current = persistence;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Mark any ongoing operation as aborted
      if (currentBridgeRef.current) {
        currentBridgeRef.current.aborted = true;
      }
    };
  }, []);

  const addEvent = useCallback((type: string, data?: unknown) => {
    if (!isMountedRef.current) return;
    setState((prev) => {
      const newEvents = [...prev.events, { type, timestamp: Date.now(), data }];
      // Limit events to prevent memory growth
      if (newEvents.length > MAX_EVENTS) {
        newEvents.splice(0, newEvents.length - MAX_EVENTS);
      }
      return { ...prev, events: newEvents };
    });
  }, []);

  const reset = useCallback(() => {
    // Abort any ongoing operation
    if (currentBridgeRef.current) {
      currentBridgeRef.current.aborted = true;
    }
    currentBridgeRef.current = null;
    setState({ status: "idle", events: [] });
  }, []);

  const bridge = useCallback(
    async (params: BridgeParams) => {
      const { sourceChainConfig, destChainConfig, amount, recipientAddress } = params;

      // Abort any previous operation
      if (currentBridgeRef.current) {
        currentBridgeRef.current.aborted = true;
      }

      // Create new operation tracking
      const operation = { aborted: false, kit: null as BridgeKit | null };
      currentBridgeRef.current = operation;

      if (!isConnected || !connector) {
        setState({
          status: "error",
          error: new Error("Wallet not connected"),
          events: [],
        });
        return;
      }

      setState({ status: "loading", events: [] });
      addEvent("start", { amount, sourceChain: sourceChainConfig.chain.id, destChain: destChainConfig.chain.id });

      // Cleanup function - will be assigned once handlers are set up
      let cleanupListeners: (() => void) | null = null;

      try {
        // Get the EIP-1193 provider from the wagmi connector
        const provider = await connector.getProvider();

        if (!provider) {
          throw new Error("Could not get wallet provider from connector");
        }

        // Validate provider is EIP-1193 compatible
        if (!isEIP1193Provider(provider)) {
          throw new Error("Wallet provider is not EIP-1193 compatible");
        }

        // Create adapter from the connected wallet's provider
        const adapter = await createViemAdapterFromProvider({
          provider,
        });

        // Check if aborted before continuing
        if (operation.aborted) {
          return;
        }

        // Initialize Bridge Kit
        const kit = new BridgeKit();
        operation.kit = kit;

        // Resolve BridgeChain identifiers early so handlers can use them
        const sourceBridgeChain = getBridgeChain(sourceChainConfig.chain.id);
        const destBridgeChain = getBridgeChain(destChainConfig.chain.id);

        if (!sourceBridgeChain) {
          throw new Error(`Unsupported source chain: ${sourceChainConfig.chain.name} (${sourceChainConfig.chain.id})`);
        }
        if (!destBridgeChain) {
          throw new Error(`Unsupported destination chain: ${destChainConfig.chain.name} (${destChainConfig.chain.id})`);
        }

        // Read persistence config from ref (stable reference)
        const persistence = persistenceRef.current;

        // Event handlers with abort checks
        // Bridge Kit fires events when each step COMPLETES (per Circle docs:
        // "Approval completed", "Burn completed", etc.), so each handler
        // advances the status to the NEXT step in the pipeline.
        const handleApprove = (event: unknown) => {
          if (operation.aborted || !isMountedRef.current) return;
          addEvent("approve", event);
          // Approve completed → burn is next
          setState((prev) => ({
            ...prev,
            status: "burning",
            txHash: extractTxHash(event),
          }));
        };

        const handleBurn = (event: unknown) => {
          if (operation.aborted || !isMountedRef.current) return;
          addEvent("burn", event);
          // Burn completed → attestation polling is next
          setState((prev) => ({
            ...prev,
            status: "fetching-attestation",
            txHash: extractTxHash(event),
          }));

          // Burn is the point of no return - persist the record
          if (persistence) {
            const burnTxHash = extractTxHash(event);
            // Build a partial BridgeResult to persist for recovery.
            // Bridge Kit's retry() uses the steps array to determine where to resume.
            // Note: This partial result has minimal chain data; the full BridgeResult
            // (with RPC endpoints, contracts, etc.) is stored when kit.bridge() resolves.
            const partialResult = {
              amount,
              token: "USDC",
              state: "pending",
              provider: "CCTPV2BridgingProvider",
              source: {
                address: persistence.walletAddress,
                chain: { name: sourceBridgeChain },
              },
              destination: {
                address: persistence.walletAddress,
                chain: { name: destBridgeChain },
              },
              steps: [
                { name: "approve", state: "success" },
                { name: "burn", state: "success", ...(burnTxHash ? { txHash: burnTxHash } : {}) },
              ],
            } as BridgeKitResult;

            const record = savePendingBridge({
              walletAddress: persistence.walletAddress.toLowerCase(),
              sourceChainId: persistence.sourceChainId,
              destChainId: persistence.destChainId,
              amount,
              bridgeResult: partialResult,
              status: "in-progress",
            });

            if (record) {
              pendingRecordIdRef.current = record.id;
            }
          }
        };

        const handleFetchAttestation = (event: unknown) => {
          if (operation.aborted || !isMountedRef.current) return;
          addEvent("fetchAttestation", event);
          // Attestation received → mint is next
          setState((prev) => ({
            ...prev,
            status: "minting",
          }));

          // Update persisted record with attestation step
          if (pendingRecordIdRef.current) {
            const record = loadPendingBridgeById(pendingRecordIdRef.current);
            if (record?.bridgeResult?.steps) {
              record.bridgeResult.steps.push({ name: "fetchAttestation", state: "success" });
              updatePendingBridge(pendingRecordIdRef.current, {
                bridgeResult: record.bridgeResult,
                status: "in-progress",
              });
            } else {
              updatePendingBridge(pendingRecordIdRef.current, { status: "in-progress" });
            }
          }
        };

        const handleMint = (event: unknown) => {
          if (operation.aborted || !isMountedRef.current) return;
          addEvent("mint", event);
          setState((prev) => ({
            ...prev,
            status: "minting",
            txHash: extractTxHash(event),
          }));

          // Update persisted record with mint step
          if (pendingRecordIdRef.current) {
            const mintTxHash = extractTxHash(event);
            const record = loadPendingBridgeById(pendingRecordIdRef.current);
            if (record?.bridgeResult?.steps) {
              record.bridgeResult.steps.push({
                name: "mint",
                state: "success",
                ...(mintTxHash ? { txHash: mintTxHash } : {}),
              });
              updatePendingBridge(pendingRecordIdRef.current, {
                bridgeResult: record.bridgeResult,
                status: "in-progress",
              });
            } else {
              updatePendingBridge(pendingRecordIdRef.current, { status: "in-progress" });
            }
          }
        };

        // Assign cleanup function now that handlers are created
        cleanupListeners = () => {
          try {
            kit.off("approve", handleApprove);
            kit.off("burn", handleBurn);
            kit.off("fetchAttestation", handleFetchAttestation);
            kit.off("mint", handleMint);
          } catch {
            // Bridge Kit's off() method may not exist in all versions or may throw
            // if listeners were already removed. Safe to ignore during cleanup.
          }
        };

        // Subscribe to events
        kit.on("approve", handleApprove);
        kit.on("burn", handleBurn);
        kit.on("fetchAttestation", handleFetchAttestation);
        kit.on("mint", handleMint);

        // Advance to "approving" since approve is the first step
        if (!operation.aborted && isMountedRef.current) {
          setState((prev) => ({ ...prev, status: "approving" }));
        }

        // Execute the bridge transfer
        // According to Circle docs, recipientAddress goes inside the 'to' object
        const result = await kit.bridge({
          from: { adapter, chain: sourceBridgeChain },
          to: recipientAddress
            ? { adapter, chain: destBridgeChain, recipientAddress }
            : { adapter, chain: destBridgeChain },
          amount,
        });

        // Clean up event listeners after bridge completes
        cleanupListeners();

        // Check if aborted before processing result
        if (operation.aborted || !isMountedRef.current) {
          return;
        }

        addEvent("complete", result);

        // Check if all steps actually completed successfully
        // Bridge Kit may resolve even when mint was rejected/failed
        const allStepsSucceeded = result.steps?.every(
          (s: BridgeResultStep) => s.state === "success" || s.state === "noop"
        ) ?? false;

        if (pendingRecordIdRef.current) {
          if (allStepsSucceeded) {
            removePendingBridge(pendingRecordIdRef.current);
          } else {
            // Bridge Kit resolved but not all steps completed - keep for recovery
            updatePendingBridge(pendingRecordIdRef.current, {
              bridgeResult: result,
              status: "recovery-pending",
            });
          }
          pendingRecordIdRef.current = null;
        } else if (!allStepsSucceeded && persistence) {
          // No record exists yet (handleBurn may not have fired), but burn step succeeded
          // This means USDC is burned and needs recovery
          const burnStep = result.steps?.find(
            (s: BridgeResultStep) => s.name === "burn" && s.state === "success"
          );
          if (burnStep) {
            savePendingBridge({
              walletAddress: persistence.walletAddress.toLowerCase(),
              sourceChainId: persistence.sourceChainId,
              destChainId: persistence.destChainId,
              amount,
              bridgeResult: result,
              status: "recovery-pending",
            });
          }
        }

        if (allStepsSucceeded) {
          setState((prev) => ({
            ...prev,
            status: "success",
            txHash: extractTxHash(result),
          }));
        } else {
          // Build descriptive error from the failed step
          const failedStep = result.steps?.find((s: BridgeResultStep) => s.state === "error");
          const stepName = failedStep?.name ?? "unknown";
          const stepError = failedStep?.errorMessage ?? "Step failed";
          setState((prev) => ({
            ...prev,
            status: "error",
            txHash: extractTxHash(result),
            error: new Error(`Bridge failed at ${stepName}: ${stepError}`),
          }));
        }
      } catch (error) {
        // Clean up event listeners on error if they were set up
        if (cleanupListeners) {
          cleanupListeners();
        }

        // Don't update state if operation was aborted
        if (operation.aborted || !isMountedRef.current) {
          return;
        }

        // Update persisted record to recovery-pending so it can be retried
        if (pendingRecordIdRef.current) {
          // Try to extract a BridgeResult from the error for better retry support
          const errorResult = extractBridgeResultFromError(error);
          if (errorResult) {
            updatePendingBridge(pendingRecordIdRef.current, {
              bridgeResult: errorResult,
              status: "recovery-pending",
            });
          } else {
            updatePendingBridge(pendingRecordIdRef.current, {
              status: "recovery-pending",
            });
          }
          pendingRecordIdRef.current = null;
        } else if (persistence) {
          // Fallback: if no record was saved during burn but the error contains a BridgeResult,
          // create a new recovery record so the user can still recover
          const errorResult = extractBridgeResultFromError(error);
          if (errorResult) {
            savePendingBridge({
              walletAddress: persistence.walletAddress.toLowerCase(),
              sourceChainId: persistence.sourceChainId,
              destChainId: persistence.destChainId,
              amount: params.amount,
              bridgeResult: errorResult,
              status: "recovery-pending",
            });
          }
        }

        addEvent("error", error);
        setState((prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error : new Error("Bridge transfer failed"),
        }));
        throw error;
      }
    },
    [isConnected, connector, addEvent]
  );

  return { bridge, state, reset };
}

export interface BridgeQuote {
  estimatedGasFee: string;
  bridgeFee: string;
  totalFee: string;
  estimatedTime: string;
  expiresAt?: number;
}

/**
 * Hook to get a quote for a bridge transfer.
 *
 * **Note:** This hook currently returns static CCTP standard estimates because
 * Circle's `kit.estimate()` requires an adapter with an active wallet connection.
 * For accurate gas estimates, the wallet will provide them during transaction signing.
 *
 * @param sourceChainId - Source chain ID
 * @param destChainId - Destination chain ID
 * @param amount - Amount to bridge (as string)
 * @returns Quote with estimated fees and timing (static values)
 *
 * @example
 * const { quote, isLoading, error } = useBridgeQuote(1, 8453, "100");
 * // quote.estimatedTime -> "~15-20 minutes"
 * // quote.bridgeFee -> "0-14 bps (FAST) / 0 (SLOW)"
 */
export function useBridgeQuote(
  sourceChainId: number | undefined,
  destChainId: number | undefined,
  amount: string
) {
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!sourceChainId || !destChainId || !amount || parseFloat(amount) <= 0) {
      setQuote(null);
      setError(null);
      return;
    }

    const fetchQuote = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const sourceBridgeChain = getBridgeChain(sourceChainId);
        const destBridgeChain = getBridgeChain(destChainId);

        // If chains are not supported, return basic estimate
        if (!sourceBridgeChain || !destBridgeChain) {
          setQuote({
            estimatedGasFee: "Estimated by wallet",
            bridgeFee: "0.00",
            totalFee: "Gas only",
            estimatedTime: "~15-20 minutes",
          });
          return;
        }

        // Note: kit.estimate() requires an adapter with wallet connection
        // For pre-bridge quotes without wallet, we return CCTP standard estimates
        // CCTP V2 FAST transfers: 1-14 bps fee, SLOW transfers: 0 bps
        // Gas fees are estimated by the wallet during actual transaction
        setQuote({
          estimatedGasFee: "Estimated by wallet",
          bridgeFee: "0-14 bps (FAST) / 0 (SLOW)",
          totalFee: "Gas + protocol fee",
          estimatedTime: "~15-20 minutes",
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to get quote"));
        setQuote(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Track if this effect is still active
    let isActive = true;

    const debounceTimer = setTimeout(() => {
      if (isActive) {
        fetchQuote();
      }
    }, 500);

    return () => {
      isActive = false;
      clearTimeout(debounceTimer);
    };
  }, [sourceChainId, destChainId, amount]);

  return { quote, isLoading, error };
}
