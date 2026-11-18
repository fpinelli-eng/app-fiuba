-- Administración → Uso: how the app is used (online now, concurrency, users by career) and how
-- big the database is. Everything is computed when the page loads (admin_uso()): no cron, no
-- GitHub Actions, no Vercel jobs.
--
-- * touch_last_seen() (20261113140000_last_seen.sql), called from the app layout on every page,
--   now updates profiles.last_seen_at when it is older than 5 minutes (was 1 hour) and records one
--   row per student and 5-minute slot in usage_slots. Peak concurrency = the most distinct
--   students in one slot. Slots older than 35 days are deleted when a new slot is written.
-- * usage_slots has no grants and no policies: only the security definer functions use it.
-- * admin_uso() returns only counts, dates and table names: no mails, names or ids.

create table public.usage_slots (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot timestamptz not null,
  primary key (user_id, slot)
);

create index usage_slots_slot_idx on public.usage_slots (slot);

alter table public.usage_slots enable row level security;
revoke all on public.usage_slots from public, anon, authenticated;

create or replace function public.touch_last_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_new integer;
begin
  if v_user is null then
    return;
  end if;

  update public.profiles
  set last_seen_at = now()
  where id = v_user
    and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');

  insert into public.usage_slots (user_id, slot)
  select v_user, date_bin(interval '5 minutes', now(), timestamptz '2000-01-01 00:00+00')
  where exists (select 1 from public.profiles where id = v_user)
  on conflict do nothing;
  get diagnostics v_new = row_count;

  -- Only when this visit opened a new slot (at most once per student every 5 minutes); the index
  -- on slot keeps it cheap.
  if v_new > 0 then
    delete from public.usage_slots where slot < now() - interval '35 days';
  end if;
end;
$$;

create function public.admin_uso()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz constant text := 'America/Argentina/Buenos_Aires';
  v_now timestamptz := now();
  -- Start of today and of the current hour, Buenos Aires time.
  v_today timestamptz := date_trunc('day', v_now at time zone v_tz) at time zone v_tz;
  v_hour timestamp := date_trunc('hour', v_now at time zone v_tz);
  v_slot timestamptz := date_bin(interval '5 minutes', v_now, timestamptz '2000-01-01 00:00+00');
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'only admins' using errcode = '42501';
  end if;

  with
  seen as (
    select coalesce(p.last_seen_at, u.last_sign_in_at) as seen_at
    from public.profiles p
    join auth.users u on u.id = p.id
  ),
  per_slot as (
    select s.slot, count(*)::int as users
    from public.usage_slots s
    where s.slot >= v_now - interval '14 days'
    group by s.slot
  ),
  peak_today as (
    select ps.users, ps.slot from per_slot ps where ps.slot >= v_today
    order by ps.users desc, ps.slot desc limit 1
  ),
  peak_week as (
    select ps.users, ps.slot from per_slot ps where ps.slot >= v_now - interval '7 days'
    order by ps.users desc, ps.slot desc limit 1
  ),
  hours as (
    select h, coalesce(max(ps.users), 0) as users
    from generate_series(v_hour - interval '23 hours', v_hour, interval '1 hour') as h
    left join per_slot ps on date_trunc('hour', ps.slot at time zone v_tz) = h
    group by h
  ),
  days as (
    select d::date as d, (
      select count(distinct s.user_id)::int
      from public.usage_slots s
      where s.slot >= (d at time zone v_tz) and s.slot < ((d + interval '1 day') at time zone v_tz)
    ) as users
    from generate_series((v_hour::date - 13)::timestamp, v_hour::date::timestamp, interval '1 day') as d
  ),
  careers as (
    select c.short_name as name, count(p.id)::int as users, false as no_plan, c.sort
    from public.careers c
    left join public.plans pl on pl.career_id = c.id
    left join public.profiles p on p.plan_id = pl.id
    group by c.id, c.short_name, c.sort
    union all
    select 'Sin plan', count(*)::int, true, 32767
    from public.profiles p
    where p.plan_id is null
    having count(*) > 0
  ),
  tables as (
    select c.relname::text as name, pg_total_relation_size(c.oid) as bytes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
    order by 2 desc, 1
    limit 5
  )
  select jsonb_build_object(
    'checked_at', v_now,
    'online_now', (
      select count(distinct x.id) from (
        select p.id from public.profiles p where p.last_seen_at >= v_now - interval '5 minutes'
        union
        select s.user_id from public.usage_slots s where s.slot >= v_slot - interval '5 minutes'
      ) x
    ),
    'active_24h', (select count(*) from seen where seen_at >= v_now - interval '24 hours'),
    'active_7d', (select count(*) from seen where seen_at >= v_now - interval '7 days'),
    'active_30d', (select count(*) from seen where seen_at >= v_now - interval '30 days'),
    'users', (select count(*) from seen),
    'by_career', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'users', users, 'no_plan', no_plan)
        order by no_plan, users desc, sort, name)
      from careers
    ), '[]'::jsonb),
    'peak_today', (select jsonb_build_object('users', users, 'at', slot) from peak_today),
    'peak_7d', (select jsonb_build_object('users', users, 'at', slot) from peak_week),
    'hourly', (
      select jsonb_agg(jsonb_build_object('at', h at time zone v_tz, 'users', users) order by h) from hours
    ),
    'daily', (
      select jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'users', users) order by d) from days
    ),
    'db_bytes', pg_database_size(current_database()),
    'db_limit_bytes', 500 * 1024 * 1024,
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'bytes', bytes) order by bytes desc, name) from tables
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_uso() from public, anon, authenticated;
grant execute on function public.admin_uso() to authenticated;
