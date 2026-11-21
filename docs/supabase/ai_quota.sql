-- AI 助教每日配额（Supabase SQL Editor 执行一次）
-- 设计：每个 Supabase 用户每天最多 10 次，服务端用 service_role 调用原子 RPC。
-- 日期按 Asia/Shanghai 的自然日计算；客户端无法直接读写这张表。

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default ((now() at time zone 'Asia/Shanghai')::date),
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.ai_usage enable row level security;

-- 不创建任何 RLS policy：anon/authenticated 一律不可见。
-- service_role 会绕过 RLS，但仍需表权限。
revoke all on table public.ai_usage from anon, authenticated;
grant select, insert, update, delete on table public.ai_usage to service_role;

create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_limit integer default 10
)
returns table (allowed boolean, used integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(coalesce(p_limit, 10), 0);
  v_date date := (now() at time zone 'Asia/Shanghai')::date;
  v_used integer;
begin
  if p_user_id is null or v_limit <= 0 then
    return query select false, 0, 0;
    return;
  end if;

  insert into public.ai_usage as u (user_id, usage_date, used, updated_at)
  values (p_user_id, v_date, 1, now())
  on conflict (user_id, usage_date) do update
    set used = u.used + 1,
        updated_at = now()
    where u.used < v_limit
  returning u.used into v_used;

  if v_used is null then
    select au.used
      into v_used
      from public.ai_usage au
     where au.user_id = p_user_id
       and au.usage_date = v_date;
    return query select false, coalesce(v_used, v_limit), 0;
  end if;

  return query select true, v_used, greatest(v_limit - v_used, 0);
end;
$$;

-- 只允许服务器端的 service_role 调用；不要让浏览器直接调用此 RPC。
revoke all on function public.consume_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer) to service_role;

-- 自检（把 UUID 换成 auth.users 里真实存在的用户 id）：
-- select * from public.consume_ai_quota('00000000-0000-0000-0000-000000000000', 10);
--
-- 查看今日用量：
-- select * from public.ai_usage order by usage_date desc, used desc;
