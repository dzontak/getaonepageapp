/**
 * Style preset resolution for the build node.
 *
 * Maps the 5 named presets + custom to a full color palette used in the
 * build prompt. Keeps color logic out of graph-nodes.ts so presets can
 * evolve independently of the Claude prompt.
 *
 * Colors match the STYLE_PRESETS defined in src/agents/project-intake/types.ts:
 *   [primary, secondary, background]
 */

import type { StylePreferences } from "./intake-types";

/* ─── Color Palette ─── */

export interface ColorPalette {
  primary: string;     // hero CTA, headings accent
  secondary: string;   // nav links, subtle accents
  background: string;  // page background
  text: string;        // main body text
  textLight: string;   // secondary/muted text
}

/** Named preset palettes — sourced from STYLE_PRESETS in agents/project-intake/types.ts */
const PRESET_PALETTES: Record<string, ColorPalette> = {
  warm: {
    primary: "#F07D2E",
    secondary: "#FFB347",
    background: "#FFF8EE",
    text: "#2D1B0E",
    textLight: "#6B5744",
  },
  cool: {
    primary: "#3DA7DB",
    secondary: "#5EC4F0",
    background: "#F5F5F5",
    text: "#1A2B3C",
    textLight: "#5A6B7C",
  },
  bold: {
    primary: "#E53E3E",
    secondary: "#1A1A2E",
    background: "#FFFFFF",
    text: "#111111",
    textLight: "#555555",
  },
  earth: {
    primary: "#6B8E23",
    secondary: "#8B7355",
    background: "#FFF8DC",
    text: "#2A2418",
    textLight: "#6B5E4F",
  },
  minimal: {
    primary: "#333333",
    secondary: "#666666",
    background: "#FFFFFF",
    text: "#111111",
    textLight: "#888888",
  },
};

/**
 * Resolve a full color palette from the user's style preferences.
 * Named presets map to curated palettes; "custom" uses the user-provided hex values.
 */
export function resolveColors(style: StylePreferences): ColorPalette {
  if (style.stylePreset !== "custom" && PRESET_PALETTES[style.stylePreset]) {
    return PRESET_PALETTES[style.stylePreset];
  }

  // Custom preset — derive text colors from the background
  // Default to white background if not specified
  const bg = style.secondaryColor || "#FFFFFF";
  const isDarkBg = isColorDark(bg);

  return {
    primary: style.primaryColor || "#333333",
    secondary: style.secondaryColor || "#666666",
    background: "#FFFFFF",
    text: isDarkBg ? "#F5F5F5" : "#111111",
    textLight: isDarkBg ? "#CCCCCC" : "#555555",
  };
}

/**
 * Quick luminance check — returns true if a hex color is "dark" (luminance < 0.5).
 * Used to pick readable text colors when custom backgrounds are provided.
 */
function isColorDark(hex: string): boolean {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  // Relative luminance (simplified sRGB)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.5;
}
