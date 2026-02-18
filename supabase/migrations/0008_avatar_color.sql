-- Add avatar_color to profiles. Assigned randomly on signup, used consistently across all views.
alter table profiles add column if not exists avatar_color text;

-- Palette matching app (avatar-colors.ts)
create or replace function public.random_avatar_color()
returns text
language plpgsql
as $$
declare
  colors text[] := array['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899'];
begin
  return colors[1 + floor(random() * array_length(colors, 1))::int];
end;
$$;

-- Update trigger to set random color on new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, avatar_color)
  values (new.id, random_avatar_color())
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill existing profiles that don't have a color
update profiles
set avatar_color = (array['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899'])[1 + floor(random() * 8)::int]
where avatar_color is null;
