import { useEffect } from "react";
import type Konva from "konva";
import type { BoardObject } from "@/lib/board/types";

type UseRectTransformerParams = {
  selection: string | null;
  objects: Record<string, BoardObject>;
  selectedRectRef: React.MutableRefObject<Konva.Rect | null>;
  transformerRef: React.MutableRefObject<Konva.Transformer | null>;
};

export function useRectTransformer({
  selection,
  objects,
  selectedRectRef,
  transformerRef,
}: UseRectTransformerParams) {
  useEffect(() => {
    if (!transformerRef.current) return;
    if (selection && objects[selection]?.type === "rect" && selectedRectRef.current) {
      transformerRef.current.nodes([selectedRectRef.current]);
    } else {
      transformerRef.current.nodes([]);
    }
    transformerRef.current.getLayer()?.batchDraw();
  }, [selection, objects, selectedRectRef, transformerRef]);
}
