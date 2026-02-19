import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: (table: string) => mockFrom(table),
      channel: () => ({
        subscribe: () => Promise.resolve(),
        send: () => {},
      }),
    })
  ),
}));

vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "NO" }),
  streamText: vi.fn().mockReturnValue({
    toTextStreamResponse: () =>
      new Response("OK", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
  }),
  tool: (config: unknown) => config,
}));

describe("POST /api/ai/command", () => {
  const validBody = {
    boardId: "550e8400-e29b-41d4-a716-446655440000",
    command: "add a yellow sticky",
  };

  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
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
                maybeSingle: () =>
                  Promise.resolve({ data: null }), // no membership
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
});
