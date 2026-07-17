create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  event_name text not null,
  page text,
  step text,
  status text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name);

create index if not exists analytics_events_step_idx
  on public.analytics_events (step);

create index if not exists analytics_events_page_idx
  on public.analytics_events (page);

alter table public.analytics_events enable row level security;

drop policy if exists "Clients cannot read analytics events directly" on public.analytics_events;
create policy "Clients cannot read analytics events directly"
  on public.analytics_events
  for select
  using (false);

drop policy if exists "Clients cannot insert analytics events directly" on public.analytics_events;
create policy "Clients cannot insert analytics events directly"
  on public.analytics_events
  for insert
  with check (false);

alter table public.user_profiles
  add column if not exists terms_accepted boolean not null default false,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_commitment_version text,
  add column if not exists data_training_consent boolean not null default false,
  add column if not exists data_training_consent_at timestamptz;
