create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.talent_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_conversation_id text,
  schema_version int not null default 1,
  prompt_version text,
  archetype text not null,
  transferable_skills text[] not null default '{}'::text[],
  recommended_roles text[] not null default '{}'::text[],
  keywords text[] not null default '{}'::text[],
  profile_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists talent_profiles_user_created_idx
  on public.talent_profiles (user_id, created_at desc);

create index if not exists talent_profiles_keywords_gin
  on public.talent_profiles using gin (keywords);

create index if not exists talent_profiles_transferable_skills_gin
  on public.talent_profiles using gin (transferable_skills);

create index if not exists talent_profiles_recommended_roles_gin
  on public.talent_profiles using gin (recommended_roles);

alter table public.talent_profiles enable row level security;

create policy "Users can view their talent profiles"
  on public.talent_profiles
  for select
  using (user_id = auth.uid());

create policy "Users can insert their talent profiles"
  on public.talent_profiles
  for insert
  with check (user_id = auth.uid());

create policy "Users can update their talent profiles"
  on public.talent_profiles
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their talent profiles"
  on public.talent_profiles
  for delete
  using (user_id = auth.uid());

create table if not exists public.user_context_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  talent_profile_id uuid references public.talent_profiles(id) on delete set null,
  current_snapshot jsonb not null default '{}'::jsonb,
  keywords text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

create index if not exists user_context_profiles_keywords_gin
  on public.user_context_profiles using gin (keywords);

create trigger user_context_profiles_set_updated_at
  before update on public.user_context_profiles
  for each row
  execute function public.set_updated_at();

alter table public.user_context_profiles enable row level security;

create policy "Users can view their context profile"
  on public.user_context_profiles
  for select
  using (user_id = auth.uid());

create policy "Users can insert their context profile"
  on public.user_context_profiles
  for insert
  with check (user_id = auth.uid());

create policy "Users can update their context profile"
  on public.user_context_profiles
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their context profile"
  on public.user_context_profiles
  for delete
  using (user_id = auth.uid());

create table if not exists public.identity_vision_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version int not null default 1,
  title text,
  ideal_state text,
  current_capabilities text,
  planned_actions text,
  full_text text,
  vision_json jsonb not null default '{}'::jsonb,
  keywords text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create index if not exists identity_vision_boards_user_created_idx
  on public.identity_vision_boards (user_id, created_at desc);

create index if not exists identity_vision_boards_keywords_gin
  on public.identity_vision_boards using gin (keywords);

alter table public.identity_vision_boards enable row level security;

create policy "Users can view their vision boards"
  on public.identity_vision_boards
  for select
  using (user_id = auth.uid());

create policy "Users can insert their vision boards"
  on public.identity_vision_boards
  for insert
  with check (user_id = auth.uid());

create policy "Users can update their vision boards"
  on public.identity_vision_boards
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their vision boards"
  on public.identity_vision_boards
  for delete
  using (user_id = auth.uid());

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  facts_json jsonb not null default '{}'::jsonb,
  mood_json jsonb not null default '{}'::jsonb,
  free_text text,
  keywords text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create unique index if not exists daily_checkins_user_date_uq
  on public.daily_checkins (user_id, checkin_date);

create index if not exists daily_checkins_user_created_idx
  on public.daily_checkins (user_id, created_at desc);

create index if not exists daily_checkins_keywords_gin
  on public.daily_checkins using gin (keywords);

alter table public.daily_checkins enable row level security;

create policy "Users can view their daily checkins"
  on public.daily_checkins
  for select
  using (user_id = auth.uid());

create policy "Users can insert their daily checkins"
  on public.daily_checkins
  for insert
  with check (user_id = auth.uid());

create policy "Users can update their daily checkins"
  on public.daily_checkins
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their daily checkins"
  on public.daily_checkins
  for delete
  using (user_id = auth.uid());

create table if not exists public.coach_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_kind text not null,
  range_start date,
  range_end date,
  insight_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists coach_insights_user_created_idx
  on public.coach_insights (user_id, created_at desc);

alter table public.coach_insights enable row level security;

create policy "Users can view their coach insights"
  on public.coach_insights
  for select
  using (user_id = auth.uid());

create policy "Users can insert their coach insights"
  on public.coach_insights
  for insert
  with check (user_id = auth.uid());

create policy "Users can update their coach insights"
  on public.coach_insights
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their coach insights"
  on public.coach_insights
  for delete
  using (user_id = auth.uid());
