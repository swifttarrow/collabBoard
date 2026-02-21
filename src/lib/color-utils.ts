/**
 * Relative luminance threshold for dark/light categorization.
 * Per WCAG: luminance >= 0.5 is light, < 0.5 is dark.
 * Used to pick selection outline contrast.
 */
const LUMINANCE_THRESHOLD = 0.5;

/** Default stroke when color cannot be parsed */
const FALLBACK_STROKE = "#0f172a";

function parseColor(color: string): { r: number; g: number; b: number } | null {
  if (!color || typeof color !== "string") return null;
  const s = color.trim();

  // #rrggbb or rrggbb
  let m = s.replace(/^#/, "").match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (m) {
    return {
      r: parseInt(m[1], 16) / 255,
      g: parseInt(m[2], 16) / 255,
      b: parseInt(m[3], 16) / 255,
    };
  }

  // #rgb (3-digit)
  m = s.replace(/^#/, "").match(/^([a-f\d])([a-f\d])([a-f\d])$/i);
  if (m) {
    return {
      r: (parseInt(m[1] + m[1], 16) / 255),
      g: (parseInt(m[2] + m[2], 16) / 255),
      b: (parseInt(m[3] + m[3], 16) / 255),
    };
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: Math.min(255, parseInt(rgbMatch[1], 10)) / 255,
      g: Math.min(255, parseInt(rgbMatch[2], 10)) / 255,
      b: Math.min(255, parseInt(rgbMatch[3], 10)) / 255,
    };
  }

  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const rr = Math.round(Math.max(0, Math.min(1, r)) * 255);
  const gg = Math.round(Math.max(0, Math.min(1, g)) * 255);
  const bb = Math.round(Math.max(0, Math.min(1, b)) * 255);
  return `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}

/**
 * Relative luminance (0–1). Perceptual brightness.
 * Formula: 0.299*R + 0.587*G + 0.114*B
 */
export function getLuminance(hex: string): number | null {
  const rgb = parseColor(hex);
  if (!rgb) return null;
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

/**
 * True if the color is dark (luminance < threshold).
 * Use a lighter stroke for dark colors.
 */
export function isColorDark(hex: string): boolean {
  const lum = getLuminance(hex);
  return lum !== null && lum < LUMINANCE_THRESHOLD;
}

/**
 * Returns a selection stroke color that contrasts with the shape's fill.
 * - Light fills (luminance >= 0.5): darker shade of the color
 * - Dark fills (luminance < 0.5): lighter shade of the color
 */
export function getSelectionStroke(fillColor: string): string {
  const rgb = parseColor(fillColor);
  if (!rgb) return FALLBACK_STROKE;

  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  const isLight = luminance >= LUMINANCE_THRESHOLD;

  if (isLight) {
    // Darken: gentle shift toward black (0.6 keeps stroke closer to fill)
    return rgbToHex(rgb.r * 0.6, rgb.g * 0.6, rgb.b * 0.6);
  } else {
    // Lighten: gentle shift toward white
    const blend = 0.4;
    return rgbToHex(
      rgb.r + (1 - rgb.r) * blend,
      rgb.g + (1 - rgb.g) * blend,
      rgb.b + (1 - rgb.b) * blend
    );
  }
}

/**
 * Returns a visible tint of the color for toolbar backgrounds.
 * Blends ~35% toward white — keeps enough of the theme color to be clearly distinct.
 */
export function colorToToolbarBg(fillColor: string): string {
  const rgb = parseColor(fillColor);
  if (!rgb) return "rgba(255,255,255,0.95)";
  const blend = 0.35;
  return rgbToHex(
    rgb.r + (1 - rgb.r) * blend,
    rgb.g + (1 - rgb.g) * blend,
    rgb.b + (1 - rgb.b) * blend
  );
}
