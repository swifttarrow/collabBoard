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
  onHandleMouseDown: (anchor: AnchorKind, e: Konva.KonvaEventObject<MouseEvent>) => void;
};

const ANCHOR_ORDER: AnchorKind[] = [
  "top-mid",
  "top",
  "right",
  "right-mid",
  "bottom",
  "bottom-mid",
  "left",
  "left-mid",
];

export function LineHandles({ shape, onHandleMouseDown }: LineHandlesProps) {
  const anchors = getShapeAnchors(shape);
  const ordered = ANCHOR_ORDER.map((a) => anchors.find((x) => x.anchor === a)).filter(
    (x): x is NonNullable<typeof x> => !!x
  );

  return (
    <Group x={0} y={0} listening>
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
