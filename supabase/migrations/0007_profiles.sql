-- Profiles table for optional first/last name (used for avatar initials).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Users can read any profile (first/last name is shared in boards).
create policy "profiles_select" on profiles
  for select using (auth.uid() is not null);

-- Users can update only their own profile.
create policy "profiles_update" on profiles
  for update using (id = auth.uid());

-- Users can insert only their own profile (on first create).
create policy "profiles_insert" on profiles
  for insert with check (id = auth.uid());

create index if not exists idx_profiles_id on profiles(id);

-- Auto-create profile on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
