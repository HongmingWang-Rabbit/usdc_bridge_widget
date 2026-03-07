import { useState } from "react";
import type { BridgeWidgetTheme } from "../types";
import { SwapIcon } from "../icons";

export function SwapButton({
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
