import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { objectToRow } from "@/lib/board/sync";
import type { BoardObjectRow } from "@/lib/board/sync";
import type { ConnectorAnchor } from "@/lib/line/connector-types";
import type { ToolContext } from "./types";
import { toObjectWithMeta, fetchObject } from "./db";

const CONNECTOR_STYLE_CAPS: Record<string, { start: "arrow" | "point"; end: "arrow" | "point" }> = {
  both: { start: "arrow", end: "arrow" },
  left: { start: "arrow", end: "point" },
  right: { start: "point", end: "arrow" },
  none: { start: "point", end: "point" },
};

function anchorToward(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): ConnectorAnchor {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { type: "side", side: dx > 0 ? "right" : "left", offset: 0.5 };
  }
  return { type: "side", side: dy > 0 ? "bottom" : "top", offset: 0.5 };
}

export async function createConnector(
  ctx: ToolContext,
  params: { fromId: string; toId: string; style?: "both" | "left" | "right" | "none" }
): Promise<string> {
  const { boardId, supabase, broadcast, objects } = ctx;
  let from: BoardObjectWithMeta | null = objects[params.fromId] ?? null;
  let to: BoardObjectWithMeta | null = objects[params.toId] ?? null;
  if (!from) from = await fetchObject(supabase, boardId, params.fromId);
  if (!to) to = await fetchObject(supabase, boardId, params.toId);
  if (!from) return `Error: Source object ${params.fromId} not found`;
  if (!to) return `Error: Target object ${params.toId} not found`;
  if (from.type === "line") return `Error: Cannot attach connector from a line`;
  if (to.type === "line") return `Error: Cannot attach connector to a line`;

  const style = params.style ?? "right";
  const caps = CONNECTOR_STYLE_CAPS[style] ?? CONNECTOR_STYLE_CAPS.right;
  const startAnchor = anchorToward(from, to);
  const endAnchor = anchorToward(to, from);

  const id = crypto.randomUUID();
  const object: BoardObject = {
    id,
    type: "line",
    parentId: null,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    color: "#64748b",
    text: "",
    data: {
      start: { type: "attached", nodeId: params.fromId, anchor: startAnchor },
      end: { type: "attached", nodeId: params.toId, anchor: endAnchor },
      routingMode: "orthogonal",
      startCap: caps.start,
      endCap: caps.end,
      strokeWidth: 2,
    },
  };

  const row = objectToRow(object, boardId);
  let inserted: (BoardObjectRow & { updated_at: string }) | null = null;
  let err: { message: string } | null = null;
  try {
    const result = await supabase
      .from("board_objects")
      .insert(row)
      .select("id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by")
      .single();
    inserted = result.data as (BoardObjectRow & { updated_at: string }) | null;
    err = result.error;
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
  const error = err;

  if (error) return `Error: ${error.message}`;
  if (!inserted) return `Error: Insert returned no data`;

  const withMeta = toObjectWithMeta(inserted, boardId);
  broadcast({ op: "INSERT", object: withMeta });
  return `Created connector from ${params.fromId} to ${params.toId}`;
}
