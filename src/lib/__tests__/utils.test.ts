import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
  it("merges single class", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("merges multiple classes", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", true && "visible")).toBe("base visible");
  });

  it("handles undefined and null", () => {
    expect(cn("foo", undefined, null)).toBe("foo");
  });

  it("merges tailwind classes correctly", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
