-- Administración → Usuarios shows again when each student last used the app, with the exact date and
-- time. Each entry of people brings last_seen = coalesce(profiles.last_seen_at, auth.users.last_sign_in_at),
-- the same value the active counts already use (seen_at). last_seen_at is still written at most once
-- per hour (touch_last_seen, throttled by the fiubi_seen cookie), so this adds no writes and no new
-- reads: one more field over the same rows, still one call. Same signature; code that doesn't know
-- the field ignores it.

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
