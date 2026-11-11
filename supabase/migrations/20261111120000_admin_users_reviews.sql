-- Administración → Usuarios: how many reviews each student wrote (only the number, not which
-- courses, stars or comments, so reviews stay anonymous). Hidden reviews do not count.
-- The return type changes, so the function is dropped and created again.

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
  reviews bigint
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
      where ra.author_id = p.id and r.hidden_at is null)
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;
