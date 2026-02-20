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
 * - 1 match: select, center, zoom in; return success message
 * - Multiple: return clarification prompt (natural language, no JSON)
 * - None: return "No matches found"
 */
export async function findObjects(
  ctx: ToolContext,
  params: { query: string }
): Promise<string> {
  await getBoardState(ctx);

  const query = params.query.trim().toLowerCase();
  if (!query) {
    return "Please provide a search term.";
  }

  const objects = Object.values(ctx.objects);
  const searchable = objects.filter(
    (o) =>
      (o.type === "sticky" || o.type === "text" || o.type === "frame") &&
      getSearchableText(o).toLowerCase().includes(query)
  );

  if (searchable.length === 0) {
    return `No matches found for "${params.query.trim()}".`;
  }

  if (searchable.length === 1) {
    const obj = searchable[0]!;
    const broadcast = ctx.broadcastFindResult;
    if (broadcast) {
      broadcast({ action: "selectAndZoom", objectId: obj.id });
    }
    const preview = getSearchableText(obj).slice(0, 60);
    const truncated = preview.length < getSearchableText(obj).length ? "…" : "";
    return `Found it. Selected "${preview}${truncated}" and zoomed in.`;
  }

  const lines = searchable.map(
    (o, i) =>
      `${i + 1}. ${getSearchableText(o).slice(0, 80)}${getSearchableText(o).length > 80 ? "…" : ""}`
  );
  return `I found ${searchable.length} matches. Which one did you mean?\n${lines.join("\n")}\n\nReply with the number (1–${searchable.length}) or describe it more specifically.`;
}
