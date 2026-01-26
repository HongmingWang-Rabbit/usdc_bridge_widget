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
  BridgeWidgetTheme,
  BridgeChainConfig,
} from "./types";
import { useUSDCAllowance, useAllUSDCBalances } from "./hooks";
import { useBridge } from "./useBridge";
import { DEFAULT_CHAIN_CONFIGS } from "./chains";
import { USDC_BRAND_COLOR } from "./constants";
import { formatNumber, getErrorMessage, validateAmountInput, validateChainConfigs } from "./utils";
import { mergeTheme } from "./theme";
import { ChevronDownIcon, SwapIcon } from "./icons";

// Constants
const TYPE_AHEAD_RESET_MS = 1000;
const DROPDOWN_MAX_HEIGHT = 300;
const BOX_SHADOW_COLOR = "rgba(0,0,0,0.3)";
const DISABLED_BUTTON_BACKGROUND = "rgba(255,255,255,0.1)";

// Helper function for borderless styles
function getBorderlessStyles(
  borderless: boolean | undefined,
  theme: Required<BridgeWidgetTheme>,
  options?: { includeBoxShadow?: boolean; useBackgroundColor?: boolean }
) {
  const bgColor = options?.useBackgroundColor
    ? theme.backgroundColor
    : theme.cardBackgroundColor;

  return {
    borderRadius: borderless ? 0 : `${theme.borderRadius}px`,
    background: borderless ? "transparent" : bgColor,
    border: borderless ? "none" : `1px solid ${theme.borderColor}`,
    ...(options?.includeBoxShadow && {
      boxShadow: borderless ? "none" : `0 4px 24px ${BOX_SHADOW_COLOR}`,
    }),
  };
}

// Shared keyframes style - injected once per document
const SPINNER_KEYFRAMES = `@keyframes cc-balance-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
const KEYFRAMES_ATTR = "data-cc-spinner-keyframes";

function injectSpinnerKeyframes() {
  if (typeof document === "undefined") return;
  // Check if already injected using a data attribute on the style element
  if (document.querySelector(`style[${KEYFRAMES_ATTR}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(KEYFRAMES_ATTR, "true");
  style.textContent = SPINNER_KEYFRAMES;
  document.head.appendChild(style);
}

// Chain icon with fallback
function ChainIcon({
  chainConfig,
  theme,
  size = 24,
}: {
  chainConfig: BridgeChainConfig;
  theme: Required<BridgeWidgetTheme>;
  size?: number;
}) {
  const [hasError, setHasError] = useState(false);

  // Reset error state when chainConfig changes
  useEffect(() => {
    setHasError(false);
  }, [chainConfig.iconUrl]);

  if (!chainConfig.iconUrl || hasError) {
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: `${size * 0.5}px`,
          fontWeight: "bold",
          color: theme.textColor,
          background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
        }}
        aria-hidden="true"
      >
        {chainConfig.chain.name.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={chainConfig.iconUrl}
      alt=""
      aria-hidden="true"
      style={{ width: `${size}px`, height: `${size}px`, borderRadius: "50%" }}
      onError={() => setHasError(true)}
    />
  );
}

