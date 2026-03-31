create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.identity_vision_boards
  add column if not exists schema_version int not null default 1,
  add column if not exists image_url text,
  add column if not exists render_meta jsonb not null default '{}'::jsonb;

alter table public.user_context_profiles
  add column if not exists vision_board_id uuid references public.identity_vision_boards(id) on delete set null;

create table if not exists public.identity_vision_board_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vision_board_id uuid not null references public.identity_vision_boards(id) on delete cascade,
  asset_kind text not null default 'share_image',
  storage_bucket text not null default 'vision-board',
  storage_path text not null,
  mime_type text,
  width int,
  height int,
  bytes int,
  hash_sha256 text,
  public_url text,
  created_at timestamptz not null default now()
);

create index if not exists identity_vision_board_assets_user_created_idx
  on public.identity_vision_board_assets (user_id, created_at desc);

create index if not exists identity_vision_board_assets_board_idx
  on public.identity_vision_board_assets (vision_board_id, created_at desc);

alter table public.identity_vision_board_assets enable row level security;

create policy "Users can view their vision board assets"
  on public.identity_vision_board_assets
  for select
  using (user_id = auth.uid());

create policy "Users can insert their vision board assets"
  on public.identity_vision_board_assets
  for insert
  with check (user_id = auth.uid());

create policy "Users can update their vision board assets"
  on public.identity_vision_board_assets
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their vision board assets"
  on public.identity_vision_board_assets
  for delete
  using (user_id = auth.uid());
