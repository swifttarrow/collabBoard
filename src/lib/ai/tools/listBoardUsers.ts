import type { ToolContext } from "./types";

/**
 * Get display names of users currently on the board (from presence).
 * Use when follow fails or user asks "who's here", "who else is in this room", etc.
 */
export async function listBoardUsers(
  ctx: ToolContext & { currentUserId: string },
): Promise<string> {
  const { boardId, supabase, currentUserId } = ctx;

  const channel = supabase.channel(`board_presence:${boardId}`, {
    config: { presence: { key: `ai-${Date.now()}` } },
  });

  const statePromise = new Promise<Record<string, Array<{ userId?: string; name?: string }>>>(
    (resolve) => {
      channel.on("presence", { event: "sync" }, () => {
        resolve(channel.presenceState<{ userId?: string; name?: string }>());
      });
    },
  );

  await channel.subscribe();
  // Wait for sync event (up to 1.5s) so we get presence from all connected clients
  const state = await Promise.race([
    statePromise,
    new Promise<Record<string, Array<{ userId?: string; name?: string }>>>((resolve) =>
      setTimeout(
        () => resolve(channel.presenceState<{ userId?: string; name?: string }>()),
        1500,
      ),
    ),
  ]);
  supabase.removeChannel(channel);

  const users: Array<{ userId: string; name: string }> = [];
  for (const key of Object.keys(state)) {
    for (const p of state[key] ?? []) {
      const uid = p.userId ?? key;
      const name = (p.name ?? "").trim();
      if (uid && name && uid !== currentUserId) {
        users.push({ userId: uid, name });
      }
    }
  }

  if (users.length === 0) {
    return "No other users are on the board right now.";
  }

  const names = users.map((u) => u.name).join(", ");
  return `Users on the board: ${names}. You can follow any of them by name (e.g. "follow ${users[0]?.name ?? "Jane"}").`;
}
