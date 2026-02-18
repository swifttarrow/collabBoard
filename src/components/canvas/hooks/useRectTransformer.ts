import { useEffect } from "react";
import type Konva from "konva";
import type { BoardObject } from "@/lib/board/types";

type UseShapeTransformerParams = {
  selection: string | null;
  objects: Record<string, BoardObject>;
  selectedRectRef: React.MutableRefObject<Konva.Rect | null>;
  selectedCircleRef: React.MutableRefObject<Konva.Rect | null>;
  transformerRef: React.MutableRefObject<Konva.Transformer | null>;
};

export function useShapeTransformer({
  selection,
  objects,
  selectedRectRef,
  selectedCircleRef,
  transformerRef,
}: UseShapeTransformerParams) {
  useEffect(() => {
    if (!transformerRef.current) return;
    if (selection && objects[selection]) {
      const obj = objects[selection];
      if (obj.type === "rect" && selectedRectRef.current) {
        transformerRef.current.nodes([selectedRectRef.current]);
      } else if (obj.type === "circle" && selectedCircleRef.current) {
        transformerRef.current.nodes([selectedCircleRef.current]);
      } else {
        transformerRef.current.nodes([]);
      }
    } else {
      transformerRef.current.nodes([]);
    }
    transformerRef.current.getLayer()?.batchDraw();
  }, [selection, objects, selectedRectRef, selectedCircleRef, transformerRef]);
}
