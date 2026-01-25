import { describe, it, expect } from "vitest";
import {
  defaultTheme,
  mergeTheme,
  themePresets,
  THEME_COLORS,
  THEME_SIZING,
  THEME_FONTS,
} from "../theme";

describe("THEME_COLORS", () => {
  it("has all required color keys", () => {
    expect(THEME_COLORS.primary).toBeDefined();
    expect(THEME_COLORS.secondary).toBeDefined();
    expect(THEME_COLORS.success).toBeDefined();
    expect(THEME_COLORS.error).toBeDefined();
    expect(THEME_COLORS.text).toBeDefined();
    expect(THEME_COLORS.mutedText).toBeDefined();
    expect(THEME_COLORS.border).toBeDefined();
    expect(THEME_COLORS.background).toBeDefined();
    expect(THEME_COLORS.hover).toBeDefined();
  });

  it("has valid hex color for primary", () => {
    expect(THEME_COLORS.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("has valid rgba color for background", () => {
    expect(THEME_COLORS.background).toContain("rgba");
  });
});

describe("THEME_SIZING", () => {
  it("has border radius as number", () => {
    expect(typeof THEME_SIZING.borderRadius).toBe("number");
    expect(THEME_SIZING.borderRadius).toBeGreaterThan(0);
  });

  it("has valid max width", () => {
    expect(THEME_SIZING.maxWidth).toBe("480px");
  });
});

describe("THEME_FONTS", () => {
  it("has font family string", () => {
    expect(typeof THEME_FONTS.family).toBe("string");
    expect(THEME_FONTS.family.length).toBeGreaterThan(0);
  });

  it("has font sizes object", () => {
    expect(THEME_FONTS.sizes.xs).toBeDefined();
    expect(THEME_FONTS.sizes.sm).toBeDefined();
    expect(THEME_FONTS.sizes.base).toBeDefined();
    expect(THEME_FONTS.sizes.lg).toBeDefined();
  });

  it("has font weights object", () => {
    expect(THEME_FONTS.weights.normal).toBe(400);
    expect(THEME_FONTS.weights.medium).toBe(500);
    expect(THEME_FONTS.weights.semibold).toBe(600);
    expect(THEME_FONTS.weights.bold).toBe(700);
  });
});

describe("defaultTheme", () => {
  it("has all required properties", () => {
    expect(defaultTheme.primaryColor).toBeDefined();
    expect(defaultTheme.secondaryColor).toBeDefined();
    expect(defaultTheme.backgroundColor).toBeDefined();
    expect(defaultTheme.cardBackgroundColor).toBeDefined();
    expect(defaultTheme.textColor).toBeDefined();
    expect(defaultTheme.mutedTextColor).toBeDefined();
    expect(defaultTheme.borderColor).toBeDefined();
    expect(defaultTheme.successColor).toBeDefined();
    expect(defaultTheme.errorColor).toBeDefined();
    expect(defaultTheme.hoverColor).toBeDefined();
    expect(defaultTheme.borderRadius).toBeDefined();
    expect(defaultTheme.fontFamily).toBeDefined();
  });

  it("uses THEME_COLORS values", () => {
    expect(defaultTheme.primaryColor).toBe(THEME_COLORS.primary);
    expect(defaultTheme.successColor).toBe(THEME_COLORS.success);
    expect(defaultTheme.errorColor).toBe(THEME_COLORS.error);
    expect(defaultTheme.hoverColor).toBe(THEME_COLORS.hover);
  });
});

describe("mergeTheme", () => {
  it("returns default theme when no override provided", () => {
    const result = mergeTheme();
    expect(result).toEqual(defaultTheme);
  });

  it("returns default theme when undefined provided", () => {
    const result = mergeTheme(undefined);
    expect(result).toEqual(defaultTheme);
  });

  it("merges partial theme with defaults", () => {
    const result = mergeTheme({ primaryColor: "#ff0000" });
    expect(result.primaryColor).toBe("#ff0000");
    expect(result.secondaryColor).toBe(defaultTheme.secondaryColor);
    expect(result.backgroundColor).toBe(defaultTheme.backgroundColor);
  });

  it("overrides multiple properties", () => {
    const result = mergeTheme({
      primaryColor: "#ff0000",
      borderRadius: 20,
      fontFamily: "Arial",
    });
    expect(result.primaryColor).toBe("#ff0000");
    expect(result.borderRadius).toBe(20);
    expect(result.fontFamily).toBe("Arial");
  });
});

describe("themePresets", () => {
  it("has dark preset matching default", () => {
    expect(themePresets.dark).toEqual(defaultTheme);
  });

  it("has light preset with inverted colors", () => {
    expect(themePresets.light.textColor).not.toBe(defaultTheme.textColor);
    expect(themePresets.light.backgroundColor).not.toBe(
      defaultTheme.backgroundColor
    );
  });

  it("has blue preset with blue primary color", () => {
    expect(themePresets.blue.primaryColor).toBe("#3b82f6");
  });

  it("has green preset with green primary color", () => {
    expect(themePresets.green.primaryColor).toBe("#10b981");
  });

  it("all presets have complete theme properties", () => {
    Object.values(themePresets).forEach((preset) => {
      expect(preset.primaryColor).toBeDefined();
      expect(preset.secondaryColor).toBeDefined();
      expect(preset.backgroundColor).toBeDefined();
      expect(preset.hoverColor).toBeDefined();
      expect(preset.borderRadius).toBeDefined();
    });
  });
});
