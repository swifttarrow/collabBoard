---
name: supabase-schema
description: Creates or modifies Supabase database schema via migrations. Use when creating, modifying, or deleting tables, columns, indexes, or constraints in a Supabase project.
---

# Create or Modify Supabase Schema

## When to Use

Apply this skill when:
- Creating new tables
- Adding or removing columns
- Adding indexes or constraints
- Enabling Realtime on tables
- Dropping columns or tables

## Workflow

### 1. Create Migration File

Add a new migration in `supabase/migrations/` with sequential numbering and a descriptive name:

```
supabase/migrations/XXXX_descriptive_name.sql
```

Example: `0006_add_board_settings.sql`

### 2. Define Schema Changes (SQL)

- Use appropriate PostgreSQL types (`uuid`, `text`, `jsonb`, `timestamptz`, `double precision`, etc.)
- Add `NOT NULL` for required columns; use `DEFAULT` where sensible
- Add foreign keys: `references table(column) on delete cascade|set null`
- For new tables: enable RLS (`alter table X enable row level security`) and add policies
- Use `gen_random_uuid()` for primary keys when not referencing auth

### 3. Add Indexes When

- Column is queried frequently (e.g. `board_id`, `created_at`)
- Column is used in joins or foreign keys
- Column is used in Realtime `filter` clauses

```sql
create index if not exists idx_table_column on table(column);
```

### 4. Realtime Tables

If the table will be used with Supabase Realtime:

```sql
alter publication supabase_realtime add table table_name;
alter table table_name replica identity full;
```

`replica identity full` is required for LWW-style reconciliation (receiving old values on UPDATE/DELETE).

### 5. Update TypeScript Types

- If the project uses `supabase gen types`, run it after migration and update imports
- If using manual types (e.g. `src/lib/**/types.ts`), update interfaces to match the schema

### 6. Verify Compatibility

- Ensure existing queries and RLS policies still apply
- Check Realtime subscriptions for tables that use `channel().on('postgres_changes', ...)`

## Never

- **Never modify schema outside migrations** — no ad-hoc SQL in scripts or dashboards
- **Never drop columns** without first verifying no code or views reference them
- **Never remove constraints** without documenting the reason and checking impact

## Output Format

Provide:

1. **Migration file** — complete SQL, ready to run
2. **Explanation** — what changed and why
3. **Code updates** — any required changes to types, queries, or Realtime subscriptions

## Example: Add Column

```sql
-- supabase/migrations/0006_add_board_settings.sql
alter table boards add column settings jsonb not null default '{}'::jsonb;
create index if not exists idx_boards_owner_created on boards(owner_id, created_at desc);
```

## Example: New Table with Realtime

```sql
-- supabase/migrations/0007_comments.sql
create table comments (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  object_id uuid references board_objects(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table comments enable row level security;
create policy "comments_select" on comments for select using (
  exists (
    select 1 from boards b
    left join board_members bm on bm.board_id = b.id
    where b.id = comments.board_id and (b.owner_id = auth.uid() or bm.user_id = auth.uid())
  )
);

create index idx_comments_board on comments(board_id);
alter publication supabase_realtime add table comments;
alter table comments replica identity full;
```
