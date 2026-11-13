-- Recordarme: a confirmation mail and an optional other mail for the reminders.
--
-- The reminder mails come from avisosfiubi@gmail.com (a new outside Gmail sender for the faculty's
-- Google Workspace), so they often land in Spam. Right after a student activates their reminders,
-- the Apps Script (tools/reminders/apps-script/Code.gs) sends them one confirmation mail ("Activaste
-- tus recordatorios"), so they find it now and mark it as "No es spam" before the real reminder.
--
-- * profiles.reminder_email: where the student prefers to get the reminder mails (any domain; null:
--   their @fi.uba.ar account). Written only through set_my_reminder_email() (no column grant), which
--   trims, lowercases, checks the format and stores null when it is the account mail. Each student
--   reads only their own profile (RLS); admin_users() does not return it.
-- * reminder_confirmations: one row per confirmation mail sent (to which address, when). Only the
--   Apps Script writes it, through avisos_confirmacion_enviada(); each student reads theirs.
-- * When a confirmation is due (avisos_confirmaciones()): the student has at least one reminder of
--   their current plan with the exam still ahead, and the address the reminders go to now is not the
--   one of their last confirmation. So it is one mail per student and address: the first time they
--   activate reminders, and again only when they change the address. Removing every reminder and
--   adding them again does not send another one. Abuse limit (the address can be anyone's): at most
--   3 confirmations per student in 24 hours; the rest wait. Only accounts @fi.uba.ar, as the
--   reminders.
-- * Students who already had reminders before this migration get their confirmation in the first
--   runs (it helps them too); the script leaves quota for the reminders (CONFIRM_QUOTA_RESERVE).
--   Newest reminders first, so a student who just tapped Aceptar does not wait behind that backlog.
-- * avisos_pendientes() now mails coalesce(reminder_email, account mail). Recreated from its last
--   definition (20261114130000_avisos_un_mail.sql), changing only that.

alter table public.profiles add column reminder_email text check (
  reminder_email is null or (
    char_length(reminder_email) <= 254
    and reminder_email = lower(reminder_email)
    and char_length(split_part(reminder_email, '@', 1)) <= 64
    and reminder_email ~ '^[a-z0-9_%+-]+(\.[a-z0-9_%+-]+)*@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$'
  )
);

create table public.reminder_confirmations (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  email text not null check (char_length(email) <= 254),
  sent_at timestamptz not null default now()
);

create index reminder_confirmations_user_idx on public.reminder_confirmations (user_id, sent_at desc);

alter table public.reminder_confirmations enable row level security;
grant select on public.reminder_confirmations to authenticated;
create policy "Students read their reminder confirmations" on public.reminder_confirmations
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_member()));

