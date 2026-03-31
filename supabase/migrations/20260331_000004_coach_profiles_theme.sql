create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.coach_profiles (
  coach public.coach_type primary key,
  display_name text not null,
  avatar_url text,
  theme_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger coach_profiles_set_updated_at
  before update on public.coach_profiles
  for each row
  execute function public.set_updated_at();

insert into public.coach_profiles (coach, display_name, avatar_url, theme_json)
values
  (
    'talent',
    '天赋教练',
    null,
    jsonb_build_object(
      'palette', 'warm',
      'primary', '#F3A58A',
      'primary_soft', 'rgba(243, 165, 138, 0.18)',
      'bg_a', '#FFF8F5',
      'bg_b', '#FFFFFF'
    )
  ),
  (
    'action',
    '行动力教练',
    null,
    jsonb_build_object(
      'palette', 'babyblue',
      'primary', '#86B8FF',
      'primary_soft', 'rgba(134, 184, 255, 0.18)',
      'bg_a', '#F3F8FF',
      'bg_b', '#FFFFFF'
    )
  )
on conflict (coach) do update
set
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  theme_json = excluded.theme_json;

alter table public.coach_profiles enable row level security;

create policy "Everyone can read coach profiles"
  on public.coach_profiles
  for select
  using (true);
