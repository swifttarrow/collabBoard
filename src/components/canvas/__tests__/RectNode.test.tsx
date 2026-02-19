/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RectNode } from "../RectNode";

const mockOnSelect = vi.fn();
const mockOnHover = vi.fn();
const mockOnDelete = vi.fn();
const mockOnColorChange = vi.fn();
const mockOnCustomColor = vi.fn();
const mockOnDragEnd = vi.fn();
const mockRegisterNodeRef = vi.fn();

const defaultObject = {
  id: "rect-1",
  type: "rect" as const,
  parentId: null,
  x: 100,
  y: 80,
  width: 220,
  height: 140,
  rotation: 0,
  color: "#E2E8F0",
  text: "",
};

vi.mock("react-konva", () => ({
  Group: ({
    children,
    onClick,
    onMouseEnter,
    onMouseLeave,
  }: {
    children: React.ReactNode;
    onClick?: (e: { evt: { shiftKey?: boolean }; cancelBubble: boolean }) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }) => (
    <div
      data-testid="rect-node"
      onClick={() => onClick?.({ evt: { shiftKey: false }, cancelBubble: false })}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  ),
  Rect: () => <div data-testid="rect-shape" />,
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

describe("RectNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders rect node", () => {
    render(
      <RectNode
        object={defaultObject}
        isSelected={false}
        showControls={false}
        trashImage={null}
        registerNodeRef={mockRegisterNodeRef}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onDelete={mockOnDelete}
        onColorChange={mockOnColorChange}
        onCustomColor={mockOnCustomColor}
        onDragEnd={mockOnDragEnd}
      />
    );

    expect(screen.getAllByTestId("rect-node")[0]).toBeInTheDocument();
    expect(screen.getByTestId("rect-shape")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", () => {
    render(
      <RectNode
        object={defaultObject}
        isSelected={false}
        showControls={false}
        trashImage={null}
        registerNodeRef={mockRegisterNodeRef}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onDelete={mockOnDelete}
        onColorChange={mockOnColorChange}
        onCustomColor={mockOnCustomColor}
        onDragEnd={mockOnDragEnd}
      />
    );

    fireEvent.click(screen.getAllByTestId("rect-node")[0]!);
    expect(mockOnSelect).toHaveBeenCalledWith("rect-1", false);
  });

  it("calls onHover on mouse enter and leave", () => {
    render(
      <RectNode
        object={defaultObject}
        isSelected={false}
        showControls={false}
        trashImage={null}
        registerNodeRef={mockRegisterNodeRef}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onDelete={mockOnDelete}
        onColorChange={mockOnColorChange}
        onCustomColor={mockOnCustomColor}
        onDragEnd={mockOnDragEnd}
      />
    );

    fireEvent.mouseEnter(screen.getAllByTestId("rect-node")[0]!);
    expect(mockOnHover).toHaveBeenCalledWith("rect-1");

    fireEvent.mouseLeave(screen.getAllByTestId("rect-node")[0]!);
    expect(mockOnHover).toHaveBeenCalledWith(null);
  });

  it("shows color palette and trash when selected and showControls", () => {
    render(
      <RectNode
        object={defaultObject}
        isSelected={true}
        showControls={true}
        trashImage={null}
        registerNodeRef={mockRegisterNodeRef}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onDelete={mockOnDelete}
        onColorChange={mockOnColorChange}
        onCustomColor={mockOnCustomColor}
        onDragEnd={mockOnDragEnd}
      />
    );

    expect(screen.getByTestId("color-palette")).toBeInTheDocument();
    expect(screen.getByTestId("trash-btn")).toBeInTheDocument();
  });
});
