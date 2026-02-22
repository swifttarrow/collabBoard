/**
 * Resolve color name or hex to hex. Used by AI tools so the LLM can use
 * friendly names ("yellow", "blue") instead of hex codes.
 */
const COLOR_NAME_TO_HEX: Record<string, string> = {
  black: "#000000",
  yellow: "#FDE68A",
  coral: "#FCA5A5",
  slate: "#E2E8F0",
  cyan: "#A5F3FC",
  mint: "#BBF7D0",
  green: "#BBF7D0",
  fuchsia: "#F5D0FE",
  peach: "#FED7AA",
  blue: "#93c5fd",
  pink: "#FCA5A5",
  purple: "#E9D5FF",
  orange: "#FDBA74",
  red: "#EF4444",
};

/** Hex variants per color name for relaxed matching (UI may use different shades). */
const COLOR_NAME_HEX_VARIANTS: Record<string, string[]> = {
  blue: ["#93c5fd", "#3b82f6", "#60a5fa", "#2563eb", "#1d4ed8"],
  yellow: ["#FDE68A", "#fef08a", "#fde047", "#facc15"],
  red: ["#EF4444", "#f87171", "#dc2626"],
};

const HEX_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export function resolveColor(nameOrHex: string): string {
  const trimmed = nameOrHex.trim().toLowerCase();
  if (HEX_REGEX.test(trimmed)) {
    return trimmed;
  }
  const hex = COLOR_NAME_TO_HEX[trimmed];
  return hex ?? "#FDE68A";
}

/** Return true if stored hex matches the given color name (including common variants). */
export function colorMatches(colorName: string, storedHex: string): boolean {
  const hex = (storedHex ?? "").trim().toLowerCase();
  if (!hex) return false;
  const variants = COLOR_NAME_HEX_VARIANTS[colorName.trim().toLowerCase()];
  if (variants) {
    return variants.some((v) => v.toLowerCase() === hex);
  }
  return resolveColor(colorName).toLowerCase() === hex;
}
