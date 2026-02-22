/**
 * Create a flow diagram: stickies with connectors.
 * Supports linear chains (steps) and branching flows (nodes + edges).
 */

import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectRow } from "@/lib/board/sync";
import { objectToRow } from "@/lib/board/sync";
import { resolveColor } from "@/lib/ai/color-map";
import { measureStickyText } from "@/lib/sticky-measure";
import { DEFAULT_STICKY } from "@/components/canvas/constants";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";
import { createConnector } from "./createConnector";

const MAX_NODES = 25;
const SPACING = 48;

export type FlowNode = { id: string; text: string };
export type FlowEdge = { from: string; to: string };

export type FlowDiagramParams = {
  /** Linear flow: ordered steps. Use for simple sequences. */
  steps?: string[];
  /** Branching flow: nodes with unique ids. Use with edges for branches/merges. */
  nodes?: FlowNode[];
  /** Edges connect nodes. Use with nodes for branching. */
  edges?: FlowEdge[];
  direction?: "vertical" | "horizontal";
  color?: string;
  centerX?: number;
  centerY?: number;
};

/**
 * Layered layout: assign each node to a layer (depth from roots), then position within layers.
 */
function computeLayeredLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
  sizes: Map<string, { width: number; height: number }>,
  direction: "vertical" | "horizontal"
): Map<string, { x: number; y: number }> {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const outEdges = new Map<string, string[]>();
  const inEdges = new Map<string, string[]>();

  for (const e of edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    if (!outEdges.has(e.from)) outEdges.set(e.from, []);
    outEdges.get(e.from)!.push(e.to);
    if (!inEdges.has(e.to)) inEdges.set(e.to, []);
    inEdges.get(e.to)!.push(e.from);
  }

  const roots = nodes.filter((n) => !inEdges.get(n.id)?.length).map((n) => n.id);
  if (roots.length === 0) {
    roots.push(nodes[0]!.id);
  }

  const layerOf = new Map<string, number>();
  const queue: { id: string; layer: number }[] = roots.map((id) => ({ id, layer: 0 }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, layer } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const prevLayer = layerOf.get(id);
    layerOf.set(id, prevLayer != null ? Math.max(prevLayer, layer) : layer);

    for (const toId of outEdges.get(id) ?? []) {
      queue.push({ id: toId, layer: layer + 1 });
    }
  }

  for (const n of nodes) {
    if (!layerOf.has(n.id)) {
      layerOf.set(n.id, 0);
    }
  }

  const layers = new Map<number, string[]>();
  for (const [id, layer] of layerOf) {
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)!.push(id);
  }

  const sortedLayers = [...layers.entries()].sort((a, b) => a[0] - b[0]);
  const cellW = Math.max(...[...sizes.values()].map((s) => s.width), DEFAULT_STICKY.width);
  const cellH = Math.max(...[...sizes.values()].map((s) => s.height), DEFAULT_STICKY.height);

  const maxNodesInLayer = Math.max(...sortedLayers.map(([, ids]) => ids.length), 1);
  const maxLayerSpanW = maxNodesInLayer * cellW + (maxNodesInLayer - 1) * SPACING;
  const maxLayerSpanH = maxNodesInLayer * cellH + (maxNodesInLayer - 1) * SPACING;

  const totalW =
    direction === "vertical" ? maxLayerSpanW : sortedLayers.length * (cellW + SPACING);
  const totalH =
    direction === "vertical"
      ? sortedLayers.length * (cellH + SPACING)
      : maxLayerSpanH;

  const positions = new Map<string, { x: number; y: number }>();

  for (let layerIdx = 0; layerIdx < sortedLayers.length; layerIdx++) {
    const [, layerIds] = sortedLayers[layerIdx]!;
    const layerWidth = layerIds.length * cellW + (layerIds.length - 1) * SPACING;
    const layerHeight = layerIds.length * cellH + (layerIds.length - 1) * SPACING;
    const startX = (totalW - layerWidth) / 2;
    const startY = (totalH - layerHeight) / 2;

    layerIds.forEach((id, idx) => {
      if (direction === "vertical") {
        const x = startX + idx * (cellW + SPACING);
        const y = layerIdx * (cellH + SPACING);
        positions.set(id, { x: x - totalW / 2, y: y - totalH / 2 });
      } else {
        const x = layerIdx * (cellW + SPACING);
        const y = startY + idx * (cellH + SPACING);
        positions.set(id, { x: x - totalW / 2, y: y - totalH / 2 });
      }
    });
  }

  return positions;
}

