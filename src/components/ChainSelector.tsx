import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { BridgeChainConfig, BridgeWidgetTheme } from "../types";
import { formatNumber } from "../utils";
import { ChevronDownIcon } from "../icons";
import { getBorderlessStyles, BOX_SHADOW_COLOR, DROPDOWN_MAX_HEIGHT, TYPE_AHEAD_RESET_MS } from "../widgetUtils";
import { ChainIcon } from "./ChainIcon";
import { BalanceSpinner } from "./BalanceSpinner";

export function ChainSelector({
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
              // Compute once per chain item rather than inline in JSX
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
