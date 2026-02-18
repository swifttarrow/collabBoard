"use client";

import { useCallback, useRef } from "react";
import type Konva from "konva";
import { Group, Line, Circle, Rect } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import type { LineData } from "@/lib/board/types";
import { ColorPalette, PALETTE_WIDTH, PALETTE_HEIGHT } from "./ColorPalette";
import { TrashButton } from "./TrashButton";
import { getSelectionStroke } from "@/lib/color-utils";
import {
  TRASH_PADDING,
  TRASH_SIZE,
  TRASH_CORNER_OFFSET,
  PALETTE_FLOATING_GAP,
  SELECTION_STROKE_WIDTH,
  DEFAULT_RECT_COLOR,
} from "./constants";

const LINE_STROKE_WIDTH = 3;
const LINE_HIT_PADDING = 12; // Extra pixels each side of the line for easier selection
const ANCHOR_RADIUS = 2; // Small handles at line endpoints

type LineObject = BoardObject & { type: "line" };

function getLineData(obj: LineObject): LineData {
  const d = obj.data;
  if (d && typeof d.x2 === "number" && typeof d.y2 === "number") {
    return { x2: d.x2, y2: d.y2 };
  }
  return { x2: obj.x + 80, y2: obj.y };
}

type LineNodeProps = {
  object: LineObject;
  isSelected: boolean;
  showControls: boolean;
  trashImage: HTMLImageElement | null;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onHover: (id: string | null) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onCustomColor: (id: string, anchor: { x: number; y: number }) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number, lineEnd?: { x2: number; y2: number }) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onAnchorMove: (id: string, anchor: "start" | "end", x: number, y: number) => void;
  onLineMove?: (id: string, x: number, y: number, x2: number, y2: number) => void;
  registerNodeRef?: (id: string, node: Konva.Node | null) => void;
};

