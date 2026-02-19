/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBoxSelect } from "../useBoxSelect";
import type { BoardObject } from "@/lib/board/types";

function createRect(id: string, x: number, y: number, w: number, h: number): BoardObject {
  return {
    id,
    type: "rect",
    parentId: null,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    color: "#ccc",
    text: "",
  };
}

describe("useBoxSelect", () => {
  const setSelection = vi.fn();
  const getWorldPoint = vi.fn((_stage: unknown, p: { x: number; y: number }) => p);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with null draftBox", () => {
    const objects: Record<string, BoardObject> = {};
    const { result } = renderHook(() =>
      useBoxSelect({
        getWorldPoint,
        objects,
        setSelection,
        selection: [],
      })
    );

    expect(result.current.draftBox).toBeNull();
    expect(result.current.isSelecting).toBe(false);
  });

  it("start sets draftBox and isSelecting", () => {
    const objects: Record<string, BoardObject> = {};
    const mockStage = {
      getPointerPosition: () => ({ x: 100, y: 50 }),
    };
    const { result } = renderHook(() =>
      useBoxSelect({
        getWorldPoint,
        objects,
        setSelection,
        selection: [],
      })
    );

    act(() => {
      result.current.start(mockStage as never, false);
    });

    expect(result.current.draftBox).toEqual({ x: 100, y: 50, width: 0, height: 0 });
    expect(result.current.isSelecting).toBe(true);
  });

  it("move updates draftBox dimensions", () => {
    const objects: Record<string, BoardObject> = {};
    const mockStage = {
      getPointerPosition: () => ({ x: 100, y: 50 }),
    };
    const mockStageMove = {
      getPointerPosition: () => ({ x: 200, y: 150 }),
    };
    const { result } = renderHook(() =>
      useBoxSelect({
        getWorldPoint,
        objects,
        setSelection,
        selection: [],
      })
    );

    act(() => {
      result.current.start(mockStage as never, false);
    });
    act(() => {
      result.current.move(mockStageMove as never);
    });

    expect(result.current.draftBox).toEqual({ x: 100, y: 50, width: 100, height: 100 });
  });

  it("finish selects objects intersecting box", () => {
    const rect1 = createRect("r1", 50, 50, 100, 80);
    const rect2 = createRect("r2", 200, 200, 100, 80);
    const objects: Record<string, BoardObject> = { r1: rect1, r2: rect2 };
    const { result } = renderHook(() =>
      useBoxSelect({
        getWorldPoint,
        objects,
        setSelection,
        selection: [],
      })
    );

    const mockStageStart = { getPointerPosition: () => ({ x: 0, y: 0 }) };
    const mockStageEnd = { getPointerPosition: () => ({ x: 150, y: 150 }) };

    act(() => {
      result.current.start(mockStageStart as never, false);
    });
    act(() => {
      result.current.move(mockStageEnd as never);
    });
    act(() => {
      result.current.finish();
    });

    expect(setSelection).toHaveBeenCalledWith(["r1"]);
    expect(result.current.draftBox).toBeNull();
  });

  it("finish with small box does not select", () => {
    const rect1 = createRect("r1", 50, 50, 100, 80);
    const objects: Record<string, BoardObject> = { r1: rect1 };
    const { result } = renderHook(() =>
      useBoxSelect({
        getWorldPoint,
        objects,
        setSelection,
        selection: [],
      })
    );

    const mockStage = { getPointerPosition: () => ({ x: 50, y: 50 }) };

    act(() => {
      result.current.start(mockStage as never, false);
    });
    act(() => {
      result.current.move(mockStage as never); // width/height 0
    });
    act(() => {
      result.current.finish();
    });

    expect(setSelection).not.toHaveBeenCalled();
  });

  it("cancel clears draftBox", () => {
    const objects: Record<string, BoardObject> = {};
    const mockStage = { getPointerPosition: () => ({ x: 10, y: 20 }) };
    const { result } = renderHook(() =>
      useBoxSelect({
        getWorldPoint,
        objects,
        setSelection,
        selection: [],
      })
    );

    act(() => {
      result.current.start(mockStage as never, false);
    });
    expect(result.current.draftBox).not.toBeNull();

    act(() => {
      result.current.cancel();
    });
    expect(result.current.draftBox).toBeNull();
  });
});
