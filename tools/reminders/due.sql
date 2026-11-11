-- Pending "Recordarme" reminders and the current exam tables they may point to, as one JSON object
-- { reminders, tables } (see Dump in src/lib/reminders/bot.ts). Run by the workflow "Recordatorios"
-- as the database owner with psql -At, into a file of the runner: it has the students' mails, so it
-- is never printed. Which mail is due is decided in TypeScript (planRun()).
--
-- Only reminders of the student's current plan (after changing plan they no longer apply), with an
-- exam date from today on and some mail still to send.
with today as (select (now() at time zone 'America/Argentina/Buenos_Aires')::date as d),
pending as (
  select r.id, u.email, r.plan_id, r.siu_subject_code as code, r.table_name as name, r.kind,
         to_char(r.exam_date, 'YYYY-MM-DD') as date, r.subject_name,
         to_char(r.created_at at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD"T"HH24:MI') as created_at,
         r.first_sent_at is not null as first_sent,
         r.last_sent_at is not null as last_sent
  from public.exam_reminders r
  join public.profiles p on p.id = r.user_id and p.plan_id = r.plan_id
  join auth.users u on u.id = r.user_id
  cross join today
  where r.last_sent_at is null
    and r.exam_date >= today.d
    and u.email is not null
),
tables as (
  select t.plan_id, t.siu_subject_code as code, t.name, t.kind, to_char(t.exam_date, 'YYYY-MM-DD') as date,
         to_char(t.enroll_from, 'YYYY-MM-DD"T"HH24:MI') as enroll_from,
         to_char(t.enroll_to, 'YYYY-MM-DD"T"HH24:MI') as enroll_to,
         to_char(t.start_time, 'HH24:MI') as start_time,
         to_char(t.end_time, 'HH24:MI') as end_time
  from public.exam_tables t
  where exists (select 1 from pending p where p.plan_id = t.plan_id and p.code = t.siu_subject_code and p.date = to_char(t.exam_date, 'YYYY-MM-DD'))
)
select json_build_object(
  'reminders', coalesce((select json_agg(pending order by id) from pending), '[]'::json),
  'tables', coalesce((select json_agg(tables) from tables), '[]'::json)
);
