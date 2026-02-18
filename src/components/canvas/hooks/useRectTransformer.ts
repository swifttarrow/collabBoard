import { useEffect } from "react";
import type Konva from "konva";
import type { BoardObject } from "@/lib/board/types";

type UseShapeTransformerParams = {
  selection: string[];
  objects: Record<string, BoardObject>;
  shapeRefsMap: React.MutableRefObject<Map<string, Konva.Rect>>;
  transformerRef: React.MutableRefObject<Konva.Transformer | null>;
};

export function useShapeTransformer({
  selection,
  objects,
  shapeRefsMap,
  transformerRef,
}: UseShapeTransformerParams) {
  useEffect(() => {
    if (!transformerRef.current) return;
    const nodes: Konva.Rect[] = [];
    for (const id of selection) {
      const obj = objects[id];
      if (!obj) continue;
      if (obj.type === "rect" || obj.type === "circle") {
        const node = shapeRefsMap.current.get(id);
        if (node) nodes.push(node);
      }
    }
    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selection, objects, shapeRefsMap, transformerRef]);
}
