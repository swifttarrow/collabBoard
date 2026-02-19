"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { getAvatarColorFallback } from "@/lib/avatar-colors";
import { performanceMetricsStore } from "@/lib/performance/metrics-store";

const CURSOR_EVENT = "cursor";
const CURSOR_SEND_MS = 33;

type CursorPresence = {
  x: number;
  y: number;
  userId: string;
  color: string;
  name: string;
  t?: number;
};

export type PresenceMember = {
  id: string;
  first_name: null;
  last_name: null;
  avatar_color: string;
};

type BoardPresenceContextValue = {
  trackCursor: (worldPoint: { x: number; y: number }) => void;
  cursorsRef: React.RefObject<Record<string, CursorPresence>>;
  activeUserIds: Set<string>;
  presenceNames: Record<string, string>;
  /** Members derived from presence (all users in channel except self) - used to show avatars for users we can't fetch via RLS */
  presenceMembers: PresenceMember[];
};

const BoardPresenceContext = createContext<BoardPresenceContextValue | null>(
  null
);

export function useBoardPresenceContext() {
  const ctx = useContext(BoardPresenceContext);
  if (!ctx) throw new Error("useBoardPresenceContext must be used within BoardPresenceProvider");
  return ctx;
}

type Props = { boardId: string; children: React.ReactNode };

export function BoardPresenceProvider({ boardId, children }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSendTimeRef = useRef(0);
  const cursorsRef = useRef<Record<string, CursorPresence>>({});
  const lastSeenTRef = useRef<Record<string, number>>({});
  const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set());
  const [presenceNames, setPresenceNames] = useState<Record<string, string>>({});
  const [presenceMembers, setPresenceMembers] = useState<PresenceMember[]>([]);
  const basePresenceRef = useRef<{
    userId: string;
    color: string;
    name: string;
  } | null>(null);
  const [, forceRender] = useState(0);

  const trackCursor = useCallback(
    (worldPoint: { x: number; y: number }) => {
      const ch = channelRef.current;
      if (!ch || !basePresenceRef.current) return;
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastSendTimeRef.current < CURSOR_SEND_MS) return;
      lastSendTimeRef.current = now;
      const base = basePresenceRef.current;
      ch.send({
        type: "broadcast",
        event: CURSOR_EVENT,
        payload: {
          x: worldPoint.x,
          y: worldPoint.y,
          t: now,
          userId: base.userId,
          color: base.color,
          name: base.name,
        },
      });
    },
    []
  );

  useEffect(() => {
    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[BoardPresence] No auth session");
        }
        return;
      }
      await supabase.realtime.setAuth(session.access_token);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let displayName = user.email?.split("@")[0] ?? "Anonymous";
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_color")
        .eq("id", user.id)
        .single();
      if (profile?.first_name || profile?.last_name) {
        displayName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
      }

      let color = profile?.avatar_color ?? getAvatarColorFallback(user.id);
      if (!profile?.avatar_color) {
        const { getRandomAvatarColor } = await import("@/lib/avatar-colors");
        color = getRandomAvatarColor();
        await supabase.from("profiles").update({ avatar_color: color }).eq("id", user.id);
      }
      basePresenceRef.current = { userId: user.id, color, name: displayName };

      const channel = supabase.channel(`board_presence:${boardId}`, {
        config: { presence: { key: user.id }, broadcast: { self: false } },
      });

      const flushForPresence = () => forceRender((n) => n + 1);

      const updateActiveUserIds = () => {
        const state = channel.presenceState<{ userId?: string; name?: string; color?: string }>();
        const ids = new Set<string>();
        const names: Record<string, string> = {};
        const members: PresenceMember[] = [];
        for (const key of Object.keys(state)) {
          for (const p of state[key] ?? []) {
            const uid = p.userId ?? key;
            ids.add(uid);
            if (uid !== user.id) {
              if (p.name) names[uid] = p.name;
              members.push({
                id: uid,
                first_name: null,
                last_name: null,
                avatar_color: p.color ?? "#94a3b8",
              });
            }
          }
        }
        setActiveUserIds(ids);
        setPresenceNames(names);
        setPresenceMembers(members);
        flushForPresence();
      };

      channel
        .on("presence", { event: "sync" }, () => {
          updateActiveUserIds();
          const state = channel.presenceState<{ userId?: string; color?: string; name?: string }>();
          for (const key of Object.keys(state)) {
            for (const p of state[key] ?? []) {
              if (p.userId === user.id) continue;
              const uid = p.userId ?? key;
              if (!cursorsRef.current[uid]) {
                cursorsRef.current[uid] = {
                  x: 0, y: 0, userId: uid,
                  color: p.color ?? "#94a3b8",
                  name: p.name ?? "Anonymous",
                };
              }
            }
          }
          flushForPresence();
        })
        .on("presence", { event: "join" }, () => {
          updateActiveUserIds();
          const state = channel.presenceState<{ userId?: string; color?: string; name?: string }>();
          for (const key of Object.keys(state)) {
            for (const p of state[key] ?? []) {
              if (p.userId === user.id) continue;
              const uid = p.userId ?? key;
              if (!cursorsRef.current[uid]) {
                cursorsRef.current[uid] = {
                  x: 0, y: 0, userId: uid,
                  color: p.color ?? "#94a3b8",
                  name: p.name ?? "Anonymous",
                };
              }
            }
          }
          flushForPresence();
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          updateActiveUserIds();
          if (key) delete cursorsRef.current[key];
          flushForPresence();
        })
        .on("broadcast", { event: CURSOR_EVENT }, ({ payload }) => {
          const p = payload as {
            x?: number; y?: number; userId?: string; color?: string; name?: string; t?: number;
          };
          const uid = p.userId;
          if (!uid || uid === user.id) return;
          const t = typeof p.t === "number" ? p.t : 0;
          if (t > 0) {
            performanceMetricsStore.recordCursorSyncLatency(Date.now() - t);
          }
          if (t <= (lastSeenTRef.current[uid] ?? 0)) return;
          lastSeenTRef.current[uid] = t;
          const prev = cursorsRef.current[uid];
          cursorsRef.current[uid] = {
            x: typeof p.x === "number" ? p.x : prev?.x ?? 0,
            y: typeof p.y === "number" ? p.y : prev?.y ?? 0,
            userId: uid,
            color: p.color ?? prev?.color ?? "#94a3b8",
            name: p.name ?? prev?.name ?? "Anonymous",
            t,
          };
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && basePresenceRef.current) {
            await channel.track(basePresenceRef.current);
          }
        });

      channelRef.current = channel;

      return () => {
        channel.untrack();
        supabase.removeChannel(channel);
        channelRef.current = null;
        basePresenceRef.current = null;
        cursorsRef.current = {};
        lastSeenTRef.current = {};
        setActiveUserIds(new Set());
        setPresenceNames({});
        setPresenceMembers([]);
      };
    };

    const cleanup = setup();
    return () => { cleanup.then((fn) => fn?.()); };
  }, [boardId, supabase]);

  const value = useMemo(
    () => ({
      trackCursor,
      cursorsRef,
      activeUserIds,
      presenceNames,
      presenceMembers,
    }),
    [trackCursor, activeUserIds, presenceNames, presenceMembers]
  );

  return (
    <BoardPresenceContext.Provider value={value}>
      {children}
    </BoardPresenceContext.Provider>
  );
}
