import { useState, useCallback, useEffect, useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, erc20Abi } from "viem";
import type { BridgeChainConfig, BridgeEstimate } from "./types";

const USDC_DECIMALS = 6;

/**
 * Hook to get USDC balance for a specific chain
 */
export function useUSDCBalance(chainConfig: BridgeChainConfig | undefined) {
  const { address } = useAccount();

  const { data: balance, isLoading, refetch } = useReadContract({
    address: chainConfig?.usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!chainConfig?.usdcAddress,
    },
  });

  return {
    balance: balance ?? 0n,
    balanceFormatted: balance ? formatUnits(balance, USDC_DECIMALS) : "0",
    isLoading,
    refetch,
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
  const effectiveSpender = spenderAddress || chainConfig?.tokenMessengerAddress;

  const { data: allowance, isLoading, refetch } = useReadContract({
    address: chainConfig?.usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && effectiveSpender ? [address, effectiveSpender] : undefined,
    query: {
      enabled: !!address && !!chainConfig?.usdcAddress && !!effectiveSpender,
    },
  });

  const { writeContractAsync, isPending: isApproving } = useWriteContract();
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | undefined>();

  const { isLoading: isConfirming, isSuccess: isApprovalConfirmed } =
    useWaitForTransactionReceipt({
      hash: approvalTxHash,
    });

  const approve = useCallback(
    async (amount: string) => {
      if (!chainConfig?.usdcAddress || !effectiveSpender) return;

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
        console.error("Approval failed:", error);
        throw error;
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
      if (!amount || parseFloat(amount) <= 0 || !allowance) return false;
      try {
        const amountBigInt = parseUnits(amount, USDC_DECIMALS);
        return allowance < amountBigInt;
      } catch {
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
  };
}

/**
 * Hook to estimate bridge costs
 */
export function useBridgeEstimate(
  sourceChainId: number | undefined,
  destChainId: number | undefined,
  amount: string
) {
  const [estimate, setEstimate] = useState<BridgeEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEstimate = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0 || !sourceChainId || !destChainId) {
      setEstimate(null);
      return;
    }

    setIsLoading(true);
    try {
      // Estimate gas fees based on source chain
      // In production, integrate with Bridge Kit's estimate method
      const gasFee = sourceChainId === 1 ? "2.50" : "0.10";
      const bridgeFee = "0.00"; // CCTP has no bridge fee

      setEstimate({
        gasFee,
        bridgeFee,
        totalFee: gasFee,
        estimatedTime: "~15 minutes",
      });
    } catch (error) {
      console.error("Failed to estimate bridge cost:", error);
      setEstimate(null);
    } finally {
      setIsLoading(false);
    }
  }, [sourceChainId, destChainId, amount]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchEstimate();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [fetchEstimate]);

  return { estimate, isLoading };
}

/**
 * Hook to format numbers for display
 */
export function useFormatNumber() {
  return useCallback(
    (value: string | number, decimals: number = 2): string => {
      const num = typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(num)) return "0";
      return num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    },
    []
  );
}
