import { describe, it, expect } from "vitest";
import {
  AVATAR_COLORS,
  getAvatarColorFallback,
  getInitialsFromName,
} from "../avatar-colors";

describe("getAvatarColorFallback", () => {
  it("returns a color from AVATAR_COLORS", () => {
    const color = getAvatarColorFallback("user-123");
    expect(AVATAR_COLORS).toContain(color);
  });

  it("returns same color for same id", () => {
    const id = "consistent-id";
    expect(getAvatarColorFallback(id)).toBe(getAvatarColorFallback(id));
  });

  it("returns different colors for different ids", () => {
    const colors = new Set([
      getAvatarColorFallback("a"),
      getAvatarColorFallback("b"),
      getAvatarColorFallback("c"),
      getAvatarColorFallback("d"),
      getAvatarColorFallback("e"),
    ]);
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe("getInitialsFromName", () => {
  it("returns first letter for single name", () => {
    expect(getInitialsFromName("Alice")).toBe("A");
  });

  it("returns first and last initials for full name", () => {
    expect(getInitialsFromName("John Doe")).toBe("JD");
  });

  it("handles multiple middle names", () => {
    expect(getInitialsFromName("John Paul Smith")).toBe("JS");
  });

  it("returns null for empty string", () => {
    expect(getInitialsFromName("")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(getInitialsFromName(null)).toBeNull();
    expect(getInitialsFromName(undefined)).toBeNull();
  });

  it("returns null for whitespace-only", () => {
    expect(getInitialsFromName("   ")).toBeNull();
  });

  it("trims input", () => {
    expect(getInitialsFromName("  John Doe  ")).toBe("JD");
  });
});
