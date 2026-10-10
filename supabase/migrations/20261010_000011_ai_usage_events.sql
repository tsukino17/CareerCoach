-- AI 用量事件表：记录每次模型调用的 token 消耗，用于按用量计费与个人中心展示
-- user_id 为空表示匿名调用（按 IP 记账，供未来免费额度扣减）

create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  anonymous_ip text,
  route text not null,
  model text not null,
  provider text not null default 'tokendance',
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);
create index if not exists ai_usage_events_anon_ip_created_idx
  on public.ai_usage_events (anonymous_ip, created_at desc);

alter table public.ai_usage_events enable row level security;

-- 服务端全部通过 service role 读写，不开放任何客户端策略；
-- RLS 开启且无策略 = 普通客户端（anon key）无法读写，防止用量数据被篡改。
