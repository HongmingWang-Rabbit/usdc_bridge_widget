import { useState, useCallback, useEffect, useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, erc20Abi } from "viem";
import type { BridgeChainConfig, BridgeEstimate } from "./types";
import { USDC_DECIMALS } from "./constants";
import { formatNumber } from "./utils";
import { getBridgeChain } from "./useBridge";

/**
 * Hook to get USDC balance for a specific chain
 */
export function useUSDCBalance(chainConfig: BridgeChainConfig | undefined) {
  const { address } = useAccount();

  const {
    data: balance,
    isLoading: queryLoading,
    refetch,
  } = useReadContract({
    address: chainConfig?.usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!chainConfig?.usdcAddress,
    },
  });

  // Only show loading when wallet is connected and query is actually running
  const isLoading = !!address && queryLoading;

  return {
    balance: balance ?? 0n,
    balanceFormatted: balance ? formatUnits(balance, USDC_DECIMALS) : "0",
    isLoading,
    refetch,
  };
}

/**
 * Hook to get USDC balances for all configured chains at once.
 * Uses multicall for efficient batch fetching.
 *
 * @param chainConfigs - Array of chain configurations to fetch balances for
 * @returns Object with balances mapped by chain ID, loading state, and refetch function
 *
 * @example
 * const { balances, isLoading, refetch } = useAllUSDCBalances(chains);
 * // balances[1] -> { balance: 1000000n, formatted: "1.00" }
 */
export function useAllUSDCBalances(chainConfigs: BridgeChainConfig[]): {
  balances: Record<number, { balance: bigint; formatted: string }>;
  isLoading: boolean;
  refetch: () => void;
} {
  const { address } = useAccount();

  // Build contract read configs for all chains
  const contracts = useMemo(() => {
    if (!address) return [];
    return chainConfigs
      .filter((config) => config.usdcAddress)
      .map((config) => ({
        address: config.usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf" as const,
        args: [address] as const,
        chainId: config.chain.id,
      }));
  }, [address, chainConfigs]);

  const {
    data: results,
    isLoading: queryLoading,
    refetch,
  } = useReadContracts({
    contracts,
    query: {
      enabled: !!address && contracts.length > 0,
    },
  });

  // Only show loading when wallet is connected and query is actually running
  const isLoading = !!address && queryLoading;

  // Map results to chain IDs
  const balances = useMemo(() => {
    const balanceMap: Record<
      number,
      { balance: bigint; formatted: string }
    > = {};

    if (!results) return balanceMap;

    chainConfigs.forEach((config, index) => {
      const result = results[index];
      if (result?.status === "success" && typeof result.result === "bigint") {
        balanceMap[config.chain.id] = {
          balance: result.result,
          formatted: formatUnits(result.result, USDC_DECIMALS),
        };
      } else {
        balanceMap[config.chain.id] = {
          balance: 0n,
          formatted: "0",
        };
      }
    });

    return balanceMap;
  }, [results, chainConfigs]);

  return {
    balances,
    isLoading,
    refetch: refetch as () => void,
  };
}

/**
 * Hook to check and handle USDC allowance
 */
export function useUSDCAllowance(
  chainConfig: BridgeChainConfig | undefined,
  spenderAddress?: `0x${string}`
) {
  const { address } = useAccount();
  const effectiveSpender =
    spenderAddress || chainConfig?.tokenMessengerAddress;

  const {
    data: allowance,
    isLoading: queryLoading,
    refetch,
  } = useReadContract({
    address: chainConfig?.usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      address && effectiveSpender ? [address, effectiveSpender] : undefined,
    query: {
      enabled: !!address && !!chainConfig?.usdcAddress && !!effectiveSpender,
    },
  });

  // Only show loading when wallet is connected and query is actually running
  const isLoading = !!address && queryLoading;

  const { writeContractAsync, isPending: isApproving } = useWriteContract();
  const [approvalTxHash, setApprovalTxHash] = useState<
    `0x${string}` | undefined
  >();
  const [approvalError, setApprovalError] = useState<Error | null>(null);

  const { isLoading: isConfirming, isSuccess: isApprovalConfirmed } =
    useWaitForTransactionReceipt({
      hash: approvalTxHash,
    });

  const approve = useCallback(
    async (amount: string): Promise<`0x${string}`> => {
      if (!chainConfig?.usdcAddress || !effectiveSpender) {
        throw new Error("Missing chain config or spender address");
      }

      setApprovalError(null);
      try {
        const amountBigInt = parseUnits(amount, USDC_DECIMALS);
        const hash = await writeContractAsync({
          address: chainConfig.usdcAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [effectiveSpender, amountBigInt],
        });
        setApprovalTxHash(hash);
        return hash;
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error("Approval failed");
        setApprovalError(err);
        throw err;
      }
    },
    [chainConfig?.usdcAddress, effectiveSpender, writeContractAsync]
  );

  useEffect(() => {
    if (isApprovalConfirmed) {
      refetch();
    }
  }, [isApprovalConfirmed, refetch]);

  const needsApproval = useCallback(
    (amount: string) => {
      // Early return for invalid inputs
      if (!amount || !allowance) return false;

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) return false;

      try {
        const amountBigInt = parseUnits(amount, USDC_DECIMALS);
        return allowance < amountBigInt;
      } catch {
        // Parsing failed - amount is invalid, return false
        return false;
      }
    },
    [allowance]
  );

  return {
    allowance: allowance ?? 0n,
    allowanceFormatted: allowance ? formatUnits(allowance, USDC_DECIMALS) : "0",
    isLoading,
    isApproving: isApproving || isConfirming,
    approve,
    needsApproval,
    refetch,
    approvalError,
  };
}

