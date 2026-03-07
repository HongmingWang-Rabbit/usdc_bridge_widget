import type { BridgeWidgetTheme } from "../types";
import type { BridgeState } from "../useBridge";
import { CheckIcon, ErrorIcon } from "../icons";
import { BalanceSpinner } from "./BalanceSpinner";

// Bridge progress step definition
const BRIDGE_STEPS = [
  { key: "approving", label: "Approve" },
  { key: "burning", label: "Burn USDC" },
  { key: "fetching-attestation", label: "Attestation" },
  { key: "minting", label: "Mint USDC" },
] as const;

export type BridgeStepKey = typeof BRIDGE_STEPS[number]["key"];

// Derived from BRIDGE_STEPS to avoid duplication
const BRIDGE_STEP_KEYS: BridgeStepKey[] = BRIDGE_STEPS.map((s) => s.key);

export function isBridgeStepKey(status: string): status is BridgeStepKey {
  return (BRIDGE_STEP_KEYS as string[]).includes(status);
}

// Statuses that indicate the bridge flow is active (used by BridgeProgress and isBridging)
export const BRIDGE_FLOW_STATUSES = new Set<string>(["loading", ...BRIDGE_STEP_KEYS]);

// Attestation wait time estimate (CCTP V2 may be faster)
const ATTESTATION_TIME_ESTIMATE = "~15 min";

function getStepState(
  stepKey: BridgeStepKey,
  currentStatus: BridgeState["status"],
  lastActiveStep?: BridgeStepKey
): "done" | "active" | "pending" | "error" {
  const currentIdx = BRIDGE_STEP_KEYS.indexOf(currentStatus as BridgeStepKey);
  const stepIdx = BRIDGE_STEP_KEYS.indexOf(stepKey);

  if (currentStatus === "error" && lastActiveStep) {
    const lastIdx = BRIDGE_STEP_KEYS.indexOf(lastActiveStep);
    if (stepIdx < lastIdx) return "done";
    if (stepIdx === lastIdx) return "error";
    return "pending";
  }

  if (currentIdx < 0) {
    // Status is idle/loading/success — all steps pending or done
    return "pending";
  }
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

export function BridgeProgress({
  bridgeStatus,
  lastActiveStep,
  theme,
}: {
  bridgeStatus: BridgeState["status"];
  lastActiveStep?: BridgeStepKey;
  theme: Required<BridgeWidgetTheme>;
}) {
  // Show stepper only during active bridge steps or on error (with a known failed step)
  const isInBridgeFlow = BRIDGE_FLOW_STATUSES.has(bridgeStatus);
  const isErrorWithStep = bridgeStatus === "error" && !!lastActiveStep;

  if (!isInBridgeFlow && !isErrorWithStep) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        marginBottom: "16px",
        padding: "12px",
        borderRadius: `${theme.borderRadius}px`,
        background: `${theme.cardBackgroundColor}`,
        border: `1px solid ${theme.borderColor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "4px",
        }}
      >
        {(() => {
          // Pre-compute all step states to avoid redundant getStepState calls
          const stepStates = BRIDGE_STEPS.map((s) =>
            getStepState(s.key, bridgeStatus, lastActiveStep)
          );
          return BRIDGE_STEPS.map((step, index) => {
            const state = stepStates[index];
            return (
              <div key={step.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        state === "done"
                          ? theme.successColor
                          : state === "active"
                          ? theme.primaryColor
                          : state === "error"
                          ? theme.errorColor
                          : `${theme.mutedTextColor}30`,
                      transition: "all 0.3s",
                    }}
                  >
                    {state === "done" ? (
                      <CheckIcon size={14} color="#fff" />
                    ) : state === "active" ? (
                      <BalanceSpinner size={12} />
                    ) : state === "error" ? (
                      <ErrorIcon size={14} color="#fff" />
                    ) : (
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: theme.mutedTextColor,
                          opacity: 0.4,
                        }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "9px",
                      marginTop: "4px",
                      color:
                        state === "done"
                          ? theme.successColor
                          : state === "active"
                          ? theme.primaryColor
                          : state === "error"
                          ? theme.errorColor
                          : theme.mutedTextColor,
                      fontWeight: state === "active" || state === "error" ? 600 : 400,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {state === "error" ? `${step.label} (Failed)` : step.label}
                  </span>
                </div>
                {index < BRIDGE_STEPS.length - 1 && (
                  <div
                    style={{
                      height: "2px",
                      flex: "0 0 16px",
                      background:
                        stepStates[index + 1] !== "pending"
                          ? theme.successColor
                          : `${theme.mutedTextColor}30`,
                      marginBottom: "16px",
                      transition: "background 0.3s",
                    }}
                  />
                )}
              </div>
            );
          });
        })()}
      </div>
      {bridgeStatus === "fetching-attestation" && (
        <div
          style={{
            fontSize: "11px",
            color: theme.primaryColor,
            textAlign: "center",
            marginTop: "8px",
            fontWeight: 500,
          }}
        >
          Do not close this page — attestation takes {ATTESTATION_TIME_ESTIMATE}
        </div>
      )}
    </div>
  );
}
