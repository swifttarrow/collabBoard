/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserMenu } from "../UserMenu";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("UserMenu", () => {
  it("renders user initials from email", () => {
    render(
      <UserMenu email="alice@example.com" />
    );
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders initials from first and last name", () => {
    render(
      <UserMenu
        email="alice@example.com"
        firstName="Alice"
        lastName="Smith"
      />
    );
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("renders user menu trigger", () => {
    render(<UserMenu email="test@example.com" />);
    expect(screen.getByRole("button", { name: /user menu/i })).toBeInTheDocument();
  });
});
