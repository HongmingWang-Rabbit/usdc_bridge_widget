import { useCallback } from "react";
import type { BridgeWidgetTheme } from "../types";
import { formatNumber, validateAmountInput } from "../utils";
import { USDC_BRAND_COLOR } from "../constants";
import { getBorderlessStyles } from "../widgetUtils";

export function AmountInput({
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
