-- Administración → Usuarios shows again how many people used the app in each hour (last 24 hours) and
-- the busiest hour of each of the last 14 days, without going back to the write load of usage_slots
-- (one row per student and 5-minute slot, dropped in 20261119180000_menos_escrituras.sql).
--
-- * usage_hours keeps one tiny row per hour (Buenos Aires): how many students touch_last_seen() recorded
--   in that hour. Nobody reads or writes it through the API (RLS on, no grants): only touch_last_seen()
--   and admin_uso(), both security definer.
-- * touch_last_seen() still writes profiles.last_seen_at at most once per hour per student (and the app
--   calls it at most once per hour, fiubi_seen cookie in the proxy). Only when that update actually
--   wrote does it add one upsert to the current hour. So the extra cost is at most one small upsert per
--   active student per hour, never per page view. Rows older than 15 days are deleted only when a new
--   hour row is created (at most once per hour), through the primary key.
-- * It's approximate: a student active across two clock hours may count only in the hour of their first
--   visit, because last_seen_at is written at most once per hour.
-- * admin_uso() (same signature, still one call) adds by_hour: the last 24 hours, oldest first, and the
--   last 14 days (Buenos Aires) with the busiest hour (peak) and the sum of the hours (total).
--   Code that doesn't know the field ignores it.

create table public.usage_hours (
  hour timestamptz primary key,
  users integer not null default 0
);

alter table public.usage_hours enable row level security;
revoke all on public.usage_hours from public, anon, authenticated;

create or replace function public.touch_last_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hour timestamptz := date_trunc('hour', now(), 'America/Argentina/Buenos_Aires');
  v_new_hour boolean;
begin
  update public.profiles
  set last_seen_at = now()
  where id = auth.uid()
    and (last_seen_at is null or last_seen_at < now() - interval '1 hour');
  if not found then
    return;
  end if;

  insert into public.usage_hours as h (hour, users)
  values (v_hour, 1)
  on conflict (hour) do update set users = h.users + 1
  returning (xmax = 0) into v_new_hour;

  -- A new hour row (xmax = 0: inserted, not updated): drop the ones older than 15 days.
  if v_new_hour then
    delete from public.usage_hours where hour < v_hour - interval '15 days';
  end if;
end;
$$;

revoke execute on function public.touch_last_seen() from public, anon, authenticated;
grant execute on function public.touch_last_seen() to authenticated;

create or replace function public.admin_uso()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_hour timestamptz := date_trunc('hour', now(), 'America/Argentina/Buenos_Aires');
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'only admins' using errcode = '42501';
  end if;

  with
  people as (
    select
      p.id,
      p.plan_id,
      p.created_at,
      p.intro_seen_at is not null as intro_seen,
      p.signup_source,
      coalesce(p.last_seen_at, u.last_sign_in_at) as seen_at,
      coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '') as full_name,
      u.email::text as email
    from public.profiles p
    join auth.users u on u.id = p.id
  ),
  approved as (
    select s.user_id, count(*)::int as n
    from public.user_subjects s
    where s.status = 'approved'
    group by s.user_id
  ),
  chosen as (
    select c.user_id, count(*)::int as n
    from public.plan_choices c
    group by c.user_id
  ),
  careers as (
    select
      c.id,
      c.short_name as name,
      count(pe.id)::int as users,
      (count(pe.id) filter (where pe.seen_at >= v_now - interval '7 days'))::int as active_7d,
      false as no_plan,
      c.sort
    from public.careers c
    left join public.plans pl on pl.career_id = c.id
    left join people pe on pe.plan_id = pl.id
    group by c.id, c.short_name, c.sort
    union all
    select
      null,
      'Sin plan',
      count(*)::int,
      (count(*) filter (where pe.seen_at >= v_now - interval '7 days'))::int,
      true,
      32767
    from people pe
    where pe.plan_id is null
    having count(*) > 0
  ),
  -- At most 15 days × 24 rows, read through the primary key.
  hours as (
    select uh.hour, uh.users, (uh.hour at time zone 'America/Argentina/Buenos_Aires')::date as day
    from public.usage_hours uh
    where uh.hour >= v_hour - interval '14 days'
  )
  select jsonb_build_object(
    'checked_at', v_now,
    'users', (select count(*) from people),
    'active_24h', (select count(*) from people where seen_at >= v_now - interval '24 hours'),
    'active_7d', (select count(*) from people where seen_at >= v_now - interval '7 days'),
    'active_30d', (select count(*) from people where seen_at >= v_now - interval '30 days'),
    'by_career', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', id, 'name', name, 'users', users, 'active_7d', active_7d, 'no_plan', no_plan)
        order by no_plan, users desc, sort, name)
      from careers
    ), '[]'::jsonb),
    'db_bytes', pg_database_size(current_database()),
    'db_limit_bytes', 500 * 1024 * 1024,
    -- How many students have at least one visible review: a total, never per student or per career.
    'review_authors', (
      select count(distinct ra.author_id)
      from public.review_authors ra
      join public.reviews r on r.id = ra.review_id
      where r.hidden_at is null
    ),
    -- People who came in each hour (approximate, see above): the last 24 hours and the last 14 days.
    'by_hour', jsonb_build_object(
      'hours', (
        select jsonb_agg(jsonb_build_object('hour', g.hour, 'users', coalesce(h.users, 0)) order by g.hour)
        from generate_series(v_hour - interval '23 hours', v_hour, interval '1 hour') as g(hour)
        left join hours h on h.hour = g.hour
      ),
      'days', (
        select jsonb_agg(jsonb_build_object('day', d.day, 'peak', coalesce(x.peak, 0), 'total', coalesce(x.total, 0)) order by d.day)
        from (select (v_today - n) as day from generate_series(0, 13) as n) d
        left join (select day, max(users) as peak, sum(users) as total from hours group by day) x on x.day = d.day
      )
    ),
    -- The students, newest first, with their last use. No reviews per student (reviews stay anonymous).
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
          'full_name', pe.full_name,
          'email', pe.email,
          'plan_id', pe.plan_id,
          'plan', case when pl.id is null then null else c.short_name || ' ' || pl.year end,
          'created_at', pe.created_at,
          'intro_seen', pe.intro_seen,
          'subjects', coalesce(a.n, 0),
          'plan_courses', coalesce(ch.n, 0),
          'signup_source', pe.signup_source,
          'last_seen', pe.seen_at
        ) order by pe.created_at desc)
      from people pe
      left join public.plans pl on pl.id = pe.plan_id
      left join public.careers c on c.id = pl.career_id
      left join approved a on a.user_id = pe.id
      left join chosen ch on ch.user_id = pe.id
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_uso() from public, anon, authenticated;
grant execute on function public.admin_uso() to authenticated;
