import type { BoardObject } from "@/lib/board/types";
import type { BoardObjectRow } from "@/lib/board/sync";
import { objectToRow } from "@/lib/board/sync";
import type { ToolContext } from "./types";
import { toObjectWithMeta } from "./db";
import { getAbsolutePosition } from "@/lib/board/scene-graph";
import type { BoardObjectWithMeta } from "@/lib/board/store";
import { DEFAULT_STICKER } from "@/components/canvas/constants";

const STICKER_GAP = 24;
const STICKER_COLS = 4;
const DEFAULT_START = 80;
const PLACEMENT_MARGIN = 80;

function suggestPlacement(objects: Record<string, BoardObjectWithMeta>): {
  startX: number;
  startY: number;
} {
  const entries = Object.values(objects);
  if (entries.length === 0) return { startX: DEFAULT_START, startY: DEFAULT_START };

  let maxBottom = 0;
  let minLeft = Infinity;
  for (const obj of entries as BoardObjectWithMeta[]) {
    const abs = getAbsolutePosition(obj.id, objects);
    if (obj.type === "line") continue;
    if (obj.width != null && obj.height != null) {
      maxBottom = Math.max(maxBottom, abs.y + obj.height);
      minLeft = Math.min(minLeft, abs.x);
    }
  }
  const startY = maxBottom + PLACEMENT_MARGIN;
  const startX = minLeft !== Infinity ? minLeft : DEFAULT_START;
  return { startX, startY };
}

/**
 * Normalize slug: lowercase, trim, ensure kebab-case (spaces to hyphens).
 */
function normalizeSlug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function createStickers(
  ctx: ToolContext,
  params: {
    stickers: Array<{ slug: string }>;
    startX?: number;
    startY?: number;
  },
): Promise<string> {
  const stickers = Array.isArray(params.stickers)
    ? params.stickers
        .filter((s) => s != null && typeof (s as { slug?: unknown }).slug === "string")
        .map((s) => ({ slug: normalizeSlug((s as { slug: string }).slug) }))
        .filter((s) => s.slug.length > 0)
    : [];

  if (stickers.length === 0) {
    return "No stickers to create. Provide stickers with slug (e.g. teamwork, programming, love-messages).";
  }

  const { startX, startY } = suggestPlacement(ctx.objects);

  const { boardId, supabase, broadcast } = ctx;
  const created: string[] = [];

  for (let i = 0; i < stickers.length; i++) {
    const col = i % STICKER_COLS;
    const row = Math.floor(i / STICKER_COLS);
    const x = startX + col * (DEFAULT_STICKER.width + STICKER_GAP);
    const y = startY + row * (DEFAULT_STICKER.height + STICKER_GAP);

    const id = crypto.randomUUID();
    const object: BoardObject = {
      id,
      type: "sticker",
      parentId: null,
      x,
      y,
      width: DEFAULT_STICKER.width,
      height: DEFAULT_STICKER.height,
      rotation: 0,
      color: "",
      text: "",
      data: { slug: stickers[i]!.slug },
    };

    const rowData = objectToRow(object, boardId);
    const { data: inserted, error } = await supabase
      .from("board_objects")
      .insert(rowData)
      .select(
        "id, board_id, type, data, parent_id, x, y, width, height, rotation, color, text, clip_content, updated_at, updated_by",
      )
      .single();

    if (error) {
      console.error("[createStickers] insert error:", { slug: stickers[i]!.slug, error });
      return `Error creating sticker "${stickers[i]!.slug}": ${error.message}`;
    }

    const withMeta = toObjectWithMeta(
      inserted as BoardObjectRow & { updated_at: string },
      boardId,
    );
    ctx.objects[withMeta.id] = withMeta;
    broadcast({ op: "INSERT", object: withMeta });
    created.push(withMeta.id);
  }

  return `Created ${created.length} sticker(s) at (${startX}, ${startY}). Slugs: ${stickers.map((s) => s.slug).join(", ")}`;
}
