"use client";

import { useCallback } from "react";
import type Konva from "konva";
import { Group, Rect } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import { ColorPalette, PALETTE_WIDTH, PALETTE_HEIGHT } from "./ColorPalette";
import { TrashButton } from "./TrashButton";
import { DuplicateButton } from "./DuplicateButton";
import {
  TRASH_SIZE,
  TRASH_CORNER_OFFSET,
  PALETTE_FLOATING_GAP,
  STICKY_CORNER_RADIUS,
  BUTTON_GAP,
} from "./constants";

type StickyObject = BoardObject & { type: "sticky" };

type StickyNodeProps = {
  object: StickyObject;
  isSelected: boolean;
  showControls: boolean;
  draggable?: boolean;
  trashImage: HTMLImageElement | null;
  copyImage: HTMLImageElement | null;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onHover: (id: string | null) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onCustomColor: (id: string, anchor: { x: number; y: number }) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onStartEdit: (id: string) => void;
  registerNodeRef?: (id: string, node: Konva.Node | null) => void;
};

export function StickyNode({
  object,
  isSelected,
  showControls,
  draggable = true,
  trashImage,
  copyImage,
  onSelect,
  onHover,
  onDelete,
  onDuplicate,
  onColorChange,
  onCustomColor,
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
  const handleDelete = useCallback(() => onDelete(object.id), [object.id, onDelete]);
  const handleDuplicate = useCallback(() => onDuplicate(object.id), [object.id, onDuplicate]);
  const handleColorChange = useCallback(
    (color: string) => onColorChange(object.id, color),
    [object.id, onColorChange]
  );
  const handleCustomColor = useCallback(
    () =>
      onCustomColor(object.id, {
        x: object.x + (object.width - PALETTE_WIDTH) / 2 + PALETTE_WIDTH - 28,
        y: object.y + object.height + PALETTE_FLOATING_GAP + 14,
      }),
    [object.id, object.x, object.y, object.width, object.height, onCustomColor]
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
    >
      {/* Expanded hit area when selected: keeps hover (and trash visible) when cursor moves to trash/palette.
          Use targeted rects to avoid blocking Transformer resize anchors (which sit at padding=18 around the shape).
          Left/top-left anchors must stay clear for resize to work in all directions. */}
      {isSelected && (
        <>
          {/* Top-right bridge to trash/duplicate — avoids top-left and top-center anchors */}
          <Rect
            x={object.width / 2 + 10}
            y={-TRASH_CORNER_OFFSET}
            width={object.width / 2 + TRASH_CORNER_OFFSET - 10}
            height={TRASH_CORNER_OFFSET}
            fill="transparent"
            listening
          />
          {/* Bottom bridge to palette — two strips to avoid bottom-center resize anchor (6px) */}
          <Rect
            x={10}
            y={object.height}
            width={object.width / 2 - 10}
            height={PALETTE_FLOATING_GAP + PALETTE_HEIGHT}
            fill="transparent"
            listening
          />
          <Rect
            x={object.width / 2 + 10}
            y={object.height}
            width={object.width / 2 - 20}
            height={PALETTE_FLOATING_GAP + PALETTE_HEIGHT}
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
          cornerRadius={STICKY_CORNER_RADIUS}
          listening
        />
        {/* Text content rendered in RichTextDisplayLayer */}
      </Group>
      {/* Hit area so clicks between shape and palette keep selection; listening=false to avoid blocking bottom resize anchor (covered by bridge rects above) */}
      {isSelected && (
        <Rect
          x={Math.min(0, (object.width - PALETTE_WIDTH) / 2)}
          y={object.height}
          width={
            Math.max(object.width, (object.width + PALETTE_WIDTH) / 2) -
            Math.min(0, (object.width - PALETTE_WIDTH) / 2)
          }
          height={PALETTE_FLOATING_GAP + PALETTE_HEIGHT}
          fill="transparent"
          listening={false}
        />
      )}
      {showControls && (
        <>
          <DuplicateButton
            x={object.width + TRASH_CORNER_OFFSET - 2 * TRASH_SIZE - BUTTON_GAP}
            y={-TRASH_CORNER_OFFSET}
            size={TRASH_SIZE}
            image={copyImage}
            onDuplicate={handleDuplicate}
          />
          <TrashButton
            x={object.width + TRASH_CORNER_OFFSET - TRASH_SIZE}
            y={-TRASH_CORNER_OFFSET}
            size={TRASH_SIZE}
            image={trashImage}
            onDelete={handleDelete}
          />
          <ColorPalette
            x={(object.width - PALETTE_WIDTH) / 2}
            y={object.height + PALETTE_FLOATING_GAP}
            currentColor={object.color}
            onSelectColor={handleColorChange}
            onCustomColor={handleCustomColor}
          />
        </>
      )}
    </Group>
  );
}
