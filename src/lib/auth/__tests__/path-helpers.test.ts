import { describe, it, expect } from "vitest";
import { isProtected, isAuthPath } from "../path-helpers";

describe("isProtected", () => {
  it("returns true for /boards", () => {
    expect(isProtected("/boards")).toBe(true);
  });

  it("returns true for /boards/:id", () => {
    expect(isProtected("/boards/abc-123")).toBe(true);
  });

  it("returns false for /", () => {
    expect(isProtected("/")).toBe(false);
  });

  it("returns false for /login", () => {
    expect(isProtected("/login")).toBe(false);
  });

  it("returns false for path that only starts with similar prefix", () => {
    expect(isProtected("/board")).toBe(false);
    expect(isProtected("/boardsx")).toBe(false);
  });
});

describe("isAuthPath", () => {
  it("returns true for /login", () => {
    expect(isAuthPath("/login")).toBe(true);
  });

  it("returns true for /signup", () => {
    expect(isAuthPath("/signup")).toBe(true);
  });

  it("returns true for /auth/*", () => {
    expect(isAuthPath("/auth")).toBe(true);
    expect(isAuthPath("/auth/callback")).toBe(true);
  });

  it("returns false for /boards", () => {
    expect(isAuthPath("/boards")).toBe(false);
  });
});
