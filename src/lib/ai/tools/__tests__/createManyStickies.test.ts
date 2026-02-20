import { beforeEach, describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";
import type { ToolContext } from "../types";
import { createManyStickies } from "../createManyStickies";

const createStickiesMock = vi.hoisted(() => vi.fn());

vi.mock("../createStickies", () => ({
  createStickies: createStickiesMock,
}));

function createMockContext(): ToolContext {
  return {
    boardId: "board-1",
    supabase: {} as never,
    broadcast: vi.fn(),
    objects: {},
  };
}

function createMockOpenAI(responseJson: unknown): OpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify(responseJson),
              },
            },
          ],
        }),
      },
    },
  } as unknown as OpenAI;
}

describe("createManyStickies", () => {
  beforeEach(() => {
    createStickiesMock.mockReset();
    createStickiesMock.mockResolvedValue("Created 2 stickies.");
  });

  it("applies requested color intent to all generated stickies", async () => {
    const ctx = createMockContext();
    const openai = createMockOpenAI({
      stickies: [
        { text: "A", color: "yellow" },
        { text: "B" },
      ],
    });

    await createManyStickies(ctx, openai, {
      totalCount: 2,
      topic: "ideas",
      color: "black",
    });

    expect(createStickiesMock).toHaveBeenCalledWith(ctx, {
      stickies: [
        { text: "A", color: "black" },
        { text: "B", color: "black" },
      ],
    });
  });

  it("preserves generated per-sticky colors when no color intent is provided", async () => {
    const ctx = createMockContext();
    const openai = createMockOpenAI({
      stickies: [
        { text: "A", color: "pink" },
        { text: "B", color: "blue" },
      ],
    });

    await createManyStickies(ctx, openai, {
      totalCount: 2,
      topic: "ideas",
    });

    expect(createStickiesMock).toHaveBeenCalledWith(ctx, {
      stickies: [
        { text: "A", color: "pink" },
        { text: "B", color: "blue" },
      ],
    });
  });
});