export async function createFlowDiagram(
  ctx: ToolContext,
  params: FlowDiagramParams
): Promise<string> {
  const { boardId, supabase, broadcast, broadcastViewportCommand } = ctx;

  let nodes: FlowNode[];
  let edges: FlowEdge[];

  if (params.nodes?.length && params.edges?.length) {
    nodes = params.nodes.slice(0, MAX_NODES).filter((n) => n?.id && n?.text?.trim());
    edges = params.edges.filter((e) => e?.from && e?.to);
    if (nodes.length < 2) {
      return "Error: Branching flow needs at least 2 nodes.";
    }
  } else if (params.steps?.length) {
    const steps = params.steps.slice(0, MAX_NODES).filter((s) => s?.trim());
    if (steps.length < 2) {
      return "Error: Flow diagram needs at least 2 steps.";
    }
    nodes = steps.map((text, i) => ({ id: `n${i}`, text }));
    edges = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ from: nodes[i]!.id, to: nodes[i + 1]!.id });
    }
  } else {
    return "Error: Provide steps (linear) or nodes+edges (branching).";
  }

  const direction = params.direction ?? "vertical";
  const color = params.color ? resolveColor(params.color) : "#FDE68A";
  const centerX = params.centerX ?? 800;
  const centerY = params.centerY ?? 500;

  const sizes = new Map<string, { width: number; height: number }>();
  for (const n of nodes) {
    const m = measureStickyText(n.text || "");
    sizes.set(n.id, {
      width: Math.max(DEFAULT_STICKY.width, m.width),
      height: Math.max(DEFAULT_STICKY.height, m.height),
    });
  }

  const positions = computeLayeredLayout(nodes, edges, sizes, direction);

  const idToDbId = new Map<string, string>();

  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    const size = sizes.get(node.id)!;
    const id = crypto.randomUUID();

    const object: BoardObject = {
      id,
      type: "sticky",
      parentId: null,
      x: Math.round(centerX + pos.x),
      y: Math.round(centerY + pos.y),
      width: size.width,
      height: size.height,
      rotation: 0,
      color,
      text: node.text,
    };

    const dbRow = objectToRow(object, boardId);
    const { data: inserted, error } = await supabase
      .from("board_objects")
      .insert(dbRow)
      .select(
        "id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by"
      )
      .single();

    if (error) {
      return `Error creating node: ${error.message}`;
    }

    const withMeta = toObjectWithMeta(
      inserted as BoardObjectRow & { updated_at: string },
      boardId
    );
    ctx.objects[withMeta.id] = withMeta;
    broadcast({ op: "INSERT", object: withMeta });
    idToDbId.set(node.id, withMeta.id);
  }

  for (const e of edges) {
    const fromDbId = idToDbId.get(e.from);
    const toDbId = idToDbId.get(e.to);
    if (!fromDbId || !toDbId) continue;
    const result = await createConnector(ctx, {
      fromId: fromDbId,
      toId: toDbId,
      style: "right",
    });
    if (result.startsWith("Error:")) {
      return result;
    }
  }

  const createdIds = [...idToDbId.values()];
  if (broadcastViewportCommand && createdIds.length > 0) {
    broadcastViewportCommand({ action: "frameToObjects", objectIds: createdIds });
  }

  const edgeCount = edges.length;
  return `Created flow diagram with ${nodes.length} nodes and ${edgeCount} connector${edgeCount !== 1 ? "s" : ""}.`;
}
