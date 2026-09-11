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

drop policy if exists "Users can view their talent profiles" on public.talent_profiles;
create policy "Users can view their talent profiles"
  on public.talent_profiles
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert their talent profiles" on public.talent_profiles;
create policy "Users can insert their talent profiles"
  on public.talent_profiles
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update their talent profiles" on public.talent_profiles;
create policy "Users can update their talent profiles"
  on public.talent_profiles
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their talent profiles" on public.talent_profiles;
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

drop trigger if exists user_context_profiles_set_updated_at on public.user_context_profiles;
create trigger user_context_profiles_set_updated_at
  before update on public.user_context_profiles
  for each row
  execute function public.set_updated_at();

alter table public.user_context_profiles enable row level security;

drop policy if exists "Users can view their context profile" on public.user_context_profiles;
create policy "Users can view their context profile"
  on public.user_context_profiles
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert their context profile" on public.user_context_profiles;
create policy "Users can insert their context profile"
  on public.user_context_profiles
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update their context profile" on public.user_context_profiles;
create policy "Users can update their context profile"
  on public.user_context_profiles
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their context profile" on public.user_context_profiles;
create policy "Users can delete their context profile"
  on public.user_context_profiles
  for delete
  using (user_id = auth.uid());

create table if not exists public.anonymous_career_drafts (
  id uuid primary key default gen_random_uuid(),
  draft_token text not null unique,
  source text not null default 'chat_report',
  conversation_json jsonb not null default '[]'::jsonb,
  report_json jsonb not null default '{}'::jsonb,
  report_summary_json jsonb not null default '{}'::jsonb,
  preview_json jsonb not null default '{}'::jsonb,
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists anonymous_career_drafts_claimed_idx
  on public.anonymous_career_drafts (claimed_by_user_id, created_at desc);

create index if not exists anonymous_career_drafts_expires_idx
  on public.anonymous_career_drafts (expires_at);

drop trigger if exists anonymous_career_drafts_set_updated_at on public.anonymous_career_drafts;
create trigger anonymous_career_drafts_set_updated_at
  before update on public.anonymous_career_drafts
  for each row
  execute function public.set_updated_at();

alter table public.anonymous_career_drafts enable row level security;

drop policy if exists "No direct client access to anonymous career drafts" on public.anonymous_career_drafts;
create policy "No direct client access to anonymous career drafts"
  on public.anonymous_career_drafts
  for all
  using (false)
  with check (false);

alter table public.talent_profiles
  add column if not exists source_draft_token text;

alter table public.user_context_profiles
  add column if not exists source_draft_token text;
