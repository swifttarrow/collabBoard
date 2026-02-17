-- Allow anyone (including anon) to list all boards for the public carousel.
create policy "boards_select_public" on boards
  for select using (true);

-- Function: allow authenticated users to join any board directly (no invite code).
-- Used when a user clicks a board from the public carousel.
create or replace function join_board_direct(p_board_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure board exists
  if not exists (select 1 from boards where id = p_board_id) then
    raise exception 'Board not found';
  end if;

  -- Insert membership (ignore if already a member)
  insert into board_members (board_id, user_id, role)
  values (p_board_id, v_user_id, 'editor')
  on conflict (board_id, user_id) do nothing;
end;
$$;

grant execute on function join_board_direct(uuid) to authenticated;
