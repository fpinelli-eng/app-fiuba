-- Administración → Usuarios: who signed up through the printed QR (https://fiubi.com.ar/?ref=qr).
-- The proxy keeps ?ref=qr in a first-party cookie (fiubi_ref, only whitelisted values) and, when the
-- profile is first created, requireAccount() calls set_my_signup_source(). Students can't write the
-- column directly (no column grant): only through the function, once, during the first 24 hours of
-- the account, and only with whitelisted values. Admins see it in admin_users().

alter table public.profiles add column signup_source text check (signup_source in ('qr'));

create function public.set_my_signup_source(p_source text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_source is null or p_source not in ('qr') then
    raise exception 'unknown signup source' using errcode = '22023';
  end if;
  -- Already set, an older account or no profile: does nothing (two first requests can arrive at once).
  update public.profiles
  set signup_source = p_source
  where id = auth.uid()
    and signup_source is null
    and created_at > now() - interval '24 hours';
end;
$$;

revoke execute on function public.set_my_signup_source(text) from public;
grant execute on function public.set_my_signup_source(text) to authenticated;

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
    (select count(*) from public.review_authors ra join public.reviews r on r.id = ra.review_id
      where ra.author_id = p.id and r.hidden_at is null),
    coalesce(p.last_seen_at, u.last_sign_in_at),
    p.signup_source
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;
