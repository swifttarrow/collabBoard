import type { BoardObjectRow } from "@/lib/board/sync";
import { resolveColor } from "@/lib/ai/color-map";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";
import { getBoardState } from "./getBoardState";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function changeColor(
  ctx: ToolContext,
  params: {
    objectId?: string;
    color: string;
    findFirst?: { type?: "sticky" | "text" | "frame" | "rect" | "circle"; textContains?: string };
  }
): Promise<string> {
  const { boardId, supabase, broadcast, objects } = ctx;

  let objectId = params.objectId;
  if (!objectId && params.findFirst) {
    await getBoardState(ctx);
    const all = Object.values(ctx.objects);
    let candidates = all.filter((o) => o.type !== "line");
    if (params.findFirst.type) {
      candidates = candidates.filter((o) => o.type === params.findFirst!.type);
    }
    if (params.findFirst.textContains?.trim()) {
      const q = params.findFirst.textContains.trim().toLowerCase();
      candidates = candidates.filter((o) => {
        const t = stripHtml((o as { text?: string }).text ?? "").toLowerCase();
        return t.includes(q);
      });
    }
    if (candidates.length === 0) {
      const hint = params.findFirst.type ? ` No ${params.findFirst.type} found.` : "";
      return `Error: No matching object found.${hint}`;
    }
    objectId = candidates[0]!.id;
  }

  if (!objectId) return `Error: Provide objectId or findFirst to identify the object.`;

  const obj = objects[objectId];
  if (!obj) return `Error: Object ${objectId} not found`;

  const color = resolveColor(params.color);

  const { data: updated, error } = await supabase
    .from("board_objects")
    .update({ color })
    .eq("id", objectId)
    .eq("board_id", boardId)
    .select("id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by")
    .single();

  if (error) return `Error: ${error.message}`;
  const withMeta = toObjectWithMeta(
    updated as BoardObjectRow & { updated_at: string },
    boardId
  );
  broadcast({ op: "UPDATE", object: withMeta });
  return `Changed color to ${color}`;
}
