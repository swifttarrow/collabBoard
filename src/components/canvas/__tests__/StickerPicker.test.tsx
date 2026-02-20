/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StickerPicker } from "../StickerPicker";

describe("StickerPicker", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => [{ slug: "ideas", title: "Ideas", keywords: ["brainstorm"] }],
      })
    );
  });

  it("opens the picker panel above the trigger", async () => {
    render(
      <StickerPicker onSelect={vi.fn()}>
        <button type="button">Open stickers</button>
      </StickerPicker>
    );

    fireEvent.click(screen.getByRole("button", { name: /open stickers/i }));

    const dialog = await screen.findByRole("dialog", { name: /sticker picker/i });
    expect(dialog.className).toContain("bottom-full");
    expect(dialog.className).toContain("mb-2");
    expect(dialog.className).not.toContain("top-full");
  });

  it("closes when clicking outside overlay", async () => {
    render(
      <StickerPicker onSelect={vi.fn()}>
        <button type="button">Open stickers</button>
      </StickerPicker>
    );

    fireEvent.click(screen.getByRole("button", { name: /open stickers/i }));
    expect(await screen.findByRole("dialog", { name: /sticker picker/i })).toBeInTheDocument();

    const outsideOverlay = document.querySelector("div[aria-hidden]");
    expect(outsideOverlay).not.toBeNull();
    fireEvent.click(outsideOverlay!);

    expect(screen.queryByRole("dialog", { name: /sticker picker/i })).not.toBeInTheDocument();
  });
});
