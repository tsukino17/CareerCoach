drop table if exists public.identity_vision_board_assets;

alter table public.identity_vision_boards
  drop column if exists image_url,
  drop column if exists render_meta;
