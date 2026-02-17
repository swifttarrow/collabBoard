"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPresenceClient } from "@/lib/supabase/client";

const CURSOR_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899",
];

const CURSOR_EVENT = "cursor";

/** Fixed tick rate for cursor broadcasts (Hz) — smooth without bursty traffic */
const CURSOR_SEND_MS = 33; // ~30Hz

type CursorPresence = {
  x: number;
  y: number;
  userId: string;
  color: string;
  name: string;
  /** Timestamp for interpolation and out-of-order drop */
  t?: number;
};

export function useBoardPresence(boardId: string) {
  const supabase = useMemo(() => createPresenceClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSendTimeRef = useRef(0);
  const cursorsRef = useRef<Record<string, CursorPresence>>({});
  const lastSeenTRef = useRef<Record<string, number>>({});
  const basePresenceRef = useRef<{
    userId: string;
    color: string;
    name: string;
  } | null>(null);
  const [, forceRender] = useState(0);

  /** Sends at fixed cadence (~30Hz) with timestamp for receiver interpolation. */
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
          console.warn("[useBoardPresence] No auth session - Realtime requires auth");
        }
        return;
      }
      await supabase.realtime.setAuth(session.access_token);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const color = CURSOR_COLORS[Math.abs(hashString(user.id)) % CURSOR_COLORS.length];
      basePresenceRef.current = {
        userId: user.id,
        color,
        name: user.email?.split("@")[0] ?? "Anonymous",
      };

      const channel = supabase.channel(`board_presence:${boardId}`, {
        config: {
          presence: { key: user.id },
          broadcast: { self: false },
        },
      });

      const flushForPresence = () => {
        forceRender((n) => n + 1);
      };

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<{ userId?: string; color?: string; name?: string }>();
          for (const key of Object.keys(state)) {
            for (const p of state[key] ?? []) {
              if (p.userId === user.id) continue;
              const uid = p.userId ?? key;
              if (!cursorsRef.current[uid]) {
                cursorsRef.current[uid] = {
                  x: 0,
                  y: 0,
                  userId: uid,
                  color: p.color ?? "#94a3b8",
                  name: p.name ?? "Anonymous",
                };
              }
            }
          }
          flushForPresence();
        })
        .on("presence", { event: "join" }, () => {
          const state = channel.presenceState<{ userId?: string; color?: string; name?: string }>();
          for (const key of Object.keys(state)) {
            for (const p of state[key] ?? []) {
              if (p.userId === user.id) continue;
              const uid = p.userId ?? key;
              if (!cursorsRef.current[uid]) {
                cursorsRef.current[uid] = {
                  x: 0,
                  y: 0,
                  userId: uid,
                  color: p.color ?? "#94a3b8",
                  name: p.name ?? "Anonymous",
                };
              }
            }
          }
          flushForPresence();
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          if (key) delete cursorsRef.current[key];
          flushForPresence();
        })
        .on("broadcast", { event: CURSOR_EVENT }, ({ payload }) => {
          const p = payload as {
            x?: number;
            y?: number;
            userId?: string;
            color?: string;
            name?: string;
            t?: number;
          };
          const uid = p.userId;
          if (!uid || uid === user.id) return;
          const t = typeof p.t === "number" ? p.t : 0;
          if (t > 0 && t <= (lastSeenTRef.current[uid] ?? 0)) return; // drop out-of-order
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
            const base = basePresenceRef.current;
            await channel.track({
              userId: base.userId,
              color: base.color,
              name: base.name,
            });
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
      };
    };

    const cleanup = setup();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, [boardId, supabase]);

  return { trackCursor, cursorsRef };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
