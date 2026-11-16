-- Reviews stay anonymous, also for admins (rule 2).
--
-- 1. Administración → Usuarios no longer shows how many reviews each student wrote. Watching that
--    number go from 2 to 3 while a new review appears in Administración → Reseñas told who wrote it.
--    Admins get a single total instead: admin_review_authors(), how many students have at least one
--    visible review.
-- 2. reviews.created_at and reviews.updated_at keep only the day (Buenos Aires midnight). Any member
--    can read those columns; the exact second, crossed with when someone was using the app, pointed
--    to the author. The app only uses them to sort, so nothing visible changes. A trigger coarsens
--    every insert and update (also from submit_review() and review_course()); it is named so it runs
--    after reviews_set_updated_at (same timing: alphabetical order).
-- 3. admin_users() gives "Último uso" by day too: the screen already shows "hoy", "ayer"…, and the
--    hour helped the same crossing.

-- 2. Existing rows first, without reviews_set_updated_at (it would stamp every row with today).
alter table public.reviews disable trigger reviews_set_updated_at;
update public.reviews
set created_at = date_trunc('day', created_at, 'America/Argentina/Buenos_Aires'),
    updated_at = date_trunc('day', updated_at, 'America/Argentina/Buenos_Aires');
alter table public.reviews enable trigger reviews_set_updated_at;

create function public.reviews_coarse_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := date_trunc('day', new.created_at, 'America/Argentina/Buenos_Aires');
  new.updated_at := date_trunc('day', new.updated_at, 'America/Argentina/Buenos_Aires');
  return new;
end;
$$;

revoke execute on function public.reviews_coarse_dates() from public;

create trigger reviews_truncate_dates
  before insert or update on public.reviews
  for each row execute function public.reviews_coarse_dates();

-- 1 and 3. The return type changes, so the function is dropped and created again.
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
  last_seen_at timestamptz,
  signup_source text
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
    date_trunc('day', coalesce(p.last_seen_at, u.last_sign_in_at), 'America/Argentina/Buenos_Aires'),
    p.signup_source
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;

-- How many students have at least one visible review: a total, never per student.
create function public.admin_review_authors()
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins' using errcode = '42501';
  end if;
  return (
    select count(distinct ra.author_id)
    from public.review_authors ra
    join public.reviews r on r.id = ra.review_id
    where r.hidden_at is null
  );
end;
$$;

revoke execute on function public.admin_review_authors() from public;
grant execute on function public.admin_review_authors() to authenticated;
