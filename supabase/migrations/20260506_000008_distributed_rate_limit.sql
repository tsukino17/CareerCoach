create table if not exists public.rate_limit_counters (
  key text primary key,
  count integer not null default 0,
  reset_at bigint not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer
)
returns table(allowed boolean, remaining integer, reset_at bigint)
language plpgsql
as $$
declare
  now_ms bigint;
  current_count integer;
  current_reset bigint;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    return query select true, p_limit - 1, (extract(epoch from clock_timestamp()) * 1000)::bigint + p_window_ms;
    return;
  end if;

  now_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  insert into public.rate_limit_counters(key, count, reset_at, updated_at)
  values (p_key, 1, now_ms + p_window_ms, now())
  on conflict (key) do nothing;

  select c.count, c.reset_at
    into current_count, current_reset
  from public.rate_limit_counters c
  where c.key = p_key
  for update;

  if current_reset <= now_ms then
    update public.rate_limit_counters
    set count = 1,
        reset_at = now_ms + p_window_ms,
        updated_at = now()
    where key = p_key;

    return query select true, greatest(p_limit - 1, 0), now_ms + p_window_ms;
    return;
  end if;

  if current_count >= p_limit then
    return query select false, 0, current_reset;
    return;
  end if;

  update public.rate_limit_counters
  set count = count + 1,
      updated_at = now()
  where key = p_key;

  return query select true, greatest(p_limit - current_count - 1, 0), current_reset;
end;
$$;

grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
