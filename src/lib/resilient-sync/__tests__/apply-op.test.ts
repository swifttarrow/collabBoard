import { describe, it, expect } from "vitest";
import { applyOpToState } from "../apply-op";
import type { BoardOperation } from "../operations";

function createOp(
  type: BoardOperation["type"],
  payload: BoardOperation["payload"]
): BoardOperation {
  return {
    opId: crypto.randomUUID(),
    clientId: "c1",
    boardId: "b1",
    timestamp: Date.now(),
    baseRevision: 0,
    type,
    payload,
    idempotencyKey: crypto.randomUUID(),
  };
}

describe("applyOpToState", () => {
  it("applies create op", () => {
    const op = createOp("create", {
      id: "obj-1",
      type: "sticky",
      parentId: null,
      x: 10,
      y: 20,
      width: 100,
      height: 80,
      rotation: 0,
      color: "#fef08a",
      text: "Hello",
    });
    const result = applyOpToState(op, {});
    expect(Object.keys(result)).toHaveLength(1);
    expect(result["obj-1"]).toBeDefined();
    expect(result["obj-1"].x).toBe(10);
    expect(result["obj-1"].text).toBe("Hello");
  });

  it("applies update op", () => {
    const existing = {
      "obj-1": {
        id: "obj-1",
        type: "sticky" as const,
        parentId: null,
        x: 10,
        y: 20,
        width: 100,
        height: 80,
        rotation: 0,
        color: "#fef08a",
        text: "Hello",
      },
    };
    const op = createOp("update", { id: "obj-1", x: 50, text: "Updated" });
    const result = applyOpToState(op, existing);
    expect(result["obj-1"].x).toBe(50);
    expect(result["obj-1"].text).toBe("Updated");
    expect(result["obj-1"].y).toBe(20);
  });

  it("skips update when object does not exist (deleted)", () => {
    const op = createOp("update", { id: "missing", x: 50 });
    const result = applyOpToState(op, {});
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("applies delete op", () => {
    const existing = {
      "obj-1": {
        id: "obj-1",
        type: "sticky" as const,
        parentId: null,
        x: 10,
        y: 20,
        width: 100,
        height: 80,
        rotation: 0,
        color: "#fef08a",
        text: "Hello",
      },
    };
    const op = createOp("delete", { id: "obj-1" });
    const result = applyOpToState(op, existing);
    expect(result["obj-1"]).toBeUndefined();
  });
});
