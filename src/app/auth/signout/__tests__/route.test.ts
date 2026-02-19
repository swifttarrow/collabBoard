import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

const mockSignOut = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signOut: mockSignOut,
    },
  }),
}));

describe("POST /auth/signout", () => {
  beforeEach(() => {
    mockSignOut.mockClear();
  });

  it("redirects to / after sign out", async () => {
    const url = new URL("http://localhost/auth/signout");
    const request = {
      nextUrl: Object.assign(url, {
        clone: () => new URL(url.href),
      }),
    } as Parameters<typeof POST>[0];
    const response = await POST(request);
    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(new URL(location!).pathname).toBe("/");
  });

  it("calls supabase.auth.signOut", async () => {
    const url = new URL("http://localhost/auth/signout");
    const request = {
      nextUrl: Object.assign(url, {
        clone: () => new URL(url.href),
      }),
    } as Parameters<typeof POST>[0];
    await POST(request);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
