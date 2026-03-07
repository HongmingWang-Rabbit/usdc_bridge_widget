import { useState, useCallback, useRef, useEffect } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import type { ClaimState } from "./types";
import {
  CCTP_DOMAIN_IDS,
  CCTP_DOMAIN_TO_CHAIN_ID,
  MESSAGE_TRANSMITTER_V2_ADDRESS,
  CIRCLE_IRIS_API_URL,
  ATTESTATION_POLL_INTERVAL_MS,
  ATTESTATION_POLL_MAX_DURATION_MS,
  USDC_DECIMALS,
} from "./constants";
import { getErrorMessage, ensureHexPrefix } from "./utils";

// Minimal ABI for MessageTransmitterV2.receiveMessage
export const MESSAGE_TRANSMITTER_ABI = [
  {
    name: "receiveMessage",
    type: "function",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [{ name: "success", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export interface UseClaimOptions {
  onClaimSuccess?: (params: {
    sourceChainId: number;
    destChainId: number;
    amount: string;
    claimTxHash: `0x${string}`;
  }) => void;
  onClaimError?: (error: Error) => void;
  /**
   * Called when attestation is fetched and ready. Useful for persisting the claim
   * to the Pending tab and resetting the Claim form.
   */
  onAttestationReady?: (params: {
    sourceChainId: number;
    destinationChainId: number;
    burnTxHash: string;
    amount: string;
    attestation: { message: string; attestation: string; status: string };
    mintRecipient: string;
  }) => void;
}

export interface UseClaimResult {
  state: ClaimState;
  fetchAttestation: (sourceChainId: number, txHash: string) => Promise<void>;
  claim: () => Promise<void>;
  reset: () => void;
}

const IDLE_STATE: ClaimState = { status: "idle" };

/**
 * Parse the CCTP message to extract destination domain, amount, and mint recipient.
 * Supports both V1 (header = 116 bytes) and V2 (header = 148 bytes) messages.
 *
 * V1 header (116 bytes):
 *   version(4) + sourceDomain(4) + destDomain(4) + nonce(8)
 *   + sender(32) + recipient(32) + destCaller(32)
 *
 * V2 header (148 bytes):
 *   version(4) + sourceDomain(4) + destDomain(4) + nonce(32)
 *   + sender(32) + recipient(32) + destCaller(32)
 *   + minFinalityThreshold(4) + finalityThresholdExecuted(4)
 *
 * BurnMessage body (same field order in V1 and V2):
 *   version(4) + burnToken(32) + mintRecipient(32) + amount(32) + messageSender(32)
 *   V2 adds: maxFee(32) + feeExecuted(32) + expirationBlock(32) + hookData(variable)
 */
export function parseCCTPMessage(messageHex: string): {
  destinationDomain: number;
  mintRecipient: string;
  amount: bigint;
} {
  // Remove 0x prefix
  const hex = messageHex.startsWith("0x") ? messageHex.slice(2) : messageHex;

  // Version: bytes 0-3 (characters 0-8)
  const version = parseInt(hex.slice(0, 8), 16);

  // Destination domain: bytes 8-11 (characters 16-24) — same offset in V1 and V2
  const destinationDomain = parseInt(hex.slice(16, 24), 16);

  // Header size depends on version:
  // V1 (version 0): 116 bytes (nonce is 8 bytes)
  // V2 (version 1): 148 bytes (nonce is 32 bytes, plus 2 finality fields of 4 bytes each)
  const headerBytes = version >= 1 ? 148 : 116;
  const bodyOffset = headerBytes * 2; // hex chars

  const bodyHex = hex.slice(bodyOffset);

  // mintRecipient: body bytes 36-67 (characters 72-136), last 40 chars = 20-byte address
  const mintRecipientRaw = bodyHex.slice(72, 136);
  const mintRecipient = `0x${mintRecipientRaw.slice(-40)}`;

  // amount: body bytes 68-99 (characters 136-200)
  const amountHex = bodyHex.slice(136, 200);
  const amount = BigInt(`0x${amountHex}`);

  return { destinationDomain, mintRecipient, amount };
}

/**
 * Format a raw USDC amount (6 decimals) to a human-readable string.
 */
export function formatUSDCAmount(amount: bigint): string {
  const divisor = BigInt(10 ** USDC_DECIMALS);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionStr = fraction.toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
}

/**
 * Perform a single attestation poll against the Iris API.
 * Returns the attestation data if ready, `null` if still pending/not found,
 * or throws on unexpected errors.
 */
export async function pollAttestationOnce(
  domainId: number,
  txHash: string,
  signal?: AbortSignal
): Promise<{
  status: "not-found" | "pending" | "complete";
  message?: string;
  attestation?: string;
  destinationDomain?: number;
  mintRecipient?: string;
  amount?: bigint;
} | null> {
  const url = `${CIRCLE_IRIS_API_URL}/${domainId}?transactionHash=${txHash}`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    if (response.status === 404) return { status: "not-found" };
    throw new Error(`Iris API returned ${response.status}`);
  }

  const data = await response.json();
  const messages = data?.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return { status: "not-found" };
  }

  const msg = messages[0];
  if (!msg || typeof msg.message !== "string" || typeof msg.attestation !== "string") {
    throw new Error("Unexpected Iris API response format");
  }

  if (msg.attestation === "pending") {
    return { status: "pending", message: msg.message };
  }

  const messageHex = msg.message;
  const { destinationDomain, mintRecipient, amount } = parseCCTPMessage(messageHex);
  return {
    status: "complete",
    message: messageHex,
    attestation: msg.attestation,
    destinationDomain,
    mintRecipient,
    amount,
  };
}

/**
 * Hook for manual USDC claim via CCTP receiveMessage.
 * Fetches attestation from Circle's Iris API and calls receiveMessage on the destination chain.
 */
export function useClaim(options?: UseClaimOptions): UseClaimResult {
  const [state, setState] = useState<ClaimState>(IDLE_STATE);
  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Ref to hold attestation data needed by claim() — avoids re-creating claim on every state change
  const stateRef = useRef(state);
  stateRef.current = state;

  // Ref for currentChainId so claim() always reads the latest value
  const currentChainIdRef = useRef(currentChainId);
  currentChainIdRef.current = currentChainId;

  // Track the claim tx hash for receipt confirmation
  const [claimTxHash, setClaimTxHash] = useState<`0x${string}` | undefined>();

  const { isSuccess: isClaimConfirmed } = useWaitForTransactionReceipt({
    hash: claimTxHash,
  });

  // Store callbacks in refs
  const onClaimSuccessRef = useRef(options?.onClaimSuccess);
  onClaimSuccessRef.current = options?.onClaimSuccess;
  const onClaimErrorRef = useRef(options?.onClaimError);
  onClaimErrorRef.current = options?.onClaimError;
  const onAttestationReadyRef = useRef(options?.onAttestationReady);
  onAttestationReadyRef.current = options?.onAttestationReady;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  // Handle claim confirmation
  useEffect(() => {
    if (isClaimConfirmed && claimTxHash && state.status === "claiming") {
      const { sourceChainId, destinationChainId, formattedAmount } = state;
      if (sourceChainId == null || destinationChainId == null || formattedAmount == null) return;

      setState((prev) => ({
        ...prev,
        status: "success",
        claimTxHash,
      }));
      onClaimSuccessRef.current?.({
        sourceChainId,
        destChainId: destinationChainId,
        amount: formattedAmount,
        claimTxHash,
      });
    }
  }, [isClaimConfirmed, claimTxHash, state.status, state.sourceChainId, state.destinationChainId, state.formattedAmount]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollAttestation = useCallback(
    async (domainId: number, txHash: string, sourceChainId: number) => {
      // Check timeout
      if (Date.now() - pollStartRef.current > ATTESTATION_POLL_MAX_DURATION_MS) {
        const timeoutMinutes = Math.round(ATTESTATION_POLL_MAX_DURATION_MS / 60_000);
        setState((prev) => ({
          ...prev,
          status: "error",
          error: `Attestation polling timed out after ${timeoutMinutes} minutes. The attestation may still be processing — try again later.`,
        }));
        return;
      }

      // Schedule the next poll iteration
      const scheduleNext = () => {
        pollTimerRef.current = setTimeout(
          () => void pollAttestation(domainId, txHash, sourceChainId),
          ATTESTATION_POLL_INTERVAL_MS
        );
      };

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const result = await pollAttestationOnce(domainId, txHash, controller.signal);

        if (!result) { scheduleNext(); return; }

        if (result.status === "not-found") {
          scheduleNext();
          return;
        }

        if (result.status === "pending") {
          setState((prev) => ({
            ...prev,
            status: "attestation-pending",
            attestation: {
              message: result.message ?? "",
              attestation: "",
              status: "pending",
            },
          }));
          scheduleNext();
          return;
        }

        // complete — guard against missing fields
        if (!result.message || !result.attestation) {
          scheduleNext();
          return;
        }

        const destinationChainId = result.destinationDomain !== undefined
          ? CCTP_DOMAIN_TO_CHAIN_ID[result.destinationDomain]
          : undefined;
        const formattedAmt = result.amount !== undefined ? formatUSDCAmount(result.amount) : "0";

        setState((prev) => ({
          ...prev,
          status: "attestation-ready",
          attestation: {
            message: result.message!,
            attestation: result.attestation!,
            status: "complete",
          },
          destinationChainId,
          formattedAmount: formattedAmt,
          mintRecipient: result.mintRecipient,
        }));
        stopPolling();

        // Notify consumer (e.g., BridgeWidget) that attestation is ready
        if (destinationChainId != null) {
          onAttestationReadyRef.current?.({
            sourceChainId,
            destinationChainId,
            burnTxHash: txHash,
            amount: formattedAmt,
            attestation: { message: result.message!, attestation: result.attestation!, status: "complete" },
            mintRecipient: result.mintRecipient ?? "",
          });
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;

        setState((prev) => ({
          ...prev,
          status: "error",
          error: getErrorMessage(err),
        }));
        stopPolling();
      }
    },
    [stopPolling]
  );

  const fetchAttestation = useCallback(
    async (sourceChainId: number, txHash: string) => {
      // Validate tx hash format
      if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        setState({
          status: "error",
          sourceChainId,
          error: "Invalid transaction hash. Must be a 66-character hex string starting with 0x.",
        });
        return;
      }

      // Validate source chain
      const domainId = CCTP_DOMAIN_IDS[sourceChainId];
      if (domainId === undefined) {
        setState({
          status: "error",
          sourceChainId,
          error: `Chain ID ${sourceChainId} is not a supported CCTP chain.`,
        });
        return;
      }

      // Stop any existing polling
      stopPolling();

      setState({
        status: "fetching-attestation",
        sourceChainId,
      });

      pollStartRef.current = Date.now();
      await pollAttestation(domainId, txHash, sourceChainId);
    },
    [stopPolling, pollAttestation]
  );

  const claim = useCallback(async () => {
    const current = stateRef.current;
    if (current.status !== "attestation-ready" || !current.attestation || !current.destinationChainId) {
      return;
    }

    if (!isConnected) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "Wallet not connected.",
      }));
      return;
    }

    // Switch chain if needed (read from ref to avoid stale closure)
    if (currentChainIdRef.current !== current.destinationChainId) {
      try {
        await switchChainAsync({ chainId: current.destinationChainId });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: `Failed to switch chain: ${getErrorMessage(err)}`,
        }));
        return;
      }
    }

    setState((prev) => ({ ...prev, status: "claiming" }));

    try {
      const messageHex = ensureHexPrefix(current.attestation.message);
      const attestationHex = ensureHexPrefix(current.attestation.attestation);

      const txHash = await writeContractAsync({
        address: MESSAGE_TRANSMITTER_V2_ADDRESS,
        abi: MESSAGE_TRANSMITTER_ABI,
        functionName: "receiveMessage",
        args: [messageHex, attestationHex],
        chainId: current.destinationChainId,
      });

      setClaimTxHash(txHash);
      // Success state will be set by the useWaitForTransactionReceipt effect
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);

      // Detect "already claimed" / "nonce already used" reverts
      const isAlreadyClaimed =
        errorMessage.toLowerCase().includes("nonce already used") ||
        errorMessage.toLowerCase().includes("already received");

      setState((prev) => ({
        ...prev,
        status: "error",
        error: isAlreadyClaimed
          ? "This transfer has already been claimed. The USDC should be in the destination wallet."
          : errorMessage,
      }));
      onClaimErrorRef.current?.(
        err instanceof Error ? err : new Error(errorMessage)
      );
    }
    // currentChainId read via ref; isConnected is a render value that guards the early return
  }, [isConnected, switchChainAsync, writeContractAsync]);

  const reset = useCallback(() => {
    stopPolling();
    setClaimTxHash(undefined);
    setState(IDLE_STATE);
  }, [stopPolling]);

  return { state, fetchAttestation, claim, reset };
}
