/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useKeyboardShortcuts } from "../useKeyboardShortcuts";

type HookOptions = {
  selection: string[];
  onConfirmDeleteMany?: (count: number) => Promise<boolean>;
};

function renderShortcuts({ selection, onConfirmDeleteMany }: HookOptions) {
  const onDeleteSelection = vi.fn();
  const removeObject = vi.fn();
  const clearSelection = vi.fn();

  renderHook(() =>
    useKeyboardShortcuts({
      selection,
      objects: {},
      addObject: vi.fn(),
      removeObject,
      clearSelection,
      setSelection: vi.fn(),
      isEditingText: false,
      onDeleteSelection,
      onConfirmDeleteMany,
    })
  );

  return { onDeleteSelection, removeObject, clearSelection };
}

describe("useKeyboardShortcuts delete confirmation", () => {
  it("deletes single selection without confirmation", async () => {
    const { onDeleteSelection } = renderShortcuts({ selection: ["a"] });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    });

    await waitFor(() => {
      expect(onDeleteSelection).toHaveBeenCalledWith(["a"]);
    });
  });

  it("prompts on multi-select and deletes after confirm", async () => {
    const onConfirmDeleteMany = vi.fn().mockResolvedValue(true);
    const { onDeleteSelection } = renderShortcuts({
      selection: ["a", "b"],
      onConfirmDeleteMany,
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    });

    await waitFor(() => {
      expect(onConfirmDeleteMany).toHaveBeenCalledWith(2);
      expect(onDeleteSelection).toHaveBeenCalledWith(["a", "b"]);
    });
  });

  it("prompts on multi-select and skips delete when cancelled", async () => {
    const onConfirmDeleteMany = vi.fn().mockResolvedValue(false);
    const { onDeleteSelection } = renderShortcuts({
      selection: ["a", "b"],
      onConfirmDeleteMany,
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    });

    await waitFor(() => {
      expect(onConfirmDeleteMany).toHaveBeenCalledWith(2);
    });
    expect(onDeleteSelection).not.toHaveBeenCalled();
  });
});
