import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectRow } from "@/lib/board/sync";
import { objectToRow } from "@/lib/board/sync";
import { DEFAULT_TEXT } from "@/components/canvas/constants";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";

export type TextBorderStyle = "none" | "solid";

export async function createText(
  ctx: ToolContext,
  params: {
    text: string;
    x: number;
    y: number;
    parentId?: string | null;
    /** Font size in px. Default from constants. */
    fontSize?: number;
    bold?: boolean;
    /** Background color. Default transparent for regular text. Use for labels. */
    color?: string;
    /** Border style. Default "none". Use "solid" for labels. */
    borderStyle?: TextBorderStyle;
    width?: number;
    height?: number;
  },
): Promise<string> {
  const { boardId, supabase, broadcast } = ctx;
  const id = crypto.randomUUID();
  const content = params.text.trim() || "Text";
  let html = content.includes("<") ? content : `<p>${content}</p>`;
  if (params.bold && !html.includes("<strong>")) {
    html = html.replace(/<p>([^<]*)<\/p>/, "<p><strong>$1</strong></p>");
  }
  if (params.fontSize != null) {
    html = html.replace(/<p(?:\s[^>]*)?>/, `<p style="font-size:${params.fontSize}px;margin:0">`);
  }
  const data: Record<string, unknown> = {};
  if (params.borderStyle && params.borderStyle !== "none") {
    data.borderStyle = params.borderStyle;
  }
  const object: BoardObject = {
    id,
    type: "text",
    parentId: params.parentId ?? null,
    x: params.x,
    y: params.y,
    width: params.width ?? DEFAULT_TEXT.width,
    height: params.height ?? DEFAULT_TEXT.height,
    rotation: 0,
    color: params.color ?? "#94a3b8",
    text: html,
    data: Object.keys(data).length > 0 ? data : undefined,
  };

  const row = objectToRow(object, boardId);
  const { data: inserted, error } = await supabase
    .from("board_objects")
    .insert(row)
    .select(
      "id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by",
    )
    .single();

  if (error) return `Error: ${error.message}`;
  const withMeta = toObjectWithMeta(
    inserted as BoardObjectRow & { updated_at: string },
    boardId,
  );
  ctx.objects[withMeta.id] = withMeta;
  broadcast({ op: "INSERT", object: withMeta });
  return `Created text "${content}" at (${params.x}, ${params.y}). Id: ${withMeta.id}`;
}
