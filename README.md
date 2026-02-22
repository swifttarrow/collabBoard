# CollabBoard ✨

A realtime collaborative whiteboard with offline support, version history, and AI-powered commands. Create stickies, shapes, connectors, and frames—together or alone—and never lose your work.

**[Live app](https://collab-board-nfcv.vercel.app/)** · **[Source](https://github.com/swifttarrow/collabBoard)** · **[AI cost analysis](ai_cost_analysis.md)** · **[AI dev log](ai_dev_log.md)** · **[Docs](docs/README.md)**

---

## See It in Action

| Demo | Description |
|------|-------------|
| **[General overview](https://drive.google.com/file/d/1V53xg-ujut08XbjTWnxlVP0BC_8dASOR/view?usp=drive_link)** | A quick tour of the canvas: stickies, shapes, connectors, text editing, and more. |
| **[Multi-user collaboration](https://drive.google.com/file/d/19-y515qZNe1U-Tilj3UM-6uQ922jdXSp/view?usp=sharing)** | Live cursors, realtime syncing, and following another user's viewport. |
| **[Version history](https://drive.google.com/file/d/1M-43dIfH7pvfltR9YGj7YKV7_WocOj0F/view?usp=drive_link)** | Browse snapshots, restore to any point, and undo/redo with confidence. |
| **[Offline support](https://drive.google.com/file/d/1xzPU3gPypKSKNX8l1JMBPedHPHP3BPKC/view?usp=drive_link)** | Edit without a connection; changes queue locally and sync when you're back online. |
| **[AI commands](https://drive.google.com/file/d/1AE6YMjgXqXmqGr4RmX-vZKxHGRPufBku/view?usp=drive_link)** | Natural language to create layouts, SWOT analyses, and more—AI writes directly to the board. |
| **[Delightful extras](https://drive.google.com/file/d/1WvSsVfWJ2oz52Bnw164A4FkMGjtj7zkG/view?usp=sharing)** | Themes, command palette, Konami easter egg, and other polish. |

---

## Tech Highlights

- **Next.js 16** · **Supabase** (auth, DB, realtime) · **Konva** (canvas) · **Zustand** · **OpenAI** (AI commands)
- Local-first sync with IndexedDB outbox and snapshot cache
- Supabase Realtime for presence, cursors, and board-object broadcasts

---

## What Made It Hard

**1. Local-first sync that survives offline**

Every edit applies immediately to the UI, then goes into a persistent IndexedDB outbox. A 2-second send loop drains pending ops when online; on reconnect, the client fetches the latest snapshot and rebases local ops on top. Idempotent ops (deduped by `opId`) prevent double-apply on retries. The result: fast, uninterrupted editing with eventual consistency and no lost work.

**2. Realtime collaboration without chaos**

Multiple users edit the same board at once. We use **Last-Write-Wins (LWW)** per object: when two clients change the same sticky, the one with the newer `updated_at` wins. Cursor presence is throttled and interpolated for smooth motion. The server broadcasts committed ops; clients apply via `applyRemoteObject` and LWW—no CRDTs, no OT, just deterministic, predictable merging.

**3. AI that writes to the board**

The AI agent runs server-side (API keys stay secure) and writes directly to `board_objects`, then broadcasts on the same Realtime channel clients use. Tool executors (`createStickyNote`, `moveObject`, `createFrame`, etc.) feed `getBoardState()` for context, execute changes, and broadcast—so all users see AI edits in real time through the existing sync pipeline, with no client changes.

---

## Getting Started

1. **Copy environment variables**

   ```bash
   cp .env.example .env.local
   ```

2. **Fill in** Supabase URL/key and OpenAI API key.

3. **Run migrations** in your Supabase project:

   ```bash
   supabase db push
   ```

4. **(Optional)** Enable **Anonymous Sign-Ins** for "Continue as Guest":
   - Hosted Supabase: Authentication → Providers → enable anonymous sign-ins
   - Local Supabase: `supabase/config.toml` has `enable_anonymous_sign_ins = true`; use local URL and anon key from `supabase status`

5. **Run the app**

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

---

## E2E Tests (Playwright)

```bash
npx playwright install   # once
npm run test:e2e         # run tests
```

Tests use the local `/e2e/board` harness and mock APIs. For debugging: `npm run test:e2e:headed` or `npm run test:e2e:ui`.
