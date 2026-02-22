-- Set first_name = 'Guest' for anonymous users when profile is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, avatar_color, first_name)
  values (
    new.id,
    random_avatar_color(),
    case when coalesce(new.is_anonymous, false) then 'Guest' else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill existing anonymous users: set first_name = 'Guest'.
update profiles p
set first_name = 'Guest'
from auth.users u
where p.id = u.id and coalesce(u.is_anonymous, false);
