-- Administración → Usuarios: when each student last used the app ("Último uso").
-- profiles.last_seen_at is updated by touch_last_seen(), called from the app layout, at most once per
-- hour per student (so it costs nothing). Before the first visit with this version, the last Google
-- sign-in (auth.users.last_sign_in_at) is used.

alter table public.profiles add column last_seen_at timestamptz;

create function public.touch_last_seen()
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

revoke execute on function public.touch_last_seen() from public;
grant execute on function public.touch_last_seen() to authenticated;

drop function public.admin_users();

create function public.admin_users()
returns table (
  full_name text,
  email text,
  plan_id text,
  created_at timestamptz,
  intro_seen boolean,
  subjects bigint,
  plan_courses bigint,
  reviews bigint,
  last_seen_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins' using errcode = '42501';
  end if;
  return query
  select
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')::text,
    u.email::text,
    p.plan_id,
    p.created_at,
    p.intro_seen_at is not null,
    (select count(*) from public.user_subjects s where s.user_id = p.id and s.status = 'approved'),
    (select count(*) from public.plan_choices c where c.user_id = p.id),
    (select count(*) from public.review_authors ra join public.reviews r on r.id = ra.review_id
      where ra.author_id = p.id and r.hidden_at is null),
    coalesce(p.last_seen_at, u.last_sign_in_at)
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;