export function LineNode({
  object,
  isSelected,
  showControls,
  trashImage,
  onSelect,
  onHover,
  onDelete,
  onColorChange,
  onCustomColor,
  onDragStart,
  onDragMove,
  onDragEnd,
  onAnchorMove,
  onLineMove,
  registerNodeRef,
}: LineNodeProps) {
  const lineData = getLineData(object);
  const x2Local = lineData.x2 - object.x;
  const y2Local = lineData.y2 - object.y;
  const prevPosRef = useRef({ x: object.x, y: object.y });
  const initialLineEndRef = useRef({ x2: lineData.x2, y2: lineData.y2 });

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => onSelect(object.id, e.evt.shiftKey),
    [object.id, onSelect]
  );
  const handleMouseEnter = useCallback(() => onHover(object.id), [object.id, onHover]);
  const handleMouseLeave = useCallback(() => onHover(null), [onHover]);

  const handleGroupDragStart = useCallback(() => {
    prevPosRef.current = { x: object.x, y: object.y };
    initialLineEndRef.current = { x2: lineData.x2, y2: lineData.y2 };
    onDragStart?.(object.id);
  }, [object.id, object.x, object.y, lineData.x2, lineData.y2, onDragStart]);

  const handleGroupDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const target = e.target;
      const newX = target.x();
      const newY = target.y();
      const dx = newX - prevPosRef.current.x;
      const dy = newY - prevPosRef.current.y;
      const { x2: startX2, y2: startY2 } = initialLineEndRef.current;
      if (onDragMove) {
        onDragMove(object.id, newX, newY, {
          x2: startX2 + dx,
          y2: startY2 + dy,
        });
      }
    },
    [object.id, onDragMove]
  );

  const handleGroupDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const target = e.target;
      const newX = target.x();
      const newY = target.y();
      const dx = newX - prevPosRef.current.x;
      const dy = newY - prevPosRef.current.y;
      prevPosRef.current = { x: newX, y: newY };
      const { x2: startX2, y2: startY2 } = initialLineEndRef.current;
      const newX2 = startX2 + dx;
      const newY2 = startY2 + dy;
      if (onLineMove) {
        onLineMove(object.id, newX, newY, newX2, newY2);
      } else {
        onDragEnd(object.id, newX, newY);
        onAnchorMove(object.id, "end", newX2, newY2);
      }
    },
    [object.id, onDragEnd, onAnchorMove, onLineMove]
  );

  const stopAnchorBubble = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
  }, []);

  const handleAnchor1DragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      stopAnchorBubble(e);
    },
    [stopAnchorBubble]
  );

  const handleAnchor1DragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      stopAnchorBubble(e);
      const target = e.target;
      const newX = object.x + target.x();
      const newY = object.y + target.y();
      onAnchorMove(object.id, "start", newX, newY);
    },
    [object.id, object.x, object.y, onAnchorMove, stopAnchorBubble]
  );

  const handleAnchor1DragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      stopAnchorBubble(e);
      const target = e.target;
      const newX = object.x + target.x();
      const newY = object.y + target.y();
      onAnchorMove(object.id, "start", newX, newY);
    },
    [object.id, object.x, object.y, lineData.x2, lineData.y2, onAnchorMove, stopAnchorBubble]
  );

  const handleAnchor2DragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      stopAnchorBubble(e);
    },
    [stopAnchorBubble]
  );

  const handleAnchor2DragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      stopAnchorBubble(e);
      const target = e.target;
      const newX2 = object.x + target.x();
      const newY2 = object.y + target.y();
      onAnchorMove(object.id, "end", newX2, newY2);
    },
    [object.id, object.x, object.y, lineData.x2, lineData.y2, onAnchorMove, stopAnchorBubble]
  );

  const handleAnchor2DragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      stopAnchorBubble(e);
      const target = e.target;
      const newX2 = object.x + target.x();
      const newY2 = object.y + target.y();
      onAnchorMove(object.id, "end", newX2, newY2);
    },
    [object.id, object.x, object.y, lineData.x2, lineData.y2, onAnchorMove, stopAnchorBubble]
  );

  const handleDelete = useCallback(() => onDelete(object.id), [object.id, onDelete]);
  const handleColorChange = useCallback(
    (color: string) => onColorChange(object.id, color),
    [object.id, onColorChange]
  );
  const handleCustomColor = useCallback(
    () => {
      const midX = (object.x + lineData.x2) / 2;
      const midY = (object.y + lineData.y2) / 2;
      onCustomColor(object.id, {
        x: midX + PALETTE_WIDTH - 28,
        y: midY + PALETTE_FLOATING_GAP + 14,
      });
    },
    [object.id, object.x, object.y, lineData.x2, lineData.y2, onCustomColor]
  );

  const color = object.color || DEFAULT_RECT_COLOR;
  const lineLength = Math.hypot(x2Local, y2Local);
  const paletteX = Math.max(0, lineLength / 2 - PALETTE_WIDTH / 2);
  const paletteY = 24;

  const minX = Math.min(0, x2Local) - TRASH_CORNER_OFFSET - TRASH_SIZE;
  const minY = Math.min(0, y2Local) - TRASH_CORNER_OFFSET - TRASH_SIZE;
  const maxX = Math.max(0, x2Local) + TRASH_CORNER_OFFSET + Math.max(PALETTE_WIDTH, TRASH_SIZE);
  const maxY = Math.max(paletteY + PALETTE_HEIGHT, Math.max(0, y2Local)) + PALETTE_FLOATING_GAP;

  return (
    <Group
      key={object.id}
      name={object.id}
      x={object.x}
      y={object.y}
      draggable
      onDragStart={handleGroupDragStart}
      onDragMove={handleGroupDragMove}
      onDragEnd={handleGroupDragEnd}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Expanded hit area when selected: keeps hover (and trash visible) when cursor moves to trash/palette */}
      {isSelected && (
        <Rect
          x={minX}
          y={minY}
          width={maxX - minX}
          height={maxY - minY}
          fill="transparent"
          listening
        />
      )}
      {/* Inner Group: line + anchors only — Transformer attaches here for snug selection box */}
      <Group ref={(node) => registerNodeRef?.(object.id, isSelected ? node : null)} name={object.id}>
        <Line
          points={[0, 0, x2Local, y2Local]}
          stroke={color}
          strokeWidth={LINE_STROKE_WIDTH}
          hitStrokeWidth={LINE_STROKE_WIDTH + LINE_HIT_PADDING * 2}
          lineCap="round"
          lineJoin="round"
          listening
        />
        {isSelected && (
          <>
            <Circle
              x={0}
              y={0}
              radius={ANCHOR_RADIUS}
              fill="white"
              stroke={getSelectionStroke(color)}
              strokeWidth={SELECTION_STROKE_WIDTH}
              draggable
              onDragStart={handleAnchor1DragStart}
              onDragMove={handleAnchor1DragMove}
              onDragEnd={handleAnchor1DragEnd}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = "grab";
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = "";
              }}
            />
            <Circle
              x={x2Local}
              y={y2Local}
              radius={ANCHOR_RADIUS}
              fill="white"
              stroke={getSelectionStroke(color)}
              strokeWidth={SELECTION_STROKE_WIDTH}
              draggable
              onDragStart={handleAnchor2DragStart}
              onDragMove={handleAnchor2DragMove}
              onDragEnd={handleAnchor2DragEnd}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = "grab";
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = "";
              }}
            />
          </>
        )}
      </Group>
      {showControls && (
        <>
          <Group x={paletteX} y={paletteY} listening>
            <ColorPalette
              x={0}
              y={0}
              currentColor={color}
              onSelectColor={handleColorChange}
              onCustomColor={handleCustomColor}
            />
          </Group>
          <TrashButton
            x={Math.max(0, x2Local) + TRASH_CORNER_OFFSET - TRASH_SIZE}
            y={Math.min(0, y2Local) - TRASH_CORNER_OFFSET}
            size={TRASH_SIZE}
            image={trashImage}
            onDelete={handleDelete}
          />
        </>
      )}
    </Group>
  );
}
