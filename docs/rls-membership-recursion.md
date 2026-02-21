# RLS Membership and Infinite Recursion Prevention

This document answers:

**How does restricting membership reads to `user_id = auth.uid()` prevent infinite recursion?**

---

## The Problem

Originally, `board_members` had an RLS policy that checked board access like this:

```sql
-- OLD board_members_select (conceptual)
for select using (
  exists (
    select 1 from boards b
    where b.id = board_members.board_id
      and (b.owner_id = auth.uid() or board_members.user_id = auth.uid())
  )
);
```

Meanwhile, `boards_select` checked membership:

```sql
-- boards_select
for select using (
  owner_id = auth.uid()
  or exists (
    select 1 from board_members bm
    where bm.board_id = boards.id and bm.user_id = auth.uid()
  )
);
```

**Infinite recursion**:

1. To read `board_members`, the policy evaluates `exists (select 1 from boards ...)`.
2. To read `boards`, Postgres evaluates `boards_select`, which does `exists (select 1 from board_members ...)`.
3. Evaluating `board_members` again triggers `boards` again, and so on — a mutual dependency that can cause stack overflow or deadlock.

---

## The Fix

Migration `0002_fix_boards_rls_recursion.sql` changes `board_members_select` to:

```sql
create policy "board_members_select" on board_members
  for select using (user_id = auth.uid());
```

Users can **only see their own membership rows**. They cannot see other users’ memberships through this policy.

---

## Why This Breaks the Cycle

- **`board_members_select`** no longer references `boards`. It only checks `user_id = auth.uid()` — a simple, non-recursive condition.
- **`boards_select`** can safely use `exists (select 1 from board_members bm where bm.board_id = boards.id and bm.user_id = auth.uid())` because:
  - Reading `board_members` no longer triggers a read of `boards`.
  - The recursion is broken.

---

## Semantic Change

- **Before**: A user could potentially see any `board_members` row for boards they had access to (owner or member).
- **After**: A user sees only rows where `user_id = auth.uid()` — i.e., their own memberships.

For typical use (e.g., “am I a member of this board?”), this is sufficient. Code that needs to list *all* members of a board must use a different path (e.g., an RPC or a policy on a view) that does not rely on reading `board_members` for other users through this policy.
