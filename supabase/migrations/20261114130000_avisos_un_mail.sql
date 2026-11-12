-- Recordarme: one mail per reminder, when the enrollment opens (Francisco, #114; confirmed by Tomás).
-- 20261114120000_avisos_rpc was applied with the first version (two mails: first and last day of the
-- enrollment); this migration replaces its functions. Rules, Buenos Aires time, the same as dueMail()
-- of #114: once, from 08:00 of the first day while the enrollment is open (a missed run sends it
-- later); never before it opens or after it closed; not when the student asked with the enrollment
-- already open or the SIU gives no opening or closing date; not for reminders that already got a
-- mail (first_sent_at or last_sent_at; nothing writes last_sent_at any more).

drop function public.avisos_marcar_enviado(text, bigint, text);
drop function public.avisos_pendientes(text);
drop function public.avisos_debido(timestamp, timestamp, timestamp, timestamp, boolean, boolean);
drop function public.avisos_ultimo_dia(timestamp);

create function public.avisos_debido(
  p_now timestamp,
  p_created_at timestamp,
  p_enroll_from timestamp,
  p_enroll_to timestamp,
  p_sent boolean
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    not p_sent
    and p_now::time >= time '08:00'
    and p_now >= p_enroll_from
    and p_now < p_enroll_to
    and p_created_at < p_enroll_from
    and p_now >= p_enroll_from::date + time '08:00',
    false)
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
    select r.id, u.email::text as email, r.subject_name, r.table_name, r.kind, r.exam_date,
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

-- Marks the mail of one reminder as sent (first_sent_at). Returns false when it was already
-- marked or the reminder is gone.
create function public.avisos_marcar_enviado(p_token text, p_reminder_id bigint) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform public.avisos_check_token(p_token);
  update public.exam_reminders set first_sent_at = now() where id = p_reminder_id and first_sent_at is null;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke execute on function public.avisos_debido(timestamp, timestamp, timestamp, timestamp, boolean) from public;
revoke execute on function public.avisos_pendientes(text) from public;
revoke execute on function public.avisos_marcar_enviado(text, bigint) from public;
grant execute on function public.avisos_pendientes(text) to anon;
grant execute on function public.avisos_marcar_enviado(text, bigint) to anon;
