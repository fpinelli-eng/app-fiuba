-- Fewer writes and fewer reads for the free plan of Supabase (0.5 GB of RAM: on 2026-11-19 it ran
-- out of memory and production was down ~40 minutes until a restart).
--
-- * touch_last_seen() goes back to what 20261113140000_last_seen.sql did: profiles.last_seen_at is
--   updated at most once per hour per student, and nothing else. The app also calls it at most once
--   per hour (a short-lived cookie in the proxy), so most page views no longer touch the database.
-- * usage_slots (one row per student and 5-minute slot, 20261118150000_admin_uso.sql) is dropped,
--   with its cleanup: Administración no longer shows "en línea ahora", peaks or hourly/daily charts.
-- * admin_uso() is rewritten without usage_slots, and Administración → Usuarios and Uso are one page
--   now, so it also returns the list of students (what admin_users() returns, without the last use)
--   and the review authors total: one call per page load instead of three.
--   admin_users() and admin_review_authors() stay as they are, for old deployments.

create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set last_seen_at = now()
  where id = auth.uid()
    and (last_seen_at is null or last_seen_at < now() - interval '1 hour');
$$;

revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

drop table public.usage_slots;

create or replace function public.admin_uso()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
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
    select c.short_name as name, count(pe.id)::int as users, false as no_plan, c.sort
    from public.careers c
    left join public.plans pl on pl.career_id = c.id
    left join people pe on pe.plan_id = pl.id
    group by c.id, c.short_name, c.sort
    union all
    select 'Sin plan', count(*)::int, true, 32767
    from people pe
    where pe.plan_id is null
    having count(*) > 0
  )
  select jsonb_build_object(
    'checked_at', v_now,
    'users', (select count(*) from people),
    'active_24h', (select count(*) from people where seen_at >= v_now - interval '24 hours'),
    'active_7d', (select count(*) from people where seen_at >= v_now - interval '7 days'),
    'active_30d', (select count(*) from people where seen_at >= v_now - interval '30 days'),
    'by_career', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'users', users, 'no_plan', no_plan)
        order by no_plan, users desc, sort, name)
      from careers
    ), '[]'::jsonb),
    'db_bytes', pg_database_size(current_database()),
    'db_limit_bytes', 500 * 1024 * 1024,
    -- How many students have at least one visible review: a total, never per student.
    'review_authors', (
      select count(distinct ra.author_id)
      from public.review_authors ra
      join public.reviews r on r.id = ra.review_id
      where r.hidden_at is null
    ),
    -- The students, newest first. No last use and no reviews per student (reviews stay anonymous).
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
          'signup_source', pe.signup_source
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
