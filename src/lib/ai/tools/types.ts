import type { BoardObjectWithMeta } from "@/lib/board/store";

export type BroadcastPayload =
  | { op: "INSERT"; object: BoardObjectWithMeta }
  | { op: "UPDATE"; object: BoardObjectWithMeta }
  | { op: "DELETE"; id: string; updated_at: string };

export type ToolContext = {
  boardId: string;
  supabase: import("@supabase/supabase-js").SupabaseClient;
  broadcast: (payload: BroadcastPayload) => void;
  objects: Record<string, BoardObjectWithMeta>;
};
