-- Two ways to reach students without mail limits, ONLY FOR ADMINS while Tomás and Francisco try them:
--
-- * announcements: a short aviso written in Administración → Notificaciones. It shows as a
--   card on Inicio (the viewer closes it once; that is kept in a cookie, not here). Optional career
--   (null = everyone) and optional end (null = until it is deleted).
-- * push_subscriptions: the browsers that turned on web push notifications (Perfil). A user only
--   sees and deletes their own rows, and saves them only through save_push_subscription(). The app
--   sends from the server: admin_push_targets() gives the endpoints to an admin session and the
--   server action of Administración is the only caller; no screen reads them.
--
-- To open both to every student later (a new migration):
--   * "Admins read announcements" → using ((select public.is_member())).
--   * save_push_subscription(): public.is_admin() → public.is_member().
--   * In the app, OPEN_TO_EVERYONE in src/lib/broadcast/model.ts.

-- Announcements ------------------------------------------------------------------------------

create table public.announcements (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 280),
  url text check (url is null or (char_length(url) <= 500 and (url like 'https://%' or (url like '/%' and url not like '//%')))),
  career_id text references public.careers (id) on update cascade on delete set null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (ends_at is null or ends_at > created_at)
);

create index announcements_created_idx on public.announcements (created_at desc);

alter table public.announcements enable row level security;

grant select on public.announcements to authenticated;
grant insert (title, body, url, career_id, ends_at) on public.announcements to authenticated;
grant delete on public.announcements to authenticated;

create policy "Admins read announcements" on public.announcements
  for select to authenticated using ((select public.is_admin()));
create policy "Admins insert" on public.announcements
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins delete" on public.announcements
  for delete to authenticated using ((select public.is_admin()));

-- Push subscriptions -------------------------------------------------------------------------

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Only reading and deleting your own rows; saving goes through save_push_subscription().
grant select (id, endpoint, created_at), delete on public.push_subscriptions to authenticated;

create policy "Users read their subscriptions" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users delete their subscriptions" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Saves this browser for the caller. A browser has one endpoint: if another account had it (a shared
-- computer), it moves to the caller, so a notification never reaches the previous account there.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
  set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;

-- For the server action "Mandar notificación": the subscriptions of everyone, or of one career.
create function public.admin_push_targets(p_career text)
returns table (endpoint text, p256dh text, auth text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select s.endpoint, s.p256dh, s.auth
    from public.push_subscriptions s
    join public.profiles p on p.id = s.user_id
    left join public.plans pl on pl.id = p.plan_id
    where p_career is null or pl.career_id = p_career;
end;
$$;

-- How many browsers each career has (Administración shows who a notification reaches). No endpoints.
create function public.admin_push_counts()
returns table (career_id text, devices bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select pl.career_id, count(*)
    from public.push_subscriptions s
    join public.profiles p on p.id = s.user_id
    left join public.plans pl on pl.id = p.plan_id
    group by pl.career_id;
end;
$$;

-- The push service answered 404 or 410: that browser turned notifications off or no longer exists.
create function public.admin_remove_push_subscriptions(p_endpoints text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = any (p_endpoints);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text) from public;
revoke execute on function public.admin_push_targets(text) from public;
revoke execute on function public.admin_push_counts() from public;
revoke execute on function public.admin_remove_push_subscriptions(text[]) from public;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.admin_push_targets(text) to authenticated;
grant execute on function public.admin_push_counts() to authenticated;
grant execute on function public.admin_remove_push_subscriptions(text[]) to authenticated;
