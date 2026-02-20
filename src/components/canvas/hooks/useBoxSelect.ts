"use client";

import { useRef, useState, useCallback } from "react";
import type Konva from "konva";
import type { BoardObject } from "@/lib/board/types";
import { getAbsolutePosition } from "@/lib/board/scene-graph";
import { getLineGeometry } from "@/lib/line/geometry";

export type BoxSelectBounds = { x: number; y: number; width: number; height: number };

function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

function getObjectBounds(
  obj: BoardObject & { parentId?: string | null },
  objects: Record<string, BoardObject & { parentId?: string | null }>
): { x: number; y: number; width: number; height: number } {
  const abs = getAbsolutePosition(obj.id, objects);
  if (obj.type === "line") {
    const geom = getLineGeometry(
      obj as BoardObject & { type: "line"; data?: Record<string, unknown>; parentId?: string | null },
      objects
    );
    const allX = geom.points.map((p) => p.x);
    const allY = geom.points.map((p) => p.y);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);
    return {
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1),
    };
  }
  return { x: abs.x, y: abs.y, width: obj.width, height: obj.height };
}

type UseBoxSelectParams = {
  getWorldPoint: (stage: Konva.Stage, pointer: { x: number; y: number }) => { x: number; y: number };
  objects: Record<string, BoardObject>;
  setSelection: (ids: string[] | string | null) => void;
  selection: string[];
};

export function useBoxSelect({
  getWorldPoint,
  objects,
  setSelection,
  selection,
}: UseBoxSelectParams) {
  const [draftBox, setDraftBox] = useState<BoxSelectBounds | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const addToSelectionRef = useRef(false);
  const boxRef = useRef<BoxSelectBounds | null>(null);

  const start = useCallback(
    (stage: Konva.Stage, shiftKey: boolean) => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const worldPoint = getWorldPoint(stage, pointer);
      startRef.current = worldPoint;
      addToSelectionRef.current = shiftKey;
      const box = { x: worldPoint.x, y: worldPoint.y, width: 0, height: 0 };
      boxRef.current = box;
      setDraftBox(box);
    },
    [getWorldPoint]
  );

  const move = useCallback(
    (stage: Konva.Stage) => {
      const pointer = stage.getPointerPosition();
      const startPos = startRef.current;
      if (!pointer || !startPos) return;
      const worldPoint = getWorldPoint(stage, pointer);
      const x = Math.min(startPos.x, worldPoint.x);
      const y = Math.min(startPos.y, worldPoint.y);
      const width = Math.abs(worldPoint.x - startPos.x);
      const height = Math.abs(worldPoint.y - startPos.y);
      const box = { x, y, width, height };
      boxRef.current = box;
      setDraftBox(box);
    },
    [getWorldPoint]
  );

  const finish = useCallback(() => {
    const box = boxRef.current;
    const addToSelection = addToSelectionRef.current;
    startRef.current = null;
    boxRef.current = null;
    setDraftBox(null);

    if (!box || (box.width < 4 && box.height < 4)) return;

    const ids: string[] = [];
    for (const obj of Object.values(objects)) {
      const bounds = getObjectBounds(obj, objects);
      if (rectsIntersect(box, bounds)) {
        ids.push(obj.id);
      }
    }

    if (addToSelection && ids.length > 0) {
      setSelection([...new Set([...selection, ...ids])]);
    } else if (ids.length > 0) {
      setSelection(ids);
    }
  }, [objects, setSelection, selection]);

  const cancel = useCallback(() => {
    startRef.current = null;
    setDraftBox(null);
  }, []);

  return {
    draftBox,
    isSelecting: draftBox !== null,
    start,
    move,
    finish,
    cancel,
  };
}
