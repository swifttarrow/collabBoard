-- Resilient Canvas: board revision and operations table for idempotent op sync.
-- Enables local-first editing with outbox, deduplication, and eventual consistency.

-- Add server revision to boards for total ordering of committed ops
alter table boards add column if not exists revision bigint not null default 0;

-- Table for idempotency: dedupe by op_id, track applied ops
create table if not exists board_operations (
  op_id uuid primary key,
  board_id uuid not null references boards(id) on delete cascade,
  server_revision bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_board_operations_board on board_operations(board_id, server_revision);
alter table board_operations enable row level security;

create policy "board_operations_select" on board_operations
  for select using (
    exists (
      select 1 from boards b
      left join board_members bm on bm.board_id = b.id
      where b.id = board_operations.board_id
        and (b.owner_id = auth.uid() or bm.user_id = auth.uid())
    )
  );

create policy "board_operations_insert" on board_operations
  for insert with check (
    exists (
      select 1 from boards b
      left join board_members bm on bm.board_id = b.id
      where b.id = board_operations.board_id
        and (b.owner_id = auth.uid() or bm.user_id = auth.uid())
    )
  );

-- Atomic function to apply an op with idempotency. Returns { applied: bool, revision: bigint }.
-- op_type: 'create' | 'update' | 'delete'
-- payload for create: full object row
-- payload for update: { id, ...updates }
-- payload for delete: { id }
create or replace function apply_board_operation(
  p_op_id uuid,
  p_board_id uuid,
  p_op_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_revision bigint;
  v_id uuid;
begin
  -- Idempotency: return existing revision if already applied
  select true, server_revision into v_exists, v_revision
  from board_operations
  where op_id = p_op_id
  limit 1;
  if v_exists then
    return jsonb_build_object('applied', false, 'revision', v_revision);
  end if;

  -- Check board access via RLS (caller must have select on boards)
  if not exists (
    select 1 from boards b
    left join board_members bm on bm.board_id = b.id
    where b.id = p_board_id
      and (b.owner_id = auth.uid() or bm.user_id = auth.uid())
  ) then
    raise exception 'Access denied to board';
  end if;

  -- Lock board row and get next revision
  select b.revision + 1 into v_revision
  from boards b
  where b.id = p_board_id
  for update;

  if v_revision is null then
    raise exception 'Board not found';
  end if;

  -- Apply op based on type
  case p_op_type
    when 'create' then
      insert into board_objects (
        id, board_id, type, data, parent_id, x, y, width, height,
        rotation, color, text, clip_content, updated_at, updated_by
      )
      values (
        (p_payload->>'id')::uuid,
        p_board_id,
        p_payload->>'type',
        coalesce(p_payload->'data', '{}'::jsonb),
        (p_payload->>'parent_id')::uuid,
        coalesce((p_payload->>'x')::double precision, 0),
        coalesce((p_payload->>'y')::double precision, 0),
        coalesce((p_payload->>'width')::double precision, 0),
        coalesce((p_payload->>'height')::double precision, 0),
        coalesce((p_payload->>'rotation')::double precision, 0),
        p_payload->>'color',
        p_payload->>'text',
        coalesce((p_payload->>'clip_content')::boolean, false),
        now(),
        auth.uid()
      );
    when 'update' then
      v_id := (p_payload->>'id')::uuid;
      update board_objects
      set
        parent_id = case when p_payload ? 'parent_id' then (p_payload->>'parent_id')::uuid else parent_id end,
        x = case when p_payload ? 'x' then (p_payload->>'x')::double precision else x end,
        y = case when p_payload ? 'y' then (p_payload->>'y')::double precision else y end,
        width = case when p_payload ? 'width' then (p_payload->>'width')::double precision else width end,
        height = case when p_payload ? 'height' then (p_payload->>'height')::double precision else height end,
        rotation = case when p_payload ? 'rotation' then (p_payload->>'rotation')::double precision else rotation end,
        color = case when p_payload ? 'color' then p_payload->>'color' else color end,
        text = case when p_payload ? 'text' then p_payload->>'text' else text end,
        clip_content = case when p_payload ? 'clip_content' then (p_payload->>'clip_content')::boolean else clip_content end,
        data = case when p_payload ? 'data' then coalesce(p_payload->'data', '{}'::jsonb) else data end,
        updated_at = now(),
        updated_by = auth.uid()
      where id = v_id and board_id = p_board_id;
    when 'delete' then
      v_id := (p_payload->>'id')::uuid;
      delete from board_objects where id = v_id and board_id = p_board_id;
    else
      raise exception 'Unknown op_type: %', p_op_type;
  end case;

  -- Update board revision
  update boards set revision = v_revision where id = p_board_id;

  -- Record op for idempotency
  insert into board_operations (op_id, board_id, server_revision)
  values (p_op_id, p_board_id, v_revision);

  return jsonb_build_object('applied', true, 'revision', v_revision);
end;
$$;
