"use client";

import { useCallback, useRef } from "react";
import type Konva from "konva";
import { Group, Rect, Text } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import { getSelectionStroke } from "@/lib/color-utils";
import {
  TRASH_CORNER_OFFSET,
  SELECTION_STROKE_WIDTH,
  RECT_CORNER_RADIUS,
  DEFAULT_FRAME_COLOR,
  FRAME_HEADER_HEIGHT,
  STICKY_TEXT_FILL,
  STICKY_FONT_SIZE,
  DROP_TARGET_STROKE,
  DROP_TARGET_STROKE_WIDTH,
  DROP_TARGET_FILL,
  CONNECTOR_TARGET_STROKE,
  CONNECTOR_TARGET_STROKE_WIDTH,
} from "./constants";

type FrameObject = BoardObject & { type: "frame" };

type FrameNodeProps = {
  object: FrameObject;
  isSelected: boolean;
  showControls: boolean;
  isDropTarget?: boolean;
  isConnectionTarget?: boolean;
  draggable?: boolean;
  /** When rendering inside a parent Group, pass {x:0, y:0} so parent handles position. */
  position?: { x: number; y: number };
  registerNodeRef: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onHover: (id: string | null) => void;
  onContextMenu: (
    id: string,
    objectType: "frame",
    e: Konva.KonvaEventObject<PointerEvent>
  ) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
};

export function FrameNode({
  object,
  isSelected,
  showControls: _,
  isDropTarget = false,
  isConnectionTarget = false,
  draggable = true,
  position,
  registerNodeRef,
  onSelect,
  onHover,
  onContextMenu,
  onDragStart,
  onDragMove,
  onDragEnd,
}: FrameNodeProps) {
  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true; // Select deepest node; prevent parent frame from overwriting (incl. nested frames)
      onSelect(object.id, e.evt.shiftKey);
    },
    [object.id, onSelect]
  );
  const handleMouseEnter = useCallback(() => onHover(object.id), [object.id, onHover]);
  const handleMouseLeave = useCallback(() => onHover(null), [onHover]);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleDragStart = useCallback(() => {
    if (position) dragStartRef.current = { x: object.x, y: object.y };
    onDragStart?.(object.id);
  }, [object.id, object.x, object.y, position, onDragStart]);
  const handleDragMove = useCallback(
    (e: { target: { name: () => string; x: () => number; y: () => number } }) => {
      const target = e.target;
      if (target?.name() && onDragMove) {
        const x = target.x();
        const y = target.y();
        if (position && dragStartRef.current) {
          onDragMove(target.name(), dragStartRef.current.x + x, dragStartRef.current.y + y);
        } else {
          onDragMove(target.name(), x, y);
        }
      }
    },
    [onDragMove, position]
  );
  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true; // Prevent parent frame from receiving bubbled dragEnd
      const target = e.target;
      if (target?.name()) {
        const x = target.x();
        const y = target.y();
        if (position && dragStartRef.current) {
          onDragEnd(target.name(), dragStartRef.current.x + x, dragStartRef.current.y + y);
          dragStartRef.current = null;
        } else {
          onDragEnd(target.name(), x, y);
        }
      }
    },
    [onDragEnd, position]
  );
  const handleContextMenu = useCallback(
    (evt: Konva.KonvaEventObject<PointerEvent>) => {
      evt.evt.preventDefault();
      onContextMenu(object.id, "frame", evt);
    },
    [object.id, onContextMenu]
  );
  const color = object.color || DEFAULT_FRAME_COLOR;
  const headerHeight = Math.min(FRAME_HEADER_HEIGHT, object.height / 3);
  const pos = position ?? { x: object.x, y: object.y };

  return (
    <Group
      key={object.id}
      name={object.id}
      x={pos.x}
      y={pos.y}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
    >
      {isSelected && (
        <Rect
          x={-TRASH_CORNER_OFFSET}
          y={-TRASH_CORNER_OFFSET}
          width={object.width + 2 * TRASH_CORNER_OFFSET}
          height={object.height + 2 * TRASH_CORNER_OFFSET}
          fill="transparent"
          listening
        />
      )}
      <Group
        name={object.id}
        rotation={object.rotation ?? 0}
        ref={(node) => registerNodeRef(object.id, isSelected ? node : null)}
      >
        {/* Main body rect - used by Transformer for resize */}
        <Rect
          width={object.width}
          height={object.height}
          fill={color}
          stroke={
            isConnectionTarget
              ? CONNECTOR_TARGET_STROKE
              : isDropTarget
                ? DROP_TARGET_STROKE
                : isSelected
                  ? getSelectionStroke(color)
                  : undefined
          }
          strokeWidth={
            isConnectionTarget
              ? CONNECTOR_TARGET_STROKE_WIDTH
              : isDropTarget
                ? DROP_TARGET_STROKE_WIDTH
                : isSelected
                  ? SELECTION_STROKE_WIDTH
                  : 0
          }
          cornerRadius={RECT_CORNER_RADIUS}
        />
        {/* Drop-target fill tint when reparent would occur */}
        {isDropTarget && (
          <Rect
            width={object.width}
            height={object.height}
            fill={DROP_TARGET_FILL}
            cornerRadius={RECT_CORNER_RADIUS}
            listening={false}
          />
        )}
        {/* Title in header area */}
        <Text
          x={12}
          y={headerHeight / 2 - STICKY_FONT_SIZE / 2}
          width={Math.max(0, object.width - 24)}
          height={headerHeight}
          text=""
          fontSize={STICKY_FONT_SIZE}
          fontFamily="Inter, system-ui, sans-serif"
          fill={STICKY_TEXT_FILL}
          listening={false}
          ellipsis
          wrap="none"
        />
      </Group>
    </Group>
  );
}
