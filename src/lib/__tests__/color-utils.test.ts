import { describe, it, expect } from "vitest";
import { getLuminance, isColorDark, getSelectionStroke } from "../color-utils";

describe("getLuminance", () => {
  it("returns luminance for hex colors", () => {
    expect(getLuminance("#ffffff")).toBeCloseTo(1, 10);
    expect(getLuminance("#000000")).toBe(0);
    expect(getLuminance("#888888")).toBeCloseTo(0.5, 1);
  });

  it("returns null for invalid colors", () => {
    expect(getLuminance("")).toBeNull();
    expect(getLuminance("not-a-color")).toBeNull();
  });
});

describe("isColorDark", () => {
  it("returns true for dark colors", () => {
    expect(isColorDark("#000000")).toBe(true);
    expect(isColorDark("#111111")).toBe(true);
  });

  it("returns false for light colors", () => {
    expect(isColorDark("#ffffff")).toBe(false);
    expect(isColorDark("#fef08a")).toBe(false);
  });
});

describe("getSelectionStroke", () => {
  it("returns a contrasting stroke for light fill", () => {
    const stroke = getSelectionStroke("#ffffff");
    expect(stroke).toMatch(/^#[0-9a-f]{6}$/i);
    expect(stroke).not.toBe("#ffffff");
  });

  it("returns a contrasting stroke for dark fill", () => {
    const stroke = getSelectionStroke("#000000");
    expect(stroke).toMatch(/^#[0-9a-f]{6}$/i);
    expect(stroke).not.toBe("#000000");
  });

  it("returns fallback for invalid color", () => {
    expect(getSelectionStroke("invalid")).toBe("#0f172a");
  });
});
