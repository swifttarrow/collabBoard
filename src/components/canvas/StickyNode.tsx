"use client";

import { useCallback } from "react";
import type Konva from "konva";
import { Group, Rect } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import {
  TRASH_CORNER_OFFSET,
  STICKY_CORNER_RADIUS,
  CONNECTOR_TARGET_STROKE,
  CONNECTOR_TARGET_STROKE_WIDTH,
} from "./constants";

type StickyObject = BoardObject & { type: "sticky" };

type StickyNodeProps = {
  object: StickyObject;
  isSelected: boolean;
  showControls: boolean;
  isConnectionTarget?: boolean;
  draggable?: boolean;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onHover: (id: string | null) => void;
  onContextMenu: (
    id: string,
    objectType: "sticky",
    e: Konva.KonvaEventObject<PointerEvent>
  ) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onStartEdit: (id: string) => void;
  registerNodeRef?: (id: string, node: Konva.Node | null) => void;
};

export function StickyNode({
  object,
  isSelected,
  showControls: _,
  isConnectionTarget = false,
  draggable = true,
  onSelect,
  onHover,
  onContextMenu,
  onDragStart,
  onDragMove,
  onDragEnd,
  onStartEdit,
  registerNodeRef,
}: StickyNodeProps) {
  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true; // Select deepest node; prevent frame from overwriting when object is inside frame
      onSelect(object.id, e.evt.shiftKey);
    },
    [object.id, onSelect]
  );
  const handleMouseEnter = useCallback(() => onHover(object.id), [object.id, onHover]);
  const handleMouseLeave = useCallback(() => onHover(null), [onHover]);
  const handleDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true; // Prevent parent frame from receiving bubbled drag events
      onDragStart?.(object.id);
    },
    [object.id, onDragStart]
  );
  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true; // Prevent parent frame from receiving bubbled drag events
      const target = e.target;
      if (target?.name() && onDragMove) {
        onDragMove(target.name(), target.x(), target.y());
      }
    },
    [onDragMove]
  );
  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true; // Prevent parent frame from receiving bubbled dragEnd (would overwrite frame position)
      const target = e.target;
      if (target?.name()) {
        onDragEnd(target.name(), target.x(), target.y());
      }
    },
    [onDragEnd]
  );
  const handleDblClick = useCallback(() => onStartEdit(object.id), [object.id, onStartEdit]);
  const handleContextMenu = useCallback(
    (evt: Konva.KonvaEventObject<PointerEvent>) => {
      evt.evt?.preventDefault?.();
      onContextMenu(object.id, "sticky", evt);
    },
    [object.id, onContextMenu]
  );

  return (
    <Group
      key={object.id}
      name={object.id}
      x={object.x}
      y={object.y}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDblClick={handleDblClick}
      onContextMenu={handleContextMenu}
    >
      {/* Expanded hit area when selected */}
      {isSelected && (
        <>
          <Rect
            x={object.width / 2 + 10}
            y={-TRASH_CORNER_OFFSET}
            width={object.width / 2 + TRASH_CORNER_OFFSET - 10}
            height={TRASH_CORNER_OFFSET}
            fill="transparent"
            listening
          />
        </>
      )}
      {/* Inner Group: shape only — Transformer attaches here for snug selection box */}
      <Group
        name={object.id}
        rotation={object.rotation ?? 0}
        ref={(node) => registerNodeRef?.(object.id, isSelected ? node : null)}
      >
        {/* Transparent rect for hit-test and drag; visual (bg + text) rendered in RichTextDisplayLayer */}
        <Rect
          width={object.width}
          height={object.height}
          fill="transparent"
          stroke={isConnectionTarget ? CONNECTOR_TARGET_STROKE : undefined}
          strokeWidth={isConnectionTarget ? CONNECTOR_TARGET_STROKE_WIDTH : 0}
          cornerRadius={STICKY_CORNER_RADIUS}
          listening
        />
        {/* Text content rendered in RichTextDisplayLayer */}
      </Group>
    </Group>
  );
}
