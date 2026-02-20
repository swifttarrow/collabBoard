import type { ToolContext } from "./types";
import { FOLLOW_EVENT } from "@/components/canvas/BoardPresenceProvider";

type FollowUserParams = {
  /** Display name to match (e.g. "Jane", "Jane Doe") or userId */
  displayNameOrId: string;
};

export type FollowUserResult =
  | { success: true; displayName: string; userId: string }
  | { success: false; error: string };

/** Get display names from users currently on the board (presence). Matches what the UI shows. */
async function getPresenceNames(
  supabase: ToolContext["supabase"],
  boardId: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
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
  const state = await Promise.race([
    statePromise,
    new Promise<Record<string, Array<{ userId?: string; name?: string }>>>((resolve) =>
      setTimeout(
        () => resolve(channel.presenceState<{ userId?: string; name?: string }>()),
        1200,
      ),
    ),
  ]);
  supabase.removeChannel(channel);
  for (const key of Object.keys(state)) {
    for (const p of state[key] ?? []) {
      const uid = p.userId ?? key;
      const name = (p.name ?? "").trim();
      if (uid && name) map.set(uid, name);
    }
  }
  return map;
}

function nameMatches(input: string, name: string): boolean {
  const n = input.trim().toLowerCase();
  const full = name.trim().toLowerCase();
  if (!n || !full) return false;
  if (n === full) return true;
  if (full.includes(n)) return true;
  const parts = full.split(/\s+/);
  for (const part of parts) {
    if (part === n || (part.startsWith(n) && n.length >= 2)) return true;
  }
  return false;
}

/** Resolve display name or id to a board member userId. Tries presence first (exact UI names), then profiles. */
async function resolveToUserId(
  ctx: ToolContext,
  currentUserId: string,
  displayNameOrId: string
): Promise<{ userId: string; displayName: string } | null> {
  const { boardId, supabase } = ctx;
  const input = displayNameOrId.trim();
  if (!input) return null;

  const normalizedInput = input.toLowerCase();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // 1. Try presence first — names shown in the UI (including email-derived when profile empty).
  // Don't filter by userIds: RLS only lets us see our own board_members row, so we'd miss others.
  // Anyone in presence is viewing the board and can be followed.
  const presenceNames = await getPresenceNames(supabase, boardId);
  for (const [uid, name] of presenceNames) {
    if (uid === currentUserId) continue;
    if (uuidRegex.test(input) && uid.toLowerCase() === normalizedInput) {
      return { userId: uid, displayName: name };
    }
    if (nameMatches(input, name)) {
      return { userId: uid, displayName: name };
    }
  }

  // 2. Fall back to profiles (first_name, last_name)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", Array.from(userIds));

  const matchingId = Array.from(userIds).find((id) => id.toLowerCase() === normalizedInput);
  if (uuidRegex.test(input) && matchingId) {
    const profile = profiles?.find((pr) => pr.id === matchingId);
    const displayName =
      profile?.first_name || profile?.last_name
        ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
        : presenceNames.get(matchingId) ?? "Unknown";
    return { userId: matchingId, displayName };
  }

  for (const p of profiles ?? []) {
    if (p.id === currentUserId) continue;
    if (!userIds.has(p.id)) continue;
    const fullName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    const firstName = (p.first_name ?? "").trim().toLowerCase();
    const lastName = (p.last_name ?? "").trim().toLowerCase();
    const displayName = fullName || (presenceNames.get(p.id) ?? "Unknown");
    if (input === p.id) return { userId: p.id, displayName };
    if (
      normalizedInput === fullName ||
      normalizedInput === firstName ||
      normalizedInput === lastName ||
      (firstName && (normalizedInput === firstName || normalizedInput.startsWith(firstName))) ||
      (lastName && (normalizedInput === lastName || normalizedInput.endsWith(lastName))) ||
      nameMatches(input, fullName)
    ) {
      return { userId: p.id, displayName };
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
      error: `Could not find a board member matching "${displayNameOrId}". Try listBoardUsers to see who's on the board, or use their exact display name.`,
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
  await new Promise((r) => setTimeout(r, 150));
  supabase.removeChannel(channel);

  return {
    success: true,
    displayName: resolved.displayName,
    userId: resolved.userId,
  };
}

export type UnfollowUserResult =
  | { success: true }
  | { success: false; error: string };

/** Stop following the current user (if any). Broadcasts unfollow to client. */
export async function unfollowUser(
  ctx: ToolContext & { currentUserId: string },
): Promise<UnfollowUserResult> {
  const { boardId, supabase, currentUserId } = ctx;
  if (!currentUserId) {
    return { success: false, error: "Not authenticated." };
  }

  const channel = supabase.channel(`board_presence:${boardId}`, {
    config: { broadcast: { self: false } },
  });
  await channel.subscribe();

  const eventId = `unfollow-${currentUserId}-${Date.now()}`;
  channel.send({
    type: "broadcast",
    event: FOLLOW_EVENT,
    payload: {
      followerUserId: currentUserId,
      followingUserId: null,
      eventId,
      timestamp: Date.now(),
    },
  });
  await new Promise((r) => setTimeout(r, 150));
  supabase.removeChannel(channel);

  return { success: true };
}
