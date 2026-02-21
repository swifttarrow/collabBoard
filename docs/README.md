# CollabBoard Documentation

Technical documentation for architectural decisions and implementation details.

## Architecture Questions

| Topic | Document |
|-------|----------|
| **Interpolation** – What is it and why do we use it? | [presence-and-cursors.md](./presence-and-cursors.md#1-what-is-interpolation-and-why-are-we-using-it) |
| **Cursor positions** – How does showing them work? | [presence-and-cursors.md](./presence-and-cursors.md#2-how-does-showing-of-cursor-positions-work) |
| **Realtime board sync** – How does it work? | [realtime-board-sync.md](./realtime-board-sync.md) |
| **Optimistic updates** – What's the purpose? | [optimistic-updates.md](./optimistic-updates.md) |
| **Conflict resolution** – How does it work? | [conflict-resolution.md](./conflict-resolution.md) |
| **RLS recursion** – How does `user_id = auth.uid()` prevent infinite recursion? | [rls-membership-recursion.md](./rls-membership-recursion.md) |
| **Minimal rectangle fallback** – What is it? | [viewport-and-zoom.md](./viewport-and-zoom.md) |
| **Cursor throttling** – Why throttle cursor tracking? | [presence-and-cursors.md](./presence-and-cursors.md#3-whats-the-purpose-of-throttling-cursor-tracking) |
| **Connector snapping** – How does it work? | [connector-snapping.md](./connector-snapping.md) |
| **Board previews** – How are they generated? | [board-previews.md](./board-previews.md) |
| **Network resiliency** – How is it implemented? | [network-resiliency.md](./network-resiliency.md) |
| **Panning performance** – How do we optimize rendering? | [rendering-performance.md](./rendering-performance.md) |

## Other Documentation

- [resilient_canvas_sync.md](./resilient_canvas_sync.md) – Full architecture for local-first sync, ops, outbox, and rebasing
- [ai_agent_architecture.md](./ai_agent_architecture.md) – AI command execution and tool integration
