/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StickyNode } from "../StickyNode";

const mockOnSelect = vi.fn();
const mockOnHover = vi.fn();
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
    onContextMenu,
  }: {
    children: React.ReactNode;
    onClick?: (e: { evt: { shiftKey?: boolean }; cancelBubble: boolean }) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onDblClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) => (
    <div
      data-testid="sticky-node"
      onClick={() => onClick?.({ evt: { shiftKey: false }, cancelBubble: false })}
      onDoubleClick={onDblClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  ),
  Rect: () => <div data-testid="rect" />,
}));

const mockOnContextMenu = vi.fn();

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
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onContextMenu={mockOnContextMenu}
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
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onContextMenu={mockOnContextMenu}
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
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onContextMenu={mockOnContextMenu}
        onDragEnd={mockOnDragEnd}
        onStartEdit={mockOnStartEdit}
      />
    );

    fireEvent.mouseEnter(screen.getAllByTestId("sticky-node")[0]!);
    expect(mockOnHover).toHaveBeenCalledWith("sticky-1");

    fireEvent.mouseLeave(screen.getAllByTestId("sticky-node")[0]!);
    expect(mockOnHover).toHaveBeenCalledWith(null);
  });

  it("renders when selected and showControls", () => {
    render(
      <StickyNode
        object={defaultObject}
        isSelected={true}
        showControls={true}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onContextMenu={mockOnContextMenu}
        onDragEnd={mockOnDragEnd}
        onStartEdit={mockOnStartEdit}
      />
    );

    expect(screen.getAllByTestId("sticky-node")[0]).toBeInTheDocument();
  });

  it("calls onStartEdit on double-click", () => {
    render(
      <StickyNode
        object={defaultObject}
        isSelected={false}
        showControls={false}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onContextMenu={mockOnContextMenu}
        onDragEnd={mockOnDragEnd}
        onStartEdit={mockOnStartEdit}
      />
    );

    fireEvent.doubleClick(screen.getAllByTestId("sticky-node")[0]!);
    expect(mockOnStartEdit).toHaveBeenCalledWith("sticky-1");
  });

  it("accepts onContextMenu prop and renders", () => {
    render(
      <StickyNode
        object={defaultObject}
        isSelected={true}
        showControls={true}
        onSelect={mockOnSelect}
        onHover={mockOnHover}
        onContextMenu={mockOnContextMenu}
        onDragEnd={mockOnDragEnd}
        onStartEdit={mockOnStartEdit}
      />
    );

    expect(screen.getAllByTestId("sticky-node")[0]).toBeInTheDocument();
  });
});
