-- Health monitor: the Apps Script of the reminders sheet (tools/reminders/apps-script/Salud.gs)
-- asks salud() every hour whether the app's background jobs are running and mails the admins when
-- something breaks; Administración → Estado (admin_salud()) shows the same. No GitHub Actions.
--
-- * Only aggregates and timestamps: no mails, names, ids or review text.
-- * salud(p_token) is for the script: role anon with the same token as avisos_pendientes()
--   (avisos_check_token()). Each call records when the monitor last ran (monitor_state), so the
--   admin page can tell when the monitor itself stopped.
-- * admin_salud() is the same for admins (is_admin()), without the token, and writes nothing.
--
-- When the SIU exam sync last ran: exam_imports.published_at only changes when a plan's dates
-- changed (tools/exams/apply.sql receives only those plans), so on quiet days it goes stale.
-- checked_at is new: the last time the sync (tools/exams/sync.mjs) read the plan from the SIU,
-- changed or not. A plan published by hand gets now() too.

alter table public.exam_imports add column checked_at timestamptz;
update public.exam_imports set checked_at = published_at;
alter table public.exam_imports alter column checked_at set default now();
alter table public.exam_imports alter column checked_at set not null;

create table public.monitor_state (
  id boolean primary key default true check (id),
  last_health_check_at timestamptz not null
);

alter table public.monitor_state enable row level security;
-- No grants and no policies: only the database owner (and the security definer functions) read it.

-- The figures, shared by salud() and admin_salud(). Not callable from the API.
create function public.salud_datos()
returns table (
  checked_at timestamptz,               -- now
  exam_sync_at timestamptz,             -- last time any plan was read from the SIU
  exam_oldest_plan_sync_at timestamptz, -- the plan with exams read longest ago
  news_fetched_at timestamptz,          -- last copy of the FIUBA news
  reminders_due bigint,                 -- "Recordarme" mails due now and not sent
  reminders_due_since timestamptz,      -- since when the oldest of them is due
  offers_pending bigint,                -- offers sent by students, waiting for an admin
  last_seen_at timestamptz,             -- last time anyone used the app
  users bigint,
  reviews bigint,
  monitor_checked_at timestamptz        -- last salud() call from the script
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamp := (now() at time zone 'America/Argentina/Buenos_Aires');
begin
  return query
  with current_tables as (
    -- The same reading as avisos_pendientes() (20261114130000_avisos_un_mail.sql).
    select t.plan_id, t.siu_subject_code, t.name, t.kind, t.exam_date,
           min(t.enroll_from) as enroll_from, max(t.enroll_to) as enroll_to
    from public.exam_tables t
    group by t.plan_id, t.siu_subject_code, t.name, t.kind, t.exam_date
  ),
  due as (
    -- From when each due mail had to go out: the opening, never before 08:00 of that day.
    select greatest(t.enroll_from, t.enroll_from::date + time '08:00') as since
    from public.exam_reminders r
    join public.profiles p on p.id = r.user_id and p.plan_id = r.plan_id
    join auth.users u on u.id = r.user_id
    join current_tables t
      on t.plan_id = r.plan_id and t.siu_subject_code = r.siu_subject_code and t.name = r.table_name
     and t.kind = r.kind and t.exam_date = r.exam_date
    where u.email ~* '^[^\s@<>",]+@fi\.uba\.ar$'
      and r.exam_date >= v_now::date
      and public.avisos_debido(v_now, (r.created_at at time zone 'America/Argentina/Buenos_Aires'),
            t.enroll_from, t.enroll_to, coalesce(r.first_sent_at, r.last_sent_at) is not null)
  )
  select
    now(),
    (select max(greatest(i.published_at, i.checked_at)) from public.exam_imports i),
    (select min(greatest(i.published_at, i.checked_at)) from public.exam_imports i
      where exists (select 1 from public.exam_tables t where t.plan_id = i.plan_id)),
    (select max(n.fetched_at) from public.fiuba_news n),
    (select count(*) from due),
    (select min(d.since) at time zone 'America/Argentina/Buenos_Aires' from due d),
    (select count(*) from public.offer_submissions s where s.status = 'pending'),
    (select max(p.last_seen_at) from public.profiles p),
    (select count(*) from public.profiles),
    (select count(*) from public.reviews r where r.hidden_at is null),
    (select m.last_health_check_at from public.monitor_state m);
end;
$$;

-- For the Apps Script (role anon, with its token). Records the monitor heartbeat first, so
-- monitor_checked_at is this call.
create function public.salud(p_token text)
returns table (
  checked_at timestamptz,
  exam_sync_at timestamptz,
  exam_oldest_plan_sync_at timestamptz,
  news_fetched_at timestamptz,
  reminders_due bigint,
  reminders_due_since timestamptz,
  offers_pending bigint,
  last_seen_at timestamptz,
  users bigint,
  reviews bigint,
  monitor_checked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.avisos_check_token(p_token);
  insert into public.monitor_state (id, last_health_check_at) values (true, now())
  on conflict (id) do update set last_health_check_at = excluded.last_health_check_at;
  return query select * from public.salud_datos();
end;
$$;

-- For Administración → Estado. Writes nothing.
create function public.admin_salud()
returns table (
  checked_at timestamptz,
  exam_sync_at timestamptz,
  exam_oldest_plan_sync_at timestamptz,
  news_fetched_at timestamptz,
  reminders_due bigint,
  reminders_due_since timestamptz,
  offers_pending bigint,
  last_seen_at timestamptz,
  users bigint,
  reviews bigint,
  monitor_checked_at timestamptz
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
  return query select * from public.salud_datos();
end;
$$;

revoke all on public.monitor_state from public, anon, authenticated;
revoke execute on function public.salud_datos() from public, anon, authenticated;
revoke execute on function public.salud(text) from public, anon, authenticated;
revoke execute on function public.admin_salud() from public, anon, authenticated;
grant execute on function public.salud(text) to anon;
grant execute on function public.admin_salud() to authenticated;
