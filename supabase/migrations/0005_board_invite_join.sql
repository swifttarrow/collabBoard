-- Add invite_code to boards so owners can generate shareable join links.
alter table boards add column if not exists invite_code text unique;

-- Only owners can update boards (including setting invite_code).
-- The init migration already has boards_update with owner_id check.

-- Function: allow authenticated users to join a board using a valid invite code.
-- Runs with SECURITY DEFINER so it can bypass RLS to add the user.
create or replace function join_board_by_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_board_id
  from boards
  where invite_code = p_invite_code and invite_code is not null
  limit 1;

  if v_board_id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  -- Insert membership (ignore if already a member)
  insert into board_members (board_id, user_id, role)
  values (v_board_id, v_user_id, 'editor')
  on conflict (board_id, user_id) do nothing;

  return v_board_id;
end;
$$;

-- Allow authenticated users to call this function
grant execute on function join_board_by_invite(text) to authenticated;
