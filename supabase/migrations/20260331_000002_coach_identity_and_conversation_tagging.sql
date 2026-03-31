do $$
begin
  if not exists (select 1 from pg_type where typname = 'coach_type') then
    create type public.coach_type as enum ('talent', 'action');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row
  execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

create policy "Users can view their own profile"
  on public.user_profiles
  for select
  using (user_id = auth.uid());

create policy "Users can insert their own profile"
  on public.user_profiles
  for insert
  with check (user_id = auth.uid());

create policy "Users can update their own profile"
  on public.user_profiles
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own profile"
  on public.user_profiles
  for delete
  using (user_id = auth.uid());

create table if not exists public.user_coach_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_coach public.coach_type not null default 'action',
  updated_at timestamptz not null default now()
);

create trigger user_coach_preferences_set_updated_at
  before update on public.user_coach_preferences
  for each row
  execute function public.set_updated_at();

alter table public.user_coach_preferences enable row level security;

create policy "Users can view their coach preferences"
  on public.user_coach_preferences
  for select
  using (user_id = auth.uid());

create policy "Users can insert their coach preferences"
  on public.user_coach_preferences
  for insert
  with check (user_id = auth.uid());

create policy "Users can update their coach preferences"
  on public.user_coach_preferences
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their coach preferences"
  on public.user_coach_preferences
  for delete
  using (user_id = auth.uid());

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'conversations'
  ) then
    alter table public.conversations
      add column if not exists coach public.coach_type not null default 'talent';

    if not exists (
      select 1
      from pg_indexes
      where schemaname = 'public' and indexname = 'conversations_user_coach_created_idx'
    ) then
      create index conversations_user_coach_created_idx
        on public.conversations (user_id, coach, created_at desc);
    end if;
  end if;
end $$;