/**
 * Hook to estimate bridge costs using Circle Bridge Kit SDK
 *
 * @deprecated This hook is deprecated and will be removed in a future version.
 * Use `useBridgeQuote` from `useBridge.ts` instead for SDK-based estimates.
 *
 * Note: kit.estimate() requires an adapter with wallet connection.
 * For pre-bridge quotes without wallet, we return CCTP standard estimates.
 *
 * @example
 * // Before (deprecated):
 * const { estimate } = useBridgeEstimate(sourceChainId, destChainId, amount);
 *
 * // After (recommended):
 * import { useBridgeQuote } from './useBridge';
 * const { quote } = useBridgeQuote(sourceChainId, destChainId, amount);
 */
export function useBridgeEstimate(
  sourceChainId: number | undefined,
  destChainId: number | undefined,
  amount: string
) {
  // Emit deprecation warning once
  useEffect(() => {
    console.warn(
      "[DEPRECATED] useBridgeEstimate is deprecated and will be removed in a future version. " +
      "Use useBridgeQuote from './useBridge' instead."
    );
  }, []);

  const [estimate, setEstimate] = useState<BridgeEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchEstimate = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0 || !sourceChainId || !destChainId) {
      setEstimate(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const sourceBridgeChain = getBridgeChain(sourceChainId);
      const destBridgeChain = getBridgeChain(destChainId);

      // If chains are not supported, return basic estimate
      if (!sourceBridgeChain || !destBridgeChain) {
        setEstimate({
          gasFee: "Estimated by wallet",
          bridgeFee: "0.00",
          totalFee: "Gas only",
          estimatedTime: "~15-20 minutes",
        });
        setIsLoading(false);
        return;
      }

      // Note: kit.estimate() requires an adapter with wallet connection
      // For pre-bridge quotes without wallet, we return CCTP standard estimates
      // CCTP V2 FAST transfers: 1-14 bps fee, SLOW transfers: 0 bps
      setEstimate({
        gasFee: "Estimated by wallet",
        bridgeFee: "0-14 bps (FAST) / 0 (SLOW)",
        totalFee: "Gas + protocol fee",
        estimatedTime: "~15-20 minutes",
      });
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to estimate bridge cost");
      setError(error);
      setEstimate(null);
    } finally {
      setIsLoading(false);
    }
  }, [sourceChainId, destChainId, amount]);

  useEffect(() => {
    // Track if this effect is still active
    let isActive = true;

    const debounceTimer = setTimeout(() => {
      if (isActive) {
        fetchEstimate();
      }
    }, 500);

    return () => {
      isActive = false;
      clearTimeout(debounceTimer);
    };
  }, [fetchEstimate]);

  return { estimate, isLoading, error };
}

/**
 * Hook to format numbers for display
 *
 * @deprecated This hook is deprecated and will be removed in a future version.
 * Use the `formatNumber` utility function directly from `utils.ts` instead.
 * The hook adds unnecessary overhead with useCallback for a pure function.
 *
 * @example
 * // Before (deprecated):
 * const format = useFormatNumber();
 * const formatted = format(1234.56, 2);
 *
 * // After (recommended):
 * import { formatNumber } from './utils';
 * const formatted = formatNumber(1234.56, 2);
 */
export function useFormatNumber() {
  // Emit deprecation warning once
  useEffect(() => {
    console.warn(
      "[DEPRECATED] useFormatNumber is deprecated and will be removed in a future version. " +
      "Use the formatNumber utility function from './utils' directly instead."
    );
  }, []);

  return useCallback(
    (value: string | number, decimals: number = 2): string => {
      return formatNumber(value, decimals);
    },
    []
  );
}
