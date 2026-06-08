alter table public.user_coach_preferences
  add column if not exists show_user_avatar boolean not null default false,
  add column if not exists show_user_display_name boolean not null default false,
  add column if not exists show_coach_avatar boolean not null default false;
