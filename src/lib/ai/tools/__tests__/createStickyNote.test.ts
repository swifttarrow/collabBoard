import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStickyNote } from "../createStickyNote";
import type { ToolContext } from "../types";

describe("createStickyNote", () => {
  const mockBroadcast = vi.fn();
  const mockInsertChain = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  function createMockContext(overrides?: Partial<ToolContext>): ToolContext {
    return {
      boardId: "board-1",
      supabase: {
        from: () => ({
          insert: () => mockInsertChain,
        }),
      } as never,
      broadcast: mockBroadcast,
      objects: {},
      ...overrides,
    };
  }

  beforeEach(() => {
    mockBroadcast.mockClear();
    mockInsertChain.select.mockReturnValue(mockInsertChain);
  });

  it("creates sticky and broadcasts INSERT", async () => {
    const ctx = createMockContext();
    mockInsertChain.single.mockResolvedValue({
      data: {
        id: "new-id",
        board_id: "board-1",
        type: "sticky",
        data: null,
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
        updated_by: null,
      },
      error: null,
    });

    const result = await createStickyNote(ctx, {
      text: "Hello",
      x: 10,
      y: 20,
    });

    expect(result).toContain("Created sticky note");
    expect(mockBroadcast).toHaveBeenCalledTimes(1);
    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        op: "INSERT",
        object: expect.objectContaining({
          type: "sticky",
          text: "Hello",
          x: 10,
          y: 20,
        }),
      }),
    );
  });

  it("resolves color name to hex", async () => {
    const ctx = createMockContext();
    mockInsertChain.single.mockResolvedValue({
      data: {
        id: "new-id",
        board_id: "board-1",
        type: "sticky",
        data: null,
        parent_id: null,
        x: 0,
        y: 0,
        width: 180,
        height: 120,
        rotation: 0,
        color: "#93c5fd",
        text: "Blue",
        clip_content: false,
        updated_at: "2025-01-01T00:00:00Z",
        updated_by: null,
      },
      error: null,
    });

    await createStickyNote(ctx, {
      text: "Blue",
      x: 0,
      y: 0,
      color: "blue",
    });

    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        object: expect.objectContaining({
          color: "#93c5fd",
        }),
      }),
    );
  });

  it("returns error message when insert fails", async () => {
    const ctx = createMockContext();
    mockInsertChain.single.mockResolvedValue({
      data: null,
      error: { message: "Insert failed" },
    });

    const result = await createStickyNote(ctx, {
      text: "Fail",
      x: 0,
      y: 0,
    });

    expect(result).toBe("Error: Insert failed");
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});
