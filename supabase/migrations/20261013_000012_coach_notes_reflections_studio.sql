-- 教练笔记 + 反思报告 + 督导对话
-- 三张表全部带 coach_type 字段，支持天赋教练(talent)与行动教练(action)各自独立生成笔记/反思
-- 同一对话可各自生成笔记，互不干扰；行动教练触发条件后期再设
-- RLS：仅 service role 读写（管理员后台 / 服务端 API），普通用户不能直接访问

-- 1. coach_notes：单次对话结束后生成的教练视角笔记
create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  coach_type text not null default 'talent' check (coach_type in ('talent','action')),
  note_json jsonb not null default '{}'::jsonb,
  report_summary jsonb,
  created_at timestamptz not null default now()
);

-- 兼容旧版（若之前执行过无 coach_type / report_summary 的版本）
alter table public.coach_notes add column if not exists coach_type text not null default 'talent';
alter table public.coach_notes add column if not exists report_summary jsonb;

-- 同一对话同一 coach_type 只能有一条笔记（防止重复生成）
create unique index if not exists coach_notes_conv_coach_uq
  on public.coach_notes (conversation_id, coach_type);

create index if not exists coach_notes_user_created_idx
  on public.coach_notes (user_id, created_at desc);

create index if not exists coach_notes_coach_type_created_idx
  on public.coach_notes (coach_type, created_at desc);

alter table public.coach_notes enable row level security;
-- 不创建任何 policy：service role 越过 RLS 读写，普通用户禁止直接访问


-- 2. coach_reflections：督导工作室周期性反思报告（教练作为 agent 反思所有对话）
create table if not exists public.coach_reflections (
  id uuid primary key default gen_random_uuid(),
  coach_type text not null default 'talent' check (coach_type in ('talent','action')),
  reflection_json jsonb not null default '{}'::jsonb,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now()
);

alter table public.coach_reflections add column if not exists coach_type text not null default 'talent';

create index if not exists coach_reflections_coach_type_created_idx
  on public.coach_reflections (coach_type, created_at desc);

alter table public.coach_reflections enable row level security;


-- 3. coach_studio_messages：管理员与 AI 教练在督导工作室的对话
create table if not exists public.coach_studio_messages (
  id uuid primary key default gen_random_uuid(),
  coach_type text not null default 'talent' check (coach_type in ('talent','action')),
  role text not null check (role in ('admin','coach')),
  content text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.coach_studio_messages add column if not exists coach_type text not null default 'talent';

create index if not exists coach_studio_messages_coach_type_created_idx
  on public.coach_studio_messages (coach_type, created_at desc);

alter table public.coach_studio_messages enable row level security;
