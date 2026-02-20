import type { BoardObjectWithMeta } from "@/lib/board/store";

export type BroadcastPayload =
  | { op: "INSERT"; object: BoardObjectWithMeta }
  | { op: "UPDATE"; object: BoardObjectWithMeta }
  | { op: "DELETE"; id: string; updated_at: string };

export type ViewportCommandPayload =
  | { action: "pan"; deltaX: number; deltaY: number }
  | { action: "zoomBy"; factor: number }
  | { action: "frameToContent" };

export type FindResultPayload = { action: "selectAndZoom"; objectId: string };

export type ToolContext = {
  boardId: string;
  supabase: import("@supabase/supabase-js").SupabaseClient;
  broadcast: (payload: BroadcastPayload) => void;
  /** Broadcast viewport command for client to run smooth animation. Optional (not all callers provide it). */
  broadcastViewportCommand?: (payload: ViewportCommandPayload) => void;
  /** Broadcast find result for client to select and zoom. Optional. */
  broadcastFindResult?: (payload: FindResultPayload) => void;
  objects: Record<string, BoardObjectWithMeta>;
};
