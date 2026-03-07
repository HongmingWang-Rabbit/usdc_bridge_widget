import type { BridgeWidgetTheme, BridgeChainConfig } from "./types";

// Constants used by multiple sub-components
export const TYPE_AHEAD_RESET_MS = 1000;
export const DROPDOWN_MAX_HEIGHT = 300;
export const BOX_SHADOW_COLOR = "rgba(0,0,0,0.3)";
export const DISABLED_BUTTON_BACKGROUND = "rgba(255,255,255,0.1)";

// Helper function for borderless styles
export function getBorderlessStyles(
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

// Resolve chain name from chain configs
export function getChainNameFromConfigs(chainId: number, chains: BridgeChainConfig[]): string {
  const config = chains.find((c) => c.chain.id === chainId);
  return config?.chain.name ?? `Chain ${chainId}`;
}
