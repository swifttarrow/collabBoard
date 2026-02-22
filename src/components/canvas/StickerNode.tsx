"use client";

import { useCallback, useEffect, useState } from "react";
import type Konva from "konva";
import { Group, Rect, Image as KonvaImage } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import {
  TRASH_CORNER_OFFSET,
  SELECTION_STROKE_WIDTH,
  CONNECTOR_TARGET_STROKE,
  CONNECTOR_TARGET_STROKE_WIDTH,
} from "./constants";
import { getSelectionStroke } from "@/lib/color-utils";

const UNDRAW_CDN = "https://cdn.jsdelivr.net/npm/undraw-svg@1.0.0/svgs";

type StickerObject = BoardObject & {
  type: "sticker";
  data?: { slug?: string };
};

type StickerNodeProps = {
  object: StickerObject;
  isSelected: boolean;
  showControls: boolean;
  isConnectionTarget?: boolean;
  draggable?: boolean;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onHover: (id: string | null) => void;
  onContextMenu: (
    id: string,
    objectType: "sticker",
    e: Konva.KonvaEventObject<PointerEvent>
  ) => void;
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  registerNodeRef?: (id: string, node: Konva.Node | null) => void;
};

function useStickerImage(slug: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const url = slug ? `${UNDRAW_CDN}/${slug}.svg` : null;

  useEffect(() => {
    if (!url) {
      queueMicrotask(() => setImage(null));
      return;
    }
    queueMicrotask(() => setImage(null));
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = url;
    return () => {
      img.onload = null;
      img.onerror = null;
      img.src = "";
    };
  }, [url]);

  return image;
}

export function StickerNode({
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
  registerNodeRef,
}: StickerNodeProps) {
  const slug = object.data?.slug as string | undefined;
  const stickerImage = useStickerImage(slug);

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
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
      e.cancelBubble = true;
      const target = e.target;
      if (target?.name()) {
        onDragEnd(target.name(), target.x(), target.y());
      }
    },
    [onDragEnd]
  );
  const handleContextMenu = useCallback(
    (evt: Konva.KonvaEventObject<PointerEvent>) => {
      evt.evt.preventDefault();
      onContextMenu(object.id, "sticker", evt);
    },
    [object.id, onContextMenu]
  );

  if (!slug) return null;

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
        ref={(node) => registerNodeRef?.(object.id, isSelected ? node : null)}
      >
        {stickerImage ? (
          <KonvaImage
            image={stickerImage}
            width={object.width}
            height={object.height}
            stroke={
              isConnectionTarget ? CONNECTOR_TARGET_STROKE : isSelected ? getSelectionStroke("#94a3b8") : undefined
            }
            strokeWidth={
              isConnectionTarget ? CONNECTOR_TARGET_STROKE_WIDTH : isSelected ? SELECTION_STROKE_WIDTH : 0
            }
          />
        ) : (
          <Rect
            width={object.width}
            height={object.height}
            fill="#e2e8f0"
            stroke={
              isConnectionTarget ? CONNECTOR_TARGET_STROKE : isSelected ? getSelectionStroke("#94a3b8") : undefined
            }
            strokeWidth={
              isConnectionTarget ? CONNECTOR_TARGET_STROKE_WIDTH : isSelected ? SELECTION_STROKE_WIDTH : 0
            }
            cornerRadius={4}
          />
        )}
      </Group>
    </Group>
  );
}
