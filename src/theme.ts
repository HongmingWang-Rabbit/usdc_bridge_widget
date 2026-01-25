import type { BridgeWidgetTheme } from "./types";

/**
 * Default theme color palette
 */
export const THEME_COLORS = {
  /** Primary accent - Indigo */
  primary: "#6366f1",
  /** Secondary accent - Purple */
  secondary: "#a855f7",
  /** Success state - Green */
  success: "#22c55e",
  /** Error state - Red */
  error: "#ef4444",
  /** Text color - White */
  text: "#ffffff",
  /** Muted text - Semi-transparent white */
  mutedText: "rgba(255, 255, 255, 0.54)",
  /** Border color - Semi-transparent white */
  border: "rgba(255, 255, 255, 0.06)",
  /** Background - Dark with transparency */
  background: "rgba(15, 15, 25, 0.8)",
  /** Card background - Darker with transparency */
  cardBackground: "rgba(15, 15, 25, 0.6)",
  /** Dropdown background - Near opaque dark */
  dropdownBackground: "rgba(20, 20, 35, 0.98)",
  /** Input background - Transparent black */
  inputBackground: "rgba(0, 0, 0, 0.3)",
  /** Hover state - Semi-transparent white */
  hover: "rgba(255, 255, 255, 0.05)",
} as const;

/**
 * Default theme spacing and sizing
 */
export const THEME_SIZING = {
  /** Default border radius in pixels */
  borderRadius: 12,
  /** Widget max width */
  maxWidth: "480px",
  /** Standard padding */
  padding: "16px",
  /** Gap between elements */
  gap: "12px",
  /** Small gap */
  smallGap: "8px",
  /** Dropdown max height */
  dropdownMaxHeight: "300px",
} as const;

/**
 * Default font settings
 */
export const THEME_FONTS = {
  /** Primary font family */
  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  /** Font sizes */
  sizes: {
    xs: "10px",
    sm: "12px",
    base: "14px",
    lg: "18px",
  },
  /** Font weights */
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

/**
 * Default complete theme configuration
 */
export const defaultTheme: Required<BridgeWidgetTheme> = {
  primaryColor: THEME_COLORS.primary,
  secondaryColor: THEME_COLORS.secondary,
  backgroundColor: THEME_COLORS.background,
  cardBackgroundColor: THEME_COLORS.cardBackground,
  textColor: THEME_COLORS.text,
  mutedTextColor: THEME_COLORS.mutedText,
  borderColor: THEME_COLORS.border,
  successColor: THEME_COLORS.success,
  errorColor: THEME_COLORS.error,
  hoverColor: THEME_COLORS.hover,
  borderRadius: THEME_SIZING.borderRadius,
  fontFamily: THEME_FONTS.family,
};

/**
 * Merge user theme overrides with defaults
 */
export function mergeTheme(
  theme?: BridgeWidgetTheme
): Required<BridgeWidgetTheme> {
  return { ...defaultTheme, ...theme };
}

/**
 * Pre-built theme presets
 */
export const themePresets = {
  /** Default dark theme */
  dark: defaultTheme,

  /** Light theme variant */
  light: {
    ...defaultTheme,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    cardBackgroundColor: "rgba(245, 245, 245, 0.9)",
    textColor: "#1a1a2e",
    mutedTextColor: "rgba(0, 0, 0, 0.54)",
    borderColor: "rgba(0, 0, 0, 0.1)",
    hoverColor: "rgba(0, 0, 0, 0.05)",
  } as Required<BridgeWidgetTheme>,

  /** Blue accent theme */
  blue: {
    ...defaultTheme,
    primaryColor: "#3b82f6",
    secondaryColor: "#06b6d4",
  } as Required<BridgeWidgetTheme>,

  /** Green accent theme */
  green: {
    ...defaultTheme,
    primaryColor: "#10b981",
    secondaryColor: "#34d399",
  } as Required<BridgeWidgetTheme>,
} as const;
