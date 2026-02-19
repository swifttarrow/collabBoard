/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useViewport } from "../useViewport";
import { useBoardStore } from "@/lib/board/store";

describe("useViewport", () => {
  beforeEach(() => {
    useBoardStore.setState({
      viewport: { x: 0, y: 0, scale: 1 },
    });
  });

  it("returns viewport from store", () => {
    const { result } = renderHook(() => useViewport({}));
    expect(result.current.viewport).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("getWorldPoint transforms screen to world coordinates", () => {
    useBoardStore.setState({
      viewport: { x: 100, y: 50, scale: 2 },
    });
    const mockStage = {};
    const { result } = renderHook(() => useViewport({}));

    const world = result.current.getWorldPoint(
      mockStage as never,
      { x: 200, y: 150 }
    );
    // x = (200 - 100) / 2 = 50, y = (150 - 50) / 2 = 50
    expect(world).toEqual({ x: 50, y: 50 });
  });

  it("startPan and panMove update viewport", () => {
    const { result } = renderHook(() => useViewport({}));

    act(() => {
      result.current.startPan({ x: 10, y: 20 });
    });
    expect(result.current.isPanning).toBe(true);

    act(() => {
      result.current.panMove({ x: 50, y: 60 });
    });
    // dx=40, dy=40
    expect(useBoardStore.getState().viewport).toEqual({
      x: 40,
      y: 40,
      scale: 1,
    });

    act(() => {
      result.current.endPan();
    });
    expect(result.current.isPanning).toBe(false);
  });

  it("calls unfollowUser on startPan when following", () => {
    const unfollowUser = vi.fn();
    const { result } = renderHook(() =>
      useViewport({ followingUserId: "user-1", unfollowUser })
    );

    act(() => {
      result.current.startPan({ x: 0, y: 0 });
    });

    expect(unfollowUser).toHaveBeenCalled();
  });
});
