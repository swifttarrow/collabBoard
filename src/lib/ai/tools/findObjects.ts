import type { ToolContext } from "./types";
import { getBoardState } from "./getBoardState";
import type { BoardObjectWithMeta } from "@/lib/board/store";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getSearchableText(obj: BoardObjectWithMeta): string {
  const raw = (obj as { text?: string }).text ?? "";
  return stripHtml(raw);
}

/**
 * Find objects on the board by text search.
 * - 0 matches: return "No matches found"
 * - 1 match: broadcast selectAndZoom, return success
 * - 2+ matches: return top N with findResults for chat links; support pagination via offset
 */
export async function findObjects(
  ctx: ToolContext,
  params: { query: string; offset?: number; limit?: number }
): Promise<string> {
  await getBoardState(ctx);

  const query = params.query.trim().toLowerCase();
  if (!query) {
    return "Please provide a search term.";
  }

  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.min(10, Math.max(1, params.limit ?? 3));

  const objects = Object.values(ctx.objects);
  const searchable = objects
    .filter(
      (o) =>
        (o.type === "sticky" || o.type === "text" || o.type === "frame") &&
        getSearchableText(o).toLowerCase().includes(query)
    )
    .map((o) => ({
      obj: o,
      preview: getSearchableText(o).slice(0, 80),
    }));

  const totalCount = searchable.length;

  if (totalCount === 0) {
    return `No matches found for "${params.query.trim()}".`;
  }

  if (totalCount === 1) {
    const { obj } = searchable[0]!;
    const broadcast = ctx.broadcastFindResult;
    if (broadcast) {
      broadcast({ action: "selectAndZoom", objectId: obj.id });
    }
    const preview = getSearchableText(obj).slice(0, 60);
    const truncated = preview.length < getSearchableText(obj).length ? "…" : "";
    return `Found it. Selected "${preview}${truncated}" and zoomed in.`;
  }

  const sliced = searchable.slice(offset, offset + limit);
  const matches = sliced.map(({ obj, preview }) => ({
    id: obj.id,
    preview: preview + (getSearchableText(obj).length > 80 ? "…" : ""),
  }));

  const hasMore = offset + limit < totalCount;
  const moreHint = hasMore
    ? ` Say "show more" or "next 3" to see more matches.`
    : "";

  ctx.setResponseMeta?.({ findResults: { matches, totalCount, offset, limit } });

  return `Found ${totalCount} matches. Showing ${offset + 1}–${Math.min(offset + limit, totalCount)}:${moreHint}`;
}
