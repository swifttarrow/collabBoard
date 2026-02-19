import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBoard } from "../actions";

const mockRedirect = vi.fn();
const mockRevalidatePath = vi.fn();
const mockGetUser = vi.fn();
const mockSingle = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      auth: {
        getUser: () => mockGetUser(),
      },
      from: () => ({
        insert: () => ({
          select: () => ({
            single: () => mockSingle(),
          }),
        }),
      }),
    })
  ),
}));

describe("createBoard", () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockRevalidatePath.mockClear();
    mockGetUser.mockReset();
    mockSingle.mockReset();
  });

  it("redirects to login when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const formData = new FormData();
    formData.set("title", "My Board");

    await expect(createBoard(formData)).rejects.toThrow("REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("creates board and redirects on success", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockSingle.mockResolvedValue({
      data: { id: "board-new-id" },
      error: null,
    });

    const formData = new FormData();
    formData.set("title", "My Board");

    await expect(createBoard(formData)).rejects.toThrow(
      "REDIRECT:/boards/board-new-id"
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/boards");
    expect(mockRedirect).toHaveBeenCalledWith("/boards/board-new-id");
  });

  it("returns error when insert fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });

    const formData = new FormData();
    formData.set("title", "My Board");

    const result = await createBoard(formData);
    expect(result).toEqual({ error: "DB error" });
  });

  it("uses Untitled board when title is empty", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockSingle.mockResolvedValue({
      data: { id: "board-id" },
      error: null,
    });

    const formData = new FormData();

    await expect(createBoard(formData)).rejects.toThrow("REDIRECT:/boards/board-id");
    expect(mockSingle).toHaveBeenCalled();
  });
});
