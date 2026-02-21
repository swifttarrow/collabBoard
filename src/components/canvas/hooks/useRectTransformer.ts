import { useEffect } from "react";
import type Konva from "konva";
import type { BoardObject } from "@/lib/board/types";

type UseShapeTransformerParams = {
  selection: string[];
  objects: Record<string, BoardObject>;
  nodeRefsMap: React.MutableRefObject<Map<string, Konva.Node>>;
  transformerRef: React.MutableRefObject<Konva.Transformer | null>;
  /** When true, hide the transformer (e.g. while dragging connector endpoint). */
  hideWhen?: boolean;
};

export function useShapeTransformer({
  selection,
  objects,
  nodeRefsMap,
  transformerRef,
  hideWhen = false,
}: UseShapeTransformerParams) {
  useEffect(() => {
    if (!transformerRef.current) return;
    const nodes: Konva.Node[] = [];
    if (!hideWhen) {
      for (const id of selection) {
        const node = nodeRefsMap.current.get(id);
        if (node) nodes.push(node);
      }
    }
    transformerRef.current.nodes(nodes);
    transformerRef.current.forceUpdate();
    transformerRef.current.getLayer()?.batchDraw();
  }, [selection, objects, nodeRefsMap, transformerRef, hideWhen]);
}
