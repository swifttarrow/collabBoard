"use client";

import type Konva from "konva";
import { Group, Circle } from "react-konva";
import type { BoardObject } from "@/lib/board/types";
import type { AnchorKind } from "@/lib/line/types";
import { getShapeAnchors } from "@/lib/line/geometry";

const HANDLE_RADIUS = 5;
const HANDLE_HIT_RADIUS = 24;
const HANDLE_FILL = "rgba(59, 130, 246, 0.9)";
const HANDLE_STROKE = "#3b82f6";

type LineHandlesProps = {
  shape: BoardObject;
  objects: Record<string, BoardObject>;
  onHandleMouseDown: (anchor: AnchorKind, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onHandleMouseEnter?: () => void;
  onHandleMouseLeave?: () => void;
};

const RECT_ANCHOR_ORDER: AnchorKind[] = [
  "top-mid",
  "top",
  "right",
  "right-mid",
  "bottom",
  "bottom-mid",
  "left",
  "left-mid",
];

const LINE_ANCHOR_ORDER: AnchorKind[] = ["line-start", "line-end"];

export function LineHandles({
  shape,
  objects,
  onHandleMouseDown,
  onHandleMouseEnter,
  onHandleMouseLeave,
}: LineHandlesProps) {
  const anchors = getShapeAnchors(shape, objects as Record<string, BoardObject & { parentId?: string | null }>);
  const order =
    shape.type === "line" ? LINE_ANCHOR_ORDER : RECT_ANCHOR_ORDER;
  const ordered = order.map((a) => anchors.find((x) => x.anchor === a)).filter(
    (x): x is NonNullable<typeof x> => !!x
  );

  return (
    <Group
      x={0}
      y={0}
      listening
      onMouseEnter={() => onHandleMouseEnter?.()}
      onMouseLeave={() => onHandleMouseLeave?.()}
    >
      {ordered.map(({ anchor, x, y }) => (
        <Group key={anchor} x={x} y={y} listening>
          <Circle
            radius={HANDLE_HIT_RADIUS}
            fill="transparent"
            listening
            onMouseDown={(e: Konva.KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              onHandleMouseDown(anchor, e);
            }}
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = "crosshair";
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = "";
            }}
          />
          <Circle
            x={0}
            y={0}
            radius={HANDLE_RADIUS}
            fill={HANDLE_FILL}
            stroke={HANDLE_STROKE}
            strokeWidth={1.5}
            listening={false}
          />
        </Group>
      ))}
    </Group>
  );
}
