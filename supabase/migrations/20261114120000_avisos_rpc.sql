-- "Recordarme" mails, sent from the project's Google account (avisosfiubi@gmail.com) by an Apps
-- Script bound to a Google Sheet (tools/reminders/apps-script/Code.gs), without GitHub Actions.
-- Every hour the script reads the reminders with avisos_pendientes(), copies them to the sheet,
-- mails the ones that are due and marks each one with avisos_marcar_enviado() right after sending.
-- The database decides what is due and keeps the sent marks: even if someone edits the sheet, a
-- mail marked here is never due again.
--
-- The script calls both functions through the API with the publishable key (role anon) and a
-- token of its own. Only the SHA-256 of the token is stored, in avisos_config, which no API role
-- can read; the token itself lives only in the script's properties. Wrong or missing token: error.
-- Set (or change) the hash from the Supabase SQL editor; the script's createToken() prints the line:
--
--   insert into public.avisos_config (id, token_sha256) values (true, '<hash>')
--   on conflict (id) do update set token_sha256 = excluded.token_sha256;
--
-- Rules (Buenos Aires time; exam_tables keeps the SIU's local times):
-- * Each reminder is re-read against the CURRENT exam_tables by its natural key (the daily SIU sync
--   replaces the rows): if the SIU moved the enrollment, the new dates apply; if the table is gone,
--   nothing is due and the reminder stays.
-- * "primer_dia": once the enrollment is open, from 08:00 of its first day. Not when the student
--   asked with the enrollment already open, nor when the SIU gives no opening date.
-- * "ultimo_dia": from 08:00 of the last day (avisos_ultimo_dia(): an enrollment that closes before
--   noon, 00:00 included, has its last day the day before) while it is still open. If the first
--   mail did not go out by then, only this one goes.
-- * Never before 08:00, never after the enrollment closed, never twice.
-- * Only reminders of the student's current plan and @fi.uba.ar mails. Reminders whose exam already
--   happened are deleted here (this used to be the GitHub workflow "Recordatorios").

create table public.avisos_config (
  id boolean primary key default true check (id),
  token_sha256 text not null check (token_sha256 ~ '^[0-9a-f]{64}$')
);

alter table public.avisos_config enable row level security;
-- No grants and no policies: only the database owner (and the security definer functions) read it.

create function public.avisos_check_token(p_token text) returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_token is null or char_length(p_token) < 32 or not exists (
    select 1 from public.avisos_config c
    where c.token_sha256 = encode(pg_catalog.sha256(convert_to(p_token, 'UTF8')), 'hex')
  ) then
    raise exception 'invalid token' using errcode = '28000';
  end if;
end;
$$;

-- Last day of the enrollment, the day of the "último día" mail.
create function public.avisos_ultimo_dia(p_enroll_to timestamp) returns date
language sql
immutable
set search_path = ''
as $$
  select case when p_enroll_to::time < time '12:00' then p_enroll_to::date - 1 else p_enroll_to::date end
$$;

-- Which mail is due at p_now for one reminder ('primer_dia', 'ultimo_dia' or null). Pure, so the
-- rules are tested with fixed dates (tools/db-test/security.sql).
create function public.avisos_debido(
  p_now timestamp,
  p_created_at timestamp,
  p_enroll_from timestamp,
  p_enroll_to timestamp,
  p_first_sent boolean,
  p_last_sent boolean
) returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_enroll_to is null or p_last_sent or p_now::time < time '08:00' or p_now >= p_enroll_to then null
    when p_enroll_from is not null and p_now < p_enroll_from then null
    when p_now >= public.avisos_ultimo_dia(p_enroll_to) + time '08:00'
         and p_created_at < public.avisos_ultimo_dia(p_enroll_to) + time '08:00' then 'ultimo_dia'
    when p_now >= public.avisos_ultimo_dia(p_enroll_to) + time '08:00' then null
    when not p_first_sent and p_enroll_from is not null and p_created_at < p_enroll_from
         and p_now >= p_enroll_from::date + time '08:00' then 'primer_dia'
    else null
  end
$$;

create function public.avisos_pendientes(p_token text)
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
  aviso_primer_dia text,   -- 'YYYY-MM-DD': the day each mail goes (null: that mail does not apply)
  aviso_ultimo_dia text,
  first_sent_at text,
  last_sent_at text,
  due text                 -- 'primer_dia', 'ultimo_dia' or null
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
    select r.id, u.email::text as email, r.subject_name, r.table_name, r.kind, r.exam_date,
           (r.created_at at time zone 'America/Argentina/Buenos_Aires') as created_ba,
           r.first_sent_at, r.last_sent_at,
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
         case when x.enroll_to is not null and x.created_ba < public.avisos_ultimo_dia(x.enroll_to) + time '08:00'
              then to_char(public.avisos_ultimo_dia(x.enroll_to), 'YYYY-MM-DD') end,
         to_char(x.first_sent_at at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD HH24:MI'),
         to_char(x.last_sent_at at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD HH24:MI'),
         public.avisos_debido(v_now, x.created_ba, x.enroll_from, x.enroll_to, x.first_sent_at is not null, x.last_sent_at is not null)
  from reminders x
  order by x.exam_date, x.id;
end;
$$;

-- Marks one mail as sent. Returns false when it was already marked (or the reminder is gone).
create function public.avisos_marcar_enviado(p_token text, p_reminder_id bigint, p_kind text) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform public.avisos_check_token(p_token);
  if p_kind = 'primer_dia' then
    update public.exam_reminders set first_sent_at = now() where id = p_reminder_id and first_sent_at is null;
  elsif p_kind = 'ultimo_dia' then
    update public.exam_reminders set last_sent_at = now() where id = p_reminder_id and last_sent_at is null;
  else
    raise exception 'invalid kind' using errcode = '22023';
  end if;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke execute on function public.avisos_check_token(text) from public;
revoke execute on function public.avisos_ultimo_dia(timestamp) from public;
revoke execute on function public.avisos_debido(timestamp, timestamp, timestamp, timestamp, boolean, boolean) from public;
revoke execute on function public.avisos_pendientes(text) from public;
revoke execute on function public.avisos_marcar_enviado(text, bigint, text) from public;
grant execute on function public.avisos_pendientes(text) to anon;
grant execute on function public.avisos_marcar_enviado(text, bigint, text) to anon;
