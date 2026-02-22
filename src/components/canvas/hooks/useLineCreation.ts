import { useState, useCallback } from "react";
import type Konva from "konva";
import type { BoardObject } from "@/lib/board/types";
import type { AnchorKind } from "@/lib/line/types";
import { getAbsoluteAnchorPoint, findNearestNodeAndAnchor } from "@/lib/line/geometry";
import { CONNECTOR_SNAP_RADIUS } from "@/components/canvas/constants";

type Point = { x: number; y: number };

export type ConnectorCreateOpts = {
  start: { type: "attached"; nodeId: string; anchor: AnchorKind } | { type: "free"; x: number; y: number };
  end: { type: "attached"; nodeId: string; anchor: AnchorKind } | { type: "free"; x: number; y: number };
};

type UseLineCreationParams = {
  getWorldPoint: (stage: Konva.Stage, pointer: Point) => Point;
  objects: Record<string, BoardObject>;
  createLine: (opts: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }) => void;
  createConnector?: (opts: ConnectorCreateOpts) => void;
  onFinish: () => void;
  onConnectorError?: (message: string) => void;
};

export function useLineCreation({
  getWorldPoint,
  objects,
  createLine,
  createConnector,
  onFinish,
  onConnectorError,
}: UseLineCreationParams) {
  const [draft, setDraft] = useState<
    | {
        fromShapeId: string;
        fromAnchor: AnchorKind;
        startX: number;
        startY: number;
        endX: number;
        endY: number;
      }
    | {
        startFree: true;
        startX: number;
        startY: number;
        endX: number;
        endY: number;
      }
  | null>(null);

  /** Start connector from a shape handle (attached start). */
  const start = useCallback(
    (fromShapeId: string, fromAnchor: AnchorKind, stage: Konva.Stage) => {
      const shape = objects[fromShapeId];
      if (!shape) return;
      const pt = getAbsoluteAnchorPoint(fromShapeId, fromAnchor, objects);
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const worldPoint = getWorldPoint(stage, pointer);
      setDraft({
        fromShapeId,
        fromAnchor,
        startX: pt.x,
        startY: pt.y,
        endX: worldPoint.x,
        endY: worldPoint.y,
      });
    },
    [objects, getWorldPoint]
  );

  /** Start connector from empty space (free start). End must attach to a shape. */
  const startFromPoint = useCallback(
    (stage: Konva.Stage) => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const worldPoint = getWorldPoint(stage, pointer);
      setDraft({
        startFree: true,
        startX: worldPoint.x,
        startY: worldPoint.y,
        endX: worldPoint.x,
        endY: worldPoint.y,
      });
    },
    [getWorldPoint]
  );

  const move = useCallback(
    (stage: Konva.Stage) => {
      if (!draft) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const worldPoint = getWorldPoint(stage, pointer);
      setDraft((prev) =>
        prev ? { ...prev, endX: worldPoint.x, endY: worldPoint.y } : null
      );
    },
    [draft, getWorldPoint]
  );

  const finish = useCallback(() => {
    if (!draft) return;
    const minLen = 12;
    const len = Math.hypot(draft.endX - draft.startX, draft.endY - draft.startY);
    if (len < minLen) {
      setDraft(null);
      onFinish();
      return;
    }

    const endPoint = { x: draft.endX, y: draft.endY };
    const excludeId = "fromShapeId" in draft ? draft.fromShapeId : undefined;
    const snapEnd = findNearestNodeAndAnchor(
      endPoint,
      objects,
      excludeId,
      CONNECTOR_SNAP_RADIUS
    );

    if (createConnector) {
      const isFreeStart = "startFree" in draft && draft.startFree;

      if (isFreeStart) {
        // Free start: end MUST be attached
        if (!snapEnd) {
          onConnectorError?.(
            "Connector must connect to a shape. Drag the endpoint onto a shape to attach it."
          );
          setDraft(null);
          onFinish();
          return;
        }
        createConnector({
          start: { type: "free", x: draft.startX, y: draft.startY },
          end: {
            type: "attached",
            nodeId: snapEnd.nodeId,
            anchor: snapEnd.anchor,
          },
        });
      } else {
        // Attached start
        const startShapeExists = !!objects[(draft as { fromShapeId: string }).fromShapeId];
        if (!startShapeExists) {
          onConnectorError?.(
            "Connector could not be created: the starting shape was removed."
          );
          setDraft(null);
          onFinish();
          return;
        }
        const startAttached = {
          type: "attached" as const,
          nodeId: (draft as { fromShapeId: string }).fromShapeId,
          anchor: (draft as { fromAnchor: AnchorKind }).fromAnchor,
        };
        const endAttached = snapEnd
          ? {
              type: "attached" as const,
              nodeId: snapEnd.nodeId,
              anchor: snapEnd.anchor,
            }
          : { type: "free" as const, x: draft.endX, y: draft.endY };
        createConnector({
          start: startAttached,
          end: endAttached,
        });
      }
    } else {
      createLine({
        startX: draft.startX,
        startY: draft.startY,
        endX: draft.endX,
        endY: draft.endY,
      });
    }
    setDraft(null);
    onFinish();
  }, [draft, createLine, createConnector, objects, onFinish, onConnectorError]);

  const cancel = useCallback(() => {
    setDraft(null);
    onFinish();
  }, [onFinish]);

  return {
    isCreating: !!draft,
    draft,
    start,
    startFromPoint,
    move,
    finish,
    cancel,
  };
}
