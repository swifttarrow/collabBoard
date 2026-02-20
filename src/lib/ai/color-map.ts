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
  red: "#FCA5A5",
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
