-- Save checkpoints: record when a user explicitly "saves" at a given revision.
-- Used to show "Saved" markers in the version history panel.

create table if not exists board_saves (
  id bigserial primary key,
  board_id uuid not null references boards(id) on delete cascade,
  server_revision bigint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_board_saves_board_revision on board_saves(board_id, server_revision);
alter table board_saves enable row level security;

create policy "board_saves_select" on board_saves
  for select using (
    exists (
      select 1 from boards b
      left join board_members bm on bm.board_id = b.id
      where b.id = board_saves.board_id
        and (b.owner_id = auth.uid() or bm.user_id = auth.uid())
    )
  );

create policy "board_saves_insert" on board_saves
  for insert with check (
    auth.uid() is not null
    and exists (
      select 1 from boards b
      left join board_members bm on bm.board_id = b.id
      where b.id = board_saves.board_id
        and (b.owner_id = auth.uid() or bm.user_id = auth.uid())
    )
  );
