import { describe, it, expect } from "vitest";
import {
  getAnchorPoint,
  getShapeAnchors,
  getLineGeometry,
  geometryToLinePoints,
  geometryToKonvaPoints,
  findNearestNodeAndAnchor,
  getConnectorsAttachedToNode,
} from "../geometry";
import type { BoardObject } from "@/lib/board/types";

function rect(id: string, x: number, y: number, w: number, h: number): BoardObject {
  return {
    id,
    type: "rect",
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    color: "#fff",
    text: "",
  };
}

function circle(id: string, x: number, y: number, r: number): BoardObject {
  return {
    id,
    type: "circle",
    x,
    y,
    width: r * 2,
    height: r * 2,
    rotation: 0,
    color: "#fff",
    text: "",
  };
}

describe("getAnchorPoint", () => {
  it("returns center-right for rect right-mid", () => {
    const shape = rect("r", 0, 0, 100, 50);
    const pt = getAnchorPoint(shape, "right-mid");
    expect(pt.x).toBe(100);
    expect(pt.y).toBe(25);
  });

  it("returns correct point for circle anchor", () => {
    const shape = circle("c", 0, 0, 50);
    const pt = getAnchorPoint(shape, "right");
    const cx = 50;
    const cy = 50;
    const r = 50;
    expect(pt.x).toBeCloseTo(cx + r, 5);
    expect(pt.y).toBeCloseTo(cy, 5);
  });
});

describe("getShapeAnchors", () => {
  it("returns all anchors for a shape", () => {
    const shape = rect("r", 0, 0, 100, 50);
    const anchors = getShapeAnchors(shape);
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.every((a) => "anchor" in a && "x" in a && "y" in a)).toBe(true);
  });
});

describe("getLineGeometry", () => {
  it("computes geometry for legacy startShapeId/endShapeId line", () => {
    const objects = {
      a: rect("a", 0, 0, 100, 50),
      b: rect("b", 200, 0, 100, 50),
    };
    const line = {
      id: "line-1",
      type: "line" as const,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      color: "#000",
      text: "",
      data: { startShapeId: "a", endShapeId: "b" },
    };
    const geom = getLineGeometry(line, objects);
    expect(geom.startX).toBe(100); // rect a right-mid
    expect(geom.startY).toBe(25);
    expect(geom.endX).toBe(300); // rect b right-mid (200 + 100 width)
    expect(geom.endY).toBe(25);
  });

  it("handles free endpoints", () => {
    const line = {
      id: "line-1",
      type: "line" as const,
      x: 10,
      y: 20,
      width: 0,
      height: 0,
      rotation: 0,
      color: "#000",
      text: "",
      data: {
        start: { type: "free" as const, x: 0, y: 0 },
        end: { type: "free" as const, x: 100, y: 50 },
      },
    };
    const geom = getLineGeometry(line, {});
    expect(geom.startX).toBe(0);
    expect(geom.startY).toBe(0);
    expect(geom.endX).toBe(100);
    expect(geom.endY).toBe(50);
  });
});

describe("geometryToLinePoints", () => {
  it("converts points to Konva-relative format", () => {
    const geom = {
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 50,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
      ],
    };
    const pts = geometryToLinePoints(geom);
    expect(pts).toEqual([0, 0, 100, 50]);
  });
});

describe("geometryToKonvaPoints", () => {
  it("returns line points for straight path", () => {
    const geom = {
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 50,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
      ],
    };
    const pts = geometryToKonvaPoints(geom, "straight");
    expect(pts.length).toBeGreaterThan(0);
  });
});

describe("findNearestNodeAndAnchor", () => {
  it("returns null when no node in range", () => {
    const objects = { a: rect("a", 100, 100, 50, 50) };
    expect(findNearestNodeAndAnchor({ x: 0, y: 0 }, objects)).toBeNull();
  });

  it("finds node when point is near anchor", () => {
    const objects = { a: rect("a", 0, 0, 100, 50) };
    const result = findNearestNodeAndAnchor({ x: 105, y: 25 }, objects, undefined, 20);
    expect(result).not.toBeNull();
    expect(result!.nodeId).toBe("a");
  });

  it("finds line endpoints when point is near", () => {
    const objects = {
      line: {
        id: "line",
        type: "line" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        color: "#000",
        text: "",
        data: {
          start: { type: "free" as const, x: 50, y: 50 },
          end: { type: "free" as const, x: 150, y: 80 },
        },
      },
    };
    const nearStart = findNearestNodeAndAnchor({ x: 52, y: 51 }, objects, undefined, 10);
    expect(nearStart).not.toBeNull();
    expect(nearStart!.nodeId).toBe("line");
    expect(nearStart!.anchor).toBe("line-start");
  });
});

describe("getConnectorsAttachedToNode", () => {
  it("returns line ids attached to node", () => {
    const objects = {
      a: rect("a", 0, 0, 50, 50),
      line1: {
        ...rect("line1", 0, 0, 0, 0),
        type: "line" as const,
        data: { startShapeId: "a", endShapeId: "b" },
      },
    };
    expect(getConnectorsAttachedToNode("a", objects)).toEqual(["line1"]);
  });
});
