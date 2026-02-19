/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasDimensions } from "../useCanvasDimensions";

describe("useCanvasDimensions", () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      value: 1200,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: originalInnerHeight,
      writable: true,
      configurable: true,
    });
  });

  it("returns default dimensions on mount", () => {
    const { result } = renderHook(() => useCanvasDimensions());

    expect(result.current.width).toBe(1200);
    expect(result.current.height).toBe(800);
  });

  it("updates dimensions on window resize", () => {
    const { result } = renderHook(() => useCanvasDimensions());

    act(() => {
      Object.defineProperty(window, "innerWidth", {
        value: 1920,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "innerHeight", {
        value: 1080,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current.width).toBe(1920);
    expect(result.current.height).toBe(1080);
  });
});
