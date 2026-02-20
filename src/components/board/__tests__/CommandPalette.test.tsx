/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";

vi.mock("@/components/canvas/CanvasToolbarContext", () => ({
  useCanvasToolbar: () => ({
    setActiveTool: vi.fn(),
    setPerfEnabled: vi.fn(),
    perfEnabled: false,
  }),
}));

vi.mock("@/components/canvas/BoardPresenceProvider", () => ({
  useBoardPresenceContext: () => ({
    followingUserId: null,
    unfollowUser: vi.fn(),
  }),
}));

vi.mock("@/components/version-history/VersionHistoryProvider", () => ({
  useVersionHistoryOptional: () => null,
}));

import { CommandPalette } from "../CommandPalette";

function renderPalette(overrides?: Partial<ComponentProps<typeof CommandPalette>>) {
  const onDeleteSelection = vi.fn();
  const onConfirmDeleteMany = vi.fn().mockResolvedValue(true);

  render(
    <CommandPalette
      stageWidth={1200}
      stageHeight={800}
      selection={["a", "b"]}
      onCopy={vi.fn()}
      onPaste={vi.fn()}
      onDuplicateSelection={vi.fn()}
      onDeleteSelection={onDeleteSelection}
      onConfirmDeleteMany={onConfirmDeleteMany}
      onClearSelection={vi.fn()}
      {...overrides}
    />
  );

  return { onDeleteSelection, onConfirmDeleteMany };
}

describe("CommandPalette delete action", () => {
  it("asks for multi-select confirmation before deleting", async () => {
    const { onDeleteSelection, onConfirmDeleteMany } = renderPalette();

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    fireEvent.click(await screen.findByText("Delete"));

    await waitFor(() => {
      expect(onConfirmDeleteMany).toHaveBeenCalledWith(2);
    });
    expect(onDeleteSelection).toHaveBeenCalledWith(["a", "b"]);
  });

  it("cancels delete when confirmation callback returns false", async () => {
    const onConfirmDeleteMany = vi.fn().mockResolvedValue(false);
    const onDeleteSelection = vi.fn();
    renderPalette({ onConfirmDeleteMany, onDeleteSelection });

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    fireEvent.click(await screen.findByText("Delete"));

    await waitFor(() => {
      expect(onConfirmDeleteMany).toHaveBeenCalledWith(2);
    });
    expect(onDeleteSelection).not.toHaveBeenCalled();
  });
});
