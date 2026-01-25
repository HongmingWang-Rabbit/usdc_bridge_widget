import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, erc20Abi } from "viem";
import type {
  BridgeWidgetProps,
  BridgeWidgetTheme,
  BridgeChainConfig,
} from "./types";
import {
  useUSDCBalance,
  useUSDCAllowance,
  useBridgeEstimate,
  useFormatNumber,
} from "./hooks";

// Default theme
const defaultTheme: Required<BridgeWidgetTheme> = {
  primaryColor: "#6366f1",
  secondaryColor: "#a855f7",
  backgroundColor: "rgba(15, 15, 25, 0.8)",
  cardBackgroundColor: "rgba(15, 15, 25, 0.6)",
  textColor: "#ffffff",
  mutedTextColor: "rgba(255, 255, 255, 0.54)",
  borderColor: "rgba(255, 255, 255, 0.06)",
  successColor: "#22c55e",
  errorColor: "#ef4444",
  borderRadius: 12,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

// Merge theme with defaults
function mergeTheme(theme?: BridgeWidgetTheme): Required<BridgeWidgetTheme> {
  return { ...defaultTheme, ...theme };
}

// Chain Selector Component
function ChainSelector({
  label,
  chains,
  selectedChain,
  onSelect,
  excludeChainId,
  theme,
}: {
  label: string;
  chains: BridgeChainConfig[];
  selectedChain: BridgeChainConfig;
  onSelect: (chain: BridgeChainConfig) => void;
  excludeChainId?: number;
  theme: Required<BridgeWidgetTheme>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const availableChains = chains.filter(
    (c) => c.chain.id !== excludeChainId
  );

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <label
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
        {label}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderRadius: `${theme.borderRadius}px`,
          background: "rgba(0,0,0,0.3)",
          border: `1px solid ${theme.borderColor}`,
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {selectedChain.iconUrl ? (
            <img
              src={selectedChain.iconUrl}
              alt={selectedChain.chain.name}
              style={{ width: "24px", height: "24px", borderRadius: "50%" }}
            />
          ) : (
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: "bold",
                color: theme.textColor,
                background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
              }}
            >
              {selectedChain.chain.name.charAt(0)}
            </div>
          )}
          <span
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: theme.textColor,
            }}
          >
            {selectedChain.chain.name}
          </span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={theme.mutedTextColor}
          style={{
            transition: "transform 0.2s",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10,
            }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              zIndex: 20,
              width: "100%",
              marginTop: "8px",
              borderRadius: `${theme.borderRadius}px`,
              overflow: "hidden",
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              background: "rgba(20, 20, 35, 0.98)",
              border: `1px solid ${theme.borderColor}`,
            }}
          >
            {availableChains.map((chainConfig) => (
              <button
                key={chainConfig.chain.id}
                onClick={() => {
                  onSelect(chainConfig);
                  setIsOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {chainConfig.iconUrl ? (
                  <img
                    src={chainConfig.iconUrl}
                    alt={chainConfig.chain.name}
                    style={{ width: "24px", height: "24px", borderRadius: "50%" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: theme.textColor,
                      background:
                        chainConfig.chain.id === selectedChain.chain.id
                          ? `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`
                          : "rgba(255,255,255,0.1)",
                    }}
                  >
                    {chainConfig.chain.name.charAt(0)}
                  </div>
                )}
                <span
                  style={{
                    fontSize: "14px",
                    color:
                      chainConfig.chain.id === selectedChain.chain.id
                        ? theme.textColor
                        : theme.mutedTextColor,
                    fontWeight:
                      chainConfig.chain.id === selectedChain.chain.id
                        ? 500
                        : 400,
                  }}
                >
                  {chainConfig.chain.name}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Swap Button Component
function SwapButton({
  onClick,
  theme,
}: {
  onClick: () => void;
  theme: Required<BridgeWidgetTheme>;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px",
        borderRadius: `${theme.borderRadius}px`,
        background: `${theme.primaryColor}15`,
        border: `1px solid ${theme.primaryColor}40`,
        cursor: "pointer",
        transition: "all 0.2s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "flex-end",
        marginBottom: "4px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={theme.primaryColor}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    </button>
  );
}

// Amount Input Component
function AmountInput({
  value,
  onChange,
  balance,
  onMaxClick,
  theme,
}: {
  value: string;
  onChange: (value: string) => void;
  balance: string;
  onMaxClick: () => void;
  theme: Required<BridgeWidgetTheme>;
}) {
  const formatNumber = useFormatNumber();

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "4px",
        }}
      >
        <label
          style={{
            fontSize: "10px",
            color: theme.mutedTextColor,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 500,
          }}
        >
          Amount
        </label>
        <span style={{ fontSize: "10px", color: theme.mutedTextColor }}>
          Balance:{" "}
          <span style={{ color: theme.textColor }}>
            {formatNumber(balance)} USDC
          </span>
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderRadius: `${theme.borderRadius}px`,
          overflow: "hidden",
          background: "rgba(0,0,0,0.3)",
          border: `1px solid ${theme.borderColor}`,
        }}
      >
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            padding: "12px",
            fontSize: "18px",
            color: theme.textColor,
            fontWeight: 500,
            outline: "none",
            minWidth: 0,
            fontFamily: theme.fontFamily,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            paddingRight: "12px",
          }}
        >
          <button
            onClick={onMaxClick}
            style={{
              padding: "4px 8px",
              fontSize: "10px",
              fontWeight: 600,
              borderRadius: "4px",
              background: `${theme.primaryColor}20`,
              color: theme.primaryColor,
              border: "none",
              cursor: "pointer",
            }}
          >
            MAX
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#2775ca",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: "bold",
                  color: "#fff",
                }}
              >
                $
              </span>
            </div>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: theme.textColor,
              }}
            >
              USDC
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Estimate Display Component
function EstimateDisplay({
  estimate,
  isLoading,
  theme,
}: {
  estimate: {
    gasFee: string;
    bridgeFee: string;
    totalFee: string;
    estimatedTime: string;
  } | null;
  isLoading: boolean;
  theme: Required<BridgeWidgetTheme>;
}) {
  if (isLoading) {
    return (
      <div
        style={{
          height: "64px",
          borderRadius: `${theme.borderRadius}px`,
          background: "rgba(255,255,255,0.03)",
          animation: "pulse 2s infinite",
        }}
      />
    );
  }

  if (!estimate) return null;

  return (
    <div
      style={{
        borderRadius: `${theme.borderRadius}px`,
        padding: "12px",
        background: "rgba(0,0,0,0.2)",
        border: `1px solid ${theme.borderColor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <span style={{ fontSize: "12px", color: theme.mutedTextColor }}>
          Gas Fee
        </span>
        <span style={{ fontSize: "12px", color: theme.textColor }}>
          ~${estimate.gasFee}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <span style={{ fontSize: "12px", color: theme.mutedTextColor }}>
          Bridge Fee
        </span>
        <span style={{ fontSize: "12px", color: theme.successColor }}>
          Free (CCTP)
        </span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: "8px",
          borderTop: `1px solid ${theme.borderColor}`,
        }}
      >
        <span style={{ fontSize: "12px", color: theme.mutedTextColor }}>
          Estimated Time
        </span>
        <span style={{ fontSize: "12px", color: theme.textColor }}>
          {estimate.estimatedTime}
        </span>
      </div>
    </div>
  );
}

// Main Bridge Widget Component
export function BridgeWidget({
  chains,
  defaultSourceChainId,
  defaultDestinationChainId,
  onBridgeStart,
  onBridgeSuccess,
  onBridgeError,
  onConnectWallet,
  theme: themeOverrides,
  title = "USDC Bridge",
  description = "Powered by Circle CCTP",
  showInfoCard = true,
  className,
  style,
}: BridgeWidgetProps) {
  const theme = mergeTheme(themeOverrides);
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();

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

  // Hooks
  const { balanceFormatted, refetch: refetchBalance } = useUSDCBalance(
    sourceChainConfig
  );
  const { needsApproval, approve, isApproving } = useUSDCAllowance(
    sourceChainConfig
  );
  const { estimate, isLoading: isEstimating } = useBridgeEstimate(
    sourceChainConfig?.chain.id,
    destChainConfig?.chain.id,
    amount
  );

  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Check if we need to switch chains
  const needsChainSwitch =
    isConnected && currentChainId !== sourceChainConfig.chain.id;

  // Swap chains
  const handleSwapChains = () => {
    const temp = sourceChainConfig;
    setSourceChainConfig(destChainConfig);
    setDestChainConfig(temp);
  };

  // Handle max click
  const handleMaxClick = () => {
    setAmount(balanceFormatted);
  };

  // Handle chain switch
  const handleSwitchChain = async () => {
    try {
      await switchChainAsync({ chainId: sourceChainConfig.chain.id });
    } catch (err) {
      console.error("Failed to switch chain:", err);
    }
  };

  // Handle bridge
  const handleBridge = async () => {
    if (!address || !amount || parseFloat(amount) <= 0) return;

    setError(null);
    try {
      if (needsApproval(amount)) {
        onBridgeStart?.({
          sourceChainId: sourceChainConfig.chain.id,
          destChainId: destChainConfig.chain.id,
          amount,
        });
        const approveTx = await approve(amount);
        setTxHash(approveTx);
      } else {
        // This is where Circle Bridge Kit would be integrated
        // For now, provide guidance
        setError(
          "Bridge Kit integration required. Install @circle-fin/bridge-kit"
        );
      }
    } catch (err: any) {
      const errorMessage = err?.message || "Transaction failed";
      setError(errorMessage);
      onBridgeError?.(err);
    }
  };

  // Reset on success
  useEffect(() => {
    if (isSuccess && txHash) {
      setAmount("");
      setTxHash(undefined);
      refetchBalance();
      onBridgeSuccess?.({
        sourceChainId: sourceChainConfig.chain.id,
        destChainId: destChainConfig.chain.id,
        amount,
        txHash,
      });
    }
  }, [isSuccess, txHash]);

  const isDisabled =
    !isConnected ||
    needsChainSwitch ||
    !amount ||
    parseFloat(amount) <= 0 ||
    parseFloat(amount) > parseFloat(balanceFormatted) ||
    isWriting ||
    isConfirming ||
    isApproving;

  const getButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    if (needsChainSwitch) return `Switch to ${sourceChainConfig.chain.name}`;
    if (isWriting || isConfirming || isApproving) {
      return needsApproval(amount) ? "Approving..." : "Bridging...";
    }
    if (!amount || parseFloat(amount) <= 0) return "Enter Amount";
    if (parseFloat(amount) > parseFloat(balanceFormatted)) {
      return "Insufficient Balance";
    }
    if (needsApproval(amount)) return "Approve USDC";
    return "Bridge USDC";
  };

  const handleButtonClick = () => {
    if (!isConnected) {
      onConnectWallet?.();
      return;
    }
    if (needsChainSwitch) {
      handleSwitchChain();
      return;
    }
    handleBridge();
  };

  return (
    <div
      className={className}
      style={{
        fontFamily: theme.fontFamily,
        maxWidth: "480px",
        width: "100%",
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: `${theme.borderRadius * 1.5}px`,
          padding: "20px",
          marginBottom: "16px",
          background: `linear-gradient(135deg, ${theme.primaryColor}25 0%, ${theme.secondaryColor}25 50%, #3b82f625 100%)`,
          border: `1px solid ${theme.borderColor}`,
          boxShadow: `0 4px 24px ${theme.primaryColor}15`,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "160px",
            height: "160px",
            borderRadius: "50%",
            filter: "blur(60px)",
            background: `radial-gradient(circle, ${theme.primaryColor}40 0%, transparent 70%)`,
            top: "-30%",
            left: "5%",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: `${theme.borderRadius}px`,
                background: "#2775ca",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(39, 117, 202, 0.4)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 32 32" fill="white">
                <path
                  d="M16 32c8.837 0 16-7.163 16-16S24.837 0 16 0 0 7.163 0 16s7.163 16 16 16z"
                  fill="#2775ca"
                />
                <path
                  d="M20.022 18.124c0-2.124-1.28-2.852-3.84-3.156-1.828-.228-2.193-.684-2.193-1.488 0-.804.616-1.32 1.848-1.32 1.108 0 1.724.38 2.036 1.26a.38.38 0 00.364.26h.836a.35.35 0 00.352-.38v-.044a2.936 2.936 0 00-2.64-2.4v-1.4a.38.38 0 00-.38-.38h-.78a.38.38 0 00-.38.38v1.364c-1.752.304-2.88 1.4-2.88 2.8 0 1.98 1.232 2.756 3.792 3.06 1.72.26 2.24.64 2.24 1.54 0 .9-.8 1.52-1.9 1.52-1.48 0-2.02-.624-2.228-1.46a.396.396 0 00-.38-.288h-.888a.35.35 0 00-.352.38v.044c.232 1.64 1.268 2.58 3.008 2.892v1.42a.38.38 0 00.38.38h.78a.38.38 0 00.38-.38v-1.4c1.78-.32 2.908-1.46 2.908-3.024z"
                  fill="white"
                />
              </svg>
            </div>
            <div>
              <h1
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: theme.textColor,
                  margin: 0,
                }}
              >
                {title}
              </h1>
              <p
                style={{
                  fontSize: "12px",
                  color: theme.mutedTextColor,
                  margin: 0,
                }}
              >
                {description}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {["Cross-Chain", "No Bridge Fee", "Native USDC"].map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "4px 8px",
                  borderRadius: `${theme.borderRadius / 2}px`,
                  fontSize: "10px",
                  fontWeight: 500,
                  color: theme.mutedTextColor,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${theme.borderColor}`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div
        style={{
          borderRadius: `${theme.borderRadius}px`,
          padding: "16px",
          background: theme.backgroundColor,
          border: `1px solid ${theme.borderColor}`,
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        }}
      >
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
            label="From"
            chains={chains}
            selectedChain={sourceChainConfig}
            onSelect={setSourceChainConfig}
            excludeChainId={destChainConfig.chain.id}
            theme={theme}
          />
          <SwapButton onClick={handleSwapChains} theme={theme} />
          <ChainSelector
            label="To"
            chains={chains}
            selectedChain={destChainConfig}
            onSelect={setDestChainConfig}
            excludeChainId={sourceChainConfig.chain.id}
            theme={theme}
          />
        </div>

        {/* Amount Input */}
        <div style={{ marginBottom: "16px" }}>
          <AmountInput
            value={amount}
            onChange={setAmount}
            balance={balanceFormatted}
            onMaxClick={handleMaxClick}
            theme={theme}
          />
        </div>

        {/* Estimate */}
        <div style={{ marginBottom: "16px" }}>
          <EstimateDisplay
            estimate={estimate}
            isLoading={isEstimating}
            theme={theme}
          />
        </div>

        {/* Error */}
        {error && (
          <div
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

        {/* Action Button */}
        <button
          onClick={handleButtonClick}
          disabled={isDisabled && !needsChainSwitch && isConnected}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: `${theme.borderRadius}px`,
            fontSize: "14px",
            fontWeight: 600,
            border: "none",
            cursor:
              isDisabled && !needsChainSwitch && isConnected
                ? "not-allowed"
                : "pointer",
            transition: "all 0.2s",
            color:
              isDisabled && !needsChainSwitch && isConnected
                ? theme.mutedTextColor
                : theme.textColor,
            background:
              isDisabled && !needsChainSwitch && isConnected
                ? "rgba(255,255,255,0.1)"
                : `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
            boxShadow:
              isDisabled && !needsChainSwitch && isConnected
                ? "none"
                : `0 4px 14px ${theme.primaryColor}60, inset 0 1px 0 rgba(255,255,255,0.2)`,
          }}
        >
          {getButtonText()}
        </button>
      </div>

      {/* Info Card */}
      {showInfoCard && (
        <div
          style={{
            borderRadius: `${theme.borderRadius}px`,
            padding: "16px",
            marginTop: "16px",
            background: theme.cardBackgroundColor,
            border: `1px solid ${theme.borderColor}`,
          }}
        >
          <h3
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: theme.textColor,
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="#3b82f6"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            About CCTP
          </h3>
          <p
            style={{
              fontSize: "11px",
              color: theme.mutedTextColor,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Circle's Cross-Chain Transfer Protocol (CCTP) enables native USDC
            transfers between blockchains using a burn-and-mint mechanism.
            Unlike traditional bridges, CCTP burns USDC on the source chain and
            mints native USDC on the destination chain, eliminating wrapped
            token risk.
          </p>
          <div
            style={{
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: `1px solid ${theme.borderColor}`,
            }}
          >
            <a
              href="https://developers.circle.com/crosschain-transfers"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                color: theme.primaryColor,
                textDecoration: "none",
              }}
            >
              Learn more about CCTP
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
