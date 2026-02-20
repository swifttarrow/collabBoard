import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockOpenAICompletionsCreate = vi.fn();
const mockExecuteTool = vi.fn();
const mockLoadObjects = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: (table: string) => mockFrom(table),
      channel: () => ({
        subscribe: () => Promise.resolve(),
        send: () => {},
      }),
    }),
  ),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: (...args: unknown[]) => mockOpenAICompletionsCreate(...args),
      },
    },
  })),
}));

vi.mock("@/lib/ai/openai-tools", () => ({
  TOOLS: [],
  executeTool: (...args: unknown[]) => mockExecuteTool(...args),
}));

vi.mock("../loadObjects", () => ({
  loadObjects: (...args: unknown[]) => mockLoadObjects(...args),
}));

describe("POST /api/ai/command", () => {
  const validBody = {
    boardId: "550e8400-e29b-41d4-a716-446655440000",
    command: "add a yellow sticky",
  };

  const setupOwnerAccess = () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "boards") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: validBody.boardId, owner_id: "user-1" },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "board_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });
  };

  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
    mockOpenAICompletionsCreate.mockReset();
    mockExecuteTool.mockReset();
    mockLoadObjects.mockReset();
    mockLoadObjects.mockResolvedValue({});
    mockOpenAICompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: "Done." } }],
    });
    (globalThis as typeof globalThis & { __aiCommandRateLimitStore?: unknown }).__aiCommandRateLimitStore =
      undefined;
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = new Request("http://localhost/api/ai/command", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid body", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const req = new Request("http://localhost/api/ai/command", {
      method: "POST",
      body: JSON.stringify({ boardId: "not-a-uuid", command: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid input");
  });

  it("returns 404 when board not found", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "boards") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: null,
                  error: { message: "Not found" },
                }),
            }),
          }),
        };
      }
      if (table === "board_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null }),
              }),
            }),
          }),
        };
      }
      if (table === "board_objects") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const req = new Request("http://localhost/api/ai/command", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: "Board not found" });
  });

  it("returns 403 when user has no access", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === "boards") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: validBody.boardId, owner_id: "other-user" },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "board_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null }), // no membership
              }),
            }),
          }),
        };
      }
      if (table === "board_objects") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const req = new Request("http://localhost/api/ai/command", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json).toEqual({ error: "Access denied" });
  });

  it("returns 429 when requests are spammy for same user+board", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    setupOwnerAccess();

    for (let i = 0; i < 8; i++) {
      const req = new Request("http://localhost/api/ai/command", {
        method: "POST",
        body: JSON.stringify(validBody),
        headers: { "Content-Type": "application/json" },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    const req = new Request("http://localhost/api/ai/command", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("Too many AI command requests");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("rejects clearly irrelevant requests before tool execution", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    setupOwnerAccess();

    const req = new Request("http://localhost/api/ai/command", {
      method: "POST",
      body: JSON.stringify({
        boardId: validBody.boardId,
        command: "what is the weather in San Francisco today?",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("whiteboard commands");
    expect(mockOpenAICompletionsCreate).not.toHaveBeenCalled();
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  it("blocks tool calls that would create more than 100 entities in a turn", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    setupOwnerAccess();

    const oversizedStickies = new Array(101).fill(null).map((_, i) => ({
      text: `Sticky ${i + 1}`,
    }));

    mockOpenAICompletionsCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "createStickies",
                    arguments: JSON.stringify({ stickies: oversizedStickies }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content:
                "I can’t do that in one turn. Please split it into smaller batches.",
            },
          },
        ],
      });

    const req = new Request("http://localhost/api/ai/command", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("split it into smaller batches");
    expect(mockExecuteTool).not.toHaveBeenCalled();
  });
});
