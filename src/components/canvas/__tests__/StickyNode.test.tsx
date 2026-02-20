/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StickyNode } from "../StickyNode";

const mockOnSelect = vi.fn();
const mockOnHover = vi.fn();
const mockOnDelete = vi.fn();
const mockOnDuplicate = vi.fn();
const mockOnColorChange = vi.fn();
const mockOnCustomColor = vi.fn();
const mockOnDragEnd = vi.fn();
const mockOnStartEdit = vi.fn();

const defaultObject = {
  id: "sticky-1",
  type: "sticky" as const,
  parentId: null,
  x: 50,
  y: 50,
  width: 180,
  height: 120,
  rotation: 0,
  color: "#FDE68A",
  text: "Test note",
};

vi.mock("react-konva", () => ({
  Group: ({
    children,
    onClick,
    onMouseEnter,
    onMouseLeave,
    onDblClick,
  }: {
    children: React.ReactNode;
    onClick?: (e: { evt: { shiftKey?: boolean }; cancelBubble: boolean }) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onDblClick?: () => void;
  }) => (
    <div
      data-testid="sticky-node"
      onClick={() => onClick?.({ evt: { shiftKey: false }, cancelBubble: false })}
      onDoubleClick={onDblClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  ),
  Rect: () => <div data-testid="rect" />,
}));

vi.mock("../ColorPalette", () => ({
  ColorPalette: () => <div data-testid="color-palette" />,
  PALETTE_WIDTH: 0,
  PALETTE_HEIGHT: 0,
}));

vi.mock("../TrashButton", () => ({
  TrashButton: ({ onDelete }: { onDelete: () => void }) => (
    <button data-testid="trash-btn" onClick={onDelete}>
      Trash
    </button>
  ),
}));

vi.mock("../DuplicateButton", () => ({
  DuplicateButton: ({ onDuplicate }: { onDuplicate: () => void }) => (
    <button data-testid="duplicate-btn" onClick={onDuplicate}>
      Duplicate
    </button>
  ),
}));

describe("StickyNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sticky node", () => {
    render(
      <StickyNode
        object={defaultObject}
        isSelected={false}
        showControls={false}
        trashImage={null}
        copyImage={null}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onDelete={mockOnDelete}
        onDuplicate={mockOnDuplicate}
        onColorChange={mockOnColorChange}
        onCustomColor={mockOnCustomColor}
        onDragEnd={mockOnDragEnd}
        onStartEdit={mockOnStartEdit}
      />
    );

    expect(screen.getAllByTestId("sticky-node")[0]).toBeInTheDocument();
  });

  it("calls onSelect when clicked", () => {
    render(
      <StickyNode
        object={defaultObject}
        isSelected={false}
        showControls={false}
        trashImage={null}
        copyImage={null}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onDelete={mockOnDelete}
        onDuplicate={mockOnDuplicate}
        onColorChange={mockOnColorChange}
        onCustomColor={mockOnCustomColor}
        onDragEnd={mockOnDragEnd}
        onStartEdit={mockOnStartEdit}
      />
    );

    fireEvent.click(screen.getAllByTestId("sticky-node")[0]!);
    expect(mockOnSelect).toHaveBeenCalledWith("sticky-1", false);
  });

  it("calls onHover on mouse enter and leave", () => {
    render(
      <StickyNode
        object={defaultObject}
        isSelected={false}
        showControls={false}
        trashImage={null}
        copyImage={null}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onDelete={mockOnDelete}
        onDuplicate={mockOnDuplicate}
        onColorChange={mockOnColorChange}
        onCustomColor={mockOnCustomColor}
        onDragEnd={mockOnDragEnd}
        onStartEdit={mockOnStartEdit}
      />
    );

    fireEvent.mouseEnter(screen.getAllByTestId("sticky-node")[0]!);
    expect(mockOnHover).toHaveBeenCalledWith("sticky-1");

    fireEvent.mouseLeave(screen.getAllByTestId("sticky-node")[0]!);
    expect(mockOnHover).toHaveBeenCalledWith(null);
  });

  it("shows color palette and trash when selected and showControls", () => {
    render(
      <StickyNode
        object={defaultObject}
        isSelected={true}
        showControls={true}
        trashImage={null}
        copyImage={null}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onDelete={mockOnDelete}
        onDuplicate={mockOnDuplicate}
        onColorChange={mockOnColorChange}
        onCustomColor={mockOnCustomColor}
        onDragEnd={mockOnDragEnd}
        onStartEdit={mockOnStartEdit}
      />
    );

    expect(screen.getByTestId("color-palette")).toBeInTheDocument();
    expect(screen.getByTestId("trash-btn")).toBeInTheDocument();
  });

  it("calls onStartEdit on double-click", () => {
    render(
      <StickyNode
        object={defaultObject}
        isSelected={false}
        showControls={false}
        trashImage={null}
        copyImage={null}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onDelete={mockOnDelete}
        onDuplicate={mockOnDuplicate}
        onColorChange={mockOnColorChange}
        onCustomColor={mockOnCustomColor}
        onDragEnd={mockOnDragEnd}
        onStartEdit={mockOnStartEdit}
      />
    );

    fireEvent.doubleClick(screen.getAllByTestId("sticky-node")[0]!);
    expect(mockOnStartEdit).toHaveBeenCalledWith("sticky-1");
  });

  it("calls onDelete when trash button clicked", () => {
    render(
      <StickyNode
        object={defaultObject}
        isSelected={true}
        showControls={true}
        trashImage={null}
        copyImage={null}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onDelete={mockOnDelete}
        onDuplicate={mockOnDuplicate}
        onColorChange={mockOnColorChange}
        onCustomColor={mockOnCustomColor}
        onDragEnd={mockOnDragEnd}
        onStartEdit={mockOnStartEdit}
      />
    );

    fireEvent.click(screen.getByTestId("trash-btn"));
    expect(mockOnDelete).toHaveBeenCalledWith("sticky-1");
  });
});
