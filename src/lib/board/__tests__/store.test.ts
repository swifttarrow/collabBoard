import { describe, it, expect, beforeEach } from "vitest";
import { useBoardStore } from "../store";

function createSticky(id: string, x: number, y: number) {
  return {
    id,
    type: "sticky" as const,
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

describe("board store", () => {
  beforeEach(() => {
    useBoardStore.setState({
      boardId: null,
      objects: {},
      selection: [],
    });
  });

  describe("addObject", () => {
    it("adds object to store", () => {
      const obj = createSticky("a", 10, 20);
      useBoardStore.getState().addObject(obj);
      expect(useBoardStore.getState().objects["a"]).toEqual(obj);
    });
  });

  describe("updateObject", () => {
    it("updates existing object", () => {
      const obj = createSticky("a", 10, 20);
      useBoardStore.getState().addObject(obj);
      useBoardStore.getState().updateObject("a", { x: 30, y: 40 });
      expect(useBoardStore.getState().objects["a"].x).toBe(30);
      expect(useBoardStore.getState().objects["a"].y).toBe(40);
    });

    it("no-ops when object does not exist", () => {
      useBoardStore.getState().updateObject("missing", { x: 1 });
      expect(Object.keys(useBoardStore.getState().objects)).toHaveLength(0);
    });
  });

  describe("removeObject", () => {
    it("removes object", () => {
      useBoardStore.getState().addObject(createSticky("a", 0, 0));
      useBoardStore.getState().removeObject("a");
      expect(useBoardStore.getState().objects["a"]).toBeUndefined();
    });
  });

  describe("setSelection", () => {
    it("sets selection as array", () => {
      useBoardStore.getState().setSelection(["a", "b"]);
      expect(useBoardStore.getState().selection).toEqual(["a", "b"]);
    });

    it("sets selection as single id", () => {
      useBoardStore.getState().setSelection("a");
      expect(useBoardStore.getState().selection).toEqual(["a"]);
    });

    it("clears with null", () => {
      useBoardStore.getState().setSelection(["a"]);
      useBoardStore.getState().setSelection(null);
      expect(useBoardStore.getState().selection).toEqual([]);
    });
  });

  describe("toggleSelection", () => {
    it("adds id when not selected", () => {
      useBoardStore.getState().toggleSelection("a");
      expect(useBoardStore.getState().selection).toEqual(["a"]);
    });

    it("removes id when already selected", () => {
      useBoardStore.getState().setSelection(["a", "b"]);
      useBoardStore.getState().toggleSelection("a");
      expect(useBoardStore.getState().selection).toEqual(["b"]);
    });
  });

  describe("applyRemoteObject", () => {
    it("applies remote insert when newer", () => {
      const remote = {
        ...createSticky("a", 10, 20),
        _updatedAt: "2025-01-02T00:00:00Z",
      };
      useBoardStore.getState().applyRemoteObject(
        "a",
        remote,
        "2025-01-02T00:00:00Z"
      );
      expect(useBoardStore.getState().objects["a"].x).toBe(10);
    });

    it("ignores older remote update (LWW)", () => {
      useBoardStore.getState().addObject({
        ...createSticky("a", 10, 20),
        _updatedAt: "2025-01-02T00:00:00Z",
      });
      const olderRemote = {
        ...createSticky("a", 99, 99),
        _updatedAt: "2025-01-01T00:00:00Z",
      };
      useBoardStore.getState().applyRemoteObject(
        "a",
        olderRemote,
        "2025-01-01T00:00:00Z"
      );
      expect(useBoardStore.getState().objects["a"].x).toBe(10);
    });

    it("applies remote delete when newer", () => {
      useBoardStore.getState().addObject(createSticky("a", 0, 0));
      useBoardStore.getState().applyRemoteObject(
        "a",
        null,
        "2025-01-02T00:00:00Z"
      );
      expect(useBoardStore.getState().objects["a"]).toBeUndefined();
    });
  });

  describe("setBoardId", () => {
    it("clears objects when board changes", () => {
      useBoardStore.getState().addObject(createSticky("a", 0, 0));
      useBoardStore.getState().setBoardId("board-1");
      expect(useBoardStore.getState().objects).toEqual({});
      expect(useBoardStore.getState().boardId).toBe("board-1");
    });
  });
});
