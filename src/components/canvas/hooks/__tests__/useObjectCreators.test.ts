/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useObjectCreators } from "../useObjectCreators";
import type { BoardObjectWithMeta } from "@/lib/board/store";

function createSticky(id: string, x: number, y: number): BoardObjectWithMeta {
  return {
    id,
    type: "sticky",
    parentId: null,
    x,
    y,
    width: 180,
    height: 120,
    rotation: 0,
    color: "#FDE68A",
    text: "test",
  };
}

describe("useObjectCreators", () => {
  const addObject = vi.fn();
  const setSelection = vi.fn();
  const updateObject = vi.fn();
  const onTextCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createText adds object and selects it", () => {
    const objects: Record<string, BoardObjectWithMeta> = {};
    const { result } = renderHook(() =>
      useObjectCreators({
        addObject,
        setSelection,
        updateObject,
        objects,
        selection: [],
        lineStyle: "none",
        onTextCreated,
      })
    );

    act(() => {
      result.current.createText({ x: 100, y: 50 });
    });

    expect(addObject).toHaveBeenCalledTimes(1);
    const added = addObject.mock.calls[0]![0];
    expect(added.type).toBe("text");
    expect(added.x).toBe(100 - 100); // centered: x - width/2, DEFAULT_TEXT.width=200
    expect(added.y).toBe(50 - 40); // centered: y - height/2, DEFAULT_TEXT.height=80
    expect(setSelection).toHaveBeenCalledWith(added.id);
    expect(onTextCreated).toHaveBeenCalledWith(added.id);
  });

  it("createSticky adds object and selects it", () => {
    const objects: Record<string, BoardObjectWithMeta> = {};
    const { result } = renderHook(() =>
      useObjectCreators({
        addObject,
        setSelection,
        updateObject,
        objects,
        selection: [],
        lineStyle: "none",
      })
    );

    act(() => {
      result.current.createSticky({ x: 200, y: 150 });
    });

    expect(addObject).toHaveBeenCalledTimes(1);
    const added = addObject.mock.calls[0]![0];
    expect(added.type).toBe("sticky");
    expect(added.x).toBe(200 - 90); // DEFAULT_STICKY.width=180
    expect(added.y).toBe(150 - 60); // DEFAULT_STICKY.height=120
    expect(added.text).toBe("New note");
    expect(setSelection).toHaveBeenCalledWith(added.id);
  });

  it("createRect adds rect with given bounds", () => {
    const objects: Record<string, BoardObjectWithMeta> = {};
    const { result } = renderHook(() =>
      useObjectCreators({
        addObject,
        setSelection,
        updateObject,
        objects,
        selection: [],
        lineStyle: "none",
      })
    );

    act(() => {
      result.current.createRect({ x: 10, y: 20, width: 100, height: 80 });
    });

    expect(addObject).toHaveBeenCalledTimes(1);
    const added = addObject.mock.calls[0]![0];
    expect(added.type).toBe("rect");
    expect(added.x).toBe(10);
    expect(added.y).toBe(20);
    expect(added.width).toBe(100);
    expect(added.height).toBe(80);
  });

  it("createCircle constrains to MIN_CIRCLE_SIZE", () => {
    const objects: Record<string, BoardObjectWithMeta> = {};
    const { result } = renderHook(() =>
      useObjectCreators({
        addObject,
        setSelection,
        updateObject,
        objects,
        selection: [],
        lineStyle: "none",
      })
    );

    act(() => {
      result.current.createCircle({ x: 0, y: 0, width: 10, height: 10 });
    });

    const added = addObject.mock.calls[0]![0];
    expect(added.type).toBe("circle");
    expect(added.width).toBe(40); // MIN_CIRCLE_SIZE
    expect(added.height).toBe(40);
  });

  it("createFrame reparents selected objects into new frame", () => {
    const rect = createSticky("r1", 50, 50) as BoardObjectWithMeta;
    (rect as { type: string }).type = "rect";
    (rect as { width: number }).width = 100;
    (rect as { height: number }).height = 80;
    const objects: Record<string, BoardObjectWithMeta> = { r1: rect };
    const { result } = renderHook(() =>
      useObjectCreators({
        addObject,
        setSelection,
        updateObject,
        objects,
        selection: ["r1"],
        lineStyle: "none",
      })
    );

    act(() => {
      result.current.createFrame({ x: 0, y: 0, width: 300, height: 200 });
    });

    expect(addObject).toHaveBeenCalledTimes(1);
    const frame = addObject.mock.calls[0]![0];
    expect(frame.type).toBe("frame");
    expect(frame.width).toBe(300);
    expect(frame.height).toBe(200);
    expect(updateObject).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ parentId: frame.id })
    );
  });

  it("createFreeLine creates free line with no arrowheads", () => {
    const objects: Record<string, BoardObjectWithMeta> = {};
    const { result } = renderHook(() =>
      useObjectCreators({
        addObject,
        setSelection,
        updateObject,
        objects,
        selection: [],
      })
    );

    act(() => {
      result.current.createFreeLine({
        x1: 10,
        y1: 20,
        x2: 110,
        y2: 120,
      });
    });

    expect(addObject).toHaveBeenCalledTimes(1);
    const line = addObject.mock.calls[0]![0];
    expect(line.type).toBe("line");
    const data = line.data as Record<string, unknown>;
    expect(data.start).toEqual({ type: "free", x: 10, y: 20 });
    expect(data.end).toEqual({ type: "free", x: 110, y: 120 });
    expect(data.startCap).toBe("point");
    expect(data.endCap).toBe("point");
  });

  it("createLineFromHandle creates line with x2/y2 data", () => {
    const objects: Record<string, BoardObjectWithMeta> = {};
    const { result } = renderHook(() =>
      useObjectCreators({
        addObject,
        setSelection,
        updateObject,
        objects,
        selection: [],
        lineStyle: "right",
      })
    );

    act(() => {
      result.current.createLineFromHandle({
        startX: 0,
        startY: 0,
        endX: 100,
        endY: 50,
      });
    });

    const line = addObject.mock.calls[0]![0];
    expect(line.x).toBe(0);
    expect(line.y).toBe(0);
    const data = line.data as Record<string, unknown>;
    expect(data.x2).toBe(100);
    expect(data.y2).toBe(50);
  });
});
