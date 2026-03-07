import { useState, useCallback } from "react";
import type { BridgeChainConfig, BridgeWidgetTheme } from "../types";
import type { PendingItem } from "../usePendingTab";
import { getChainNameFromConfigs } from "../widgetUtils";
import { BalanceSpinner } from "./BalanceSpinner";

// Resolve status color from PendingItem.statusVariant (computed in usePendingTab)
function getStatusColor(
  item: PendingItem,
  theme: Required<BridgeWidgetTheme>
): string {
  switch (item.statusVariant) {
    case "primary": return theme.primaryColor;
    case "success": return theme.successColor;
    case "error": return theme.errorColor;
    case "muted": return theme.mutedTextColor;
    default: { const _exhaustive: never = item.statusVariant; return _exhaustive; }
  }
}

function CopyableTxHash({ txHash, color }: { txHash: string; color: string }) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(() => {
    navigator.clipboard.writeText(txHash).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => { /* clipboard unavailable (non-HTTPS, permission denied) — silently ignore */ }
    );
  }, [txHash]);

  return (
    <div
      title="Click to copy"
      onClick={handleClick}
      style={{
        fontSize: "9px",
        fontFamily: "monospace",
        color,
        marginTop: "2px",
        cursor: "pointer",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "Copied!" : `Tx: ${txHash}`}
    </div>
  );
}

export function PendingItemCard({
  item,
  theme,
  chains,
  onAction,
  onDismiss,
  isActionDisabled,
}: {
  item: PendingItem;
  theme: Required<BridgeWidgetTheme>;
  chains: BridgeChainConfig[];
  onAction: () => void;
  onDismiss: () => void;
  isActionDisabled: boolean;
}) {
  const sourceChainName = getChainNameFromConfigs(item.sourceChainId, chains);
  const destChainName = item.destChainId
    ? getChainNameFromConfigs(item.destChainId, chains)
    : "?";
  const statusColor = getStatusColor(item, theme);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 12px",
        borderRadius: `${theme.borderRadius}px`,
        background: theme.cardBackgroundColor,
        border: `1px solid ${theme.borderColor}`,
      }}
    >
      {/* Type badge */}
      <div
        style={{
          fontSize: "9px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: theme.mutedTextColor,
          padding: "2px 6px",
          borderRadius: "4px",
          background: `${theme.mutedTextColor}15`,
          whiteSpace: "nowrap",
        }}
      >
        {item.type}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: theme.textColor,
          }}
        >
          {sourceChainName} → {destChainName}
          {item.amount && <span style={{ fontWeight: 400 }}> · {item.amount} USDC</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
          {item.isPolling && <BalanceSpinner size={10} />}
          <span
            style={{
              fontSize: "10px",
              fontWeight: 500,
              color: statusColor,
            }}
          >
            {item.displayStatus}
          </span>
        </div>
        {item.txHash && (
          <CopyableTxHash txHash={item.txHash} color={theme.mutedTextColor} />
        )}
      </div>

      {/* Action button */}
      {item.actionable && item.actionLabel && (
        <button
          onClick={onAction}
          disabled={isActionDisabled}
          style={{
            padding: "4px 10px",
            fontSize: "11px",
            fontWeight: 600,
            borderRadius: "4px",
            background: item.actionType === "cancel" ? "transparent" : theme.primaryColor,
            color: item.actionType === "cancel" ? theme.mutedTextColor : "#fff",
            border: item.actionType === "cancel" ? `1px solid ${theme.borderColor}` : "none",
            cursor: isActionDisabled ? "not-allowed" : "pointer",
            opacity: isActionDisabled ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {isActionDisabled && item.actionType !== "cancel" ? "..." : item.actionLabel}
        </button>
      )}

      {/* Dismiss button */}
      {item.dismissable && (
        <button
          onClick={onDismiss}
          disabled={isActionDisabled}
          aria-label="Dismiss"
          style={{
            padding: "4px 6px",
            fontSize: "11px",
            fontWeight: 500,
            borderRadius: "4px",
            background: "transparent",
            color: theme.mutedTextColor,
            border: "none",
            cursor: isActionDisabled ? "not-allowed" : "pointer",
            opacity: isActionDisabled ? 0.6 : 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
