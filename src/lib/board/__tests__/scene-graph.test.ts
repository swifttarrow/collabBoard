import { describe, it, expect } from "vitest";
import {
  getAbsolutePosition,
  getChildren,
  getRootObjects,
  computeReparentLocalPosition,
  computeReparentLocalPositionFromDrop,
  wouldCreateCycle,
  findContainingFrame,
} from "../scene-graph";
import type { BoardObjectWithMeta } from "../store";

function obj(id: string, x: number, y: number, parentId?: string | null): BoardObjectWithMeta {
  return {
    id,
    type: "rect",
    parentId: parentId ?? null,
    x,
    y,
    width: 100,
    height: 50,
    rotation: 0,
    color: "#fff",
    text: "",
  };
}

describe("getAbsolutePosition", () => {
  it("returns local position for root object", () => {
    const objects = { a: obj("a", 10, 20) };
    expect(getAbsolutePosition("a", objects)).toEqual({ x: 10, y: 20 });
  });

  it("sums ancestor positions for nested object", () => {
    const objects = {
      frame: obj("frame", 100, 50),
      child: obj("child", 10, 10, "frame"),
    };
    expect(getAbsolutePosition("child", objects)).toEqual({ x: 110, y: 60 });
  });

  it("returns 0,0 for missing node", () => {
    expect(getAbsolutePosition("missing", {})).toEqual({ x: 0, y: 0 });
  });
});

describe("getChildren", () => {
  it("returns objects with matching parentId", () => {
    const objects = {
      a: obj("a", 0, 0),
      b: obj("b", 10, 0, "frame"),
      c: obj("c", 20, 0, "frame"),
    };
    expect(getChildren("frame", objects).map((o) => o.id)).toEqual(["b", "c"]);
  });

  it("returns root objects for parentId null", () => {
    const objects = {
      a: obj("a", 0, 0),
      b: obj("b", 10, 0, "frame"),
    };
    expect(getChildren(null, objects).map((o) => o.id)).toEqual(["a"]);
  });
});

describe("getRootObjects", () => {
  it("returns objects with null parentId", () => {
    const objects = {
      a: obj("a", 0, 0),
      b: obj("b", 10, 0, "frame"),
    };
    expect(getRootObjects(objects).map((o) => o.id)).toEqual(["a"]);
  });
});

describe("computeReparentLocalPosition", () => {
  it("preserves absolute position when moving to root", () => {
    const objects = {
      frame: obj("frame", 50, 50),
      child: obj("child", 10, 10, "frame"),
    };
    const result = computeReparentLocalPosition(
      objects.child,
      null,
      objects
    );
    expect(result).toEqual({ x: 60, y: 60 });
  });

  it("converts to new parent local coords", () => {
    const objects = {
      frame1: obj("frame1", 0, 0),
      frame2: obj("frame2", 100, 100),
      child: obj("child", 50, 50, "frame1"),
    };
    const result = computeReparentLocalPosition(
      objects.child,
      "frame2",
      objects
    );
    expect(result).toEqual({ x: -50, y: -50 });
  });
});

describe("computeReparentLocalPositionFromDrop", () => {
  it("converts drop position in current parent to new parent local", () => {
    const objects = {
      frame1: obj("frame1", 0, 0),
      frame2: obj("frame2", 200, 0),
    };
    const result = computeReparentLocalPositionFromDrop(
      50,
      30,
      "frame1",
      "frame2",
      objects
    );
    expect(result).toEqual({ x: -150, y: 30 });
  });
});

describe("wouldCreateCycle", () => {
  it("returns true when target is descendant of node", () => {
    const objects = {
      a: obj("a", 0, 0),
      b: obj("b", 0, 0, "a"),
      c: obj("c", 0, 0, "b"),
    };
    expect(wouldCreateCycle("a", "c", objects)).toBe(true);
  });

  it("returns false when no cycle", () => {
    const objects = {
      a: obj("a", 0, 0),
      b: obj("b", 0, 0, "a"),
    };
    expect(wouldCreateCycle("b", "a", objects)).toBe(false);
  });
});

describe("findContainingFrame", () => {
  it("returns innermost frame containing point", () => {
    const objects = {
      outer: obj("outer", 0, 0),
      inner: obj("inner", 50, 50, "outer"),
    };
    (objects.outer as BoardObjectWithMeta & { type: string }).type = "frame";
    (objects.outer as BoardObjectWithMeta & { width: number }).width = 200;
    (objects.outer as BoardObjectWithMeta & { height: number }).height = 200;
    (objects.inner as BoardObjectWithMeta & { type: string }).type = "frame";
    (objects.inner as BoardObjectWithMeta & { width: number }).width = 100;
    (objects.inner as BoardObjectWithMeta & { height: number }).height = 100;

    const innerAbs = { x: 100, y: 100 }; // outer at 0,0 + inner at 50,50
    const result = findContainingFrame(innerAbs, objects);
    expect(result).toBe("inner");
  });

  it("returns null when point not in any frame", () => {
    const objects = {
      frame: obj("frame", 100, 100),
    };
    (objects.frame as BoardObjectWithMeta & { type: string }).type = "frame";
    (objects.frame as BoardObjectWithMeta & { width: number }).width = 50;
    (objects.frame as BoardObjectWithMeta & { height: number }).height = 50;
    expect(findContainingFrame({ x: 0, y: 0 }, objects)).toBeNull();
  });
});