-- The student's other mail for the reminders. null or '' clears it (back to the account mail).
create function public.set_my_reminder_email(p_email text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := nullif(lower(btrim(p_email)), '');
begin
  if auth.uid() is null or not public.is_member() then
    raise exception 'not a student' using errcode = '42501';
  end if;
  if v_email is not null and (
    char_length(v_email) > 254 or char_length(split_part(v_email, '@', 1)) > 64
    or v_email !~ '^[a-z0-9_%+-]+(\.[a-z0-9_%+-]+)*@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$'
  ) then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if v_email = (select lower(u.email) from auth.users u where u.id = auth.uid()) then
    v_email := null;
  end if;
  update public.profiles set reminder_email = v_email where id = auth.uid();
end;
$$;

-- Students whose confirmation mail is due, one row per address (two students could share one).
create function public.avisos_confirmaciones(p_token text)
returns table (
  email text,
  first_name text,   -- as Google gives it; the script fixes the case
  mesas integer      -- reminders of the current plan with the exam still ahead
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  perform public.avisos_check_token(p_token);
  return query
  with students as (
    select lower(coalesce(p.reminder_email, u.email::text)) as email,
           split_part(btrim(coalesce(u.raw_user_meta_data ->> 'given_name', u.raw_user_meta_data ->> 'full_name',
                                     u.raw_user_meta_data ->> 'name', '')), ' ', 1) as first_name,
           (select count(*)::integer from public.exam_reminders r
             where r.user_id = p.id and r.plan_id = p.plan_id and r.exam_date >= v_today) as mesas,
           (select c.email from public.reminder_confirmations c
             where c.user_id = p.id order by c.sent_at desc, c.id desc limit 1) as last_email,
           (select count(*) from public.reminder_confirmations c
             where c.user_id = p.id and c.sent_at > now() - interval '24 hours') as recent,
           (select max(r.created_at) from public.exam_reminders r where r.user_id = p.id) as last_reminder_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where u.email ~* '^[^\s@<>",]+@fi\.uba\.ar$'
  )
  select s.email, min(s.first_name), sum(s.mesas)::integer
  from students s
  where s.mesas > 0 and s.last_email is distinct from s.email and s.recent < 3
  group by s.email
  order by max(s.last_reminder_at) desc, s.email;
end;
$$;

-- Records that the confirmation went to p_email, for every student whose reminders go there and was
-- due. Returns how many it recorded (0: nobody, an already recorded one or a wrong address).
create function public.avisos_confirmacion_enviada(p_token text, p_email text) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_email text := lower(btrim(p_email));
  v_count integer;
begin
  perform public.avisos_check_token(p_token);
  insert into public.reminder_confirmations (user_id, email)
  select p.id, v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email ~* '^[^\s@<>",]+@fi\.uba\.ar$'
    and lower(coalesce(p.reminder_email, u.email::text)) = v_email
    and exists (select 1 from public.exam_reminders r where r.user_id = p.id and r.plan_id = p.plan_id and r.exam_date >= v_today)
    and (select c.email from public.reminder_confirmations c where c.user_id = p.id order by c.sent_at desc, c.id desc limit 1)
        is distinct from v_email
    and (select count(*) from public.reminder_confirmations c where c.user_id = p.id and c.sent_at > now() - interval '24 hours') < 3;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Same as 20261114130000_avisos_un_mail.sql; only the mail changes: the student's other mail when
-- they set one (the account must still be @fi.uba.ar).
create or replace function public.avisos_pendientes(p_token text)
returns table (
  reminder_id bigint,
  email text,
  subject_name text,
  table_name text,
  kind text,
  exam_date text,          -- 'YYYY-MM-DD'
  start_time text,         -- 'HH:MM'
  end_time text,
  enroll_from text,        -- 'YYYY-MM-DD HH:MM', Buenos Aires
  enroll_to text,
  created_at text,
  aviso text,              -- 'YYYY-MM-DD': the day the mail goes (null: it does not apply)
  sent_at text,            -- when it went out, Buenos Aires
  due boolean              -- the mail has to go now
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamp := (now() at time zone 'America/Argentina/Buenos_Aires');
begin
  perform public.avisos_check_token(p_token);

  delete from public.exam_reminders r where r.exam_date < v_now::date;

  return query
  with current_tables as (
    -- The SIU may list one key twice (it should not): the widest window wins, so no deadline is
    -- announced earlier than the real one.
    select t.plan_id, t.siu_subject_code, t.name, t.kind, t.exam_date,
           min(t.enroll_from) as enroll_from, max(t.enroll_to) as enroll_to,
           min(t.start_time) as start_time, max(t.end_time) as end_time
    from public.exam_tables t
    group by t.plan_id, t.siu_subject_code, t.name, t.kind, t.exam_date
  ),
  reminders as (
    select r.id, coalesce(p.reminder_email, u.email::text) as email, r.subject_name, r.table_name, r.kind, r.exam_date,
           (r.created_at at time zone 'America/Argentina/Buenos_Aires') as created_ba,
           coalesce(r.first_sent_at, r.last_sent_at) as sent,
           t.enroll_from, t.enroll_to, t.start_time, t.end_time
    from public.exam_reminders r
    join public.profiles p on p.id = r.user_id and p.plan_id = r.plan_id
    join auth.users u on u.id = r.user_id
    left join current_tables t
      on t.plan_id = r.plan_id and t.siu_subject_code = r.siu_subject_code and t.name = r.table_name
     and t.kind = r.kind and t.exam_date = r.exam_date
    where u.email ~* '^[^\s@<>",]+@fi\.uba\.ar$'
  )
  select x.id, x.email, x.subject_name, x.table_name, x.kind,
         to_char(x.exam_date, 'YYYY-MM-DD'),
         to_char(x.start_time, 'HH24:MI'),
         to_char(x.end_time, 'HH24:MI'),
         to_char(x.enroll_from, 'YYYY-MM-DD HH24:MI'),
         to_char(x.enroll_to, 'YYYY-MM-DD HH24:MI'),
         to_char(x.created_ba, 'YYYY-MM-DD HH24:MI'),
         case when x.enroll_from is not null and x.enroll_to is not null and x.created_ba < x.enroll_from
              then to_char(x.enroll_from, 'YYYY-MM-DD') end,
         to_char(x.sent at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD HH24:MI'),
         public.avisos_debido(v_now, x.created_ba, x.enroll_from, x.enroll_to, x.sent is not null)
  from reminders x
  order by x.exam_date, x.id;
end;
$$;

revoke all on public.reminder_confirmations from anon;
revoke execute on function public.set_my_reminder_email(text) from public, anon, authenticated;
revoke execute on function public.avisos_confirmaciones(text) from public, anon, authenticated;
revoke execute on function public.avisos_confirmacion_enviada(text, text) from public, anon, authenticated;
grant execute on function public.set_my_reminder_email(text) to authenticated;
grant execute on function public.avisos_confirmaciones(text) to anon;
grant execute on function public.avisos_confirmacion_enviada(text, text) to anon;
