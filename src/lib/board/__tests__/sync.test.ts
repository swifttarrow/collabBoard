import { describe, it, expect } from "vitest";
import { rowToObject, objectToRow } from "../sync";

describe("rowToObject", () => {
  it("converts a board object row to domain object", () => {
    const row = {
      id: "obj-1",
      board_id: "board-1",
      type: "sticky",
      data: {},
      parent_id: null,
      x: 10,
      y: 20,
      width: 180,
      height: 120,
      rotation: 0,
      color: "#FDE68A",
      text: "Hello",
      clip_content: false,
      updated_at: "2025-01-01T00:00:00Z",
      updated_by: "user-1",
    };
    const obj = rowToObject(row);
    expect(obj.id).toBe("obj-1");
    expect(obj.type).toBe("sticky");
    expect(obj.parentId).toBeNull();
    expect(obj.x).toBe(10);
    expect(obj.y).toBe(20);
    expect(obj.color).toBe("#FDE68A");
    expect(obj.text).toBe("Hello");
    expect(obj._updatedAt).toBe("2025-01-01T00:00:00Z");
  });

  it("uses defaults for null color and text", () => {
    const row = {
      id: "obj-2",
      board_id: "board-1",
      type: "rect",
      data: {},
      parent_id: "frame-1",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      rotation: 0,
      color: null,
      text: null,
      clip_content: true,
      updated_at: "2025-01-02T00:00:00Z",
      updated_by: null,
    };
    const obj = rowToObject(row);
    expect(obj.color).toBe("#fef08a");
    expect(obj.text).toBe("");
    expect(obj.parentId).toBe("frame-1");
  });

  it("preserves data when present", () => {
    const row = {
      id: "line-1",
      board_id: "board-1",
      type: "line",
      data: { startShapeId: "a", endShapeId: "b" },
      parent_id: null,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      color: "#000",
      text: "",
      clip_content: false,
      updated_at: "2025-01-01T00:00:00Z",
      updated_by: null,
    };
    const obj = rowToObject(row);
    expect(obj.data).toEqual({ startShapeId: "a", endShapeId: "b" });
  });
});

describe("objectToRow", () => {
  it("converts domain object to row", () => {
    const obj = {
      id: "obj-1",
      type: "sticky",
      parentId: null,
      x: 10,
      y: 20,
      width: 180,
      height: 120,
      rotation: 0,
      color: "#FDE68A",
      text: "Hello",
    };
    const row = objectToRow(obj, "board-1");
    expect(row.id).toBe("obj-1");
    expect(row.board_id).toBe("board-1");
    expect(row.type).toBe("sticky");
    expect(row.parent_id).toBeNull();
    expect(row.x).toBe(10);
    expect(row.color).toBe("#FDE68A");
  });

  it("round-trips with rowToObject", () => {
    const obj = {
      id: "obj-1",
      type: "circle",
      parentId: "frame-1",
      x: 5,
      y: 5,
      width: 50,
      height: 50,
      rotation: 45,
      color: "#93c5fd",
      text: "",
      data: { foo: "bar" },
    };
    const row = objectToRow(obj, "board-1");
    const back = rowToObject({ ...row, updated_at: "2025-01-01Z", updated_by: null });
    expect(back.id).toBe(obj.id);
    expect(back.type).toBe(obj.type);
    expect(back.parentId).toBe(obj.parentId);
    expect(back.x).toBe(obj.x);
    expect(back.color).toBe(obj.color);
    expect(back.data).toEqual(obj.data);
  });
});
