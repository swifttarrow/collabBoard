import type { ToolContext } from "./types";
import { FOLLOW_EVENT } from "@/components/canvas/BoardPresenceProvider";

type FollowUserParams = {
  /** Display name to match (e.g. "Jane", "Jane Doe") or userId */
  displayNameOrId: string;
};

export type FollowUserResult =
  | { success: true; displayName: string }
  | { success: false; error: string };

/** Resolve display name or id to a board member userId. Returns null if not found. */
async function resolveToUserId(
  ctx: ToolContext,
  currentUserId: string,
  displayNameOrId: string
): Promise<{ userId: string; displayName: string } | null> {
  const { boardId, supabase } = ctx;
  const input = displayNameOrId.trim();
  if (!input) return null;

  const { data: board } = await supabase
    .from("boards")
    .select("owner_id")
    .eq("id", boardId)
    .single();

  if (!board) return null;

  const ownerId = board.owner_id;
  const { data: members } = await supabase
    .from("board_members")
    .select("user_id")
    .eq("board_id", boardId);

  const userIds = new Set<string>([ownerId]);
  for (const m of members ?? []) {
    userIds.add(m.user_id);
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", Array.from(userIds));

  const normalizedInput = input.toLowerCase();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const matchingId = Array.from(userIds).find(
    (id) => id.toLowerCase() === input.toLowerCase()
  );
  if (uuidRegex.test(input) && matchingId) {
    const profile = profiles?.find((pr) => pr.id === matchingId);
    const displayName =
      profile?.first_name || profile?.last_name
        ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
        : "Unknown";
    return { userId: matchingId, displayName };
  }

  for (const p of profiles ?? []) {
    if (p.id === currentUserId) continue;
    if (!userIds.has(p.id)) continue;
    const fullName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    const firstName = (p.first_name ?? "").trim().toLowerCase();
    const lastName = (p.last_name ?? "").trim().toLowerCase();
    if (input === p.id) {
      return { userId: p.id, displayName: fullName || p.id };
    }
    if (
      normalizedInput === fullName.toLowerCase() ||
      normalizedInput === firstName ||
      normalizedInput === lastName ||
      (firstName && normalizedInput.startsWith(firstName)) ||
      (lastName && normalizedInput.endsWith(lastName))
    ) {
      return { userId: p.id, displayName: fullName || "Unknown" };
    }
  }
  return null;
}

const SELF_ALIASES = ["me", "myself", "self"];

export async function followUser(
  ctx: ToolContext & { currentUserId: string },
  params: FollowUserParams
): Promise<FollowUserResult> {
  const { boardId, supabase, currentUserId } = ctx;
  if (!currentUserId) {
    return { success: false, error: "Not authenticated." };
  }
  const { displayNameOrId } = params;
  const input = displayNameOrId.trim().toLowerCase();
  if (SELF_ALIASES.includes(input)) {
    return { success: false, error: "You cannot follow yourself." };
  }

  const resolved = await resolveToUserId(ctx, currentUserId, displayNameOrId);
  if (!resolved) {
    return {
      success: false,
      error: `Could not find a board member matching "${displayNameOrId}". Use first name, last name, or full name.`,
    };
  }

  if (resolved.userId === currentUserId) {
    return {
      success: false,
      error: "You cannot follow yourself.",
    };
  }

  const channel = supabase.channel(`board_presence:${boardId}`, {
    config: { broadcast: { self: false } },
  });
  await channel.subscribe();

  const eventId = `follow-${currentUserId}-${Date.now()}`;
  channel.send({
    type: "broadcast",
    event: FOLLOW_EVENT,
    payload: {
      followerUserId: currentUserId,
      followingUserId: resolved.userId,
      eventId,
      timestamp: Date.now(),
    },
  });

  supabase.removeChannel(channel);

  return {
    success: true,
    displayName: resolved.displayName,
  };
}
