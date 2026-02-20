import { describe, it, expect } from "vitest";
import { resolveColor } from "../color-map";

describe("resolveColor", () => {
  it("returns hex for known color names", () => {
    expect(resolveColor("black")).toBe("#000000");
    expect(resolveColor("yellow")).toBe("#FDE68A");
    expect(resolveColor("blue")).toBe("#93c5fd");
    expect(resolveColor("pink")).toBe("#FCA5A5");
    expect(resolveColor("green")).toBe("#BBF7D0");
  });

  it("is case insensitive", () => {
    expect(resolveColor("YELLOW")).toBe("#FDE68A");
    expect(resolveColor("Yellow")).toBe("#FDE68A");
  });

  it("trims whitespace", () => {
    expect(resolveColor("  yellow  ")).toBe("#FDE68A");
  });

  it("passes through valid hex codes (lowercased)", () => {
    expect(resolveColor("#FDE68A")).toBe("#fde68a");
    expect(resolveColor("#fff")).toBe("#fff");
    expect(resolveColor("#abc123")).toBe("#abc123");
  });

  it("returns default yellow for unknown color names", () => {
    expect(resolveColor("unknown")).toBe("#FDE68A");
    expect(resolveColor("notacolor")).toBe("#FDE68A");
  });

  it("handles empty-ish input with default", () => {
    expect(resolveColor("")).toBe("#FDE68A");
  });
});
