import { useState, useEffect, useCallback, useRef, useId, useMemo } from "react";
import {
  useAccount,
  useAccountEffect,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";
import type {
  BridgeWidgetProps,
  BridgeChainConfig,
} from "./types";
import { useUSDCAllowance, useAllUSDCBalances } from "./hooks";
import { useBridge } from "./useBridge";
import { useClaim } from "./useClaim";
import { useRecovery } from "./useRecovery";
import { useClaimManager } from "./useClaimManager";
import { usePendingTab } from "./usePendingTab";
import { DEFAULT_CHAIN_CONFIGS } from "./chains";
import { CCTP_DOMAIN_IDS, ATTESTATION_POLL_INTERVAL_MS } from "./constants";
import { getErrorMessage, validateChainConfigs } from "./utils";
import { mergeTheme } from "./theme";
import { SpinnerIcon, CheckIcon, SearchIcon } from "./icons";
import { getBorderlessStyles, getChainNameFromConfigs, DISABLED_BUTTON_BACKGROUND } from "./widgetUtils";
import { ChainSelector } from "./components/ChainSelector";
import { SwapButton } from "./components/SwapButton";
import { AmountInput } from "./components/AmountInput";
import { BridgeProgress, BRIDGE_FLOW_STATUSES, isBridgeStepKey } from "./components/BridgeProgress";
import type { BridgeStepKey } from "./components/BridgeProgress";
import { RecoveryBanner } from "./components/RecoveryBanner";
import { PendingItemCard } from "./components/PendingItemCard";

// Main Bridge Widget Component
export function BridgeWidget({
  chains = DEFAULT_CHAIN_CONFIGS,
  defaultSourceChainId,
  defaultDestinationChainId,
  onBridgeStart,
  onBridgeSuccess,
  onBridgeError,
  onConnectWallet,
  theme: themeOverrides,
  borderless = false,
  className,
  style,
  enablePersistence = true,
  onPendingBridgeDetected,
  onRecoveryComplete,
  onRecoveryError,
  showClaimTab = true,
  showPendingTab: showPendingTabProp,
  onPendingClaimDetected,
  onClaimSuccess,
  onClaimError,
}: BridgeWidgetProps) {
  const theme = mergeTheme(themeOverrides);
  const { address, isConnected, status } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  // Detect reconnecting/connecting states to prevent UI flicker
  const isReconnecting = status === "reconnecting" || status === "connecting";

  // Derive showPendingTab — defaults to showClaimTab
  const showPendingTab = showPendingTabProp ?? showClaimTab;

  // Tab state
  const [activeTab, setActiveTab] = useState<"bridge" | "claim" | "pending">("bridge");

  // Claim manager hook for multi-claim persistence
  const {
    pendingClaims: managerClaims,
    addClaim,
    executeClaim: executeClaimFromManager,
    dismissClaim,
    resumePolling,
    activeClaimId,
  } = useClaimManager({
    enabled: enablePersistence,
    onClaimSuccess,
    onClaimError,
    onPendingClaimDetected,
  });

  // Ref for resetClaim — allows handleAttestationReady to call it without circular deps
  const resetClaimRef = useRef<() => void>(() => {});

  // Callback when attestation is ready on the Claim tab — persist and reset form
  const handleAttestationReady = useCallback(
    (params: {
      sourceChainId: number;
      destinationChainId: number;
      burnTxHash: string;
      amount: string;
      attestation: { message: string; attestation: string; status: string };
      mintRecipient: string;
    }) => {
      if (!address) return;
      addClaim({
        walletAddress: address.toLowerCase(),
        sourceChainId: params.sourceChainId,
        destinationChainId: params.destinationChainId,
        burnTxHash: params.burnTxHash,
        amount: params.amount,
        attestation: params.attestation,
        mintRecipient: params.mintRecipient,
        status: "attestation-ready",
      });
      // Reset claim form for next lookup and switch to Pending tab
      resetClaimRef.current();
      setClaimTxHashInput("");
      setActiveTab("pending");
    },
    [address, addClaim]
  );

  // Claim hook (for the Claim tab form)
  const {
    state: claimState,
    fetchAttestation,
    claim: executeClaim,
    reset: resetClaim,
  } = useClaim({ onClaimSuccess, onClaimError, onAttestationReady: handleAttestationReady });

  // Keep ref in sync
  resetClaimRef.current = resetClaim;

  // Claim tab state
  const [claimSourceChainId, setClaimSourceChainId] = useState<number>(
    () => chains[0]?.chain.id ?? 1
  );
  const [claimTxHashInput, setClaimTxHashInput] = useState("");

  // Validate chain configs on mount/change
  const [configError, setConfigError] = useState<string | null>(null);
  useEffect(() => {
    const validation = validateChainConfigs(chains);
    if (!validation.isValid) {
      const errorMsg = validation.errors.join("; ");
      setConfigError(errorMsg);
    } else {
      setConfigError(null);
    }
  }, [chains]);

  // Generate unique IDs for accessibility
  const baseId = useId();
  const sourceChainId = `${baseId}-source`;
  const destChainId = `${baseId}-dest`;
  const amountId = `${baseId}-amount`;

  // Find initial chains
  const getChainConfig = useCallback(
    (chainId?: number) => {
      if (!chainId) return chains[0];
      return chains.find((c) => c.chain.id === chainId) || chains[0];
    },
    [chains]
  );

  const [sourceChainConfig, setSourceChainConfig] = useState<BridgeChainConfig>(
    () => getChainConfig(defaultSourceChainId)
  );
  const [destChainConfig, setDestChainConfig] = useState<BridgeChainConfig>(
    () =>
      getChainConfig(defaultDestinationChainId) ||
      chains.find((c) => c.chain.id !== sourceChainConfig.chain.id) ||
      chains[1] ||
      chains[0]
  );
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);

  // Hooks - fetch balances for all chains (single batch request via multicall)
  const { balances: allBalances, isLoading: isLoadingAllBalances, refetch: refetchAllBalances } = useAllUSDCBalances(chains);

  // Derive source chain balance from the batch-fetched balances (no extra network request)
  const balanceFormatted = useMemo(() => {
    return allBalances[sourceChainConfig.chain.id]?.formatted ?? "0";
  }, [allBalances, sourceChainConfig.chain.id]);

  // Memoize parsed values to avoid repeated parsing
  const parsedBalance = useMemo(() => parseFloat(balanceFormatted), [balanceFormatted]);
  const parsedAmount = useMemo(() => parseFloat(amount) || 0, [amount]);

  const { needsApproval, approve, isApproving } = useUSDCAllowance(
    sourceChainConfig
  );

  // Build persistence config for useBridge
  const persistenceConfig = useMemo(() => {
    if (!enablePersistence || !address) return undefined;
    return {
      walletAddress: address,
      sourceChainId: sourceChainConfig.chain.id,
      destChainId: destChainConfig.chain.id,
    };
  }, [enablePersistence, address, sourceChainConfig.chain.id, destChainConfig.chain.id]);

  // Bridge hook with persistence
  const { bridge: executeBridge, state: bridgeState, reset: resetBridge } = useBridge(persistenceConfig);

  // Recovery hook for incomplete bridges
  const {
    pendingBridges,
    retryBridge,
    dismissBridge,
    isRecovering,
    lastError: recoveryError,
    lastSuccess: recoverySuccess,
    refresh: refreshRecovery,
  } = useRecovery({
    enabled: enablePersistence,
    onRecoveryComplete,
    onRecoveryError,
    onPendingBridgeDetected,
  });

  // Pending tab aggregator
  const { items: pendingItems, actionableCount } = usePendingTab(
    pendingBridges,
    managerClaims
  );

  // Refetch balances on wallet connection events
  useAccountEffect({
    onConnect: () => {
      refetchAllBalances();
    },
    onDisconnect: () => {
      // Clear form state when wallet disconnects
      setAmount("");
      setError(null);
      setTxHash(undefined);
      resetBridge();
    },
  });

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Bridge operation states — derived from BRIDGE_FLOW_STATUSES to prevent divergence
  const isBridging = BRIDGE_FLOW_STATUSES.has(bridgeState.status);

  // Track the last active step so progress stepper can show which step failed on error
  const lastActiveStepRef = useRef<BridgeStepKey | undefined>(undefined);
  useEffect(() => {
    if (isBridgeStepKey(bridgeState.status)) {
      lastActiveStepRef.current = bridgeState.status;
    } else if (bridgeState.status === "idle") {
      lastActiveStepRef.current = undefined;
    }
  }, [bridgeState.status]);

  // Disable inputs when any operation is pending to prevent race conditions
  const isOperationPending = isBridging || isConfirming || isApproving;

  // Store callbacks in refs to avoid useEffect dependency issues
  const onBridgeSuccessRef = useRef(onBridgeSuccess);
  onBridgeSuccessRef.current = onBridgeSuccess;
  const onBridgeErrorRef = useRef(onBridgeError);
  onBridgeErrorRef.current = onBridgeError;

  // Check if we need to switch chains
  const needsChainSwitch =
    isConnected && currentChainId !== sourceChainConfig.chain.id;

  // Swap chains
  const handleSwapChains = useCallback(() => {
    const newSource = destChainConfig;
    const newDest = sourceChainConfig;
    setSourceChainConfig(newSource);
    setDestChainConfig(newDest);
  }, [destChainConfig, sourceChainConfig]);

  // Handle max click
  const handleMaxClick = useCallback(() => {
    setAmount(balanceFormatted);
  }, [balanceFormatted]);

  // Handle chain switch
  const handleSwitchChain = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: sourceChainConfig.chain.id });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [switchChainAsync, sourceChainConfig.chain.id]);

  // Handle bridge
  const handleBridge = useCallback(async () => {
    if (!address || !amount || parsedAmount <= 0) return;

    setError(null);
    resetBridge();

    try {
      // Notify that bridge is starting
      onBridgeStart?.({
        sourceChainId: sourceChainConfig.chain.id,
        destChainId: destChainConfig.chain.id,
        amount,
      });

      if (needsApproval(amount)) {
        // Store pending bridge info for after approval
        pendingBridgeRef.current = {
          amount,
          sourceChainConfig,
          destChainConfig,
        };
        // First approve, then bridge will be triggered after approval
        const approveTx = await approve(amount);
        setTxHash(approveTx);
      } else {
        // Already approved, execute bridge directly
        await executeBridge({
          sourceChainConfig,
          destChainConfig,
          amount,
        });
      }
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      onBridgeErrorRef.current?.(
        err instanceof Error ? err : new Error(errorMessage)
      );
    }
  }, [
    address,
    amount,
    parsedAmount,
    needsApproval,
    approve,
    executeBridge,
    resetBridge,
    onBridgeStart,
    sourceChainConfig,
    destChainConfig,
  ]);

  // Store amount in ref for bridge execution after approval
  const pendingBridgeRef = useRef<{
    amount: string;
    sourceChainConfig: BridgeChainConfig;
    destChainConfig: BridgeChainConfig;
  } | null>(null);

  // After approval success, execute the bridge
  useEffect(() => {
    if (isSuccess && txHash && pendingBridgeRef.current) {
      const { amount: pendingAmount, sourceChainConfig: pendingSource, destChainConfig: pendingDest } = pendingBridgeRef.current;
      pendingBridgeRef.current = null;
      setTxHash(undefined);

      // Execute bridge after approval
      void executeBridge({
        sourceChainConfig: pendingSource,
        destChainConfig: pendingDest,
        amount: pendingAmount,
      }).catch((err) => {
        setError(getErrorMessage(err));
      });
    }
  }, [isSuccess, txHash, executeBridge]);

  // Handle bridge state changes
  useEffect(() => {
    if (bridgeState.status === "success") {
      const currentAmount = amount;
      const currentSourceChainId = sourceChainConfig.chain.id;
      const currentDestChainId = destChainConfig.chain.id;
      const currentTxHash = bridgeState.txHash;

      setAmount("");
      refetchAllBalances();

      if (currentTxHash) {
        onBridgeSuccessRef.current?.({
          sourceChainId: currentSourceChainId,
          destChainId: currentDestChainId,
          amount: currentAmount,
          txHash: currentTxHash,
        });
      }
    } else if (bridgeState.status === "error" && bridgeState.error) {
      setError(bridgeState.error.message);
    }
  }, [
    bridgeState.status,
    bridgeState.txHash,
    bridgeState.error,
    refetchAllBalances,
    amount,
    sourceChainConfig.chain.id,
    destChainConfig.chain.id,
  ]);

  // Warn users before closing the tab during active bridging
  useEffect(() => {
    if (!isBridging) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isBridging]);

  // Refresh recovery list after a bridge completes or fails
  useEffect(() => {
    if ((bridgeState.status === "success" || bridgeState.status === "error") && enablePersistence) {
      refreshRecovery();
    }
  }, [bridgeState.status, enablePersistence, refreshRecovery]);

  // Computed disabled state using memoized values
  const isButtonDisabled =
    !isConnected ||
    needsChainSwitch ||
    !amount ||
    parsedAmount <= 0 ||
    parsedAmount > parsedBalance ||
    isConfirming ||
    isApproving ||
    isBridging;

  const isButtonActuallyDisabled =
    isButtonDisabled && !needsChainSwitch && isConnected;

  const buttonText = useMemo(() => {
    if (isReconnecting) return "Connecting...";
    if (!isConnected) return "Connect Wallet";
    if (needsChainSwitch) return `Switch to ${sourceChainConfig.chain.name}`;

    // Bridge states
    if (bridgeState.status === "loading") return "Preparing Bridge...";
    if (bridgeState.status === "approving") return "Approving...";
    if (bridgeState.status === "burning") return "Burning USDC...";
    if (bridgeState.status === "fetching-attestation") return "Fetching Attestation...";
    if (bridgeState.status === "minting") return "Minting on Destination...";

    // Approval states
    if (isConfirming || isApproving) {
      return "Approving...";
    }

    if (!amount || parsedAmount <= 0) return "Enter Amount";
    if (parsedAmount > parsedBalance) {
      return "Insufficient Balance";
    }
    if (needsApproval(amount)) return "Approve & Bridge USDC";
    return "Bridge USDC";
  }, [
    isReconnecting,
    isConnected,
    needsChainSwitch,
    sourceChainConfig.chain.name,
    bridgeState.status,
    isConfirming,
    isApproving,
    amount,
    parsedAmount,
    parsedBalance,
    needsApproval,
  ]);

  const handleButtonClick = useCallback(() => {
    // Prevent actions during reconnection
    if (isReconnecting) return;

    if (!isConnected) {
      // Delegate wallet connection to the parent app via onConnectWallet callback
      // This ensures compatibility with RainbowKit, ConnectKit, web3modal, etc.
      if (onConnectWallet) {
        onConnectWallet();
      } else {
        // Warn when onConnectWallet is not provided - helps developers debug
        // Note: Bundlers typically strip console.warn in production builds
        console.warn(
          "[BridgeWidget] onConnectWallet prop is not provided. " +
          "Please provide onConnectWallet to handle wallet connection " +
          "(e.g., openConnectModal from RainbowKit)."
        );
      }
      return;
    }
    if (needsChainSwitch) {
      handleSwitchChain();
      return;
    }
    handleBridge();
  }, [
    isReconnecting,
    isConnected,
    onConnectWallet,
    needsChainSwitch,
    handleSwitchChain,
    handleBridge,
  ]);

  // Memoize button styles to avoid recalculation on every render
  const buttonStyles = useMemo(
    () => ({
      width: "100%",
      padding: "14px",
      borderRadius: `${theme.borderRadius}px`,
      fontSize: "14px",
      fontWeight: 600,
      border: "none",
      cursor: isButtonActuallyDisabled ? "not-allowed" : "pointer",
      transition: "all 0.2s",
      color: isButtonActuallyDisabled ? theme.mutedTextColor : theme.textColor,
      background: isButtonActuallyDisabled
        ? DISABLED_BUTTON_BACKGROUND
        : `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
      boxShadow: isButtonActuallyDisabled
        ? "none"
        : `0 4px 14px ${theme.primaryColor}60, inset 0 1px 0 rgba(255,255,255,0.2)`,
    }),
    [
      theme.borderRadius,
      theme.mutedTextColor,
      theme.textColor,
      theme.primaryColor,
      theme.secondaryColor,
      isButtonActuallyDisabled,
    ]
  );

  // Claim-specific chain config for the ChainSelector
  const claimSourceChainConfig = useMemo(
    () => chains.find((c) => c.chain.id === claimSourceChainId) ?? chains[0],
    [chains, claimSourceChainId]
  );

  // Filter chains to only those with CCTP domain IDs (for claim tab)
  const claimChains = useMemo(
    () => chains.filter((c) => CCTP_DOMAIN_IDS[c.chain.id] !== undefined),
    [chains]
  );

  const handleFetchAttestation = useCallback(async () => {
    await fetchAttestation(claimSourceChainId, claimTxHashInput.trim());
  }, [fetchAttestation, claimSourceChainId, claimTxHashInput]);

  const handleClaimReset = useCallback(() => {
    resetClaim();
    setClaimTxHashInput("");
  }, [resetClaim]);

  // Derive claim button text and state
  const claimButtonInfo = useMemo(() => {
    if (isReconnecting) return { text: "Connecting...", disabled: true };
    if (!isConnected) return { text: "Connect Wallet", disabled: false };
    if (claimState.status === "claiming") return { text: "Claiming...", disabled: true };
    if (claimState.status !== "attestation-ready") return { text: "Claim USDC", disabled: true };
    if (claimState.destinationChainId && currentChainId !== claimState.destinationChainId) {
      const destName = getChainNameFromConfigs(claimState.destinationChainId, chains);
      return { text: `Switch to ${destName}`, disabled: false };
    }
    return { text: "Claim USDC", disabled: false };
  }, [isReconnecting, isConnected, claimState.status, claimState.destinationChainId, currentChainId, chains]);

  const handleClaimButtonClick = useCallback(() => {
    if (isReconnecting) return;
    if (!isConnected) {
      onConnectWallet?.();
      return;
    }
    void executeClaim();
  }, [isReconnecting, isConnected, onConnectWallet, executeClaim]);

  return (
    <div
      className={className}
      role="region"
      aria-label="USDC Bridge Widget"
      style={{
        fontFamily: theme.fontFamily,
        maxWidth: "480px",
        width: "100%",
        padding: "16px",
        ...getBorderlessStyles(borderless, theme, {
          includeBoxShadow: true,
          useBackgroundColor: true,
        }),
        ...style,
      }}
    >
      {/* Tab Bar */}
      {(showClaimTab || showPendingTab) && (
        <div
          role="tablist"
          aria-label="Widget mode"
          style={{
            display: "flex",
            marginBottom: "16px",
            borderBottom: `1px solid ${theme.borderColor}`,
          }}
        >
          <button
            role="tab"
            aria-selected={activeTab === "bridge"}
            aria-controls={`${baseId}-bridge-panel`}
            id={`${baseId}-bridge-tab`}
            onClick={() => setActiveTab("bridge")}
            style={{
              flex: 1,
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "bridge"
                ? `2px solid ${theme.primaryColor}`
                : "2px solid transparent",
              color: activeTab === "bridge" ? theme.primaryColor : theme.mutedTextColor,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Bridge
          </button>
          {showClaimTab && (
            <button
              role="tab"
              aria-selected={activeTab === "claim"}
              aria-controls={`${baseId}-claim-panel`}
              id={`${baseId}-claim-tab`}
              onClick={() => setActiveTab("claim")}
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: "13px",
                fontWeight: 600,
                background: "transparent",
                border: "none",
                borderBottom: activeTab === "claim"
                  ? `2px solid ${theme.primaryColor}`
                  : "2px solid transparent",
                color: activeTab === "claim" ? theme.primaryColor : theme.mutedTextColor,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              Claim
            </button>
          )}
          {showPendingTab && (
            <button
              role="tab"
              aria-selected={activeTab === "pending"}
              aria-controls={`${baseId}-pending-panel`}
              id={`${baseId}-pending-tab`}
              onClick={() => setActiveTab("pending")}
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: "13px",
                fontWeight: 600,
                background: "transparent",
                border: "none",
                borderBottom: activeTab === "pending"
                  ? `2px solid ${theme.primaryColor}`
                  : "2px solid transparent",
                color: activeTab === "pending" ? theme.primaryColor : theme.mutedTextColor,
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              Pending
              {actionableCount > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "18px",
                    height: "18px",
                    borderRadius: "9px",
                    background: theme.primaryColor,
                    color: "#fff",
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "0 5px",
                    lineHeight: 1,
                  }}
                  aria-label={`${actionableCount} pending`}
                >
                  {actionableCount}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {/* Bridge Tab */}
      {activeTab === "bridge" && (
        <div
          role="tabpanel"
          id={`${baseId}-bridge-panel`}
          aria-labelledby={`${baseId}-bridge-tab`}
        >
          {/* Recovery Banner - shown when there are incomplete bridges */}
          {!isBridging && (
            <RecoveryBanner
              pendingBridges={pendingBridges}
              onResume={retryBridge}
              onDismiss={dismissBridge}
              isRecovering={isRecovering}
              lastError={recoveryError}
              lastSuccess={recoverySuccess}
              theme={theme}
              chains={chains}
            />
          )}

          {/* Chain Selectors */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <ChainSelector
              id={sourceChainId}
              label="From"
              chains={chains}
              selectedChain={sourceChainConfig}
              onSelect={setSourceChainConfig}
              excludeChainId={destChainConfig.chain.id}
              theme={theme}
              balances={isConnected ? allBalances : undefined}
              isLoadingBalances={isConnected && isLoadingAllBalances}
              disabled={isOperationPending}
              borderless={borderless}
            />
            <SwapButton onClick={handleSwapChains} theme={theme} disabled={isOperationPending} />
            <ChainSelector
              id={destChainId}
              label="To"
              chains={chains}
              selectedChain={destChainConfig}
              onSelect={setDestChainConfig}
              excludeChainId={sourceChainConfig.chain.id}
              theme={theme}
              balances={isConnected ? allBalances : undefined}
              isLoadingBalances={isConnected && isLoadingAllBalances}
              disabled={isOperationPending}
              borderless={borderless}
            />
          </div>

          {/* Amount Input */}
          <div style={{ marginBottom: "16px" }}>
            <AmountInput
              id={amountId}
              value={amount}
              onChange={setAmount}
              balance={balanceFormatted}
              onMaxClick={handleMaxClick}
              theme={theme}
              disabled={isOperationPending}
              showBalance={isConnected}
              borderless={borderless}
            />
          </div>

          {/* Config Error */}
          {configError && (
            <div
              role="alert"
              style={{
                fontSize: "12px",
                color: theme.errorColor,
                background: `${theme.errorColor}15`,
                padding: "8px 12px",
                borderRadius: `${theme.borderRadius}px`,
                marginBottom: "16px",
              }}
            >
              Configuration Error: {configError}
            </div>
          )}

          {/* Error */}
          {error && !configError && (
            <div
              role="alert"
              style={{
                fontSize: "12px",
                color: theme.errorColor,
                background: `${theme.errorColor}15`,
                padding: "8px 12px",
                borderRadius: `${theme.borderRadius}px`,
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          {/* Bridge Progress Stepper */}
          <BridgeProgress bridgeStatus={bridgeState.status} lastActiveStep={lastActiveStepRef.current} theme={theme} />

          {/* Action Button */}
          <button
            onClick={handleButtonClick}
            disabled={isButtonActuallyDisabled}
            aria-busy={isConfirming || isApproving || isBridging}
            style={buttonStyles}
          >
            {buttonText}
          </button>
        </div>
      )}

      {/* Claim Tab */}
      {activeTab === "claim" && (
        <div
          role="tabpanel"
          id={`${baseId}-claim-panel`}
          aria-labelledby={`${baseId}-claim-tab`}
        >
          {/* Description */}
          <div
            style={{
              fontSize: "12px",
              color: theme.mutedTextColor,
              marginBottom: "16px",
              lineHeight: 1.5,
            }}
          >
            Recover unclaimed USDC from a CCTP burn transaction. Paste the burn tx hash to fetch the attestation and claim your USDC on the destination chain.
          </div>

          {/* Source Chain Selector */}
          {(claimState.status === "idle" || claimState.status === "error") ? (
            <>
              <div style={{ marginBottom: "16px" }}>
                <ChainSelector
                  id={`${baseId}-claim-source`}
                  label="Source Chain (where you burned)"
                  chains={claimChains}
                  selectedChain={claimSourceChainConfig}
                  onSelect={(c) => setClaimSourceChainId(c.chain.id)}
                  theme={theme}
                  borderless={borderless}
                />
              </div>

              {/* Tx Hash Input */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  htmlFor={`${baseId}-claim-txhash`}
                  style={{
                    display: "block",
                    fontSize: "10px",
                    color: theme.mutedTextColor,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 500,
                    marginBottom: "4px",
                  }}
                >
                  Burn Transaction Hash
                </label>
                <input
                  id={`${baseId}-claim-txhash`}
                  type="text"
                  value={claimTxHashInput}
                  onChange={(e) => setClaimTxHashInput(e.target.value)}
                  placeholder="0x..."
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    color: theme.textColor,
                    ...getBorderlessStyles(borderless, theme),
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Claim Error */}
              {claimState.status === "error" && claimState.error && (
                <div
                  role="alert"
                  style={{
                    fontSize: "12px",
                    color: theme.errorColor,
                    background: `${theme.errorColor}15`,
                    padding: "8px 12px",
                    borderRadius: `${theme.borderRadius}px`,
                    marginBottom: "16px",
                  }}
                >
                  {claimState.error}
                </div>
              )}

              {/* Fetch Attestation Button */}
              <button
                onClick={handleFetchAttestation}
                disabled={!claimTxHashInput.trim()}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: `${theme.borderRadius}px`,
                  fontSize: "14px",
                  fontWeight: 600,
                  border: "none",
                  cursor: !claimTxHashInput.trim() ? "not-allowed" : "pointer",
                  color: !claimTxHashInput.trim() ? theme.mutedTextColor : theme.textColor,
                  background: !claimTxHashInput.trim()
                    ? DISABLED_BUTTON_BACKGROUND
                    : `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <SearchIcon size={16} />
                Fetch Attestation
              </button>
            </>
          ) : null}

          {/* Fetching / Polling state */}
          {(claimState.status === "fetching-attestation" || claimState.status === "attestation-pending") && (
            <div
              style={{
                padding: "16px",
                borderRadius: `${theme.borderRadius}px`,
                background: theme.cardBackgroundColor,
                border: `1px solid ${theme.borderColor}`,
                textAlign: "center",
              }}
            >
              <SpinnerIcon size={24} color={theme.primaryColor} />
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: theme.textColor,
                  marginTop: "8px",
                }}
              >
                {claimState.status === "fetching-attestation"
                  ? "Fetching attestation..."
                  : "Attestation pending"}
              </div>
              {claimState.status === "attestation-pending" && (
                <div
                  style={{
                    fontSize: "11px",
                    color: theme.mutedTextColor,
                    marginTop: "4px",
                  }}
                >
                  Checking every {ATTESTATION_POLL_INTERVAL_MS / 1000}s... This can take up to 15 minutes.
                </div>
              )}
              <button
                onClick={handleClaimReset}
                style={{
                  marginTop: "12px",
                  padding: "6px 16px",
                  fontSize: "12px",
                  fontWeight: 500,
                  borderRadius: "4px",
                  background: "transparent",
                  color: theme.mutedTextColor,
                  border: `1px solid ${theme.borderColor}`,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Attestation Ready — show details and claim button */}
          {(claimState.status === "attestation-ready" || claimState.status === "claiming") && (
            <div>
              {/* Attestation Details Card */}
              <div
                style={{
                  padding: "12px",
                  borderRadius: `${theme.borderRadius}px`,
                  background: theme.cardBackgroundColor,
                  border: `1px solid ${theme.borderColor}`,
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 600, color: theme.textColor }}>
                    Attestation Details
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: `${theme.successColor}20`,
                      color: theme.successColor,
                    }}
                  >
                    Ready
                  </span>
                </div>
                {/* Amount */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", color: theme.mutedTextColor }}>Amount</span>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: theme.textColor }}>
                    {claimState.formattedAmount} USDC
                  </span>
                </div>
                {/* Route */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", color: theme.mutedTextColor }}>Route</span>
                  <span style={{ fontSize: "11px", fontWeight: 500, color: theme.textColor }}>
                    {claimState.sourceChainId ? getChainNameFromConfigs(claimState.sourceChainId, chains) : "?"}
                    {" → "}
                    {claimState.destinationChainId ? getChainNameFromConfigs(claimState.destinationChainId, chains) : "?"}
                  </span>
                </div>
                {/* Recipient */}
                {claimState.mintRecipient && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", color: theme.mutedTextColor }}>Recipient</span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "monospace",
                        color: theme.textColor,
                      }}
                    >
                      {claimState.mintRecipient.slice(0, 6)}...{claimState.mintRecipient.slice(-4)}
                    </span>
                  </div>
                )}
              </div>

              {/* Claim Button */}
              <button
                onClick={handleClaimButtonClick}
                disabled={claimButtonInfo.disabled}
                aria-busy={claimState.status === "claiming"}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: `${theme.borderRadius}px`,
                  fontSize: "14px",
                  fontWeight: 600,
                  border: "none",
                  cursor: claimButtonInfo.disabled ? "not-allowed" : "pointer",
                  color: claimButtonInfo.disabled ? theme.mutedTextColor : theme.textColor,
                  background: claimButtonInfo.disabled
                    ? DISABLED_BUTTON_BACKGROUND
                    : `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
                  boxShadow: claimButtonInfo.disabled
                    ? "none"
                    : `0 4px 14px ${theme.primaryColor}60, inset 0 1px 0 rgba(255,255,255,0.2)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {claimState.status === "claiming" && <SpinnerIcon size={16} />}
                {claimButtonInfo.text}
              </button>
            </div>
          )}

          {/* Success state */}
          {claimState.status === "success" && (
            <div role="status" aria-live="polite">
              <div
                style={{
                  padding: "16px",
                  borderRadius: `${theme.borderRadius}px`,
                  background: `${theme.successColor}15`,
                  border: `1px solid ${theme.successColor}40`,
                  textAlign: "center",
                  marginBottom: "16px",
                }}
              >
                <CheckIcon size={32} color={theme.successColor} />
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: theme.successColor,
                    marginTop: "8px",
                  }}
                >
                  USDC Claimed Successfully
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: theme.textColor,
                    marginTop: "4px",
                  }}
                >
                  {claimState.formattedAmount} USDC →{" "}
                  {claimState.destinationChainId
                    ? getChainNameFromConfigs(claimState.destinationChainId, chains)
                    : "destination"}
                </div>
                {claimState.claimTxHash && (
                  <div
                    style={{
                      fontSize: "11px",
                      fontFamily: "monospace",
                      color: theme.mutedTextColor,
                      marginTop: "8px",
                      wordBreak: "break-all",
                    }}
                  >
                    Tx: {claimState.claimTxHash}
                  </div>
                )}
              </div>
              <button
                onClick={handleClaimReset}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: `${theme.borderRadius}px`,
                  fontSize: "14px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  color: theme.textColor,
                  background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
                }}
              >
                Claim Another
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending Tab */}
      {activeTab === "pending" && (
        <div
          role="tabpanel"
          id={`${baseId}-pending-panel`}
          aria-labelledby={`${baseId}-pending-tab`}
        >
          {pendingItems.length === 0 ? (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                color: theme.mutedTextColor,
                fontSize: "13px",
              }}
            >
              No pending operations
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {pendingItems.map((item) => (
                <PendingItemCard
                  key={`${item.type}-${item.id}`}
                  item={item}
                  theme={theme}
                  chains={chains}
                  onAction={() => {
                    switch (item.actionType) {
                      case "resume":
                        retryBridge(item.id);
                        break;
                      case "execute":
                        void executeClaimFromManager(item.id);
                        break;
                      case "retry":
                        resumePolling(item.id);
                        break;
                      case "cancel":
                        dismissClaim(item.id);
                        break;
                      default:
                        // actionType is undefined for non-actionable items;
                        // button is only rendered when actionable, so this is a no-op guard
                        break;
                    }
                  }}
                  onDismiss={() => {
                    if (item.type === "bridge") {
                      dismissBridge(item.id);
                    } else {
                      dismissClaim(item.id);
                    }
                  }}
                  isActionDisabled={
                    (item.type === "bridge" && isRecovering) ||
                    (item.type === "claim" && activeClaimId === item.id)
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Powered by */}
      <div
        style={{
          marginTop: "12px",
          textAlign: "center",
          fontSize: "10px",
          color: theme.mutedTextColor,
          opacity: 0.6,
        }}
      >
        Powered by{" "}
        <span style={{ fontWeight: 600 }}>Circle CCTP</span>
      </div>
    </div>
  );
}
