import { useState, useCallback } from "react";
import type Konva from "konva";
import type { BoardObject } from "@/lib/board/types";
import type { AnchorKind } from "@/lib/line/types";
import { getAnchorPoint } from "@/lib/line/geometry";

type Point = { x: number; y: number };

type UseLineCreationParams = {
  getWorldPoint: (stage: Konva.Stage, pointer: Point) => Point;
  objects: Record<string, BoardObject>;
  createLine: (opts: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }) => void;
  onFinish: () => void;
};

export function useLineCreation({
  getWorldPoint,
  objects,
  createLine,
  onFinish,
}: UseLineCreationParams) {
  const [draft, setDraft] = useState<{
    fromShapeId: string;
    fromAnchor: AnchorKind;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  const start = useCallback(
    (fromShapeId: string, fromAnchor: AnchorKind, stage: Konva.Stage) => {
      const shape = objects[fromShapeId];
      if (!shape) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const worldPoint = getWorldPoint(stage, pointer);
      const { x: startX, y: startY } = getAnchorPoint(shape, fromAnchor);
      setDraft({
        fromShapeId,
        fromAnchor,
        startX,
        startY,
        endX: worldPoint.x,
        endY: worldPoint.y,
      });
    },
    [objects, getWorldPoint]
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
    if (len >= minLen) {
      createLine({
        startX: draft.startX,
        startY: draft.startY,
        endX: draft.endX,
        endY: draft.endY,
      });
    }
    setDraft(null);
    onFinish();
  }, [draft, createLine, onFinish]);

  const cancel = useCallback(() => {
    setDraft(null);
    onFinish();
  }, [onFinish]);

  return {
    isCreating: !!draft,
    draft,
    start,
    move,
    finish,
    cancel,
  };
}
