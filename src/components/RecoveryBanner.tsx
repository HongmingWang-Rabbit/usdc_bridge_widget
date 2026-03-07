import type { BridgeChainConfig, BridgeWidgetTheme } from "../types";
import type { PendingBridgeRecord } from "../storage";
import { CheckIcon, WarningIcon } from "../icons";
import { getChainNameFromConfigs } from "../widgetUtils";

export function RecoveryBanner({
  pendingBridges,
  onResume,
  onDismiss,
  isRecovering,
  lastError,
  lastSuccess,
  theme,
  chains,
}: {
  pendingBridges: PendingBridgeRecord[];
  onResume: (id: string) => void;
  onDismiss: (id: string) => void;
  isRecovering: boolean;
  lastError: { bridgeId: string; message: string } | null;
  lastSuccess: string | null;
  theme: Required<BridgeWidgetTheme>;
  chains: BridgeChainConfig[];
}) {
  // Show success banner even when no pending bridges remain
  if (pendingBridges.length === 0 && !lastSuccess) return null;

  if (pendingBridges.length === 0 && lastSuccess) {
    return (
      <div role="status" aria-live="polite" style={{ marginBottom: "12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 12px",
            borderRadius: `${theme.borderRadius}px`,
            background: `${theme.successColor}15`,
            border: `1px solid ${theme.successColor}40`,
          }}
        >
          <CheckIcon size={16} color={theme.successColor} />
          <div style={{ fontSize: "12px", fontWeight: 600, color: theme.successColor }}>
            {lastSuccess}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" style={{ marginBottom: "12px" }}>
      {pendingBridges.map((bridge) => {
        const isRecoveryPending = bridge.status === "recovery-pending";
        // Legacy: no code path produces failureHint anymore, but old localStorage
        // records may still have it. Kept for backwards compatibility.
        const isFailed = bridge.status === "failed";
        const isPossiblyCompleted = isFailed && bridge.failureHint === "possibly-completed";
        const bannerColor = isPossiblyCompleted
          ? theme.successColor
          : isRecoveryPending
          ? theme.primaryColor
          : isFailed
          ? theme.errorColor
          : theme.primaryColor;

        const sourceChainName = getChainNameFromConfigs(bridge.sourceChainId, chains);
        const destChainName = getChainNameFromConfigs(bridge.destChainId, chains);
        const bannerLabel = isPossiblyCompleted
          ? `Bridge may have completed: ${bridge.amount} USDC from ${sourceChainName} to ${destChainName}`
          : isRecoveryPending
          ? `Recovery pending: ${bridge.amount} USDC from ${sourceChainName} to ${destChainName}`
          : isFailed
          ? `Failed bridge: ${bridge.amount} USDC from ${sourceChainName} to ${destChainName}`
          : `Pending bridge: ${bridge.amount} USDC from ${sourceChainName} to ${destChainName}`;

        return (
          <div
            key={bridge.id}
            aria-label={bannerLabel}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 12px",
              borderRadius: `${theme.borderRadius}px`,
              background: `${bannerColor}15`,
              border: `1px solid ${bannerColor}40`,
              marginBottom: "8px",
            }}
          >
            {isPossiblyCompleted ? (
              <CheckIcon size={16} color={theme.successColor} />
            ) : (
              <WarningIcon size={16} color={bannerColor} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: theme.textColor,
                }}
              >
                {isPossiblyCompleted
                  ? "Bridge may have completed"
                  : isRecoveryPending
                  ? "Incomplete bridge"
                  : isFailed
                  ? "Bridge needs manual action"
                  : "Incomplete bridge"}
                : {bridge.amount} USDC
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: theme.mutedTextColor,
                }}
              >
                {sourceChainName} → {destChainName}
                {isPossiblyCompleted && ` — Check your balance on ${destChainName}`}
                {isFailed && !isPossiblyCompleted && " — Please re-initiate this bridge"}
              </div>
              {lastError && lastError.bridgeId === bridge.id && !isRecovering && (
                <div
                  style={{
                    fontSize: "10px",
                    color: theme.errorColor,
                    marginTop: "4px",
                  }}
                >
                  {lastError.message}
                </div>
              )}
            </div>
            {!isPossiblyCompleted && !isFailed && (
              <button
                onClick={() => onResume(bridge.id)}
                disabled={isRecovering}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "4px",
                  background: theme.primaryColor,
                  color: "#fff",
                  border: "none",
                  cursor: isRecovering ? "not-allowed" : "pointer",
                  opacity: isRecovering ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {isRecovering ? "Retrying..." : "Retry"}
              </button>
            )}
            <button
              onClick={() => onDismiss(bridge.id)}
              style={{
                padding: "4px 8px",
                fontSize: "11px",
                fontWeight: 500,
                borderRadius: "4px",
                background: "transparent",
                color: theme.mutedTextColor,
                border: `1px solid ${theme.borderColor}`,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Dismiss
            </button>
          </div>
        );
      })}
    </div>
  );
}