// Small loading spinner for balance display
function BalanceSpinner({ size = 12 }: { size?: number }) {
  // Inject keyframes once on first render
  useEffect(() => {
    injectSpinnerKeyframes();
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{
        animation: "cc-balance-spin 1s linear infinite",
        opacity: 0.6,
      }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

// Chain Selector Component
function ChainSelector({
  label,
  chains,
  selectedChain,
  onSelect,
  excludeChainId,
  theme,
  id,
  balances,
  isLoadingBalances,
  disabled,
  borderless,
}: {
  label: string;
  chains: BridgeChainConfig[];
  selectedChain: BridgeChainConfig;
  onSelect: (chain: BridgeChainConfig) => void;
  excludeChainId?: number;
  theme: Required<BridgeWidgetTheme>;
  id: string;
  balances?: Record<number, { balance: bigint; formatted: string }>;
  isLoadingBalances?: boolean;
  disabled?: boolean;
  borderless?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [typeAhead, setTypeAhead] = useState("");
  const typeAheadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Memoize filtered chains to avoid recalculation on every render
  const availableChains = useMemo(
    () => chains.filter((c) => c.chain.id !== excludeChainId),
    [chains, excludeChainId]
  );

  // Clear type-ahead timer on unmount
  useEffect(() => {
    return () => {
      if (typeAheadTimeoutRef.current) {
        clearTimeout(typeAheadTimeoutRef.current);
      }
    };
  }, []);

  // Handle keyboard navigation on button
  const handleButtonKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        if (!isOpen) {
          e.preventDefault();
          setIsOpen(true);
          setFocusedIndex(0);
        }
      }
    },
    [isOpen]
  );

  // Handle keyboard navigation in listbox with type-ahead search
  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setTypeAhead("");
        buttonRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < availableChains.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev > 0 ? prev - 1 : availableChains.length - 1
        );
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < availableChains.length) {
          onSelect(availableChains[focusedIndex]);
          setIsOpen(false);
          setTypeAhead("");
          buttonRef.current?.focus();
        }
      } else if (e.key === "Home") {
        e.preventDefault();
        setFocusedIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setFocusedIndex(availableChains.length - 1);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Type-ahead search
        e.preventDefault();
        const newTypeAhead = typeAhead + e.key.toLowerCase();
        setTypeAhead(newTypeAhead);

        // Clear previous timeout
        if (typeAheadTimeoutRef.current) {
          clearTimeout(typeAheadTimeoutRef.current);
        }

        // Reset type-ahead after timeout
        typeAheadTimeoutRef.current = setTimeout(() => {
          setTypeAhead("");
        }, TYPE_AHEAD_RESET_MS);

        // Find matching chain
        const matchIndex = availableChains.findIndex((chain) =>
          chain.chain.name.toLowerCase().startsWith(newTypeAhead)
        );
        if (matchIndex !== -1) {
          setFocusedIndex(matchIndex);
        }
      }
    },
    [availableChains, focusedIndex, onSelect, typeAhead]
  );

  // Focus the list when opened
  useEffect(() => {
    if (isOpen && listRef.current) {
      listRef.current.focus();
    }
  }, [isOpen]);

  // Close on escape key globally when open
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setTypeAhead("");
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen]);

  // Reset type-ahead when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setTypeAhead("");
      if (typeAheadTimeoutRef.current) {
        clearTimeout(typeAheadTimeoutRef.current);
        typeAheadTimeoutRef.current = null;
      }
    }
  }, [isOpen]);

  const buttonId = `${id}-button`;
  const listboxId = `${id}-listbox`;

  // Get selected chain balance
  const selectedBalance = balances?.[selectedChain.chain.id];

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <label
        id={`${id}-label`}
        htmlFor={buttonId}
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
        ref={buttonRef}
        id={buttonId}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={disabled ? undefined : handleButtonKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${id}-label`}
        aria-controls={isOpen ? listboxId : undefined}
        aria-disabled={disabled}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          ...getBorderlessStyles(borderless, theme),
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          transition: "all 0.2s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ChainIcon chainConfig={selectedChain} theme={theme} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: theme.textColor,
              }}
            >
              {selectedChain.chain.name}
            </span>
            {isLoadingBalances ? (
              <span
                style={{
                  fontSize: "10px",
                  color: theme.mutedTextColor,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <BalanceSpinner size={10} /> Loading...
              </span>
            ) : balances && selectedBalance ? (
              <span
                style={{
                  fontSize: "10px",
                  color: theme.mutedTextColor,
                }}
              >
                {formatNumber(selectedBalance.formatted, 2)} USDC
              </span>
            ) : null}
          </div>
        </div>
        <ChevronDownIcon
          size={16}
          color={theme.mutedTextColor}
          style={{
            transition: "transform 0.2s",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
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
            aria-hidden="true"
          />
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={`${id}-label`}
            aria-activedescendant={
              focusedIndex >= 0
                ? `${id}-option-${availableChains[focusedIndex]?.chain.id}`
                : undefined
            }
            tabIndex={0}
            onKeyDown={handleListKeyDown}
            style={{
              position: "absolute",
              zIndex: 20,
              width: "100%",
              marginTop: "8px",
              borderRadius: `${theme.borderRadius}px`,
              boxShadow: `0 10px 40px ${BOX_SHADOW_COLOR}`,
              background: theme.cardBackgroundColor,
              backdropFilter: "blur(10px)",
              border: `1px solid ${theme.borderColor}`,
              maxHeight: `${DROPDOWN_MAX_HEIGHT}px`,
              overflowY: "auto",
              overflowX: "hidden",
              padding: 0,
              margin: 0,
              listStyle: "none",
              outline: "none",
            }}
          >
            {availableChains.map((chainConfig, index) => {
              const chainBalance = balances?.[chainConfig.chain.id];
              const isFocused = index === focusedIndex;
              const isSelected = chainConfig.chain.id === selectedChain.chain.id;
              // Pre-compute parsed balance to avoid parseFloat in render
              const hasPositiveBalance = chainBalance ? parseFloat(chainBalance.formatted) > 0 : false;

              return (
                <li
                  key={chainConfig.chain.id}
                  id={`${id}-option-${chainConfig.chain.id}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelect(chainConfig);
                    setIsOpen(false);
                    buttonRef.current?.focus();
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 12px",
                    background: isFocused ? theme.hoverColor : "transparent",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <ChainIcon chainConfig={chainConfig} theme={theme} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        fontSize: "14px",
                        color: isSelected ? theme.textColor : theme.mutedTextColor,
                        fontWeight: isSelected ? 500 : 400,
                      }}
                    >
                      {chainConfig.chain.name}
                    </span>
                    {isLoadingBalances ? (
                      <span
                        style={{
                          fontSize: "10px",
                          color: theme.mutedTextColor,
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <BalanceSpinner size={10} />
                      </span>
                    ) : balances && chainBalance ? (
                      <span
                        style={{
                          fontSize: "10px",
                          color: hasPositiveBalance ? theme.successColor : theme.mutedTextColor,
                        }}
                      >
                        {formatNumber(chainBalance.formatted, 2)} USDC
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// Swap Button Component
function SwapButton({
  onClick,
  theme,
  disabled,
}: {
  onClick: () => void;
  theme: Required<BridgeWidgetTheme>;
  disabled?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Swap source and destination chains"
      style={{
        padding: "8px",
        borderRadius: `${theme.borderRadius}px`,
        background: `${theme.primaryColor}15`,
        border: `1px solid ${theme.primaryColor}40`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "flex-end",
        marginBottom: "4px",
        transform: isHovered && !disabled ? "scale(1.1)" : "scale(1)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <SwapIcon size={20} color={theme.primaryColor} />
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
  id,
  disabled,
  showBalance = true,
  borderless,
}: {
  value: string;
  onChange: (value: string) => void;
  balance: string;
  onMaxClick: () => void;
  theme: Required<BridgeWidgetTheme>;
  id: string;
  disabled?: boolean;
  showBalance?: boolean;
  borderless?: boolean;
}) {
  const inputId = `${id}-input`;
  const labelId = `${id}-label`;

  // Handle input change with comprehensive validation
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const result = validateAmountInput(e.target.value);
      if (result.isValid) {
        onChange(result.sanitized);
      } else if (result.sanitized) {
        // Use sanitized value (e.g., truncated decimals)
        onChange(result.sanitized);
      }
      // Invalid input is rejected silently
    },
    [onChange, disabled]
  );

  // Prevent 'e' key from being entered
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
      e.preventDefault();
    }
  }, []);

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
          id={labelId}
          htmlFor={inputId}
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
        {showBalance && (
          <span
            style={{ fontSize: "10px", color: theme.mutedTextColor }}
            aria-live="polite"
          >
            Balance:{" "}
            <span style={{ color: theme.textColor }}>
              {formatNumber(balance)} USDC
            </span>
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          ...getBorderlessStyles(borderless, theme),
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="0.00"
          disabled={disabled}
          aria-labelledby={labelId}
          aria-describedby={`${id}-currency`}
          aria-disabled={disabled}
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
            cursor: disabled ? "not-allowed" : "text",
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
            disabled={disabled}
            aria-label="Set maximum amount"
            style={{
              padding: "4px 8px",
              fontSize: "10px",
              fontWeight: 600,
              borderRadius: "4px",
              background: `${theme.primaryColor}20`,
              color: theme.primaryColor,
              border: "none",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            MAX
          </button>
          <div
            id={`${id}-currency`}
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: USDC_BRAND_COLOR,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-hidden="true"
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
  borderless = false,
  className,
  style,
}: BridgeWidgetProps) {
  const theme = mergeTheme(themeOverrides);
  const { address, isConnected, status } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  // Detect reconnecting/connecting states to prevent UI flicker
  const isReconnecting = status === "reconnecting" || status === "connecting";

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

  // Refetch balances on wallet connection events
  useAccountEffect({
    onConnect: () => {
      refetchAllBalances();
    },
    onDisconnect: () => {
      // Balances will be cleared automatically when address becomes undefined
    },
  });

  // Bridge hook
  const { bridge: executeBridge, state: bridgeState, reset: resetBridge } = useBridge();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Bridge operation states
  const isBridging = bridgeState.status === "loading" ||
    bridgeState.status === "approving" ||
    bridgeState.status === "burning" ||
    bridgeState.status === "fetching-attestation" ||
    bridgeState.status === "minting";

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
  );
}
