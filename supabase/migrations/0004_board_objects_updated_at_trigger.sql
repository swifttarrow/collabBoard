-- Ensure updated_at is always set by the server on UPDATE for LWW consistency.
create or replace function update_board_objects_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger board_objects_updated_at
  before update on board_objects
  for each row execute function update_board_objects_updated_at();
