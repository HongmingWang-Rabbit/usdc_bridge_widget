import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnect,
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
  useFormatNumber,
} from "./hooks";
import { DEFAULT_CHAIN_CONFIGS } from "./index";

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
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              background: "rgba(20, 20, 35, 0.98)",
              border: `1px solid ${theme.borderColor}`,
              maxHeight: "300px",
              overflowY: "auto",
              overflowX: "hidden",
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
  className,
  style,
}: BridgeWidgetProps) {
  const theme = mergeTheme(themeOverrides);
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { connect, connectors } = useConnect();

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

  const { isPending: isWriting } = useWriteContract();
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
      // If custom onConnectWallet is provided, use it
      // Otherwise, auto-connect with the first available connector
      if (onConnectWallet) {
        onConnectWallet();
      } else if (connectors.length > 0) {
        connect({ connector: connectors[0] });
      }
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
        borderRadius: `${theme.borderRadius}px`,
        padding: "16px",
        background: theme.backgroundColor,
        border: `1px solid ${theme.borderColor}`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        ...style,
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
  );
}
