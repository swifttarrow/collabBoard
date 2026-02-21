/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RectNode } from "../RectNode";

const mockOnSelect = vi.fn();
const mockOnHover = vi.fn();
const mockOnDelete = vi.fn();
const mockOnDuplicate = vi.fn();
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
    onContextMenu,
  }: {
    children: React.ReactNode;
    onClick?: (e: { evt: { shiftKey?: boolean }; cancelBubble: boolean }) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) => (
    <div
      data-testid="rect-node"
      onClick={() => onClick?.({ evt: { shiftKey: false }, cancelBubble: false })}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  ),
  Rect: () => <div data-testid="rect-shape" />,
}));

const mockOnContextMenu = vi.fn();

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
        registerNodeRef={mockRegisterNodeRef}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onContextMenu={mockOnContextMenu}
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
        registerNodeRef={mockRegisterNodeRef}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onContextMenu={mockOnContextMenu}
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
        registerNodeRef={mockRegisterNodeRef}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onContextMenu={mockOnContextMenu}
        onDragEnd={mockOnDragEnd}
      />
    );

    fireEvent.mouseEnter(screen.getAllByTestId("rect-node")[0]!);
    expect(mockOnHover).toHaveBeenCalledWith("rect-1");

    fireEvent.mouseLeave(screen.getAllByTestId("rect-node")[0]!);
    expect(mockOnHover).toHaveBeenCalledWith(null);
  });

  it("renders selection when selected and showControls", () => {
    render(
      <RectNode
        object={defaultObject}
        isSelected={true}
        showControls={true}
        registerNodeRef={mockRegisterNodeRef}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onContextMenu={mockOnContextMenu}
        onDragEnd={mockOnDragEnd}
      />
    );

    expect(screen.getAllByTestId("rect-shape")[0]).toBeInTheDocument();
  });
});
