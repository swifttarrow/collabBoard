-- Allow board owners to delete their boards.
-- Cascading deletes handle board_objects, board_members, board_history, etc.

create policy "boards_delete" on boards
  for delete using (owner_id = auth.uid());
