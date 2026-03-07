import { useState, useEffect } from "react";
import type { BridgeChainConfig, BridgeWidgetTheme } from "../types";

export function ChainIcon({
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
