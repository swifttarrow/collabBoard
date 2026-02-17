-- Fix infinite recursion: board_members_select was reading boards, and boards_select
-- reads board_members. Break the cycle by letting users only see their own membership
-- rows (user_id = auth.uid()), so boards_select can safely check membership.

drop policy if exists "board_members_select" on board_members;

create policy "board_members_select" on board_members
  for select using (user_id = auth.uid());
