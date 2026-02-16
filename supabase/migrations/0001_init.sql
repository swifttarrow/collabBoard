create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled board',
  created_at timestamptz not null default now()
);

create table if not exists board_members (
  board_id uuid not null references boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table if not exists board_objects (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 0,
  height double precision not null default 0,
  rotation double precision not null default 0,
  color text,
  text text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists board_events (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table boards enable row level security;
alter table board_members enable row level security;
alter table board_objects enable row level security;
alter table board_events enable row level security;

create policy "boards_select" on boards
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from board_members bm
      where bm.board_id = boards.id and bm.user_id = auth.uid()
    )
  );

create policy "boards_insert" on boards
  for insert with check (owner_id = auth.uid());

create policy "boards_update" on boards
  for update using (owner_id = auth.uid());

create policy "board_members_select" on board_members
  for select using (
    exists (
      select 1 from boards b
      where b.id = board_members.board_id
        and (b.owner_id = auth.uid() or board_members.user_id = auth.uid())
    )
  );

create policy "board_members_insert" on board_members
  for insert with check (
    exists (
      select 1 from boards b
      where b.id = board_members.board_id and b.owner_id = auth.uid()
    )
  );

create policy "board_objects_select" on board_objects
  for select using (
    exists (
      select 1 from boards b
      left join board_members bm on bm.board_id = b.id
      where b.id = board_objects.board_id
        and (b.owner_id = auth.uid() or bm.user_id = auth.uid())
    )
  );

create policy "board_objects_write" on board_objects
  for all using (
    exists (
      select 1 from boards b
      left join board_members bm on bm.board_id = b.id
      where b.id = board_objects.board_id
        and (b.owner_id = auth.uid() or bm.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from boards b
      left join board_members bm on bm.board_id = b.id
      where b.id = board_objects.board_id
        and (b.owner_id = auth.uid() or bm.user_id = auth.uid())
    )
  );

create policy "board_events_select" on board_events
  for select using (
    exists (
      select 1 from boards b
      left join board_members bm on bm.board_id = b.id
      where b.id = board_events.board_id
        and (b.owner_id = auth.uid() or bm.user_id = auth.uid())
    )
  );

create policy "board_events_insert" on board_events
  for insert with check (
    exists (
      select 1 from boards b
      left join board_members bm on bm.board_id = b.id
      where b.id = board_events.board_id
        and (b.owner_id = auth.uid() or bm.user_id = auth.uid())
    )
  );
